from scientific_backend.nusquids_adapter import solve, status

def test_nusquids_worker_and_probability_conservation() -> None:
    assert status(force=True)["available"] is True
    result = solve({"neutrinoEnergy": 2.0, "baselineKm": 1000.0, "matterDensityGcm3": 3.0, "initialFlavor": "muon"}, points=12)
    assert result["provenance"]["engine"] == "nusquids-wsl"
    assert abs(result["state"]["probabilitySum"] - 1.0) < 1e-6
