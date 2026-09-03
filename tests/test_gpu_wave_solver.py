import numpy as np
import pytest

from scientific_backend.gpu_wave_solver import solve, status


def test_directml_fdtd_matches_cpu_and_is_profiled() -> None:
    assert status()["available"] is True
    result = solve({"waveGrid": 96, "waveSteps": 6, "waveCourant": 0.6, "benchmarkRepeats": 3})
    state = result["state"]
    assert state["gpuNodeProviderConfirmed"] is True
    assert state["stableDiscretisation"] is True
    assert state["updatedCells"] == 96 * 96 * 6
    assert state["maxRelativeError"] < 2e-4
    assert np.isfinite(state["speedup"])


def test_fdtd_rejects_unstable_courant_number() -> None:
    with pytest.raises(ValueError, match="stability"):
        solve({"waveGrid": 64, "waveSteps": 4, "waveCourant": 0.71})
