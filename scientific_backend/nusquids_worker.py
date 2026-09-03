from __future__ import annotations

import argparse
import importlib.metadata
import json
import math

import nuSQuIDS as nsq
import numpy as np


def configured_solver(energy_gev: float, distance_km: float, density: float, electron_fraction: float, initial_flavor: int, antineutrino: bool):
    units = nsq.Const()
    neutrino_type = nsq.NeutrinoType.antineutrino if antineutrino else nsq.NeutrinoType.neutrino
    solver = nsq.nuSQUIDS(3, neutrino_type)
    body = nsq.Vacuum() if density <= 0.0 else nsq.ConstantDensity(density, electron_fraction)
    track = nsq.Vacuum.Track(distance_km * units.km) if density <= 0.0 else nsq.ConstantDensity.Track(distance_km * units.km)
    solver.Set_Body(body)
    solver.Set_Track(track)
    solver.Set_E(energy_gev * units.GeV)
    solver.Set_MixingAngle(0, 1, 0.5843)
    solver.Set_MixingAngle(0, 2, 0.1480)
    solver.Set_MixingAngle(1, 2, 0.8552)
    solver.Set_SquareMassDifference(1, 7.42e-5)
    solver.Set_SquareMassDifference(2, 2.517e-3)
    solver.Set_CPPhase(0, 2, math.radians(195.0))
    state = np.zeros(3, dtype=float)
    state[initial_flavor] = 1.0
    solver.Set_initial_state(state, nsq.Basis.flavor)
    solver.EvolveState()
    return [float(solver.EvalFlavor(flavor)) for flavor in range(3)]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--status", action="store_true")
    parser.add_argument("--energy-gev", type=float, default=10.0)
    parser.add_argument("--baseline-km", type=float, default=1000.0)
    parser.add_argument("--density", type=float, default=3.0)
    parser.add_argument("--electron-fraction", type=float, default=0.5)
    parser.add_argument("--initial-flavor", type=int, choices=(0, 1, 2), default=1)
    parser.add_argument("--antineutrino", action="store_true")
    parser.add_argument("--points", type=int, default=64)
    args = parser.parse_args()
    version = importlib.metadata.version("nusquids")
    if args.status:
        print(json.dumps({"available": True, "engine": "nusquids-wsl", "nuSQuIDS": version}))
        return
    points = max(2, min(args.points, 160))
    samples = []
    for index in range(points):
        distance = args.baseline_km * index / (points - 1)
        probabilities = configured_solver(args.energy_gev, distance, args.density, args.electron_fraction, args.initial_flavor, args.antineutrino)
        samples.append({"distanceKm": distance, "electron": probabilities[0], "muon": probabilities[1], "tau": probabilities[2]})
    print(json.dumps({
        "ok": True, "engine": "nusquids-wsl", "nuSQuIDS": version, "energyGeV": args.energy_gev,
        "baselineKm": args.baseline_km, "densityGcm3": args.density, "electronFraction": args.electron_fraction,
        "initialFlavor": args.initial_flavor, "antineutrino": args.antineutrino, "samples": samples,
        "oscillationParameters": {"theta12": 0.5843, "theta13": 0.1480, "theta23": 0.8552, "dm21eV2": 7.42e-5, "dm31eV2": 2.517e-3, "deltaCPdeg": 195.0},
    }))


if __name__ == "__main__":
    main()
