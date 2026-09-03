from scientific_backend.chemistry_adapter import solve, status


def test_rdkit_pyscf_water_calculation():
    availability = status(force=True)
    assert availability["available"], availability
    result = solve({"moleculePreset": "water", "quantumMethod": "RHF", "basisSet": "sto-3g"})
    assert result["provenance"]["engine"] == "rdkit-etkdg-mmff94 + pyscf-wsl"
    assert result["state"]["converged"] is True
    assert result["state"]["totalEnergyHartree"] < -70
    assert result["state"]["gapEv"] > 0
    assert len(result["state"]["atoms"]) == 3

