"""Line-oriented JSON worker executed by the isolated PyCBC WSL runtime."""

from __future__ import annotations

import json
import math
import sys
from importlib import metadata

import numpy as np
import pycbc
from pycbc.waveform import get_td_waveform


def generate(values: dict) -> dict:
    m1 = max(float(values.get("binaryMassA", 36.0)), 1.0)
    m2 = max(float(values.get("binaryMassB", 29.0)), 1.0)
    spin1z = float(np.clip(float(values.get("spinA", 0.0)), -0.99, 0.99))
    spin2z = float(np.clip(float(values.get("spinB", 0.0)), -0.99, 0.99))
    distance = max(float(values.get("distanceMpc", 410.0)), 1e-6)
    inclination = float(values.get("inclinationRad", 0.0))
    lower_frequency = max(float(values.get("lowerFrequencyHz", 20.0)), 8.0)
    sample_rate = max(1024, min(int(values.get("sampleRateHz", 4096)), 16384))
    approximant = str(values.get("waveformApproximant", "IMRPhenomD"))
    allowed = {"IMRPhenomD", "IMRPhenomXAS", "SEOBNRv4_opt"}
    if approximant not in allowed:
        approximant = "IMRPhenomD"

    hp, hc = get_td_waveform(
        approximant=approximant,
        mass1=m1,
        mass2=m2,
        spin1z=spin1z,
        spin2z=spin2z,
        delta_t=1.0 / sample_rate,
        f_lower=lower_frequency,
        distance=distance,
        inclination=inclination,
    )
    plus = np.asarray(hp, dtype=np.float64)
    cross = np.asarray(hc, dtype=np.float64)
    times = np.asarray(hp.sample_times, dtype=np.float64)
    peak_index = int(np.argmax(np.abs(plus)))
    times = times - times[peak_index]
    peak = max(float(np.max(np.abs(plus))), 1e-30)
    complex_strain = plus + 1j * cross
    phase = np.unwrap(np.angle(complex_strain))
    frequency = np.abs(np.gradient(phase, 1.0 / sample_rate) / (2.0 * math.pi))

    max_points = max(180, min(int(values.get("waveformPoints", 720)), 1800))
    stride = max(1, math.ceil(len(plus) / max_points))
    indices = np.arange(0, len(plus), stride, dtype=int)
    if indices[-1] != len(plus) - 1:
        indices = np.append(indices, len(plus) - 1)
    data = [
        {
            "x": float(times[i]),
            "primary": float(plus[i] / peak),
            "secondary": float(frequency[i]),
            "strainSI": float(plus[i]),
            "crossStrainSI": float(cross[i]),
        }
        for i in indices
    ]
    total = m1 + m2
    chirp = (m1 * m2) ** 0.6 / total**0.2
    return {
        "kind": "black-hole-merger",
        "xLabel": "time relative to peak strain, s",
        "yLabel": "strain (normalised; SI polarisations included)",
        "primaryLabel": f"PyCBC {approximant} h_plus",
        "secondaryLabel": "instantaneous GW frequency, Hz",
        "data": data,
        "metrics": [["chirp mass", chirp, "M_sun"], ["peak |h_plus|", peak, ""], ["samples", len(plus), ""]],
        "state": {
            "supported": True,
            "chirpMass": chirp,
            "distanceMpc": distance,
            "peakStrainSI": peak,
            "duration_s": float(times[-1] - times[0]),
            "sampleRateHz": sample_rate,
            "approximant": approximant,
            "rawSamples": len(plus),
            "returnedSamples": len(data),
        },
        "event": {
            "process": "binaryBlackHoleMerger",
            "model": approximant,
            "polarizations": ["h_plus", "h_cross"],
        },
        "backendHint": "PyCBC/LALSuite waveform generated in the isolated Ubuntu WSL runtime.",
        "provenance": {
            "engine": "pycbc-lalsuite-wsl",
            "pycbc": pycbc.__version__,
            "lalsuite": metadata.version("lalsuite"),
            "model": approximant,
            "scientificPackage": True,
            "validatedExternalSimulation": False,
            "limitations": "NR-calibrated aligned-spin quasi-circular waveform approximant; not a new numerical-relativity evolution or a generic multi-body solution.",
        },
    }


def main() -> None:
    request = json.load(sys.stdin)
    json.dump({"ok": True, "result": generate(request.get("values", {}))}, sys.stdout, ensure_ascii=False, allow_nan=False)


if __name__ == "__main__":
    main()
