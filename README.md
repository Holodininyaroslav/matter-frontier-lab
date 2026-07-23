# Matter Frontier Lab

An independent, local-first browser project for interactive particle-physics education and exploration.

## Included laboratories

- **Matter Frontier Catalog:** procedural visualizations of ordinary, dense, quark and strange matter; mesons; collider events; and a curated exotic-matter section. Every catalogue card is marked as confirmed, theoretical, hypothetical, or a laboratory material, and carries links to scientific literature and/or open simulation software.
- **Neutrino Communication Lab:** a visual demonstrator of a neutrino beam travelling through rock to a detector, alongside an electromagnetic comparison channel.

## Run locally

```powershell
python server.py --port 8892
```

Open `http://127.0.0.1:8892/`. The default portal language is English; Russian and Hebrew are selectable from the top-right language menu.

For Windows, double-click `start_qcd_neutrino_lab.bat`. It automatically restarts the server if the process exits unexpectedly.

## Scientific scope

The project is an educational visualization layer, not an experimental prediction engine. The UI distinguishes confirmed processes, published theoretical models, and explicitly hypothetical extensions. Future work includes traceable integrations with validated EOS, propagation, and event-data resources; reproducible presets; and improved accessibility.

## Open simulation references in the catalog

- **Axion dark matter:** [AxionCAMB](https://github.com/dgrin1/axionCAMB) computes cosmological observables for axion components.
- **Cosmological dark matter:** [GADGET-4](https://wwwmpa.mpa-garching.mpg.de/gadget4/) is an open N-body/SPH code.
- **Boson stars and relativistic objects:** [Einstein Toolkit](https://einsteintoolkit.org/) provides open numerical-relativity infrastructure.
- **Q-balls:** the catalog links an [open PINN/radial-solver notebook](https://github.com/PedroBritodSa/Physics-Informed-Neural-Network-Project).
- **Metamaterials:** [MEEP](https://github.com/NanoComp/meep) is an open FDTD electromagnetic solver.

The browser visualizations do not execute those external research codes. They are deliberately labelled as lightweight educational approximations and link to the corresponding reproducible software or paper.
