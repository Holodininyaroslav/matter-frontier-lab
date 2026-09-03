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
        "engine": "onnxruntime-directml-fdtd-wave",
        "onnxRuntime": ort.__version__,
        "providers": providers,
        "equation": "u_tt + gamma*u_t = c^2*(u_xx + u_yy)",
        "scheme": "second-order centred finite differences",
    }


def _model(grid: int, steps: int, courant: float, damping: float) -> bytes:
    current = helper.make_tensor_value_info("u_current", TensorProto.FLOAT, [1, 1, grid, grid])
    previous = helper.make_tensor_value_info("u_previous", TensorProto.FLOAT, [1, 1, grid, grid])
    output = helper.make_tensor_value_info("u_final", TensorProto.FLOAT, [1, 1, grid, grid])
    laplacian = np.asarray(
        [[[[0.0, 1.0, 0.0], [1.0, -4.0, 1.0], [0.0, 1.0, 0.0]]]],
        dtype=np.float32,
    )
    initializers = [
        numpy_helper.from_array(laplacian, "laplacian_kernel"),
        numpy_helper.from_array(np.asarray([2.0 - damping], dtype=np.float32), "two_minus_damping"),
        numpy_helper.from_array(np.asarray([1.0 - damping], dtype=np.float32), "one_minus_damping"),
        numpy_helper.from_array(np.asarray([courant * courant], dtype=np.float32), "courant_squared"),
    ]
    nodes: list[Any] = []
    old_name = "u_previous"
    now_name = "u_current"
    for index in range(steps):
        lap = f"lap_{index}"
        now_scaled = f"now_scaled_{index}"
        old_scaled = f"old_scaled_{index}"
        inertial = f"inertial_{index}"
        propagation = f"propagation_{index}"
        next_name = "u_final" if index == steps - 1 else f"u_step_{index + 1}"
        nodes.extend(
            [
                helper.make_node("Conv", [now_name, "laplacian_kernel"], [lap], pads=[1, 1, 1, 1], name=f"laplacian_{index}"),
                helper.make_node("Mul", [now_name, "two_minus_damping"], [now_scaled], name=f"current_term_{index}"),
                helper.make_node("Mul", [old_name, "one_minus_damping"], [old_scaled], name=f"previous_term_{index}"),
                helper.make_node("Sub", [now_scaled, old_scaled], [inertial], name=f"time_update_{index}"),
                helper.make_node("Mul", [lap, "courant_squared"], [propagation], name=f"space_update_{index}"),
                helper.make_node("Add", [inertial, propagation], [next_name], name=f"wave_step_{index}"),
            ]
        )
        old_name, now_name = now_name, next_name
    graph = helper.make_graph(nodes, "directml_fdtd_wave", [current, previous], [output], initializers)
    model = helper.make_model(graph, producer_name="Matter Frontier Lab", opset_imports=[helper.make_opsetid("", 20)])
    model.ir_version = 10
    onnx.checker.check_model(model)
    return model.SerializeToString()


def _session(model: bytes, provider: str, device_id: int | None, prefix: Path) -> ort.InferenceSession:
    options = ort.SessionOptions()
    options.enable_mem_pattern = False
    options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    options.enable_profiling = True
    options.profile_file_prefix = str(prefix)
    providers: list[Any] = ["CPUExecutionProvider"]
    if provider == "DmlExecutionProvider":
        providers = [("DmlExecutionProvider", {"device_id": device_id or 0}), "CPUExecutionProvider"]
    return ort.InferenceSession(model, sess_options=options, providers=providers)


def _profiled_run(
    model: bytes,
    feeds: dict[str, np.ndarray],
    provider: str,
    device_id: int | None,
    repeats: int,
    directory: Path,
) -> dict[str, Any]:
    session = _session(model, provider, device_id, directory / f"fdtd-{provider}-{device_id}")
    session.run(None, feeds)
    durations: list[float] = []
    output: np.ndarray | None = None
    for _ in range(repeats):
        started = time.perf_counter()
        output = session.run(None, feeds)[0]
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
    grid = max(64, min(int(values.get("waveGrid", 768)), 1536))
    steps = max(4, min(int(values.get("waveSteps", 24)), 64))
    requested_courant = float(values.get("waveCourant", 0.62))
    if requested_courant * requested_courant > 0.5:
        raise ValueError("2D finite-difference stability requires Courant^2 <= 0.5")
    courant = max(0.05, requested_courant)
    damping = max(0.0, min(float(values.get("waveDamping", 0.004)), 0.05))
    repeats = max(3, min(int(values.get("benchmarkRepeats", 5)), 15))
    adapter_count = max(1, min(int(values.get("adapterCount", 2)), 4))
    coordinate = np.linspace(-1.0, 1.0, grid, dtype=np.float32)
    xx, yy = np.meshgrid(coordinate, coordinate, indexing="xy")
    radius2 = xx * xx + yy * yy
    pulse = np.exp(-radius2 / np.float32(0.012)) * np.cos(np.float32(30.0) * np.sqrt(radius2 + np.float32(1e-12)))
    current = np.ascontiguousarray(pulse[None, None, :, :], dtype=np.float32)
    previous = np.ascontiguousarray(current * np.float32(0.997), dtype=np.float32)
    feeds = {"u_current": current, "u_previous": previous}
    model = _model(grid, steps, courant, damping)

    with tempfile.TemporaryDirectory(prefix="mfl-fdtd-directml-") as temporary:
        directory = Path(temporary)
        cpu = _profiled_run(model, feeds, "CPUExecutionProvider", None, repeats, directory)
        attempts: list[dict[str, Any]] = []
        for device_id in range(adapter_count):
            try:
                attempts.append(_profiled_run(model, feeds, "DmlExecutionProvider", device_id, repeats, directory))
            except Exception as exc:
                attempts.append({"provider": "DmlExecutionProvider", "deviceId": device_id, "error": f"{type(exc).__name__}: {exc}"})
    working = [attempt for attempt in attempts if attempt.get("output") is not None and "DmlExecutionProvider" in attempt["profiledNodeProviders"]]
    if not working:
        raise RuntimeError(f"No DirectML adapter executed the FDTD graph: {attempts}")
    gpu = min(working, key=lambda item: item["medianMs"])
    absolute_error = float(np.max(np.abs(cpu["output"] - gpu["output"])))
    reference_scale = float(np.max(np.abs(cpu["output"]))) or 1.0
    relative_error = absolute_error / reference_scale
    speedup = cpu["medianMs"] / gpu["medianMs"]
    centre = grid // 2
    sample_indices = np.linspace(0, grid - 1, min(grid, 180), dtype=np.int32)
    data = [
        {
            "x": float(coordinate[index]),
            "primary": float(cpu["output"][0, 0, centre, index]),
            "secondary": float(gpu["output"][0, 0, centre, index]),
        }
        for index in sample_indices
    ]
    return {
        "kind": "gpu-fdtd-wave",
        "xLabel": "normalised x",
        "yLabel": "field amplitude u",
        "primaryLabel": "ONNX CPU finite differences",
        "secondaryLabel": "DirectML finite differences",
        "data": data,
        "metrics": [["CPU median", cpu["medianMs"], "ms"], ["DirectML median", gpu["medianMs"], "ms"], ["speedup", speedup, "x"]],
        "state": {
            "supported": True,
            "grid": [grid, grid],
            "timeSteps": steps,
            "courant": courant,
            "damping": damping,
            "stableDiscretisation": True,
            "updatedCells": grid * grid * steps,
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
        "backendHint": "Second-order 2D finite-difference wave evolution executed as an unrolled DirectML graph.",
        "provenance": {
            "engine": "onnxruntime-directml-fdtd-wave",
            "onnxRuntime": capability["onnxRuntime"],
            "scientificPackage": True,
            "equation": capability["equation"],
            "numericalMethod": capability["scheme"],
            "gpuExecutionConfirmedByProfile": True,
            "profiledNodeProvider": "DmlExecutionProvider",
            "validatedExternalSimulation": False,
            "limitations": "Scalar linear 2D wave equation on a fixed grid; this is not a solution of the nonlinear Einstein field equations or numerical relativity.",
        },
    }
