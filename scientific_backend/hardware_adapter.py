from __future__ import annotations

import json
import platform
import subprocess
from typing import Any

_CACHE: dict[str, Any] | None = None

def status(force: bool = False) -> dict[str, Any]:
    global _CACHE
    if _CACHE is not None and not force:
        return _CACHE
    result: dict[str, Any] = {"platform": platform.platform(), "scientificCompute": "cpu"}
    if platform.system() != "Windows":
        _CACHE = result
        return result
    command = (
        "Get-CimInstance Win32_VideoController | "
        "Select-Object Name,AdapterRAM,DriverVersion | ConvertTo-Json -Compress"
    )
    try:
        completed = subprocess.run(
            ["powershell.exe", "-NoProfile", "-Command", command], check=True,
            capture_output=True, text=True, timeout=20,
        )
        decoded = json.loads(completed.stdout)
        adapters = decoded if isinstance(decoded, list) else [decoded]
        result["displayAdapters"] = adapters
        names = [str(adapter.get("Name", "")) for adapter in adapters]
        rx5500m = any("RX 5500M" in name.upper() for name in names)
        result["cudaAvailable"] = any("NVIDIA" in name.upper() for name in names)
        result["rocmOfficiallySupported"] = False if rx5500m else None
        result["gpuPolicy"] = (
            "Radeon RX 5500M is not in AMD's supported ROCm/WSL matrix. Existing external solvers remain on CPU, while explicitly ported dense kernels can use ONNX Runtime DirectML and WebGL uses the GPU."
            if rx5500m else "No supported scientific GPU runtime was configured."
        )
    except Exception as exc:
        result["hardwareDetectionError"] = f"{type(exc).__name__}: {exc}"
    _CACHE = result
    return result
