# Matter Frontier Lab

<p align="center">
  <img src="assets/matter-frontier-lab-avatar.png" alt="Matter Frontier Lab scientific emblem" width="260">
</p>

**Matter Frontier Lab** is a local-first interactive laboratory for exploring particle physics, dense and exotic matter, collider events, macro-objects, neutrino communication, and educational 4D projections.

It is a visual and computational education project. It clearly distinguishes experimental facts, published theoretical models, catalogue-only entries, and author-defined hypotheses. It is **not** a tool for predicting new particles, designing a neutrino communication device, or replacing validated research pipelines.

## Public GitHub Pages

- [Matter Frontier Lab portal](https://holodininyaroslav.github.io/matter-frontier-lab/)
- [CUDA-Q Shor algorithm — eight-qubit interactive inspector](https://holodininyaroslav.github.io/matter-frontier-lab/cudaq-shor-demo/)
- [Simple ASIC + CUDA-Q hybrid algorithm — annotated source inspector](https://holodininyaroslav.github.io/matter-frontier-lab/hybrid-quantum-asic-demo/)
- [Full multi-quark stable-system search — annotated production algorithm](https://holodininyaroslav.github.io/matter-frontier-lab/multiquark-algorithm/)
- [Discovery Chain — EOS/Vaulta architecture and live local testnet console](https://holodininyaroslav.github.io/matter-frontier-lab/discovery-chain/)

All three algorithm inspectors are connected by a shared tab bar and are
available in English, Russian, and Hebrew. The selected language is persisted
both in local storage and in navigation URLs. They
load the exact versioned repository files instead of maintaining detached code
copies, divide the implementation into stages and substages, and annotate every
displayed source line.

The Discovery Chain page uses the same three-language persistence. On GitHub
Pages it is an architecture document; through the local Frontier Lab server it
becomes a live control console for the persistent protocol testnet.

The first inspector is an interactive eight-qubit CUDA-Q Shor demonstration
for the compiled teaching case `N=15, a=2`. It animates register preparation,
superposition, controlled modular powers, inverse QFT, measurement, continued
fractions and classical GCD recovery. The executable source supports a
dependency-free classical preview and, in a supported CUDA-Q environment,
`qpp-cpu`, NVIDIA state-vector simulation or an explicitly configured provider
target. The browser animation is an ideal explanatory model and never claims to
be a physical QPU execution; the fixed modular circuit is not a general RSA
factorizer.

## What the laboratory includes

- A multilingual catalogue (English by default, Russian and Hebrew selectable) covering ordinary particles, antiparticles, nuclei, dense/QCD matter, mesons, exotic-matter taxonomy, and macro-objects.
- Interactive 3D views built with Three.js: quark structure, meson string breaking, confinement, particle/antiparticle annihilation, collider event displays, and conceptual field visualisations.
- A dedicated **Neutrino Communication Lab** inside the Neutrino Lens hypothesis. It compares a photon/EM channel and a neutrino-beam channel crossing rock, with message-to-bits-to-received-message demonstration controls.
- A collider workbench with transparent detector layers, speed/pause controls, configurable beams, and explanatory event summaries.
- Macro-object scenes for the Sun, Jupiter, black holes, neutron stars, and compact-object catalogue entries.
- An orbitable WebGL black-hole view with a lensed accretion disk and photon-ring-inspired features. Its merger laboratory supports wide coplanar initial layouts of 2, 3, 6, or 9 compact objects, including randomised planar orbital layouts, independently adjustable grid transparency, curvature-embedding depth, and gravitational-wave visibility. The merger mode is explicitly educational: it visualises an analytic/qualitative inspiral, curvature embedding and gravitational-wave fronts, rather than a numerical-relativity prediction.
- A project-hypothesis workspace for a 4D complex-spin quasiparticle, including 3D slices, a tesseract projection, sparse 3D M-field regions, and ordinary-3D probe demonstrations.
- Per-model scientific notes, equations, scope limitations, and source links.

## Hybrid Multi-Quark Discovery Computer

The **Multi-quark system**, **H-dibaryon**, and **Omega-Omega dibaryon** cards
open an integrated multi-quark research workbench. Its current local vertical
slice performs deterministic candidate generation, conserved-quantum-number
checks, a color-triality pre-filter, Pauli/permutation screening, basis-size
reduction, effective color-spin energy ranking, and decay-threshold comparison.
Every run records an immutable manifest, uncertainty, model level, provenance,
and a classification such as `near threshold / unresolved` rather than claiming
that a low effective-model energy is a particle discovery.

The same calculation generates a synthesizable **SystemVerilog**
`multiquark_physics_frontend` and testbench. This streaming FPGA/ASIC prototype
implements the stable workload-compression stages: Q/B/S conservation filters,
color triality, a Pauli gate, binding-margin arithmetic, and an uncertainty-aware
threshold classifier. If Icarus Verilog is installed, the backend compiles and
runs the testbench; otherwise the UI explicitly reports `generated-not-simulated`.
The decay-threshold margin stage can now execute as a large batched ONNX graph
on the local DirectML GPU. Every run profiles the execution provider and compares
the GPU margins with the identical CPU graph; candidate construction and symmetry
logic deliberately remain on the CPU.
Artifacts are stored under `scientific_output/multiquark/<experiment-id>/`.
The versioned reference RTL and its testbench live in
`hardware/multiquark/`; every browser calculation also emits an immutable
experiment-specific copy next to its manifest and result.
The complete implementation boundary and upgrade contract are documented in
[docs/multiquark-discovery-architecture.md](docs/multiquark-discovery-architecture.md).

The repository also contains a deliberately small end-to-end architecture
demonstrator in
[scientific_backend/hybrid_quantum_asic_demo.py](scientific_backend/hybrid_quantum_asic_demo.py).
Four deterministic integer candidates pass through the same acceptance rule as
the synthesizable
[SystemVerilog filter](hardware/hybrid_quantum_asic/hybrid_candidate_filter.sv).
The accepted demonstration address `3` maps explicitly to the two-qubit state
`|11>` and is recovered by a CUDA-Q Grover kernel. The portable CUDA-Q target is
`qpp-cpu`; on Windows, the officially supported route is WSL2. CUDA-Q's NVIDIA
GPU backend does not run on this computer's AMD Radeon, so the project does not
claim otherwise. The committed DirectML adapters are the separate GPU path for
the local Radeon hardware.

This is not a local lattice-QCD calculation. Chroma, QUDA, SIMULATeQCD, Grid and
the external `multiquark-lattice-qcd` workflow are represented as future
independent validation adapters. The current machine has no supported CUDA GPU
for QUDA, so the interface never presents the effective screening result as a
QUDA/Chroma result.

## Matter Frontier Discovery Chain

The multi-quark solver can now be divided into deterministic state-space cells
and coordinated by a local EOS/Vaulta-shaped testnet. Each cell has a canonical
SHA-256 identity covering the solver schema, composition, Hamiltonian, orbital
basis, coupling, candidate range, seed and budget. A global uniqueness rule
prevents a second payable shard for inputs that have already been registered,
including overlaps between separate campaigns.

The local chain automatically registers available CPU, ONNX Runtime DirectML
GPU and DirectML quantum-simulator workers. Scientific payloads execute
off-chain; the ledger records assignments, content hashes, compact provenance,
verification transitions and non-financial test reward units. A loopback QPU
adapter contract allows user-owned provider processes to participate without
putting cloud credentials in the browser or ledger. The included adapter is a
local simulator example and does not claim physical QPU execution.

The matching Antelope C++ contract is in
[`blockchain/contracts/mflchain`](blockchain/contracts/mflchain), and the
executable local mirror is
[`scientific_backend/discovery_chain.py`](scientific_backend/discovery_chain.py).
Open `http://127.0.0.1:8892/discovery-chain/` to control it from Frontier Lab.
The full protocol, security boundary and scaling path are documented in
[`docs/discovery-chain-architecture.md`](docs/discovery-chain-architecture.md).

This is not yet a deployed public Vaulta network, audited smart contract or
financial token. It is a working orchestration/testnet prototype. Scientific
consensus remains independent of token consensus: a verified shard is evidence
of reproducible computation, not evidence that a screened state exists in
nature.

## Black-hole merger and gravitational-wave laboratory

The **Black-hole merger** mode is an interactive, orbitable educational simulation inside the Black Hole catalogue entry. It is designed to make the following relationships visible:

- Wide, coplanar starting configurations of **2, 3, 6, or 9** black holes, with a button for a new random planar orbital layout.
- Mass-linked display horizons: changing an input mass changes the corresponding displayed Schwarzschild-radius scale.
- A continuously contracting inspiral in which every initial black hole remains visible until it reaches the common merger centre; the final displayed remnant uses the sum of the input display masses.
- A transparent, adjustable spacetime-embedding grid. Its depth can be increased separately from the horizon sizes so that the curvature pattern remains legible even for small, distant bodies.
- Outgoing, adjustable **gravitational-wave fronts** and a merger flash. These visualise the quadrupolar radiation expected from an inspiral and ringdown in qualitative form.

This browser laboratory is **not a numerical-relativity solver** and does not claim to calculate an astrophysical waveform, horizon dynamics, recoil, or radiated-energy budget. The binary case is an analytic, educational preview; three- and many-body cases are explicitly visual concepts. For quantitative work, the repository links to [Einstein Toolkit](https://einsteintoolkit.org/), its [binary black-hole gallery](https://www.einsteintoolkit.org/gallery/bbh/index.html), and [EinsteinPy](https://docs.einsteinpy.org/en/stable/) as possible traceable back-end/data pathways.

## Run locally

### Scientific CPU environment

The local backend can use a reproducible NumPy/SciPy environment for numerical
solvers while retaining the Python-standard-library implementation as a safe
fallback:

```powershell
C:\Users\79090\AppData\Local\Programs\Python\Python312\python.exe -m venv .venv-science
.\.venv-science\Scripts\python.exe -m pip install -r requirements-science.txt
.\.venv-science\Scripts\python.exe -m pytest
```

### Quantum chemistry and semiconductor TCAD

Two catalogue laboratories now dispatch real open-source calculations through the same local API:

- **Quantum chemistry:** RDKit ETKDG/MMFF94 builds a reproducible 3D conformer; PySCF in the isolated WSL environment evaluates RHF, PBE or B3LYP electronic structure and returns total/orbital energies, the HOMO–LUMO gap and dipole.
- **Semiconductor TCAD:** DEVSIM solves the finite-volume nonlinear equilibrium Poisson–Boltzmann system for a silicon p–n junction and returns the self-consistent potential, carrier densities and electric field.

The WSL environment lives at `/root/.matter-frontier-lab/chem-env` and uses [requirements-wsl-materials.txt](requirements-wsl-materials.txt). DEVSIM remains a CPU sparse solver; moving it wholesale to DirectML would change the validated numerical backend. RDKit/PySCF and DEVSIM results are clearly separated from the Three.js visualisation layer.

The integrated scientific routes are:

- vectorised evaluation and numerical force for the phenomenological Cornell
  potential;
- a circular binary-black-hole fallback integrated with SciPy using the
  leading-order Peters–Mathews radiation-reaction equation, followed by a
  clearly labelled fitted ringdown;
- EinsteinPy timelike test-particle geodesics in Schwarzschild or Kerr
  spacetime, returned with both geometrised and kilometre coordinates;
- PyCBC/LALSuite aligned-spin binary waveforms, official Einstein Toolkit
  GW150914 reference data, CompOSE dense-matter data, PYTHIA/HepMC3 collision
  events, Geant4 particle transport, and nuSQuIDS neutrino propagation.

Every scientific response includes a `provenance` object. PyCBC waveforms are
model waveforms rather than new numerical-relativity evolutions. The Einstein
Toolkit mode is a fixed, checksummed reference dataset and is never rescaled to
pretend that arbitrary slider values were simulated.

### PyCBC/LALSuite WSL waveform adapter

The Windows server can call an isolated Ubuntu WSL environment containing
PyCBC 2.4.2 and LALSuite 7.22. For supported two-body configurations it
generates both `h_plus` and `h_cross` with the NR-calibrated aligned-spin
`IMRPhenomD` approximant. If WSL is unavailable, the API explicitly falls back
to the SciPy Peters–Mathews solver and reports the reason in `provenance`.

The default WSL interpreter location is
`/root/.matter-frontier-lab/pycbc-venv/bin/python`; it can be overridden with
`MFL_PYCBC_PYTHON` and `MFL_PYCBC_WSL_DISTRO`.

### CompOSE equation of state

The `neutronMatter` backend route reads the original open CompOSE DS(CMF)-2
cold beta-equilibrium table (301 density points) and derives pressure and
energy density from the standard CompOSE Q1/Q7 definitions. SciPy PCHIP
interpolation supplies values at the selected density. The archive checksum,
source URL and model references are stored beside the data. This particular
table is fixed at T=0 MeV; a nonzero UI temperature is reported as not applied.

### PYTHIA 8 and HepMC3 event adapter

The collider workbench can invoke a compiled PYTHIA 8 worker in Ubuntu WSL for
proton/antiproton SoftQCD and proton HardQCD events. Final-state four-momenta,
PDG identifiers and charges are returned to the WebGL event display, and the
latest event is also written as a HepMC3 ASCII record. Ubuntu 20.04 supplies
legacy PYTHIA 8.186 and HepMC3 3.1.2, which are reported explicitly in every
result; unsupported beam/process combinations retain the educational fallback.

The worker is built in WSL with:

```bash
g++ -std=c++17 -O2 -I/usr/include/Pythia8 \
  scientific_backend/pythia_worker.cpp \
  -o /root/.matter-frontier-lab/bin/pythia_worker \
  -lpythia8 -llhapdfdummy -lHepMC3
```

### Geant4 transport adapter

Geant4 11.4.2 is installed in the isolated WSL prefix
`/root/.matter-frontier-lab/geant4-env`. The first adapter is a real serial
Monte-Carlo transport calculation using `FTFP_BERT`: a selectable primary
crosses a homogeneous finite material slab and returns energy deposition,
dispersion, secondary-track count and transport-step count. In the Proton card,
choose **Geant4 transport** to run the photon-in-silicon configuration. This is
not a complete detector or an accretion-disk simulation.

### nuSQuIDS neutrino propagation

nuSQuIDS 1.13.3 is installed in
`/root/.matter-frontier-lab/nusquids-env`. The Neutrino Lens card separates a
standard three-flavor nuSQuIDS calculation in vacuum/constant-density matter
from the project's hypothetical spin-dependent M-field Hamiltonian. nuSQuIDS
does not validate or implement that author-defined extra interaction.

### Einstein Toolkit reference data

The black-hole waveform selector includes the official GW150914 `l=2,m=2`
reference waveform from the Einstein Toolkit gallery. Its SHA-256 and source
are recorded in `scientific_data/einstein_toolkit/gw150914/METADATA.md`.
This fixed 36+29 solar-mass numerical-relativity dataset is distinct from the
adjustable PyCBC/LALSuite waveform mode. A fresh Einstein Toolkit evolution is
not run locally: the official gallery configuration requires about 98 GB of
memory and thousands of CPU core-hours.

### GPU policy on this computer

The machine contains an AMD Radeon RX 5500M (4 GB) and an integrated AMD GPU.
There is no CUDA device. AMD does not list the RX 5500M/mobile SKU in the
supported ROCm-on-WSL hardware matrix, so installing ROCm would create an
unsupported and potentially unstable configuration. Existing external packages
remain on CPU; Three.js/WebGL rendering continues to use the GPU.

An isolated **ONNX Runtime DirectML** path is active for scientific kernels that
are explicitly expressed as ONNX graphs. The first validation block applies a
dense discretized Hamiltonian `Y = H Ψ` on CPU and every DirectML adapter,
selects the fastest working adapter, compares outputs and reads the ONNX profile
to prove that `MatMul` ran on `DmlExecutionProvider`. On the tested
`N=3072, B=384` workload, the fastest adapter completed the timed kernel in
about 8.43 ms versus 34.19 ms on CPU (about 4.06× faster), with maximum relative
difference about `2.8e-6`. Smaller workloads can remain faster on CPU because
GPU dispatch overhead dominates. Open **DirectML GPU scientific test** in the
catalogue to repeat the benchmark locally. The API reports hardware and provider
status under `scientific.hardware` and `scientific.directml`.

The catalogue also contains a **GPU quantum-computer simulator**. It supports
Bell, GHZ, quantum-Fourier-transform, hardware-efficient variational circuits,
and a two-qubit Grover cloud-hardware demonstration
for 2–10 qubits. The simulator assembles an exact circuit unitary, applies its
real-block representation to a batch of state vectors through DirectML, repeats
the same ONNX graph on the CPU, and reports provider confirmation, fidelity,
normalisation error, timing and sampled measurement outcomes. This is an ideal
local state-vector simulator, not a quantum processing unit. Dense-unitary memory
scales as `O(4^n)`, which is why the Radeon RX 5500M mode is capped at ten qubits.

The Grover preset marks the computational basis state `|11>` and uses only two
qubits with H, X and CZ gates. A local run must first reproduce the expected
state on both CPU and DirectML. The result panel then exposes a credential-free
OpenQASM 2.0 circuit and a current Qiskit Runtime `SamplerV2` submission fragment.
Standalone copies are stored in
[`quantum-cloud-demo/grover_2q.qasm`](quantum-cloud-demo/grover_2q.qasm) and
[`quantum-cloud-demo/run_ibm_grover.py`](quantum-cloud-demo/run_ibm_grover.py).
The Python fragment selects an operational physical backend, transpiles the
circuit to that backend's ISA, and submits it only when the user runs the script
with their own saved IBM Quantum credentials. Generation of this fragment is not
evidence that a cloud job was submitted or validated on hardware. See the
[official Sampler examples](https://quantum.cloud.ibm.com/docs/en/guides/sampler-examples)
and [SamplerV2 API](https://quantum.cloud.ibm.com/docs/api/qiskit-ibm-runtime/sampler-v2).

The second production-shaped pilot, **GPU gravitational-wave ensemble**, runs
the leading-order quadrupole strain algebra `h=A f^(2/3) cos(phi)` for millions
of independent waveform samples. CPU and DirectML results are compared on
every request and the ONNX profile must assign the graph to
`DmlExecutionProvider`. This accelerates exported batch algebra; it does not
misrepresent DirectML as LALSuite waveform generation or numerical relativity.

The backend also publishes a hybrid acceleration registry. Geant4, PYTHIA,
nuSQuIDS, EinsteinPy and the installed PyCBC/LALSuite path retain validated CPU
implementations where no compatible AMD/DirectML backend exists. PYTHIA can be
parallelised across independent CPU event generators; PyCBC's documented GPU
schemes require CUDA/CuPy, and general Geant4 transport is distinct from the
experimental AdePT GPU transport project.

The **DirectML wave-field grid** is the first stencil/PDE workload. It evolves
the damped scalar equation `u_tt + gamma*u_t = c^2 (u_xx + u_yy)` with a
second-order centred scheme and enforces the 2D Courant stability bound
`C^2 <= 1/2`. On the local Radeon RX 5500M, a `768 x 768` grid for 24 time
steps (14,155,776 cell updates) measured about 12.05 ms on the fastest DirectML
adapter versus 92.94 ms on the ONNX CPU provider, approximately 7.71x faster.
The CPU/GPU fields are compared on every benchmark. This is a reusable scalar
field kernel, not an Einstein-equation or numerical-relativity solver.

The **DirectML 3D wave volume** extends the same validated method to a cubic
Cartesian grid with a six-neighbour Laplacian and the three-dimensional
stability bound `C^2 <= 1/3`. A representative `112^3` volume for 12 steps
(16,859,136 voxel updates) measured about 41.7 ms on DirectML versus 62.6 ms
on the CPU (about 1.50x), with relative CPU/GPU disagreement below `6e-7`.

The **GPU neutrino oscillation batch** validates the standard two-flavour
vacuum expression against the CPU for millions of independent `L/E` samples.
DirectML agrees to about `4e-7`, but this bandwidth-bound expression remains
slightly faster on the CPU of this machine. The hybrid dispatcher therefore
marks CPU as preferred; general matter/three-flavour evolution remains in
nuSQuIDS.

Click the backend badge in the application header to open the scientific
compute centre. It reports actual GPU, CPU, reference-data and not-installed
states. CarpetX/AMReX numerical relativity and GRMHD/ray tracing are explicitly
shown as not installed rather than represented by a decorative approximation.

```powershell
python server.py --port 8892
```

Then open `http://127.0.0.1:8892/` in the same computer's browser. `127.0.0.1` is the standard loopback address: it never reveals an external IP address and is not reachable from the internet.

On Windows, `start_qcd_neutrino_lab.bat` starts the local server. The `matter-lab/Start-MatterFrontierLab.ps1` and `matter-lab/Matter Frontier Lab Autostart.cmd` helpers are provided for a persistent per-user sign-in launch. They keep restarting the local Python server if it exits.

## Technology

- Vanilla JavaScript, HTML and CSS.
- [Three.js](https://threejs.org/) for the real-time 3D scenes, controls and glTF/USDZ loading.
- A small Python standard-library HTTP server and local educational solver API.
- Local glTF/USDZ/image assets for selected macro-object visualisations.

## Open resources and scientific software

The project uses and documents open resources in three distinct ways.

### Directly included or used by the application

- [Three.js](https://github.com/mrdoob/three.js) is loaded as the browser 3D framework.
- NASA public 3D/visual resources are used or referenced for selected Sun, Jupiter and black-hole/macro-object presentations. Asset provenance is retained in catalogue source links; NASA material remains subject to NASA media-use guidance.

### Linked research software and data pathways

The following ecosystems are used through local backend adapters or retained as
traceable future pathways. None is executed inside the browser itself:

- [PYTHIA 8](https://pythia.org/) for event generation and Lund string fragmentation.
- [HepMC3](https://gitlab.cern.ch/hepmc/HepMC3) as an event-record interchange layer.
- [Geant4](https://geant4.web.cern.ch/) is active for the slab particle-transport adapter.
- [nuSQuIDS](https://github.com/arguelles/nuSQuIDS) is active for standard neutrino propagation calculations.
- [CompOSE](https://compose.obspm.fr/) is active through the DS(CMF)-2 table; [MUSES](https://musesframework.io/) remains a future adapter.
- [MEEP](https://github.com/NanoComp/meep), [Einstein Toolkit](https://einsteintoolkit.org/), [GADGET-4](https://wwwmpa.mpa-garching.mpg.de/gadget4/), [CosmoLattice](https://cosmolattice.net/) and [AxionCAMB](https://github.com/dgrin1/axionCAMB) as referenced open simulation ecosystems for specialised catalogue topics.
- [Eric Bruneton's open black-hole shader](https://github.com/ebruneton/black_hole_shader) and its accompanying [technical paper](https://ebruneton.github.io/black_hole_shader/paper.pdf) as a reference for real-time Schwarzschild-inspired ray-bending visuals. It is not the non-public renderer used for *Interstellar* and does not replace numerical relativity.
- [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources) and the NASA resource pages linked from individual model cards.

Backend results identify their actual engine and limitations. Browser 3D scenes
remain lightweight educational representations and must not be presented as
direct spatial output of those scientific packages.

## Future direction: reproducible and cloud-quantum-assisted studies

The proposed roadmap is a staged, reproducible workflow:

1. Export each interactive preset to a versioned parameter record.
2. Evaluate candidate models first with classical open solvers and constrained numerical optimisation.
3. Use cloud quantum resources only for well-defined, small subproblems — for example variational ground-state estimates, constrained spin/lattice toy Hamiltonians, or quantum-inspired sampling benchmarks.
4. Compare every quantum result against classical baselines, uncertainty estimates and known physical constraints before ranking a hypothesis.
5. Record provider, backend, circuit/algorithm version, noise-mitigation strategy, shots, seeds and raw outputs so results can be reproduced.

This could eventually connect the lab to cloud platforms such as IBM Quantum, Azure Quantum or Amazon Braket through dedicated server-side adapters. Such integration would be exploratory: a cloud quantum result can help search a toy-model parameter space, but cannot by itself establish that a hypothetical form of matter is stable or physically real. Stability claims would still require validated effective theories, classical convergence checks, phenomenological constraints and, ultimately, experiment.

## Repository structure

```text
matter-lab/               Main Matter Frontier Lab interface and 3D scenes
neutrino-communication/   Standalone precursor communication visualisation
server.py                 Local HTTP server and educational solver API
index.html                Local portal page
start_qcd_neutrino_lab.bat
```

## Scientific and safety note

The words *hypothesis*, *theoretical*, and *catalogue-only* in the interface are intentional. A model may be visually compelling while still being unconfirmed, incomplete, or purely educational. Links in the catalogue are provided for further study and provenance, not as an assertion that the linked software validates the displayed hypothesis.

## License

Unless an individual file or imported asset specifies otherwise, the original code in this repository is released under the MIT License. Third-party software, papers, data and visual assets retain their own licences and attribution requirements; see [NOTICE.md](NOTICE.md).
