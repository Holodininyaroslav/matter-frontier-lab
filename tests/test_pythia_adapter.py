from pathlib import Path

import pytest

from scientific_backend.pythia_adapter import solve, status


@pytest.mark.integration
def test_pythia_wsl_generates_event_and_hepmc3_record():
    availability = status(force=True)
    if not availability.get("available"):
        pytest.skip(availability.get("error", "PYTHIA WSL is unavailable"))
    result = solve("ppMinimumBias", {"beamEnergy": 13.6, "eventSeed": 42})
    assert result["provenance"]["engine"] == "pythia8-hepmc3-wsl"
    assert result["state"]["trackCount"] > 2
    assert result["event"]["tracks"]
    event_path = Path(result["event"]["hepmc3File"])
    assert event_path.exists()
    assert "HepMC::Version" in event_path.read_text(encoding="ascii", errors="ignore")
