# CUDA-Q Shor demonstration

This demonstration is a deliberately small, inspectable implementation of
Shor order finding.  It factors `15` with base `2`; the order is `r=4`, and the
classical GCD boundary returns `3` and `5`.

## Provenance

The implementation follows the public architecture and CUDA-Q idioms of
NVIDIA's open tutorial:

- https://nvidia.github.io/cuda-quantum/latest/applications/python/shors.html
- https://github.com/NVIDIA/cuda-quantum (Apache License 2.0)
- Peter Shor's original algorithm: https://arxiv.org/abs/quant-ph/9508027

The local code is not copied as a detached documentation fragment.  The page
loads and annotates the versioned executable source at
`scientific_backend/cudaq_shor_demo.py`.

## Execution modes

```powershell
python scientific_backend/cudaq_shor_demo.py --preview
```

The preview verifies the classical control and post-processing boundaries and
does not claim quantum execution.

In a CUDA-Q environment:

```bash
python scientific_backend/cudaq_shor_demo.py --target auto --shots 4096
```

`auto` selects NVIDIA state-vector simulation when CUDA-Q can see a supported
NVIDIA GPU and otherwise uses `qpp-cpu`.  A GPU run is a simulation of qubits,
not a physical QPU.  CUDA-Q can target separately configured cloud QPUs, but a
provider account, credentials, compatible gate set and paid access may be
required.

## Scientific boundary

The modular multiplication circuit is compiled for `N=15, a=2`.  This makes
the eight-qubit circuit small enough to inspect, but it is not a general
modular-arithmetic implementation and cannot factor arbitrary integers or RSA
keys.  The browser animation computes the ideal phase-estimation distribution
for the documented period; it does not pretend that JavaScript is executing a
QPU job.
