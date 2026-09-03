import math

from scientific_backend import capabilities, solve_binary_black_hole, solve_cornell_potential, solve_einsteinpy_geodesic


def test_capability_manifest_reports_loaded_packages():
    manifest = capabilities()
    assert manifest["available"] is True
    assert manifest["engine"] == "numpy-scipy-cpu"
    assert manifest["numpy"]
    assert manifest["scipy"]


def test_cornell_curve_is_finite_and_has_expected_zero():
    alpha = 0.35
    sigma = 0.9
    result = solve_cornell_potential({"alphaS": alpha, "stringTension": sigma})
    expected = math.sqrt(4.0 * alpha / (3.0 * sigma))
    assert math.isclose(result["state"]["zeroCrossing_fm"], expected, rel_tol=1e-12)
    assert all(math.isfinite(point["primary"]) and math.isfinite(point["force"]) for point in result["data"])
    assert result["provenance"]["engine"] == "numpy-scipy-cpu"


def test_binary_inspiral_chirps_and_conserves_mass_accounting():
    result = solve_binary_black_hole({"binaryMassA": 36.0, "binaryMassB": 29.0, "initialSeparation": 28.0})
    state = result["state"]
    inspiral = [point for point in result["data"] if point["x"] <= 0.0]
    frequencies = [point["secondary"] for point in inspiral]
    separations = [point["separation_rg"] for point in inspiral]
    assert all(b >= a for a, b in zip(frequencies, frequencies[1:]))
    assert all(b <= a for a, b in zip(separations, separations[1:]))
    assert 0.0 < state["remnantMass"] < 65.0
    assert state["peakStrainSI"] > 0.0
    assert state["maxPhaseConsistencyError_rad"] < 2e-3
    assert result["provenance"]["validatedExternalSimulation"] is False


def test_einsteinpy_returns_finite_schwarzschild_geodesic():
    result = solve_einsteinpy_geodesic({"mass": 36.0, "geodesicSteps": 64, "geodesicSpin": 0.0})
    assert result["metric"] == "Schwarzschild"
    assert result["provenance"]["engine"] == "einsteinpy"
    assert result["state"]["samples"] == 64
    assert result["state"]["minimumRadius_rg"] > 2.0
    assert all(math.isfinite(point["x_km"]) and math.isfinite(point["r_rg"]) for point in result["trajectory"])
