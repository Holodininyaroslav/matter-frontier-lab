import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from scientific_backend.discovery_chain import DiscoveryChain, PROTOCOL_VERSION


def test_chain_partitions_search_and_prevents_duplicate_state_cells(tmp_path) -> None:
    testnet = DiscoveryChain(tmp_path / "chain.sqlite3")
    testnet.register_worker({"name": "test-cpu", "kind": "cpu", "backend": "pytest"})
    first = testnet.create_task({
        "title": "first sweep",
        "composition": "u u d d s s",
        "shards": 3,
        "candidateLimit": 4,
        "couplingMin": 0.8,
        "couplingMax": 1.0,
        "quantumAudit": False,
    })
    second = testnet.create_task({
        "title": "same cells, different sponsor description",
        "composition": "u u d d s s",
        "shards": 3,
        "candidateLimit": 4,
        "couplingMin": 0.8,
        "couplingMax": 1.0,
        "quantumAudit": False,
    })
    assert first["newShards"] == 3
    assert second["newShards"] == 0
    assert second["reusedShards"] == 3
    assert testnet.snapshot()["metrics"]["duplicateComputationsPrevented"] == 3


def test_epoch_executes_existing_solver_and_commits_hashes(tmp_path) -> None:
    testnet = DiscoveryChain(tmp_path / "chain.sqlite3")
    testnet.register_worker({"name": "test-cpu", "kind": "cpu", "backend": "pytest"})
    task = testnet.create_task({
        "composition": "u u d d s s",
        "shards": 2,
        "candidateLimit": 4,
        "searchBudgetPerShard": 1000,
        "quantumAudit": False,
    })
    epoch = testnet.run_epoch({"maxShards": 1, "quantumAudit": False})
    assert len(epoch["completed"]) == 1
    completed = epoch["completed"][0]
    assert completed["resultHash"]
    assert completed["stateHash"]
    snapshot = epoch["snapshot"]
    assert snapshot["protocol"] == PROTOCOL_VERSION
    assert snapshot["metrics"]["verifiedStateCells"] == 1
    assert snapshot["metrics"]["pendingStateCells"] == 1
    assert snapshot["metrics"]["ledgerIntegrityValid"] is True
    assert snapshot["workers"][0]["jobs_completed"] == 1
    assert any(block["event_type"] == "shard.verified" for block in snapshot["blocks"])
    assert any(block["event_type"] == "shard.settled" for block in snapshot["blocks"])
    assert task["taskId"] == snapshot["tasks"][0]["task_id"]


def test_reset_preserves_only_a_new_genesis_block(tmp_path) -> None:
    testnet = DiscoveryChain(tmp_path / "chain.sqlite3")
    testnet.register_worker({"name": "test-cpu", "kind": "cpu", "backend": "pytest"})
    reset = testnet.reset()
    assert reset["workers"] == []
    assert reset["tasks"] == []
    assert len(reset["blocks"]) == 1
    assert reset["blocks"][0]["event_type"] == "genesis"
    assert reset["ledgerIntegrity"]["valid"] is True


def test_quantum_adapter_uses_loopback_transport_and_records_provenance(tmp_path) -> None:
    class Adapter(BaseHTTPRequestHandler):
        def do_POST(self) -> None:  # noqa: N802
            length = int(self.headers.get("Content-Length", "0"))
            request = json.loads(self.rfile.read(length))
            assert request["schema"] == "matter-frontier.qpu-adapter/v1"
            body = json.dumps({
                "jobId": "provider-job-17",
                "engine": "test-physical-qpu-adapter",
                "fidelity": 0.982,
                "physicalQpu": True,
            }).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, format: str, *args) -> None:
            return

    adapter = ThreadingHTTPServer(("127.0.0.1", 0), Adapter)
    thread = threading.Thread(target=adapter.serve_forever, daemon=True)
    thread.start()
    try:
        testnet = DiscoveryChain(tmp_path / "qpu-chain.sqlite3")
        testnet.register_worker({"name": "test-cpu", "kind": "cpu", "backend": "pytest"})
        testnet.register_worker({
            "name": "test-qpu",
            "kind": "qpu",
            "backend": "external-test-provider",
            "adapterUrl": f"http://127.0.0.1:{adapter.server_address[1]}",
        })
        testnet.create_task({"composition": "u u d d s s", "shards": 2, "candidateLimit": 4})
        epoch = testnet.run_epoch({"maxShards": 1, "quantumAudit": True})
    finally:
        adapter.shutdown()
        adapter.server_close()
        thread.join(timeout=5)

    assert epoch["quantumProbe"]["workerKind"] == "qpu"
    assert epoch["quantumProbe"]["engine"] == "test-physical-qpu-adapter"
    assert epoch["quantumProbe"]["fidelity"] == 0.982
    assert any(block["event_type"] == "quantum.probe" for block in epoch["snapshot"]["blocks"])
