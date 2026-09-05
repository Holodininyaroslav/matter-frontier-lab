# Notices and attribution

## Original project code

The Matter Frontier Lab source code in this repository is original project code released under the MIT License unless a file states otherwise.

## Third-party code and resources

- **Three.js** is used under its own MIT License. See <https://github.com/mrdoob/three.js>.
- **Mol* 5.4.2** is vendored as the interactive biomolecular viewer under its
  MIT License. The upstream license is preserved in
  `matter-lab/vendor/molstar/LICENSE`; see <https://github.com/molstar/molstar>.
- **UCSF ChimeraX** is not bundled or redistributed. Matter Frontier Lab can
  optionally send an explicit `open` command to a separately installed,
  user-started ChimeraX localhost REST service. ChimeraX remains subject to its
  own non-commercial and distribution terms; see
  <https://www.rbvi.ucsf.edu/chimerax/docs/licensing.html>.
- **RCSB Protein Data Bank** and **AlphaFold Protein Structure Database**
  structures are loaded on demand from their official services and retain
  source/accession metadata. ColabFold is exposed as an explicit provider
  handoff and is not represented as installed when its local executable is
  absent.
- **NVIDIA CUDA-Q** is Apache-2.0 software.  The compact `N=15`, `a=2`
  Shor teaching circuit in this repository is an independent adaptation of the
  openly documented CUDA-Q application workflow at
  <https://nvidia.github.io/cuda-quantum/latest/applications/python/shors.html>.
  CUDA-Q and its upstream examples retain their own notices and licence.
- **NASA visual resources and 3D assets** are used or referenced only where noted in the relevant model card. Their use remains subject to NASA's media-use guidance and any asset-specific provenance information.
- **PYTHIA 8, HepMC3, Geant4, nuSQuIDS, MUSES, CompOSE, MEEP, Einstein Toolkit, GADGET-4, CosmoLattice and AxionCAMB** are independent projects. They are not copied into or run by this browser application unless a future adapter explicitly says so. Their names, manuals and URLs are referenced for scientific provenance and potential integration.

## Research integrity

The local visualisations and solver are educational approximations. They are not substitutes for external validated simulations, detector reconstruction, numerical-relativity calculations, neutrino-transport calculations or quantum-hardware runs.
