from scientific_backend.directml_adapter import solve, status

def test_directml_hamiltonian_matches_cpu() -> None:
    assert status()["available"] is True
    result = solve({"matrixSize": 384, "stateBatch": 24, "benchmarkRepeats": 3, "adapterCount": 2})
    assert result["state"]["gpuNodeProviderConfirmed"] is True
    assert result["state"]["maxRelativeError"] < 1e-4
