import pytest

from scientific_backend import biomolecule_adapter as bio


def test_fasta_normalisation_and_standard_translation():
    sequence, kind = bio.normalise_sequence(">demo\nAAA ATG AAA TAG CCC\n", "auto")
    assert kind == "dna"
    assert sequence == "AAAATGAAATAGCCC"
    assert bio.translate_dna(sequence, 1) == "KMK*P"


def test_six_frame_orf_coordinates_and_reverse_complement():
    sequence = "AAAATGAAATAGCCC"
    orfs = bio.find_orfs(sequence, minimum_amino_acids=2)
    forward = next(row for row in orfs if row["frame"] == "+1")
    assert forward["protein"] == "MK"
    assert (forward["startBase"], forward["endBase"]) == (4, 12)
    assert forward["complete"] is True
    assert bio.reverse_complement("ACGTN") == "NACGT"


def test_dna_solver_exposes_selected_protein_candidate():
    result = bio.solve({
        "biomoleculeAction": "translate",
        "sequenceType": "dna",
        "sequence": "AAAATGAAATAGCCC",
        "readingFrame": 1,
        "minimumOrfLength": 2,
    })
    assert result["kind"] == "biomolecule-sequence"
    assert result["state"]["protein"] == "MK"
    assert result["state"]["sequenceLength"] == 15


def test_alphafold_db_metadata_is_filtered_to_expected_hosts(monkeypatch):
    monkeypatch.setattr(bio, "_http_json", lambda _url: [{
        "entryId": "AF-P69905-F1",
        "gene": "HBA1",
        "globalMetricValue": 98.06,
        "uniprotEnd": 142,
        "cifUrl": "https://alphafold.ebi.ac.uk/files/model.cif",
        "pdbUrl": "https://evil.example/model.pdb",
        "paeDocUrl": "https://alphafold.ebi.ac.uk/files/pae.json",
    }])
    result = bio.alphafold_db_lookup("p69905")
    assert result["accession"] == "P69905"
    assert result["cifUrl"].startswith("https://alphafold.ebi.ac.uk/")
    assert result["pdbUrl"] is None
    assert result["meanPlddt"] == pytest.approx(98.06)


def test_prediction_plan_rejects_untranslated_dna():
    with pytest.raises(ValueError, match="protein sequence"):
        bio.solve({"biomoleculeAction": "prediction-plan", "sequenceType": "dna", "sequence": "ATGAAATAG"})


MINI_PDB = """HEADER    TEST PEPTIDE
ATOM      1  N   ALA A   1      -1.200   0.100   0.000  1.00 20.00           N
ATOM      2  CA  ALA A   1       0.050   0.000   0.000  1.00 20.00           C
ATOM      3  C   ALA A   1       1.200   0.900   0.000  1.00 20.00           C
ATOM      4  O   ALA A   1       2.350   0.500   0.000  1.00 20.00           O
ATOM      5  CB  ALA A   1       0.100  -1.500   0.100  1.00 20.00           C
TER
END
"""


def test_smart_matter_protein_repair_restores_graph_and_exact_particle_count():
    result = bio.solve({
        "biomoleculeAction": "smart-matter-protein-repair",
        "pdbId": "1TST",
        "pdbBlock": MINI_PDB,
        "photonCount": 72,
        "photonEnergyMeV": 1.25,
        "damageIntensity": 0.55,
        "damageSeed": 41,
    })
    state = result["state"]
    missing = state["damageReport"]["atomsMissing"]
    particles = state["repairPlan"]["particles"]
    assert result["kind"] == "smart-matter-protein-repair-plan"
    assert missing >= 1
    assert len(particles) == missing
    assert all(row["position"]["i"] < 0 for row in particles)
    assert all(row["targetPosition"]["i"] == 0 for row in particles)
    assert state["validation"]["bondValidation"] is True
    assert state["validation"]["topologyMatchPercent"] == 100.0
    assert state["validation"]["molecularDynamics"].startswith("NOT RUN")


def test_smart_matter_damage_is_seed_reproducible():
    values = {
        "biomoleculeAction": "smart-matter-protein-repair", "pdbId": "1TST", "pdbBlock": MINI_PDB,
        "photonCount": 48, "damageIntensity": 0.5, "damageSeed": 123,
    }
    first = bio.solve(values)["state"]
    second = bio.solve(values)["state"]
    assert first["damageEvents"] == second["damageEvents"]
    assert first["repairPlan"]["missingAtomIds"] == second["repairPlan"]["missingAtomIds"]
