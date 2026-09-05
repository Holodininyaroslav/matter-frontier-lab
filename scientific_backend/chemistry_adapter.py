from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
RDKIT_WORKER = Path(__file__).resolve().with_name("rdkit_worker.py")
PYSCF_WORKER = Path(__file__).resolve().with_name("pyscf_worker.py")
def _science_python(root: Path = ROOT, platform: str = os.name) -> Path:
    """Prefer the platform's project venv, otherwise the active interpreter."""
    relative = ("Scripts", "python.exe") if platform == "nt" else ("bin", "python")
    candidate = root.joinpath(".venv-science", *relative)
    return candidate if candidate.is_file() else Path(sys.executable)


SCIENCE_PYTHON = _science_python()
WSL_DISTRO = os.environ.get("MFL_CHEMISTRY_WSL_DISTRO", "Ubuntu")
WSL_PYTHON = os.environ.get("MFL_CHEMISTRY_PYTHON", "/root/.matter-frontier-lab/chem-env/bin/python")
_STATUS_CACHE: tuple[float, dict[str, Any]] | None = None


def _wsl_path(path: Path) -> str:
    resolved = path.resolve()
    return f"/mnt/{resolved.drive.rstrip(':').lower()}{resolved.as_posix().split(':', 1)[-1]}"


def _json_command(command: list[str], *, payload: dict[str, Any] | None = None, timeout: int = 180) -> dict[str, Any]:
    attempts = 3 if Path(command[0]).name.lower() == "wsl.exe" else 1
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            completed = subprocess.run(
                command,
                input=json.dumps(payload).encode("utf-8") if payload is not None else None,
                check=True,
                capture_output=True,
                text=False,
                timeout=timeout,
            )
            return json.loads(completed.stdout.decode("utf-8-sig"))
        except (subprocess.CalledProcessError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt + 1 < attempts:
                # WSL can transiently return 0xffffffff while its VM is waking.
                # A bounded retry keeps the scientific command deterministic
                # without hiding persistent worker or environment failures.
                time.sleep(0.6 * (attempt + 1))
    assert last_error is not None
    raise last_error


def _rdkit(payload: dict[str, Any], *, timeout: int = 90) -> dict[str, Any]:
    return _json_command([str(SCIENCE_PYTHON), str(RDKIT_WORKER), "--request"], payload=payload, timeout=timeout)


def _error_text(exc: Exception) -> str:
    if isinstance(exc, subprocess.CalledProcessError):
        detail = exc.stderr or exc.stdout or ""
        if isinstance(detail, bytes):
            # wsl.exe emits Windows host errors as UTF-16LE while Linux
            # workers emit UTF-8. Preserve both instead of exposing mojibake.
            encoding = "utf-16-le" if b"\x00" in detail[:80] else "utf-8"
            detail = detail.decode(encoding, errors="replace")
        detail = str(detail).replace("\x00", "").strip()
        return f"process exited with code {exc.returncode}" + (f": {detail[-500:]}" if detail else "")
    return f"{type(exc).__name__}: {exc}"


def status(force: bool = False) -> dict[str, Any]:
    global _STATUS_CACHE
    now = time.monotonic()
    if not force and _STATUS_CACHE and now - _STATUS_CACHE[0] < 60:
        return _STATUS_CACHE[1]
    try:
        rdkit = _json_command([str(SCIENCE_PYTHON), str(RDKIT_WORKER), "--status"], timeout=30)
    except Exception as exc:
        rdkit = {"available": False, "engine": "rdkit-native", "error": _error_text(exc)}
    try:
        pyscf = _json_command(["wsl.exe", "-d", WSL_DISTRO, "-u", "root", "--", WSL_PYTHON, _wsl_path(PYSCF_WORKER), "--status"], timeout=30)
    except Exception as exc:
        pyscf = {"available": False, "engine": "pyscf-wsl", "error": _error_text(exc),
                 "recovery": "Run wsl --shutdown, verify WSL can start, then retry. RDKit editing and reaction endpoints remain available."}
    result = {
        "available": bool(rdkit.get("available")),
        "quantumAvailable": bool(rdkit.get("available") and pyscf.get("available")),
        "engine": "rdkit-etkdg-mmff94 + pyscf-wsl",
        "rdkit": rdkit,
        "pyscf": pyscf,
        "capabilities": {"moleculeEditor": bool(rdkit.get("available")), "reactionTemplates": bool(rdkit.get("available")),
                         "quantumChemistry": bool(rdkit.get("available") and pyscf.get("available"))},
    }
    _STATUS_CACHE = (now, result)
    return result


def solve(values: dict[str, Any]) -> dict[str, Any]:
    action = str(values.get("chemistryAction", "quantum"))
    if action == "smart-matter-plan":
        plan = _rdkit({
            "action": "smart-matter-plan",
            "preset": str(values.get("smartMoleculePreset", "water")),
            "seed": int(values.get("smartMatterSeed", 61453)),
        }, timeout=120)
        checks = plan["checks"]
        return {
            "kind": "smart-matter-assembly-plan",
            "xLabel": "assembly stage",
            "yLabel": "completed graph operations",
            "primaryLabel": f"RDKit target graph · {plan['formula']}",
            "secondaryLabel": "programmable-matter hypothesis",
            "data": [
                {"x": index, "primary": index, "secondary": 0}
                for index, _stage in enumerate(plan["workflow"])
            ],
            "metrics": [
                ["atoms", checks["atomCount"], ""],
                ["bonds", checks["bondCount"], ""],
                ["graph checks", "PASS" if checks["valid"] else "FAIL", ""],
                ["force field", plan["forceField"], ""],
            ],
            "state": {**plan, "supported": True},
            "backendHint": "RDKit generates the molecular graph and ETKDGv3/MMFF94 or UFF target conformer. The browser executes the visible state machine and sequential CanBond-validated construction plan.",
            "provenance": {
                "engine": plan["engine"],
                "scientificPackage": True,
                "validatedExternalSimulation": False,
                "rdkit": plan["rdkit"],
                "establishedPart": "molecular graph, atom properties, topology and force-field target conformer",
                "hypotheticalPart": "programmable smart matter and translation through an additional i coordinate",
                "limitations": plan["scientificBoundary"],
            },
        }
    if action == "structure":
        request: dict[str, Any] = {"action": "geometry", "seed": 61453}
        if values.get("customGraph"):
            request.update({"customGraph": values["customGraph"], "name": values.get("customName", "Custom molecule")})
        elif values.get("customSmiles"):
            request.update({"smiles": values["customSmiles"], "name": values.get("customName", "SMILES molecule")})
        else:
            request["preset"] = str(values.get("moleculePreset", "water"))
        geometry = _rdkit(request)
        descriptors = geometry["descriptors"]
        return {
            "kind": "chemistry-structure",
            "xLabel": "descriptor",
            "yLabel": "value",
            "primaryLabel": "RDKit 3-D molecular structure",
            "secondaryLabel": "",
            "data": [{"x": 1, "primary": descriptors["molecularWeight"], "secondary": 0},
                     {"x": 2, "primary": descriptors["tpsa"], "secondary": 0}],
            "metrics": [["formula", geometry.get("formula", ""), ""], ["molecular weight", descriptors["molecularWeight"], "g/mol"],
                        ["MMFF/UFF energy", descriptors["conformerEnergyKcalMol"], "kcal/mol"]],
            "state": {**geometry, "supported": True, "quantumCalculated": False},
            "backendHint": "RDKit parsed the molecular graph, added implicit hydrogens and generated a deterministic ETKDGv3/MMFF94 or UFF conformer.",
            "provenance": {"engine": "rdkit-etkdg-mmff94", "scientificPackage": True, "validatedExternalSimulation": True,
                           "rdkit": geometry["rdkit"], "limitations": "A force-field conformer is not a quantum geometry optimisation."},
        }
    if action == "mixture":
        mixture = _rdkit({"action": "mixture", "seed": 61453, "compounds": list(values.get("compounds") or [])})
        return {
            "kind": "chemistry-mixture", "xLabel": "component", "yLabel": "atoms", "primaryLabel": "RDKit mixture layout",
            "secondaryLabel": "", "data": [{"x": index + 1, "primary": row["atomCount"], "secondary": 0}
                                                for index, row in enumerate(mixture["components"])],
            "metrics": [["components", len(mixture["components"]), ""], ["atoms", len(mixture["atoms"]), ""],
                        ["force field", mixture["forceField"], ""]],
            "state": {**mixture, "supported": True, "quantumCalculated": False},
            "backendHint": "Each compound is independently embedded by RDKit and placed in a shared 3-D reaction workspace.",
            "provenance": {"engine": "rdkit-etkdg-mixture", "scientificPackage": True, "rdkit": mixture["rdkit"],
                           "limitations": "The separation of disconnected molecules is a visual layout, not an equilibrated solution or gas."},
        }
    if action == "reaction":
        reaction = _rdkit({"action": "reaction", "seed": 61453, "reactionId": values.get("reactionId", "waterFormation")}, timeout=120)
        return {
            "kind": "chemistry-reaction", "xLabel": "reaction endpoint", "yLabel": "atom count",
            "primaryLabel": reaction["equation"], "secondaryLabel": "",
            "data": [{"x": 0, "primary": len(reaction["reactants"]["atoms"]), "secondary": 0},
                     {"x": 1, "primary": len(reaction["products"]["atoms"]), "secondary": 0}],
            "metrics": [["equation", reaction["equation"], ""], ["atoms conserved", len(reaction["products"]["atoms"]), ""],
                        ["RDKit", reaction["rdkit"], ""]],
            "state": {**reaction, "supported": True, "quantumCalculated": False},
            "backendHint": reaction["scientificBoundary"],
            "provenance": {"engine": reaction["engine"], "scientificPackage": True, "validatedExternalSimulation": False,
                           "rdkit": reaction["rdkit"], "reactionSmarts": reaction["reactionSmarts"],
                           "limitations": reaction["scientificBoundary"]},
        }

    molecule_name = str(values.get("moleculePreset", "water"))
    method = str(values.get("quantumMethod", "RHF"))
    basis = str(values.get("basisSet", "sto-3g"))
    if values.get("customSmiles"):
        geometry = _rdkit({"action": "geometry", "smiles": values["customSmiles"], "name": values.get("customName", "Custom molecule"), "seed": 61453})
    elif values.get("customGraph"):
        geometry = _rdkit({"action": "geometry", "customGraph": values["customGraph"], "name": values.get("customName", "Custom molecule"), "seed": 61453})
    else:
        geometry = _rdkit({"action": "geometry", "preset": molecule_name, "seed": 61453})
    quantum = _json_command(["wsl.exe", "-d", WSL_DISTRO, "-u", "root", "--", WSL_PYTHON, _wsl_path(PYSCF_WORKER)],
                            payload={"atoms": geometry["atoms"], "method": method, "basis": basis}, timeout=300)
    orbital_energies = quantum["orbitalEnergiesEv"]
    data = [{"x": index + 1, "primary": energy, "secondary": 1.0 if energy <= quantum["homoEv"] + 1e-8 else 0.0}
            for index, energy in enumerate(orbital_energies)]
    descriptors = geometry["descriptors"]
    dipole_norm = sum(component * component for component in quantum["dipoleDebye"]) ** 0.5
    return {
        "kind": "quantum-chemistry",
        "xLabel": "Molecular orbital index",
        "yLabel": "Orbital energy, eV",
        "primaryLabel": "PySCF molecular-orbital energy",
        "secondaryLabel": "occupied orbital",
        "data": data,
        "metrics": [["total energy", quantum["totalEnergyHartree"], "Ha"], ["HOMO-LUMO gap", quantum["gapEv"], "eV"],
                    ["dipole", dipole_norm, "D"], ["MMFF conformer", descriptors["conformerEnergyKcalMol"], "kcal/mol"]],
        "state": {**quantum, **geometry, "supported": True},
        "backendHint": "RDKit generates and MMFF94-optimises the 3D conformer; PySCF performs the selected ab-initio/DFT electronic-structure calculation.",
        "provenance": {"engine": "rdkit-etkdg-mmff94 + pyscf-wsl", "scientificPackage": True, "validatedExternalSimulation": True,
                       "rdkit": geometry["rdkit"], "pyscf": quantum["pyscf"], "ase": quantum["ase"],
                       "limitations": "Isolated gas-phase, Born-Oppenheimer calculation. Accuracy depends on geometry, basis and functional; MMFF geometry is not a quantum geometry optimisation."},
    }
