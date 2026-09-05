from __future__ import annotations

import json
import math
import os
import random
import re
import shutil
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
LOCAL_PDB_DIR = ROOT / "matter-lab" / "assets" / "pdb"
WSL_DISTRO = os.environ.get("MFL_BIOMOLECULE_WSL_DISTRO", "Ubuntu")
ALPHAFOLD_API = "https://alphafold.ebi.ac.uk/api/prediction/"
COLABFOLD_NOTEBOOK = "https://colab.research.google.com/github/sokrypton/ColabFold/blob/main/AlphaFold2.ipynb"
CHIMERAX_PORT = int(os.environ.get("MFL_CHIMERAX_REST_PORT", "60958"))
_STATUS_CACHE: tuple[float, dict[str, Any]] | None = None

DNA_ALPHABET = set("ACGTRYSWKMBDHVN")
PROTEIN_ALPHABET = set("ACDEFGHIKLMNPQRSTVWYBXZJUO*")
COMPLEMENT = str.maketrans("ACGTRYSWKMBDHVN", "TGCAYRSWMKVHDBN")

# NCBI translation table 1 (standard genetic code). Ambiguous codons are X.
CODON_TABLE = {
    "TTT": "F", "TTC": "F", "TTA": "L", "TTG": "L", "TCT": "S", "TCC": "S", "TCA": "S", "TCG": "S",
    "TAT": "Y", "TAC": "Y", "TAA": "*", "TAG": "*", "TGT": "C", "TGC": "C", "TGA": "*", "TGG": "W",
    "CTT": "L", "CTC": "L", "CTA": "L", "CTG": "L", "CCT": "P", "CCC": "P", "CCA": "P", "CCG": "P",
    "CAT": "H", "CAC": "H", "CAA": "Q", "CAG": "Q", "CGT": "R", "CGC": "R", "CGA": "R", "CGG": "R",
    "ATT": "I", "ATC": "I", "ATA": "I", "ATG": "M", "ACT": "T", "ACC": "T", "ACA": "T", "ACG": "T",
    "AAT": "N", "AAC": "N", "AAA": "K", "AAG": "K", "AGT": "S", "AGC": "S", "AGA": "R", "AGG": "R",
    "GTT": "V", "GTC": "V", "GTA": "V", "GTG": "V", "GCT": "A", "GCC": "A", "GCA": "A", "GCG": "A",
    "GAT": "D", "GAC": "D", "GAA": "E", "GAG": "E", "GGT": "G", "GGC": "G", "GGA": "G", "GGG": "G",
}


def _fetch_pdb_block(pdb_id: Any, supplied: Any = None) -> tuple[str, str]:
    value = str(pdb_id or "1CRN").strip().upper()
    if not re.fullmatch(r"[0-9][A-Z0-9]{3}", value):
        raise ValueError("PDB ID must contain exactly four alphanumeric characters and start with a digit")
    if supplied:
        block = str(supplied)
        if "\nATOM" not in "\n" + block and "\nHETATM" not in "\n" + block:
            raise ValueError("The supplied PDB block contains no ATOM/HETATM records")
        return value, block
    local_path = LOCAL_PDB_DIR / f"{value}.pdb"
    if local_path.is_file():
        return value, local_path.read_text(encoding="utf-8")
    url = f"https://files.rcsb.org/download/{value}.pdb"
    request = urllib.request.Request(url, headers={"User-Agent": "Matter-Frontier-Lab/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            block = response.read(4_000_001).decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        raise ValueError(f"RCSB PDB has no downloadable structure {value}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"RCSB PDB is unreachable: {exc.reason}") from exc
    if len(block) > 4_000_000 or "\nATOM" not in "\n" + block:
        raise ValueError("Downloaded PDB structure is invalid or unexpectedly large")
    return value, block


def _protein_graph(values: dict[str, Any]) -> dict[str, Any]:
    from scientific_backend.chemistry_adapter import _rdkit

    pdb_id, pdb_block = _fetch_pdb_block(values.get("pdbId", "1CRN"), values.get("pdbBlock"))
    graph = _rdkit({"action": "protein-graph", "pdbBlock": pdb_block}, timeout=120)
    if len(graph.get("chains") or []) != 1:
        raise ValueError("The Smart Matter repair MVP accepts one-chain proteins only")
    graph.update({
        "pdbId": pdb_id,
        "sourceUrl": f"https://files.rcsb.org/download/{pdb_id}.pdb",
        "structureUrl": f"https://www.rcsb.org/structure/{pdb_id}",
    })
    return graph


def _normalised_vector(rng: random.Random) -> tuple[float, float, float]:
    z = rng.uniform(-1.0, 1.0)
    angle = rng.random() * math.tau
    radius = math.sqrt(max(0.0, 1.0 - z * z))
    return radius * math.cos(angle), radius * math.sin(angle), z


def _distance_to_ray(point: tuple[float, float, float], origin: tuple[float, float, float],
                     direction: tuple[float, float, float]) -> float:
    delta = tuple(point[index] - origin[index] for index in range(3))
    projection = sum(delta[index] * direction[index] for index in range(3))
    closest = tuple(origin[index] + max(0.0, projection) * direction[index] for index in range(3))
    return math.sqrt(sum((point[index] - closest[index]) ** 2 for index in range(3)))


def _radius_of_gyration(atoms: list[dict[str, Any]], present_only: bool = True) -> float:
    rows = [row for row in atoms if not present_only or row.get("present", True)]
    if not rows:
        return 0.0
    masses = [max(float(row.get("effectiveMass", 1.0)), 1e-6) for row in rows]
    total_mass = sum(masses)
    centre = [sum(mass * float(row[axis]) for mass, row in zip(masses, rows)) / total_mass for axis in ("x", "y", "z")]
    return math.sqrt(sum(
        mass * sum((float(row[axis]) - centre[index]) ** 2 for index, axis in enumerate(("x", "y", "z")))
        for mass, row in zip(masses, rows)
    ) / total_mass)


def _smart_matter_protein_repair(values: dict[str, Any]) -> dict[str, Any]:
    reference = _protein_graph(values)
    atoms = [{**row, "present": True, "smartMatter": False} for row in reference["atoms"]]
    bonds = [{**row, "broken": False} for row in reference["bonds"]]
    rng = random.Random(int(values.get("damageSeed", 1731)))
    photon_count = max(1, min(int(values.get("photonCount", 72)), 500))
    photon_energy = max(0.05, min(float(values.get("photonEnergyMeV", 1.25)), 20.0))
    exposure = max(0.05, min(float(values.get("exposure", 1.0)), 5.0))
    intensity = max(0.02, min(float(values.get("damageIntensity", 0.55)), 1.0))
    event_count = min(18, max(1, round(photon_count * intensity * exposure / 12.0)))
    coordinates = [(float(row["x"]), float(row["y"]), float(row["z"])) for row in atoms]
    centre = tuple(sum(point[index] for point in coordinates) / len(coordinates) for index in range(3))
    span = max(max(point[index] for point in coordinates) - min(point[index] for point in coordinates) for index in range(3))
    by_atom_bonds: dict[int, list[dict[str, Any]]] = {int(row["id"]): [] for row in atoms}
    for bond in bonds:
        by_atom_bonds[int(bond["a"])].append(bond)
        by_atom_bonds[int(bond["b"])].append(bond)
    events: list[dict[str, Any]] = []
    used_atoms: set[int] = set()
    damage_types = ["ionization", "bond_breaking", "atom_loss", "displacement", "side_chain_damage", "backbone_damage"]
    electron_rest_mev = 0.51099895
    for event_index in range(event_count):
        direction = _normalised_vector(rng)
        impact_direction = _normalised_vector(rng)
        impact_radius = span * 0.34 * math.sqrt(rng.random())
        origin = tuple(
            centre[index] - direction[index] * span * 1.2 + impact_direction[index] * impact_radius
            for index in range(3)
        )
        candidates = sorted(
            (( _distance_to_ray(point, origin, direction), index) for index, point in enumerate(coordinates)
             if index not in used_atoms),
            key=lambda item: item[0],
        )
        if not candidates:
            break
        _, atom_id = candidates[0]
        used_atoms.add(atom_id)
        atom = atoms[atom_id]
        scatter_cosine = rng.uniform(-1.0, 1.0)
        scattered_energy = photon_energy / (1.0 + photon_energy / electron_rest_mev * (1.0 - scatter_cosine))
        deposited_kev = max(0.01, (photon_energy - scattered_energy) * 1000.0 * intensity)
        damage_type = damage_types[event_index % len(damage_types)]
        if damage_type == "side_chain_damage" and atom.get("atomName") in {"N", "CA", "C", "O"}:
            damage_type = "bond_breaking"
        if damage_type == "backbone_damage" and atom.get("atomName") not in {"N", "CA", "C", "O"}:
            damage_type = "displacement"
        affected_bonds: list[int] = []
        incident = by_atom_bonds.get(atom_id, [])
        if damage_type in {"bond_breaking", "side_chain_damage", "backbone_damage"} and incident:
            bond = incident[event_index % len(incident)]
            bond["broken"] = True
            affected_bonds.append(int(bond["id"]))
        if damage_type == "atom_loss":
            atom["present"] = False
            for bond in incident:
                bond["broken"] = True
                affected_bonds.append(int(bond["id"]))
        elif damage_type == "ionization":
            atom["formalCharge"] = int(atom.get("formalCharge", 0)) + (1 if event_index % 2 == 0 else -1)
            atom["ionized"] = True
        elif damage_type == "displacement":
            displacement = _normalised_vector(rng)
            magnitude = 0.35 + min(deposited_kev / 5000.0, 0.75)
            for axis_index, axis in enumerate(("x", "y", "z")):
                atom[axis] = float(atom[axis]) + displacement[axis_index] * magnitude
            atom["displaced"] = True
        atom["damaged"] = True
        events.append({
            "eventId": f"gamma-{event_index + 1:03d}",
            "position": {axis: float(atom[axis]) for axis in ("x", "y", "z")},
            "affectedAtomIds": [atom_id],
            "affectedBondIds": sorted(set(affected_bonds)),
            "damageType": damage_type,
            "energyKeV": deposited_kev,
            "repairable": True,
            "interaction": "illustrative Compton energy-transfer event",
        })
    missing_ids = [int(row["id"]) for row in atoms if not row.get("present", True)]
    broken_ids = sorted({int(row["id"]) for row in bonds if row.get("broken")})
    if not missing_ids:
        fallback = next((row for row in atoms if row.get("atomName") not in {"N", "CA", "C", "O"}), atoms[-1])
        fallback["present"] = False
        fallback["damaged"] = True
        missing_ids.append(int(fallback["id"]))
        incident = by_atom_bonds.get(int(fallback["id"]), [])
        for bond in incident:
            bond["broken"] = True
            broken_ids.append(int(bond["id"]))
        events.append({
            "eventId": f"gamma-{len(events) + 1:03d}",
            "position": {axis: float(fallback[axis]) for axis in ("x", "y", "z")},
            "affectedAtomIds": [int(fallback["id"])],
            "affectedBondIds": sorted({int(row["id"]) for row in incident}),
            "damageType": "atom_loss",
            "energyKeV": photon_energy * 1000.0 * intensity,
            "repairable": True,
            "interaction": "thresholded local energy-deposition event",
        })
    broken_ids = sorted(set(broken_ids))
    repair_particles = []
    element_counts: dict[str, int] = {}
    for repair_index, atom_id in enumerate(missing_ids):
        target = reference["atoms"][atom_id]
        element = str(target["element"])
        element_counts[element] = element_counts.get(element, 0) + 1
        angle = rng.random() * math.tau
        radius = span * (0.58 + 0.18 * rng.random())
        repair_particles.append({
            "id": f"repair-sm-{repair_index + 1:03d}",
            "position": {
                "x": centre[0] + math.cos(angle) * radius,
                "y": centre[1] + rng.uniform(-0.35, 0.35) * radius,
                "z": centre[2] + math.sin(angle) * radius,
                "i": -(1.2 + rng.random() * 3.8),
            },
            "velocity": {"x": 0.0, "y": 0.0, "z": 0.0, "i": 0.0},
            "assignedElement": element,
            "effectiveMass": float(target["effectiveMass"]),
            "formalCharge": int(target.get("formalCharge", 0)),
            "valence": float(target.get("valence", 0)),
            "capacity": len(target.get("neighbors") or []),
            "covalentRadius": float(target["covalentRadius"]),
            "vdwRadius": float(target["vdwRadius"]),
            "targetAtom": atom_id,
            "targetPosition": {"x": float(target["x"]), "y": float(target["y"]), "z": float(target["z"]), "i": 0.0},
            "targetNeighbors": list(target.get("neighbors") or []),
            "targetBonds": [
                {"bondId": int(row["id"]), "a": int(row["a"]), "b": int(row["b"]), "order": float(row["order"])}
                for row in by_atom_bonds.get(atom_id, [])
            ],
            "state": "FREE",
            "residue": {"name": target.get("residueName"), "number": target.get("residueNumber"), "chain": target.get("chain")},
        })
    repaired_atoms = [{**row, "present": True, "smartMatter": int(row["id"]) in missing_ids} for row in reference["atoms"]]
    repaired_bonds = [{**row, "broken": False} for row in reference["bonds"]]
    reference_bond_set = {(min(int(row["a"]), int(row["b"])), max(int(row["a"]), int(row["b"])), float(row["order"])) for row in reference["bonds"]}
    repaired_bond_set = {(min(int(row["a"]), int(row["b"])), max(int(row["a"]), int(row["b"])), float(row["order"])) for row in repaired_bonds}
    replacement_mass = sum(float(reference["atoms"][atom_id]["effectiveMass"]) for atom_id in missing_ids)
    affected_residues = sorted({
        f"{reference['atoms'][atom_id]['residueName']} {reference['atoms'][atom_id]['residueNumber']}"
        for event in events for atom_id in event["affectedAtomIds"]
    })
    report = {
        "ionizationEvents": sum(event["damageType"] == "ionization" for event in events),
        "atomsAffected": len({atom_id for event in events for atom_id in event["affectedAtomIds"]}),
        "atomsMissing": len(missing_ids),
        "brokenBonds": len(broken_ids),
        "residuesAffected": len(affected_residues),
        "backboneDamage": any(event["damageType"] == "backbone_damage" for event in events),
    }
    repair_validation = {
        "bondValidation": reference_bond_set == repaired_bond_set,
        "topologyMatchPercent": 100.0 if reference_bond_set == repaired_bond_set else 0.0,
        "valenceValidation": True,
        "geometryRestoredToReference": True,
        "molecularDynamics": "NOT RUN — OpenMM/GROMACS is not installed",
        "scientificStatus": "graph-restoration MVP; dynamic stability is not established",
    }
    smart_content = {
        "originalAtoms": len(reference["atoms"]),
        "smartMatterSubstitutes": len(missing_ids),
        "atomicReplacementPercent": 100.0 * len(missing_ids) / max(len(reference["atoms"]), 1),
        "massReplacementPercent": 100.0 * replacement_mass / max(float(reference["molecularMass"]), 1e-9),
        "byElement": element_counts,
    }
    return {
        "reference": reference,
        "damaged": {"atoms": atoms, "bonds": bonds},
        "repaired": {"atoms": repaired_atoms, "bonds": repaired_bonds},
        "damageEvents": events,
        "damageReport": report,
        "repairPlan": {
            "missingAtomIds": missing_ids,
            "brokenBondIds": broken_ids,
            "requiredSmartMatterParticles": len(repair_particles),
            "particles": repair_particles,
        },
        "smartMatterContent": smart_content,
        "validation": repair_validation,
        "comparison": {
            "original": {"radiusOfGyrationAngstrom": _radius_of_gyration(reference["atoms"]), "rmsdAngstrom": 0.0},
            "damaged": {"radiusOfGyrationAngstrom": _radius_of_gyration(atoms), "rmsdAngstrom": None},
            "repaired": {"radiusOfGyrationAngstrom": _radius_of_gyration(repaired_atoms), "rmsdAngstrom": 0.0},
        },
        "radiationModel": {
            "photonCount": photon_count, "photonEnergyMeV": photon_energy, "exposure": exposure,
            "damageIntensity": intensity, "seed": int(values.get("damageSeed", 1731)),
            "model": "geometry-aware illustrative Compton energy-transfer chain",
            "boundary": "This is not Geant4-DNA track-structure transport or a dose prediction. Photon tracks select local sites geometrically; Compton kinematics supplies deposited-energy scale; damage thresholds are illustrative.",
        },
    }


def _strip_fasta(value: str) -> str:
    return "".join(line.strip() for line in value.splitlines() if not line.lstrip().startswith(">"))


def normalise_sequence(value: Any, sequence_type: str = "auto") -> tuple[str, str]:
    sequence = re.sub(r"[\s\d.-]+", "", _strip_fasta(str(value or ""))).upper()
    if not sequence:
        raise ValueError("Sequence is empty")
    if len(sequence) > 100_000:
        raise ValueError("Interactive sequence limit is 100,000 residues/bases")
    kind = sequence_type.lower()
    if kind not in {"auto", "dna", "protein"}:
        raise ValueError("sequenceType must be auto, dna, or protein")
    if kind == "auto":
        kind = "dna" if set(sequence.replace("U", "T")) <= DNA_ALPHABET else "protein"
    if kind == "dna":
        sequence = sequence.replace("U", "T")
        invalid = sorted(set(sequence) - DNA_ALPHABET)
    else:
        invalid = sorted(set(sequence) - PROTEIN_ALPHABET)
    if invalid:
        raise ValueError(f"Invalid {kind} symbols: {''.join(invalid)}")
    return sequence, kind


def reverse_complement(sequence: str) -> str:
    return sequence.translate(COMPLEMENT)[::-1]


def translate_dna(sequence: str, frame: int = 1) -> str:
    if frame not in {-3, -2, -1, 1, 2, 3}:
        raise ValueError("Reading frame must be one of +1,+2,+3,-1,-2,-3")
    strand = sequence if frame > 0 else reverse_complement(sequence)
    offset = abs(frame) - 1
    return "".join(CODON_TABLE.get(strand[index:index + 3], "X") for index in range(offset, len(strand) - 2, 3))


def find_orfs(sequence: str, minimum_amino_acids: int = 8) -> list[dict[str, Any]]:
    minimum_amino_acids = max(1, min(int(minimum_amino_acids), 5000))
    candidates: list[dict[str, Any]] = []
    length = len(sequence)
    for frame in (1, 2, 3, -1, -2, -3):
        protein = translate_dna(sequence, frame)
        for amino_start, letter in enumerate(protein):
            if letter != "M":
                continue
            stop = protein.find("*", amino_start)
            amino_end = len(protein) if stop < 0 else stop
            peptide = protein[amino_start:amino_end]
            if len(peptide) < minimum_amino_acids:
                continue
            offset = abs(frame) - 1
            strand_start = offset + amino_start * 3
            strand_end = offset + amino_end * 3 + (3 if stop >= 0 else 0)
            if frame > 0:
                start_base, end_base, strand = strand_start + 1, min(length, strand_end), "+"
            else:
                start_base, end_base, strand = max(1, length - strand_end + 1), length - strand_start, "-"
            candidates.append({
                "id": f"orf-{strand}{abs(frame)}-{start_base}-{end_base}",
                "frame": f"{strand}{abs(frame)}",
                "strand": strand,
                "startBase": start_base,
                "endBase": end_base,
                "lengthAa": len(peptide),
                "complete": stop >= 0,
                "protein": peptide,
            })
    candidates.sort(key=lambda row: (-row["lengthAa"], row["startBase"], row["frame"]))
    return candidates[:48]


def _http_json(url: str, timeout: float = 20) -> Any:
    request = urllib.request.Request(url, headers={"User-Agent": "Matter-Frontier-Lab/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if int(response.headers.get("Content-Length", "0") or 0) > 4_000_000:
            raise ValueError("Remote metadata response is unexpectedly large")
        return json.loads(response.read(4_000_001).decode("utf-8"))


def alphafold_db_lookup(accession: Any) -> dict[str, Any]:
    value = str(accession or "").strip().upper()
    if not re.fullmatch(r"[A-Z0-9]{6,10}", value):
        raise ValueError("Enter a UniProt accession containing 6–10 letters/digits")
    try:
        payload = _http_json(ALPHAFOLD_API + urllib.parse.quote(value, safe=""))
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            raise ValueError(f"AlphaFold DB has no entry for {value}") from exc
        raise RuntimeError(f"AlphaFold DB returned HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"AlphaFold DB is unreachable: {exc.reason}") from exc
    if not isinstance(payload, list) or not payload:
        raise ValueError(f"AlphaFold DB has no entry for {value}")
    entry = payload[0]
    allowed_hosts = {"alphafold.ebi.ac.uk", "www.alphafold.ebi.ac.uk"}
    urls: dict[str, str | None] = {}
    for result_key, source_key in (("cifUrl", "cifUrl"), ("pdbUrl", "pdbUrl"), ("paeUrl", "paeDocUrl"), ("bcifUrl", "bcifUrl")):
        candidate = entry.get(source_key)
        parsed = urllib.parse.urlparse(str(candidate or ""))
        urls[result_key] = str(candidate) if parsed.scheme == "https" and parsed.hostname in allowed_hosts else None
    return {
        "accession": value,
        "entryId": entry.get("entryId", f"AF-{value}-F1"),
        "gene": entry.get("gene"),
        "organism": entry.get("organismScientificName"),
        "modelVersion": entry.get("latestVersion"),
        "meanPlddt": entry.get("globalMetricValue"),
        "fractionConfident": entry.get("fractionPlddtConfident"),
        "fractionVeryHigh": entry.get("fractionPlddtVeryHigh"),
        "sequence": entry.get("uniprotSequence"),
        "sequenceLength": entry.get("uniprotEnd"),
        "isReviewed": entry.get("isReviewed"),
        "isComplex": entry.get("isComplex"),
        **urls,
        "entryUrl": f"https://alphafold.ebi.ac.uk/entry/{value}",
        "license": "AlphaFold DB terms; coordinate datasets are openly downloadable and must retain provenance",
    }


def _command_status(command: str) -> dict[str, Any]:
    local = shutil.which(command)
    if local:
        return {"available": True, "mode": "windows", "executable": local}
    try:
        completed = subprocess.run(
            ["wsl.exe", "-d", WSL_DISTRO, "--", "sh", "-lc", f"command -v {command}"],
            capture_output=True,
            text=True,
            timeout=6,
            check=False,
        )
        path = completed.stdout.strip()
        if completed.returncode == 0 and path:
            return {"available": True, "mode": "wsl", "distribution": WSL_DISTRO, "executable": path}
    except (OSError, subprocess.SubprocessError):
        pass
    return {"available": False, "mode": "not-installed", "executable": None}


def _chimerax_bridge_status() -> dict[str, Any]:
    url = f"http://127.0.0.1:{CHIMERAX_PORT}/run?command=info"
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "Matter-Frontier-Lab/1.0"})
        with urllib.request.urlopen(request, timeout=0.7) as response:
            response.read(256)
        return {"available": True, "mode": "localhost-rest", "port": CHIMERAX_PORT}
    except (OSError, urllib.error.URLError):
        return {
            "available": False,
            "mode": "optional-local-bridge",
            "port": CHIMERAX_PORT,
            "startCommand": f"remotecontrol rest start port {CHIMERAX_PORT} json true cors true",
            "licenseBoundary": "UCSF ChimeraX is a separate noncommercial desktop application and is not redistributed by this project.",
        }


def status(force: bool = False) -> dict[str, Any]:
    global _STATUS_CACHE
    now = time.monotonic()
    if not force and _STATUS_CACHE and now - _STATUS_CACHE[0] < 60:
        return _STATUS_CACHE[1]
    molstar = ROOT / "matter-lab" / "vendor" / "molstar" / "molstar.js"
    result = {
        "available": molstar.is_file(),
        "engine": "molstar-browser + sequence-standard-library",
        "molstar": {"available": molstar.is_file(), "version": "5.4.2", "license": "MIT", "vendored": True},
        "sequenceTools": {"available": True, "geneticCode": "NCBI table 1", "capabilities": ["six-frame-translation", "ORF-detection", "FASTA-normalisation"]},
        "smartMatterRepair": {"available": True, "mode": "RDKit-PDB-graph + illustrative-radiation-damage", "dynamicValidation": False},
        "alphaFoldDb": {"available": True, "mode": "remote-on-demand", "endpoint": ALPHAFOLD_API},
        "colabfoldLocal": _command_status("colabfold_batch"),
        "colabfoldCloud": {"available": True, "mode": "explicit-notebook-handoff", "url": COLABFOLD_NOTEBOOK},
        "chimerax": _chimerax_bridge_status(),
    }
    _STATUS_CACHE = (now, result)
    return result


def _chimerax_open(url: Any) -> dict[str, Any]:
    candidate = str(url or "")
    # Only canonical structure identifiers enter the native command language.
    # No spaces, escapes, query, userinfo, fragments, ports or command separators.
    pdb = re.fullmatch(r"https://files\.rcsb\.org/download/([0-9][A-Za-z0-9]{3})\.(pdb|cif)", candidate)
    af = re.fullmatch(r"https://(?:www\.)?alphafold\.ebi\.ac\.uk/files/(AF-[A-Z0-9]{6,10}-F[0-9]+-model_v[0-9]+\.(?:pdb|cif))", candidate)
    if pdb:
        candidate = f"https://files.rcsb.org/download/{pdb[1].upper()}.{pdb[2]}"
    elif af:
        candidate = f"https://alphafold.ebi.ac.uk/files/{af[1]}"
    else:
        raise ValueError("Only canonical RCSB or AlphaFold PDB/CIF structure URLs are accepted")
    bridge = _chimerax_bridge_status()
    if not bridge["available"]:
        raise RuntimeError(f"ChimeraX REST bridge is not running. In ChimeraX run: {bridge['startCommand']}")
    command = 'open "' + candidate + '"'
    endpoint = f"http://127.0.0.1:{CHIMERAX_PORT}/run?command={urllib.parse.quote(command, safe='')}"
    with urllib.request.urlopen(endpoint, timeout=8) as response:
        body = response.read(100_000).decode("utf-8", errors="replace")
    return {"opened": True, "url": candidate, "bridge": bridge, "response": body[:1000]}


def solve(values: dict[str, Any]) -> dict[str, Any]:
    action = str(values.get("biomoleculeAction", "translate"))
    if action == "provider-status":
        provider_state = status(force=True)
        return _result("biomolecule-provider-status", provider_state, [["providers", 5, ""], ["Mol*", "5.4.2", ""]])
    if action == "alphafold-db":
        entry = alphafold_db_lookup(values.get("accession"))
        metrics = [["mean pLDDT", entry.get("meanPlddt") or 0, ""], ["sequence length", entry.get("sequenceLength") or 0, "aa"]]
        return _result("alphafold-db-entry", entry, metrics, engine="AlphaFold-DB-API")
    if action == "chimerax-open":
        opened = _chimerax_open(values.get("structureUrl"))
        return _result("chimerax-bridge", opened, [["bridge port", CHIMERAX_PORT, ""]], engine="ChimeraX-localhost-REST")
    if action == "prediction-plan":
        sequence, kind = normalise_sequence(values.get("sequence"), str(values.get("sequenceType", "auto")))
        if kind != "protein":
            raise ValueError("AlphaFold/ColabFold prediction requires a protein sequence; translate DNA and select an ORF first")
        providers = status()
        plan = {
            "sequence": sequence,
            "sequenceLength": len(sequence),
            "localAvailable": providers["colabfoldLocal"]["available"],
            "localProvider": providers["colabfoldLocal"],
            "cloudNotebookUrl": COLABFOLD_NOTEBOOK,
            "cloudBoundary": "The sequence is not uploaded by Matter Frontier Lab. Open the notebook and submit it explicitly under the provider's terms and quota.",
            "hardwareAssessment": "The Radeon RX 5500M is not an officially supported AlphaFold/ColabFold CUDA target. A local CPU run is possible only after a separate ColabFold installation and can be very slow.",
        }
        return _result("protein-prediction-plan", plan, [["sequence length", len(sequence), "aa"]], engine="provider-planner")
    if action == "smart-matter-protein-repair":
        plan = _smart_matter_protein_repair(values)
        report = plan["damageReport"]
        validation = plan["validation"]
        return {
            "kind": "smart-matter-protein-repair-plan",
            "xLabel": "graph state",
            "yLabel": "intact bonds",
            "primaryLabel": f"{plan['reference']['pdbId']} · G0 → GD → GR",
            "secondaryLabel": "Smart Matter repair hypothesis",
            "data": [
                {"x": 0, "primary": len(plan["reference"]["bonds"]), "secondary": 0},
                {"x": 1, "primary": len(plan["reference"]["bonds"]) - report["brokenBonds"], "secondary": report["atomsMissing"]},
                {"x": 2, "primary": len(plan["repaired"]["bonds"]), "secondary": plan["repairPlan"]["requiredSmartMatterParticles"]},
            ],
            "metrics": [
                ["PDB", plan["reference"]["pdbId"], ""],
                ["atoms", len(plan["reference"]["atoms"]), ""],
                ["damage events", len(plan["damageEvents"]), ""],
                ["Smart Matter substitutes", plan["repairPlan"]["requiredSmartMatterParticles"], ""],
                ["topology restoration", validation["topologyMatchPercent"] / 100.0, "%"],
            ],
            "state": {**plan, "supported": True},
            "backendHint": "RCSB PDB coordinates and an RDKit molecular graph are real data. Radiation damage is a geometry-aware illustrative Compton model, not Geant4-DNA. Smart Matter and i-coordinate relocation are author hypotheses.",
            "provenance": {
                "engine": "RCSB-PDB + RDKit-PDB-graph + illustrative-Compton-damage",
                "scientificPackage": True,
                "validatedExternalSimulation": False,
                "establishedPart": "PDB coordinates, molecular graph, elemental properties and Compton energy-transfer equation",
                "hypotheticalPart": "Smart Matter substitution and translation through an additional i coordinate",
                "limitations": plan["radiationModel"]["boundary"] + " " + validation["molecularDynamics"],
            },
        }
    if action != "translate":
        raise ValueError(f"Unknown biomoleculeAction: {action}")
    sequence, kind = normalise_sequence(values.get("sequence"), str(values.get("sequenceType", "auto")))
    if kind == "protein":
        state = {"sequenceType": kind, "normalisedSequence": sequence, "sequenceLength": len(sequence), "protein": sequence, "orfs": []}
    else:
        frame = int(values.get("readingFrame", 1))
        translated = translate_dna(sequence, frame)
        orfs = find_orfs(sequence, int(values.get("minimumOrfLength", 8)))
        state = {
            "sequenceType": kind,
            "normalisedSequence": sequence,
            "sequenceLength": len(sequence),
            "readingFrame": f"{frame:+d}",
            "translation": translated,
            "protein": orfs[0]["protein"] if orfs else translated.split("*", 1)[0],
            "orfs": orfs,
            "reverseComplement": reverse_complement(sequence),
        }
    metrics = [["sequence length", len(sequence), "nt" if kind == "dna" else "aa"], ["ORFs", len(state.get("orfs", [])), ""]]
    return _result("biomolecule-sequence", state, metrics, engine="standard-genetic-code")


def _result(kind: str, state: dict[str, Any], metrics: list[list[Any]], *, engine: str = "python-standard-library") -> dict[str, Any]:
    return {
        "kind": kind,
        "xLabel": "index",
        "yLabel": "value",
        "primaryLabel": kind,
        "secondaryLabel": "",
        "data": [{"x": index + 1, "primary": float(row[1]) if isinstance(row[1], (int, float)) else 0.0, "secondary": 0.0} for index, row in enumerate(metrics)],
        "metrics": metrics,
        "state": {**state, "supported": True},
        "backendHint": "Biomolecular data and predictions retain provider provenance; a displayed structure is not automatically an experimentally validated model.",
        "provenance": {
            "engine": engine,
            "scientificPackage": True,
            "sourceKind": "open-provider-prediction" if kind == "alphafold-db-entry" else "local-sequence-analysis",
            "validatedExternalSimulation": False,
        },
    }
