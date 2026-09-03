from __future__ import annotations

import argparse
import json
import sys

HARTREE_TO_EV = 27.211386245988


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--status", action="store_true")
    args = parser.parse_args()
    import ase
    import pyscf
    from pyscf import dft, gto, scf

    if args.status:
        print(json.dumps({"available": True, "engine": "pyscf-wsl", "pyscf": pyscf.__version__, "ase": ase.__version__}))
        return

    payload = json.load(sys.stdin)
    atoms = payload["atoms"]
    method = str(payload.get("method", "RHF")).upper()
    basis = str(payload.get("basis", "sto-3g"))
    atom_specification = [(row["element"], (row["x"], row["y"], row["z"])) for row in atoms]
    molecule = gto.M(atom=atom_specification, unit="Angstrom", basis=basis, charge=0, spin=0, verbose=0)
    if method == "RHF":
        mean_field = scf.RHF(molecule)
    else:
        mean_field = dft.RKS(molecule)
        mean_field.xc = {"PBE": "pbe,pbe", "B3LYP": "b3lyp"}.get(method, "pbe,pbe")
        mean_field.grids.level = 2
    mean_field.conv_tol = 1e-9
    mean_field.max_cycle = 100
    total_energy = float(mean_field.kernel())
    occupied = [float(value) for value, occupancy in zip(mean_field.mo_energy, mean_field.mo_occ) if occupancy > 0]
    virtual = [float(value) for value, occupancy in zip(mean_field.mo_energy, mean_field.mo_occ) if occupancy == 0]
    homo = occupied[-1]
    lumo = virtual[0] if virtual else homo
    orbital_energies = [float(value) * HARTREE_TO_EV for value in mean_field.mo_energy]
    try:
        dipole = [float(value) for value in mean_field.dip_moment(unit="Debye", verbose=0)]
    except Exception:
        dipole = [0.0, 0.0, 0.0]
    print(json.dumps({
        "converged": bool(mean_field.converged),
        "method": method,
        "basis": basis,
        "totalEnergyHartree": total_energy,
        "totalEnergyEv": total_energy * HARTREE_TO_EV,
        "nuclearRepulsionHartree": float(molecule.energy_nuc()),
        "homoEv": homo * HARTREE_TO_EV,
        "lumoEv": lumo * HARTREE_TO_EV,
        "gapEv": (lumo - homo) * HARTREE_TO_EV,
        "dipoleDebye": dipole,
        "orbitalEnergiesEv": orbital_energies,
        "electronCount": int(molecule.nelectron),
        "pyscf": pyscf.__version__,
        "ase": ase.__version__,
    }))


if __name__ == "__main__":
    main()
