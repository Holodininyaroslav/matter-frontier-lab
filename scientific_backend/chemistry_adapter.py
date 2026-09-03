from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
RDKIT_WORKER = Path(__file__).resolve().with_name("rdkit_worker.py")
PYSCF_WORKER = Path(__file__).resolve().with_name("pyscf_worker.py")
SCIENCE_PYTHON = ROOT / ".venv-science" / "Scripts" / "python.exe"
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
            completed = subprocess.run(command, input=json.dumps(payload) if payload is not None else None,
                                       check=True, capture_output=True, text=True, timeout=timeout)
            return json.loads(completed.stdout)
        except (subprocess.CalledProcessError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt + 1 < attempts:
                # WSL can transiently return 0xffffffff while its VM is waking.
                # A bounded retry keeps the scientific command deterministic
                # without hiding persistent worker or environment failures.
                time.sleep(0.6 * (attempt + 1))
    assert last_error is not None
    raise last_error


def status(force: bool = False) -> dict[str, Any]:
    global _STATUS_CACHE
    now = time.monotonic()
    if not force and _STATUS_CACHE and now - _STATUS_CACHE[0] < 60:
        return _STATUS_CACHE[1]
    try:
        rdkit = _json_command([str(SCIENCE_PYTHON), str(RDKIT_WORKER), "--status"], timeout=30)
        pyscf = _json_command(["wsl.exe", "-d", WSL_DISTRO, "-u", "root", "--", WSL_PYTHON, _wsl_path(PYSCF_WORKER), "--status"], timeout=30)
        result = {"available": rdkit["available"] and pyscf["available"], "engine": "rdkit-etkdg-mmff94 + pyscf-wsl", "rdkit": rdkit, "pyscf": pyscf}
    except Exception as exc:
        result = {"available": False, "engine": "rdkit-pyscf", "error": f"{type(exc).__name__}: {exc}"}
    _STATUS_CACHE = (now, result)
    return result


def solve(values: dict[str, Any]) -> dict[str, Any]:
    molecule_name = str(values.get("moleculePreset", "water"))
    method = str(values.get("quantumMethod", "RHF"))
    basis = str(values.get("basisSet", "sto-3g"))
    geometry = _json_command([str(SCIENCE_PYTHON), str(RDKIT_WORKER), "--molecule", molecule_name, "--seed", "61453"], timeout=60)
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
