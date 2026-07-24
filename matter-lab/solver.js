const PI = Math.PI;

export function solveModel(model, values, points = 90) {
  if (model.id === "neutrinoLens") return solveNeutrinoLens(values, points);
  if (model.interaction === "stringBreak") return solveStringBreaking(values, model, points);
  if (model.interaction === "collision") return solveCollision(values, model, points);
  if (model.interaction === "photon") return solveAtomicPhoton(values, model.id, points);
  if (model.interaction === "binding") return solveDibaryon(values, model.id, points);
  if (model.interaction === "stability") return solveStrangelet(values, points);
  if (["mitBag", "njl", "twoSC", "cfl", "qgp", "neutronMatter", "hyperonMatter", "kaonCondensate", "quarkyonic", "qhc21", "loff", "gCFL", "cflKaon"].includes(model.id)) {
    return solveEos(model.id, values, points);
  }
  return solveConfinement(values, points);
}

function solveStringBreaking(v, model, points) {
  const alpha = v.alphaS || .35;
  const kappa = Math.max(v.stringTension || .9, .01);
  const pairMass = Math.max(v.constituentMass || .33, .01);
  const separation = Math.max(v.separation || .8, .05);
  const thresholdDistance = 2 * pairMass / kappa;
  const stringEnergy = kappa * separation;
  const excess = Math.max(0, stringEnergy - 2 * pairMass);
  const schwingerWeight = Math.exp(-Math.PI * pairMass * pairMass / kappa);
  const pairProbability = schwingerWeight * (1 - Math.exp(-4.5 * excess));
  const data = [];
  const maxR = Math.max(4.5, thresholdDistance * 2.1);
  for (let i = 0; i < points; i += 1) {
    const r = .08 + (maxR - .08) * i / (points - 1);
    data.push({ x: r, primary: -4 * alpha / (3 * r) + kappa * r, secondary: kappa * r });
  }
  const current = data.reduce((best, point) => Math.abs(point.x - separation) < Math.abs(best.x - separation) ? point : best, data[0]);
  return {
    kind: "string-breaking",
    xLabel: "Разделение r, fm",
    yLabel: "V(r), GeV",
    primaryLabel: "Cornell + string breaking threshold",
    secondaryLabel: "κr",
    data,
    metrics: [["Энергия струны", stringEnergy, "GeV"], ["Порог r_break", thresholdDistance, "fm"], ["Вес q-q̄", pairProbability, "%"]],
    state: { current, separation, stringEnergy, thresholdDistance, pairProbability },
    event: { process: "stringBreak", separation, thresholdDistance, pairMass, kappa, pairProbability, parent: model.id },
    backendHint: "PYTHIA 8 Lund-fragmentation adapter"
  };
}

function seededRandom(seed) {
  let state = (Math.floor(seed) || 1) >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function gaussian(random) {
  const a = Math.max(random(), 1e-9);
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * PI * random());
}

function collisionTrack(type, charge, phi, theta, momentum, origin = [0, 0, 0], extra = {}) {
  return { type, charge, phi, theta, momentum, origin, ...extra };
}

function addBalancedSoftTracks(tracks, random, pairs, momentumScale = 2.2) {
  for (let i = 0; i < pairs; i += 1) {
    const phi = random() * 2 * PI;
    const eta = (random() * 2 - 1) * 2.35;
    const theta = 2 * Math.atan(Math.exp(-eta));
    const momentum = .18 + -Math.log(Math.max(1 - random(), 1e-8)) * momentumScale;
    const charge = random() > .5 ? 1 : -1;
    tracks.push(collisionTrack("chargedHadron", charge, phi, theta, momentum));
    tracks.push(collisionTrack("chargedHadron", -charge, phi + PI, PI - theta, momentum * (.94 + random() * .12)));
  }
}

const COLLIDER_BEAMS = {
  proton: { label: "p", pdg: 2212, kind: "hadron", charge: 1 },
  antiproton: { label: "p̄", pdg: -2212, kind: "hadron", charge: -1 },
  neutron: { label: "n", pdg: 2112, kind: "hadron", charge: 0, conjugate: "antineutron" },
  antineutron: { label: "n̄", pdg: -2112, kind: "hadron", charge: 0, conjugate: "neutron" },
  hyperon: { label: "Λ", pdg: 3122, kind: "hadron", charge: 0, conjugate: "antihyperon" },
  antihyperon: { label: "Λ̄", pdg: -3122, kind: "hadron", charge: 0, conjugate: "hyperon" },
  pionPlus: { label: "π⁺", pdg: 211, kind: "hadron", charge: 1 },
  pionMinus: { label: "π⁻", pdg: -211, kind: "hadron", charge: -1 },
  electron: { label: "e⁻", pdg: 11, kind: "lepton", charge: -1, conjugate: "positron" },
  positron: { label: "e⁺", pdg: -11, kind: "lepton", charge: 1, conjugate: "electron" },
  muonMinus: { label: "μ⁻", pdg: 13, kind: "lepton", charge: -1, conjugate: "muonPlus" },
  muonPlus: { label: "μ⁺", pdg: -13, kind: "lepton", charge: 1, conjugate: "muonMinus" },
  photon: { label: "γ", pdg: 22, kind: "photon", charge: 0 }
};

function resolveWorkbench(v) {
  const beamA = COLLIDER_BEAMS[v.beamA] || COLLIDER_BEAMS.proton;
  const beamB = COLLIDER_BEAMS[v.beamB] || COLLIDER_BEAMS.proton;
  const requested = v.processMode || "auto";
  let allowed = [];
  let automatic = null;
  if (beamA.kind === "hadron" && beamB.kind === "hadron") {
    const conjugatePair = beamA.conjugate === v.beamB || beamB.conjugate === v.beamA || (v.beamA === "proton" && v.beamB === "antiproton") || (v.beamA === "antiproton" && v.beamB === "proton");
    allowed = conjugatePair ? ["annihilation", "softQCD", "hardQCD"] : ["softQCD", "hardQCD"];
    automatic = conjugatePair ? "annihilation" : "softQCD";
  } else if ((beamA.kind === "lepton" && beamB.kind === "hadron") || (beamA.kind === "hadron" && beamB.kind === "lepton")) {
    allowed = ["dis"];
    automatic = "dis";
  } else if ((beamA.kind === "photon" && beamB.kind === "hadron") || (beamA.kind === "hadron" && beamB.kind === "photon")) {
    allowed = ["photoproduction"];
    automatic = "photoproduction";
  } else if (beamA.kind === "photon" && beamB.kind === "photon") {
    allowed = ["pairProduction"];
    automatic = "pairProduction";
  } else if (beamA.kind === "lepton" && beamB.kind === "lepton" && beamA.conjugate === v.beamB) {
    allowed = ["annihilation"];
    automatic = "annihilation";
  }
  const supported = Boolean(automatic);
  const mode = requested === "auto" || !allowed.includes(requested) ? automatic : requested;
  const processLabel = ({ softQCD: "Soft QCD / minimum-bias", hardQCD: "Hard QCD / dijet", annihilation: beamA.kind === "hadron" ? "baryon–antibaryon annihilation → radiative energy release" : "γ*/Z annihilation", dis: "deep-inelastic scattering", photoproduction: "photoproduction", pairProduction: "γγ pair production" })[mode] || "unsupported beam pair";
  return {
    supported,
    mode,
    processLabel,
    beamA,
    beamB,
    beamPair: `${beamA.label} ↔ ${beamB.label}`,
    reason: supported ? "" : "Текущий быстрый движок поддерживает hadron-hadron, conjugate lepton pairs, lepton-hadron, photon-hadron и photon-photon."
  };
}

function solveCollision(v, model, points) {
  const random = seededRandom(v.eventSeed || 1);
  const workbench = model.collisionMode === "workbench";
  const setup = workbench ? resolveWorkbench(v) : { supported: true, mode: model.collisionMode || "minimumBias", processLabel: null, beamPair: "p ↔ p", beamA: COLLIDER_BEAMS.proton, beamB: COLLIDER_BEAMS.proton, reason: "" };
  const mode = setup.mode;
  const beamEnergy = v.beamEnergy || 13.6;
  const magneticField = v.detectorField ?? 3.8;
  const tracks = [];
  const vertices = [[0, 0, 0]];
  if (!setup.supported) {
    return {
      kind: "collision-event",
      xLabel: "Азимут φ, rad",
      yLabel: "Σp, GeV",
      primaryLabel: "Unsupported beam pair",
      secondaryLabel: "charged multiplicity",
      data: Array.from({ length: points }, (_, i) => ({ x: -PI + 2 * PI * i / (points - 1), primary: 0, secondary: 0 })),
      metrics: [["√s", beamEnergy, "TeV"], ["N charged", 0, "tracks"], ["Σp visible", 0, "GeV"]],
      state: { ...setup, trackCount: 0, charged: 0, magneticField },
      event: { process: "collision", mode: null, tracks: [], vertices, beamEnergy, magneticField, seed: Math.floor(v.eventSeed || 1), beamA: setup.beamA.pdg, beamB: setup.beamB.pdg },
      backendHint: "Select a PYTHIA-compatible beam pair"
    };
  }
  if (mode === "minimumBias" || mode === "softQCD") {
    const overlap = Math.max(.18, 1 - (v.impactParameter || 0) / 2.15);
    const pairs = Math.round((7 + 5.3 * Math.log(Math.max(beamEnergy, 1))) * overlap + random() * 5);
    addBalancedSoftTracks(tracks, random, pairs, 1.25 + beamEnergy * .05);
  } else if (mode === "dijet" || mode === "hardQCD" || mode === "photoproduction") {
    const axis = random() * 2 * PI;
    const hardScale = v.hardScale || 90;
    for (let jet = 0; jet < 2; jet += 1) {
      const jetAxis = axis + jet * PI;
      const fragments = 11 + Math.floor(random() * 7);
      for (let i = 0; i < fragments; i += 1) {
        const phi = jetAxis + gaussian(random) * .13;
        const theta = PI / 2 + gaussian(random) * .18;
        const momentum = Math.max(.6, hardScale / fragments * (.35 + random() * 1.25));
        tracks.push(collisionTrack(i % 5 === 0 ? "neutralHadron" : "chargedHadron", i % 5 === 0 ? 0 : (i % 2 ? 1 : -1), phi, theta, momentum, [0, 0, 0], { jet }));
      }
    }
    addBalancedSoftTracks(tracks, random, 5, 1.4);
    if (mode === "photoproduction") tracks.push(collisionTrack("neutralHadron", 0, axis + PI / 2, .16, Math.max(1, hardScale * .18), [0, 0, 0], { remnant: true }));
  } else if (mode === "higgsDiphoton") {
    const phi = random() * 2 * PI;
    const theta = .55 + random() * (PI - 1.1);
    const momentum = (v.resonanceMass || 125.25) / 2;
    tracks.push(collisionTrack("photon", 0, phi, theta, momentum, [0, 0, 0], { primary: true }));
    tracks.push(collisionTrack("photon", 0, phi + PI, PI - theta, momentum, [0, 0, 0], { primary: true }));
    addBalancedSoftTracks(tracks, random, 5, 1.2);
  } else if (mode === "zPrime") {
    const phi = random() * 2 * PI;
    const theta = .42 + random() * (PI - .84);
    const momentum = (v.resonanceMass || 1800) / 2;
    tracks.push(collisionTrack("muon", 1, phi, theta, momentum, [0, 0, 0], { primary: true }));
    tracks.push(collisionTrack("muon", -1, phi + PI, PI - theta, momentum, [0, 0, 0], { primary: true }));
    addBalancedSoftTracks(tracks, random, 4, 1.1);
  } else if (mode === "annihilation" && setup.beamA.kind === "hadron") {
    const phi = random() * 2 * PI;
    const energy = Math.max(.3, beamEnergy * 1.8);
    // The display deliberately uses an idealised radiative channel: the energy
    // leaves as photon wavefronts, not as misleading generic hadron tracks.
    for (let i = 0; i < 6; i += 1) {
      const angle = phi + i * Math.PI / 3;
      tracks.push(collisionTrack("photon", 0, angle, PI / 2 + (i % 2 ? .18 : -.18), energy / 3, [0, 0, 0], { primary: true, radiative: true }));
    }
  } else if (mode === "annihilation" || mode === "pairProduction") {
    const phi = random() * 2 * PI;
    const theta = .38 + random() * (PI - .76);
    const momentum = Math.max(1, beamEnergy * 1000 / 2);
    tracks.push(collisionTrack("muon", 1, phi, theta, momentum, [0, 0, 0], { primary: true }));
    tracks.push(collisionTrack("muon", -1, phi + PI, PI - theta, momentum, [0, 0, 0], { primary: true }));
  } else if (mode === "dis") {
    const phi = random() * 2 * PI;
    const theta = .32 + random() * .72;
    const q = Math.max(1, v.hardScale || 45);
    const leptonBeam = setup.beamA.kind === "lepton" ? v.beamA : v.beamB;
    const leptonType = leptonBeam.startsWith("muon") ? "muon" : leptonBeam === "positron" ? "positron" : "electron";
    const leptonCharge = COLLIDER_BEAMS[leptonBeam].charge;
    tracks.push(collisionTrack(leptonType, leptonCharge, phi, theta, q, [0, 0, 0], { primary: true, scatteredLepton: true }));
    const jetAxis = phi + PI;
    for (let i = 0; i < 14; i += 1) {
      tracks.push(collisionTrack(i % 5 === 0 ? "neutralHadron" : "chargedHadron", i % 5 === 0 ? 0 : (i % 2 ? 1 : -1), jetAxis + gaussian(random) * .18, PI - theta + gaussian(random) * .2, Math.max(.35, q / 14 * (.4 + random())), [0, 0, 0], { currentJet: true }));
    }
    tracks.push(collisionTrack("neutralHadron", 0, jetAxis, .12, q * .28, [0, 0, 0], { remnant: true }));
  } else {
    const baseLength = Math.max(1, v.decayLength || 78) / 34;
    for (let vertex = 0; vertex < 3; vertex += 1) {
      const phi = random() * 2 * PI;
      const distance = baseLength * (.65 + random() * .8);
      const origin = [Math.cos(phi) * distance, gaussian(random) * .18, Math.sin(phi) * distance];
      vertices.push(origin);
      for (let i = 0; i < 6; i += 1) {
        tracks.push(collisionTrack("chargedHadron", i % 2 ? 1 : -1, phi + gaussian(random) * .42, PI / 2 + gaussian(random) * .35, 2 + random() * 18, origin, { displaced: true, vertex: vertex + 1 }));
      }
    }
    addBalancedSoftTracks(tracks, random, 4, 1);
  }
  const angularBins = Array.from({ length: points }, (_, i) => ({ x: -PI + 2 * PI * i / (points - 1), primary: 0, secondary: 0 }));
  for (const track of tracks) {
    const wrapped = ((track.phi + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI;
    const index = Math.max(0, Math.min(points - 1, Math.round((wrapped + PI) / (2 * PI) * (points - 1))));
    angularBins[index].primary += track.momentum;
    angularBins[index].secondary += Math.abs(track.charge);
  }
  const charged = tracks.filter((track) => track.charge !== 0).length;
  const visibleEnergy = tracks.reduce((sum, track) => sum + track.momentum, 0);
  const label = setup.processLabel || ({ minimumBias: "minimum-bias", dijet: "QCD dijet", higgsDiphoton: "H→γγ", zPrime: "Z′→μ⁺μ⁻", hiddenValley: "hidden valley" })[mode];
  return {
    kind: "collision-event",
    xLabel: "Азимут φ, rad",
    yLabel: "Σp, GeV",
    primaryLabel: `Event energy flow · ${label}`,
    secondaryLabel: "charged multiplicity",
    data: angularBins,
    metrics: [["√s", beamEnergy, "TeV"], ["N charged", charged, "tracks"], ["Σp visible", visibleEnergy, "GeV"]],
    state: { mode, trackCount: tracks.length, charged, magneticField, supported: true, processLabel: label, beamPair: setup.beamPair, reason: "" },
    event: { process: "collision", mode, tracks, vertices, beamEnergy, magneticField, seed: Math.floor(v.eventSeed || 1), beamA: setup.beamA.pdg, beamB: setup.beamB.pdg, beamPair: setup.beamPair },
    backendHint: mode === "hiddenValley" || mode === "zPrime" ? "PYTHIA 8 BSM/HepMC3 adapter" : "PYTHIA 8/HepMC3 + Geant4 adapter"
  };
}

function solveNeutrinoLens(v, points) {
  const energy = Math.max(v.neutrinoEnergy || 10, 0.01);
  const rho = v.density || 0;
  const a = v.anisotropy || 0;
  const kappa = v.spinCoupling || 0;
  const length = v.lensLength || 38;
  const omegaX = 0.085 * kappa * rho * a / Math.sqrt(energy);
  const omegaY = 0.018 * kappa * rho * (1 - a) / Math.sqrt(energy);
  const omegaZ = 0.032 / energy + 0.0045 * rho;
  const omega = Math.hypot(omegaX, omegaY, omegaZ) || 1e-9;
  const nx = omegaX / omega;
  const ny = omegaY / omega;
  const nz = omegaZ / omega;
  const data = [];
  for (let i = 0; i < points; i += 1) {
    const x = length * i / (points - 1);
    const angle = 2 * omega * x;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const bx = ny * s + nx * nz * (1 - c);
    const by = -nx * s + ny * nz * (1 - c);
    const bz = c + nz * nz * (1 - c);
    data.push({ x, primary: (1 - bz) / 2, secondary: (1 + bz) / 2, bx, by, bz });
  }
  const final = data[data.length - 1];
  return {
    kind: "probability",
    xLabel: "Путь в линзе, m",
    yLabel: "Вероятность",
    primaryLabel: "P(helicity flip)",
    secondaryLabel: "P(survival)",
    data,
    metrics: [
      ["Переворот helicity", final.primary, "%"],
      ["Сохранение", final.secondary, "%"],
      ["|Ω|", omega, "m⁻¹"]
    ],
    state: final,
    backendHint: "nuSQuIDS adapter"
  };
}

function solveAtomicPhoton(v, atom, points) {
  const energy = Math.max(v.probeEnergy || 10.2, 0.01);
  const helium = atom === "helium4";
  const ionization = helium ? 24.587 : 13.598;
  const resonances = helium
    ? [{ energy: 20.62, n: 2, strength: 1 }, { energy: 21.22, n: 3, strength: .32 }, { energy: 23.09, n: 4, strength: .12 }]
    : [2, 3, 4, 5].map((n) => ({ energy: ionization * (1 - 1 / (n * n)), n, strength: ({ 2: .4162, 3: .0791, 4: .0290, 5: .0139 })[n] }));
  const linewidth = helium ? 0.16 : 0.09;
  const nearest = resonances.reduce((best, line) => Math.abs(line.energy - energy) < Math.abs(best.energy - energy) ? line : best, resonances[0]);
  let process = "elastic";
  let targetN = 1;
  let electronEnergy = 0;
  if (energy >= ionization) {
    process = "ionization";
    electronEnergy = energy - ionization;
  } else if (Math.abs(nearest.energy - energy) <= linewidth * 2.2) {
    process = "excitation";
    targetN = nearest.n;
  }
  const data = [];
  for (let i = 0; i < points; i += 1) {
    const x = 1 + ((helium ? 34 : 20) - 1) * i / (points - 1);
    let excitation = 0;
    for (const line of resonances) {
      const gamma = linewidth * (1 + line.n * .08);
      excitation += line.strength * gamma * gamma / ((x - line.energy) ** 2 + gamma * gamma);
    }
    const continuum = x > ionization ? 0.8 * Math.pow(ionization / x, 3) * Math.sqrt(1 - ionization / x) : 0;
    data.push({ x, primary: excitation + continuum, secondary: continuum });
  }
  const processLabel = process === "ionization" ? "Ионизация" : process === "excitation" ? `Возбуждение 1s → n=${targetN}` : "Упругое рассеяние";
  return {
    kind: "atomic-spectrum",
    xLabel: "Энергия фотона Eγ, eV",
    yLabel: "Относительный отклик",
    primaryLabel: "Спектр поглощения / ионизации",
    secondaryLabel: "Континуум ионизации",
    data,
    metrics: [
      ["Процесс", processLabel, ""],
      ["Порог ионизации", ionization, "eV"],
      ["Kₑ", electronEnergy, "eV"]
    ],
    event: { process, targetN, electronEnergy, photonEnergy: energy, threshold: ionization, resonanceEnergy: nearest.energy },
    backendHint: "Geant4 / EPDL adapter"
  };
}

function solveDibaryon(v, id, points) {
  const attraction = v.attraction || 28;
  const range = v.range || 1.15;
  const core = v.coreStrength || 48;
  const data = [];
  let minimum = { x: 0, primary: Infinity };
  for (let i = 0; i < points; i += 1) {
    const r = 0.18 + 4.82 * i / (points - 1);
    const repulsive = core * Math.exp(-Math.pow(r / 0.42, 2));
    const attractive = attraction * Math.exp(-Math.pow(r / range, 2));
    const potential = repulsive - attractive;
    const point = { x: r, primary: potential, secondary: -attractive };
    if (potential < minimum.primary) minimum = point;
    data.push(point);
  }
  const binding = Math.max(0, -minimum.primary * (id === "omegaOmega" ? .11 : .055));
  return {
    kind: "binding",
    xLabel: "Расстояние r, fm",
    yLabel: "V(r), MeV",
    primaryLabel: "Эффективный потенциал",
    secondaryLabel: "Притягивающая часть",
    data,
    metrics: [["V min", minimum.primary, "MeV"], ["r min", minimum.x, "fm"], ["Оценка B", binding, "MeV"]],
    backendHint: "HAL QCD potential-table adapter"
  };
}

function solveEos(id, v, points) {
  const data = [];
  const bagRoot = v.bag || 155;
  const bag = Math.pow(bagRoot / 155, 4) * 58;
  const gap = v.pairingGap || 0;
  const strange = v.strangeMass || 100;
  const coupling = v.coupling || v.vectorCoupling || v.alphaS || 0;
  let cs2 = 1 / 3;
  for (let i = 0; i < points; i += 1) {
    const density = 0.35 + 9.65 * i / (points - 1);
    let phaseFraction = 0;
    let epsilon;
    let pressure;
    if (["neutronMatter", "hyperonMatter", "kaonCondensate"].includes(id)) {
      const gamma = v.gamma || 2.35;
      const hyperonSoftening = id === "hyperonMatter" ? 1 - .34 * (v.hyperonFraction || 0) : 1;
      const onset = v.onsetDensity || 3.6;
      const condensate = id === "kaonCondensate" ? (v.condensateFraction || 0) / (1 + Math.exp(-(density - onset) * 5)) : 0;
      pressure = 18 * Math.pow(density, gamma) * hyperonSoftening * (1 - .42 * condensate);
      epsilon = 150 * density + pressure / (gamma - 1);
      cs2 = Math.min(0.82, gamma * pressure / Math.max(epsilon + pressure, 1));
    } else if (id === "qgp") {
      const t = 100 + density * 54;
      const ideal = 0.0000108 * 47.5 * Math.pow(t, 4);
      pressure = ideal * (1 - 0.36 * coupling);
      epsilon = 3 * ideal * (1 + 0.06 * coupling);
      cs2 = pressure / epsilon;
    } else if (["quarkyonic", "qhc21"].includes(id)) {
      const center = v.crossoverDensity || 3.2;
      const width = Math.max(v.crossoverWidth || .6, .05);
      const w = .5 * (1 + Math.tanh((density - center) / width));
      phaseFraction = w;
      const hadronP = 20 * Math.pow(density, 2.25);
      const quarkP = 42 * Math.pow(density, 1.38) + (id === "qhc21" ? (v.vectorCoupling || 1) * density * density * 8 : 0);
      pressure = hadronP * (1 - w) + quarkP * w;
      epsilon = 155 * density + pressure * (1.05 + .75 * (1 - w));
      cs2 = Math.min(.78, Math.max(.12, pressure / Math.max(epsilon, 1) * (1.2 + .4 * w)));
    } else {
      const mu = 270 + density * 48;
      const base = 0.0000105 * 3 * Math.pow(mu, 4) / (4 * PI * PI);
      const massPenalty = 0.00014 * strange * strange * mu * mu / (PI * PI);
      const phasePairing = id === "loff" ? .62 : id === "gCFL" ? .52 : id === "cflKaon" ? .9 : 1;
      const mismatchPenalty = (v.mismatch || 0) * density * (id === "loff" || id === "gCFL" ? .28 : 0);
      const condensateBonus = id === "cflKaon" ? (v.condensateFraction || 0) * density * 18 : 0;
      const pairBonus = 0.00022 * gap * gap * mu * mu / (PI * PI) * phasePairing;
      const vectorBonus = id === "njl" ? coupling * density * density * 18 : 0;
      pressure = Math.max(0, base - bag - massPenalty + pairBonus + vectorBonus + condensateBonus - mismatchPenalty);
      epsilon = Math.max(1, 3 * base + bag + massPenalty + pairBonus + vectorBonus * 0.45 + mismatchPenalty * .35);
      cs2 = Math.min(0.72, Math.max(0.08, pressure / Math.max(epsilon, 1) + vectorBonus * 0.0008));
    }
    data.push({ x: epsilon, primary: pressure, secondary: density, phaseFraction });
  }
  data.forEach((point, index) => {
    const previous = data[Math.max(0, index - 1)];
    const next = data[Math.min(data.length - 1, index + 1)];
    point.cs2 = clampRatio((next.primary - previous.primary) / Math.max(next.x - previous.x, 1e-9));
  });
  const last = data[data.length - 1];
  const hasWorkingMu = Number.isFinite(v.muB);
  const workingDensity = hasWorkingMu ? Math.max(.35, Math.min(10, 1 + (v.muB - 939) / 250)) : 10;
  const workingIndex = Math.round((workingDensity - .35) / 9.65 * (data.length - 1));
  const working = data[workingIndex];
  const crossover = ["quarkyonic", "qhc21"].includes(id);
  return {
    kind: "eos",
    xLabel: "Энергоплотность ε, arb.",
    yLabel: "Давление P, arb.",
    primaryLabel: "P(ε)",
    secondaryLabel: "n/n₀",
    data,
    metrics: crossover
      ? [["P @ μB", working.primary, "arb."], ["cₛ²/c²", working.cs2, ""], ["Кварковая доля", working.phaseFraction, "%"]]
      : [["P max", last.primary, "arb."], ["cₛ²/c²", last.cs2, ""], ["Режим", id === "njl" ? 1 : 0, id === "njl" ? "MUSES-ready" : "local"]],
    state: { current: working, density: working.secondary, soundSpeed2: working.cs2, quarkFraction: working.phaseFraction },
    backendHint: id === "njl" ? "MUSES NJL adapter" : "CompOSE / MUSES adapter"
  };
}

function clampRatio(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function solveStrangelet(v, points) {
  const selectedA = v.baryonNumber || 72;
  const bagPenalty = ((v.bag || 155) - 145) * 0.55;
  const surface = v.surfaceEnergy || 28;
  const pairingBonus = .075 * (v.pairingGap || 0);
  const data = [];
  for (let i = 0; i < points; i += 1) {
    const a = 4 + i * 296 / (points - 1);
    const ePerA = 875 + bagPenalty + surface / Math.cbrt(a) + 52 / Math.pow(a, 2 / 3) - pairingBonus;
    data.push({ x: a, primary: ePerA, secondary: 930 - ePerA });
  }
  const selected = 875 + bagPenalty + surface / Math.cbrt(selectedA) + 52 / Math.pow(selectedA, 2 / 3) - pairingBonus;
  return {
    kind: "stability",
    xLabel: "Барионное число A",
    yLabel: "E/A, MeV",
    primaryLabel: "Liquid-drop estimate",
    secondaryLabel: "930 − E/A",
    data,
    metrics: [
      ["E/A", selected, "MeV"],
      ["Порог Fe/Ni", 930, "MeV"],
      ["Δ устойчивости", 930 - selected, "MeV"]
    ],
    backendHint: "finite-size SQM adapter"
  };
}

function solveConfinement(v, points) {
  const alpha = v.alphaS || 0.35;
  const sigma = v.stringTension || 0.9;
  const data = [];
  for (let i = 0; i < points; i += 1) {
    const r = 0.08 + 1.72 * i / (points - 1);
    const potential = -4 * alpha / (3 * r) + sigma * r;
    data.push({ x: r, primary: potential, secondary: sigma * r });
  }
  return {
    kind: "potential",
    xLabel: "Расстояние r, fm",
    yLabel: "V(r), GeV",
    primaryLabel: "Cornell potential",
    secondaryLabel: "Линейный член",
    data,
    metrics: [
      ["αₛ", alpha, ""],
      ["σ", sigma, "GeV/fm"],
      ["Цветовой заряд", 0, "net"]
    ],
    backendHint: "lattice-QCD table adapter"
  };
}

export function formatMetric(value, unit) {
  if (typeof value === "string") return value;
  if (unit === "%") return `${(value * 100).toFixed(1)}%`;
  if (Math.abs(value) >= 1000) return `${value.toExponential(2)} ${unit}`.trim();
  if (Math.abs(value) >= 100) return `${value.toFixed(0)} ${unit}`.trim();
  if (Math.abs(value) >= 10) return `${value.toFixed(1)} ${unit}`.trim();
  return `${value.toFixed(3)} ${unit}`.trim();
}
