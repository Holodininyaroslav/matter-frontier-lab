from __future__ import annotations

import json
import threading
import urllib.request
from http.server import ThreadingHTTPServer

import server
from scientific_backend.discovery_chain import DiscoveryChain


def _request(base: str, path: str, payload: dict | None = None) -> dict:
    headers = {"Content-Type": "application/json"}
    if payload is not None:
        with urllib.request.urlopen(base + "/api/security-token", timeout=10) as response:
            headers["X-Local-CSRF"] = json.load(response)["token"]
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        base + path,
        data=body,
        headers=headers,
        method="POST" if body is not None else "GET",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def test_frontier_lab_discovery_chain_http_control_plane(tmp_path, monkeypatch):
    testnet = DiscoveryChain(tmp_path / "http-testnet.sqlite3")
    monkeypatch.setattr(server, "discovery_chain", lambda: testnet)
    monkeypatch.setattr(testnet, "detect_local_workers", lambda: [testnet.register_worker({
        "name": "HTTP test CPU",
        "kind": "cpu",
        "backend": "pytest",
    })])

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.LabHandler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{httpd.server_address[1]}"
    try:
        boot = _request(base, "/api/discovery-chain/bootstrap", {})
        task = _request(base, "/api/discovery-chain/task", {"values": {
            "title": "HTTP integration sweep",
            "composition": "u u d d s s",
            "shards": 3,
            "candidateLimit": 4,
            "quantumAudit": False,
        }})
        epoch = _request(base, "/api/discovery-chain/epoch", {
            "maxShards": 2,
            "quantumAudit": False,
        })
        snapshot = _request(base, "/api/discovery-chain")
    finally:
        httpd.shutdown()
        httpd.server_close()
        thread.join(timeout=5)

    assert boot["ok"] is True
    assert task["ok"] is True
    assert task["result"]["newShards"] == 3
    assert len(epoch["result"]["completed"]) == 2
    assert snapshot["result"]["metrics"]["verifiedStateCells"] == 2
    assert snapshot["result"]["blocks"][0]["event_type"] == "shard.settled"
    assert snapshot["result"]["ledgerIntegrity"]["valid"] is True
