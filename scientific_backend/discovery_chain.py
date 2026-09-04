"""Local EOS/Vaulta-compatible discovery-chain protocol simulator.

The module keeps consensus/settlement separate from scientific execution:

* canonical state-space cells prevent duplicate rewards;
* CPU, DirectML GPU and quantum-simulator workers are registered explicitly;
* the existing multi-quark solver executes off-chain;
* only manifests, commitments, result hashes and compact summaries enter the
  append-only ledger;
* a sibling Antelope smart contract implements the same state transitions for
  a future Vaulta testnet deployment.

This is a local protocol testnet, not a public financial network and not proof
that a screened multi-quark candidate exists in nature.
"""

from __future__ import annotations

import hashlib
import json
import os
import platform
import sqlite3
import threading
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from .multiquark_discovery import ROOT, solve as solve_multiquark


CHAIN_ROOT = ROOT / "scientific_output" / "discovery-chain"
DEFAULT_DB = CHAIN_ROOT / "local-testnet.sqlite3"
PROTOCOL_VERSION = "matter-frontier.discovery-chain/v1"


def _canonical(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _digest(value: Any) -> str:
    return hashlib.sha256(_canonical(value).encode("utf-8")).hexdigest()


def _now() -> int:
    return int(time.time())


class DiscoveryChain:
    """Persistent deterministic testnet with EOS-contract-shaped transitions."""

    def __init__(self, database: Path | str = DEFAULT_DB) -> None:
        self.database = Path(database)
        self.database.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._create_schema()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database, timeout=30)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA foreign_keys=ON")
        return connection

    def _create_schema(self) -> None:
        with self._lock, self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS workers (
                    worker_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    backend TEXT NOT NULL,
                    status TEXT NOT NULL,
                    adapter_url TEXT NOT NULL DEFAULT '',
                    capabilities_json TEXT NOT NULL,
                    registered_at INTEGER NOT NULL,
                    jobs_completed INTEGER NOT NULL DEFAULT 0,
                    reward_units INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS tasks (
                    task_id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    composition TEXT NOT NULL,
                    manifest_hash TEXT NOT NULL UNIQUE,
                    config_json TEXT NOT NULL,
                    total_shards INTEGER NOT NULL,
                    new_shards INTEGER NOT NULL,
                    reused_shards INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS shards (
                    shard_id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL,
                    cell_index INTEGER NOT NULL,
                    state_hash TEXT NOT NULL UNIQUE,
                    parameters_json TEXT NOT NULL,
                    status TEXT NOT NULL,
                    worker_id TEXT,
                    claimed_at INTEGER,
                    completed_at INTEGER,
                    result_hash TEXT,
                    result_json TEXT,
                    compute_ms REAL NOT NULL DEFAULT 0,
                    reward_units INTEGER NOT NULL DEFAULT 0,
                    FOREIGN KEY(task_id) REFERENCES tasks(task_id),
                    FOREIGN KEY(worker_id) REFERENCES workers(worker_id)
                );
                CREATE TABLE IF NOT EXISTS blocks (
                    height INTEGER PRIMARY KEY AUTOINCREMENT,
                    previous_hash TEXT NOT NULL,
                    block_hash TEXT NOT NULL UNIQUE,
                    created_at INTEGER NOT NULL,
                    event_type TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_shards_status ON shards(status, cell_index);
                CREATE INDEX IF NOT EXISTS idx_shards_task ON shards(task_id, cell_index);
                """
            )
            if not connection.execute("SELECT 1 FROM blocks LIMIT 1").fetchone():
                self._append_block(connection, "genesis", {
                    "protocol": PROTOCOL_VERSION,
                    "network": "local-vaulta-compatible-testnet",
                    "scientificStatus": "protocol simulation",
                })

    def _append_block(self, connection: sqlite3.Connection, event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        previous = connection.execute("SELECT block_hash FROM blocks ORDER BY height DESC LIMIT 1").fetchone()
        previous_hash = str(previous["block_hash"]) if previous else "0" * 64
        created_at = _now()
        block_hash = _digest({
            "previousHash": previous_hash,
            "createdAt": created_at,
            "eventType": event_type,
            "payload": payload,
        })
        cursor = connection.execute(
            "INSERT INTO blocks(previous_hash, block_hash, created_at, event_type, payload_json) VALUES(?,?,?,?,?)",
            (previous_hash, block_hash, created_at, event_type, _canonical(payload)),
        )
        return {"height": cursor.lastrowid, "hash": block_hash, "eventType": event_type}

    def register_worker(self, specification: dict[str, Any]) -> dict[str, Any]:
        kind = str(specification.get("kind", "cpu")).lower()
        if kind not in {"cpu", "gpu", "quantum-simulator", "qpu", "fpga"}:
            raise ValueError("worker kind must be cpu, gpu, quantum-simulator, qpu, or fpga")
        name = str(specification.get("name", f"local-{kind}")).strip()[:80]
        backend = str(specification.get("backend", kind)).strip()[:120]
        adapter_url = str(specification.get("adapterUrl", "")).strip()
        if adapter_url:
            parsed = urllib.parse.urlparse(adapter_url)
            if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
                raise ValueError("external worker adapters must use a loopback HTTP endpoint")
        capabilities = specification.get("capabilities", {})
        if not isinstance(capabilities, dict):
            raise ValueError("capabilities must be an object")
        worker_id = _digest({"name": name, "kind": kind, "backend": backend, "adapterUrl": adapter_url})[:16]
        status = str(specification.get("status", "ready" if kind != "qpu" or adapter_url else "adapter-required"))
        with self._lock, self._connect() as connection:
            existing = connection.execute("SELECT jobs_completed,reward_units FROM workers WHERE worker_id=?", (worker_id,)).fetchone()
            jobs = int(existing["jobs_completed"]) if existing else 0
            rewards = int(existing["reward_units"]) if existing else 0
            connection.execute(
                "INSERT OR REPLACE INTO workers VALUES(?,?,?,?,?,?,?,?,?,?)",
                (worker_id, name, kind, backend, status, adapter_url, _canonical(capabilities), _now(), jobs, rewards),
            )
            self._append_block(connection, "worker.registered", {
                "workerId": worker_id, "kind": kind, "backend": backend, "status": status,
            })
        return {"workerId": worker_id, "name": name, "kind": kind, "backend": backend, "status": status}

    def detect_local_workers(self) -> list[dict[str, Any]]:
        workers = [self.register_worker({
            "name": platform.node() or "local-machine",
            "kind": "cpu",
            "backend": "python-numpy-scipy",
            "capabilities": {"logicalCores": os.cpu_count() or 1, "platform": platform.platform()},
        })]
        try:
            from .gpu_multiquark_adapter import status as gpu_status
            gpu = gpu_status()
            if gpu.get("available"):
                workers.append(self.register_worker({
                    "name": f"{platform.node() or 'local'} DirectML GPU",
                    "kind": "gpu",
                    "backend": str(gpu.get("engine", "onnxruntime-directml")),
                    "capabilities": gpu,
                }))
        except Exception:
            pass
        try:
            from .gpu_quantum_simulator import status as quantum_status
            quantum = quantum_status()
            if quantum.get("available"):
                workers.append(self.register_worker({
                    "name": f"{platform.node() or 'local'} quantum simulator",
                    "kind": "quantum-simulator",
                    "backend": str(quantum.get("engine", "directml-statevector")),
                    "capabilities": quantum,
                }))
        except Exception:
            pass
        return workers

    def create_task(self, values: dict[str, Any]) -> dict[str, Any]:
        composition = " ".join(str(values.get("composition", "u u d d s s")).split())
        title = str(values.get("title", f"Distributed search: {composition}"))[:120]
        steps = max(2, min(int(values.get("shards", 12)), 64))
        coupling_min = max(0.0, min(float(values.get("couplingMin", 0.55)), 2.0))
        coupling_max = max(coupling_min, min(float(values.get("couplingMax", 1.45)), 2.0))
        candidate_limit = max(4, min(int(values.get("candidateLimit", 12)), 24))
        config = {
            "protocol": PROTOCOL_VERSION,
            "title": title,
            "composition": composition,
            "hamiltonianLevel": str(values.get("hamiltonianLevel", "B")),
            "orbitalModes": max(1, min(int(values.get("orbitalModes", 2)), 4)),
            "couplingMin": coupling_min,
            "couplingMax": coupling_max,
            "shards": steps,
            "candidateLimit": candidate_limit,
            "searchBudgetPerShard": max(1000, min(int(values.get("searchBudgetPerShard", 25000)), 2_000_000)),
            "quantumAudit": bool(values.get("quantumAudit", True)),
        }
        manifest_hash = _digest(config)
        task_id = f"task-{manifest_hash[:12]}"
        with self._lock, self._connect() as connection:
            existing = connection.execute("SELECT * FROM tasks WHERE manifest_hash=?", (manifest_hash,)).fetchone()
            if existing:
                return {"taskId": str(existing["task_id"]), "created": False, "duplicateTaskPrevented": True,
                        "newShards": int(existing["new_shards"]), "reusedShards": int(existing["reused_shards"])}
            new_shards = reused = 0
            cells: list[tuple[Any, ...]] = []
            for index in range(steps):
                fraction = index / max(steps - 1, 1)
                coupling = round(coupling_min + (coupling_max - coupling_min) * fraction, 8)
                parameters = {
                    "solverSchema": "matter-frontier.multiquark-experiment/v2",
                    "composition": composition,
                    "hamiltonianLevel": config["hamiltonianLevel"],
                    "orbitalModes": config["orbitalModes"],
                    "colorSpinCoupling": coupling,
                    "candidateLimit": candidate_limit,
                    "candidateOffset": index * candidate_limit,
                    "randomSeed": index,
                    "searchBudget": config["searchBudgetPerShard"],
                }
                state_hash = _digest(parameters)
                if connection.execute("SELECT 1 FROM shards WHERE state_hash=?", (state_hash,)).fetchone():
                    reused += 1
                    continue
                shard_id = f"{task_id}-{index:04d}"
                parameters.update({"shardId": shard_id, "cellIndex": index, "stateSpaceHash": state_hash})
                cells.append((shard_id, task_id, index, state_hash, _canonical(parameters), "pending"))
                new_shards += 1
            connection.execute(
                "INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?,?,?)",
                (task_id, title, composition, manifest_hash, _canonical(config), steps, new_shards, reused,
                 "verified-by-reuse" if new_shards == 0 else "queued", _now()),
            )
            connection.executemany(
                "INSERT INTO shards(shard_id,task_id,cell_index,state_hash,parameters_json,status) VALUES(?,?,?,?,?,?)",
                cells,
            )
            self._append_block(connection, "task.created", {
                "taskId": task_id, "manifestHash": manifest_hash, "newShards": new_shards,
                "reusedShards": reused, "totalRequested": steps,
            })
        return {"taskId": task_id, "created": True, "duplicateTaskPrevented": False,
                "newShards": new_shards, "reusedShards": reused, "manifestHash": manifest_hash}

    def bootstrap(self) -> dict[str, Any]:
        workers = self.detect_local_workers()
        with self._connect() as connection:
            has_tasks = bool(connection.execute("SELECT 1 FROM tasks LIMIT 1").fetchone())
        default_task = None if has_tasks else self.create_task({
            "title": "H-dibaryon coupling sweep",
            "composition": "u u d d s s",
            "hamiltonianLevel": "B",
            "shards": 12,
            "quantumAudit": True,
        })
        return {"workers": workers, "defaultTask": default_task, "snapshot": self.snapshot()}

    def _ready_workers(self, connection: sqlite3.Connection) -> list[sqlite3.Row]:
        return list(connection.execute(
            "SELECT * FROM workers WHERE status='ready' AND kind IN ('cpu','gpu') ORDER BY CASE kind WHEN 'gpu' THEN 0 ELSE 1 END, worker_id"
        ))

    def run_epoch(self, values: dict[str, Any] | None = None) -> dict[str, Any]:
        options = values or {}
        limit = max(1, min(int(options.get("maxShards", 2)), 8))
        if not self.snapshot()["workers"]:
            self.detect_local_workers()
        completed: list[dict[str, Any]] = []
        for _ in range(limit):
            with self._lock, self._connect() as connection:
                workers = self._ready_workers(connection)
                shard = connection.execute(
                    "SELECT * FROM shards WHERE status='pending' ORDER BY task_id,cell_index LIMIT 1"
                ).fetchone()
                if not shard or not workers:
                    break
                # Prefer the GPU for large, explicitly portable threshold batches;
                # keep every third shard on CPU as an independent execution lane.
                gpu_workers = [worker for worker in workers if worker["kind"] == "gpu"]
                worker = gpu_workers[0] if gpu_workers and int(shard["cell_index"]) % 3 != 0 else workers[-1]
                claimed = connection.execute(
                    "UPDATE shards SET status='claimed',worker_id=?,claimed_at=? WHERE shard_id=? AND status='pending'",
                    (worker["worker_id"], _now(), shard["shard_id"]),
                )
                if claimed.rowcount != 1:
                    continue
                self._append_block(connection, "shard.claimed", {
                    "shardId": shard["shard_id"], "stateHash": shard["state_hash"], "workerId": worker["worker_id"],
                })
                parameters = json.loads(str(shard["parameters_json"]))
                parameters["computeBackend"] = "directml" if worker["kind"] == "gpu" else "cpu"
            started = time.perf_counter()
            try:
                result = solve_multiquark(parameters)
                elapsed_ms = (time.perf_counter() - started) * 1000.0
                partition = result.get("searchPartition", {})
                verified = partition.get("stateSpaceHash") == str(shard["state_hash"])
                if not verified:
                    raise RuntimeError("solver returned a result for a different state-space cell")
                result_hash = _digest(result)
                summary = {
                    "experimentId": result.get("experimentId"),
                    "bestCandidate": result.get("bestCandidate"),
                    "quantumNumbers": result.get("quantumNumbers"),
                    "provenance": result.get("provenance"),
                    "gpuAcceleration": result.get("gpuAcceleration"),
                    "searchPartition": partition,
                }
                reward = 1000 + int(bool(result.get("bestCandidate"))) * 250
                with self._lock, self._connect() as connection:
                    connection.execute(
                        "UPDATE shards SET status='committed',completed_at=?,result_hash=?,result_json=?,compute_ms=? WHERE shard_id=?",
                        (_now(), result_hash, _canonical(summary), elapsed_ms, shard["shard_id"]),
                    )
                    commit_block = self._append_block(connection, "shard.committed", {
                        "shardId": shard["shard_id"], "stateHash": shard["state_hash"],
                        "resultHash": result_hash, "workerId": worker["worker_id"],
                    })
                    verification_hash = _digest({
                        "authority": "local-scientific-authority",
                        "stateHash": shard["state_hash"],
                        "resultHash": result_hash,
                        "partition": partition,
                    })
                    connection.execute("UPDATE shards SET status='verified' WHERE shard_id=?", (shard["shard_id"],))
                    verify_block = self._append_block(connection, "shard.verified", {
                        "shardId": shard["shard_id"], "stateHash": shard["state_hash"],
                        "resultHash": result_hash, "verificationHash": verification_hash,
                        "authority": "local-scientific-authority",
                    })
                    connection.execute(
                        "UPDATE workers SET jobs_completed=jobs_completed+1,reward_units=reward_units+? WHERE worker_id=?",
                        (reward, worker["worker_id"]),
                    )
                    connection.execute(
                        "UPDATE shards SET status='settled',reward_units=? WHERE shard_id=?",
                        (reward, shard["shard_id"]),
                    )
                    remaining = connection.execute(
                        "SELECT COUNT(*) AS n FROM shards WHERE task_id=? AND status NOT IN ('verified','settled')",
                        (shard["task_id"],),
                    ).fetchone()["n"]
                    connection.execute(
                        "UPDATE tasks SET status=? WHERE task_id=?", ("settled" if remaining == 0 else "running", shard["task_id"]),
                    )
                    settle_block = self._append_block(connection, "shard.settled", {
                        "shardId": shard["shard_id"], "stateHash": shard["state_hash"], "resultHash": result_hash,
                        "workerId": worker["worker_id"], "rewardUnits": reward,
                    })
                completed.append({
                    "shardId": shard["shard_id"], "workerId": worker["worker_id"], "workerKind": worker["kind"],
                    "stateHash": shard["state_hash"], "resultHash": result_hash, "elapsedMs": elapsed_ms,
                    "rewardUnits": reward, "block": settle_block, "commitBlock": commit_block,
                    "verificationBlock": verify_block, "bestCandidate": summary["bestCandidate"],
                })
            except Exception as exc:
                with self._lock, self._connect() as connection:
                    connection.execute("UPDATE shards SET status='pending',worker_id=NULL,claimed_at=NULL WHERE shard_id=?", (shard["shard_id"],))
                    self._append_block(connection, "shard.failed", {
                        "shardId": shard["shard_id"], "workerId": worker["worker_id"],
                        "error": f"{type(exc).__name__}: {exc}"[:500],
                    })
                completed.append({"shardId": shard["shard_id"], "ok": False, "error": f"{type(exc).__name__}: {exc}"})
                break
        quantum_probe = self._run_quantum_probe() if completed and bool(options.get("quantumAudit", True)) else None
        return {"completed": completed, "quantumProbe": quantum_probe, "snapshot": self.snapshot()}

    def _run_quantum_probe(self) -> dict[str, Any] | None:
        """Run a small scheduler-path probe; it is not QCD validation."""
        with self._connect() as connection:
            worker = connection.execute(
                "SELECT * FROM workers WHERE status='ready' AND kind IN ('qpu','quantum-simulator') "
                "ORDER BY CASE kind WHEN 'qpu' THEN 0 ELSE 1 END,worker_id LIMIT 1"
            ).fetchone()
        if not worker:
            return None
        try:
            started = time.perf_counter()
            if worker["kind"] == "qpu":
                request_payload = {
                    "schema": "matter-frontier.qpu-adapter/v1",
                    "job": "bounded-variational-scheduler-probe",
                    "qubits": 4,
                    "shots": 512,
                    "angle": 0.73,
                    "scientificBoundary": "scheduler integration probe; not QCD validation",
                }
                request = urllib.request.Request(
                    str(worker["adapter_url"]).rstrip("/") + "/run",
                    data=_canonical(request_payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(request, timeout=120) as response:
                    adapter_result = json.loads(response.read().decode("utf-8"))
                result = {
                    "state": {"qubits": 4, "fidelity": adapter_result.get("fidelity")},
                    "provenance": {
                        "engine": str(adapter_result.get("engine", worker["backend"])),
                        "externalQpuAdapter": True,
                        "jobId": adapter_result.get("jobId"),
                    },
                    "adapterResult": adapter_result,
                }
            else:
                from .gpu_quantum_simulator import solve as solve_quantum
                result = solve_quantum({
                    "quantumCircuit": "variational", "quantumQubits": 4, "quantumBatch": 8,
                    "quantumShots": 512, "benchmarkRepeats": 2, "variationalAngle": 0.73,
                })
            elapsed_ms = (time.perf_counter() - started) * 1000.0
            witness = {
                "purpose": "hybrid scheduler path probe; not a QCD stability proof",
                "engine": result.get("provenance", {}).get("engine"),
                "qubits": result.get("state", {}).get("qubits"),
                "fidelity": result.get("state", {}).get("fidelity"),
                "resultHash": _digest(result),
                "workerKind": worker["kind"],
            }
            with self._lock, self._connect() as connection:
                connection.execute(
                    "UPDATE workers SET jobs_completed=jobs_completed+1,reward_units=reward_units+250 WHERE worker_id=?",
                    (worker["worker_id"],),
                )
                block = self._append_block(connection, "quantum.probe", {**witness, "workerId": worker["worker_id"]})
            return {**witness, "elapsedMs": elapsed_ms, "block": block}
        except Exception as exc:
            return {"ok": False, "error": f"{type(exc).__name__}: {exc}", "scientificStatus": "probe unavailable"}

    def reset(self) -> dict[str, Any]:
        with self._lock, self._connect() as connection:
            connection.executescript("DELETE FROM shards; DELETE FROM tasks; DELETE FROM workers; DELETE FROM blocks;")
            self._append_block(connection, "genesis", {
                "protocol": PROTOCOL_VERSION,
                "network": "local-vaulta-compatible-testnet",
                "scientificStatus": "protocol simulation",
            })
        return self.snapshot()

    def snapshot(self) -> dict[str, Any]:
        with self._lock, self._connect() as connection:
            workers = [dict(row) for row in connection.execute("SELECT * FROM workers ORDER BY kind,name")]
            for worker in workers:
                worker["capabilities"] = json.loads(worker.pop("capabilities_json"))
            tasks = [dict(row) for row in connection.execute("SELECT * FROM tasks ORDER BY created_at DESC,task_id")]
            for task in tasks:
                task["config"] = json.loads(task.pop("config_json"))
                counts = {row["status"]: int(row["n"]) for row in connection.execute(
                    "SELECT status,COUNT(*) AS n FROM shards WHERE task_id=? GROUP BY status", (task["task_id"],)
                )}
                task["shardCounts"] = counts
                task["verifiedShards"] = counts.get("verified", 0) + counts.get("settled", 0)
                task["coveragePercent"] = round(100.0 * (task["verifiedShards"] + int(task["reused_shards"])) / max(int(task["total_shards"]), 1), 2)
            shards = [dict(row) for row in connection.execute(
                "SELECT shard_id,task_id,cell_index,state_hash,status,worker_id,compute_ms,reward_units,result_hash FROM shards ORDER BY task_id,cell_index LIMIT 256"
            )]
            blocks = [dict(row) for row in connection.execute(
                "SELECT height,previous_hash,block_hash,created_at,event_type,payload_json FROM blocks ORDER BY height DESC LIMIT 20"
            )]
            for block in blocks:
                block["payload"] = json.loads(block.pop("payload_json"))
            verified = int(connection.execute(
                "SELECT COUNT(*) AS n FROM shards WHERE status IN ('verified','settled')"
            ).fetchone()["n"])
            pending = int(connection.execute("SELECT COUNT(*) AS n FROM shards WHERE status='pending'").fetchone()["n"])
            duplicate_prevented = int(connection.execute("SELECT COALESCE(SUM(reused_shards),0) AS n FROM tasks").fetchone()["n"])
            ledger_integrity = self._ledger_integrity(connection)
        return {
            "protocol": PROTOCOL_VERSION,
            "network": "local-vaulta-compatible-testnet",
            "executionModel": "off-chain useful work / on-chain commitments and settlement",
            "scientificBoundary": "effective-model screening; not lattice-QCD validation or particle discovery",
            "workers": workers,
            "tasks": tasks,
            "shards": shards,
            "blocks": blocks,
            "metrics": {
                "verifiedStateCells": verified,
                "pendingStateCells": pending,
                "duplicateComputationsPrevented": duplicate_prevented,
                "blockHeight": blocks[0]["height"] if blocks else 0,
                "totalRewardUnits": sum(int(worker["reward_units"]) for worker in workers),
                "ledgerIntegrityValid": ledger_integrity["valid"],
            },
            "ledgerIntegrity": ledger_integrity,
        }

    def _ledger_integrity(self, connection: sqlite3.Connection) -> dict[str, Any]:
        expected_previous = "0" * 64
        checked = 0
        for row in connection.execute(
            "SELECT height,previous_hash,block_hash,created_at,event_type,payload_json FROM blocks ORDER BY height"
        ):
            payload = json.loads(str(row["payload_json"]))
            expected_hash = _digest({
                "previousHash": expected_previous,
                "createdAt": int(row["created_at"]),
                "eventType": str(row["event_type"]),
                "payload": payload,
            })
            if str(row["previous_hash"]) != expected_previous or str(row["block_hash"]) != expected_hash:
                return {"valid": False, "checkedBlocks": checked, "firstInvalidHeight": int(row["height"])}
            expected_previous = expected_hash
            checked += 1
        return {"valid": True, "checkedBlocks": checked, "headHash": expected_previous}


_CHAIN: DiscoveryChain | None = None


def chain() -> DiscoveryChain:
    global _CHAIN
    if _CHAIN is None:
        _CHAIN = DiscoveryChain()
    return _CHAIN


def status() -> dict[str, Any]:
    snapshot = chain().snapshot()
    return {
        "available": True,
        "engine": "sqlite-local-vaulta-protocol-simulator",
        "protocol": PROTOCOL_VERSION,
        "database": str(chain().database.relative_to(ROOT)).replace("\\", "/"),
        "workers": len(snapshot["workers"]),
        "tasks": len(snapshot["tasks"]),
        "metrics": snapshot["metrics"],
        "publicChainDeployment": False,
    }
