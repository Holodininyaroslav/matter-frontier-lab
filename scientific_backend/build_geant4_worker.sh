#!/usr/bin/env bash
set -euo pipefail

environment_root="/root/.matter-frontier-lab/geant4-env"
source_file="/mnt/c/Users/79090/Documents/Codex/2026-07-23/physical-simulation/qcd-neutrino-lab/scientific_backend/geant4_worker.cpp"
output_file="/root/.matter-frontier-lab/bin/geant4_worker"

mkdir -p "$(dirname "$output_file")"
mapfile -t compile_flags < <("$environment_root/bin/geant4-config" --cflags | xargs -n1)
mapfile -t link_flags < <("$environment_root/bin/geant4-config" --libs | xargs -n1)
g++ -std=c++17 -O2 "$source_file" -o "$output_file" "${compile_flags[@]}" "${link_flags[@]}" \
  -Wl,-rpath,"$environment_root/lib"
