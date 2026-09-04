# Matter Frontier Discovery Chain

This directory contains the EOS/Vaulta contract-shaped implementation of the
distributed multi-quark search protocol. The production scientific work is not
executed in WebAssembly: CPU, GPU, FPGA and QPU workers run versioned containers
off-chain and commit hashes and compact verification records to the chain.

## Implemented contract transitions

```text
createtask -> addshard -> claim -> commit -> verify -> settle
```

`state_hash` is globally unique. A second task that covers an already registered
parameter cell increments `reused_shards` instead of creating another payable
work unit. Full result bundles remain content-addressed off-chain.

The contract intentionally accounts in neutral `reward_units`. It does not issue
or promote a financial token. A later token/escrow adapter requires an audit,
abuse controls, governance rules and jurisdiction-specific legal review.

## Local testnet

`scientific_backend/discovery_chain.py` mirrors these state transitions in a
persistent SQLite ledger and is available through the local Frontier Lab HTTP
API. It can immediately detect the local CPU, DirectML GPU and DirectML quantum
state-vector simulator. An external physical QPU is represented by a loopback
adapter so provider credentials never enter the browser or blockchain.

## Building for an Antelope test environment

Install Antelope CDT, then run CMake in `blockchain/contracts/mflchain`. The
repository does not claim that the contract has been deployed to the public
Vaulta network. Public deployment should happen only after contract tests,
resource/RAM profiling, authority decentralisation and an independent audit.

