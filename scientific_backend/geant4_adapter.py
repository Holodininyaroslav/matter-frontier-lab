from __future__ import annotations

import json
import math
import os
import subprocess
import time
from typing import Any

WSL_DISTRIBUTION = os.environ.get("MFL_GEANT4_WSL_DISTRO", "Ubuntu")
MICROMAMBA = os.environ.get("MFL_MICROMAMBA", "/root/.local/bin/micromamba")
GEANT4_ENV = os.environ.get("MFL_GEANT4_ENV", "/root/.matter-frontier-lab/geant4-env")
GEANT4_WORKER = os.environ.get("MFL_GEANT4_WORKER", "/root/.matter-frontier-lab/bin/geant4_worker")
_STATUS_CACHE: tuple[float, dict[str, Any]] | None = None

def _command(*arguments: str) -> list[str]:
    return ["wsl.exe", "-d", WSL_DISTRIBUTION, "--", MICROMAMBA, "run", "-p", GEANT4_ENV, GEANT4_WORKER, *arguments]

def _payload(stdout: str) -> dict[str, Any]:
    for line in reversed(stdout.splitlines()):
        if line.startswith("MFL_JSON:"):
            return json.loads(line[len("MFL_JSON:"):])
    raise RuntimeError("Geant4 worker did not emit tagged JSON")

def status(force: bool = False) -> dict[str, Any]:
    global _STATUS_CACHE
    now = time.monotonic()
    if not force and _STATUS_CACHE and now - _STATUS_CACHE[0] < 60.0:
        return _STATUS_CACHE[1]
    try:
        completed = subprocess.run(_command("--status"), check=True, capture_output=True, text=True, timeout=30)
        result = _payload(completed.stdout)
    except Exception as exc:
        result = {"available": False, "engine": "geant4-cpp-wsl", "error": f"{type(exc).__name__}: {exc}"}
    _STATUS_CACHE = (now, result)
    return result

def solve(values: dict[str, Any], points: int = 120) -> dict[str, Any]:
    particle = str(values.get("transportParticle", "gamma"))
    if particle not in {"gamma", "e-", "e+", "proton", "neutron", "mu-", "mu+"}:
        raise ValueError(f"Unsupported Geant4 primary particle: {particle}")
    material = str(values.get("transportMaterial", "G4_Si"))
    energy_mev = max(float(values.get("transportEnergyMeV", values.get("probeEnergy", 120.0) / 1000.0)), 1e-6)
    thickness_mm = max(float(values.get("transportThicknessMm", 10.0)), 0.001)
    events = max(1, min(int(values.get("transportEvents", 100)), 5000))
    completed = subprocess.run(
        _command("--particle", particle, "--material", material, "--energy-mev", str(energy_mev),
                 "--thickness-mm", str(thickness_mm), "--events", str(events)),
        check=True, capture_output=True, text=True, timeout=180,
    )
    payload = _payload(completed.stdout)
    mean, rms = float(payload["meanDepositedMeV"]), float(payload["rmsDepositedMeV"])
    bins = max(24, int(points))
    sigma = max(rms, mean * 0.15, energy_mev * 0.01, 1e-9)
    data = []
    for index in range(bins):
        x = energy_mev * index / (bins - 1)
        data.append({"x": x, "primary": math.exp(-0.5 * ((x - mean) / sigma) ** 2), "secondary": 0.0})
    return {
        "kind": "particle-transport", "xLabel": "Deposited energy, MeV", "yLabel": "normalised event distribution",
        "primaryLabel": f"Geant4 {particle} in {material}", "secondaryLabel": "", "data": data,
        "metrics": [["Mean deposited energy", mean, "MeV"], ["RMS", rms, "MeV"], ["Secondaries", int(payload["secondaryCount"]), "tracks"]],
        "state": payload, "backendHint": "Real Geant4 particle transport through a finite material slab in Ubuntu WSL.",
        "provenance": {"engine": "geant4-cpp-wsl", "geant4": str(payload["geant4"]).strip(), "physicsList": payload["physicsList"],
                       "scientificPackage": True, "validatedExternalSimulation": False,
                       "limitations": "Serial homogeneous-slab transport, not a full detector geometry or accretion simulation."},
    }
