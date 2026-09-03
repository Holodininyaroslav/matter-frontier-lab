from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
from scipy.interpolate import PchipInterpolator


TABLE_ROOT = Path(__file__).resolve().parent.parent / "scientific_data" / "compose" / "ds_cmf_2" / "table"
SOURCE_URL = "https://compose.obspm.fr/eos/181"
SATURATION_DENSITY_FM3 = 0.15


def _grid(path: Path) -> np.ndarray:
    tokens = path.read_text(encoding="ascii").split()
    if len(tokens) < 3:
        raise ValueError(f"Invalid CompOSE grid file: {path}")
    count = int(tokens[1])
    values = np.asarray([float(value) for value in tokens[2 : 2 + count]], dtype=np.float64)
    if len(values) != count:
        raise ValueError(f"CompOSE grid expected {count} values, found {len(values)}")
    return values


@lru_cache(maxsize=1)
def load_table() -> dict[str, Any]:
    densities = _grid(TABLE_ROOT / "eos.nb")
    lines = (TABLE_ROOT / "eos.thermo").read_text(encoding="ascii").splitlines()
    neutron_mass, proton_mass, lepton_flag = lines[0].split()[:3]
    mn = float(neutron_mass)
    rows: list[tuple[int, float, float]] = []
    for line in lines[1:]:
        columns = line.split()
        if len(columns) < 11:
            continue
        density_index = int(columns[1]) - 1
        q1 = float(columns[3])
        q7 = float(columns[9])
        rows.append((density_index, q1, q7))
    if len(rows) != len(densities):
        raise ValueError(f"CompOSE DS(CMF)-2 expected {len(densities)} thermodynamic rows, found {len(rows)}")
    rows.sort(key=lambda row: row[0])
    q1 = np.asarray([row[1] for row in rows], dtype=np.float64)
    q7 = np.asarray([row[2] for row in rows], dtype=np.float64)
    pressure = densities * q1
    energy_density = densities * mn * (q7 + 1.0)
    sound_speed2 = np.gradient(pressure, energy_density, edge_order=2)
    return {
        "density": densities,
        "pressure": pressure,
        "energyDensity": energy_density,
        "soundSpeed2": sound_speed2,
        "neutronMassMeV": mn,
        "protonMassMeV": float(proton_mass),
        "includesLeptons": int(lepton_flag) == 1,
    }


def status() -> dict[str, Any]:
    try:
        table = load_table()
        return {
            "available": True,
            "engine": "compose-table-scipy",
            "model": "DS(CMF)-2",
            "rows": len(table["density"]),
            "source": SOURCE_URL,
        }
    except Exception as exc:
        return {"available": False, "engine": "compose-table-scipy", "error": f"{type(exc).__name__}: {exc}"}


def solve(values: dict[str, Any], points: int = 180) -> dict[str, Any]:
    table = load_table()
    density = table["density"]
    pressure = table["pressure"]
    energy = table["energyDensity"]
    requested_ratio = max(float(values.get("density", 3.2)), 0.0)
    requested_density = requested_ratio * SATURATION_DENSITY_FM3
    selected_density = float(np.clip(requested_density, density[0], density[-1]))
    count = max(32, min(int(points), 600))
    sample_density = np.linspace(density[0], density[-1], count, dtype=np.float64)
    pressure_curve = PchipInterpolator(density, pressure)(sample_density)
    energy_curve = PchipInterpolator(density, energy)(sample_density)
    cs2_curve = np.gradient(pressure_curve, energy_curve, edge_order=2)
    selected_pressure = float(PchipInterpolator(density, pressure)(selected_density))
    selected_energy = float(PchipInterpolator(density, energy)(selected_density))
    selected_cs2 = float(PchipInterpolator(density, table["soundSpeed2"])(selected_density))
    data = [
        {
            "x": float(epsilon),
            "primary": float(p),
            "secondary": float(nb / SATURATION_DENSITY_FM3),
            "density_fm3": float(nb),
            "cs2": float(cs2),
        }
        for nb, p, epsilon, cs2 in zip(sample_density, pressure_curve, energy_curve, cs2_curve, strict=True)
    ]
    return {
        "kind": "eos",
        "xLabel": "Энергоплотность epsilon, MeV/fm^3",
        "yLabel": "Давление P, MeV/fm^3",
        "primaryLabel": "CompOSE DS(CMF)-2 cold beta-equilibrium EoS",
        "secondaryLabel": "n_b/n_0",
        "data": data,
        "metrics": [["P", selected_pressure, "MeV/fm^3"], ["epsilon", selected_energy, "MeV/fm^3"], ["c_s^2/c^2", selected_cs2, ""]],
        "state": {
            "current": {"x": selected_energy, "primary": selected_pressure, "secondary": selected_density / SATURATION_DENSITY_FM3, "cs2": selected_cs2},
            "density": selected_density / SATURATION_DENSITY_FM3,
            "density_fm3": selected_density,
            "soundSpeed2": selected_cs2,
            "tableTemperatureMeV": 0.0,
            "requestedTemperatureMeV": float(values.get("temperature", 0.0)),
            "temperatureApplied": float(values.get("temperature", 0.0)) == 0.0,
            "tableRange_fm3": [float(density[0]), float(density[-1])],
            "includesLeptons": table["includesLeptons"],
        },
        "backendHint": "Official CompOSE DS(CMF)-2 table with monotone SciPy interpolation.",
        "provenance": {
            "engine": "compose-table-scipy",
            "database": "CompOSE",
            "model": "DS(CMF)-2",
            "source": SOURCE_URL,
            "dataSha256": "197BA8EB630D93EFE7D474DEDF2AE449AD0F3ABCE43B3763507313303AE4B0E5",
            "scientificPackage": True,
            "validatedExternalSimulation": True,
            "limitations": "Cold T=0 beta-equilibrated one-dimensional table; the UI temperature parameter is reported but not applied.",
        },
    }
