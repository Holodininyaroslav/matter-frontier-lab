from scientific_backend.cudaq_shor_demo import (
    BASE,
    N,
    classical_order,
    preview,
    recover_factors,
)


def test_compiled_teaching_case_recovers_factors_of_15():
    order = classical_order(BASE, N)

    assert order == 4
    assert recover_factors(BASE, order, N) == (3, 5)


def test_preview_states_that_no_quantum_backend_ran():
    result = preview()

    assert result["order"] == 4
    assert result["factors"] == [3, 5]
    assert result["execution"] == "classical control preview only"
