from pathlib import Path

import pytest

from scientific_backend.multiquark_discovery import ROOT, solve, status


def test_h_dibaryon_search_produces_traceable_screening_and_rtl() -> None:
    result = solve({
        "composition": "u u d d s s",
        "hamiltonianLevel": "B",
        "orbitalModes": 2,
        "colorSpinCoupling": 1.0,
        "searchBudget": 25000,
        "hardwareTarget": "rtl-emulation",
    })
    assert result["quantumNumbers"]["baryonNumber"] == pytest.approx(2.0)
    assert result["quantumNumbers"]["strangeness"] == -2
    assert result["quantumNumbers"]["triality"] == 0
    assert result["thresholds"][0]["channel"] == "Λ + Λ"
    assert result["candidates"]
    assert result["provenance"]["validatedExternalSimulation"] is False
    assert "module multiquark_physics_frontend" in result["systemVerilog"]
    for artifact in result["artifacts"].values():
        assert (ROOT / Path(artifact)).is_file()


def test_nonzero_triality_rejects_color_singlet_stage() -> None:
    result = solve({"composition": "u u d s", "searchBudget": 10000})
    color_stage = next(stage for stage in result["pipeline"] if stage["id"] == "color")
    assert result["quantumNumbers"]["triality"] != 0
    assert color_stage["count"] == 0
    assert result["bestCandidate"] is None


def test_invalid_composition_is_rejected() -> None:
    with pytest.raises(ValueError):
        solve({"composition": "electron photon"})


def test_status_exposes_systemverilog_generator() -> None:
    capability = status()
    assert capability["available"] is True
    assert capability["systemVerilogGenerator"] is True


def test_repository_contains_synthesizable_systemverilog_contract() -> None:
    source = ROOT / "hardware" / "multiquark" / "multiquark_physics_frontend.sv"
    testbench = ROOT / "hardware" / "multiquark" / "tb_multiquark_physics_frontend.sv"
    assert source.is_file()
    assert testbench.is_file()
    assert "always_ff" in source.read_text(encoding="utf-8")
    assert "multiquark_physics_frontend dut" in testbench.read_text(encoding="utf-8")
