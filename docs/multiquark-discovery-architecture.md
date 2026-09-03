# Hybrid Multi-Quark Discovery Computer

## Implemented vertical slice

The integrated workbench turns a quark composition into a reproducible,
inspectable screening run:

1. Parse 2–12 quarks and antiquarks.
2. Derive electric charge, baryon number, strangeness and color triality.
3. Generate a bounded candidate set with spin, parity and orbital labels.
4. Apply conserved-number, color-triality and Pauli/permutation gates.
5. Estimate the reduced basis size.
6. Rank the surviving states with a phenomenological constituent color-spin
   Hamiltonian.
7. Compare every state with explicit decay thresholds and its uncertainty.
8. Save the immutable input manifest, result, synthesizable SystemVerilog and
   testbench under one experiment identifier.

The threshold-margin operation can be dispatched to ONNX Runtime DirectML as a
batched GPU kernel. The identical graph is run through CPUExecutionProvider and
the numerical disagreement and execution-provider profile are recorded. This
does not imply that the group-theory, basis-construction or lattice-QCD stages
have been ported to the GPU.

The browser exposes this flow from the **Multi-quark system**, **H-dibaryon**
and **Omega-Omega dibaryon** catalogue cards. The dedicated workbench is a
modal application rather than an unrelated page, so it preserves the selected
physical object and the visual laboratory context.

## Scientific status

The current calculation is an executable effective-model screening layer. It
is useful for testing orchestration, data contracts, candidate filtering,
threshold logic and hardware partitioning. It is not a lattice-QCD result.

Color triality equal to zero is a necessary pre-filter for a color singlet, not
a complete SU(3) Clebsch–Gordan construction. A candidate classified as bound
or near threshold is bound or unresolved only **within the selected effective
model**. It is not a discovery claim.

The next quantitative validation layer must consume independently generated
correlators or spectra from a traceable workflow such as Chroma with QUDA,
SIMULATeQCD, Grid or a reviewed multiquark lattice workflow. That layer must
record lattice spacing, volume, ensemble, action, interpolating operators,
renormalisation convention, continuum/volume extrapolation and statistical
method.

## Reproducibility contract

Each run produces:

- `manifest.json`: schema version, composition, conserved quantum numbers,
  Hamiltonian level, orbital basis, search budget, precision, random seed,
  backend identity and limitations;
- `result.json`: pipeline counts, candidate records, uncertainties, thresholds,
  classifications, hardware metadata and provenance;
- `multiquark_physics_frontend.sv`: experiment-specific SystemVerilog copy;
- `tb_multiquark_physics_frontend.sv`: cycle-level smoke test.

The experiment identifier is the first 12 hexadecimal characters of SHA-256
over the canonical manifest. Identical manifests therefore produce the same
identifier and deterministic shortlist.

## Hardware partition

The first FPGA/ASIC block is intentionally a workload compressor, not an
attempt to hard-code a full QCD solver. The versioned reference design is in
`hardware/multiquark/` and uses a streaming ready/valid contract.

Pipeline:

```text
candidate stream
  -> Q/B/S equality filter
  -> color-triality filter
  -> Pauli-allowed gate
  -> binding-margin subtractor
  -> uncertainty-aware threshold classifier
```

The stable, deterministic integer operations are suitable for SystemVerilog.
Basis construction, sparse eigensolvers, Monte Carlo generation and model
calibration remain software tasks until profiling demonstrates a stable
accelerator boundary. Reported clock and throughput values are projections,
not synthesis or board measurements.

## API contract

`POST /matter-lab/api/multiquark/search`

Example request:

```json
{
  "values": {
    "composition": "u u d d s s",
    "hamiltonianLevel": "B",
    "orbitalModes": 2,
    "colorSpinCoupling": 1.0,
    "searchBudget": 250000,
    "hardwareTarget": "asic-prototype"
  }
}
```

The response includes the experiment manifest, candidate shortlist, threshold
table, pipeline reduction counts, hardware metadata, generated SystemVerilog,
testbench and RTL-verification status.

## Planned scientific upgrades

1. Replace triality-only color screening with explicit SU(3) coupling bases.
2. Add sparse generalized eigenproblems with overlap matrices and residual
   checks.
3. Import lattice correlator bundles through a versioned adapter contract.
4. Add correlated multi-exponential and variational fits with bootstrap or
   jackknife uncertainty propagation.
5. Compare volumes, lattice spacings and operator bases before promoting any
   result beyond `model-dependent`.
6. Run the committed SystemVerilog testbench with Icarus Verilog or Verilator,
   then add synthesis reports for a named FPGA or ASIC technology.
7. Add differential hardware-versus-software tests over randomized candidate
   streams before accepting an RTL result as verified.

## Acceptance criteria for a future quantitative mode

A future UI badge may say `lattice validated` only when the backend provides a
machine-readable provenance bundle, ensemble metadata, fit diagnostics,
finite-volume and discretisation checks, uncertainty propagation and a
reproducible comparison against an independent reference. Until then the UI
must retain the current effective-model boundary.
