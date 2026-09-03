from scientific_backend.geant4_adapter import solve, status

def test_geant4_worker_and_transport() -> None:
    assert status(force=True)["available"] is True
    result = solve({"transportParticle": "gamma", "transportEnergyMeV": 1.0, "transportMaterial": "G4_Si", "transportEvents": 8})
    assert result["provenance"]["engine"] == "geant4-cpp-wsl"
    assert result["state"]["events"] == 8
    assert result["state"]["targetStepCount"] > 0
