from __future__ import annotations

import json
import platform
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
        "engine": "onnxruntime-directml",
        "onnxRuntime": ort.__version__,
        "providers": providers,
        "platform": platform.platform(),
    }


def _hamiltonian_model(size: int, batch: int, seed: int) -> bytes:
    rng = np.random.default_rng(seed)
    diagonal = np.linspace(-2.0, 2.0, size, dtype=np.float32)
    coupling = rng.normal(0.0, 0.015, (size, size)).astype(np.float32)
    hamiltonian = (coupling + coupling.T) * np.float32(0.5)
    hamiltonian[np.diag_indices(size)] += diagonal
    state = helper.make_tensor_value_info("psi", TensorProto.FLOAT, [size, batch])
    output = helper.make_tensor_value_info("h_psi", TensorProto.FLOAT, [size, batch])
    node = helper.make_node("MatMul", ["hamiltonian", "psi"], ["h_psi"], name="dense_hamiltonian_action")
    graph = helper.make_graph([node], "directml_scientific_block", [state], [output], [numpy_helper.from_array(hamiltonian, "hamiltonian")])
    model = helper.make_model(graph, producer_name="Matter Frontier Lab", opset_imports=[helper.make_opsetid("", 20)])
    model.ir_version = 10
    onnx.checker.check_model(model)
    return model.SerializeToString()


def _session(model: bytes, provider: str, device_id: int | None, profile_prefix: Path) -> ort.InferenceSession:
    options = ort.SessionOptions()
    options.enable_mem_pattern = False
    options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    options.enable_profiling = True
    options.profile_file_prefix = str(profile_prefix)
    providers: list[Any] = ["CPUExecutionProvider"]
    if provider == "DmlExecutionProvider":
        providers = [("DmlExecutionProvider", {"device_id": device_id or 0}), "CPUExecutionProvider"]
    return ort.InferenceSession(model, sess_options=options, providers=providers)


def _profiled_run(model: bytes, states: np.ndarray, provider: str, device_id: int | None, repeats: int, directory: Path) -> dict[str, Any]:
    prefix = directory / f"profile-{provider}-{device_id if device_id is not None else 'cpu'}"
    session = _session(model, provider, device_id, prefix)
    for _ in range(3):
        session.run(None, {"psi": states})
    durations = []
    output = None
    for _ in range(repeats):
        started = time.perf_counter()
        output = session.run(None, {"psi": states})[0]
        durations.append((time.perf_counter() - started) * 1000.0)
    profile_path = Path(session.end_profiling())
    events = json.loads(profile_path.read_text(encoding="utf-8"))
    node_providers = sorted({
        str(event.get("args", {}).get("provider"))
        for event in events
        if event.get("name", "").endswith("_kernel_time") and event.get("args", {}).get("provider")
    })
    return {
        "provider": provider,
        "deviceId": device_id,
        "sessionProviders": session.get_providers(),
        "profiledNodeProviders": node_providers,
        "medianMs": statistics.median(durations),
        "minimumMs": min(durations),
        "output": output,
    }


def solve(values: dict[str, Any]) -> dict[str, Any]:
    capability = status()
    if not capability["available"]:
        raise RuntimeError("DmlExecutionProvider is not available")
    size = max(256, min(int(values.get("matrixSize", 3072)), 4096))
    batch = max(16, min(int(values.get("stateBatch", 384)), 512))
    repeats = max(3, min(int(values.get("benchmarkRepeats", 8)), 30))
    seed = max(1, int(values.get("benchmarkSeed", 17)))
    adapter_count = max(1, min(int(values.get("adapterCount", 2)), 4))
    rng = np.random.default_rng(seed + 1)
    states = rng.normal(0.0, 1.0 / np.sqrt(size), (size, batch)).astype(np.float32)
    model = _hamiltonian_model(size, batch, seed)
    with tempfile.TemporaryDirectory(prefix="mfl-directml-") as temporary:
        directory = Path(temporary)
        cpu = _profiled_run(model, states, "CPUExecutionProvider", None, repeats, directory)
        attempts = []
        for device_id in range(adapter_count):
            try:
                attempts.append(_profiled_run(model, states, "DmlExecutionProvider", device_id, repeats, directory))
            except Exception as exc:
                attempts.append({"provider": "DmlExecutionProvider", "deviceId": device_id, "error": f"{type(exc).__name__}: {exc}"})
    working = [attempt for attempt in attempts if "output" in attempt and "DmlExecutionProvider" in attempt["profiledNodeProviders"]]
    if not working:
        raise RuntimeError(f"No GPU adapter executed MatMul through DirectML: {attempts}")
    gpu = min(working, key=lambda item: item["medianMs"])
    absolute_error = float(np.max(np.abs(cpu["output"] - gpu["output"])))
    reference_scale = float(np.max(np.abs(cpu["output"]))) or 1.0
    relative_error = absolute_error / reference_scale
    speedup = cpu["medianMs"] / gpu["medianMs"]
    operation_count = 2.0 * size * size * batch
    samples = min(100, batch)
    data = [
        {"x": index, "primary": float(cpu["output"][index % size, index % batch]), "secondary": float(gpu["output"][index % size, index % batch])}
        for index in range(samples)
    ]
    return {
        "kind": "gpu-scientific-benchmark",
        "xLabel": "sample index",
        "yLabel": "H psi component",
        "primaryLabel": "ONNX Runtime CPU",
        "secondaryLabel": "ONNX Runtime DirectML",
        "data": data,
        "metrics": [["CPU median", cpu["medianMs"], "ms"], ["DirectML median", gpu["medianMs"], "ms"], ["speedup", speedup, "x"]],
        "state": {
            "supported": True,
            "matrixSize": size,
            "stateBatch": batch,
            "floatingPointOperations": operation_count,
            "selectedDeviceId": gpu["deviceId"],
            "cpuMedianMs": cpu["medianMs"],
            "gpuMedianMs": gpu["medianMs"],
            "speedup": speedup,
            "gpuFaster": speedup > 1.0,
            "maxAbsoluteError": absolute_error,
            "maxRelativeError": relative_error,
            "gpuNodeProviderConfirmed": True,
            "adapterAttempts": [{key: value for key, value in attempt.items() if key != "output"} for attempt in attempts],
        },
        "backendHint": "Dense Hamiltonian action Y=H psi executed through ONNX Runtime DirectML on the fastest working DirectX 12 adapter.",
        "provenance": {
            "engine": "onnxruntime-directml",
            "onnxRuntime": capability["onnxRuntime"],
            "scientificPackage": True,
            "validatedExternalSimulation": False,
            "gpuExecutionConfirmedByProfile": True,
            "profiledNodeProvider": "DmlExecutionProvider",
            "limitations": "This validates a reusable dense linear-algebra block. Small jobs can be slower on DirectML because of dispatch and transfer overhead. It does not automatically move Geant4, PYTHIA, nuSQuIDS, PyCBC or Einstein Toolkit onto the GPU.",
        },
    }
