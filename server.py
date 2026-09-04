from __future__ import annotations

import argparse
import json
import math
import random
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from scientific_backend.pycbc_adapter import solve as solve_pycbc_waveform
from scientific_backend.pycbc_adapter import status as pycbc_status
from scientific_backend.pythia_adapter import solve as solve_pythia_event
from scientific_backend.pythia_adapter import status as pythia_status
from scientific_backend.geant4_adapter import solve as solve_geant4_transport
from scientific_backend.geant4_adapter import status as geant4_status
from scientific_backend.nusquids_adapter import solve as solve_nusquids
from scientific_backend.nusquids_adapter import status as nusquids_status
from scientific_backend.einstein_toolkit_adapter import solve as solve_einstein_toolkit_waveform
from scientific_backend.einstein_toolkit_adapter import status as einstein_toolkit_status
from scientific_backend.hardware_adapter import status as hardware_status
from scientific_backend.directml_adapter import solve as solve_directml
from scientific_backend.directml_adapter import status as directml_status
from scientific_backend.gpu_waveform_adapter import solve as solve_gpu_waveform
from scientific_backend.gpu_waveform_adapter import status as gpu_waveform_status
from scientific_backend.gpu_wave_solver import solve as solve_gpu_wave_grid
from scientific_backend.gpu_wave_solver import status as gpu_wave_grid_status
from scientific_backend.gpu_wave_solver_3d import solve as solve_gpu_wave_grid_3d
from scientific_backend.gpu_wave_solver_3d import status as gpu_wave_grid_3d_status
from scientific_backend.gpu_neutrino_batch import solve as solve_gpu_neutrino_batch
from scientific_backend.gpu_neutrino_batch import status as gpu_neutrino_batch_status
from scientific_backend.gpu_quantum_simulator import solve as solve_gpu_quantum_simulator
from scientific_backend.gpu_quantum_simulator import status as gpu_quantum_simulator_status
from scientific_backend.acceleration_registry import status as acceleration_status
from scientific_backend.chemistry_adapter import solve as solve_quantum_chemistry
from scientific_backend.chemistry_adapter import status as chemistry_status
from scientific_backend.devsim_adapter import solve as solve_semiconductor_tcad
from scientific_backend.devsim_adapter import status as devsim_status
from scientific_backend.multiquark_discovery import solve as solve_multiquark_discovery
from scientific_backend.multiquark_discovery import status as multiquark_discovery_status
from scientific_backend.discovery_chain import chain as discovery_chain
from scientific_backend.discovery_chain import status as discovery_chain_status


try:
    from scientific_backend import (
        capabilities as scientific_capabilities,
        solve_binary_black_hole as scientific_black_hole_merger,
        solve_cornell_potential as scientific_cornell_potential,
        solve_einsteinpy_geodesic as scientific_einsteinpy_geodesic,
    )
    from scientific_backend.compose_adapter import solve as solve_compose_eos
    from scientific_backend.compose_adapter import status as compose_status

    SCIENTIFIC_IMPORT_ERROR: str | None = None
except Exception as exc:  # Keep the zero-dependency server as a safe fallback.
    scientific_capabilities = None
    scientific_black_hole_merger = None
    scientific_cornell_potential = None
    scientific_einsteinpy_geodesic = None
    solve_compose_eos = None
    compose_status = None
    SCIENTIFIC_IMPORT_ERROR = f"{type(exc).__name__}: {exc}"


ROOT = Path(__file__).resolve().parent


def science_status() -> dict[str, Any]:
    if scientific_capabilities is None:
        return {
            "available": False,
            "engine": "python-standard-library-fallback",
            "error": SCIENTIFIC_IMPORT_ERROR or "scientific backend was not imported",
        }
    try:
        status = scientific_capabilities()
        status["pycbcWsl"] = pycbc_status()
        status["compose"] = compose_status() if compose_status else {"available": False}
        status["pythiaWsl"] = pythia_status()
        status["geant4Wsl"] = geant4_status()
        status["nusquidsWsl"] = nusquids_status()
        status["einsteinToolkitData"] = einstein_toolkit_status()
        status["hardware"] = hardware_status()
        status["directml"] = directml_status()
        if status["directml"].get("available") and "DmlExecutionProvider" in status["directml"].get("providers", []):
            # Provider availability is the authoritative compute capability signal.
            # WMI adapter enumeration can fail in a long-running watchdog process
            # even though DirectML kernels are executing and profile-confirmed.
            status["hardware"]["scientificCompute"] = "directml-gpu"
            status["hardware"]["directmlVerified"] = True
        status["gpuWaveform"] = gpu_waveform_status()
        status["gpuWaveGrid"] = gpu_wave_grid_status()
        status["gpuWaveGrid3d"] = gpu_wave_grid_3d_status()
        status["gpuNeutrinoBatch"] = gpu_neutrino_batch_status()
        status["gpuQuantumSimulator"] = gpu_quantum_simulator_status()
        status["acceleration"] = acceleration_status()
        status["chemistry"] = chemistry_status()
        status["devsim"] = devsim_status()
        status["multiquarkDiscovery"] = multiquark_discovery_status()
        status["discoveryChain"] = discovery_chain_status()
        return status
    except Exception as exc:
        return {"available": False, "engine": "python-standard-library-fallback", "error": f"{type(exc).__name__}: {exc}"}


def with_science_fallback(factory: Any, fallback: Any, values: dict[str, Any]) -> dict[str, Any]:
    if factory is None:
        result = fallback(values)
        result["provenance"] = {
            "engine": "python-standard-library-fallback",
            "scientificBackendError": SCIENTIFIC_IMPORT_ERROR,
            "validatedExternalSimulation": False,
        }
        return result
    try:
        return factory(values)
    except Exception as exc:
        result = fallback(values)
        result["provenance"] = {
            "engine": "python-standard-library-fallback",
            "scientificBackendError": f"{type(exc).__name__}: {exc}",
            "validatedExternalSimulation": False,
        }
        return result


def solve_neutrino_lens(values: dict[str, float], points: int = 120) -> dict[str, Any]:
    energy = max(float(values.get("neutrinoEnergy", 10.0)), 0.01)
    rho = float(values.get("density", 0.0))
    anisotropy = float(values.get("anisotropy", 0.0))
    coupling = float(values.get("spinCoupling", 0.0))
    length = float(values.get("lensLength", 38.0))
    ox = 0.085 * coupling * rho * anisotropy / math.sqrt(energy)
    oy = 0.018 * coupling * rho * (1.0 - anisotropy) / math.sqrt(energy)
    oz = 0.032 / energy + 0.0045 * rho
    omega = max(math.sqrt(ox * ox + oy * oy + oz * oz), 1e-12)
    nx, ny, nz = ox / omega, oy / omega, oz / omega
    data = []
    for index in range(points):
        x = length * index / (points - 1)
        angle = 2.0 * omega * x
        c, s = math.cos(angle), math.sin(angle)
        bx = ny * s + nx * nz * (1.0 - c)
        by = -nx * s + ny * nz * (1.0 - c)
        bz = c + nz * nz * (1.0 - c)
        data.append({"x": x, "primary": (1.0 - bz) / 2.0, "secondary": (1.0 + bz) / 2.0, "bx": bx, "by": by, "bz": bz})
    final = data[-1]
    return {
        "kind": "probability",
        "xLabel": "Путь в линзе, m",
        "yLabel": "Вероятность",
        "primaryLabel": "P(helicity flip)",
        "secondaryLabel": "P(survival)",
        "data": data,
        "metrics": [["Переворот helicity", final["primary"], "%"], ["Сохранение", final["secondary"], "%"], ["|Ω|", omega, "m⁻¹"]],
        "state": final,
        "backendHint": "nuSQuIDS-compatible effective Hamiltonian",
    }


def solve_atomic_photon(values: dict[str, float], helium: bool, points: int = 120) -> dict[str, Any]:
    energy = max(float(values.get("probeEnergy", 21.22 if helium else 10.2)), 0.01)
    ionization = 24.587 if helium else 13.598
    resonances = (
        [(20.62, 2, 1.0), (21.22, 3, 0.32), (23.09, 4, 0.12)]
        if helium
        else [(ionization * (1.0 - 1.0 / n**2), n, {2: 0.4162, 3: 0.0791, 4: 0.0290, 5: 0.0139}[n]) for n in (2, 3, 4, 5)]
    )
    linewidth = 0.16 if helium else 0.09
    nearest = min(resonances, key=lambda line: abs(line[0] - energy))
    process = "elastic"
    target_n = 1
    electron_energy = 0.0
    if energy >= ionization:
        process = "ionization"
        electron_energy = energy - ionization
    elif abs(nearest[0] - energy) <= linewidth * 2.2:
        process = "excitation"
        target_n = nearest[1]
    data = []
    for index in range(points):
        x = 1.0 + ((34.0 if helium else 20.0) - 1.0) * index / (points - 1)
        excitation = 0.0
        for line_energy, n_value, strength in resonances:
            gamma = linewidth * (1.0 + n_value * 0.08)
            excitation += strength * gamma * gamma / ((x - line_energy) ** 2 + gamma * gamma)
        continuum = 0.8 * (ionization / x) ** 3 * math.sqrt(1.0 - ionization / x) if x > ionization else 0.0
        data.append({"x": x, "primary": excitation + continuum, "secondary": continuum})
    process_label = "Ионизация" if process == "ionization" else f"Возбуждение 1s → n={target_n}" if process == "excitation" else "Упругое рассеяние"
    return {
        "kind": "atomic-spectrum",
        "xLabel": "Энергия фотона Eγ, eV",
        "yLabel": "Относительный отклик",
        "primaryLabel": "Спектр поглощения / ионизации",
        "secondaryLabel": "Континуум ионизации",
        "data": data,
        "metrics": [["Процесс", process_label, ""], ["Порог ионизации", ionization, "eV"], ["Kₑ", electron_energy, "eV"]],
        "event": {"process": process, "targetN": target_n, "electronEnergy": electron_energy, "photonEnergy": energy, "threshold": ionization, "resonanceEnergy": nearest[0]},
        "backendHint": "Geant4/EPDL adapter contract",
    }


def solve_dibaryon(values: dict[str, float], omega: bool, points: int = 120) -> dict[str, Any]:
    attraction = float(values.get("attraction", 34.0 if omega else 28.0))
    interaction_range = float(values.get("range", 1.27 if omega else 1.15))
    core = float(values.get("coreStrength", 38.0 if omega else 48.0))
    data = []
    minimum = {"x": 0.0, "primary": float("inf")}
    for index in range(points):
        radius = 0.18 + 4.82 * index / (points - 1)
        repulsive = core * math.exp(-(radius / 0.42) ** 2)
        attractive = attraction * math.exp(-(radius / interaction_range) ** 2)
        point = {"x": radius, "primary": repulsive - attractive, "secondary": -attractive}
        if point["primary"] < minimum["primary"]:
            minimum = point
        data.append(point)
    binding = max(0.0, -minimum["primary"] * (0.11 if omega else 0.055))
    return {
        "kind": "binding",
        "xLabel": "Расстояние r, fm",
        "yLabel": "V(r), MeV",
        "primaryLabel": "Эффективный потенциал",
        "secondaryLabel": "Притягивающая часть",
        "data": data,
        "metrics": [["V min", minimum["primary"], "MeV"], ["r min", minimum["x"], "fm"], ["Оценка B", binding, "MeV"]],
        "backendHint": "HAL QCD potential-table adapter contract",
    }


def solve_eos(model: str, values: dict[str, float], points: int = 120) -> dict[str, Any]:
    bag_root = float(values.get("bag", 155.0))
    bag = (bag_root / 155.0) ** 4 * 58.0
    gap = float(values.get("pairingGap", 0.0))
    strange = float(values.get("strangeMass", 100.0))
    coupling = float(values.get("coupling", values.get("vectorCoupling", values.get("alphaS", 0.0))))
    data = []
    cs2 = 1.0 / 3.0
    for index in range(points):
        density = 0.35 + 9.65 * index / (points - 1)
        phase_fraction = 0.0
        if model in {"neutronMatter", "hyperonMatter", "kaonCondensate"}:
            gamma = float(values.get("gamma", 2.35))
            hyperon_softening = 1.0 - 0.34 * float(values.get("hyperonFraction", 0.0)) if model == "hyperonMatter" else 1.0
            onset = float(values.get("onsetDensity", 3.6))
            condensate = float(values.get("condensateFraction", 0.0)) / (1.0 + math.exp(-(density - onset) * 5.0)) if model == "kaonCondensate" else 0.0
            pressure = 18.0 * density**gamma * hyperon_softening * (1.0 - 0.42 * condensate)
            epsilon = 150.0 * density + pressure / (gamma - 1.0)
            cs2 = min(0.82, gamma * pressure / max(epsilon + pressure, 1.0))
        elif model == "qgp":
            temperature = 100.0 + density * 54.0
            ideal = 0.0000108 * 47.5 * temperature**4
            pressure = ideal * (1.0 - 0.36 * coupling)
            epsilon = 3.0 * ideal * (1.0 + 0.06 * coupling)
            cs2 = pressure / epsilon
        elif model in {"quarkyonic", "qhc21"}:
            center = float(values.get("crossoverDensity", 3.2))
            width = max(float(values.get("crossoverWidth", 0.6)), 0.05)
            weight = 0.5 * (1.0 + math.tanh((density - center) / width))
            phase_fraction = weight
            hadron_pressure = 20.0 * density**2.25
            quark_pressure = 42.0 * density**1.38 + (float(values.get("vectorCoupling", 1.0)) * density**2 * 8.0 if model == "qhc21" else 0.0)
            pressure = hadron_pressure * (1.0 - weight) + quark_pressure * weight
            epsilon = 155.0 * density + pressure * (1.05 + 0.75 * (1.0 - weight))
            cs2 = min(0.78, max(0.12, pressure / max(epsilon, 1.0) * (1.2 + 0.4 * weight)))
        else:
            mu = 270.0 + density * 48.0
            base = 0.0000105 * 3.0 * mu**4 / (4.0 * math.pi**2)
            mass_penalty = 0.00014 * strange**2 * mu**2 / math.pi**2
            phase_pairing = 0.62 if model == "loff" else 0.52 if model == "gCFL" else 0.9 if model == "cflKaon" else 1.0
            mismatch_penalty = float(values.get("mismatch", 0.0)) * density * (0.28 if model in {"loff", "gCFL"} else 0.0)
            condensate_bonus = float(values.get("condensateFraction", 0.0)) * density * 18.0 if model == "cflKaon" else 0.0
            pair_bonus = 0.00022 * gap**2 * mu**2 / math.pi**2 * phase_pairing
            vector_bonus = coupling * density**2 * 18.0 if model == "njl" else 0.0
            pressure = max(0.0, base - bag - mass_penalty + pair_bonus + vector_bonus + condensate_bonus - mismatch_penalty)
            epsilon = max(1.0, 3.0 * base + bag + mass_penalty + pair_bonus + vector_bonus * 0.45 + mismatch_penalty * 0.35)
            cs2 = min(0.72, max(0.08, pressure / max(epsilon, 1.0) + vector_bonus * 0.0008))
        data.append({"x": epsilon, "primary": pressure, "secondary": density, "phaseFraction": phase_fraction})
    for index, point in enumerate(data):
        previous = data[max(0, index - 1)]
        following = data[min(len(data) - 1, index + 1)]
        derivative = (following["primary"] - previous["primary"]) / max(following["x"] - previous["x"], 1e-9)
        point["cs2"] = max(0.0, min(1.0, derivative if math.isfinite(derivative) else 0.0))
    last = data[-1]
    has_working_mu = "muB" in values
    working_density = max(0.35, min(10.0, 1.0 + (float(values.get("muB", 3189.0)) - 939.0) / 250.0)) if has_working_mu else 10.0
    working = data[round((working_density - 0.35) / 9.65 * (len(data) - 1))]
    crossover = model in {"quarkyonic", "qhc21"}
    return {
        "kind": "eos",
        "xLabel": "Энергоплотность ε, arb.",
        "yLabel": "Давление P, arb.",
        "primaryLabel": "P(ε)",
        "secondaryLabel": "n/n₀",
        "data": data,
        "metrics": (
            [["P @ μB", working["primary"], "arb."], ["cₛ²/c²", working["cs2"], ""], ["Кварковая доля", working["phaseFraction"], "%"]]
            if crossover
            else [["P max", last["primary"], "arb."], ["cₛ²/c²", last["cs2"], ""], ["Backend", 1.0, "local"]]
        ),
        "state": {"current": working, "density": working["secondary"], "soundSpeed2": working["cs2"], "quarkFraction": working["phaseFraction"]},
        "backendHint": "MUSES/CompOSE adapter contract",
    }


def solve_strangelet(values: dict[str, float], points: int = 120) -> dict[str, Any]:
    selected_a = float(values.get("baryonNumber", 72.0))
    bag_penalty = (float(values.get("bag", 155.0)) - 145.0) * 0.55
    surface = float(values.get("surfaceEnergy", 28.0))
    pairing_bonus = 0.075 * float(values.get("pairingGap", 0.0))

    def energy_per_baryon(a: float) -> float:
        return 875.0 + bag_penalty + surface / a ** (1.0 / 3.0) + 52.0 / a ** (2.0 / 3.0) - pairing_bonus

    data = []
    for index in range(points):
        a = 4.0 + index * 296.0 / (points - 1)
        energy = energy_per_baryon(a)
        data.append({"x": a, "primary": energy, "secondary": 930.0 - energy})
    selected = energy_per_baryon(selected_a)
    return {
        "kind": "stability",
        "xLabel": "Барионное число A",
        "yLabel": "E/A, MeV",
        "primaryLabel": "Liquid-drop estimate",
        "secondaryLabel": "930 − E/A",
        "data": data,
        "metrics": [["E/A", selected, "MeV"], ["Порог Fe/Ni", 930.0, "MeV"], ["Δ устойчивости", 930.0 - selected, "MeV"]],
        "backendHint": "finite-size SQM adapter contract",
    }


def solve_confinement(values: dict[str, float], points: int = 120) -> dict[str, Any]:
    alpha = float(values.get("alphaS", 0.35))
    sigma = float(values.get("stringTension", 0.9))
    data = []
    for index in range(points):
        radius = 0.08 + 1.72 * index / (points - 1)
        potential = -4.0 * alpha / (3.0 * radius) + sigma * radius
        data.append({"x": radius, "primary": potential, "secondary": sigma * radius})
    return {
        "kind": "potential",
        "xLabel": "Расстояние r, fm",
        "yLabel": "V(r), GeV",
        "primaryLabel": "Cornell potential",
        "secondaryLabel": "Линейный член",
        "data": data,
        "metrics": [["αₛ", alpha, ""], ["σ", sigma, "GeV/fm"], ["Backend", 1.0, "local"]],
        "backendHint": "lattice-QCD table adapter contract",
    }


def solve_string_breaking(values: dict[str, float], model: str, points: int = 120) -> dict[str, Any]:
    alpha = float(values.get("alphaS", 0.35))
    kappa = max(float(values.get("stringTension", 0.9)), 0.01)
    pair_mass = max(float(values.get("constituentMass", 0.33)), 0.01)
    separation = max(float(values.get("separation", 0.8)), 0.05)
    threshold = 2.0 * pair_mass / kappa
    string_energy = kappa * separation
    excess = max(0.0, string_energy - 2.0 * pair_mass)
    schwinger = math.exp(-math.pi * pair_mass * pair_mass / kappa)
    probability = schwinger * (1.0 - math.exp(-4.5 * excess))
    max_r = max(4.5, threshold * 2.1)
    data = []
    for index in range(points):
        radius = 0.08 + (max_r - 0.08) * index / (points - 1)
        data.append({"x": radius, "primary": -4.0 * alpha / (3.0 * radius) + kappa * radius, "secondary": kappa * radius})
    current = min(data, key=lambda point: abs(point["x"] - separation))
    return {
        "kind": "string-breaking",
        "xLabel": "Разделение r, fm",
        "yLabel": "V(r), GeV",
        "primaryLabel": "Cornell + string breaking threshold",
        "secondaryLabel": "κr",
        "data": data,
        "metrics": [["Энергия струны", string_energy, "GeV"], ["Порог r_break", threshold, "fm"], ["Вес q-q̄", probability, "%"]],
        "state": {"current": current, "separation": separation, "stringEnergy": string_energy, "thresholdDistance": threshold, "pairProbability": probability},
        "event": {"process": "stringBreak", "separation": separation, "thresholdDistance": threshold, "pairMass": pair_mass, "kappa": kappa, "pairProbability": probability, "parent": model},
        "backendHint": "PYTHIA 8 Lund-fragmentation adapter",
    }


def collision_track(kind: str, charge: int, phi: float, theta: float, momentum: float, origin: list[float] | None = None, **extra: Any) -> dict[str, Any]:
    return {"type": kind, "charge": charge, "phi": phi, "theta": theta, "momentum": momentum, "origin": origin or [0.0, 0.0, 0.0], **extra}


def add_balanced_soft_tracks(tracks: list[dict[str, Any]], rng: random.Random, pairs: int, momentum_scale: float = 2.2) -> None:
    for _ in range(pairs):
        phi = rng.random() * 2.0 * math.pi
        eta = (rng.random() * 2.0 - 1.0) * 2.35
        theta = 2.0 * math.atan(math.exp(-eta))
        momentum = 0.18 - math.log(max(1.0 - rng.random(), 1e-8)) * momentum_scale
        charge = 1 if rng.random() > 0.5 else -1
        tracks.append(collision_track("chargedHadron", charge, phi, theta, momentum))
        tracks.append(collision_track("chargedHadron", -charge, phi + math.pi, math.pi - theta, momentum * (0.94 + rng.random() * 0.12)))


COLLIDER_BEAMS: dict[str, dict[str, Any]] = {
    "proton": {"label": "p", "pdg": 2212, "kind": "hadron", "charge": 1},
    "antiproton": {"label": "p̄", "pdg": -2212, "kind": "hadron", "charge": -1},
    "neutron": {"label": "n", "pdg": 2112, "kind": "hadron", "charge": 0, "conjugate": "antineutron"},
    "antineutron": {"label": "n̄", "pdg": -2112, "kind": "hadron", "charge": 0, "conjugate": "neutron"},
    "hyperon": {"label": "Λ", "pdg": 3122, "kind": "hadron", "charge": 0, "conjugate": "antihyperon"},
    "antihyperon": {"label": "Λ̄", "pdg": -3122, "kind": "hadron", "charge": 0, "conjugate": "hyperon"},
    "pionPlus": {"label": "π⁺", "pdg": 211, "kind": "hadron", "charge": 1},
    "pionMinus": {"label": "π⁻", "pdg": -211, "kind": "hadron", "charge": -1},
    "electron": {"label": "e⁻", "pdg": 11, "kind": "lepton", "charge": -1, "conjugate": "positron"},
    "positron": {"label": "e⁺", "pdg": -11, "kind": "lepton", "charge": 1, "conjugate": "electron"},
    "muonMinus": {"label": "μ⁻", "pdg": 13, "kind": "lepton", "charge": -1, "conjugate": "muonPlus"},
    "muonPlus": {"label": "μ⁺", "pdg": -13, "kind": "lepton", "charge": 1, "conjugate": "muonMinus"},
    "photon": {"label": "γ", "pdg": 22, "kind": "photon", "charge": 0},
}


def resolve_workbench(values: dict[str, Any]) -> dict[str, Any]:
    beam_a_id = str(values.get("beamA", "proton"))
    beam_b_id = str(values.get("beamB", "proton"))
    beam_a = COLLIDER_BEAMS.get(beam_a_id, COLLIDER_BEAMS["proton"])
    beam_b = COLLIDER_BEAMS.get(beam_b_id, COLLIDER_BEAMS["proton"])
    requested = str(values.get("processMode", "auto"))
    allowed: list[str] = []
    automatic: str | None = None
    if beam_a["kind"] == "hadron" and beam_b["kind"] == "hadron":
        conjugate_pair = beam_a.get("conjugate") == beam_b_id or beam_b.get("conjugate") == beam_a_id or {beam_a_id, beam_b_id} == {"proton", "antiproton"}
        allowed, automatic = (["annihilation", "softQCD", "hardQCD"], "annihilation") if conjugate_pair else (["softQCD", "hardQCD"], "softQCD")
    elif {beam_a["kind"], beam_b["kind"]} == {"lepton", "hadron"}:
        allowed, automatic = ["dis"], "dis"
    elif {beam_a["kind"], beam_b["kind"]} == {"photon", "hadron"}:
        allowed, automatic = ["photoproduction"], "photoproduction"
    elif beam_a["kind"] == "photon" and beam_b["kind"] == "photon":
        allowed, automatic = ["pairProduction"], "pairProduction"
    elif beam_a["kind"] == "lepton" and beam_b["kind"] == "lepton" and beam_a.get("conjugate") == beam_b_id:
        allowed, automatic = ["annihilation"], "annihilation"
    mode = automatic if requested == "auto" or requested not in allowed else requested
    labels = {"softQCD": "Soft QCD / minimum-bias", "hardQCD": "Hard QCD / dijet", "annihilation": "baryon–antibaryon annihilation → hadrons" if beam_a["kind"] == "hadron" else "γ*/Z annihilation", "dis": "deep-inelastic scattering", "photoproduction": "photoproduction", "pairProduction": "γγ pair production"}
    return {"supported": automatic is not None, "mode": mode, "processLabel": labels.get(mode, "unsupported beam pair"), "beamA": beam_a, "beamB": beam_b, "beamAId": beam_a_id, "beamBId": beam_b_id, "beamPair": f"{beam_a['label']} ↔ {beam_b['label']}", "reason": "" if automatic else "Unsupported by the current fast event generator"}


def solve_collision(values: dict[str, Any], model: str, points: int = 120) -> dict[str, Any]:
    legacy_mode = {
        "ppMinimumBias": "minimumBias",
        "ppDijet": "dijet",
        "ppHiggsGammaGamma": "higgsDiphoton",
        "ppZPrime": "zPrime",
        "ppHiddenValley": "hiddenValley",
    }
    setup = resolve_workbench(values) if model == "colliderWorkbench" else {"supported": True, "mode": legacy_mode[model], "processLabel": legacy_mode[model], "beamA": COLLIDER_BEAMS["proton"], "beamB": COLLIDER_BEAMS["proton"], "beamAId": "proton", "beamBId": "proton", "beamPair": "p ↔ p", "reason": ""}
    mode = setup["mode"]
    seed = int(values.get("eventSeed", 1))
    rng = random.Random(seed)
    beam_energy = float(values.get("beamEnergy", 13.6))
    magnetic_field = float(values.get("detectorField", 3.8))
    tracks: list[dict[str, Any]] = []
    vertices = [[0.0, 0.0, 0.0]]
    if not setup["supported"]:
        data = [{"x": -math.pi + 2.0 * math.pi * index / (points - 1), "primary": 0.0, "secondary": 0.0} for index in range(points)]
        return {"kind": "collision-event", "xLabel": "Азимут φ, rad", "yLabel": "Σp, GeV", "primaryLabel": "Unsupported beam pair", "secondaryLabel": "charged multiplicity", "data": data, "metrics": [["√s", beam_energy, "TeV"], ["N charged", 0, "tracks"], ["Σp visible", 0, "GeV"]], "state": {**setup, "trackCount": 0, "charged": 0, "magneticField": magnetic_field}, "event": {"process": "collision", "mode": None, "tracks": [], "vertices": vertices, "beamEnergy": beam_energy, "magneticField": magnetic_field, "seed": seed, "beamA": setup["beamA"]["pdg"], "beamB": setup["beamB"]["pdg"]}, "backendHint": "Select a PYTHIA-compatible beam pair"}
    if mode in {"minimumBias", "softQCD"}:
        overlap = max(0.18, 1.0 - float(values.get("impactParameter", 0.0)) / 2.15)
        pairs = round((7.0 + 5.3 * math.log(max(beam_energy, 1.0))) * overlap + rng.random() * 5.0)
        add_balanced_soft_tracks(tracks, rng, pairs, 1.25 + beam_energy * 0.05)
    elif mode in {"dijet", "hardQCD", "photoproduction"}:
        axis = rng.random() * 2.0 * math.pi
        hard_scale = float(values.get("hardScale", 90.0))
        for jet in range(2):
            jet_axis = axis + jet * math.pi
            fragments = 11 + int(rng.random() * 7)
            for index in range(fragments):
                phi = jet_axis + rng.gauss(0.0, 0.13)
                theta = math.pi / 2.0 + rng.gauss(0.0, 0.18)
                momentum = max(0.6, hard_scale / fragments * (0.35 + rng.random() * 1.25))
                neutral = index % 5 == 0
                tracks.append(collision_track("neutralHadron" if neutral else "chargedHadron", 0 if neutral else (1 if index % 2 else -1), phi, theta, momentum, jet=jet))
        add_balanced_soft_tracks(tracks, rng, 5, 1.4)
        if mode == "photoproduction":
            tracks.append(collision_track("neutralHadron", 0, axis + math.pi / 2.0, 0.16, max(1.0, hard_scale * 0.18), remnant=True))
    elif mode in {"higgsDiphoton", "zPrime"}:
        phi = rng.random() * 2.0 * math.pi
        theta = 0.55 + rng.random() * (math.pi - 1.1)
        mass = float(values.get("resonanceMass", 125.25 if mode == "higgsDiphoton" else 1800.0))
        kind = "photon" if mode == "higgsDiphoton" else "muon"
        charge = 0 if kind == "photon" else 1
        tracks.append(collision_track(kind, charge, phi, theta, mass / 2.0, primary=True))
        tracks.append(collision_track(kind, -charge, phi + math.pi, math.pi - theta, mass / 2.0, primary=True))
        add_balanced_soft_tracks(tracks, rng, 5 if kind == "photon" else 4, 1.2)
    elif mode == "annihilation" and setup["beamA"]["kind"] == "hadron":
        add_balanced_soft_tracks(tracks, rng, 8 + rng.randrange(10), max(0.8, beam_energy * 0.7))
        phi = rng.random() * 2.0 * math.pi
        tracks.append(collision_track("photon", 0, phi, math.pi / 2.0, max(0.3, beam_energy * 2.0), primary=True))
        tracks.append(collision_track("neutralHadron", 0, phi + math.pi, math.pi / 2.0, max(0.3, beam_energy * 1.6), primary=True))
    elif mode in {"annihilation", "pairProduction"}:
        phi = rng.random() * 2.0 * math.pi
        theta = 0.38 + rng.random() * (math.pi - 0.76)
        momentum = max(1.0, beam_energy * 1000.0 / 2.0)
        tracks.append(collision_track("muon", 1, phi, theta, momentum, primary=True))
        tracks.append(collision_track("muon", -1, phi + math.pi, math.pi - theta, momentum, primary=True))
    elif mode == "dis":
        phi = rng.random() * 2.0 * math.pi
        theta = 0.32 + rng.random() * 0.72
        hard_scale = max(1.0, float(values.get("hardScale", 45.0)))
        lepton_id = setup["beamAId"] if setup["beamA"]["kind"] == "lepton" else setup["beamBId"]
        lepton_type = "muon" if str(lepton_id).startswith("muon") else "positron" if lepton_id == "positron" else "electron"
        tracks.append(collision_track(lepton_type, COLLIDER_BEAMS[lepton_id]["charge"], phi, theta, hard_scale, primary=True, scatteredLepton=True))
        jet_axis = phi + math.pi
        for index in range(14):
            neutral = index % 5 == 0
            tracks.append(collision_track("neutralHadron" if neutral else "chargedHadron", 0 if neutral else (1 if index % 2 else -1), jet_axis + rng.gauss(0.0, 0.18), math.pi - theta + rng.gauss(0.0, 0.2), max(0.35, hard_scale / 14.0 * (0.4 + rng.random())), currentJet=True))
        tracks.append(collision_track("neutralHadron", 0, jet_axis, 0.12, hard_scale * 0.28, remnant=True))
    else:
        base_length = max(1.0, float(values.get("decayLength", 78.0))) / 34.0
        for vertex_index in range(3):
            phi = rng.random() * 2.0 * math.pi
            distance = base_length * (0.65 + rng.random() * 0.8)
            origin = [math.cos(phi) * distance, rng.gauss(0.0, 0.18), math.sin(phi) * distance]
            vertices.append(origin)
            for index in range(6):
                tracks.append(collision_track("chargedHadron", 1 if index % 2 else -1, phi + rng.gauss(0.0, 0.42), math.pi / 2.0 + rng.gauss(0.0, 0.35), 2.0 + rng.random() * 18.0, origin, displaced=True, vertex=vertex_index + 1))
        add_balanced_soft_tracks(tracks, rng, 4, 1.0)
    data = [{"x": -math.pi + 2.0 * math.pi * index / (points - 1), "primary": 0.0, "secondary": 0.0} for index in range(points)]
    for track in tracks:
        wrapped = (track["phi"] + math.pi) % (2.0 * math.pi) - math.pi
        index = max(0, min(points - 1, round((wrapped + math.pi) / (2.0 * math.pi) * (points - 1))))
        data[index]["primary"] += track["momentum"]
        data[index]["secondary"] += abs(track["charge"])
    charged = sum(1 for track in tracks if track["charge"] != 0)
    visible_energy = sum(track["momentum"] for track in tracks)
    return {
        "kind": "collision-event",
        "xLabel": "Азимут φ, rad",
        "yLabel": "Σp, GeV",
        "primaryLabel": f"Event energy flow · {setup['processLabel']}",
        "secondaryLabel": "charged multiplicity",
        "data": data,
        "metrics": [["√s", beam_energy, "TeV"], ["N charged", charged, "tracks"], ["Σp visible", visible_energy, "GeV"]],
        "state": {"mode": mode, "trackCount": len(tracks), "charged": charged, "magneticField": magnetic_field, "supported": True, "processLabel": setup["processLabel"], "beamPair": setup["beamPair"], "reason": ""},
        "event": {"process": "collision", "mode": mode, "tracks": tracks, "vertices": vertices, "beamEnergy": beam_energy, "magneticField": magnetic_field, "seed": seed, "beamA": setup["beamA"]["pdg"], "beamB": setup["beamB"]["pdg"], "beamPair": setup["beamPair"]},
        "backendHint": "PYTHIA 8/HepMC3 + Geant4 adapter",
    }


def solve_black_hole_merger(values: dict[str, Any], points: int = 180) -> dict[str, Any]:
    """Analytic binary-BH preview; intentionally not a numerical-relativity evolution."""
    m1 = max(float(values.get("binaryMassA", 36.0)), 1.0)
    m2 = max(float(values.get("binaryMassB", 29.0)), 1.0)
    total = m1 + m2
    eta = m1 * m2 / (total * total)
    chirp_mass = (m1 * m2) ** 0.6 / total ** 0.2
    separation = max(float(values.get("initialSeparation", 28.0)), 6.0)
    spin_a = max(-0.99, min(0.99, float(values.get("spinA", 0.0))))
    spin_b = max(-0.99, min(0.99, float(values.get("spinB", 0.0))))
    effective_spin = (spin_a * m1 * m1 + spin_b * m2 * m2) / (total * total)
    radiated_fraction = 0.028 + 0.065 * 4.0 * eta
    remnant_mass = total * (1.0 - radiated_fraction)
    remnant_spin = max(0.0, min(0.98, 0.45 + 1.15 * eta + 0.42 * effective_spin))
    merger_frequency = 4397.0 / total * (6.0 / separation) ** 1.5
    data: list[dict[str, float]] = []
    for index in range(points):
        moment = -1.0 + index * 1.22 / (points - 1)
        progress = max(0.0, min(1.0, (moment + 1.0) / 0.98))
        frequency = merger_frequency * (0.18 + 1.9 * progress * progress)
        phase = 2.0 * math.pi * frequency * (moment + 1.0) * (0.22 + 0.78 * progress)
        ringdown = math.exp(-(moment - 0.03) * 13.0) * math.sin(2.0 * math.pi * merger_frequency * 2.1 * (moment - 0.03)) if moment > 0.03 else 0.0
        strain = progress ** 1.65 * math.sin(phase) if moment < 0.03 else ringdown
        data.append({"x": moment, "primary": strain, "secondary": frequency})
    binary_supported = str(values.get("binaryCount", "2")) == "2"
    return {
        "kind": "black-hole-merger",
        "xLabel": "time relative to merger, s",
        "yLabel": "dimensionless strain (normalised)",
        "primaryLabel": "analytic inspiral + damped ringdown strain",
        "secondaryLabel": "GW frequency, Hz",
        "data": data,
        "metrics": [["chirp mass", chirp_mass, "M☉"], ["remnant mass", remnant_mass, "M☉"], ["final spin χ", remnant_spin, ""]],
        "state": {
            "supported": binary_supported,
            "schwarzschildRadiusA_km": 2.95325008 * m1,
            "schwarzschildRadiusB_km": 2.95325008 * m2,
            "chirpMass": chirp_mass,
            "remnantMass": remnant_mass,
            "finalSpin": remnant_spin,
            "mergerFrequencyHz": merger_frequency,
        },
        "event": {"process": "binaryBlackHoleMerger", "model": "leading-order inspiral + damped ringdown", "initialSeparation_rg": separation},
        "backendHint": "Use Einstein Toolkit numerical-relativity waveform import for a validated spacetime evolution; EinsteinPy is suitable for optional geodesic calculations.",
    }


def solve(model: str, values: dict[str, Any]) -> dict[str, Any]:
    if model == "quantumChemistryLab":
        return solve_quantum_chemistry(values)
    if model == "semiconductorDeviceLab":
        return solve_semiconductor_tcad(values)
    if model == "directmlCompute":
        return solve_directml(values)
    if model == "gpuWaveformEnsemble":
        return solve_gpu_waveform(values)
    if model == "gpuWaveGrid":
        return solve_gpu_wave_grid(values)
    if model == "gpuWaveGrid3d":
        return solve_gpu_wave_grid_3d(values)
    if model == "gpuNeutrinoBatch":
        return solve_gpu_neutrino_batch(values)
    if model == "gpuQuantumSimulator":
        return solve_gpu_quantum_simulator(values)
    if model == "geant4Transport":
        return solve_geant4_transport(values)
    if model == "proton" and str(values.get("calculationMode", "cornell")) == "geant4":
        transport_values = {**values, "transportParticle": "gamma", "transportMaterial": "G4_Si"}
        return solve_geant4_transport(transport_values)
    if model == "neutrinoLens":
        if str(values.get("neutrinoCalculationMode", "nusquids")) == "nusquids":
            return solve_nusquids(values)
        return solve_neutrino_lens(values)
    if model == "blackHole":
        if str(values.get("waveformSource", "pycbc")) == "einsteinToolkit":
            result = solve_einstein_toolkit_waveform(values)
            if scientific_einsteinpy_geodesic is not None:
                result["geodesic"] = scientific_einsteinpy_geodesic(values)
            return result
        pycbc_error = None
        if str(values.get("binaryCount", "2")) == "2" and pycbc_status().get("available"):
            try:
                result = solve_pycbc_waveform(values)
            except Exception as exc:
                pycbc_error = f"{type(exc).__name__}: {exc}"
                result = with_science_fallback(scientific_black_hole_merger, solve_black_hole_merger, values)
        else:
            result = with_science_fallback(scientific_black_hole_merger, solve_black_hole_merger, values)
        if pycbc_error:
            result.setdefault("provenance", {})["pycbcFallbackError"] = pycbc_error
        if scientific_einsteinpy_geodesic is not None:
            try:
                result["geodesic"] = scientific_einsteinpy_geodesic(values)
            except Exception as exc:
                result["geodesic"] = {"available": False, "error": f"{type(exc).__name__}: {exc}"}
        return result
    if model in {"hydrogen", "helium4"}:
        return solve_atomic_photon(values, helium=model == "helium4")
    if model == "multiQuarkDiscovery":
        return solve_multiquark_discovery(values)
    if model in {"multiQuarkWorkbench", "hDibaryon", "omegaOmega"}:
        return solve_dibaryon(values, omega=model == "omegaOmega")
    if model in {"strangelet", "cflStrangelet"}:
        return solve_strangelet(values)
    if model in {"pionPlus", "kaonPlus", "rhoZero", "jPsi", "upsilon1S", "x3872", "scalarGlueball", "hybridMeson"}:
        return solve_string_breaking(values, model)
    if model in {"colliderWorkbench", "ppMinimumBias", "ppDijet", "ppHiggsGammaGamma", "ppZPrime", "ppHiddenValley"}:
        if model in {"colliderWorkbench", "ppMinimumBias", "ppDijet"} and pythia_status().get("available"):
            try:
                return solve_pythia_event(model, values)
            except Exception as exc:
                result = solve_collision(values, model)
                result["provenance"] = {"engine": "python-local-solver-fallback", "pythiaFallbackError": f"{type(exc).__name__}: {exc}", "validatedExternalSimulation": False}
                return result
        return solve_collision(values, model)
    if model in {"mitBag", "njl", "twoSC", "cfl", "qgp", "neutronMatter", "hyperonMatter", "kaonCondensate", "quarkyonic", "qhc21", "loff", "gCFL", "cflKaon"}:
        if model == "neutronMatter" and solve_compose_eos is not None:
            try:
                return solve_compose_eos(values)
            except Exception as exc:
                result = solve_eos(model, values)
                result["provenance"] = {"engine": "python-standard-library-fallback", "composeFallbackError": f"{type(exc).__name__}: {exc}", "validatedExternalSimulation": False}
                return result
        return solve_eos(model, values)
    return with_science_fallback(scientific_cornell_potential, solve_confinement, values)


class LabHandler(SimpleHTTPRequestHandler):
    server_version = "QCDMatterLab/0.1"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        # The desktop shortcut and earlier versions of the project opened the
        # laboratory directly at http://127.0.0.1:8892/.  Keep that stable
        # public entry point while the current repository stores the lab under
        # /matter-lab/.
        if self.path == "/" or self.path.startswith("/?"):
            query = self.path[1:]
            self.send_response(HTTPStatus.FOUND)
            self.send_header("Location", f"/matter-lab/{query}")
            self.end_headers()
            return
        request_path = self.path.split("?", 1)[0]
        if request_path in {"/api/status", "/matter-lab/api/status"}:
            science = science_status()
            self.send_json({
                "ok": True,
                "engine": science.get("acceleration", {}).get("engine", science["engine"]) if science.get("available") else "local-cpu-fallback",
                "scientific": science,
                "adapters": {
                    "numpy_scipy": "active" if science.get("available") else "fallback",
                    "directml": "active" if science.get("directml", {}).get("available") else "optional-not-installed",
                    "gpu_waveform_ensemble": "active" if science.get("gpuWaveform", {}).get("available") else "optional-not-installed",
                    "gpu_wave_grid": "active" if science.get("gpuWaveGrid", {}).get("available") else "optional-not-installed",
                    "gpu_wave_grid_3d": "active" if science.get("gpuWaveGrid3d", {}).get("available") else "optional-not-installed",
                    "gpu_neutrino_batch": "active" if science.get("gpuNeutrinoBatch", {}).get("available") else "optional-not-installed",
                    "gpu_quantum_statevector": "active" if science.get("gpuQuantumSimulator", {}).get("available") else "optional-not-installed",
                    "muses": "contract-ready",
                    "compose": "active" if science.get("compose", {}).get("available") else "table-loader-ready",
                    "nusquids": "active" if science.get("nusquidsWsl", {}).get("available") else "optional-not-installed",
                    "geant4": "active" if science.get("geant4Wsl", {}).get("available") else "optional-not-installed",
                    "einsteinpy": "active" if science.get("einsteinpy") else "optional-not-installed",
                    "pycbc_lalsuite": "active" if science.get("pycbcWsl", {}).get("available") else "optional-not-installed",
                    "pythia8_hepmc3": "active" if science.get("pythiaWsl", {}).get("available") else "optional-not-installed",
                    "einstein_toolkit": "reference-data-active" if science.get("einsteinToolkitData", {}).get("available") else "external-waveform-import-ready",
                    "rdkit_pyscf": "active" if science.get("chemistry", {}).get("available") else "optional-not-installed",
                    "devsim": "active" if science.get("devsim", {}).get("available") else "optional-not-installed",
                    "multiquark_discovery": "active" if science.get("multiquarkDiscovery", {}).get("available") else "unavailable",
                    "multiquark_directml": "active" if science.get("multiquarkDiscovery", {}).get("gpuThresholdKernel", {}).get("available") else "optional-not-installed",
                    "discovery_chain_testnet": "active" if science.get("discoveryChain", {}).get("available") else "unavailable",
                },
            })
            return
        if request_path in {"/api/discovery-chain", "/matter-lab/api/discovery-chain"}:
            self.send_json({"ok": True, "result": discovery_chain().snapshot()})
            return
        super().do_GET()

    def do_POST(self) -> None:
        request_path = self.path.split("?", 1)[0]
        if request_path.startswith("/api/discovery-chain/") or request_path.startswith("/matter-lab/api/discovery-chain/"):
            self.handle_discovery_chain(request_path)
            return
        if request_path not in {"/api/solve", "/matter-lab/api/solve", "/api/multiquark/search", "/matter-lab/api/multiquark/search"}:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            model = "multiQuarkDiscovery" if request_path.endswith("/multiquark/search") else str(payload.get("model", "proton"))
            values = payload.get("values", {})
            if not isinstance(values, dict):
                raise ValueError("values must be an object")
            started = time.perf_counter()
            result = solve(model, values)
            elapsed_ms = (time.perf_counter() - started) * 1000.0
            engine = result.get("provenance", {}).get("engine", "python-local-solver")
            self.send_json({"ok": True, "engine": engine, "elapsed_ms": elapsed_ms, "result": result})
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            self.send_json({"ok": False, "error": str(exc)}, status=HTTPStatus.BAD_REQUEST)

    def handle_discovery_chain(self, request_path: str) -> None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            if not isinstance(payload, dict):
                raise ValueError("payload must be an object")
            action = request_path.rsplit("/", 1)[-1]
            testnet = discovery_chain()
            if action == "bootstrap":
                result = testnet.bootstrap()
            elif action == "task":
                values = payload.get("values", payload)
                if not isinstance(values, dict):
                    raise ValueError("values must be an object")
                result = testnet.create_task(values)
            elif action == "epoch":
                values = payload.get("values", payload)
                if not isinstance(values, dict):
                    raise ValueError("values must be an object")
                result = testnet.run_epoch(values)
            elif action == "worker":
                values = payload.get("values", payload)
                if not isinstance(values, dict):
                    raise ValueError("values must be an object")
                result = testnet.register_worker(values)
            elif action == "reset":
                result = testnet.reset()
            else:
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            self.send_json({"ok": True, "result": result})
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            self.send_json({"ok": False, "error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
        except Exception as exc:
            self.send_json({"ok": False, "error": f"{type(exc).__name__}: {exc}"}, status=HTTPStatus.INTERNAL_SERVER_ERROR)

    def send_json(self, payload: dict[str, Any], status: int = HTTPStatus.OK) -> None:
        encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[QCD Matter Lab] {self.address_string()} {fmt % args}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the QCD Matter Lab frontend and local solver API")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8892)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), LabHandler)
    print(f"QCD Matter Lab: http://{args.host}:{args.port}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
