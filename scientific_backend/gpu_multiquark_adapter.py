"""DirectML accelerator for the multi-quark decay-threshold stage."""

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
    return {
        "available": "DmlExecutionProvider" in providers,
        "engine": "onnxruntime-directml-multiquark-threshold",
        "onnxRuntime": ort.__version__,
        "providers": providers,
        "kernel": "batched decay-threshold margins",
    }


def _model(work_items: int) -> bytes:
    features = helper.make_tensor_value_info("features", TensorProto.FLOAT, [work_items, 3])
    margins = helper.make_tensor_value_info("margins", TensorProto.FLOAT, [work_items, 1])
    weights = np.asarray([[-1.0], [1.0], [0.0]], dtype=np.float32)
    graph = helper.make_graph(
        [helper.make_node("MatMul", ["features", "weights"], ["margins"], name="decay_threshold_margin")],
        "directml_multiquark_threshold",
        [features], [margins], [numpy_helper.from_array(weights, "weights")],
    )
    model = helper.make_model(graph, producer_name="Matter Frontier Lab", opset_imports=[helper.make_opsetid("", 20)])
    model.ir_version = 10
    onnx.checker.check_model(model)
    return model.SerializeToString()


def _run(model: bytes, features: np.ndarray, provider: str, device_id: int | None,
         repeats: int, directory: Path) -> dict[str, Any]:
    options = ort.SessionOptions()
    options.enable_mem_pattern = False
    options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    options.enable_profiling = True
    options.profile_file_prefix = str(directory / f"multiquark-{provider}-{device_id}")
    providers: list[Any] = ["CPUExecutionProvider"]
    if provider == "DmlExecutionProvider":
        providers = [("DmlExecutionProvider", {"device_id": device_id or 0}), "CPUExecutionProvider"]
    session = ort.InferenceSession(model, sess_options=options, providers=providers)
    session.run(None, {"features": features})
    durations: list[float] = []
    output = None
    for _ in range(repeats):
        started = time.perf_counter()
        output = session.run(None, {"features": features})[0]
        durations.append((time.perf_counter() - started) * 1000.0)
    events = json.loads(Path(session.end_profiling()).read_text(encoding="utf-8"))
    node_providers = sorted({
        str(event.get("args", {}).get("provider"))
        for event in events
        if event.get("name", "").endswith("_kernel_time") and event.get("args", {}).get("provider")
    })
    return {"deviceId": device_id, "medianMs": statistics.median(durations),
            "minimumMs": min(durations), "profiledNodeProviders": node_providers, "output": output}


def evaluate(candidates: list[dict[str, Any]], search_budget: int, repeats: int = 4) -> dict[str, Any]:
    capability = status()
    if not capability["available"]:
        raise RuntimeError("DmlExecutionProvider is not available")
    if not candidates:
        raise ValueError("at least one candidate is required")
    work_items = max(len(candidates), min(int(search_budget), 1_000_000))
    base = np.asarray([[row["energyMeV"], row["thresholdMeV"], row["uncertaintyMeV"]]
                       for row in candidates], dtype=np.float32)
    indices = np.arange(work_items, dtype=np.int64) % len(candidates)
    features = np.ascontiguousarray(base[indices])
    model = _model(work_items)
    repeats = max(2, min(int(repeats), 12))
    with tempfile.TemporaryDirectory(prefix="mfl-multiquark-directml-") as temporary:
        directory = Path(temporary)
        cpu = _run(model, features, "CPUExecutionProvider", None, repeats, directory)
        attempts = []
        for device_id in range(2):
            try:
                attempts.append(_run(model, features, "DmlExecutionProvider", device_id, repeats, directory))
            except Exception as exc:
                attempts.append({"deviceId": device_id, "error": f"{type(exc).__name__}: {exc}"})
    working = [item for item in attempts if item.get("output") is not None and "DmlExecutionProvider" in item.get("profiledNodeProviders", [])]
    if not working:
        raise RuntimeError(f"No GPU adapter executed the multiquark threshold graph: {attempts}")
    gpu = min(working, key=lambda item: item["medianMs"])
    absolute_error = float(np.max(np.abs(cpu["output"] - gpu["output"])))
    reference = float(np.max(np.abs(cpu["output"]))) or 1.0
    return {
        "margins": [float(value) for value in gpu["output"][:len(candidates), 0]],
        "engine": capability["engine"],
        "workItems": work_items,
        "cpuMedianMs": cpu["medianMs"],
        "gpuMedianMs": gpu["medianMs"],
        "speedup": cpu["medianMs"] / gpu["medianMs"],
        "selectedDeviceId": gpu["deviceId"],
        "gpuNodeProviderConfirmed": True,
        "maxRelativeError": absolute_error / reference,
        "measured": True,
        "adapterAttempts": [{key: value for key, value in item.items() if key != "output"} for item in attempts],
        "limitations": "DirectML accelerates the repeated threshold-margin kernel; candidate construction, symmetry algebra and ranking remain on the CPU.",
    }
