# Matter Frontier Discovery Chain

## Implemented scope

Discovery Chain is a proof-of-reproducible-scientific-work coordination layer
for the Matter Frontier multi-quark search. It borrows the useful-work idea
explored by HEPchain/Gophy, but the implementation is deliberately split into
two layers:

1. an executable persistent local testnet controlled by Frontier Lab;
2. an Antelope/EOSIO.CDT contract implementing the same task, shard, claim,
   commitment, verification and settlement state machine for a future Vaulta
   testnet deployment.

It is not a cryptocurrency launch, a public Vaulta deployment, an audited
contract or a claim that blockchain consensus can decide scientific truth.

## End-to-end data flow

```text
Frontier Lab control plane
  -> canonical campaign manifest
  -> deterministic parameter cells
  -> SHA-256 state-space hashes
  -> heterogeneous worker queue
       CPU: constraints, candidate construction, reference checks
       DirectML GPU: profiled portable numerical batches
       FPGA/ASIC: deterministic streaming filters
       QPU adapter: bounded hybrid probes or future validated subproblems
  -> content-addressed result bundle
  -> result commitment
  -> sampled independent reproduction / scientific authority vote
  -> one-time settlement in neutral reward units
  -> adjacent, previously unseen search cells
```

Large scientific arrays never enter the chain. The ledger carries manifests,
state hashes, worker assignment, artifact/result hashes, compact provenance and
verification transitions. The local SQLite ledger is an executable protocol
mirror; the C++ contract uses EOS/Vaulta multi-index tables.

## Canonical non-repetition rule

Every state cell includes the solver schema, quark composition, Hamiltonian
level, orbital modes, color-spin coupling, candidate range, seed and search
budget. Canonical JSON with sorted keys is hashed with SHA-256. The local
`shards.state_hash` column is globally unique. The contract's `bystate` index
enforces the same global uniqueness. Consequently:

- the same state cannot create a second payable shard;
- overlapping campaigns reuse already registered cells;
- a result is bound to an exact solver version and candidate range;
- expanding the search changes an explicit dimension rather than silently
  repeating work.

The effective solver now accepts `candidateOffset`, emits globally stable
candidate identifiers and returns a `searchPartition` witness containing the
shard, cell, offset and state-space hash.

## Worker and verification model

Workers register a kind, backend and capability document. The local coordinator
detects CPU, ONNX Runtime DirectML and the DirectML state-vector simulator.
External quantum providers are connected only through a loopback adapter so
credentials remain in a user-owned process. The included adapter demonstrates
the protocol using the local simulator and truthfully reports that it is not a
physical QPU.

The MVP verification authority is explicit and centralized. A production
network should add deterministic task classes, random validator selection,
stake/slashing rules, bounded quorum, challenge windows, artifact availability
checks and independent reproduction before settlement. Nondeterministic lattice
or Monte Carlo workloads require tolerance envelopes and statistical evidence,
not byte-identical output.

## Local Frontier Lab control plane

Open `http://127.0.0.1:8892/discovery-chain/`. The page can:

- connect detected CPU/GPU/quantum-simulator workers;
- create deterministic coupling sweeps;
- execute one bounded epoch at a time;
- display workers, search coverage and hash-linked ledger events;
- register a loopback QPU adapter;
- reset only the local protocol ledger (scientific artifacts are retained).

API routes:

- `GET /api/discovery-chain`
- `POST /api/discovery-chain/bootstrap`
- `POST /api/discovery-chain/task`
- `POST /api/discovery-chain/epoch`
- `POST /api/discovery-chain/worker`
- `POST /api/discovery-chain/reset`

The same routes are available below `/matter-lab/api/discovery-chain/`.

## EOS/Vaulta contract

`blockchain/contracts/mflchain/mflchain.cpp` implements:

| Action | State transition |
| --- | --- |
| `init` | sets the network scientific authority |
| `regworker` | records worker identity and capability hash |
| `createtask` | commits a versioned campaign manifest |
| `addshard` | accepts only a globally new state-space hash |
| `claim` | binds one active worker to one pending shard |
| `commit` | records result and artifact hashes |
| `verify` | accepts work or reopens it for computation |
| `settle` | credits verified useful work exactly once |

Scientific execution remains off-chain because WebAssembly consensus execution
is the wrong place for large arrays, licensed datasets, GPU kernels and QPU
provider calls. Public deployment still requires CDT compilation, contract and
economic audits, abuse limits, storage-cost analysis, a testnet account and a
separate legal decision about any transferable asset.

## Scientific boundary

The currently distributed worker is the repository's phenomenological
color-spin screening model. A verified shard proves that the declared program
produced and committed a reproducible result for a particular state cell. It
does not prove that the candidate is a physical particle.

Promotion beyond `model-dependent` still requires traceable lattice ensembles,
explicit SU(3) bases, correlator fits, finite-volume and continuum studies,
uncertainty propagation and independent peer review. Token holders must never
vote a physics claim into existence.

## Reference lineage

- [HEPchain: proof-of-useful-work consensus for high-energy physics](https://arxiv.org/abs/2304.13507)
- [Gophy: proof-of-useful-work architecture for high-energy physics](https://arxiv.org/abs/2404.09093)
- [Vaulta developer documentation](https://docs.vaulta.com/)
- [Antelope CDT documentation](https://docs.antelope.io/cdt/latest/)

These projects inform the coordination design; their code is not represented
as copied into this repository.
