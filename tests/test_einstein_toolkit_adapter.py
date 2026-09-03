from scientific_backend.einstein_toolkit_adapter import solve, status

def test_official_reference_waveform() -> None:
    assert status()["available"] is True
    result = solve({}, points=80)
    assert result["provenance"]["validatedExternalSimulation"] is True
    assert result["state"]["sampleCount"] > 100
    assert max(abs(row["primary"]) for row in result["data"]) > 0
