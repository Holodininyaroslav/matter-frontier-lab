# Worker adapters

Frontier Lab workers execute scientific payloads off-chain. The discovery
ledger stores only canonical manifests, assignments, hashes, verification
events, provenance summaries and neutral test reward units.

## Local QPU bridge contract

The coordinator accepts only `http://127.0.0.1`, `http://localhost` or
`http://[::1]` adapter URLs. Provider tokens therefore stay in a process owned
by the user and are never sent to the browser, SQLite ledger or EOS/Vaulta
contract.

The adapter implements:

- `GET /health` — capability and physical/simulated execution declaration;
- `POST /run` — accepts `matter-frontier.qpu-adapter/v1` and returns a provider
  job identifier, backend identity, qubit/shot metadata and compact results.

Run the included DirectML transport example:

```powershell
.\.venv-science\Scripts\python.exe blockchain\workers\qpu_adapter_example.py --port 8910
```

Then open `http://127.0.0.1:8892/discovery-chain/` and register
`http://127.0.0.1:8910`. The example is explicitly a local GPU quantum
simulator. To connect physical hardware, replace `execute_probe` with a
provider SDK call, set `physicalQpu` truthfully, preserve the schema, and keep
credentials solely in the loopback process.

Quantum probes exercise the heterogeneous scheduling path; they do not validate
the multi-quark effective model and do not substitute for lattice QCD.
