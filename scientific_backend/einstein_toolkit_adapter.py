from __future__ import annotations

import csv
import hashlib
from pathlib import Path
from typing import Any

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
WAVEFORM = ROOT / "scientific_data" / "einstein_toolkit" / "gw150914" / "refwaveform.csv"
EXPECTED_SHA256 = "2888a4e9fdc1be0060a809e6a840a742b0a193a3f9d40d53014ab1c165239f96"

def status() -> dict[str, Any]:
    if not WAVEFORM.is_file():
        return {"available": False, "engine": "einstein-toolkit-reference-data", "error": "refwaveform.csv is missing"}
    digest = hashlib.sha256(WAVEFORM.read_bytes()).hexdigest()
    return {"available": digest == EXPECTED_SHA256, "engine": "einstein-toolkit-reference-data", "dataset": "GW150914 gallery reference waveform", "sha256": digest}

def solve(values: dict[str, Any], points: int = 180) -> dict[str, Any]:
    capability = status()
    if not capability["available"]:
        raise RuntimeError(capability.get("error", "Einstein Toolkit reference data checksum mismatch"))
    with WAVEFORM.open("r", encoding="utf-8", newline="") as source:
        rows = np.asarray([[float(a), float(b)] for a, b in csv.reader(source)], dtype=float)
    indexes = np.linspace(0, len(rows) - 1, max(32, int(points))).round().astype(int)
    sampled = rows[indexes]
    peak = float(np.max(np.abs(rows[:, 1]))) or 1.0
    data = [{"x": float(row[0]), "primary": float(row[1]), "secondary": float(abs(row[1]) / peak)} for row in sampled]
    peak_index = int(np.argmax(np.abs(rows[:, 1])))
    return {
        "kind": "numerical-relativity-waveform", "xLabel": "retarded time, M", "yLabel": "strain mode",
        "primaryLabel": "Einstein Toolkit GW150914 l=2, m=2 strain", "secondaryLabel": "normalised |strain|", "data": data,
        "metrics": [["Primary mass", 36, "M☉"], ["Secondary mass", 29, "M☉"], ["Final mass", 0.95 * 65, "M☉"]],
        "state": {"supported": True, "fixedDataset": True, "sampleCount": int(len(rows)), "peakTimeM": float(rows[peak_index, 0]), "peakStrainMode": float(rows[peak_index, 1]), "remnantSpin": 0.69},
        "event": {"process": "binaryBlackHoleMerger", "model": "Einstein Toolkit numerical-relativity reference data", "initialMassesSolar": [36, 29]},
        "backendHint": "Official Einstein Toolkit GW150914 gallery reference waveform; fixed parameters, not rescaled to arbitrary slider values.",
        "provenance": {"engine": "einstein-toolkit-reference-data", "dataset": "GW150914 gallery refwaveform.csv", "sha256": capability["sha256"],
                       "source": "https://einsteintoolkit.org/gallery/bbh/refwaveform.csv", "scientificPackage": True, "validatedExternalSimulation": True,
                       "limitations": "A fixed published numerical-relativity waveform. Running a new Einstein Toolkit spacetime evolution locally would require cluster-scale memory and CPU time."},
    }
