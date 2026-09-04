"""Small, inspectable CUDA-Q implementation of Shor order finding.

The executable teaching case factors N=15 with base a=2.  Its modular
arithmetic is compiled specifically for that pair, so this file is not a
general RSA factorizer.  The program follows the same hybrid boundaries as
NVIDIA's open CUDA-Q Shor notebook:
https://nvidia.github.io/cuda-quantum/latest/applications/python/shors.html

Run the deterministic host preview anywhere:
    python scientific_backend/cudaq_shor_demo.py --preview

Run the quantum kernel after installing CUDA-Q in a supported environment:
    python scientific_backend/cudaq_shor_demo.py --target auto --shots 4096

CUDA-Q is Apache-2.0 software.  This project file is an independent compact
adaptation released under the repository's MIT license; the upstream notebook
and CUDA-Q retain their own notices and licences.
"""

from __future__ import annotations

import argparse
import json
from fractions import Fraction
from math import gcd
from typing import Mapping

try:
    import cudaq
except ImportError:  # The repository remains importable without CUDA-Q.
    cudaq = None


N = 15
BASE = 2
CONTROL_QUBITS = 4
WORK_QUBITS = 4


def classical_order(a: int, modulus: int) -> int:
    """Return the smallest positive r satisfying a**r = 1 (mod modulus)."""
    if gcd(a, modulus) != 1:
        raise ValueError("a and modulus must be coprime")
    value = 1
    for order in range(1, modulus + 1):
        value = (value * a) % modulus
        if value == 1:
            return order
    raise RuntimeError("order was not found")


def recover_factors(a: int, order: int, modulus: int) -> tuple[int, int]:
    """Apply Shor's classical GCD post-processing to a measured even order."""
    if order % 2:
        raise ValueError("the measured order is odd; retry with another base")
    root = pow(a, order // 2, modulus)
    left = gcd(root - 1, modulus)
    right = gcd(root + 1, modulus)
    if 1 < left < modulus and 1 < right < modulus:
        return tuple(sorted((left, right)))
    raise ValueError("the order produced only trivial factors; retry")


if cudaq is not None:

    @cudaq.kernel
    def quantum_fourier_transform(register: cudaq.qview):
        """QFT kernel used through cudaq.adjoint to obtain inverse QFT."""
        count = len(register)
        for target in range(count):
            h(register[target])
            for control in range(target + 1, count):
                angle = 2.0 * 3.141592653589793 / (2 ** (control - target + 1))
                cr1(angle, [register[control]], register[target])


    @cudaq.kernel
    def inverse_qft(register: cudaq.qview):
        cudaq.adjoint(quantum_fourier_transform, register)


    @cudaq.kernel
    def multiply_by_2_mod_15(work: cudaq.qview):
        """Rotate four little-endian bits: |y> -> |2*y mod 15>."""
        swap(work[3], work[2])
        swap(work[2], work[1])
        swap(work[1], work[0])


    @cudaq.kernel
    def multiply_by_4_mod_15(work: cudaq.qview):
        multiply_by_2_mod_15(work)
        multiply_by_2_mod_15(work)


    @cudaq.kernel
    def modular_exponentiation(exponent: cudaq.qview, work: cudaq.qview):
        """Apply controlled U^(2^j), where U|y> = |2*y mod 15>."""
        cudaq.control(multiply_by_2_mod_15, exponent[0], work)
        cudaq.control(multiply_by_4_mod_15, exponent[1], work)
        # U^4 is identity because the order of 2 modulo 15 is four.  The two
        # remaining exponent controls therefore need no physical gates.


    @cudaq.kernel
    def shor_order_finding():
        qubits = cudaq.qvector(CONTROL_QUBITS + WORK_QUBITS)
        exponent = qubits[0:CONTROL_QUBITS]
        work = qubits[CONTROL_QUBITS:CONTROL_QUBITS + WORK_QUBITS]
        x(work[0])  # Encode |1> in the modular-arithmetic register.
        h(exponent)
        modular_exponentiation(exponent, work)
        inverse_qft(exponent)
        mz(exponent)


def _counts_dictionary(sample_result: object) -> dict[str, int]:
    """Normalize CUDA-Q sample results without depending on one release API."""
    if hasattr(sample_result, "items"):
        return {str(bits): int(count) for bits, count in sample_result.items()}
    return {str(bits): int(count) for bits, count in dict(sample_result).items()}


def infer_order(counts: Mapping[str, int], a: int = BASE, modulus: int = N) -> int:
    """Recover an order candidate from high-probability QPE bit strings."""
    width = CONTROL_QUBITS
    for bits, _ in sorted(counts.items(), key=lambda item: item[1], reverse=True):
        phase_integer = int(bits[::-1], 2)
        if phase_integer == 0:
            continue
        fraction = Fraction(phase_integer, 2**width).limit_denominator(modulus)
        for multiplier in range(1, modulus + 1):
            candidate = fraction.denominator * multiplier
            if pow(a, candidate, modulus) == 1:
                return candidate
    raise RuntimeError("no valid period was recovered from the samples")


def select_target(requested: str) -> str:
    """Select a real CUDA-Q target and report exactly what will execute."""
    if cudaq is None:
        raise RuntimeError("CUDA-Q is not installed; use --preview or install cuda-quantum")
    target = requested
    if requested == "auto":
        target = "nvidia" if cudaq.num_available_gpus() and cudaq.has_target("nvidia") else "qpp-cpu"
    cudaq.set_target(target)
    return target


def run_quantum(shots: int = 4096, target: str = "auto") -> dict[str, object]:
    """Execute the CUDA-Q kernel and finish factor recovery on the host."""
    selected_target = select_target(target)
    samples = cudaq.sample(shor_order_finding, shots_count=shots)
    counts = _counts_dictionary(samples)
    order = infer_order(counts)
    factors = recover_factors(BASE, order, N)
    return {
        "modulus": N,
        "base": BASE,
        "order": order,
        "factors": list(factors),
        "shots": shots,
        "target": selected_target,
        "counts": counts,
        "scientificBoundary": "compiled N=15 teaching circuit; not a general RSA factorizer",
    }


def preview() -> dict[str, object]:
    """Deterministic host-side check used when CUDA-Q is not installed."""
    order = classical_order(BASE, N)
    return {
        "modulus": N,
        "base": BASE,
        "order": order,
        "factors": list(recover_factors(BASE, order, N)),
        "expectedPhasePeaks": ["0000", "0010", "0001", "0011"],
        "execution": "classical control preview only",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", action="store_true", help="run deterministic host checks only")
    parser.add_argument("--target", default="auto", help="CUDA-Q target, for example auto, nvidia, qpp-cpu or a configured QPU target")
    parser.add_argument("--shots", type=int, default=4096)
    arguments = parser.parse_args()
    result = preview() if arguments.preview else run_quantum(arguments.shots, arguments.target)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
