from scientific_backend.hybrid_quantum_asic_demo import (
    DEMO_CANDIDATES,
    asic_reference_filter,
    run_demo,
)


def test_asic_reference_selects_only_address_three():
    accepted = asic_reference_filter(DEMO_CANDIDATES)
    assert [row["candidate_id"] for row in accepted] == [3]
    assert accepted[0]["binding_margin_mev"] == 12


def test_demo_preserves_honest_execution_boundary():
    result = run_demo(shots=32)
    assert result["addressContractOk"] is True
    assert result["selectedCandidate"]["candidate_id"] == 3
    assert "does not calculate a multiquark spectrum" in result["scientificBoundary"]
    assert "executed" in result["quantum"]
