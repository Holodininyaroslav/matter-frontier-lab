from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path
from typing import Any


WSL_DISTRIBUTION = os.environ.get("MFL_PYCBC_WSL_DISTRO", "Ubuntu")
WSL_PYTHON = os.environ.get("MFL_PYCBC_PYTHON", "/root/.matter-frontier-lab/pycbc-venv/bin/python")
WORKER = Path(__file__).resolve().with_name("pycbc_worker.py")
_STATUS_CACHE: tuple[float, dict[str, Any]] | None = None


def _wsl_path(path: Path) -> str:
    resolved = path.resolve()
    drive = resolved.drive.rstrip(":").lower()
    tail = resolved.as_posix().split(":", 1)[-1]
    return f"/mnt/{drive}{tail}"


def _command(*arguments: str) -> list[str]:
    return ["wsl.exe", "-d", WSL_DISTRIBUTION, "--", WSL_PYTHON, *arguments]


def status(force: bool = False) -> dict[str, Any]:
    global _STATUS_CACHE
    now = time.monotonic()
    if not force and _STATUS_CACHE is not None and now - _STATUS_CACHE[0] < 60.0:
        return _STATUS_CACHE[1]
    try:
        completed = subprocess.run(
            _command("-c", "import json, pycbc, lal; print(json.dumps({'available': True, 'engine': 'pycbc-lalsuite-wsl', 'pycbc': pycbc.__version__, 'lal': lal.__version__}))"),
            check=True,
            capture_output=True,
            text=True,
            timeout=20,
        )
        result = json.loads(completed.stdout.strip())
    except Exception as exc:
        result = {"available": False, "engine": "pycbc-lalsuite-wsl", "error": f"{type(exc).__name__}: {exc}"}
    _STATUS_CACHE = (now, result)
    return result


def solve(values: dict[str, Any]) -> dict[str, Any]:
    completed = subprocess.run(
        _command(_wsl_path(WORKER)),
        input=json.dumps({"values": values}, ensure_ascii=False),
        check=True,
        capture_output=True,
        text=True,
        timeout=120,
    )
    payload = json.loads(completed.stdout)
    if not payload.get("ok"):
        raise RuntimeError(payload.get("error", "PyCBC worker failed"))
    return payload["result"]
