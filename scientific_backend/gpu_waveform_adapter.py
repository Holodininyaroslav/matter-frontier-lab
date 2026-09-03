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


def _model() -> bytes:
    """Build the reusable quadrupole strain algebra h=A f^(2/3) cos(phi)."""
    frequency = helper.make_tensor_value_info("frequency", TensorProto.FLOAT, [None, None])
    phase = helper.make_tensor_value_info("phase", TensorProto.FLOAT, [None, None])
    amplitude = helper.make_tensor_value_info("amplitude", TensorProto.FLOAT, [None, 1])
    output = helper.make_tensor_value_info("strain", TensorProto.FLOAT, [None, None])
    exponent = numpy_helper.from_array(np.asarray([2.0 / 3.0], dtype=np.float32), "two_thirds")
    nodes = [
        helper.make_node("Pow", ["frequency", "two_thirds"], ["frequency_23"], name="quadrupole_frequency_power"),
        helper.make_node("Cos", ["phase"], ["phase_cosine"], name="wave_phase"),
        helper.make_node("Mul", ["amplitude", "frequency_23"], ["envelope"], name="strain_envelope"),
        helper.make_node("Mul", ["envelope", "phase_cosine"], ["strain"], name="polarisation_strain"),
    ]
    graph = helper.make_graph(nodes, "directml_waveform_ensemble", [frequency, phase, amplitude], [output], [exponent])
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


def _run(
    model: bytes,
    feeds: dict[str, np.ndarray],
    provider: str,
    device_id: int | None,
    repeats: int,
    directory: Path,
) -> dict[str, Any]:
    session = _session(model, provider, device_id, directory / f"wave-{provider}-{device_id}")
    for _ in range(3):
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


def status() -> dict[str, Any]:
    providers = ort.get_available_providers()
    return {
        "available": "DmlExecutionProvider" in providers,
        "engine": "onnxruntime-directml-waveform-ensemble",
        "onnxRuntime": ort.__version__,
        "providers": providers,
        "kernel": "h=A f^(2/3) cos(phi)",
    }


def solve(values: dict[str, Any]) -> dict[str, Any]:
    capability = status()
    if not capability["available"]:
        raise RuntimeError("DmlExecutionProvider is not available")
    systems = max(64, min(int(values.get("waveformSystems", 2048)), 4096))
    samples = max(256, min(int(values.get("waveformSamples", 2048)), 4096))
    repeats = max(3, min(int(values.get("benchmarkRepeats", 8)), 30))
    adapter_count = max(1, min(int(values.get("adapterCount", 2)), 4))

    # A deterministic ensemble of nearby compact-binary configurations.  The
    # inspiral trajectory itself is prepared by the physical CPU solver; this
    # kernel accelerates the large, independent strain evaluation stage.
    frequency_axis = np.geomspace(20.0, 512.0, samples, dtype=np.float32)
    system_scale = np.linspace(0.82, 1.18, systems, dtype=np.float32)[:, None]
    frequency = np.ascontiguousarray(system_scale * frequency_axis[None, :], dtype=np.float32)
    phase_axis = np.linspace(0.0, 320.0 * math.pi, samples, dtype=np.float32)
    phase = np.ascontiguousarray(phase_axis[None, :] / np.sqrt(system_scale), dtype=np.float32)
    amplitude = np.ascontiguousarray((1.0e-22 * system_scale ** (5.0 / 3.0)).astype(np.float32))
    feeds = {"frequency": frequency, "phase": phase, "amplitude": amplitude}
    model = _model()

    with tempfile.TemporaryDirectory(prefix="mfl-wave-directml-") as temporary:
        directory = Path(temporary)
        cpu = _run(model, feeds, "CPUExecutionProvider", None, repeats, directory)
        attempts: list[dict[str, Any]] = []
        for device_id in range(adapter_count):
            try:
                attempts.append(_run(model, feeds, "DmlExecutionProvider", device_id, repeats, directory))
            except Exception as exc:
                attempts.append({"provider": "DmlExecutionProvider", "deviceId": device_id, "error": f"{type(exc).__name__}: {exc}"})

    working = [item for item in attempts if item.get("output") is not None and "DmlExecutionProvider" in item["profiledNodeProviders"]]
    if not working:
        raise RuntimeError(f"No DirectML adapter executed the waveform graph: {attempts}")
    gpu = min(working, key=lambda item: item["medianMs"])
    absolute_error = float(np.max(np.abs(cpu["output"] - gpu["output"])))
    scale = float(np.max(np.abs(cpu["output"]))) or 1.0
    relative_error = absolute_error / scale
    speedup = cpu["medianMs"] / gpu["medianMs"]
    sample_indices = np.linspace(0, samples - 1, min(samples, 120), dtype=np.int32)
    data = [
        {
            "x": float(frequency[0, index]),
            "primary": float(cpu["output"][0, index]),
            "secondary": float(gpu["output"][0, index]),
        }
        for index in sample_indices
    ]
    operation_count = float(systems * samples * 6)
    return {
        "kind": "gpu-waveform-ensemble",
        "xLabel": "GW frequency, Hz",
        "yLabel": "strain h",
        "primaryLabel": "NumPy/ONNX CPU reference",
        "secondaryLabel": "DirectML waveform ensemble",
        "data": data,
        "metrics": [["CPU median", cpu["medianMs"], "ms"], ["DirectML median", gpu["medianMs"], "ms"], ["speedup", speedup, "x"]],
        "state": {
            "supported": True,
            "systems": systems,
            "samplesPerSystem": samples,
            "evaluatedSamples": systems * samples,
            "estimatedOperations": operation_count,
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
        "backendHint": "Physical quadrupole strain algebra evaluated as a large independent ensemble on DirectML.",
        "provenance": {
            "engine": "onnxruntime-directml-waveform-ensemble",
            "onnxRuntime": capability["onnxRuntime"],
            "scientificPackage": True,
            "model": "leading-order quadrupole strain algebra",
            "gpuExecutionConfirmedByProfile": True,
            "profiledNodeProvider": "DmlExecutionProvider",
            "validatedExternalSimulation": False,
            "limitations": "DirectML accelerates the batched strain algebra, not LALSuite waveform generation or numerical-relativity spacetime evolution.",
        },
    }
