from __future__ import annotations

import json
import math
import os
import subprocess
import time
from pathlib import Path
from typing import Any


WSL_DISTRIBUTION = os.environ.get("MFL_PYTHIA_WSL_DISTRO", "Ubuntu")
WSL_WORKER = os.environ.get("MFL_PYTHIA_WORKER", "/root/.matter-frontier-lab/bin/pythia_worker")
OUTPUT_DIRECTORY = Path(__file__).resolve().parent.parent / "scientific_output" / "events"
BEAMS = {"proton": 2212, "antiproton": -2212}
_STATUS_CACHE: tuple[float, dict[str, Any]] | None = None


def _wsl_path(path: Path) -> str:
    resolved = path.resolve()
    return f"/mnt/{resolved.drive.rstrip(':').lower()}{resolved.as_posix().split(':', 1)[-1]}"


def _command(*arguments: str) -> list[str]:
    return ["wsl.exe", "-d", WSL_DISTRIBUTION, "--", WSL_WORKER, *arguments]


def status(force: bool = False) -> dict[str, Any]:
    global _STATUS_CACHE
    now = time.monotonic()
    if not force and _STATUS_CACHE and now - _STATUS_CACHE[0] < 60.0:
        return _STATUS_CACHE[1]
    try:
        completed = subprocess.run(_command("--status"), check=True, capture_output=True, text=True, timeout=15)
        result = json.loads(completed.stdout)
    except Exception as exc:
        result = {"available": False, "engine": "pythia8-hepmc3-wsl", "error": f"{type(exc).__name__}: {exc}"}
    _STATUS_CACHE = (now, result)
    return result


def _configuration(model: str, values: dict[str, Any]) -> tuple[int, int, str]:
    if model == "ppDijet":
        return 2212, 2212, "hardQCD"
    if model == "ppMinimumBias":
        return 2212, 2212, "softQCD"
    if model != "colliderWorkbench":
        raise ValueError(f"PYTHIA adapter does not implement model {model}")
    beam_a = str(values.get("beamA", "proton"))
    beam_b = str(values.get("beamB", "proton"))
    if beam_a not in BEAMS or beam_b not in BEAMS:
        raise ValueError("This first PYTHIA adapter supports proton and antiproton beams only")
    requested = str(values.get("processMode", "auto"))
    mode = "hardQCD" if requested == "hardQCD" else "softQCD"
    return BEAMS[beam_a], BEAMS[beam_b], mode


def solve(model: str, values: dict[str, Any], points: int = 120) -> dict[str, Any]:
    beam_a, beam_b, mode = _configuration(model, values)
    seed = max(1, int(values.get("eventSeed", 1)))
    energy_tev = max(float(values.get("beamEnergy", 13.6)), 0.01)
    hard_scale = max(float(values.get("hardScale", 20.0)), 1.0)
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    event_path = OUTPUT_DIRECTORY / "latest-pythia-event.hepmc3"
    completed = subprocess.run(
        _command(
            "--beam-a", str(beam_a), "--beam-b", str(beam_b), "--seed", str(seed),
            "--ecm-gev", str(energy_tev * 1000.0), "--mode", mode,
            "--pt-hat-min", str(hard_scale), "--hepmc", _wsl_path(event_path),
        ),
        check=True,
        capture_output=True,
        text=True,
        timeout=90,
    )
    payload = json.loads(completed.stdout)
    if not payload.get("ok"):
        raise RuntimeError(payload.get("error", "PYTHIA worker failed"))
    tracks = payload["tracks"]
    bins = max(32, int(points))
    data = [{"x": -math.pi + 2.0 * math.pi * i / (bins - 1), "primary": 0.0, "secondary": 0.0} for i in range(bins)]
    for track in tracks:
        wrapped = (float(track["phi"]) + math.pi) % (2.0 * math.pi) - math.pi
        index = max(0, min(bins - 1, round((wrapped + math.pi) / (2.0 * math.pi) * (bins - 1))))
        data[index]["primary"] += float(track["momentum"])
        data[index]["secondary"] += abs(float(track["charge"]))
    charged = sum(1 for track in tracks if abs(float(track["charge"])) > 1e-12)
    visible_energy = sum(float(track["energy"]) for track in tracks if track["type"] != "neutrino")
    return {
        "kind": "collision-event",
        "xLabel": "Azimuth phi, rad",
        "yLabel": "sum |p|, GeV",
        "primaryLabel": f"PYTHIA 8 {mode} event energy flow",
        "secondaryLabel": "charged multiplicity",
        "data": data,
        "metrics": [["sqrt(s)", energy_tev, "TeV"], ["N final", len(tracks), "particles"], ["sigma_gen", payload["sigmaGen_mb"], "mb"]],
        "state": {"mode": mode, "trackCount": len(tracks), "charged": charged, "supported": True, "visibleEnergyGeV": visible_energy, "eventSeed": seed},
        "event": {"process": "collision", "mode": mode, "tracks": tracks, "vertices": [[0.0, 0.0, 0.0]], "beamEnergy": energy_tev, "seed": seed, "beamA": beam_a, "beamB": beam_b, "hepmc3File": str(event_path)},
        "backendHint": "Real PYTHIA 8 event generation with a HepMC3 final-state record in Ubuntu WSL.",
        "provenance": {
            "engine": "pythia8-hepmc3-wsl",
            "pythia": str(payload["pythiaVersion"]),
            "hepmc3": payload["hepmc3Version"],
            "scientificPackage": True,
            "validatedExternalSimulation": False,
            "limitations": "Ubuntu 20.04 provides legacy PYTHIA 8.186; the HepMC3 record currently contains one shared production vertex and final-state particles.",
        },
    }
