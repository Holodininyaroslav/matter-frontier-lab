from __future__ import annotations

import argparse
import json
import math
import sys


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--status", action="store_true")
    args = parser.parse_args()
    import devsim
    from devsim.python_packages.simple_physics import (
        CreateSiliconPotentialOnly,
        CreateSiliconPotentialOnlyContact,
        GetContactBiasName,
        SetSiliconParameters,
    )
    if args.status:
        print(json.dumps({"available": True, "engine": "devsim-wsl", "version": "2.9.1"}))
        return

    values = json.load(sys.stdin)
    length_um = max(float(values.get("deviceLengthUm", 2.0)), 0.1)
    length_cm = length_um * 1e-4
    acceptor = max(float(values.get("acceptorDoping", 1e16)), 1e10)
    donor = max(float(values.get("donorDoping", 1e16)), 1e10)
    bias = float(values.get("appliedBias", 0.0))
    temperature = min(max(float(values.get("deviceTemperature", 300.0)), 80.0), 600.0)
    nodes = min(max(int(values.get("meshNodes", 121)), 41), 401)
    topology = str(values.get("deviceTopology", "pn"))
    spacing = length_cm / (nodes - 1)
    mesh, device, region = "pn_mesh", "pn_device", "silicon"
    devsim.create_1d_mesh(mesh=mesh)
    devsim.add_1d_mesh_line(mesh=mesh, pos=0.0, ps=spacing, tag="left")
    devsim.add_1d_mesh_line(mesh=mesh, pos=length_cm / 2, ps=spacing / 3)
    devsim.add_1d_mesh_line(mesh=mesh, pos=length_cm, ps=spacing, tag="right")
    devsim.add_1d_contact(mesh=mesh, name="anode", tag="left", material="metal")
    devsim.add_1d_contact(mesh=mesh, name="cathode", tag="right", material="metal")
    devsim.add_1d_region(mesh=mesh, material="Silicon", region=region, tag1="left", tag2="right")
    devsim.finalize_mesh(mesh=mesh)
    devsim.create_device(mesh=mesh, device=device)
    if topology == "pin":
        doping = f"ifelse(x < {length_cm * .3:.14g}, -{acceptor:.14g}, ifelse(x < {length_cm * .7:.14g}, 0, {donor:.14g}))"
    elif topology == "npn":
        doping = f"ifelse(x < {length_cm * .25:.14g}, {donor:.14g}, ifelse(x < {length_cm * .75:.14g}, -{acceptor:.14g}, {donor:.14g}))"
    else:
        topology = "pn"
        doping = f"ifelse(x < {length_cm / 2:.14g}, -{acceptor:.14g}, {donor:.14g})"
    devsim.node_model(device=device, region=region, name="NetDoping", equation=doping)
    SetSiliconParameters(device, region, temperature)
    CreateSiliconPotentialOnly(device, region)
    for contact in ("anode", "cathode"):
        devsim.set_parameter(device=device, name=GetContactBiasName(contact), value=bias if contact == "anode" else 0.0)
        CreateSiliconPotentialOnlyContact(device, region, contact)
    devsim.solve(type="dc", absolute_error=1e-12, relative_error=1e-10, maximum_iterations=80)
    positions = [float(value) for value in devsim.get_node_model_values(device=device, region=region, name="x")]
    potential = [float(value) for value in devsim.get_node_model_values(device=device, region=region, name="Potential")]
    electrons = [float(value) for value in devsim.get_node_model_values(device=device, region=region, name="IntrinsicElectrons")]
    holes = [float(value) for value in devsim.get_node_model_values(device=device, region=region, name="IntrinsicHoles")]
    field = []
    for index in range(len(positions)):
        lo, hi = max(index - 1, 0), min(index + 1, len(positions) - 1)
        field.append(-(potential[hi] - potential[lo]) / max(positions[hi] - positions[lo], 1e-30))
    built_in = max(potential) - min(potential)
    peak_field = max(abs(value) for value in field)
    data = [{"positionUm": x * 1e4, "potentialV": v, "fieldVcm": e, "electronsCm3": n, "holesCm3": p}
            for x, v, e, n, p in zip(positions, potential, field, electrons, holes)]
    print(json.dumps({"samples": data, "builtInPotentialV": built_in, "peakFieldVcm": peak_field, "topology": topology,
                      "temperatureK": temperature, "meshNodes": len(data), "version": "2.9.1"}))


if __name__ == "__main__":
    main()
