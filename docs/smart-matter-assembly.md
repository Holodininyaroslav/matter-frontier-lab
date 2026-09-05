# Sequential Smart Matter demonstration

The initial view contains only the wireframe molecular target calculated by
RDKit. All actual particles have negative i coordinates and are invisible.

For each atom, the display controller performs the following sequence:

1. Shift i from its negative initial value to zero (0.7 s at default speed).
2. Reveal the particle at its full display radius; move it to the target
   position (1.1 s). No size growth or falling-from-above effect is used.
3. Complete placement and draw valid bonds to already placed neighbours
   (0.22 s), then start the next atom.

Only one particle can be in transit. The global pause freezes the controller;
resuming does not include time spent paused. Speed controls affect subsequent
progress without rewinding particles. Reset restores the empty target matrix.

The target graph, properties and conformer are RDKit calculations. The i
coordinate, programmable substitution and this timing are author-defined
visualisation rules, not molecular dynamics or a reaction pathway.

GitHub Pages loads precomputed public targets for eight small molecules at
seed 61453. Local installations calculate new targets with RDKit.

Regression tests: `node --test tests/test_smart_assembly.mjs`.
