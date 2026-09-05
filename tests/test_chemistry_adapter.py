import pytest

from scientific_backend.chemistry_adapter import solve, status


def test_rdkit_structure_workbench():
    availability = status(force=True)
    assert availability["rdkit"]["available"], availability

    structure = solve({"chemistryAction": "structure", "customSmiles": "CCO"})
    assert structure["kind"] == "chemistry-structure"
    assert structure["state"]["formula"] == "C2H6O"
    assert len(structure["state"]["atoms"]) == 9


@pytest.mark.parametrize("reaction_id", ["waterFormation", "methaneCombustion", "etheneHydrogenation", "esterification"])
def test_balanced_reaction_workbench(reaction_id):
    reaction = solve({"chemistryAction": "reaction", "reactionId": reaction_id})
    assert reaction["kind"] == "chemistry-reaction"
    assert reaction["state"]["balanced"] is True
    assert len(reaction["state"]["reactants"]["atoms"]) == len(reaction["state"]["products"]["atoms"])


def test_free_graph_editor_payload():
    result = solve({
        "chemistryAction": "structure",
        "customGraph": {
            "atoms": [{"element": "C"}, {"element": "O"}],
            "bonds": [[0, 1, 2]],
        },
    })
    assert result["state"]["formula"] == "CH2O"
    assert any(bond[2] == 2 for bond in result["state"]["bonds"])


def test_rdkit_pyscf_water_calculation():
    availability = status(force=True)
    if not availability["quantumAvailable"]:
        pytest.skip(f"PySCF/WSL is unavailable: {availability['pyscf'].get('error', 'unknown error')}")
    result = solve({"moleculePreset": "water", "quantumMethod": "RHF", "basisSet": "sto-3g"})
    assert result["provenance"]["engine"] == "rdkit-etkdg-mmff94 + pyscf-wsl"
    assert result["state"]["converged"] is True
    assert result["state"]["totalEnergyHartree"] < -70
    assert result["state"]["gapEv"] > 0
    assert len(result["state"]["atoms"]) == 3


@pytest.mark.parametrize("preset", ["hydrogen", "oxygen", "water", "carbonDioxide", "methane", "ammonia", "ethanol", "glycine"])
def test_smart_matter_plan_uses_valid_rdkit_graph_and_hidden_i_start(preset):
    result = solve({
        "chemistryAction": "smart-matter-plan",
        "smartMoleculePreset": preset,
        "smartMatterSeed": 7123,
    })
    assert result["kind"] == "smart-matter-assembly-plan"
    plan = result["state"]
    assert plan["checks"]["valid"] is True
    assert len(plan["particles"]) == plan["checks"]["atomCount"]
    assert len(plan["constructionOrder"]) == plan["checks"]["bondCount"]
    assert all(particle["position"]["i"] < 0 for particle in plan["particles"])
    assert all(particle["targetPosition"]["i"] == 0 for particle in plan["particles"])
    assert {particle["state"] for particle in plan["particles"]} == {"FREE"}


def test_smart_matter_random_seed_changes_initial_configuration():
    first = solve({"chemistryAction": "smart-matter-plan", "smartMoleculePreset": "glycine", "smartMatterSeed": 11})["state"]
    second = solve({"chemistryAction": "smart-matter-plan", "smartMoleculePreset": "glycine", "smartMatterSeed": 12})["state"]
    assert first["bonds"] == second["bonds"]
    assert [particle["position"] for particle in first["particles"]] != [particle["position"] for particle in second["particles"]]
