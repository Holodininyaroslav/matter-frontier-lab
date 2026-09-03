import pytest

from scientific_backend.gpu_multiquark_adapter import status
from scientific_backend.multiquark_discovery import solve


def test_multiquark_threshold_stage_runs_on_directml() -> None:
    if not status()["available"]:
        pytest.skip("DirectML is unavailable")
    result = solve({
        "composition": "u u d d s s",
        "searchBudget": 25000,
        "computeBackend": "directml",
        "benchmarkRepeats": 2,
    })
    gpu = result["gpuAcceleration"]
    assert gpu["used"] is True
    assert gpu["gpuNodeProviderConfirmed"] is True
    assert gpu["workItems"] == 25000
    assert gpu["maxRelativeError"] < 1e-6
    assert result["bestCandidate"]["bindingMarginMeV"] == pytest.approx(6.3682, abs=1e-3)


def test_multiquark_cpu_mode_does_not_claim_gpu_use() -> None:
    result = solve({"composition": "u u d d s s", "searchBudget": 25000, "computeBackend": "cpu"})
    assert result["gpuAcceleration"]["used"] is False
    assert result["gpuAcceleration"]["engine"] == "python-cpu"
