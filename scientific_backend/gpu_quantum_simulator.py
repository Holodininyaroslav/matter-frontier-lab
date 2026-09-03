"""Small state-vector quantum-circuit simulator executed through DirectML.

The circuit unitary is assembled deterministically on the CPU, converted to a
real block matrix, and applied to a batch of state vectors by ONNX Runtime.
Both CPUExecutionProvider and DmlExecutionProvider execute the identical graph;
the outputs are compared and the provider profile is inspected on every run.
"""

from __future__ import annotations

import json
import math
import statistics
import tempfile
import time
from pathlib import Path
from typing import Any

import numpy as np
import onnx
import onnxruntime as ort
from onnx import TensorProto, helper, numpy_helper


def status() -> dict[str, Any]:
    providers = ort.get_available_providers()
    return {
        "available": "DmlExecutionProvider" in providers,
        "engine": "onnxruntime-directml-quantum-statevector",
        "onnxRuntime": ort.__version__,
        "providers": providers,
        "method": "exact noiseless state vector; dense circuit unitary",
        "maxQubits": 10,
    }


def _apply_single(unitary: np.ndarray, target: int, gate: np.ndarray) -> None:
    dimension = unitary.shape[0]
    bit = 1 << target
    for start in range(0, dimension, bit << 1):
        for offset in range(bit):
            row0, row1 = start + offset, start + offset + bit
            old0 = unitary[row0].copy()
            old1 = unitary[row1].copy()
            unitary[row0] = gate[0, 0] * old0 + gate[0, 1] * old1
            unitary[row1] = gate[1, 0] * old0 + gate[1, 1] * old1


def _apply_cnot(unitary: np.ndarray, control: int, target: int) -> None:
    dimension = unitary.shape[0]
    source = unitary.copy()
    control_bit, target_bit = 1 << control, 1 << target
    for basis in range(dimension):
        destination = basis ^ target_bit if basis & control_bit else basis
        unitary[destination] = source[basis]


def _apply_controlled_phase(unitary: np.ndarray, control: int, target: int, angle: float) -> None:
    mask = (1 << control) | (1 << target)
    phase = np.complex64(np.exp(1j * angle))
    for basis in range(unitary.shape[0]):
        if basis & mask == mask:
            unitary[basis] *= phase


def _swap_qubits(unitary: np.ndarray, left: int, right: int) -> None:
    if left == right:
        return
    source = unitary.copy()
    left_bit, right_bit = 1 << left, 1 << right
    for basis in range(unitary.shape[0]):
        left_value = bool(basis & left_bit)
        right_value = bool(basis & right_bit)
        destination = basis
        if left_value != right_value:
            destination ^= left_bit | right_bit
        unitary[destination] = source[basis]


def _circuit_unitary(qubits: int, preset: str, angle: float) -> tuple[np.ndarray, list[str]]:
    dimension = 1 << qubits
    unitary = np.eye(dimension, dtype=np.complex64)
    inv_sqrt2 = np.float32(1.0 / math.sqrt(2.0))
    h = np.asarray([[inv_sqrt2, inv_sqrt2], [inv_sqrt2, -inv_sqrt2]], dtype=np.complex64)
    gate_names: list[str] = []
    if preset == "bell":
        _apply_single(unitary, 0, h); gate_names.append("H q0")
        _apply_cnot(unitary, 0, 1); gate_names.append("CX q0→q1")
    elif preset == "ghz":
        _apply_single(unitary, 0, h); gate_names.append("H q0")
        for target in range(1, qubits):
            _apply_cnot(unitary, 0, target); gate_names.append(f"CX q0→q{target}")
    elif preset == "qft":
        for target in range(qubits):
            _apply_single(unitary, target, h); gate_names.append(f"H q{target}")
            for control in range(target + 1, qubits):
                phase = math.pi / (2 ** (control - target))
                _apply_controlled_phase(unitary, control, target, phase)
                gate_names.append(f"CP({phase:.3f}) q{control}→q{target}")
        for left in range(qubits // 2):
            _swap_qubits(unitary, left, qubits - left - 1)
            gate_names.append(f"SWAP q{left}↔q{qubits-left-1}")
    elif preset == "grover2":
        # Two-qubit Grover search for the marked state |11>.  This deliberately
        # uses only H, X and CZ/CX-equivalent gates so it can be transpiled to
        # the native instruction set of today's small cloud QPUs.
        x = np.asarray([[0, 1], [1, 0]], dtype=np.complex64)
        for target in range(2):
            _apply_single(unitary, target, h); gate_names.append(f"H q{target}")
        _apply_controlled_phase(unitary, 0, 1, math.pi); gate_names.append("CZ q0,q1 · oracle |11⟩")
        for target in range(2):
            _apply_single(unitary, target, h); gate_names.append(f"H q{target}")
            _apply_single(unitary, target, x); gate_names.append(f"X q{target}")
        _apply_controlled_phase(unitary, 0, 1, math.pi); gate_names.append("CZ q0,q1 · diffusion")
        for target in range(2):
            _apply_single(unitary, target, x); gate_names.append(f"X q{target}")
            _apply_single(unitary, target, h); gate_names.append(f"H q{target}")
    else:  # hardware-efficient variational ansatz
        for target in range(qubits):
            _apply_single(unitary, target, h); gate_names.append(f"H q{target}")
            theta = angle * (target + 1) / qubits
            ry = np.asarray([[math.cos(theta / 2), -math.sin(theta / 2)],
                             [math.sin(theta / 2), math.cos(theta / 2)]], dtype=np.complex64)
            _apply_single(unitary, target, ry); gate_names.append(f"RY({theta:.3f}) q{target}")
        for control in range(qubits - 1):
            _apply_cnot(unitary, control, control + 1); gate_names.append(f"CX q{control}→q{control+1}")
    return unitary, gate_names


def _cloud_demo(shots: int) -> dict[str, Any]:
    open_qasm = """OPENQASM 2.0;
include \"qelib1.inc\";
qreg q[2];
creg c[2];
h q[0];
h q[1];
cz q[0],q[1];
h q[0];
h q[1];
x q[0];
x q[1];
cz q[0],q[1];
x q[0];
x q[1];
h q[0];
h q[1];
measure q -> c;
"""
    python_fragment = f'''from qiskit import QuantumCircuit
from qiskit.transpiler import generate_preset_pass_manager
from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2 as Sampler

# Uses credentials saved in the user's local Qiskit configuration.
service = QiskitRuntimeService()
backend = service.least_busy(operational=True, simulator=False, min_num_qubits=2)

circuit = QuantumCircuit(2)
circuit.h([0, 1])
circuit.cz(0, 1)                 # Oracle marks |11>
circuit.h([0, 1])
circuit.x([0, 1])
circuit.cz(0, 1)                 # Grover diffusion phase
circuit.x([0, 1])
circuit.h([0, 1])
circuit.measure_all()

pass_manager = generate_preset_pass_manager(backend=backend, optimization_level=1)
isa_circuit = pass_manager.run(circuit)
sampler = Sampler(mode=backend)
job = sampler.run([isa_circuit], shots={shots})
print("backend:", backend.name)
print("job id:", job.job_id())
print(job.result()[0].data.meas.get_counts())
'''
    return {
        "name": "Two-qubit Grover search",
        "targetState": "11",
        "cloudReady": True,
        "qubits": 2,
        "classicalBits": 2,
        "shots": shots,
        "openQasm2": open_qasm,
        "qiskitSamplerV2Python": python_fragment,
        "requirements": "qiskit~=2.5; qiskit-ibm-runtime~=0.47",
        "credentialBoundary": "No credential is embedded. QiskitRuntimeService requires a user-owned IBM Quantum account and locally saved credentials.",
        "executionState": "exported-not-submitted",
    }


def _onnx_model(block_unitary: np.ndarray, batch: int) -> bytes:
    size = block_unitary.shape[0]
    state = helper.make_tensor_value_info("state", TensorProto.FLOAT, [size, batch])
    output = helper.make_tensor_value_info("evolved", TensorProto.FLOAT, [size, batch])
    graph = helper.make_graph(
        [helper.make_node("MatMul", ["circuit_unitary", "state"], ["evolved"], name="quantum_state_evolution")],
        "directml_quantum_statevector",
        [state], [output], [numpy_helper.from_array(block_unitary, "circuit_unitary")],
    )
    model = helper.make_model(graph, producer_name="Matter Frontier Lab", opset_imports=[helper.make_opsetid("", 20)])
    model.ir_version = 10
    onnx.checker.check_model(model)
    return model.SerializeToString()


def _profiled_run(model: bytes, state: np.ndarray, provider: str, device_id: int | None,
                  repeats: int, directory: Path) -> dict[str, Any]:
    options = ort.SessionOptions()
    options.enable_mem_pattern = False
    options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    options.enable_profiling = True
    options.profile_file_prefix = str(directory / f"quantum-{provider}-{device_id}")
    providers: list[Any] = ["CPUExecutionProvider"]
    if provider == "DmlExecutionProvider":
        providers = [("DmlExecutionProvider", {"device_id": device_id or 0}), "CPUExecutionProvider"]
    session = ort.InferenceSession(model, sess_options=options, providers=providers)
    for _ in range(2):
        session.run(None, {"state": state})
    durations: list[float] = []
    output = None
    for _ in range(repeats):
        started = time.perf_counter()
        output = session.run(None, {"state": state})[0]
        durations.append((time.perf_counter() - started) * 1000.0)
    profile = Path(session.end_profiling())
    events = json.loads(profile.read_text(encoding="utf-8"))
    node_providers = sorted({
        str(event.get("args", {}).get("provider"))
        for event in events
        if event.get("name", "").endswith("_kernel_time") and event.get("args", {}).get("provider")
    })
    return {
        "deviceId": device_id,
        "medianMs": statistics.median(durations),
        "minimumMs": min(durations),
        "profiledNodeProviders": node_providers,
        "output": output,
    }


def solve(values: dict[str, Any]) -> dict[str, Any]:
    capability = status()
    if not capability["available"]:
        raise RuntimeError("DmlExecutionProvider is not available")
    preset = str(values.get("quantumCircuit", "ghz"))
    qubits = max(2, min(int(values.get("quantumQubits", 8)), 10))
    if preset == "grover2":
        qubits = 2
    elif preset == "bell":
        qubits = max(2, qubits)
    batch = max(8, min(int(values.get("quantumBatch", 128)), 256))
    repeats = max(2, min(int(values.get("benchmarkRepeats", 5)), 15))
    angle = float(values.get("variationalAngle", 1.1))
    shots = max(128, min(int(values.get("quantumShots", 4096)), 65536))
    noise = max(0.0, min(float(values.get("quantumNoise", 0.0)), 0.2))
    dimension = 1 << qubits

    unitary, gates = _circuit_unitary(qubits, preset, angle)
    block = np.block([[unitary.real, -unitary.imag], [unitary.imag, unitary.real]]).astype(np.float32)
    initial = np.zeros((2 * dimension, batch), dtype=np.float32)
    for column in range(batch):
        basis = column % min(dimension, 16)
        initial[basis, column] = 1.0
    model = _onnx_model(block, batch)

    with tempfile.TemporaryDirectory(prefix="mfl-quantum-directml-") as temporary:
        directory = Path(temporary)
        cpu = _profiled_run(model, initial, "CPUExecutionProvider", None, repeats, directory)
        attempts = []
        for device_id in range(2):
            try:
                attempts.append(_profiled_run(model, initial, "DmlExecutionProvider", device_id, repeats, directory))
            except Exception as exc:
                attempts.append({"deviceId": device_id, "error": f"{type(exc).__name__}: {exc}"})
    working = [item for item in attempts if item.get("output") is not None and "DmlExecutionProvider" in item.get("profiledNodeProviders", [])]
    if not working:
        raise RuntimeError(f"No GPU adapter executed the quantum graph: {attempts}")
    gpu = min(working, key=lambda item: item["medianMs"])

    cpu_complex = cpu["output"][:dimension] + 1j * cpu["output"][dimension:]
    gpu_complex = gpu["output"][:dimension] + 1j * gpu["output"][dimension:]
    cpu_state, gpu_state = cpu_complex[:, 0], gpu_complex[:, 0]
    absolute_error = float(np.max(np.abs(cpu_state - gpu_state)))
    relative_error = absolute_error / (float(np.max(np.abs(cpu_state))) or 1.0)
    overlap = np.vdot(cpu_state, gpu_state)
    fidelity = float(abs(overlap) ** 2 / max(float(np.vdot(cpu_state, cpu_state).real * np.vdot(gpu_state, gpu_state).real), 1e-20))
    norm = float(np.sum(np.abs(gpu_state) ** 2))
    probabilities = np.abs(gpu_state) ** 2
    probabilities = (1.0 - noise) * probabilities + noise / dimension
    probabilities /= probabilities.sum()
    cpu_probabilities = np.abs(cpu_state) ** 2
    visible = sorted(np.argsort(probabilities)[-min(64, dimension):].tolist())
    data = [{"x": index, "primary": float(cpu_probabilities[index]), "secondary": float(probabilities[index])} for index in visible]
    rng = np.random.default_rng(73)
    sampled = rng.multinomial(shots, probabilities)
    top_outcomes = sorted(((int(count), index) for index, count in enumerate(sampled) if count), reverse=True)[:12]
    speedup = cpu["medianMs"] / gpu["medianMs"]
    cloud_demo = _cloud_demo(shots) if preset == "grover2" else None
    return {
        "kind": "gpu-quantum-statevector",
        "xLabel": "computational basis index",
        "yLabel": "probability",
        "primaryLabel": "CPU exact state vector",
        "secondaryLabel": "DirectML GPU state vector",
        "data": data,
        "metrics": [["CPU median", cpu["medianMs"], "ms"], ["DirectML median", gpu["medianMs"], "ms"],
                    ["speedup", speedup, "x"], ["CPU/GPU fidelity", fidelity, ""]],
        "state": {
            "supported": True, "preset": preset, "qubits": qubits, "dimension": dimension,
            "circuitBatch": batch, "gateCount": len(gates), "gates": gates, "shots": shots,
            "measurementNoise": noise, "selectedDeviceId": gpu["deviceId"],
            "cpuMedianMs": cpu["medianMs"], "gpuMedianMs": gpu["medianMs"], "speedup": speedup,
            "gpuNodeProviderConfirmed": True, "maxRelativeError": relative_error,
            "fidelity": fidelity, "normalizationError": abs(norm - 1.0),
            "topOutcomes": [{"basis": format(index, f"0{qubits}b"), "count": count,
                             "probability": float(probabilities[index])} for count, index in top_outcomes],
            "cloudHardwareDemo": cloud_demo,
            "adapterAttempts": [{key: value for key, value in item.items() if key != "output"} for item in attempts],
        },
        "backendHint": "Exact noiseless state-vector evolution executed as a dense real-block unitary on DirectML; measurements are sampled locally.",
        "provenance": {
            "engine": capability["engine"], "onnxRuntime": capability["onnxRuntime"],
            "scientificPackage": True, "gpuExecutionConfirmedByProfile": True,
            "profiledNodeProvider": "DmlExecutionProvider", "validatedExternalSimulation": False,
            "precision": "float32", "randomSeed": 73,
            "limitations": "Custom ideal state-vector simulator, not physical quantum hardware. Dense-unitary memory scales as O(4^n), so the local mode is capped at 10 qubits. Noise is an optional measurement-mixture model, not device calibration.",
        },
    }
