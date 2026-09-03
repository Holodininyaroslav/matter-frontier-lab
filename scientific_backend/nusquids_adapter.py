from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path
from typing import Any

WSL_DISTRIBUTION = os.environ.get("MFL_NUSQUIDS_WSL_DISTRO", "Ubuntu")
MICROMAMBA = os.environ.get("MFL_MICROMAMBA", "/root/.local/bin/micromamba")
NUSQUIDS_ENV = os.environ.get("MFL_NUSQUIDS_ENV", "/root/.matter-frontier-lab/nusquids-env")
WORKER = Path(__file__).resolve().with_name("nusquids_worker.py")
_STATUS_CACHE: tuple[float, dict[str, Any]] | None = None

def _wsl_path(path: Path) -> str:
    resolved = path.resolve()
    return f"/mnt/{resolved.drive.rstrip(':').lower()}{resolved.as_posix().split(':', 1)[-1]}"

def _command(*arguments: str) -> list[str]:
    return ["wsl.exe", "-d", WSL_DISTRIBUTION, "--", MICROMAMBA, "run", "-p", NUSQUIDS_ENV, "python", _wsl_path(WORKER), *arguments]

def status(force: bool = False) -> dict[str, Any]:
    global _STATUS_CACHE
    now = time.monotonic()
    if not force and _STATUS_CACHE and now - _STATUS_CACHE[0] < 60.0:
        return _STATUS_CACHE[1]
    try:
        completed = subprocess.run(_command("--status"), check=True, capture_output=True, text=True, timeout=30)
        result = json.loads(completed.stdout)
    except Exception as exc:
        result = {"available": False, "engine": "nusquids-wsl", "error": f"{type(exc).__name__}: {exc}"}
    _STATUS_CACHE = (now, result)
    return result

def solve(values: dict[str, Any], points: int = 64) -> dict[str, Any]:
    energy = max(float(values.get("neutrinoEnergy", 10.0)), 0.001)
    baseline = max(float(values.get("baselineKm", 1000.0)), 0.001)
    density = max(float(values.get("matterDensityGcm3", 3.0)), 0.0)
    electron_fraction = min(max(float(values.get("electronFraction", 0.5)), 0.0), 1.0)
    flavor_name = str(values.get("initialFlavor", "muon"))
    flavor = {"electron": 0, "muon": 1, "tau": 2}.get(flavor_name, 1)
    arguments = ["--energy-gev", str(energy), "--baseline-km", str(baseline), "--density", str(density),
                 "--electron-fraction", str(electron_fraction), "--initial-flavor", str(flavor), "--points", str(points)]
    if bool(values.get("antineutrino", False)):
        arguments.append("--antineutrino")
    completed = subprocess.run(_command(*arguments), check=True, capture_output=True, text=True, timeout=180)
    payload = json.loads(completed.stdout)
    samples = payload["samples"]
    data = [{"x": row["distanceKm"], "primary": row["muon"], "secondary": row["electron"], "tau": row["tau"]} for row in samples]
    final = samples[-1]
    return {
        "kind": "neutrino-oscillation", "xLabel": "Baseline, km", "yLabel": "Flavor probability",
        "primaryLabel": "P(nu -> nu_mu)", "secondaryLabel": "P(nu -> nu_e)", "data": data,
        "metrics": [["P electron", final["electron"], ""], ["P muon", final["muon"], ""], ["P tau", final["tau"], ""]],
        "state": {**final, "supported": True, "probabilitySum": final["electron"] + final["muon"] + final["tau"]},
        "backendHint": "Real three-flavor nuSQuIDS propagation through vacuum or constant-density matter.",
        "provenance": {"engine": "nusquids-wsl", "nuSQuIDS": payload["nuSQuIDS"], "scientificPackage": True,
                       "validatedExternalSimulation": False, "oscillationParameters": payload["oscillationParameters"],
                       "limitations": "Standard three-flavor propagation only; the project's hypothetical spin-dependent M-field term is not part of nuSQuIDS and remains a separate illustrative mode."},
    }
