from __future__ import annotations

import argparse
import json


MOLECULES = {
    "water": "O",
    "ammonia": "N",
    "methane": "C",
    "ethanol": "CCO",
    "benzene": "c1ccccc1",
    "caffeine": "Cn1c(=O)c2c(ncn2C)n(C)c1=O",
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--status", action="store_true")
    parser.add_argument("--molecule", choices=MOLECULES, default="water")
    parser.add_argument("--seed", type=int, default=61453)
    args = parser.parse_args()

    from rdkit import Chem, rdBase
    from rdkit.Chem import AllChem, Crippen, Descriptors, rdMolDescriptors

    if args.status:
        print(json.dumps({"available": True, "engine": "rdkit-native", "version": rdBase.rdkitVersion}))
        return

    molecule = Chem.AddHs(Chem.MolFromSmiles(MOLECULES[args.molecule]))
    parameters = AllChem.ETKDGv3()
    parameters.randomSeed = args.seed
    parameters.useRandomCoords = False
    if AllChem.EmbedMolecule(molecule, parameters) != 0:
        raise RuntimeError("RDKit ETKDG conformer generation failed")
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
    atoms = []
    for atom in molecule.GetAtoms():
        position = conformer.GetAtomPosition(atom.GetIdx())
        atoms.append({"element": atom.GetSymbol(), "x": position.x, "y": position.y, "z": position.z})
    bonds = [[bond.GetBeginAtomIdx(), bond.GetEndAtomIdx(), float(bond.GetBondTypeAsDouble())] for bond in molecule.GetBonds()]
    print(json.dumps({
        "molecule": args.molecule,
        "smiles": MOLECULES[args.molecule],
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
    }))


if __name__ == "__main__":
    main()
