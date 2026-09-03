import math

import pytest

from scientific_backend.pycbc_adapter import solve, status


@pytest.mark.integration
def test_pycbc_wsl_generates_physical_polarisations():
    availability = status(force=True)
    if not availability.get("available"):
        pytest.skip(availability.get("error", "PyCBC WSL is unavailable"))
    result = solve({"binaryMassA": 36.0, "binaryMassB": 29.0, "distanceMpc": 410.0, "waveformPoints": 180})
    assert result["provenance"]["engine"] == "pycbc-lalsuite-wsl"
    assert result["state"]["approximant"] == "IMRPhenomD"
    assert result["state"]["peakStrainSI"] > 0.0
    assert len(result["data"]) >= 180
    assert all(math.isfinite(point["strainSI"]) and math.isfinite(point["crossStrainSI"]) for point in result["data"])
