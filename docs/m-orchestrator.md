# M-particle gravitational orchestrator

This card replaces the six-body balancing demonstration under the same
catalogue ID, `resonantTripleBlackHole`, but uses a new `mOrchestrator` view
and a separate, dependency-free numerical engine. The ordinary black-hole
merger card is unchanged. Smart Matter chemistry does not inherit this law.

## Defined experiment

The user-defined M-particle hypothesis is represented by a local tensor channel
between each pair of black holes. Its director is the instantaneous pair axis
`n = (r_j - r_i)/r`; a spin-2 tensor orientation can be represented as
`n ⊗ n - I/3`. The channel occupation `u` varies from 0 to 1. It is an effective
occupation fraction during switching, not a literal fractional spin quantum
number. Dots sample this collective M-field across the map. Magenta dots and
short director lines mark activated regions around the relevant pair, with a
Gaussian transverse falloff. The rendered samples are a visualization of the
channel field, not an additional, independently evolved particle solver.

The postulated force on body i from j is

```text
F_ij = G m_i m_j (1 - k u_ij) (r_j - r_i) / (r_ij² + epsilon²)^(3/2)
```

`k <= 0.999`, so the force is always attractive. Screening removes most of
the attraction while existing angular momentum lets the bodies fly past each
other. It does not inject an outward or tangential force. Switching spin to 2
is not known to screen real gravity; that connection is the explicit new law
of this experiment. The model is neither Einstein Toolkit output nor a
validated relativistic M-particle theory.

## Controller and integration

For each pair the controller estimates an osculating Newtonian pericentre
from relative position, relative velocity, energy and angular momentum.
When that estimate is unsafe, the pair is approaching, and its separation
is inside the activation range, its local M-channel switches on. A hysteresis
latch keeps it on through the close passage. The channel relaxes after the
pair separates beyond 1.65 times the trigger radius. Every pair in a 3–8-body
system uses the same rule; no body has a prescribed trajectory.

All positions and velocities are advanced with a fixed-step kick–drift–kick
scheme (`dt = 0.008` by default). A split pairwise drag step represents
illustrative dissipation, not calibrated radiation reaction. Pair forces and
drag preserve total linear momentum; gravity is central, so it does not
produce an artificial reversal of angular momentum. Time-step refinement is
tested. The renderer uses these integrated coordinates and their history.

The instantaneous softened potential is
`U_ij = -G m_i m_j (1-k u_ij)/sqrt(r²+epsilon²)`.
Changes in `u` or the user-controlled coupling parameter change potential
energy. That energy is recorded as M-field work. The displayed residual is
`E(t) - E(0) - W_M + E_diss`. Thus the model does not conceal an external
energy supply or claim a free-energy mechanism.

## Units, boundaries and controls

- Mass unit: 30 solar masses; length unit: 500 km; `G=1`.
- Time unit: about 0.0056036 s. The playback rate is a display control.
- Displayed horizon radii scale linearly with mass using `r_s=2GM/c²`.
- All body centres lie in the same x–z plane. The deformed surface below is
  a visual embedding analogy, not a computed spacetime metric.
- The waveform panel shows a quadrupole indicator from the integrated
  positions, velocities and accelerations; it is not physical detector strain.
- Horizon contact ends the approximate calculation and records `CAPTURE`.
  A fabricated safe orbit or numerical-GR merger is not substituted.
- A head-on encounter with zero angular momentum cannot acquire tangential
  motion by central attraction screening alone. Arbitrary builder layouts
  are therefore not guaranteed to avoid contact.
- Preset selection and constructor edits change initial conditions and reset
  the experiment. M-field on/off and screening controls act during the run.
- There is no artificial return boundary. An escaping body can leave the
  displayed map; camera tracking can zoom out to keep the system in view.

## Validation

`node --test tests/test_m_orchestrator.mjs` checks the 2/3/4-body presets both
with and without M-screening, fixed-step convergence, frame-rate independence,
linear momentum, work/energy accounting, force direction, continuous velocities,
head-on failure reporting and constructor validation. The browser comparison
button runs the same engine, not a second animation model.

At default settings over 240 model time units:

| Bodies | M-field: captures | Tangential pair passages | Minimum centre separation / sum of radii | Field disabled |
| --- | ---: | ---: | ---: | --- |
| 2 | 0 | 1 | 5.125 | Horizon contact |
| 3 | 0 | 3 | 5.125 | Horizon contact |
| 4 | 0 | 6 | 4.637 | Horizon contact |

These are finite tests of this postulated law. They establish neither eternal
stability nor the existence of a real gravitational screening mechanism.

## Physical reference context

### Cyclic controller update — 2026-09-05

The default controller restores attraction on the outward leg at the same
pair separation where screening was activated. Finite symmetric switching
limits net energy injection; velocities and positions are never reset.
The energy ledger includes work exchanged with the hypothetical field.
At the default integration step of 0.002, presets with 2, 3 and 4 bodies
complete respectively 6, 21 and 48 tangential pair passages during 600 model
time units without capture. This is a finite numerical test, not a guarantee
for arbitrary initial conditions or infinite time.

For actual binary spacetime evolution, see the
[Einstein Toolkit binary black-hole example](https://www.einsteintoolkit.org/gallery/bbh/index.html)
and the [post-Newtonian radiation review](https://arxiv.org/abs/1310.1528).
They are reference context, not the engine used by this hypothesis card.
