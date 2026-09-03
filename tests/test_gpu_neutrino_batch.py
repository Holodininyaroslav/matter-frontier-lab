import pytest

from scientific_backend.gpu_neutrino_batch import solve, status


def test_directml_neutrino_probability_matches_cpu() -> None:
    if not status()["available"]:
        pytest.skip("DirectML is unavailable")
    result = solve({"neutrinoBatch": 65536, "benchmarkRepeats": 3, "mixingAngle": 0.59, "deltaMassSquared": 0.00245})
    assert result["state"]["gpuNodeProviderConfirmed"] is True
    assert result["state"]["samples"] == 65536
    assert result["state"]["maxRelativeError"] < 1e-5
    assert all(0.0 <= point["secondary"] <= 1.0 for point in result["data"])
