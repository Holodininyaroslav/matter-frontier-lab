"""Small, inspectable ASIC + CUDA-Q hybrid-computing demonstration.

The SystemVerilog block performs deterministic candidate filtering.  The host
then maps the surviving demonstration candidate to a two-qubit Grover search.
This is an architecture example, not a QCD calculation and not evidence for a
physical multiquark state.

CUDA-Q currently supports Windows through WSL2.  On the project's AMD GPU the
CUDA-Q ``nvidia`` simulator is unavailable, so ``qpp-cpu`` is the portable
local target.  The separate DirectML adapters accelerate suitable classical
and state-vector workloads on the AMD GPU.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from typing import Any, Iterable

try:  # Optional: the repository and documentation remain usable without CUDA-Q.
    import cudaq
except ImportError:  # pragma: no cover - depends on the external CUDA-Q runtime.
    cudaq = None


@dataclass(frozen=True)
class Candidate:
    """Integer payload shared by the software reference and the RTL frontend."""

    candidate_id: int
    conserved: bool
    color_triality: int
    pauli_allowed: bool
    energy_mev: int
    threshold_mev: int
    uncertainty_mev: int


DEMO_CANDIDATES = (
    Candidate(0, False, 0, True, 2222, 2231, 5),
    Candidate(1, True, 1, True, 2218, 2231, 5),
    Candidate(2, True, 0, False, 2220, 2231, 5),
    Candidate(3, True, 0, True, 2219, 2231, 5),
)


def asic_reference_filter(candidates: Iterable[Candidate]) -> list[dict[str, Any]]:
    """Mirror the committed SystemVerilog acceptance and margin logic."""

    accepted: list[dict[str, Any]] = []
    for candidate in candidates:
        margin = candidate.threshold_mev - candidate.energy_mev
        constraints_ok = (
            candidate.conserved
            and candidate.color_triality == 0
            and candidate.pauli_allowed
        )
        if constraints_ok and margin > candidate.uncertainty_mev:
            accepted.append({**asdict(candidate), "binding_margin_mev": margin})
    return accepted


if cudaq is not None:  # The decorator compiles this function as a CUDA-Q kernel.

    @cudaq.kernel
    def grover_mark_11():
        """Find the fixed two-bit demonstration address |11>."""

        qubits = cudaq.qvector(2)
        h(qubits)
        z.ctrl(qubits[0], qubits[1])
        h(qubits)
        x(qubits)
        z.ctrl(qubits[0], qubits[1])
        x(qubits)
        h(qubits)
        mz(qubits)

else:  # Keep the module importable for tests and non-CUDA-Q installations.
    grover_mark_11 = None


def run_quantum_kernel(target: str = "qpp-cpu", shots: int = 1024) -> dict[str, Any]:
    """Execute the CUDA-Q kernel, or return an explicit availability record."""

    if cudaq is None or grover_mark_11 is None:
        return {
            "executed": False,
            "target": target,
            "reason": "CUDA-Q is not installed in this Python environment.",
        }
    cudaq.set_target(target)
    counts = cudaq.sample(grover_mark_11, shots_count=shots)
    histogram = {str(bitstring): int(count) for bitstring, count in counts.items()}
    most_likely = max(histogram, key=histogram.get) if histogram else None
    return {
        "executed": True,
        "target": target,
        "shots": shots,
        "counts": histogram,
        "mostLikely": most_likely,
    }


def run_demo(target: str = "qpp-cpu", shots: int = 1024) -> dict[str, Any]:
    """Run the complete demonstrator and preserve every architectural boundary."""

    accepted = asic_reference_filter(DEMO_CANDIDATES)
    selected = max(accepted, key=lambda row: row["binding_margin_mev"], default=None)
    address_contract_ok = bool(selected and selected["candidate_id"] == 3)
    quantum = run_quantum_kernel(target, shots) if address_contract_ok else {
        "executed": False,
        "target": target,
        "reason": "The RTL/software filter did not select the demonstration address |11>.",
    }
    return {
        "schema": "matter-frontier.hybrid-asic-cudaq-demo/v1",
        "inputCandidates": [asdict(candidate) for candidate in DEMO_CANDIDATES],
        "asicAccepted": accepted,
        "selectedCandidate": selected,
        "addressContract": "candidate_id 3 <-> two-qubit state |11>",
        "addressContractOk": address_contract_ok,
        "quantum": quantum,
        "scientificBoundary": (
            "Architecture demonstrator only: integer filtering plus a two-qubit "
            "Grover kernel; it does not calculate a multiquark spectrum."
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", default="qpp-cpu", help="CUDA-Q target, for example qpp-cpu")
    parser.add_argument("--shots", type=int, default=1024)
    arguments = parser.parse_args()
    print(json.dumps(run_demo(arguments.target, max(1, arguments.shots)), indent=2))


if __name__ == "__main__":
    main()
