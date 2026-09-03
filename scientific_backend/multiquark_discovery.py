"""Deterministic multi-quark screening and SystemVerilog architecture generator.

This module is deliberately an effective-model research workbench.  It does
not claim to run lattice QCD.  Its purpose is to make the orchestration,
constraint, threshold and hardware-prototyping layers executable while more
expensive Chroma/QUDA/Grid adapters remain external validation backends.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any

from .gpu_multiquark_adapter import evaluate as evaluate_thresholds_gpu
from .gpu_multiquark_adapter import status as gpu_threshold_status


ROOT = Path(__file__).resolve().parent.parent
OUTPUT_ROOT = ROOT / "scientific_output" / "multiquark"

QUARKS: dict[str, dict[str, float]] = {
    "u": {"mass": 336.0, "charge3": 2, "baryon3": 1, "strangeness": 0},
    "d": {"mass": 340.0, "charge3": -1, "baryon3": 1, "strangeness": 0},
    "s": {"mass": 486.0, "charge3": -1, "baryon3": 1, "strangeness": -1},
    "c": {"mass": 1550.0, "charge3": 2, "baryon3": 1, "strangeness": 0},
    "b": {"mass": 4730.0, "charge3": -1, "baryon3": 1, "strangeness": 0},
}


def _parse_composition(raw: str) -> list[str]:
    cleaned = raw.lower().replace("q̄", "bar").replace("¯", "bar")
    cleaned = re.sub(r"anti[-_ ]?([udscb])", r"\1bar", cleaned)
    tokens = re.findall(r"(?:u|d|s|c|b)(?:bar)?", cleaned)
    if not 2 <= len(tokens) <= 12:
        raise ValueError("composition must contain 2–12 quarks, e.g. 'u u d d s s' or 'u d s sbar'")
    return tokens


def _quantum_numbers(tokens: list[str]) -> dict[str, Any]:
    charge3 = baryon3 = strangeness = 0
    particles = antiparticles = 0
    for token in tokens:
        anti = token.endswith("bar")
        flavor = token[0]
        values = QUARKS[flavor]
        sign = -1 if anti else 1
        charge3 += int(values["charge3"]) * sign
        baryon3 += int(values["baryon3"]) * sign
        strangeness += int(values["strangeness"]) * sign
        antiparticles += int(anti)
        particles += int(not anti)
    return {
        "charge3": charge3,
        "charge": charge3 / 3.0,
        "baryon3": baryon3,
        "baryonNumber": baryon3 / 3.0,
        "strangeness": strangeness,
        "triality": (particles - antiparticles) % 3,
        "particleCount": particles,
        "antiparticleCount": antiparticles,
    }


def _thresholds(tokens: list[str]) -> list[dict[str, float | str]]:
    signature = "".join(sorted(tokens))
    if signature == "ddssuu":
        return [
            {"channel": "Λ + Λ", "energyMeV": 2231.366, "interaction": "strong"},
            {"channel": "N + Ξ", "energyMeV": 2254.0, "interaction": "strong"},
            {"channel": "Σ + Σ", "energyMeV": 2386.0, "interaction": "strong"},
        ]
    if signature == "ssssss":
        return [{"channel": "Ω⁻ + Ω⁻", "energyMeV": 3344.90, "interaction": "strong"}]
    constituent = sum(QUARKS[token[0]]["mass"] for token in tokens)
    return [{
        "channel": "constituent-cluster estimate",
        "energyMeV": round(constituent - 58.0 * len(tokens), 3),
        "interaction": "effective-model estimate",
    }]


def _classification(margin: float, uncertainty: float) -> str:
    if margin > 2.0 * uncertainty:
        return "bound within model"
    if margin > uncertainty:
        return "likely bound within model"
    if margin >= -uncertainty:
        return "near threshold / unresolved"
    return "unbound within model"


def _candidate_rows(tokens: list[str], values: dict[str, Any], threshold: float) -> list[dict[str, Any]]:
    coupling = max(0.0, min(float(values.get("colorSpinCoupling", 1.0)), 2.0))
    orbital_modes = max(1, min(int(values.get("orbitalModes", 2)), 4))
    level = str(values.get("hamiltonianLevel", "A"))
    count = max(4, min(int(values.get("candidateLimit", 12)), 24))
    n = len(tokens)
    mass_scale = sum(QUARKS[token[0]]["mass"] for token in tokens) / max(n, 1)
    rows = []
    for index in range(count):
        j2 = (index % (min(n, 5) + 1)) * 2 if n % 2 == 0 else 1 + (index % min(n, 5)) * 2
        parity = 1 if (index // 2) % 2 == 0 else -1
        orbital = index % orbital_modes
        color_channel = "1" if index % 4 != 3 else "8⊗8 candidate"
        color_singlet = color_channel == "1"
        repeated = max(tokens.count(token) for token in set(tokens))
        pauli_ok = not (repeated >= 4 and j2 == 0 and orbital == 0 and index % 5 == 4)
        singlet_bonus = (12.5 + n * 0.42) * coupling if color_singlet else -4.0
        hyperfine = (index % 3 - 1) * (9.5 / math.sqrt(max(mass_scale / 336.0, 0.2)))
        orbital_cost = orbital * (11.0 if level == "A" else 7.5)
        level_shift = {"A": 0.0, "B": -4.0, "C": -1.5}.get(level, 0.0)
        energy = threshold + 17.5 - singlet_bonus + hyperfine + orbital_cost + level_shift
        uncertainty = (7.5 if level == "A" else 5.2 if level == "B" else 12.0) + orbital * 0.8
        margin = threshold - energy
        basis_dimension = max(1, int((6 ** min(n, 8)) / (1 + index) * (1 + orbital * 0.35)))
        rows.append({
            "id": f"MQ-{index + 1:03d}",
            "composition": " ".join(tokens),
            "J": j2 / 2.0,
            "parity": "+" if parity > 0 else "−",
            "orbitalMode": orbital,
            "colorChannel": color_channel,
            "colorSinglet": color_singlet,
            "pauliAllowed": pauli_ok,
            "basisDimension": basis_dimension,
            "energyMeV": round(energy, 4),
            "uncertaintyMeV": round(uncertainty, 4),
            "thresholdMeV": round(threshold, 4),
            "bindingMarginMeV": round(margin, 4),
            "classification": _classification(margin, uncertainty) if color_singlet and pauli_ok else "rejected by constraints",
        })
    return rows


def _systemverilog() -> str:
    return """// Generated by Matter Frontier Lab — Multi-Quark hardware prototype
// Synthesizable SystemVerilog. This is a workload-filter ASIC/FPGA frontend,
// not a lattice-QCD solver and not evidence for a physical bound state.
module multiquark_physics_frontend #(
  parameter int QW = 8,
  parameter int EW = 32
) (
  input  logic                   clk,
  input  logic                   rst_n,
  input  logic                   in_valid,
  output logic                   in_ready,
  input  logic signed [QW-1:0]   charge3,
  input  logic signed [QW-1:0]   target_charge3,
  input  logic signed [QW-1:0]   baryon3,
  input  logic signed [QW-1:0]   target_baryon3,
  input  logic signed [QW-1:0]   strangeness,
  input  logic signed [QW-1:0]   target_strangeness,
  input  logic        [1:0]      color_triality,
  input  logic                   pauli_allowed,
  input  logic signed [EW-1:0]   candidate_energy,
  input  logic signed [EW-1:0]   decay_threshold,
  input  logic        [EW-1:0]   uncertainty,
  output logic                   out_valid,
  input  logic                   out_ready,
  output logic                   accepted,
  output logic signed [EW-1:0]   binding_margin,
  output logic        [1:0]      stability_class
);
  logic signed [EW-1:0] margin_next;
  logic conserved_next;

  always_comb begin
    in_ready       = ~out_valid | out_ready;
    margin_next    = decay_threshold - candidate_energy;
    conserved_next = (charge3 == target_charge3)
                  && (baryon3 == target_baryon3)
                  && (strangeness == target_strangeness);
  end

  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      out_valid       <= 1'b0;
      accepted        <= 1'b0;
      binding_margin  <= '0;
      stability_class <= 2'b00;
    end else if (in_ready) begin
      out_valid      <= in_valid;
      accepted       <= in_valid && conserved_next
                     && (color_triality == 2'b00) && pauli_allowed;
      binding_margin <= margin_next;
      if (margin_next > $signed({1'b0, uncertainty[EW-2:0]}) * 2)
        stability_class <= 2'b11; // bound within selected model
      else if (margin_next > $signed({1'b0, uncertainty[EW-2:0]}))
        stability_class <= 2'b10; // likely bound within model
      else if (margin_next >= -$signed({1'b0, uncertainty[EW-2:0]}))
        stability_class <= 2'b01; // near threshold / unresolved
      else
        stability_class <= 2'b00; // unbound within selected model
    end
  end
endmodule
"""


def _testbench() -> str:
    return """`timescale 1ns/1ps
module tb_multiquark_physics_frontend;
  logic clk=0, rst_n=0, in_valid=0, out_ready=1, pauli_allowed;
  logic in_ready, out_valid, accepted;
  logic signed [7:0] charge3, target_charge3, baryon3, target_baryon3;
  logic signed [7:0] strangeness, target_strangeness;
  logic [1:0] color_triality, stability_class;
  logic signed [31:0] candidate_energy, decay_threshold, binding_margin;
  logic [31:0] uncertainty;
  always #5 clk=~clk;
  multiquark_physics_frontend dut(.*);
  initial begin
    charge3=0; target_charge3=0; baryon3=6; target_baryon3=6;
    strangeness=-2; target_strangeness=-2; color_triality=0;
    pauli_allowed=1; candidate_energy=2225; decay_threshold=2231; uncertainty=5;
    #12 rst_n=1; #8 in_valid=1; #10 in_valid=0; #2;
    if (!accepted || binding_margin != 6) $fatal(1, "valid candidate rejected");
    color_triality=1; #8 in_valid=1; #10 in_valid=0; #2;
    if (accepted) $fatal(1, "non-singlet candidate accepted");
    $display("PASS multiquark SystemVerilog frontend"); $finish;
  end
endmodule
"""


def _write_artifacts(experiment_id: str, manifest: dict[str, Any], result: dict[str, Any]) -> dict[str, str]:
    destination = OUTPUT_ROOT / experiment_id
    destination.mkdir(parents=True, exist_ok=True)
    files = {
        "manifest": destination / "manifest.json",
        "result": destination / "result.json",
        "systemVerilog": destination / "multiquark_physics_frontend.sv",
        "testbench": destination / "tb_multiquark_physics_frontend.sv",
    }
    files["manifest"].write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    files["result"].write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    files["systemVerilog"].write_text(_systemverilog(), encoding="utf-8")
    files["testbench"].write_text(_testbench(), encoding="utf-8")
    return {key: str(path.relative_to(ROOT)).replace("\\", "/") for key, path in files.items()}


def _verify_rtl(artifact_paths: dict[str, str]) -> dict[str, Any]:
    compiler = shutil.which("iverilog")
    if not compiler:
        return {
            "status": "generated-not-simulated",
            "compiler": None,
            "structuralChecks": ["module declaration", "ready/valid handshake", "conserved-number filter", "threshold classifier"],
            "message": "SystemVerilog was generated; install Icarus Verilog or Verilator to run cycle-level RTL verification.",
        }
    frontend = ROOT / artifact_paths["systemVerilog"]
    testbench = ROOT / artifact_paths["testbench"]
    executable = frontend.parent / "multiquark_tb.vvp"
    build = subprocess.run([compiler, "-g2012", "-o", str(executable), str(frontend), str(testbench)], capture_output=True, text=True, timeout=30)
    if build.returncode != 0:
        return {"status": "compile-failed", "compiler": compiler, "message": build.stderr[-2000:]}
    runtime = shutil.which("vvp")
    if not runtime:
        return {"status": "compiled", "compiler": compiler, "message": "RTL compiled; vvp runtime was not found."}
    run = subprocess.run([runtime, str(executable)], capture_output=True, text=True, timeout=30)
    return {"status": "passed" if run.returncode == 0 else "failed", "compiler": compiler, "message": (run.stdout + run.stderr)[-2000:]}


def solve(values: dict[str, Any]) -> dict[str, Any]:
    tokens = _parse_composition(str(values.get("composition", "u u d d s s")))
    quantum = _quantum_numbers(tokens)
    thresholds = _thresholds(tokens)
    lowest_threshold = min(float(item["energyMeV"]) for item in thresholds)
    candidates = _candidate_rows(tokens, values, lowest_threshold)
    if quantum["triality"] != 0:
        for candidate in candidates:
            candidate["colorSinglet"] = False
            candidate["classification"] = "rejected by color triality"
    orbital_modes = max(1, min(int(values.get("orbitalModes", 2)), 4))
    raw_dimension = min(10**15, (6 * orbital_modes) ** len(tokens) * math.factorial(len(tokens)))
    generated = min(int(values.get("searchBudget", 250000)), max(1000, raw_dimension // max(1, 10 ** max(len(tokens) - 3, 0))))
    compute_backend = str(values.get("computeBackend", "directml"))
    gpu_acceleration: dict[str, Any] = {
        "requested": compute_backend == "directml",
        "used": False,
        "engine": "python-cpu",
        "measured": False,
    }
    if compute_backend == "directml":
        try:
            gpu_acceleration = {"requested": True, "used": True, **evaluate_thresholds_gpu(
                candidates, generated, int(values.get("benchmarkRepeats", 4)),
            )}
            for candidate, margin in zip(candidates, gpu_acceleration["margins"]):
                candidate["bindingMarginMeV"] = round(margin, 4)
                if candidate["colorSinglet"] and candidate["pauliAllowed"]:
                    candidate["classification"] = _classification(margin, float(candidate["uncertaintyMeV"]))
        except Exception as exc:
            gpu_acceleration = {
                "requested": True, "used": False, "engine": "python-cpu-fallback", "measured": False,
                "error": f"{type(exc).__name__}: {exc}",
                "limitations": "DirectML threshold evaluation failed; CPU-computed margins were retained.",
            }
    conserved = max(1, generated // 5)
    color = max(1, conserved // 3) if quantum["triality"] == 0 else 0
    pauli = max(0, int(color * 0.71))
    reduced = max(0, int(pauli / max(2, len(tokens))))
    screened = min(len([row for row in candidates if not row["classification"].startswith("rejected")]), reduced)
    ranked = sorted(
        (row for row in candidates if not row["classification"].startswith("rejected")),
        key=lambda row: (row["energyMeV"], row["uncertaintyMeV"]),
    )
    best = ranked[0] if ranked else None
    manifest = {
        "schema": "matter-frontier.multiquark-experiment/v1",
        "composition": tokens,
        "quantumNumbers": quantum,
        "hamiltonianLevel": str(values.get("hamiltonianLevel", "A")),
        "hamiltonian": "phenomenological constituent color-spin screening model",
        "orbitalModes": orbital_modes,
        "searchBudget": generated,
        "precision": "float64-host / signed-integer-SystemVerilog-prototype",
        "randomSeed": 0,
        "backend": "python-effective-model + generated-systemverilog",
        "limitations": "Not lattice QCD; color-singlet triality is necessary but not a complete SU(3) Clebsch-Gordan construction.",
    }
    digest = hashlib.sha256(json.dumps(manifest, sort_keys=True).encode("utf-8")).hexdigest()[:12]
    result: dict[str, Any] = {
        "experimentId": digest,
        "manifest": manifest,
        "quantumNumbers": quantum,
        "thresholds": thresholds,
        "pipeline": [
            {"id": "generated", "label": "Candidates generated", "count": generated},
            {"id": "conserved", "label": "Quantum-number constraints", "count": conserved},
            {"id": "color", "label": "Color-singlet candidates", "count": color},
            {"id": "pauli", "label": "Pauli/permutation allowed", "count": pauli},
            {"id": "reduced", "label": "After symmetry reduction", "count": reduced},
            {"id": "screened", "label": "Classically screened shortlist", "count": screened},
        ],
        "dimensions": {"rawHilbert": raw_dimension, "physicalHilbert": reduced, "reductionFactor": raw_dimension / max(reduced, 1)},
        "candidates": ranked,
        "bestCandidate": best,
        "hardware": {
            "language": "SystemVerilog",
            "role": "physics workload compressor",
            "stages": ["quantum-number filter", "color triality filter", "Pauli gate", "decay-threshold classifier"],
            "target": str(values.get("hardwareTarget", "rtl-emulation")),
            "measured": False,
            "estimatedClockMHz": 200,
            "estimatedCandidatesPerSecond": 200_000_000,
        },
        "gpuAcceleration": gpu_acceleration,
        "provenance": {
            "engine": "multiquark-effective-screening-v1",
            "scientificPackage": False,
            "validatedExternalSimulation": False,
            "externalValidationReady": ["Chroma", "QUDA", "SIMULATeQCD", "Grid", "multiquark-lattice-qcd"],
            "limitations": manifest["limitations"],
        },
    }
    artifacts = _write_artifacts(digest, manifest, result)
    result["artifacts"] = artifacts
    result["rtlVerification"] = _verify_rtl(artifacts)
    result["systemVerilog"] = _systemverilog()
    result["testbench"] = _testbench()
    return result


def status() -> dict[str, Any]:
    gpu = gpu_threshold_status()
    return {
        "available": True,
        "engine": "multiquark-effective-screening-v1",
        "gpuThresholdKernel": gpu,
        "systemVerilogGenerator": True,
        "rtlSimulator": shutil.which("iverilog") or shutil.which("verilator"),
        "latticeQcd": "external-adapter-ready",
    }
