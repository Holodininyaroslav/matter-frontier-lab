from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path
from typing import Any

WORKER = Path(__file__).resolve().with_name("devsim_worker.py")
WSL_DISTRO = os.environ.get("MFL_DEVSIM_WSL_DISTRO", "Ubuntu")
WSL_PYTHON = os.environ.get("MFL_DEVSIM_PYTHON", "/root/.matter-frontier-lab/chem-env/bin/python")
_STATUS_CACHE: tuple[float, dict[str, Any]] | None = None


def _last_json(output: str) -> dict[str, Any]:
    for line in reversed(output.splitlines()):
        line = line.strip()
        if line.startswith("{"):
            return json.loads(line)
    raise ValueError("DEVSIM did not return a JSON payload")


def _wsl_path(path: Path) -> str:
    resolved = path.resolve()
    return f"/mnt/{resolved.drive.rstrip(':').lower()}{resolved.as_posix().split(':', 1)[-1]}"


def _command(*arguments: str) -> list[str]:
    return ["wsl.exe", "-d", WSL_DISTRO, "-u", "root", "--", WSL_PYTHON, _wsl_path(WORKER), *arguments]


def status(force: bool = False) -> dict[str, Any]:
    global _STATUS_CACHE
    now = time.monotonic()
    if not force and _STATUS_CACHE and now - _STATUS_CACHE[0] < 60:
        return _STATUS_CACHE[1]
    try:
        completed = subprocess.run(_command("--status"), check=True, capture_output=True, text=True, timeout=30)
        result = _last_json(completed.stdout)
    except Exception as exc:
        result = {"available": False, "engine": "devsim-wsl", "error": f"{type(exc).__name__}: {exc}"}
    _STATUS_CACHE = (now, result)
    return result


def solve(values: dict[str, Any]) -> dict[str, Any]:
    completed = subprocess.run(_command(), input=json.dumps(values), check=True, capture_output=True, text=True, timeout=180)
    payload = _last_json(completed.stdout)
    data = [{"x": row["positionUm"], "primary": row["potentialV"], "secondary": row["fieldVcm"]} for row in payload["samples"]]
    return {
        "kind": "semiconductor-tcad", "xLabel": "Position, µm", "yLabel": "Electrostatic potential, V",
        "primaryLabel": "DEVSIM potential", "secondaryLabel": "electric field, V/cm", "data": data,
        "metrics": [["built-in potential", payload["builtInPotentialV"], "V"], ["peak electric field", payload["peakFieldVcm"], "V/cm"],
                    ["mesh nodes", payload["meshNodes"], ""], ["temperature", payload["temperatureK"], "K"]],
        "state": {**payload, "supported": True},
        "backendHint": "DEVSIM finite-volume nonlinear Poisson solution for a one-dimensional silicon p-n junction.",
        "provenance": {"engine": "devsim-wsl", "scientificPackage": True, "validatedExternalSimulation": True, "devsim": payload["version"],
                       "equations": "equilibrium Poisson-Boltzmann with Fermi-level contact conditions",
                       "limitations": "One-dimensional equilibrium electrostatics with constant silicon material parameters; not yet a transient or full drift-diffusion I-V sweep."},
    }
