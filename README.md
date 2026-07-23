# QCD & Neutrino Research Lab

An independent, local-first browser project for interactive particle-physics education and exploration.

## Included laboratories

- **QCD Matter Lab:** procedural visualizations of ordinary, dense, quark, and strange matter; mesons; a collider-event workspace; and a clearly labelled hypothetical neutrino-lens extension.
- **Neutrino Communication Lab:** a visual demonstrator of a neutrino beam travelling through rock to a detector, alongside an electromagnetic comparison channel.

## Run locally

```powershell
python server.py --port 8892
```

Open `http://127.0.0.1:8892/`. The default portal language is English; Russian and Hebrew are selectable from the top-right language menu.

For Windows, double-click `start_qcd_neutrino_lab.bat`. It automatically restarts the server if the process exits unexpectedly.

## Scientific scope

The project is an educational visualization layer, not an experimental prediction engine. The UI distinguishes confirmed processes, published theoretical models, and explicitly hypothetical extensions. Future work includes traceable integrations with validated EOS, propagation, and event-data resources; reproducible presets; and improved accessibility.
