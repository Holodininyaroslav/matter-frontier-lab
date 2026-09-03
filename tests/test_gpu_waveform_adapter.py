import numpy as np

from scientific_backend.gpu_waveform_adapter import solve, status
from scientific_backend.acceleration_registry import status as acceleration_status


def test_directml_waveform_ensemble_matches_cpu() -> None:
    capability = status()
    assert capability["available"] is True
    result = solve({"waveformSystems": 128, "waveformSamples": 512, "benchmarkRepeats": 3})
    state = result["state"]
    assert state["gpuNodeProviderConfirmed"] is True
    assert state["evaluatedSamples"] == 128 * 512
    # CPU and DirectML use different float32 cosine implementations.  Across
    # hundreds of phase cycles their peak-normalised disagreement must remain
    # below 1e-4 (the absolute strain error is around 1e-25).
    assert state["maxRelativeError"] < 1e-4
    assert np.isfinite(state["speedup"])
    assert result["provenance"]["engine"] == "onnxruntime-directml-waveform-ensemble"


def test_acceleration_registry_does_not_claim_cpu_packages_are_on_gpu() -> None:
    registry = acceleration_status()
    by_package = {item["package"]: item for item in registry["engines"]}
    assert registry["available"] is True
    assert by_package["Waveform ensemble kernel"]["gpu"] is True
    assert by_package["Geant4"]["gpu"] is False
    assert by_package["PYTHIA 8/HepMC3"]["gpu"] is False
    assert by_package["PyCBC/LALSuite"]["gpu"] is False
