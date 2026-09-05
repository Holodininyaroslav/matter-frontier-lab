from __future__ import annotations

import argparse
import json
import math
import random
import sys
from typing import Any


MOLECULES = {
    "water": {"name": "Water", "formula": "H2O", "smiles": "O"},
    "ammonia": {"name": "Ammonia", "formula": "NH3", "smiles": "N"},
    "methane": {"name": "Methane", "formula": "CH4", "smiles": "C"},
    "ethanol": {"name": "Ethanol", "formula": "C2H6O", "smiles": "CCO"},
    "benzene": {"name": "Benzene", "formula": "C6H6", "smiles": "c1ccccc1"},
    "caffeine": {"name": "Caffeine", "formula": "C8H10N4O2", "smiles": "Cn1c(=O)c2c(ncn2C)n(C)c1=O"},
    "hydrogen": {"name": "Hydrogen", "formula": "H2", "smiles": "[H][H]"},
    "oxygen": {"name": "Oxygen", "formula": "O2", "smiles": "O=O"},
    "carbonDioxide": {"name": "Carbon dioxide", "formula": "CO2", "smiles": "O=C=O"},
    "ethene": {"name": "Ethene", "formula": "C2H4", "smiles": "C=C"},
    "ethane": {"name": "Ethane", "formula": "C2H6", "smiles": "CC"},
    "hydrogenChloride": {"name": "Hydrogen chloride", "formula": "HCl", "smiles": "Cl"},
    "aceticAcid": {"name": "Acetic acid", "formula": "C2H4O2", "smiles": "CC(=O)O"},
    "ethylAcetate": {"name": "Ethyl acetate", "formula": "C4H8O2", "smiles": "CCOC(=O)C"},
    "glycine": {"name": "Glycine", "formula": "C2H5NO2", "smiles": "NCC(=O)O"},
}

SMART_MATTER_MOLECULES = {
    "hydrogen", "oxygen", "water", "carbonDioxide", "methane", "ammonia", "ethanol", "glycine"
}


# Balanced, curated reaction endpoints. RDKit compiles the reaction SMARTS and
# supplies the graphs and 3-D conformers. The browser interpolates the two
# endpoints; it does not claim to calculate a transition state or kinetics.
REACTIONS = {
    "waterFormation": {
        "name": "Hydrogen combustion",
        "equation": "2 H2 + O2 -> 2 H2O",
        "reactants": [("hydrogen", 2), ("oxygen", 1)],
        "products": [("water", 2)],
        "smarts": "[H][H].[H][H].O=O>>O.O",
        "conditions": "Ignition is required; the endpoint animation does not model the flame mechanism.",
    },
    "methaneCombustion": {
        "name": "Methane combustion",
        "equation": "CH4 + 2 O2 -> CO2 + 2 H2O",
        "reactants": [("methane", 1), ("oxygen", 2)],
        "products": [("carbonDioxide", 1), ("water", 2)],
        "smarts": "C.O=O.O=O>>O=C=O.O.O",
        "conditions": "Overall stoichiometry; radical-chain combustion kinetics are not represented.",
    },
    "etheneHydrogenation": {
        "name": "Ethene hydrogenation",
        "equation": "C2H4 + H2 -> C2H6",
        "reactants": [("ethene", 1), ("hydrogen", 1)],
        "products": [("ethane", 1)],
        "smarts": "[C:1]=[C:2].[H][H]>>[C:1]-[C:2]",
        "conditions": "Catalytic hydrogenation endpoint; catalyst surface kinetics are not represented.",
    },
    "esterification": {
        "name": "Fischer esterification",
        "equation": "C2H6O + C2H4O2 <=> C4H8O2 + H2O",
        "reactants": [("ethanol", 1), ("aceticAcid", 1)],
        "products": [("ethylAcetate", 1), ("water", 1)],
        "smarts": "CCO.CC(=O)O>>CCOC(=O)C.O",
        "conditions": "Acid-catalysed equilibrium endpoint; activation barriers and solvent are not represented.",
    },
}


def _molecule_from_graph(graph: dict[str, Any], Chem: Any) -> Any:
    allowed = {"H", "B", "C", "N", "O", "F", "P", "S", "Cl", "Br", "I"}
    atoms = list(graph.get("atoms") or [])
    if not atoms:
        raise ValueError("The molecular graph contains no atoms")
    editable = Chem.RWMol()
    for row in atoms:
        symbol = str(row.get("element", "C"))
        if symbol not in allowed:
            raise ValueError(f"Unsupported element: {symbol}")
        editable.AddAtom(Chem.Atom(symbol))
    bond_types = {1: Chem.BondType.SINGLE, 2: Chem.BondType.DOUBLE, 3: Chem.BondType.TRIPLE}
    seen: set[tuple[int, int]] = set()
    for row in graph.get("bonds") or []:
        a, b = int(row[0]), int(row[1])
        order = int(round(float(row[2] if len(row) > 2 else 1)))
        key = tuple(sorted((a, b)))
        if a == b or key in seen or a < 0 or b < 0 or a >= len(atoms) or b >= len(atoms):
            continue
        editable.AddBond(a, b, bond_types.get(order, Chem.BondType.SINGLE))
        seen.add(key)
    molecule = editable.GetMol()
    Chem.SanitizeMol(molecule)
    return molecule


def _embed_molecule(molecule: Any, *, label: str, smiles: str, seed: int, component: int,
                    Chem: Any, AllChem: Any, Crippen: Any, Descriptors: Any,
                    rdMolDescriptors: Any, rdBase: Any) -> dict[str, Any]:
    molecule = Chem.AddHs(molecule)
    parameters = AllChem.ETKDGv3()
    parameters.randomSeed = int(seed)
    parameters.useRandomCoords = False
    if AllChem.EmbedMolecule(molecule, parameters) != 0:
        parameters.useRandomCoords = True
        if AllChem.EmbedMolecule(molecule, parameters) != 0:
            raise RuntimeError(f"RDKit ETKDG conformer generation failed for {label}")
    properties = AllChem.MMFFGetMoleculeProperties(molecule)
    if properties is not None:
        AllChem.MMFFOptimizeMolecule(molecule, mmffVariant="MMFF94", maxIters=600)
        force_field = AllChem.MMFFGetMoleculeForceField(molecule, properties)
        conformer_energy = float(force_field.CalcEnergy())
        force_field_name = "MMFF94"
    else:
        AllChem.UFFOptimizeMolecule(molecule, maxIters=600)
        conformer_energy = float(AllChem.UFFGetMoleculeForceField(molecule).CalcEnergy())
        force_field_name = "UFF"
    conformer = molecule.GetConformer()
    periodic_table = Chem.GetPeriodicTable()
    atoms = []
    for atom in molecule.GetAtoms():
        position = conformer.GetAtomPosition(atom.GetIdx())
        atoms.append({
            "element": atom.GetSymbol(), "x": position.x, "y": position.y, "z": position.z,
            "component": component, "atomIndex": atom.GetIdx(),
            "effectiveMass": float(atom.GetMass()),
            "formalCharge": int(atom.GetFormalCharge()),
            "valence": float(atom.GetTotalValence()),
            "covalentRadius": float(periodic_table.GetRcovalent(atom.GetAtomicNum())),
            "vdwRadius": float(periodic_table.GetRvdw(atom.GetAtomicNum())),
            "neighbors": [int(neighbor.GetIdx()) for neighbor in atom.GetNeighbors()],
        })
    bonds = [[bond.GetBeginAtomIdx(), bond.GetEndAtomIdx(), float(bond.GetBondTypeAsDouble())]
             for bond in molecule.GetBonds()]
    return {
        "molecule": label,
        "smiles": smiles,
        "atoms": atoms,
        "bonds": bonds,
        "descriptors": {
            "molecularWeight": float(Descriptors.MolWt(molecule)),
            "logP": float(Crippen.MolLogP(molecule)),
            "tpsa": float(rdMolDescriptors.CalcTPSA(molecule)),
            "conformerEnergyKcalMol": conformer_energy,
        },
        "forceField": force_field_name,
        "rdkit": rdBase.rdkitVersion,
    }


def _combine(structures: list[dict[str, Any]]) -> dict[str, Any]:
    if not structures:
        raise ValueError("At least one compound is required")
    atoms: list[dict[str, Any]] = []
    bonds: list[list[float]] = []
    spacing = max(4.4, min(7.2, 3.7 + max(len(item["atoms"]) for item in structures) * .065))
    for component, structure in enumerate(structures):
        xs = [row["x"] for row in structure["atoms"]]
        ys = [row["y"] for row in structure["atoms"]]
        zs = [row["z"] for row in structure["atoms"]]
        centre = (sum(xs) / len(xs), sum(ys) / len(ys), sum(zs) / len(zs))
        angle = component * (2 * math.pi / max(len(structures), 1))
        radius = 0 if len(structures) == 1 else spacing * (.55 + .12 * len(structures))
        offset = (math.cos(angle) * radius, math.sin(angle) * radius * .45, math.sin(angle) * radius)
        base = len(atoms)
        for row in structure["atoms"]:
            atoms.append({**row, "x": row["x"] - centre[0] + offset[0],
                          "y": row["y"] - centre[1] + offset[1],
                          "z": row["z"] - centre[2] + offset[2], "component": component})
        bonds.extend([[int(row[0]) + base, int(row[1]) + base, float(row[2])] for row in structure["bonds"]])
    return {
        "atoms": atoms,
        "bonds": bonds,
        "components": [{"molecule": row["molecule"], "smiles": row["smiles"],
                        "formula": row.get("formula", ""), "atomCount": len(row["atoms"])} for row in structures],
        "rdkit": structures[0]["rdkit"],
        "forceField": "+".join(sorted({row["forceField"] for row in structures})),
    }


def _expanded_species(specification: list[tuple[str, int]]) -> list[tuple[str, dict[str, str]]]:
    return [(key, MOLECULES[key]) for key, count in specification for _ in range(int(count))]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--status", action="store_true")
    parser.add_argument("--request", action="store_true")
    parser.add_argument("--molecule", choices=MOLECULES, default="water")
    parser.add_argument("--seed", type=int, default=61453)
    args = parser.parse_args()

    from rdkit import Chem, rdBase
    from rdkit.Chem import AllChem, Crippen, Descriptors, rdMolDescriptors
    from rdkit.Chem import rdChemReactions

    if args.status:
        print(json.dumps({"available": True, "engine": "rdkit-native", "version": rdBase.rdkitVersion,
                          "moleculeEditor": True, "reactionSmarts": True}))
        return

    payload = json.load(sys.stdin) if args.request else {"action": "geometry", "preset": args.molecule, "seed": args.seed}
    action = str(payload.get("action", "geometry"))
    seed = int(payload.get("seed", 61453))

    def embed(label: str, smiles: str, component: int = 0, graph: dict[str, Any] | None = None) -> dict[str, Any]:
        molecule = _molecule_from_graph(graph, Chem) if graph else Chem.MolFromSmiles(smiles)
        if molecule is None:
            raise ValueError(f"RDKit could not parse SMILES: {smiles}")
        canonical = Chem.MolToSmiles(molecule)
        return _embed_molecule(molecule, label=label, smiles=canonical, seed=seed + component * 7919,
                               component=component, Chem=Chem, AllChem=AllChem, Crippen=Crippen,
                               Descriptors=Descriptors, rdMolDescriptors=rdMolDescriptors, rdBase=rdBase)

    if action == "geometry":
        graph = payload.get("customGraph")
        if graph:
            structure = embed(str(payload.get("name", "Custom molecule")), "", graph=graph)
        else:
            preset = str(payload.get("preset", "water"))
            smiles = str(payload.get("smiles") or MOLECULES.get(preset, {}).get("smiles") or "")
            if not smiles:
                raise ValueError(f"Unknown compound preset: {preset}")
            structure = embed(str(payload.get("name") or MOLECULES.get(preset, {}).get("name") or preset), smiles)
        structure["formula"] = rdMolDescriptors.CalcMolFormula(Chem.AddHs(Chem.MolFromSmiles(structure["smiles"])))
        print(json.dumps(structure))
        return

    if action == "mixture":
        compounds = list(payload.get("compounds") or [])
        structures = []
        for component, row in enumerate(compounds):
            preset = str(row.get("preset", ""))
            smiles = str(row.get("smiles") or MOLECULES.get(preset, {}).get("smiles") or "")
            label = str(row.get("name") or MOLECULES.get(preset, {}).get("name") or preset or f"component-{component + 1}")
            structures.append(embed(label, smiles, component))
        print(json.dumps(_combine(structures)))
        return

    if action == "reaction":
        reaction_id = str(payload.get("reactionId", "waterFormation"))
        template = REACTIONS.get(reaction_id)
        if template is None:
            raise ValueError(f"Unknown reaction template: {reaction_id}")
        reaction = rdChemReactions.ReactionFromSmarts(template["smarts"])
        if reaction is None:
            raise RuntimeError(f"RDKit could not compile reaction SMARTS for {reaction_id}")
        reaction.Initialize()
        reactants = []
        for component, (_, row) in enumerate(_expanded_species(template["reactants"])):
            structure = embed(row["name"], row["smiles"], component)
            structure["formula"] = row["formula"]
            reactants.append(structure)
        products = []
        for component, (_, row) in enumerate(_expanded_species(template["products"])):
            structure = embed(row["name"], row["smiles"], component + 101)
            structure["formula"] = row["formula"]
            products.append(structure)
        reactant_scene = _combine(reactants)
        product_scene = _combine(products)
        reactant_elements = sorted(row["element"] for row in reactant_scene["atoms"])
        product_elements = sorted(row["element"] for row in product_scene["atoms"])
        if reactant_elements != product_elements:
            raise RuntimeError(f"Reaction template {reaction_id} is not atom-balanced after adding hydrogens")
        print(json.dumps({
            "reactionId": reaction_id,
            "name": template["name"],
            "equation": template["equation"],
            "conditions": template["conditions"],
            "balanced": True,
            "elementBalance": {element: reactant_elements.count(element) for element in sorted(set(reactant_elements))},
            "reactionSmarts": template["smarts"],
            "reactants": reactant_scene,
            "products": product_scene,
            "rdkit": rdBase.rdkitVersion,
            "engine": "rdkit-reaction-smarts-etkdg-mmff94",
            "scientificBoundary": "Balanced graph endpoints and force-field conformers; not a reaction path, transition state, rate or molecular-dynamics calculation.",
        }))
        return

    if action == "smart-matter-plan":
        preset = str(payload.get("preset", "water"))
        if preset not in SMART_MATTER_MOLECULES:
            raise ValueError(f"Unsupported smart-matter molecule: {preset}")
        row = MOLECULES[preset]
        structure = embed(row["name"], row["smiles"])
        structure["formula"] = rdMolDescriptors.CalcMolFormula(Chem.AddHs(Chem.MolFromSmiles(structure["smiles"])))

        rng = random.Random(seed)
        target_centre = [
            sum(float(atom[axis]) for atom in structure["atoms"]) / len(structure["atoms"])
            for axis in ("x", "y", "z")
        ]
        particles = []
        for index, atom in enumerate(structure["atoms"]):
            azimuth = rng.random() * math.tau
            elevation = (rng.random() - .5) * 1.15
            radius = 4.8 + rng.random() * 2.4
            start = {
                "x": math.cos(azimuth) * math.cos(elevation) * radius,
                "y": math.sin(elevation) * radius * .72,
                "z": math.sin(azimuth) * math.cos(elevation) * radius,
                "i": -(1.15 + rng.random() * 2.85),
            }
            particles.append({
                "id": f"smart-{index + 1}",
                "position": start,
                "velocity": {"x": 0.0, "y": 0.0, "z": 0.0, "i": 0.0},
                "assignedElement": atom["element"],
                "effectiveMass": atom["effectiveMass"],
                "formalCharge": atom["formalCharge"],
                "valence": atom["valence"],
                "capacity": len(atom["neighbors"]),
                "covalentRadius": atom["covalentRadius"],
                "vdwRadius": atom["vdwRadius"],
                "neighbors": atom["neighbors"],
                "targetAtom": index,
                "targetPosition": {
                    "x": atom["x"] - target_centre[0],
                    "y": atom["y"] - target_centre[1],
                    "z": atom["z"] - target_centre[2],
                    "i": 0.0,
                },
                "state": "FREE",
            })

        seen: set[tuple[int, int]] = set()
        duplicate_bonds = 0
        invalid_endpoints = 0
        distance_violations = 0
        bond_orders = [0.0] * len(structure["atoms"])
        for bond in structure["bonds"]:
            a, b, order = int(bond[0]), int(bond[1]), float(bond[2])
            key = tuple(sorted((a, b)))
            if a == b or a < 0 or b < 0 or a >= len(particles) or b >= len(particles):
                invalid_endpoints += 1
                continue
            if key in seen:
                duplicate_bonds += 1
                continue
            seen.add(key)
            bond_orders[a] += order
            bond_orders[b] += order
            pa = particles[a]["targetPosition"]
            pb = particles[b]["targetPosition"]
            distance = math.sqrt(sum((pa[axis] - pb[axis]) ** 2 for axis in ("x", "y", "z")))
            radius_sum = particles[a]["covalentRadius"] + particles[b]["covalentRadius"]
            if not (.55 * radius_sum <= distance <= 1.65 * radius_sum):
                distance_violations += 1
        valence_violations = sum(
            1 for index, atom in enumerate(structure["atoms"])
            if bond_orders[index] > float(atom["valence"]) + 1e-6
        )
        construction_order = sorted(
            ([int(bond[0]), int(bond[1]), float(bond[2])] for bond in structure["bonds"]),
            key=lambda bond: (max(bond[0], bond[1]), min(bond[0], bond[1]), -bond[2]),
        )
        checks = {
            "valid": invalid_endpoints == duplicate_bonds == valence_violations == distance_violations == 0,
            "invalidEndpoints": invalid_endpoints,
            "duplicateBonds": duplicate_bonds,
            "valenceViolations": valence_violations,
            "distanceViolations": distance_violations,
            "atomCount": len(particles),
            "bondCount": len(construction_order),
        }
        print(json.dumps({
            **structure,
            "particles": particles,
            "constructionOrder": construction_order,
            "workflow": ["FREE", "ASSIGNED", "NAVIGATING", "ALIGNING", "BONDING", "BONDED", "RELAXING", "STABLE"],
            "checks": checks,
            "seed": seed,
            "engine": "rdkit-etkdgv3-mmff94-smart-matter-plan",
            "scientificBoundary": "RDKit supplies the molecular graph and force-field conformer. Motion through an additional i coordinate and programmable matter are an author-defined hypothesis, not established particle physics.",
        }))
        return

    if action == "protein-graph":
        pdb_block = str(payload.get("pdbBlock") or "")
        if not pdb_block.strip():
            raise ValueError("protein-graph requires a PDB block")
        molecule = Chem.MolFromPDBBlock(
            pdb_block,
            sanitize=True,
            removeHs=False,
            proximityBonding=True,
        )
        if molecule is None:
            raise ValueError("RDKit could not parse the supplied PDB structure")
        conformer = molecule.GetConformer()
        periodic_table = Chem.GetPeriodicTable()
        atoms = []
        for atom in molecule.GetAtoms():
            position = conformer.GetAtomPosition(atom.GetIdx())
            residue = atom.GetPDBResidueInfo()
            atoms.append({
                "id": int(atom.GetIdx()),
                "serial": int(residue.GetSerialNumber()) if residue else int(atom.GetIdx()) + 1,
                "atomName": residue.GetName().strip() if residue else atom.GetSymbol(),
                "residueName": residue.GetResidueName().strip() if residue else "UNK",
                "residueNumber": int(residue.GetResidueNumber()) if residue else 0,
                "chain": residue.GetChainId().strip() if residue and residue.GetChainId().strip() else "A",
                "element": atom.GetSymbol(),
                "x": float(position.x), "y": float(position.y), "z": float(position.z),
                "effectiveMass": float(atom.GetMass()),
                "formalCharge": int(atom.GetFormalCharge()),
                "valence": float(atom.GetTotalValence()),
                "covalentRadius": float(periodic_table.GetRcovalent(atom.GetAtomicNum())),
                "vdwRadius": float(periodic_table.GetRvdw(atom.GetAtomicNum())),
                "neighbors": [int(neighbor.GetIdx()) for neighbor in atom.GetNeighbors()],
            })
        bonds = []
        for index, bond in enumerate(molecule.GetBonds()):
            bonds.append({
                "id": index,
                "a": int(bond.GetBeginAtomIdx()),
                "b": int(bond.GetEndAtomIdx()),
                "order": float(bond.GetBondTypeAsDouble()),
            })
        residues = sorted({
            (row["chain"], row["residueNumber"], row["residueName"])
            for row in atoms
        })
        chains = sorted({row["chain"] for row in atoms})
        print(json.dumps({
            "atoms": atoms,
            "bonds": bonds,
            "residues": [
                {"chain": chain, "number": number, "name": name}
                for chain, number, name in residues
            ],
            "chains": chains,
            "molecularMass": float(sum(row["effectiveMass"] for row in atoms)),
            "rdkit": rdBase.rdkitVersion,
            "engine": "rdkit-pdb-proximity-bonding",
            "scientificBoundary": "PDB coordinates are retained. RDKit assigns a molecular graph using PDB residue information and proximity bonding; this is not a molecular-dynamics trajectory.",
        }))
        return

    raise ValueError(f"Unsupported RDKit worker action: {action}")


if __name__ == "__main__":
    main()
