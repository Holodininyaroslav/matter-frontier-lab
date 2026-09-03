import math

from scientific_backend.compose_adapter import load_table, solve, status


def test_compose_ds_cmf_2_table_is_loaded_from_original_files():
    table = load_table()
    assert status()["available"] is True
    assert len(table["density"]) == 301
    assert math.isclose(table["density"][0], 0.03)
    assert math.isclose(table["density"][-1], 3.03)
    assert all(b > a for a, b in zip(table["energyDensity"], table["energyDensity"][1:]))


def test_compose_solver_reports_cold_table_and_physical_units():
    result = solve({"density": 3.2, "temperature": 18.0})
    assert result["provenance"]["engine"] == "compose-table-scipy"
    assert result["state"]["tableTemperatureMeV"] == 0.0
    assert result["state"]["temperatureApplied"] is False
    assert result["state"]["current"]["primary"] > 0.0
    assert 0.0 <= result["state"]["soundSpeed2"] <= 1.0
