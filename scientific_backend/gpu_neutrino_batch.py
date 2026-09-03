from __future__ import annotations

import json
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
    return {"available": "DmlExecutionProvider" in providers, "engine": "onnxruntime-directml-neutrino-batch", "onnxRuntime": ort.__version__, "providers": providers, "model": "two-flavour vacuum oscillation batch"}


def _model(count: int, theta: float, delta_m2: float) -> bytes:
    energy = helper.make_tensor_value_info("energy_gev", TensorProto.FLOAT, [count])
    baseline = helper.make_tensor_value_info("baseline_km", TensorProto.FLOAT, [count])
    output = helper.make_tensor_value_info("probability", TensorProto.FLOAT, [count])
    amplitude = np.asarray([np.sin(2.0 * theta) ** 2], dtype=np.float32)
    phase_scale = np.asarray([1.267 * delta_m2], dtype=np.float32)
    nodes = [
        helper.make_node("Div", ["baseline_km", "energy_gev"], ["l_over_e"]),
        helper.make_node("Mul", ["l_over_e", "phase_scale"], ["phase"]),
        helper.make_node("Sin", ["phase"], ["sine"]),
        helper.make_node("Mul", ["sine", "sine"], ["sine_squared"]),
        helper.make_node("Mul", ["sine_squared", "amplitude"], ["probability"]),
    ]
    graph = helper.make_graph(nodes, "directml_neutrino_oscillation", [energy, baseline], [output], [numpy_helper.from_array(amplitude, "amplitude"), numpy_helper.from_array(phase_scale, "phase_scale")])
    model = helper.make_model(graph, producer_name="Matter Frontier Lab", opset_imports=[helper.make_opsetid("", 20)])
    model.ir_version = 10
    onnx.checker.check_model(model)
    return model.SerializeToString()


def _run(model: bytes, feeds: dict[str, np.ndarray], provider: str, device_id: int | None, repeats: int, directory: Path) -> dict[str, Any]:
    options = ort.SessionOptions()
    options.enable_mem_pattern = False
    options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    options.enable_profiling = True
    options.profile_file_prefix = str(directory / f"neutrino-{provider}-{device_id}")
    providers: list[Any] = ["CPUExecutionProvider"] if provider == "CPUExecutionProvider" else [("DmlExecutionProvider", {"device_id": device_id or 0}), "CPUExecutionProvider"]
    session = ort.InferenceSession(model, sess_options=options, providers=providers)
    session.run(None, feeds)
    durations: list[float] = []
    result = None
    for _ in range(repeats):
        started = time.perf_counter()
        result = session.run(None, feeds)[0]
        durations.append((time.perf_counter() - started) * 1000.0)
    events = json.loads(Path(session.end_profiling()).read_text(encoding="utf-8"))
    node_providers = sorted({str(event.get("args", {}).get("provider")) for event in events if event.get("name", "").endswith("_kernel_time") and event.get("args", {}).get("provider")})
    return {"deviceId": device_id, "medianMs": statistics.median(durations), "minimumMs": min(durations), "profiledNodeProviders": node_providers, "output": result}


def solve(values: dict[str, Any]) -> dict[str, Any]:
    capability = status()
    if not capability["available"]:
        raise RuntimeError("DmlExecutionProvider is not available")
    count = max(65536, min(int(values.get("neutrinoBatch", 1048576)), 4194304))
    repeats = max(3, min(int(values.get("benchmarkRepeats", 8)), 20))
    theta = float(values.get("mixingAngle", 0.59))
    delta_m2 = max(1e-6, float(values.get("deltaMassSquared", 0.00245)))
    energy = np.linspace(0.2, 20.0, count, dtype=np.float32)
    baseline = np.linspace(10.0, 13000.0, count, dtype=np.float32)
    feeds = {"energy_gev": energy, "baseline_km": baseline}
    model = _model(count, theta, delta_m2)
    with tempfile.TemporaryDirectory(prefix="mfl-neutrino-directml-") as temporary:
        directory = Path(temporary)
        cpu = _run(model, feeds, "CPUExecutionProvider", None, repeats, directory)
        attempts = []
        for device_id in range(2):
            try:
                attempts.append(_run(model, feeds, "DmlExecutionProvider", device_id, repeats, directory))
            except Exception as exc:
                attempts.append({"deviceId": device_id, "error": f"{type(exc).__name__}: {exc}"})
    working = [attempt for attempt in attempts if attempt.get("output") is not None and "DmlExecutionProvider" in attempt.get("profiledNodeProviders", [])]
    if not working:
        raise RuntimeError(f"No DirectML adapter executed the neutrino graph: {attempts}")
    gpu = min(working, key=lambda item: item["medianMs"])
    absolute_error = float(np.max(np.abs(cpu["output"] - gpu["output"])))
    relative_error = absolute_error / (float(np.max(np.abs(cpu["output"]))) or 1.0)
    speedup = cpu["medianMs"] / gpu["medianMs"]
    indices = np.linspace(0, count - 1, 180, dtype=np.int64)
    data = [{"x": float(baseline[i] / energy[i]), "primary": float(cpu["output"][i]), "secondary": float(gpu["output"][i])} for i in indices]
    return {
        "kind": "gpu-neutrino-oscillation-batch", "xLabel": "L/E, km/GeV", "yLabel": "transition probability",
        "primaryLabel": "ONNX CPU oscillation probability", "secondaryLabel": "DirectML oscillation probability", "data": data,
        "metrics": [["CPU median", cpu["medianMs"], "ms"], ["DirectML median", gpu["medianMs"], "ms"], ["speedup", speedup, "x"]],
        "state": {"supported": True, "samples": count, "mixingAngleRad": theta, "deltaMassSquared_eV2": delta_m2, "selectedDeviceId": gpu["deviceId"], "cpuMedianMs": cpu["medianMs"], "gpuMedianMs": gpu["medianMs"], "speedup": speedup, "maxRelativeError": relative_error, "gpuNodeProviderConfirmed": True},
        "backendHint": "Batched standard two-flavour vacuum probability evaluated on DirectML and checked against ONNX CPU.",
        "provenance": {"engine": capability["engine"], "scientificPackage": True, "gpuExecutionConfirmedByProfile": True, "profiledNodeProvider": "DmlExecutionProvider", "validatedExternalSimulation": False, "equation": "P=sin^2(2theta) sin^2(1.267 delta_m^2 L/E)", "limitations": "Two-flavour vacuum approximation. Matter effects, three-flavour evolution, attenuation and regeneration remain in the validated nuSQuIDS CPU adapter."},
    }
