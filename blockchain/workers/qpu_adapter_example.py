"""Loopback QPU-adapter example for Matter Frontier Discovery Chain.

The adapter deliberately keeps provider credentials outside Frontier Lab.  This
reference implementation uses the project's DirectML state-vector simulator,
so it is a transport/provenance demonstration and not physical QPU execution.
Replace ``execute_probe`` with a provider SDK call while preserving the JSON
contract and honest backend metadata.
"""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scientific_backend.gpu_quantum_simulator import solve as solve_quantum  # noqa: E402


SCHEMA = "matter-frontier.qpu-adapter/v1"


def execute_probe(payload: dict[str, Any]) -> dict[str, Any]:
    if payload.get("schema") != SCHEMA:
        raise ValueError(f"schema must be {SCHEMA}")
    qubits = max(2, min(int(payload.get("qubits", 4)), 10))
    shots = max(128, min(int(payload.get("shots", 512)), 65536))
    result = solve_quantum({
        "quantumCircuit": "variational",
        "quantumQubits": qubits,
        "quantumBatch": 8,
        "quantumShots": shots,
        "benchmarkRepeats": 2,
        "variationalAngle": float(payload.get("angle", 0.73)),
    })
    state = result["state"]
    return {
        "schema": SCHEMA,
        "jobId": f"local-sim-{uuid.uuid4().hex[:12]}",
        "engine": result["provenance"]["engine"],
        "executionKind": "local-directml-quantum-simulator",
        "physicalQpu": False,
        "qubits": state["qubits"],
        "shots": state["shots"],
        "fidelity": state["fidelity"],
        "normalizationError": state["normalizationError"],
        "topOutcomes": state["topOutcomes"],
        "scientificBoundary": "scheduler integration probe; not QCD validation or physical QPU evidence",
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "MatterFrontierQpuAdapter/1"

    def _json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path != "/health":
            self._json({"ok": False, "error": "not found"}, HTTPStatus.NOT_FOUND)
            return
        self._json({"ok": True, "schema": SCHEMA, "physicalQpu": False, "adapter": "directml-reference"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/run":
            self._json({"ok": False, "error": "not found"}, HTTPStatus.NOT_FOUND)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            if not isinstance(payload, dict):
                raise ValueError("request must be a JSON object")
            self._json(execute_probe(payload))
        except Exception as exc:
            self._json({"ok": False, "error": f"{type(exc).__name__}: {exc}"}, HTTPStatus.BAD_REQUEST)

    def log_message(self, format: str, *args: Any) -> None:
        return


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the local Matter Frontier QPU adapter example")
    parser.add_argument("--port", type=int, default=8910)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"QPU adapter example: http://127.0.0.1:{args.port} (simulator, not physical QPU)")
    server.serve_forever()


if __name__ == "__main__":
    main()
