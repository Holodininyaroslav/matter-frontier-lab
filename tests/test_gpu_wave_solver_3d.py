import pytest

from scientific_backend.gpu_wave_solver_3d import solve, status


def test_directml_3d_wave_matches_cpu() -> None:
    if not status()["available"]:
        pytest.skip("DirectML is unavailable")
    result = solve({"waveGrid3d": 64, "waveSteps3d": 6, "waveCourant3d": 0.48, "benchmarkRepeats": 2})
    assert result["state"]["gpuNodeProviderConfirmed"] is True
    assert result["state"]["grid"] == [64, 64, 64]
    assert result["state"]["maxRelativeError"] < 1e-5


def test_3d_wave_rejects_unstable_courant_number() -> None:
    if not status()["available"]:
        pytest.skip("DirectML is unavailable")
    with pytest.raises(ValueError, match="Courant"):
        solve({"waveGrid3d": 32, "waveSteps3d": 3, "waveCourant3d": 0.7, "benchmarkRepeats": 2})
