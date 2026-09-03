from scientific_backend.devsim_adapter import solve, status


def test_devsim_equilibrium_pn_junction():
    availability = status(force=True)
    assert availability["available"], availability
    result = solve({"deviceLengthUm": 2, "acceptorDoping": 1e16, "donorDoping": 1e16,
                    "appliedBias": 0, "deviceTemperature": 300, "meshNodes": 81})
    assert result["provenance"]["engine"] == "devsim-wsl"
    assert 0.5 < result["state"]["builtInPotentialV"] < 1.0
    assert result["state"]["peakFieldVcm"] > 1000
    assert len(result["data"]) >= 80
