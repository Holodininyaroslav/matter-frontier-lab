import pytest

from scientific_backend.gpu_quantum_simulator import solve, status


def test_directml_ghz_statevector_matches_cpu() -> None:
    if not status()["available"]:
        pytest.skip("DirectML is unavailable")
    result = solve({
        "quantumCircuit": "ghz",
        "quantumQubits": 5,
        "quantumBatch": 16,
        "quantumShots": 1024,
        "benchmarkRepeats": 2,
    })
    state = result["state"]
    assert state["gpuNodeProviderConfirmed"] is True
    assert state["fidelity"] > 0.999999
    assert state["normalizationError"] < 1e-5
    assert state["maxRelativeError"] < 1e-5
    probabilities = {item["basis"]: item["probability"] for item in state["topOutcomes"]}
    assert probabilities["00000"] == pytest.approx(0.5, abs=1e-6)
    assert probabilities["11111"] == pytest.approx(0.5, abs=1e-6)


def test_quantum_statevector_is_explicitly_capped() -> None:
    if not status()["available"]:
        pytest.skip("DirectML is unavailable")
    result = solve({"quantumCircuit": "bell", "quantumQubits": 99, "quantumBatch": 8, "benchmarkRepeats": 2})
    assert result["state"]["qubits"] == 10
    assert "not physical quantum hardware" in result["provenance"]["limitations"]


def test_qft_of_zero_has_uniform_measurement_distribution() -> None:
    if not status()["available"]:
        pytest.skip("DirectML is unavailable")
    result = solve({
        "quantumCircuit": "qft",
        "quantumQubits": 4,
        "quantumBatch": 16,
        "quantumShots": 2048,
        "benchmarkRepeats": 2,
    })
    state = result["state"]
    assert state["gpuNodeProviderConfirmed"] is True
    assert state["fidelity"] > 0.999999
    probabilities = [item["probability"] for item in state["topOutcomes"]]
    assert probabilities
    assert all(probability == pytest.approx(1.0 / 16.0, abs=1e-6) for probability in probabilities)


def test_two_qubit_grover_demo_marks_11_and_exports_cloud_fragment() -> None:
    if not status()["available"]:
        pytest.skip("DirectML is unavailable")
    result = solve({
        "quantumCircuit": "grover2",
        "quantumQubits": 10,
        "quantumBatch": 16,
        "quantumShots": 1024,
        "benchmarkRepeats": 2,
    })
    state = result["state"]
    assert state["qubits"] == 2
    assert state["fidelity"] > 0.999999
    assert state["topOutcomes"][0]["basis"] == "11"
    assert state["topOutcomes"][0]["probability"] == pytest.approx(1.0, abs=1e-6)
    cloud = state["cloudHardwareDemo"]
    assert cloud["executionState"] == "exported-not-submitted"
    assert "OPENQASM 2.0" in cloud["openQasm2"]
    assert "SamplerV2" in cloud["qiskitSamplerV2Python"]
    assert "token" not in cloud["qiskitSamplerV2Python"].lower()
