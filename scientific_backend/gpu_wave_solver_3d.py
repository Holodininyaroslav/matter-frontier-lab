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
        "engine": "onnxruntime-directml-fdtd-wave-3d",
        "onnxRuntime": ort.__version__,
        "providers": providers,
        "equation": "u_tt + gamma*u_t = c^2*(u_xx + u_yy + u_zz)",
        "scheme": "second-order centred 3D finite differences",
    }


def _model(grid: int, steps: int, courant: float, damping: float) -> bytes:
    shape = [1, 1, grid, grid, grid]
    current = helper.make_tensor_value_info("u_current", TensorProto.FLOAT, shape)
    previous = helper.make_tensor_value_info("u_previous", TensorProto.FLOAT, shape)
    output = helper.make_tensor_value_info("u_final", TensorProto.FLOAT, shape)
    stencil = np.zeros((1, 1, 3, 3, 3), dtype=np.float32)
    stencil[0, 0, 1, 1, 1] = -6.0
    stencil[0, 0, 0, 1, 1] = stencil[0, 0, 2, 1, 1] = 1.0
    stencil[0, 0, 1, 0, 1] = stencil[0, 0, 1, 2, 1] = 1.0
    stencil[0, 0, 1, 1, 0] = stencil[0, 0, 1, 1, 2] = 1.0
    initializers = [
        numpy_helper.from_array(stencil, "laplacian_kernel"),
        numpy_helper.from_array(np.asarray([2.0 - damping], dtype=np.float32), "two_minus_damping"),
        numpy_helper.from_array(np.asarray([1.0 - damping], dtype=np.float32), "one_minus_damping"),
        numpy_helper.from_array(np.asarray([courant * courant], dtype=np.float32), "courant_squared"),
    ]
    nodes: list[Any] = []
    old_name, now_name = "u_previous", "u_current"
    for index in range(steps):
        lap, now_scaled = f"lap_{index}", f"now_scaled_{index}"
        old_scaled, inertial = f"old_scaled_{index}", f"inertial_{index}"
        propagation = f"propagation_{index}"
        next_name = "u_final" if index == steps - 1 else f"u_step_{index + 1}"
        nodes.extend([
            helper.make_node("Conv", [now_name, "laplacian_kernel"], [lap], pads=[1, 1, 1, 1, 1, 1], name=f"laplacian_{index}"),
            helper.make_node("Mul", [now_name, "two_minus_damping"], [now_scaled]),
            helper.make_node("Mul", [old_name, "one_minus_damping"], [old_scaled]),
            helper.make_node("Sub", [now_scaled, old_scaled], [inertial]),
            helper.make_node("Mul", [lap, "courant_squared"], [propagation]),
            helper.make_node("Add", [inertial, propagation], [next_name]),
        ])
        old_name, now_name = now_name, next_name
    graph = helper.make_graph(nodes, "directml_fdtd_wave_3d", [current, previous], [output], initializers)
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
    options.profile_file_prefix = str(directory / f"fdtd3d-{provider}-{device_id}")
    providers: list[Any] = ["CPUExecutionProvider"]
    if provider == "DmlExecutionProvider":
        providers = [("DmlExecutionProvider", {"device_id": device_id or 0}), "CPUExecutionProvider"]
    session = ort.InferenceSession(model, sess_options=options, providers=providers)
    session.run(None, feeds)
    durations: list[float] = []
    result = None
    for _ in range(repeats):
        started = time.perf_counter()
        result = session.run(None, feeds)[0]
        durations.append((time.perf_counter() - started) * 1000.0)
    profile_path = Path(session.end_profiling())
    events = json.loads(profile_path.read_text(encoding="utf-8"))
    node_providers = sorted({str(event.get("args", {}).get("provider")) for event in events if event.get("name", "").endswith("_kernel_time") and event.get("args", {}).get("provider")})
    return {"provider": provider, "deviceId": device_id, "profiledNodeProviders": node_providers, "medianMs": statistics.median(durations), "minimumMs": min(durations), "output": result}


def solve(values: dict[str, Any]) -> dict[str, Any]:
    capability = status()
    if not capability["available"]:
        raise RuntimeError("DmlExecutionProvider is not available")
    grid = max(32, min(int(values.get("waveGrid3d", 112)), 128))
    steps = max(3, min(int(values.get("waveSteps3d", 12)), 24))
    courant = max(0.05, float(values.get("waveCourant3d", 0.48)))
    if courant * courant > 1.0 / 3.0:
        raise ValueError("3D finite-difference stability requires Courant^2 <= 1/3")
    damping = max(0.0, min(float(values.get("waveDamping3d", 0.004)), 0.05))
    repeats = max(2, min(int(values.get("benchmarkRepeats", 3)), 8))
    coordinate = np.linspace(-1.0, 1.0, grid, dtype=np.float32)
    zz, yy, xx = np.meshgrid(coordinate, coordinate, coordinate, indexing="ij")
    radius2 = xx * xx + yy * yy + zz * zz
    pulse = np.exp(-radius2 / np.float32(0.035)) * np.cos(np.float32(22.0) * np.sqrt(radius2 + np.float32(1e-12)))
    current = np.ascontiguousarray(pulse[None, None], dtype=np.float32)
    feeds = {"u_current": current, "u_previous": np.ascontiguousarray(current * np.float32(0.997))}
    model = _model(grid, steps, courant, damping)
    with tempfile.TemporaryDirectory(prefix="mfl-fdtd3d-") as temporary:
        directory = Path(temporary)
        cpu = _run(model, feeds, "CPUExecutionProvider", None, repeats, directory)
        attempts = []
        for device_id in range(2):
            try:
                attempts.append(_run(model, feeds, "DmlExecutionProvider", device_id, repeats, directory))
            except Exception as exc:
                attempts.append({"provider": "DmlExecutionProvider", "deviceId": device_id, "error": f"{type(exc).__name__}: {exc}"})
    working = [attempt for attempt in attempts if attempt.get("output") is not None and "DmlExecutionProvider" in attempt.get("profiledNodeProviders", [])]
    if not working:
        raise RuntimeError(f"No DirectML adapter executed the 3D stencil graph: {attempts}")
    gpu = min(working, key=lambda item: item["medianMs"])
    absolute_error = float(np.max(np.abs(cpu["output"] - gpu["output"])))
    relative_error = absolute_error / (float(np.max(np.abs(cpu["output"]))) or 1.0)
    speedup = cpu["medianMs"] / gpu["medianMs"]
    centre = grid // 2
    sample_indices = np.linspace(0, grid - 1, min(grid, 128), dtype=np.int32)
    data = [{"x": float(coordinate[i]), "primary": float(cpu["output"][0, 0, centre, centre, i]), "secondary": float(gpu["output"][0, 0, centre, centre, i])} for i in sample_indices]
    return {
        "kind": "gpu-fdtd-wave-3d", "xLabel": "normalised x through volume", "yLabel": "field amplitude u",
        "primaryLabel": "3D ONNX CPU finite differences", "secondaryLabel": "3D DirectML finite differences", "data": data,
        "metrics": [["CPU median", cpu["medianMs"], "ms"], ["DirectML median", gpu["medianMs"], "ms"], ["speedup", speedup, "x"]],
        "state": {"supported": True, "grid": [grid, grid, grid], "timeSteps": steps, "updatedVoxels": grid ** 3 * steps, "selectedDeviceId": gpu["deviceId"], "cpuMedianMs": cpu["medianMs"], "gpuMedianMs": gpu["medianMs"], "speedup": speedup, "maxRelativeError": relative_error, "gpuNodeProviderConfirmed": True},
        "backendHint": "Second-order 3D scalar-wave evolution executed as an unrolled DirectML graph.",
        "provenance": {"engine": capability["engine"], "scientificPackage": True, "gpuExecutionConfirmedByProfile": True, "profiledNodeProvider": "DmlExecutionProvider", "validatedExternalSimulation": False, "numericalMethod": capability["scheme"], "limitations": "Linear scalar 3D field on a fixed Cartesian grid; not Einstein-field evolution, numerical relativity or GRMHD."},
    }
