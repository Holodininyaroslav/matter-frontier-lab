from __future__ import annotations

from typing import Any

from .directml_adapter import status as directml_status
from .gpu_waveform_adapter import status as waveform_status
from .gpu_wave_solver import status as wave_grid_status
from .gpu_wave_solver_3d import status as wave_grid_3d_status
from .gpu_neutrino_batch import status as neutrino_batch_status
from .gpu_quantum_simulator import status as quantum_simulator_status
from .gpu_multiquark_adapter import status as multiquark_gpu_status


def status() -> dict[str, Any]:
    directml = directml_status()
    waveform = waveform_status()
    wave_grid = wave_grid_status()
    wave_grid_3d = wave_grid_3d_status()
    neutrino_batch = neutrino_batch_status()
    quantum_simulator = quantum_simulator_status()
    multiquark_gpu = multiquark_gpu_status()
    gpu_ready = bool(directml.get("available"))
    engines = [
        {"package": "NumPy/SciPy custom kernels", "execution": "DirectML GPU + CPU reference", "gpu": gpu_ready, "strategy": "dense matrices and large independent arrays"},
        {"package": "PyCBC/LALSuite", "execution": "CPU in WSL", "gpu": False, "strategy": "PyCBC GPU schemes require CUDA/CuPy; use DirectML only for exported batch algebra"},
        {"package": "Geant4", "execution": "CPU in WSL", "gpu": False, "strategy": "general Geant4 transport is not transparently portable; AdePT is a separate GPU transport project"},
        {"package": "PYTHIA 8/HepMC3", "execution": "CPU in WSL", "gpu": False, "strategy": "parallel independent events with PythiaParallel/CPU threads"},
        {"package": "nuSQuIDS", "execution": "CPU in WSL", "gpu": False, "strategy": "retain validated solver; batch exported state algebra can use DirectML"},
        {"package": "EinsteinPy", "execution": "CPU", "gpu": False, "strategy": "adaptive geodesic integrator remains CPU; batch observables can use DirectML"},
        {"package": "CompOSE/SciPy", "execution": "CPU", "gpu": False, "strategy": "small monotone table interpolation is latency-bound and faster on CPU"},
        {"package": "Einstein Toolkit reference data", "execution": "data source", "gpu": False, "strategy": "no local evolution kernel is installed; GPU acceleration requires a separate CarpetX/AMReX build"},
        {"package": "Waveform ensemble kernel", "execution": "DirectML GPU + CPU reference", "gpu": bool(waveform.get("available")), "strategy": "batched quadrupole strain evaluation"},
        {"package": "Finite-difference wave grid", "execution": "DirectML GPU + CPU reference", "gpu": bool(wave_grid.get("available")), "strategy": "unrolled 2D stencil evolution"},
        {"package": "3D finite-difference wave volume", "execution": "DirectML GPU + CPU reference", "gpu": bool(wave_grid_3d.get("available")), "strategy": "unrolled Cartesian 3D stencil evolution"},
        {"package": "Neutrino oscillation batch", "execution": "CPU preferred; DirectML validated", "gpu": False, "strategy": "DirectML is numerically correct, but this bandwidth-bound analytic kernel is faster on the RX 5500M CPU path"},
        {"package": "RDKit + PySCF quantum chemistry", "execution": "RDKit on Windows CPU + PySCF/OpenBLAS in WSL", "gpu": False, "strategy": "3D conformer generation, molecular descriptors, Hartree-Fock and density-functional electronic structure"},
        {"package": "DEVSIM semiconductor TCAD", "execution": "DEVSIM/OpenBLAS CPU in WSL", "gpu": False, "strategy": "finite-volume nonlinear semiconductor equations; sparse solves remain on the validated CPU backend"},
        {"package": "Multi-Quark SystemVerilog architecture", "execution": "Python screening + generated RTL", "gpu": False, "strategy": "candidate constraints and a synthesizable FPGA/ASIC workload-compressor prototype"},
        {"package": "Multi-quark DirectML threshold kernel", "execution": "DirectML GPU + CPU reference", "gpu": bool(multiquark_gpu.get("available")), "strategy": "batched decay-threshold margins with provider-profile verification"},
        {"package": "Quantum state-vector simulator", "execution": "DirectML GPU + CPU reference", "gpu": bool(quantum_simulator.get("available")), "strategy": "exact ideal circuit-unitary evolution for 2–10 qubits"},
        {"package": "CarpetX / AMReX numerical relativity", "execution": "not installed", "gpu": False, "strategy": "requires a separate supported build and validated Einstein-equation initial data; reference waveform data is available"},
        {"package": "GRMHD accretion and relativistic ray tracing", "execution": "not installed", "gpu": False, "strategy": "requires a dedicated GRMHD state plus a metric-aware radiative-transfer/ray-tracing pipeline"},
    ]
    return {
        "available": gpu_ready,
        "engine": "hybrid-scientific-dispatch",
        "policy": "GPU where numerically suitable; validated CPU engine otherwise",
        "gpuPackages": sum(1 for engine in engines if engine["gpu"]),
        "totalPackages": len(engines),
        "engines": engines,
    }
