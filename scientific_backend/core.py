from __future__ import annotations

import math
import platform
from importlib import metadata
from typing import Any

import numpy as np
import scipy
from scipy.integrate import solve_ivp


G = 6.67430e-11
C = 299_792_458.0
SOLAR_MASS_KG = 1.98847e30
MEGAPARSEC_M = 3.085677581491367e22


def capabilities() -> dict[str, Any]:
    """Return the actual numerical packages loaded by this Python process."""
    try:
        einsteinpy_version = metadata.version("einsteinpy")
    except metadata.PackageNotFoundError:
        einsteinpy_version = None
    return {
        "available": True,
        "engine": "numpy-scipy-cpu",
        "python": platform.python_version(),
        "numpy": np.__version__,
        "scipy": scipy.__version__,
        "einsteinpy": einsteinpy_version,
        "solvers": [
            "cornell-potential",
            "peters-mathews-circular-inspiral",
            *(["einsteinpy-geodesic"] if einsteinpy_version else []),
        ],
    }


def _float(values: dict[str, Any], key: str, default: float) -> float:
    return float(values.get(key, default))


def solve_cornell_potential(values: dict[str, Any], points: int = 120) -> dict[str, Any]:
    """Vectorised Cornell potential V(r) = -4 alpha_s/(3r) + sigma r.

    The model is a phenomenological heavy-quark potential.  NumPy evaluates
    the curve and its numerical force; it is not a lattice-QCD calculation.
    """
    alpha = _float(values, "alphaS", 0.35)
    sigma = _float(values, "stringTension", 0.9)
    radii = np.linspace(0.08, 1.8, max(16, int(points)), dtype=np.float64)
    linear = sigma * radii
    potential = -4.0 * alpha / (3.0 * radii) + linear
    force = -np.gradient(potential, radii, edge_order=2)
    zero_crossing = math.sqrt(max(4.0 * alpha / (3.0 * max(sigma, 1e-15)), 0.0))
    data = [
        {"x": float(r), "primary": float(v), "secondary": float(l), "force": float(f)}
        for r, v, l, f in zip(radii, potential, linear, force, strict=True)
    ]
    return {
        "kind": "potential",
        "xLabel": "Расстояние r, fm",
        "yLabel": "V(r), GeV",
        "primaryLabel": "Cornell potential",
        "secondaryLabel": "Линейный член",
        "data": data,
        "metrics": [["alpha_s", alpha, ""], ["sigma", sigma, "GeV/fm"], ["V=0", zero_crossing, "fm"]],
        "state": {"zeroCrossing_fm": zero_crossing, "forceAtEnd_GeVPerFm": float(force[-1])},
        "backendHint": "NumPy evaluation of the phenomenological Cornell potential",
        "provenance": {
            "engine": "numpy-scipy-cpu",
            "model": "Cornell phenomenological heavy-quark potential",
            "numericalMethod": "float64 vector evaluation + second-order finite-difference gradient",
            "validatedExternalSimulation": False,
            "limitations": "Not a lattice-QCD field evolution or fitted potential table.",
        },
    }


def solve_einsteinpy_geodesic(values: dict[str, Any], points: int = 128) -> dict[str, Any]:
    """Integrate a test-particle geodesic with the real EinsteinPy package.

    Coordinates are calculated in geometrised units and also converted to km
    for the selected black-hole mass. The particle is a test body: it does not
    back-react on the metric and this is not a binary merger calculation.
    """
    from einsteinpy.geodesic import Timelike

    radius = max(_float(values, "geodesicRadiusRg", 40.0), 6.2)
    angular_momentum = _float(values, "geodesicAngularMomentum", 3.83405)
    spin = float(np.clip(_float(values, "geodesicSpin", values.get("spinA", 0.0)), -0.99, 0.99))
    mass_solar = max(_float(values, "mass", values.get("binaryMassA", 36.0)), 1e-9)
    count = max(48, min(int(values.get("geodesicSteps", points)), 600))
    metric = "Kerr" if abs(spin) > 1e-12 else "Schwarzschild"
    metric_params: tuple[float, ...] = (spin,) if metric == "Kerr" else ()
    geodesic = Timelike(
        metric=metric,
        metric_params=metric_params,
        position=[radius, math.pi / 2.0, 0.0],
        momentum=[0.0, 0.0, angular_momentum],
        return_cartesian=True,
        steps=count,
        delta=0.5,
        rtol=1e-8,
        atol=1e-10,
        order=4,
        omega=1.0,
        suppress_warnings=True,
    )
    step_index, trajectory = geodesic.trajectory
    xyz = trajectory[:, 1:4]
    radii = np.linalg.norm(xyz, axis=1)
    scale_km = G * mass_solar * SOLAR_MASS_KG / C**2 / 1000.0
    path = [
        {
            "step": int(step),
            "t_geometric": float(row[0]),
            "x_rg": float(row[1]),
            "y_rg": float(row[2]),
            "z_rg": float(row[3]),
            "x_km": float(row[1] * scale_km),
            "y_km": float(row[2] * scale_km),
            "z_km": float(row[3] * scale_km),
            "r_rg": float(r),
        }
        for step, row, r in zip(step_index, trajectory, radii, strict=True)
    ]
    return {
        "kind": "timelike-geodesic",
        "metric": metric,
        "metricParameters": {"mass_Msun": mass_solar, "dimensionlessSpin": spin},
        "initialConditions": {"radius_rg": radius, "p_r": 0.0, "p_theta": 0.0, "p_phi": angular_momentum},
        "trajectory": path,
        "state": {
            "samples": count,
            "minimumRadius_rg": float(np.min(radii)),
            "maximumRadius_rg": float(np.max(radii)),
            "lengthScale_km_per_rg": scale_km,
        },
        "provenance": {
            "engine": "einsteinpy",
            "version": metadata.version("einsteinpy"),
            "model": f"timelike test-particle geodesic in {metric} spacetime",
            "validatedExternalSimulation": True,
            "limitations": "Fixed background metric; no self-force, radiation reaction, accretion flow, or binary back-reaction.",
        },
    }


def solve_binary_black_hole(values: dict[str, Any], points: int = 180) -> dict[str, Any]:
    """Leading-order circular inspiral integrated with SciPy.

    Separation evolves with the Peters-Mathews quadrupole radiation-reaction
    equation.  The calculation stops at the Schwarzschild ISCO proxy and then
    appends an explicitly labelled fitted damped ringdown.  This is more
    physical than the former hand-drawn chirp, but it is not numerical
    relativity and is not valid for a generic eccentric/precessing merger.
    """
    m1_solar = max(_float(values, "binaryMassA", 36.0), 1.0)
    m2_solar = max(_float(values, "binaryMassB", 29.0), 1.0)
    distance_mpc = max(_float(values, "distanceMpc", 410.0), 1e-6)
    spin_a = float(np.clip(_float(values, "spinA", 0.0), -0.99, 0.99))
    spin_b = float(np.clip(_float(values, "spinB", 0.0), -0.99, 0.99))
    separation_rg = max(_float(values, "initialSeparation", 28.0), 6.25)

    m1 = m1_solar * SOLAR_MASS_KG
    m2 = m2_solar * SOLAR_MASS_KG
    total = m1 + m2
    total_solar = m1_solar + m2_solar
    eta = m1 * m2 / total**2
    chirp = (m1 * m2) ** (3.0 / 5.0) / total ** (1.0 / 5.0)
    chirp_solar = chirp / SOLAR_MASS_KG
    rg = G * total / C**2
    a0 = separation_rg * rg
    a_isco = 6.0 * rg
    beta = (64.0 / 5.0) * G**3 * m1 * m2 * total / C**5
    inspiral_duration = max((a0**4 - a_isco**4) / (4.0 * beta), 1e-9)

    inspiral_points = max(32, round(points * 0.78))
    ringdown_points = max(12, points - inspiral_points)
    times = np.linspace(0.0, inspiral_duration, inspiral_points, dtype=np.float64)

    def rhs(_: float, state: np.ndarray) -> list[float]:
        separation = max(float(state[0]), a_isco)
        omega_orbital = math.sqrt(G * total / separation**3)
        return [-beta / separation**3, 2.0 * omega_orbital]

    integrated = solve_ivp(
        rhs,
        (0.0, inspiral_duration),
        (a0, 0.0),
        t_eval=times,
        rtol=2e-10,
        atol=(a_isco * 1e-11, 1e-11),
        method="DOP853",
    )
    if not integrated.success:
        raise RuntimeError(f"SciPy inspiral integration failed: {integrated.message}")

    separation = np.maximum(integrated.y[0], a_isco)
    phase = integrated.y[1]
    gw_frequency = np.sqrt(G * total / separation**3) / math.pi
    distance = distance_mpc * MEGAPARSEC_M
    strain_envelope = 4.0 * (G * chirp) ** (5.0 / 3.0) * (math.pi * gw_frequency) ** (2.0 / 3.0) / (C**4 * distance)
    strain_si = strain_envelope * np.cos(phase)
    peak_inspiral = max(float(np.max(np.abs(strain_si))), 1e-30)
    normalised = strain_si / peak_inspiral

    effective_spin = (spin_a * m1_solar**2 + spin_b * m2_solar**2) / total_solar**2
    radiated_fraction = float(np.clip(0.028 + 0.26 * eta, 0.03, 0.10))
    remnant_mass_solar = total_solar * (1.0 - radiated_fraction)
    remnant_spin = float(np.clip(0.45 + 1.15 * eta + 0.42 * effective_spin, 0.0, 0.98))
    remnant_mass = remnant_mass_solar * SOLAR_MASS_KG
    ringdown_frequency = C**3 / (2.0 * math.pi * G * remnant_mass) * (1.0 - 0.63 * (1.0 - remnant_spin) ** 0.3)
    quality = 2.0 * (1.0 - remnant_spin) ** -0.45
    damping_time = quality / (math.pi * ringdown_frequency)
    ring_times = np.linspace(0.0, 6.0 * damping_time, ringdown_points + 1, dtype=np.float64)[1:]
    ring_phase = phase[-1] + 2.0 * math.pi * ringdown_frequency * ring_times
    ring_normalised = math.cos(float(phase[-1])) * np.exp(-ring_times / damping_time) * np.cos(ring_phase - phase[-1])
    ring_strain = peak_inspiral * ring_normalised

    time_relative = np.concatenate((times - inspiral_duration, ring_times))
    all_frequency = np.concatenate((gw_frequency, np.full(ringdown_points, ringdown_frequency)))
    all_normalised = np.concatenate((normalised, ring_normalised))
    all_strain = np.concatenate((strain_si, ring_strain))
    all_separation = np.concatenate((separation / rg, np.full(ringdown_points, 6.0)))
    data = [
        {
            "x": float(t),
            "primary": float(hn),
            "secondary": float(f),
            "strainSI": float(h),
            "separation_rg": float(a),
        }
        for t, hn, f, h, a in zip(time_relative, all_normalised, all_frequency, all_strain, all_separation, strict=True)
    ]

    # Independent analytic integration of d(phi_gw)/da is kept as a
    # diagnostic. It avoids hiding an integration error behind a second ODE
    # solve and remains accurate across the rapidly accelerating final orbit.
    reconstructed_phase = (4.0 * math.sqrt(G * total) / (5.0 * beta)) * (a0 ** 2.5 - separation ** 2.5)
    phase_error = float(np.max(np.abs(reconstructed_phase - phase)))
    return {
        "kind": "black-hole-merger",
        "xLabel": "time relative to ISCO proxy, s",
        "yLabel": "strain (normalised; SI value included per sample)",
        "primaryLabel": "Peters-Mathews inspiral + fitted damped ringdown",
        "secondaryLabel": "GW frequency, Hz",
        "data": data,
        "metrics": [["chirp mass", chirp_solar, "M_sun"], ["remnant mass", remnant_mass_solar, "M_sun"], ["peak |h|", peak_inspiral, ""]],
        "state": {
            "supported": str(values.get("binaryCount", "2")) == "2",
            "schwarzschildRadiusA_km": 2.0 * G * m1 / C**2 / 1000.0,
            "schwarzschildRadiusB_km": 2.0 * G * m2 / C**2 / 1000.0,
            "chirpMass": chirp_solar,
            "remnantMass": remnant_mass_solar,
            "finalSpin": remnant_spin,
            "mergerFrequencyHz": float(gw_frequency[-1]),
            "ringdownFrequencyHz": ringdown_frequency,
            "inspiralDuration_s": inspiral_duration,
            "distanceMpc": distance_mpc,
            "peakStrainSI": peak_inspiral,
            "maxPhaseConsistencyError_rad": phase_error,
        },
        "event": {
            "process": "binaryBlackHoleMerger",
            "model": "Peters-Mathews circular inspiral + fitted Kerr ringdown",
            "initialSeparation_rg": separation_rg,
        },
        "backendHint": "SciPy integration; use LALSuite/PyCBC or numerical relativity for production waveforms.",
        "provenance": {
            "engine": "numpy-scipy-cpu",
            "model": "leading-order circular quadrupole inspiral",
            "numericalMethod": "SciPy solve_ivp DOP853, rtol=2e-10",
            "validatedExternalSimulation": False,
            "limitations": "No eccentricity, precession, higher modes, numerical-relativity merger, or detector response.",
        },
    }
