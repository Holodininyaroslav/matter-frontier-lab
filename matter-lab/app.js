import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { USDZLoader } from "three/addons/loaders/USDZLoader.js";
import { modelRegistry, families, setCatalogLocale } from "./models.js?v=20260905-public2";
import { createMOrchestrator } from "./m-orchestrator-view.js?v=20260905-public2";
import { repairFrame } from "./gamma-repair-timeline.mjs?v=20260905-public2";
import { createAssembly, startAssembly, advanceAssembly, assemblyFrame } from "./smart-assembly.mjs?v=20260905-sequential1";
import { solveModel, formatMetric } from "./solver.js?v=20260722e";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

async function copyTextToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {
    // Browser permissions can block the asynchronous Clipboard API even on a
    // local page. Fall through to the selection-based compatibility path.
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rand = (min, max) => min + Math.random() * (max - min);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const clock = new THREE.Clock();
const gltfLoader = new GLTFLoader();
const usdzLoader = new USDZLoader();

const state = {
  selected: modelRegistry[0],
  family: "all",
  search: "",
  values: {},
  view: "structure",
  paused: false,
  interaction: null,
  interactionTime: 0,
  interactionPhase: null,
  collisionContext: null,
  solverResult: null,
  solverMs: 0,
  backendOnline: false,
  backendStatusPayload: null,
  multiQuarkResult: null,
  visual: null,
  selectedComponent: null,
  confinementChoice: 0,
  confinementPulled: false,
  communicationOpen: false,
  communicationValues: { neutrinoRate: 80, photonRate: 55, energy: 10, rockThickness: 190, reflectivity: 96 },
  blackHoleMergerRunning: false,
  resonantTripleRunning: false,
  resonantTripleStabilizerAdded: false,
  resonantTwinStabilizerAdded: false,
  resonantTripleActivationTime: null,
  resonantTripleActivationProgress: 0,
  resonantTripleActivationAngle: 0,
  resonantTripleManualControl: false,
  resonantTripleManualAngle: 0,
  resonantTripleManualRadius: 1,
  chemistry: null,
  smartMatter: null,
  smartProteinRepair: null,
  biomolecule: null
};
setCatalogLocale(localStorage.getItem("qcd-neutrino-language") || "en");
window.qcdLabState = state;

const canvas = $("#scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x061016);
scene.fog = new THREE.FogExp2(0x061016, 0.017);

const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 180);
camera.position.set(10.5, 6.2, 12.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.minDistance = 6;
controls.maxDistance = 34;
controls.target.set(0, 0.3, 0);

scene.add(new THREE.HemisphereLight(0x8bd7e0, 0x071016, 1.35));
const key = new THREE.DirectionalLight(0xeafaff, 3.4);
key.position.set(6, 12, 8);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
scene.add(key);
const cyanLight = new THREE.PointLight(0x31d7ea, 28, 28, 2);
cyanLight.position.set(-7, 2, 4);
scene.add(cyanLight);
const warmLight = new THREE.PointLight(0xf1a94d, 16, 22, 2);
warmLight.position.set(6, -2, -4);
scene.add(warmLight);

const stage = new THREE.Group();
const specimen = new THREE.Group();
const effects = new THREE.Group();
const fieldLayer = new THREE.Group();
stage.add(specimen, effects, fieldLayer);
scene.add(stage);

const platform = new THREE.Mesh(
  new THREE.CylinderGeometry(6.7, 7.2, 0.28, 96),
  new THREE.MeshStandardMaterial({ color: 0x0a1b23, metalness: 0.55, roughness: 0.48 })
);
platform.position.y = -4.05;
platform.receiveShadow = true;
scene.add(platform);

const platformRing = new THREE.Mesh(
  new THREE.TorusGeometry(6.45, 0.035, 8, 120),
  new THREE.MeshBasicMaterial({ color: 0x3dd4e7, transparent: true, opacity: 0.6 })
);
platformRing.rotation.x = Math.PI / 2;
platformRing.position.y = -3.88;
scene.add(platformRing);

const chamberRings = new THREE.Group();
for (const [radius, opacity] of [[8.8, 0.09], [11.5, 0.055]]) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.016, 5, 160),
    new THREE.MeshBasicMaterial({ color: 0x75dce7, transparent: true, opacity })
  );
  ring.rotation.x = Math.PI / 2;
  chamberRings.add(ring);
}
chamberRings.position.y = -3.82;
scene.add(chamberRings);

const mats = {
  red: new THREE.MeshStandardMaterial({ color: 0xff655e, emissive: 0x4b0908, emissiveIntensity: 0.42, roughness: 0.28, metalness: 0.18 }),
  green: new THREE.MeshStandardMaterial({ color: 0x63df9b, emissive: 0x092f1c, emissiveIntensity: 0.5, roughness: 0.28, metalness: 0.18 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x6da2ff, emissive: 0x0a194f, emissiveIntensity: 0.5, roughness: 0.28, metalness: 0.18 }),
  strange: new THREE.MeshStandardMaterial({ color: 0xee72d5, emissive: 0x4a093d, emissiveIntensity: 0.55, roughness: 0.24, metalness: 0.2 }),
  charm: new THREE.MeshStandardMaterial({ color: 0xf29b52, emissive: 0x4f2108, emissiveIntensity: 0.52, roughness: 0.25, metalness: 0.22 }),
  bottom: new THREE.MeshStandardMaterial({ color: 0xb28cff, emissive: 0x25105c, emissiveIntensity: 0.52, roughness: 0.25, metalness: 0.22 }),
  proton: new THREE.MeshStandardMaterial({ color: 0xf2bf5b, emissive: 0x4a2f06, emissiveIntensity: 0.34, roughness: 0.34, metalness: 0.12 }),
  neutron: new THREE.MeshStandardMaterial({ color: 0x7c9aa3, emissive: 0x102b32, emissiveIntensity: 0.28, roughness: 0.42, metalness: 0.12 }),
  electron: new THREE.MeshBasicMaterial({ color: 0x62dcff }),
  shell: new THREE.MeshPhysicalMaterial({ color: 0x4da8b8, transparent: true, opacity: 0.11, roughness: 0.16, metalness: 0.1, transmission: 0.18, side: THREE.DoubleSide, depthWrite: false }),
  flux: new THREE.MeshBasicMaterial({ color: 0x60e0e7, transparent: true, opacity: 0.58 }),
  photon: new THREE.MeshBasicMaterial({ color: 0xf7c652 }),
  neutrino: new THREE.MeshBasicMaterial({ color: 0x54d8ff }),
  helicity: new THREE.MeshBasicMaterial({ color: 0xee72d5 }),
  boson: new THREE.MeshBasicMaterial({ color: 0xf7f4d0 }),
  lens: new THREE.MeshPhysicalMaterial({ color: 0x1fc6db, emissive: 0x063d48, emissiveIntensity: 0.55, transparent: true, opacity: 0.32, roughness: 0.12, metalness: 0.35, transmission: 0.3, side: THREE.DoubleSide }),
  detector: new THREE.MeshStandardMaterial({ color: 0x263d48, emissive: 0x08252d, emissiveIntensity: .35, transparent: true, opacity: .28, metalness: .65, roughness: .32, side: THREE.DoubleSide, depthWrite: false }),
  line: new THREE.LineBasicMaterial({ color: 0x54d8ff, transparent: true, opacity: 0.7 })
};

let animated = [];
let currentShell = null;
let primaryParticles = [];
let fieldObjects = [];
let mesonVisual = null;
let colliderVisual = null;
const mOrchestrator = createMOrchestrator({
  THREE, specimen, canvas, camera, controls,
  createBlackHole: createRelativisticBlackHole,
  createGrid: createSpacetimeGrid,
  isPaused: () => state.paused,
  unpause: () => { if (state.paused) $("#pauseBtn").click(); },
  status: setStatus,
  refresh: () => { renderInspector(); rebuildSpecimen(); runLocalSolver(); },
  onResult: (result) => {
    state.solverResult = result;
    $("#chartSubtitle").textContent = result.primaryLabel;
    $("#telemetrySolver").textContent = "M-field · local integrator";
    renderMetrics(); drawChart();
  }
});
const BARYON_PARTNERS = { proton: "antiproton", antiproton: "proton", neutron: "antineutron", antineutron: "neutron", hyperon: "antihyperon", antihyperon: "hyperon" };
const BARYON_BEAMS = {
  proton: ["p · proton", ["u", "u", "d"]], antiproton: ["p̄ · antiproton", ["uBar", "uBar", "dBar"]],
  neutron: ["n · neutron", ["u", "d", "d"]], antineutron: ["n̄ · antineutron", ["uBar", "dBar", "dBar"]],
  hyperon: ["Λ · lambda hyperon", ["u", "d", "s"]], antihyperon: ["Λ̄ · anti-lambda", ["uBar", "dBar", "sBar"]]
};
const isBaryonModel = (model) => model?.visual === "baryon" && Boolean(BARYON_PARTNERS[model.id]);
const HYPERSPHERE_RADIUS = 1.2;
const HYPER_PROJECTIONS = {
  xyz: { axes: ["x", "y", "z"], hidden: "i" },
  xyi: { axes: ["x", "y", "i"], hidden: "z" },
  xzi: { axes: ["x", "z", "i"], hidden: "y" },
  yzi: { axes: ["y", "z", "i"], hidden: "x" }
};
const TESSERACT_VERTICES = Array.from({ length: 16 }, (_, index) => [
  index & 1 ? 1 : -1,
  index & 2 ? 1 : -1,
  index & 4 ? 1 : -1,
  index & 8 ? 1 : -1
]);
const TESSERACT_EDGES = TESSERACT_VERTICES.flatMap((_, vertex) => [0, 1, 2, 3]
  .filter((axis) => vertex < (vertex ^ (1 << axis)))
  .map((axis) => [vertex, vertex ^ (1 << axis)]));
const TESSERACT_FACES = [];
for (let first = 0; first < 4; first += 1) {
  for (let second = first + 1; second < 4; second += 1) {
    const fixedAxes = [0, 1, 2, 3].filter((axis) => axis !== first && axis !== second);
    for (let fixed = 0; fixed < 4; fixed += 1) {
      let base = 0;
      if (fixed & 1) base |= 1 << fixedAxes[0];
      if (fixed & 2) base |= 1 << fixedAxes[1];
      TESSERACT_FACES.push([base, base ^ (1 << first), base ^ (1 << first) ^ (1 << second), base ^ (1 << second)]);
    }
  }
}

function rotateFourPlane(point, first, second, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotated = [...point];
  rotated[first] = point[first] * cos - point[second] * sin;
  rotated[second] = point[first] * sin + point[second] * cos;
  return rotated;
}

function transformTesseractVertex(vertex) {
  const translated = [
    vertex[0] + (state.values.positionX ?? 0),
    vertex[1] + (state.values.positionY ?? 0),
    vertex[2] + (state.values.positionZ ?? 0),
    vertex[3] + (state.values.positionI ?? 0)
  ];
  let rotated = rotateFourPlane(translated, 0, 3, state.values.rotationXi ?? 0);
  rotated = rotateFourPlane(rotated, 1, 3, state.values.rotationYi ?? 0);
  return rotateFourPlane(rotated, 2, 3, state.values.rotationZi ?? 0);
}

function projectTesseractVertex(vertex) {
  const rotated = transformTesseractVertex(vertex);
  const projection = HYPER_PROJECTIONS[state.values.projection] || HYPER_PROJECTIONS.xyi;
  const coordinate = { x: rotated[0], y: rotated[1], z: rotated[2], i: rotated[3] };
  const perspective = 3.9 / Math.max(.5, 5.2 - coordinate[projection.hidden]);
  return projection.axes.map((axis) => coordinate[axis] * perspective * 1.4);
}

function tesseractSliceSegments() {
  const projection = HYPER_PROJECTIONS[state.values.projection] || HYPER_PROJECTIONS.xyi;
  const axisIndex = { x: 0, y: 1, z: 2, i: 3 };
  const hiddenIndex = axisIndex[projection.hidden];
  const transformed = TESSERACT_VERTICES.map(transformTesseractVertex);
  const segments = [];
  const addUniquePoint = (points, point) => {
    if (!points.some((other) => other.every((value, index) => Math.abs(value - point[index]) < 1e-5))) points.push(point);
  };
  for (const face of TESSERACT_FACES) {
    const points = [];
    for (let edge = 0; edge < 4; edge += 1) {
      const start = transformed[face[edge]];
      const end = transformed[face[(edge + 1) % 4]];
      const startHidden = start[hiddenIndex];
      const endHidden = end[hiddenIndex];
      if (Math.abs(startHidden) < 1e-7) addUniquePoint(points, start);
      if (startHidden * endHidden < -1e-10) {
        const ratio = startHidden / (startHidden - endHidden);
        addUniquePoint(points, start.map((value, index) => value + (end[index] - value) * ratio));
      }
    }
    if (points.length >= 2) {
      const project = (point) => projection.axes.map((axis) => point[axisIndex[axis]] * 1.4);
      segments.push([project(points[0]), project(points[1])]);
    }
  }
  const hiddenValues = transformed.map((point) => point[hiddenIndex]);
  return { segments, projection, min: Math.min(...hiddenValues), max: Math.max(...hiddenValues) };
}
function complexSpinProjection() {
  const projection = HYPER_PROJECTIONS[state.values.projection] || HYPER_PROJECTIONS.xyi;
  const coordinates = {
    x: state.values.positionX ?? 0,
    y: state.values.positionY ?? 0,
    z: state.values.positionZ ?? 0,
    i: state.values.positionI ?? 0
  };
  const hiddenPosition = coordinates[projection.hidden];
  const sliceRadius = Math.sqrt(Math.max(0, HYPERSPHERE_RADIUS ** 2 - hiddenPosition ** 2)) / HYPERSPHERE_RADIUS;
  return { ...projection, coordinates, hiddenPosition, sliceRadius };
}

function mFieldProjection() {
  const preset = state.values.mMode || "phase";
  const resonance = { scalar: 0, vector: (2 * Math.PI) / 3, tensor: (4 * Math.PI) / 3 };
  const rawPhase = Number(state.values.iPhase ?? .52);
  const phase = preset === "scalar" ? resonance.scalar : preset === "vector" ? resonance.vector : preset === "tensor" ? resonance.tensor : rawPhase;
  const circularDistance = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const width = .72;
  const amplitude = (center) => Math.exp(-(circularDistance(phase, center) ** 2) / (2 * width ** 2));
  let scalar = amplitude(resonance.scalar);
  let vector = amplitude(resonance.vector);
  let tensor = amplitude(resonance.tensor);
  if (preset === "mixed") scalar = vector = tensor = 1;
  const total = scalar + vector + tensor || 1;
  const coupling = Number(state.values.iCoupling ?? .72);
  const leakage = Number(state.values.leakage ?? .18);
  const coherence = Number(state.values.projectionCoherence ?? .84);
  return { phase, coupling, leakage, coherence, scalar: scalar / total, vector: vector / total, tensor: tensor / total };
}
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerStart = null;

const componentCatalog = {
  upQuark: {
    type: "КВАРК · ФЕРМИОН",
    title: "u-кварк",
    description: "Лёгкий кварк первого поколения. Вместе с d-кварками образует протоны и нейтроны и несёт цветовой заряд сильного взаимодействия.",
    facts: [["Заряд", "+2/3 e"], ["Спин", "1/2"], ["Текущая масса", "≈ 2.2 MeV/c²"]],
    caveat: "Цвет сферы обозначает компонент цветового базиса и не является реальным видимым цветом."
  },
  downQuark: {
    type: "КВАРК · ФЕРМИОН",
    title: "d-кварк",
    description: "Лёгкий кварк первого поколения с отрицательным дробным зарядом. Комбинация uud образует протон, udd — нейтрон.",
    facts: [["Заряд", "−1/3 e"], ["Спин", "1/2"], ["Текущая масса", "≈ 4.7 MeV/c²"]],
    caveat: "Внутри адрона наблюдается не отдельная траектория кварка, а квантовое распределение поля."
  },
  strangeQuark: {
    type: "КВАРК · ФЕРМИОН",
    title: "s-кварк",
    description: "Более тяжёлый кварк второго поколения. Он определяет странность гиперонов и гипотетической strange quark matter.",
    facts: [["Заряд", "−1/3 e"], ["Спин", "1/2"], ["Масса MS̄ (2 GeV)", "≈ 93 MeV/c²"]],
    caveat: "Параметр массы в модели эффективный; он зависит от схемы перенормировки и среды."
  },
  antiUpQuark: {
    type: "АНТИКВАРК · ФЕРМИОН",
    title: "ū-антикварк",
    description: "Античастица u-кварка с противоположными электрическим и цветовым зарядами. В цветонейтральном мезоне его антицвет компенсирует цвет кварка.",
    facts: [["Заряд", "−2/3 e"], ["Спин", "1/2"], ["Барионное число", "−1/3"]],
    caveat: "Антицвет на экране обозначен контуром; это не оптический цвет."
  },
  antiDownQuark: {
    type: "АНТИКВАРК · ФЕРМИОН",
    title: "d̄-антикварк",
    description: "Античастица d-кварка. Пара u-d̄ образует валентную структуру π⁺, а созданные вакуумом q-q̄ пары разрывают растянутую цветовую струну.",
    facts: [["Заряд", "+1/3 e"], ["Спин", "1/2"], ["Барионное число", "−1/3"]],
    caveat: "Разрыв струны не освобождает кварки: дочерние системы остаются цветонейтральными."
  },
  antiStrangeQuark: {
    type: "АНТИКВАРК · ФЕРМИОН",
    title: "s̄-антикварк",
    description: "Странный антикварк второго поколения. Из-за большей эффективной массы рождение s-s̄ пар из струны подавлено относительно лёгких пар.",
    facts: [["Заряд", "+1/3 e"], ["Спин", "1/2"], ["Странность", "+1"]],
    caveat: "Подавление зависит от настроек hadronization и поперечной массы."
  },
  charmQuark: {
    type: "КВАРК · ФЕРМИОН",
    title: "c-кварк",
    description: "Тяжёлый кварк второго поколения. Связанная c-c̄ система образует чармоний, включая J/ψ.",
    facts: [["Заряд", "+2/3 e"], ["Спин", "1/2"], ["Масса MS̄", "≈1.27 GeV/c²"]],
    caveat: "В сцене тяжёлый кварк показан крупнее только для различимости, не в физическом масштабе."
  },
  antiCharmQuark: {
    type: "АНТИКВАРК · ФЕРМИОН",
    title: "c̄-антикварк",
    description: "Античастица charm-кварка. В J/ψ образует цветонейтральное тяжёлое кварк-антикварковое состояние.",
    facts: [["Заряд", "−2/3 e"], ["Спин", "1/2"], ["Charm", "−1"]],
    caveat: "Рождение c-c̄ из мягкой струны сильно подавлено; обычно при разрыве создаётся лёгкая пара."
  },
  bottomQuark: {
    type: "КВАРК · ФЕРМИОН",
    title: "b-кварк",
    description: "Тяжёлый кварк третьего поколения. Пара b-b̄ образует боттомоний Υ.",
    facts: [["Заряд", "−1/3 e"], ["Спин", "1/2"], ["Масса MS̄", "≈4.18 GeV/c²"]],
    caveat: "На масштабе hadronization создание новой b-b̄ пары экспоненциально подавлено."
  },
  antiBottomQuark: {
    type: "АНТИКВАРК · ФЕРМИОН",
    title: "b̄-антикварк",
    description: "Античастица bottom-кварка и второй валентный компонент боттомония Υ(1S).",
    facts: [["Заряд", "+1/3 e"], ["Спин", "1/2"], ["Bottomness", "+1"]],
    caveat: "Геометрия не отображает релятивистскую волновую функцию тяжёлого кваркония."
  },
  mesonFluxString: {
    type: "ЦВЕТОВАЯ ТРУБКА",
    title: "Конфайнирующая QCD-струна",
    description: "Область концентрированного цветового поля между кварком и антикварком. При росте расстояния её энергия приблизительно растёт как κr.",
    facts: [["Натяжение", "κ≈0.9 GeV/fm"], ["Модель", "Lund string"], ["Финал", "q-q̄ pair creation"]],
    caveat: "Струна является эффективным описанием непертурбативного поля; её форма в анимации условна."
  },
  muon: {
    type: "ЛЕПТОН · ФЕРМИОН",
    title: "Мюон",
    description: "Тяжёлый заряженный лептон. В магнитном поле его трек искривляется с радиусом, пропорциональным поперечному импульсу.",
    facts: [["Заряд", "±1 e"], ["Спин", "1/2"], ["Масса", "105.658 MeV/c²"]],
    caveat: "Линия показывает идеализированную траекторию без потерь энергии и рассеяния в материале."
  },
  chargedHadron: {
    type: "РЕКОНСТРУИРОВАННЫЙ ТРЕК",
    title: "Заряженный адрон",
    description: "Видимый заряженный продукт hadronization. В реальном детекторе тип частицы определяется совместно по треку, калориметрам и времени пролёта.",
    facts: [["Заряд", "±1 e"], ["Источник", "hadronization"], ["Трек", "магнитная кривизна"]],
    caveat: "Быстрый browser generator не выполняет полную идентификацию π/K/p."
  },
  neutralHadron: {
    type: "НЕЙТРАЛЬНЫЙ АДРОН",
    title: "Нейтральный адрон",
    description: "Нейтральный продукт струйной фрагментации, оставляющий энергию в калориметре без заряженного трека во внутреннем трекере.",
    facts: [["Заряд", "0"], ["Сигнал", "калориметр"], ["Траектория", "прямая"]],
    caveat: "Визуализация объединяет несколько возможных видов нейтральных адронов."
  },
  colliderDetector: {
    type: "ДЕТЕКТОРНАЯ ГЕОМЕТРИЯ",
    title: "Слои коллайдерного детектора",
    description: "Схематические цилиндрические слои: трекер, электромагнитный и адронный калориметры, внешняя мюонная система.",
    facts: [["Ось пучка", "x"], ["Поле", "соленоид"], ["Формат событий", "HepMC-ready"]],
    caveat: "Размеры и отклик не являются точной геометрией CMS или ATLAS."
  },
  proton: {
    type: "НУКЛОН · БАРИОН",
    title: "Протон",
    description: "Составной адрон uud. Почти вся его масса возникает из энергии глюонного поля и движения кварков, а не из суммы текущих масс кварков.",
    facts: [["Заряд", "+1 e"], ["Спин", "1/2"], ["Масса", "938.272 MeV/c²"]],
    caveat: "В плотной среде сфера показывает эффективную степень свободы, а не твёрдый шар."
  },
  antiproton: {
    type: "АНТИБАРИОН",
    title: "Антипротон",
    description: "Античастица протона с валентным составом ūūd̄. При встрече с протоном возможна аннигиляция в глюонные и кварковые конечные состояния.",
    facts: [["PDG ID", "−2212"], ["Заряд", "−1 e"], ["Масса", "938.272 MeV/c²"]],
    caveat: "Внутренняя цветовая структура показана условно; вероятности каналов должен давать генератор событий."
  },
  pion: {
    type: "МЕЗОН · ПСЕВДОСКАЛЯР",
    title: "Заряженный пион",
    description: "Лёгкий мезон π± с валентным кварк-антикварковым составом. Пионные пучки применяются в экспериментах с фиксированной мишенью.",
    facts: [["PDG ID", "±211"], ["Заряд", "±1 e"], ["Масса", "139.57 MeV/c²"]],
    caveat: "Сфера с двумя компонентами является схемой валентного состава, а не измеренной геометрией пиона."
  },
  positron: {
    type: "АНТИЛЕПТОН · ФЕРМИОН",
    title: "Позитрон",
    description: "Античастица электрона. В e⁺e⁻-коллайдере пара аннигилирует через виртуальный фотон или Z-бозон.",
    facts: [["PDG ID", "−11"], ["Заряд", "+1 e"], ["Масса", "0.511 MeV/c²"]],
    caveat: "Размер маркера не является физическим размером фундаментальной частицы."
  },
  neutron: {
    type: "НУКЛОН · БАРИОН",
    title: "Нейтрон",
    description: "Электрически нейтральный составной адрон udd. В ядре он связан сильным взаимодействием, свободный нейтрон β-распадается.",
    facts: [["Заряд", "0"], ["Спин", "1/2"], ["Масса", "939.565 MeV/c²"]],
    caveat: "Нейтральность не означает отсутствие внутреннего распределения заряда и магнитного момента."
  },
  electron: {
    type: "ЛЕПТОН · ФЕРМИОН",
    title: "Электрон",
    description: "Фундаментальный заряженный лептон. В атоме показано распределение вероятности состояния; нарисованная орбита служит визуальным сечением волновой функции.",
    facts: [["Заряд", "−1 e"], ["Спин", "1/2"], ["Масса", "0.511 MeV/c²"]],
    caveat: "Электрон не движется по классической планетарной орбите. После ионизации возврат возможен только при рекомбинации; демонстрация моделирует захват электрона замкнутой системой."
  },
  gluonField: {
    type: "КАЛИБРОВОЧНОЕ ПОЛЕ",
    title: "Глюонное поле",
    description: "Поле SU(3), передающее сильное взаимодействие. Глюоны сами несут цветовой заряд, поэтому поле нелинейно и формирует конфайнмент.",
    facts: [["Переносчик", "глюон"], ["Спин", "1"], ["Состояний цвета", "8"]],
    caveat: "Линия — схема потока поля, не классическая струна между точечными кварками."
  },
  cooperPair: {
    type: "КОРРЕЛИРОВАННОЕ СОСТОЯНИЕ",
    title: "Кварковая пара",
    description: "Коррелированная пара кварков в цвет-сверхпроводящей фазе. Энергетическая щель подавляет низкоэнергетические возбуждения.",
    facts: [["Параметр", "Δ"], ["Режим", "BCS-подобный"], ["Симметрия", "зависит от фазы"]],
    caveat: "Связь показывает корреляцию порядка, а не механический стержень."
  },
  condensate: {
    type: "КОЛЛЕКТИВНОЕ ПОЛЕ",
    title: "Конденсат",
    description: "Макроскопическая амплитуда коллективного квантового состояния. Фаза и модуль параметра порядка влияют на спектр возбуждений среды.",
    facts: [["Параметр порядка", "|Φ|eⁱφ"], ["Описание", "эффективное поле"], ["Масштаб", "многочастичный"]],
    caveat: "Кольца визуализируют фазовую когерентность, а не траектории частиц."
  },
  photon: {
    type: "КАЛИБРОВОЧНЫЙ БОЗОН",
    title: "Фотон",
    description: "Квант электромагнитного поля. При фотоионизации он передаёт энергию связанному электрону; при радиационной рекомбинации новый фотон уносит энергию связи и кинетическую энергию захваченного электрона.",
    facts: [["Заряд", "0"], ["Спин", "1"], ["Масса покоя", "0"]],
    caveat: "После ионизации испускается новый фотон: это не тот же самый поглощённый квант."
  },
  tesseract: {
    type: "4D ГЕОМЕТРИЯ · ПРАВИЛЬНЫЙ МНОГОГРАННИК",
    title: "Тессеракт",
    description: "Четырёхмерный гиперкуб. Каркас показывает точные вершины и рёбра после перспективного проектирования из 4D в выбранное трёхмерное подпространство.",
    facts: [["Вершины", "16"], ["Рёбра", "32"], ["Кубические ячейки", "8"]],
    caveat: "Это не физический объект и не «тень» в буквальном смысле: видимая форма зависит от выбранной 3D-проекции и поворотов в плоскостях с осью i."
  },
  neutrino: {
    type: "ЛЕПТОН · НЕЙТРИНО",
    title: "Нейтрино",
    description: "Электрически нейтральный лептон, взаимодействующий через слабое взаимодействие и гравитацию. В линзе отслеживается состояние спина/гелисити.",
    facts: [["Заряд", "0"], ["Спин", "1/2"], ["Масса", "ненулевая, очень малая"]],
    caveat: "Поляризационная нейтринная линза в этом сервисе является явно гипотетическим расширением."
  },
  lensMedium: {
    type: "ГИПОТЕТИЧЕСКАЯ СРЕДА",
    title: "Нейтринная линза",
    description: "Эффективная анизотропная среда, заданная гамильтонианом эволюции спинового состояния нейтрино.",
    facts: [["Уравнение", "i dψ/dx = Hψ"], ["Наблюдаемая", "P(flip)"], ["Статус", "hypothetical"]],
    caveat: "Материал с такими управляемыми свойствами не обнаружен; сцена демонстрирует математическую гипотезу."
  }
};

function disposeGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    child.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
      if (node.material && !Object.values(mats).includes(node.material)) {
        if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose());
        else node.material.dispose();
      }
    });
  }
}

function makeSphere(radius, material, position = [0, 0, 0], segments = 28) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, Math.max(16, segments / 2)), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  return mesh;
}

function tagComponent(object, componentId, context = {}) {
  object.userData.componentId = componentId;
  object.userData.componentContext = context;
  return object;
}

function parameterNorm(key, fallback = 0.5) {
  const parameter = state.selected.parameters.find((item) => item.key === key);
  if (!parameter || !Number.isFinite(state.values[key])) return fallback;
  return clamp((state.values[key] - parameter.min) / Math.max(parameter.max - parameter.min, 1e-9), 0, 1);
}

function firstParameterNorm(keys, fallback = 0.5) {
  const key = keys.find((candidate) => state.selected.parameters.some((item) => item.key === candidate));
  return key ? parameterNorm(key, fallback) : fallback;
}

function deriveVisualState() {
  const temperature = firstParameterNorm(["temperature"], 0.34);
  const density = firstParameterNorm(["density", "muB", "baryonNumber"], 0.48);
  const vectorRepulsion = firstParameterNorm(["vectorCoupling", "coreStrength"], 0.35);
  const coupling = firstParameterNorm(["alphaS", "stringTension", "coupling", "vectorCoupling", "scalarCoupling", "attraction", "spinCoupling", "range"], 0.48);
  const mismatch = firstParameterNorm(["mismatch"], 0);
  const coherence = Math.max(firstParameterNorm(["pairingGap"], 0), firstParameterNorm(["condensateFraction"], 0)) * (1 - mismatch * .65);
  const strangeMass = firstParameterNorm(["strangeMass"], 0.5);
  const wave = firstParameterNorm(["waveVector"], 0.5);
  const bagPressure = firstParameterNorm(["bag", "surfaceEnergy"], 0.45);
  const anisotropy = firstParameterNorm(["anisotropy"], 0.5);
  const lensStretch = state.selected.visual === "neutrinoLens" ? 0.72 + firstParameterNorm(["lensLength"], 0.5) * 0.62 : 1;
  let quarkFraction = Number.isFinite(state.values.quarkFraction) ? state.values.quarkFraction : 0.5;
  if (state.selected.visual === "hybridMatter" && !Number.isFinite(state.values.quarkFraction)) {
    const densityRatio = clamp(1 + ((state.values.muB || 939) - 939) / 250, 0.35, 10);
    const center = state.values.crossoverDensity || 3.2;
    const width = Math.max(state.values.crossoverWidth || 0.6, 0.05);
    quarkFraction = 0.5 * (1 + Math.tanh((densityRatio - center) / width));
  }
  return {
    temperature,
    density,
    coupling,
    coherence,
    strangeMass,
    wave,
    anisotropy,
    lensStretch,
    quarkFraction: clamp(quarkFraction, 0, 1),
    motionSpeed: 0.52 + temperature * 1.65,
    motionAmplitude: 0.45 + temperature * 1.45,
    specimenScale: ["meson", "collider"].includes(state.selected.visual) ? 1 : clamp(1.1 - density * 0.22 + vectorRepulsion * 0.1 - bagPressure * .08, 0.8, 1.16)
  };
}

function applyParameterDrivenVisuals() {
  state.visual = deriveVisualState();
  const visual = state.visual;
  primaryParticles.forEach((object) => {
    if (object.userData.hybridIndex != null) {
      const isQuark = object.userData.hybridIndex < visual.quarkFraction;
      object.material = isQuark ? object.userData.quarkMaterial : object.userData.hadronMaterial;
      object.scale.setScalar(isQuark ? 0.52 : 1);
      object.userData.componentId = isQuark ? object.userData.quarkComponent : object.userData.hadronComponent;
    } else if (object.userData.componentId === "strangeQuark") {
      object.scale.setScalar(0.88 + visual.strangeMass * 0.34);
    }
  });
  fieldObjects.forEach((object) => {
    const role = object.userData.fieldRole;
    if (!object.material) return;
    if (role === "pair") object.material.opacity = 0.12 + visual.coherence * 0.62;
    if (role === "flux") object.material.opacity = 0.12 + visual.coupling * 0.58;
    if (role === "condensate") object.material.opacity = 0.16 + visual.coherence * 0.62;
  });
  if (colliderVisual) {
    // The detector is an optional context layer: keep it invisible until the user asks for it.
    const alpha = clamp(Number(state.values.detectorOpacity ?? 0), 0, 1);
    colliderVisual.detector.traverse((object) => {
      if (!object.material) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        material.transparent = true;
        material.opacity = (material.userData.baseOpacity ?? (material.userData.baseOpacity = material.opacity)) * alpha;
      });
    });
  }
  if (state.selected.visual === "complexSpin") {
    const projection = complexSpinProjection();
    if (state.values.configuration === "lattice") {
      const mode = ({ scalar: "scalar M-quant", vector: "vector M-quant", standing: "distributed standing M-wave" })[state.values.mMode] || "M-field";
      $("#sceneScale").textContent = `bounded 3D M-field · 100 × 100 × 100 samples · sparse display · ${mode} · no 4D probe trajectory`;
    } else {
    const configuration = state.values.configuration === "lattice" ? "100 × 100 × 100 M-field samples · sparse visual lattice" : "single quasiparticle";
    $("#sceneScale").textContent = `${configuration} · visible ${projection.axes.join("·")} · hidden ${projection.hidden} = ${projection.hiddenPosition.toFixed(2)} · slice diameter ${(projection.sliceRadius * 100).toFixed(0)}%`;
    }
  } else if (state.selected.visual === "polytope4d") {
    const mode = state.values.tesseractMode === "projection" ? "4D perspective projection" : "3D slice";
    const slice = tesseractSliceSegments();
    const intersection = slice.segments.length ? `${slice.segments.length} boundary segments` : "no intersection — outside visible space";
    $("#sceneScale").textContent = `${mode} · hidden ${slice.projection.hidden} ∈ [${slice.min.toFixed(2)}, ${slice.max.toFixed(2)}] · ${intersection}`;
  } else if (state.selected.visual === "smartMatter") {
    const smart = ensureSmartMatterState();
    $("#sceneScale").textContent = smart?.plan
      ? `${smart.plan.formula} · RDKit ${smart.plan.rdkit} · visible only at i ≥ 0 · ${smart.stage}`
      : "programmable matter hypothesis · particles hidden at i < 0";
  } else if (state.selected.visual === "hybridMatter") {
    $("#sceneScale").textContent = `quark fraction ${(visual.quarkFraction * 100).toFixed(0)}% · packing ${visual.specimenScale.toFixed(2)}×`;
  } else if (state.selected.visual === "meson") {
    $("#sceneScale").textContent = `r ${(state.values.separation || 0).toFixed(2)} fm · κ ${(state.values.stringTension || 0).toFixed(2)} GeV/fm`;
  } else if (state.selected.visual === "collider") {
    $("#sceneScale").textContent = state.selected.id === "colliderWorkbench" ? `${beamLabel(state.values.beamA)} ↔ ${beamLabel(state.values.beamB)} · ${state.solverResult?.state?.processLabel || "select beams"}` : `√s ${(state.values.beamEnergy || 0).toFixed(1)} TeV · fast event display`;
  } else {
    $("#sceneScale").textContent = `motion ${visual.motionSpeed.toFixed(2)}× · coupling ${visual.coupling.toFixed(2)}`;
  }
}

function labelSprite(text, color = "#e9f4f4", scale = 0.72) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = "rgba(5, 14, 19, .76)";
  ctx.beginPath();
  ctx.arc(64, 64, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = "600 42px Segoe UI";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 64);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

function tubeBetween(a, b, material = mats.flux, radius = 0.055) {
  const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.22, 0));
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, radius, 8, false), material);
  tube.userData.fieldRole = "flux";
  return tagComponent(tube, "gluonField");
}

function orientCylinderBetween(mesh, a, b) {
  const direction = new THREE.Vector3().subVectors(b, a);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.scale.set(1, Math.max(direction.length(), .001), 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
}

function flavorVisual(flavor) {
  const anti = flavor.endsWith("bar");
  const base = anti ? flavor.slice(0, -3) : flavor;
  const component = ({ u: "upQuark", d: "downQuark", s: "strangeQuark", c: "charmQuark", b: "bottomQuark", g: "gluonField" })[base] || "upQuark";
  const antiComponent = ({ u: "antiUpQuark", d: "antiDownQuark", s: "antiStrangeQuark", c: "antiCharmQuark", b: "antiBottomQuark" })[base] || component;
  const material = ({ u: mats.red, d: mats.green, s: mats.strange, c: mats.charm, b: mats.bottom, g: mats.flux })[base] || mats.red;
  const color = ({ u: "#ff655e", d: "#63df9b", s: "#ee72d5", c: "#f29b52", b: "#b28cff", g: "#60e0e7" })[base] || "#ff655e";
  const radius = base === "b" ? .78 : base === "c" ? .72 : base === "s" ? .67 : base === "g" ? .6 : .62;
  return { anti, base, component: anti ? antiComponent : component, material, color, radius, label: anti ? `${base}̄` : base };
}

function createFlavorParticle(flavor, position, radiusScale = 1) {
  const visual = flavorVisual(flavor);
  const group = new THREE.Group();
  const sphere = makeSphere(visual.radius * radiusScale, visual.material, [0, 0, 0], 28);
  const outline = new THREE.Mesh(
    new THREE.TorusGeometry(visual.radius * radiusScale * 1.08, .035, 8, 48),
    new THREE.MeshBasicMaterial({ color: visual.anti ? 0xf5f8f8 : new THREE.Color(visual.color), transparent: true, opacity: visual.anti ? .9 : .55 })
  );
  outline.rotation.x = Math.PI / 2;
  const label = labelSprite(visual.label, visual.color, .55);
  label.position.z = visual.radius * radiusScale + .18;
  group.add(sphere, outline, label);
  group.position.copy(position);
  tagComponent(group, visual.component, { flavor, anti: visual.anti });
  return group;
}

function createShell(radius = 3.2, detail = 3) {
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, detail), mats.shell);
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(radius, 1), 16),
    new THREE.LineBasicMaterial({ color: 0x4c9baa, transparent: true, opacity: 0.16 })
  );
  specimen.add(shell, edge);
  currentShell = shell;
  fieldObjects.push(edge);
}

function createBaryon(model) {
  createShell(3.25, 4);
  const positions = [new THREE.Vector3(-1.25, -0.7, 0.7), new THREE.Vector3(1.15, -0.45, 0.5), new THREE.Vector3(0, 1.22, -0.6)];
  const chargeMats = [mats.red, mats.green, mats.blue];
  model.composition.forEach((flavor, index) => {
    const anti = flavor.endsWith("Bar");
    const baseFlavor = anti ? flavor.slice(0, -3) : flavor;
    const group = new THREE.Group();
    const sphere = makeSphere(baseFlavor === "s" ? 0.84 : 0.76, baseFlavor === "s" ? mats.strange : chargeMats[index], [0, 0, 0], 32);
    const ring = new THREE.Mesh(new THREE.TorusGeometry((baseFlavor === "s" ? 0.84 : 0.76) * 1.08, 0.035, 8, 48), chargeMats[index]);
    ring.rotation.x = Math.PI / 2;
    const label = labelSprite(`${baseFlavor}${anti ? "̄" : ""}`, baseFlavor === "s" ? "#ee72d5" : ["#ff655e", "#63df9b", "#6da2ff"][index]);
    label.position.set(0, 0, 0.86);
    group.add(sphere, ring, label);
    tagComponent(group, anti ? (baseFlavor === "u" ? "antiUpQuark" : baseFlavor === "d" ? "antiDownQuark" : "antiStrangeQuark") : (baseFlavor === "u" ? "upQuark" : baseFlavor === "d" ? "downQuark" : "strangeQuark"), { flavor, index });
    group.position.copy(positions[index]);
    specimen.add(group);
    primaryParticles.push(group);
    animated.push({ type: "quark", object: group, phase: index * 2.1, base: positions[index].clone() });
  });
  for (let i = 0; i < 3; i += 1) {
    const tube = tubeBetween(positions[i], positions[(i + 1) % 3]);
    specimen.add(tube);
    fieldObjects.push(tube);
  }
}

function createConfinementDemo(model) {
  const ru = (localStorage.getItem("qcd-neutrino-language") || "en") === "ru";
  const flavors = model.composition || ["u", "u", "d"];
  const selected = clamp(state.confinementChoice, 0, 2);
  const corePositions = [new THREE.Vector3(-1.15, -.64, .25), new THREE.Vector3(.18, .72, -.22), new THREE.Vector3(1.05, -.46, -.15)];
  const core = new THREE.Group();
  const quarks = corePositions.map((position, index) => {
    const quark = createFlavorParticle(flavors[index], position, .8);
    tagComponent(quark, flavorVisual(flavors[index]).component, { confinement: index === selected ? "selected valence quark" : "baryon core", index });
    core.add(quark);
    return quark;
  });
  specimen.add(core);
  corePositions.forEach((position, index) => {
    if (index !== selected) specimen.add(tubeBetween(position, corePositions[(index + 1) % 3], mats.flux.clone(), .045));
  });
  const origin = corePositions[selected].clone();
  const final = new THREE.Vector3(5.0, 1.0, .25);
  const fluxMat = new THREE.MeshBasicMaterial({ color: 0xf2bf5b, transparent: true, opacity: .88 });
  const mainFlux = new THREE.Mesh(new THREE.CylinderGeometry(.085, .085, 1, 14), fluxMat);
  mainFlux.visible = false;
  const coreFlux = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 1, 14), fluxMat.clone());
  const mesonFlux = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 1, 14), fluxMat.clone());
  coreFlux.visible = mesonFlux.visible = false;
  specimen.add(mainFlux, coreFlux, mesonFlux);
  const splitPoint = origin.clone().lerp(final, .55);
  const createdAnti = createFlavorParticle(`${flavors[selected]}bar`, splitPoint, .67);
  const createdQ = createFlavorParticle(flavors[selected], splitPoint, .67);
  tagComponent(createdAnti, flavorVisual(`${flavors[selected]}bar`).component, { confinement: "created antiquark → meson" });
  tagComponent(createdQ, flavorVisual(flavors[selected]).component, { confinement: "created quark → baryon" });
  createdAnti.visible = createdQ.visible = false;
  specimen.add(createdAnti, createdQ);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(.62, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff4b5, transparent: true, opacity: 0, wireframe: true }));
  flash.position.copy(splitPoint); specimen.add(flash);
  const baryonLabel = labelSprite(ru ? "цветонейтральный барион" : "colour-neutral baryon", "#7de7ff", .55); baryonLabel.position.set(-.45, -1.75, 0); baryonLabel.visible = false;
  const mesonLabel = labelSprite(ru ? "цветонейтральный мезон" : "colour-neutral meson", "#f6cf67", .55); mesonLabel.position.set(3.5, -1.75, 0); mesonLabel.visible = false;
  specimen.add(baryonLabel, mesonLabel);
  const title = labelSprite(ru ? "выберите валентный кварк и вытяните его" : "select a valence quark, then pull it", "#f2bf5b", .62);
  title.position.set(0, -2.55, 0); specimen.add(title);
  animated.push({ type: "baryonConfinement", object: quarks[selected], origin, final, mainFlux, coreFlux, mesonFlux, createdQ, createdAnti, flash, baryonLabel, mesonLabel, title });
}

function createLepton(model) {
  createShell(2.7, 3);
  const isNeutrino = model.leptonKind === "neutrino";
  const color = isNeutrino ? 0x54d8ff : model.antiparticle ? 0xff655e : 0x6da2ff;
  const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.42, roughness: 0.25, metalness: 0.08 });
  const particle = makeSphere(isNeutrino ? 0.55 : 0.82, material, [0, 0, 0], 32);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(isNeutrino ? 0.74 : 1.02, 0.025, 8, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }));
  ring.rotation.x = Math.PI / 2;
  const label = labelSprite(model.symbol || model.title, isNeutrino ? "#54d8ff" : model.antiparticle ? "#ff9c98" : "#8ab4ff");
  label.position.set(0, 0, 0.95);
  const group = new THREE.Group(); group.add(particle, ring, label); specimen.add(group);
  primaryParticles.push(group); animated.push({ type: "quark", object: group, phase: 0, base: new THREE.Vector3() });
}

function createAtom(model) {
  createShell(3.85, 3);
  const nucleus = new THREE.Group();
  const positions = [[-.45,.2,.15],[.45,.1,-.2],[0,.55,.5],[0,-.55,.2]];
  model.nucleus.forEach((kind, index) => {
    const p = positions[index] || [0, 0, 0];
    const sphere = makeSphere(0.57, kind === "p" ? mats.proton : mats.neutron, p, 28);
    tagComponent(sphere, kind === "p" ? "proton" : "neutron", { nucleusIndex: index });
    nucleus.add(sphere);
    const label = labelSprite(kind, kind === "p" ? "#f2bf5b" : "#91a8ad", .46);
    label.position.set(p[0], p[1], p[2] + .6);
    nucleus.add(label);
  });
  specimen.add(nucleus);
  for (let i = 0; i < model.electrons; i += 1) {
    const radius = 2.45 + i * .44;
    const curve = new THREE.EllipseCurve(0, 0, radius, radius * .48, 0, Math.PI * 2);
    const pts = curve.getPoints(100).map((p) => new THREE.Vector3(p.x, p.y, 0));
    const orbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x4cc4d5, transparent: true, opacity: .34 }));
    orbit.rotation.set(0.8 + i * .8, 0.45 + i * .65, 0.15);
    specimen.add(orbit);
    fieldObjects.push(orbit);
    const electron = makeSphere(.16, mats.electron, [radius, 0, 0], 18);
    tagComponent(electron, "electron", { shell: i + 1 });
    specimen.add(electron);
    animated.push({ type: "electron", object: electron, radius, phase: i * Math.PI, tilt: orbit.rotation.clone(), speed: .7 + i * .2, electronIndex: i });
    primaryParticles.push(electron);
  }
}

function createComplexSpinQuasiparticle() {
  const coreMaterial = new THREE.MeshStandardMaterial({ color: 0x5fe7ff, emissive: 0x0b97d5, emissiveIntensity: 1.35, transparent: true, opacity: .95, roughness: .2, metalness: .06 });
  if (state.values.configuration === "lattice") {
    // The conceptual field has 100³ samples. Rendering all one million as
    // spheres would make the laboratory unusable, so each visible dot is a
    // deliberately sparse representative cell of a 10³ block.
    const sampleSide = 100;
    const displaySide = 11;
    const spacing = 3.15;
    const lattice = new THREE.InstancedMesh(new THREE.SphereGeometry(1.46, 12, 8), coreMaterial, displaySide ** 3);
    lattice.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    tagComponent(lattice, "complexSpin", { representation: "7 × 7 × 7 lattice of 3D slices of the hypothetical 4D quasiparticle" });
    const offsets = [];
    for (let x = 0; x < displaySide; x += 1) {
      for (let y = 0; y < displaySide; y += 1) {
        for (let z = 0; z < displaySide; z += 1) offsets.push(new THREE.Vector3((x - 5) * spacing, (y - 5) * spacing, (z - 5) * spacing));
      }
    }
    specimen.add(lattice);
    primaryParticles.push(lattice);
    const fieldSize = (displaySide - 1) * spacing + 1.8;
    const fieldVolume = new THREE.Mesh(
      new THREE.BoxGeometry(fieldSize, fieldSize, fieldSize),
      new THREE.MeshBasicMaterial({ color: 0x39dff4, transparent: true, opacity: .025, depthWrite: false })
    );
    const fieldEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(fieldSize, fieldSize, fieldSize)),
      new THREE.LineBasicMaterial({ color: 0x42d9ef, transparent: true, opacity: .32 })
    );
    fieldVolume.visible = false;
    fieldEdges.visible = false;
    specimen.add(fieldVolume, fieldEdges);
    fieldObjects.push(fieldVolume, fieldEdges);
    animated.push({ type: "complexSpinLattice", lattice, offsets, fieldVolume, fieldEdges, sampleSide, displaySide });
    return;
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.46, 64, 48), coreMaterial);
  tagComponent(core, "complexSpin", { representation: "3D hyperplane slice of a hypothetical 4D hypersphere" });
  specimen.add(core);
  primaryParticles.push(core);
  const spinArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, .2).normalize(), new THREE.Vector3(), 2.05, 0xf4ce68, .34, .16);
  specimen.add(spinArrow);
  animated.push({ type: "complexSpin", core, spinArrow });
}

function createTesseract() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TESSERACT_EDGES.length * 6), 3));
  const wireframe = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xf4ce68, transparent: true, opacity: .96 }));
  tagComponent(wireframe, "tesseract", { representation: "4D tesseract shown as either a perspective projection or an exact 3D hyperplane slice" });
  specimen.add(wireframe);
  animated.push({ type: "tesseract", object: wireframe, geometry });
}

function createGravitationalStandingWaveCore() {
  const values = state.values;
  const majorRadius = Number(values.torusMajorRadius || 5.25);
  const tubeRadius = Number(values.torusTubeRadius || 1.5);
  const coreGeometry = new THREE.TorusGeometry(majorRadius, tubeRadius, 48, 160);
  const coreBase = Float32Array.from(coreGeometry.attributes.position.array);
  const core = new THREE.Mesh(
    coreGeometry,
    new THREE.MeshPhysicalMaterial({
      color: 0x4d94b8,
      emissive: 0x06273c,
      emissiveIntensity: 0.55,
      metalness: 0.16,
      roughness: 0.3,
      clearcoat: 0.6,
      clearcoatRoughness: 0.18,
      transparent: false,
      opacity: 1
    })
  );
  // One opaque toroidal body: the surface carries the visual wave mode, while
  // the interior intentionally remains unrepresented.
  core.rotation.x = Math.PI / 2;
  // Raise the closed body above the spacetime sheet so its oscillation remains
  // legible even when the sheet itself has a strong central peak.
  core.position.y = 0.82;
  tagComponent(core, "gravitationalStandingWaveTorus", {
    representation: "author-defined opaque toroidal standing-wave body; no interior microstructure is implied"
  });
  specimen.add(core);

  const gridGeometry = new THREE.PlaneGeometry(23, 23, 48, 48);
  gridGeometry.rotateX(-Math.PI / 2);
  const baseGrid = Float32Array.from(gridGeometry.attributes.position.array);
  const grid = new THREE.Mesh(
    gridGeometry,
    new THREE.MeshBasicMaterial({ color: 0x81edff, wireframe: true, transparent: true, opacity: Number(values.gridOpacity ?? 0.52), depthWrite: false })
  );
  grid.position.y = -1.8;
  grid.userData.pickable = false;
  specimen.add(grid);
  fieldObjects.push(grid);

  const fronts = [];
  for (let index = 0; index < 5; index += 1) {
    const front = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 20),
      new THREE.MeshBasicMaterial({ color: index % 2 ? 0xc69cff : 0x7fefff, wireframe: true, transparent: true, opacity: 0.12, depthWrite: false })
    );
    front.scale.setScalar(2.25 + index * 1.58);
    front.userData.pickable = false;
    specimen.add(front);
    fronts.push(front);
  }

  animated.push({ type: "standingWaveCore", core, coreBase, majorRadius, tubeRadius, grid, baseGrid, fronts });
}

function fitImportedAsset(asset, targetSize = 6.2) {
  // Imported assets often have an authoring pivot far from their visible mesh.
  // Normalize the visual bounding box at the laboratory origin before exposing it
  // to OrbitControls, so camera orbit and rotation are always around the object.
  const frame = new THREE.Group();
  frame.name = "centered-import-frame";
  frame.add(asset);
  frame.updateMatrixWorld(true);
  const initialBox = new THREE.Box3().setFromObject(frame);
  const size = initialBox.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z, .001);
  asset.scale.multiplyScalar(targetSize / longest);
  frame.updateMatrixWorld(true);
  const centeredBox = new THREE.Box3().setFromObject(frame);
  asset.position.sub(centeredBox.getCenter(new THREE.Vector3()));
  frame.updateMatrixWorld(true);
  asset.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  return frame;
}

function loadMacroAsset(model, url, loader, targetSize) {
  const selectedId = model.id;
  loader.load(url, (loaded) => {
    if (state.selected.id !== selectedId) return;
    const asset = loaded.scene || loaded;
    const frame = fitImportedAsset(asset, targetSize);
    specimen.add(frame);
    primaryParticles.push(frame);
    controls.target.set(0, 0, 0);
    controls.update();
    setStatus("LOCAL NASA ASSET · ready", true);
  }, undefined, () => setStatus("MACRO ASSET UNAVAILABLE · check local files", true));
}

function createRelativisticBlackHole({ scale = 1, diskTilt = .18, compact = false } = {}) {
  const group = new THREE.Group();
  const horizon = new THREE.Mesh(new THREE.SphereGeometry(1.34 * scale, 64, 48), new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { rimColor: { value: new THREE.Color(0x5f8da8) }, rimStrength: { value: compact ? .45 : .72 } },
    vertexShader: "varying vec3 vNormal; varying vec3 vView; void main(){ vNormal=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }",
    fragmentShader: "uniform vec3 rimColor; uniform float rimStrength; varying vec3 vNormal; varying vec3 vView; void main(){ float rim=pow(1.0-max(dot(normalize(vNormal),normalize(vView)),0.0),3.2); vec3 c=vec3(0.0)+rimColor*rim*rimStrength; gl_FragColor=vec4(c,0.98); }"
  }));
  const photonRing = new THREE.Mesh(new THREE.TorusGeometry(1.53 * scale, .06 * scale, 16, 180), new THREE.MeshBasicMaterial({ color: 0xfff4bf, transparent: true, opacity: .92, blending: THREE.AdditiveBlending, depthWrite: false }));
  photonRing.rotation.x = Math.PI / 2;
  group.add(horizon, photonRing);
  const disk = new THREE.Group();
  [[1.68, 2.25, 0xfff2bd, .88], [2.18, 3.15, 0xffa143, .74], [3.05, 4.45, 0x8e1f1f, .52]].forEach(([inner, outer, color, opacity], index) => {
    const layer = new THREE.Mesh(new THREE.RingGeometry(inner * scale, outer * scale, 180, 5), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    layer.rotation.x = -Math.PI / 2;
    layer.position.y = (index - 1) * .035 * scale;
    disk.add(layer);
  });
  disk.rotation.z = diskTilt;
  group.add(disk);
  // A restrained rear image of the disk.  It is kept co-planar with the main
  // disk rather than using a giant tilted torus, which looked like an unrelated
  // orbit instead of gravitational lensing.
  const lensedBand = new THREE.Mesh(new THREE.RingGeometry(2.34 * scale, 3.42 * scale, 160, 2, Math.PI * .12, Math.PI * .82), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: .33, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  lensedBand.rotation.x = -Math.PI / 2;
  lensedBand.rotation.z = diskTilt + Math.PI * .05;
  lensedBand.position.y = .12 * scale;
  group.add(lensedBand);
  return { group, horizon, photonRing, disk, lensedBand };
}

function createNasaAccretionDiskVisual() {
  const holder = new THREE.Group();
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load("./assets/models/nasa-svs-black-hole-accretion-disk.gif", (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const diskVisual = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      transparent: false,
      depthWrite: false,
      depthTest: false
    }));
    // This is NASA SVS simulation ID 13326, not a hand-drawn substitute.
    // The sprite faces the observer so the supplied edge-on lensing geometry is
    // preserved instead of being distorted by this laboratory's orbit camera.
    diskVisual.scale.set(12.2, 7.04, 1);
    holder.add(diskVisual);
    animated.push({ type: "nasaAccretionDisk", object: diskVisual, texture });
    setStatus("NASA SVS ACCRETION-DISK VISUALIZATION · ready", true);
  }, undefined, () => {
    const fallback = createRelativisticBlackHole({ scale: 1.08, diskTilt: .2 });
    fallback.group.rotation.set(.24, -.42, .08);
    holder.add(fallback.group);
    animated.push({ type: "blackHole", object: fallback.group, photonRing: fallback.photonRing, lensedBand: fallback.lensedBand, disk: fallback.disk });
    setStatus("NASA ASSET UNAVAILABLE · procedural fallback", true);
  });
  specimen.add(holder);
  primaryParticles.push(holder);
  return holder;
}

// Interactive GPU preview for the catalogue view.  This is deliberately not
// presented as a numerical-relativity solution: it is a local WebGL rendering
// guided by the ray-bending, photon-ring and Doppler-beaming treatment in
// Eric Bruneton's open black-hole shader project.  Unlike the NASA GIF, every
// component here belongs to the Three.js scene and can be inspected by orbiting
// the camera.
function createInteractiveBlackHoleVisual() {
  const values = state.values;
  const mass = Math.max(Number(values.mass || 4300000), 3);
  const diskRadius = clamp(Number(values.diskRadius || 6), 2, 14);
  // A logarithmic display mapping keeps both stellar and supermassive values
  // visible while retaining the physical r_s proportionality in the labels.
  const horizonRadius = clamp(.9 + Math.log10(mass / 3 + 1) * .19, 1.15, 2.25);
  const outerRadius = horizonRadius * (1.55 + diskRadius * .42);
  const group = new THREE.Group();
  // Start near edge-on, where the relativistic far-side image is legible; the
  // user can still orbit freely through every other viewing angle.
  group.rotation.set(-.42, -.28, 0);

  const stars = new THREE.BufferGeometry();
  const starPositions = [];
  for (let i = 0; i < 520; i += 1) {
    const radius = rand(9, 24); const theta = rand(0, Math.PI * 2); const y = rand(-8, 8);
    starPositions.push(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
  }
  stars.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  const starField = new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xc9ecff, size: .025, transparent: true, opacity: .56, depthWrite: false }));
  group.add(starField);

  const horizon = new THREE.Mesh(new THREE.SphereGeometry(horizonRadius, 96, 72), new THREE.ShaderMaterial({
    uniforms: { rim: { value: new THREE.Color(0x9dd9ff) } }, transparent: true,
    vertexShader: "varying vec3 n; varying vec3 v; void main(){ n=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); v=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }",
    fragmentShader: "uniform vec3 rim; varying vec3 n; varying vec3 v; void main(){ float f=pow(1.0-max(dot(n,v),0.0),5.0); gl_FragColor=vec4(rim*f*.42, .985); }"
  }));
  group.add(horizon);

  const diskUniforms = { time: { value: 0 }, innerRadius: { value: horizonRadius * 1.08 }, outerRadius: { value: outerRadius } };
  const disk = new THREE.Mesh(new THREE.RingGeometry(horizonRadius * 1.08, outerRadius, 320, 20), new THREE.ShaderMaterial({
    uniforms: diskUniforms, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: "varying vec3 p; varying vec2 u; void main(){ p=position; u=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: `uniform float time; uniform float innerRadius; uniform float outerRadius; varying vec3 p; varying vec2 u;
      void main(){ float r=length(p.xy); float q=clamp((r-innerRadius)/(outerRadius-innerRadius),0.,1.); float a=atan(p.y,p.x); float bands=.62+.38*sin(38.*q-7.*a-time*2.1)+.16*sin(104.*q+13.*a-time*4.2); float turbulent=.76+.24*sin(17.*a+q*54.+time*1.7); float approaching=.42+1.15*pow(max(0.,sin(a-.62)),2.4); vec3 hot=mix(vec3(.42,.006,.001),vec3(1.,.12,.008),q); hot=mix(vec3(1.,.93,.55),hot,smoothstep(.0,.32,q)); float fade=smoothstep(1.,.7,q)*smoothstep(.0,.075,q); gl_FragColor=vec4(hot*bands*turbulent*approaching, fade*.96); }`
  }));
  disk.rotation.x = -Math.PI / 2;
  group.add(disk);

  const photonRing = new THREE.Mesh(new THREE.TorusGeometry(horizonRadius * 1.13, horizonRadius * .025, 12, 240), new THREE.MeshBasicMaterial({ color: 0xffefb4, transparent: true, opacity: .96, blending: THREE.AdditiveBlending, depthWrite: false }));
  photonRing.rotation.x = Math.PI / 2;
  group.add(photonRing);

  const makeLensedRibbon = (height, width, color, opacity) => {
    const points = Array.from({ length: 80 }, (_, i) => {
      const t = -1 + i / 79 * 2;
      // Keep the secondary image close to the shadow.  Extending it to the
      // outer disk made it read as an unrelated orbit rather than a lensed
      // image of the far side of the accretion flow.
      const x = t * horizonRadius * 1.42;
      const y = height * (1 - t * t) + .14;
      const z = .12 + Math.sin(t * Math.PI) * .16;
      return new THREE.Vector3(x, y, z);
    });
    return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 160, width, 10, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  };
  // These two arcs represent the lensed far side and underside of the disk.
  // They remain part of the 3D object, so their apparent shape changes with
  // the observer rather than staying fixed as a billboard image.
  const upperImage = makeLensedRibbon(horizonRadius * .82, horizonRadius * .042, 0xff9a28, .78);
  const lowerImage = makeLensedRibbon(-horizonRadius * .38, horizonRadius * .026, 0xff3d0d, .18);
  group.add(upperImage, lowerImage);

  specimen.add(group);
  primaryParticles.push(group);
  animated.push({ type: "interactiveBlackHole", group, disk, diskUniforms, photonRing, upperImage, lowerImage, starField });
  controls.target.set(0, .15, 0);
  controls.update();
  setStatus("INTERACTIVE WEBGL ACCRETION-DISK RENDERER · drag to orbit", true);
}

function createSpacetimeGrid(width = 31, depth = 21, widthSegments = 76, depthSegments = 52) {
  const geometry = new THREE.PlaneGeometry(width, depth, widthSegments, depthSegments);
  const material = new THREE.MeshBasicMaterial({
    color: 0x65e9ff,
    wireframe: true,
    transparent: true,
    opacity: .14,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const grid = new THREE.Mesh(geometry, material);
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = -1.15;
  grid.frustumCulled = false;
  const base = Float32Array.from(geometry.attributes.position.array);
  effects.add(grid);
  return { grid, geometry, base };
}

function mergerBodyCount(values = state.values) {
  return clamp(Number(values.binaryCount || 2), 2, 9);
}

function seededMergerRandom(seed) {
  let value = (Number(seed) || 1357911) >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function mergerBodyMasses(values = state.values) {
  const count = mergerBodyCount(values);
  const seedMasses = [Number(values.binaryMassA || 36), Number(values.binaryMassB || 29), Number(values.binaryMassC || 18)];
  const random = seededMergerRandom(values.orbitSeed);
  return Array.from({ length: count }, (_, index) => index < 3 ? seedMasses[index] : clamp(seedMasses[index % 3] * (.28 + random() * .22), 3, 18));
}

function getMergerDuration(values = state.values) {
  if (mergerBodyCount(values) >= 6) return 20;
  return values.mergerConfiguration === "headOn" ? 10.5 : values.mergerConfiguration === "eccentric" ? 17.5 : 15.5;
}

function createBlackHoleMerger() {
  const values = state.values;
  const count = mergerBodyCount(values);
  const masses = mergerBodyMasses(values);
  const separation = clamp((values.initialSeparation || 52) / 5.2, 4.6, 15.5);
  const random = seededMergerRandom(values.orbitSeed);
  // The displayed horizon radius is proportional to Schwarzschild radius and
  // therefore to mass.  The clamp only protects the framing limits of the lab.
  const displayRadius = (mass) => clamp(.56 * Math.sqrt(mass / 36), .14, .9);
  const bodies = masses.map((mass, index) => {
    const body = createRelativisticBlackHole({ scale: displayRadius(mass), diskTilt: (random() - .5) * .45, compact: true });
    const phase = count === 2 ? (index ? 0 : Math.PI) : index / count * Math.PI * 2 + (random() - .5) * .42;
    const radius = separation * (count === 2 ? .5 : .48 + random() * .36);
    specimen.add(body.group);
    return { body, mass, phase, radius, rate: .68 + random() * .55, direction: index % 2 ? -1 : 1 };
  });
  const [a, b, c] = bodies.map((entry) => entry.body);
  const remnantMass = masses.reduce((sum, mass) => sum + mass, 0);
  primaryParticles.push(...bodies.map((entry) => entry.body.group));
  const orbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(new THREE.EllipseCurve(0, 0, separation * .54, separation * .21, 0, Math.PI * 2, false, 0).getPoints(160).map((p) => new THREE.Vector3(p.x, 0, p.y))), new THREE.LineBasicMaterial({ color: 0x9cd8e4, transparent: true, opacity: .24 }));
  specimen.add(orbit);
  const spacetime = createSpacetimeGrid();
  // Gravitational radiation is rendered in the plane facing the observer so
  // the outgoing fronts are legible, not edge-on.  Alternating elongated axes
  // make the quadrupole nature of a binary source visible without implying a
  // full numerical-relativity spacetime render.
  const wave = new THREE.Group();
  for (let i = 0; i < 12; i += 1) {
    // WebGL frequently clamps LineBasicMaterial to one physical pixel.  A
    // narrow emissive tube keeps the wave fronts legible on dense displays.
    const points = Array.from({ length: 96 }, (_, pointIndex) => {
      const angle = pointIndex / 96 * Math.PI * 2;
      return new THREE.Vector3(Math.cos(angle), Math.sin(angle) * (i % 2 ? .56 : .82), .1);
    });
    const ring = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 96, .026, 6, true),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xca8cff : 0x65e9ff, transparent: true, opacity: .92, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    ring.rotation.z = i % 2 ? Math.PI / 2 : 0;
    ring.visible = false;
    wave.add(ring);
  }
  const mergerFlash = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xfaf1bf, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  mergerFlash.scale.set(0.1, 0.1, 1);
  wave.add(mergerFlash);
  wave.userData.mergerFlash = mergerFlash;
  effects.add(wave);
  const remnant = createRelativisticBlackHole({ scale: clamp(displayRadius(remnantMass) * 1.24, .32, 1.2), diskTilt: .08, compact: true });
  remnant.group.visible = false;
  effects.add(remnant.group);
  animated.push({ type: "blackHoleMerger", a, b, c, bodies, remnant, remnantMass, orbit, wave, spacetime, masses, separation, count, configuration: values.mergerConfiguration || "quasiCircular" });
  setStatus("BINARY BLACK-HOLE INITIAL DATA · analytic local preview", true);
}

function createResonantTripleHypothesis() {
  const values = state.values;
  const masses = {
    a: Number(values.centralMassA || 30),
    b: Number(values.centralMassB || 28),
    c: Number(values.tertiaryMass || 7)
  };
  const displayRadius = (mass) => clamp(.48 * Math.sqrt(mass / 30), .14, .82);
  const centralA = createRelativisticBlackHole({ scale: displayRadius(masses.a), diskTilt: .08, compact: true });
  const centralB = createRelativisticBlackHole({ scale: displayRadius(masses.b), diskTilt: -.12, compact: true });
  const tertiary = createRelativisticBlackHole({ scale: displayRadius(masses.c), diskTilt: .24, compact: true });
  const tertiaryTwin = createRelativisticBlackHole({ scale: displayRadius(masses.c), diskTilt: -.24, compact: true });
  const tertiaryFlankA = createRelativisticBlackHole({ scale: displayRadius(masses.c * .9), diskTilt: .46, compact: true });
  const tertiaryFlankB = createRelativisticBlackHole({ scale: displayRadius(masses.c * .9), diskTilt: -.46, compact: true });
  const remnant = createRelativisticBlackHole({ scale: clamp(displayRadius(masses.a + masses.b) * 1.18, .3, 1.08), diskTilt: .04, compact: true });
  remnant.group.visible = false;
  // The four balancing bodies are part of the initial configuration, rather
  // than being injected half-way through the visual experiment.
  tertiary.group.visible = true;
  tertiaryTwin.group.visible = true;
  tertiaryFlankA.group.visible = true;
  tertiaryFlankB.group.visible = true;
  [centralA, centralB, tertiary, tertiaryTwin, tertiaryFlankA, tertiaryFlankB].forEach((body) => specimen.add(body.group));
  effects.add(remnant.group);
  primaryParticles.push(centralA.group, centralB.group, tertiary.group, tertiaryTwin.group, tertiaryFlankA.group, tertiaryFlankB.group, remnant.group);
  const baseSeparation = clamp(Number(values.centralSeparation || 22) / 3.1, 3.6, 11.0);
  const outerRadius = baseSeparation * 1.44;
  const centralOrbit = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(new THREE.EllipseCurve(0, 0, baseSeparation * .42, baseSeparation * .23, 0, Math.PI * 2, false, 0).getPoints(128).map((point) => new THREE.Vector3(point.x, 0, point.y))),
    new THREE.LineBasicMaterial({ color: 0x94dce6, transparent: true, opacity: .25 })
  );
  const tertiaryOrbit = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(new THREE.EllipseCurve(0, 0, outerRadius, outerRadius * .57, 0, Math.PI * 2, false, 0).getPoints(160).map((point) => new THREE.Vector3(point.x, .015, point.y))),
    new THREE.LineBasicMaterial({ color: 0xd59cff, transparent: true, opacity: .2 })
  );
  tertiaryOrbit.visible = true;
  const twinOrbit = tertiaryOrbit.clone();
  twinOrbit.rotation.y = Math.PI;
  twinOrbit.visible = true;
  const flankOrbit = tertiaryOrbit.clone();
  flankOrbit.rotation.y = Math.PI / 2;
  flankOrbit.visible = true;
  specimen.add(centralOrbit, tertiaryOrbit, twinOrbit, flankOrbit);
  // This hypothesis is intentionally given a much broader embedding surface:
  // the external perturber and the outgoing wavefronts need room around A+B.
  const spacetime = createSpacetimeGrid(48, 34, 116, 80);
  const wave = new THREE.Group();
  for (let ringIndex = 0; ringIndex < 13; ringIndex += 1) {
    const points = Array.from({ length: 100 }, (_, pointIndex) => {
      const angle = pointIndex / 100 * Math.PI * 2;
      return new THREE.Vector3(Math.cos(angle), Math.sin(angle) * (ringIndex % 2 ? .58 : .82), .05);
    });
    const ring = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 96, .022, 6, true),
      new THREE.MeshBasicMaterial({ color: ringIndex % 2 ? 0xd4a2ff : 0x6cecff, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    ring.visible = false;
    ring.rotation.z = ringIndex % 2 ? Math.PI / 2 : 0;
    wave.add(ring);
  }
  effects.add(wave);
  const mergerFlash = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xfaf1bf, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  mergerFlash.scale.set(.1, .1, 1);
  wave.add(mergerFlash);
  wave.userData.mergerFlash = mergerFlash;
  animated.push({ type: "resonantTriple", centralA, centralB, tertiary, tertiaryTwin, tertiaryFlankA, tertiaryFlankB, remnant, masses, remnantMass: masses.a + masses.b, baseSeparation, outerRadius, centralOrbit, tertiaryOrbit, twinOrbit, flankOrbit, spacetime, wave });
  setStatus("RESONANT TRIPLE HYPOTHESIS · controlled coplanar perturbation", true);
}

function createMacroObject(model) {
  if (model.macroKind === "jupiter") {
    loadMacroAsset(model, "./assets/models/nasa-jupiter.glb", gltfLoader, 6.4);
    return;
  }
  if (model.macroKind === "sun") {
    const selectedId = model.id;
    new THREE.TextureLoader().load("./assets/models/nasa-sun-texture.jpg", (texture) => {
      if (state.selected.id !== selectedId) return;
      texture.colorSpace = THREE.SRGBColorSpace;
      const star = new THREE.Group();
      const surface = new THREE.Mesh(
        new THREE.SphereGeometry(3.05, 72, 48),
        new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: 0xff9a36, emissiveIntensity: 1.35, roughness: .82 })
      );
      const corona = new THREE.Mesh(
        new THREE.SphereGeometry(3.34, 64, 40),
        new THREE.MeshBasicMaterial({ color: 0xffb34c, transparent: true, opacity: .12, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      const equator = new THREE.Mesh(new THREE.TorusGeometry(3.1, .025, 8, 128), new THREE.MeshBasicMaterial({ color: 0xffd47a, transparent: true, opacity: .35 }));
      equator.rotation.x = Math.PI / 2;
      star.add(surface, corona, equator);
      specimen.add(star);
      primaryParticles.push(star);
      animated.push({ type: "macroSpin", object: star, speed: .028 });
      setStatus("NASA SUN TEXTURE · ready", true);
    }, undefined, () => setStatus("SUN ASSET UNAVAILABLE · check local files", true));
    return;
  }
  if (model.macroKind === "blackHole") {
    createInteractiveBlackHoleVisual();
    return;
    const blackHole = new THREE.Group();
    const horizon = new THREE.Mesh(new THREE.SphereGeometry(1.48, 64, 48), new THREE.MeshStandardMaterial({ color: 0x000104, roughness: .15, metalness: .35 }));
    const photonRing = new THREE.Mesh(new THREE.TorusGeometry(1.63, .07, 16, 160), new THREE.MeshBasicMaterial({ color: 0xfff1b5, transparent: true, opacity: .9, blending: THREE.AdditiveBlending }));
    photonRing.rotation.x = Math.PI / 2;
    blackHole.add(horizon, photonRing);
    const diskLayers = [
      [1.82, 2.55, 0xffe3a1, .82, .04],
      [2.42, 3.5, 0xff8438, .72, -.025],
      [3.35, 4.72, 0x9d2619, .5, .015]
    ];
    diskLayers.forEach(([inner, outer, color, opacity, y], index) => {
      const disk = new THREE.Mesh(
        new THREE.RingGeometry(inner, outer, 160, 4),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      disk.rotation.x = -Math.PI / 2;
      disk.position.y = y;
      blackHole.add(disk);
      animated.push({ type: "macroSpin", object: disk, speed: .08 + index * .025, direction: index % 2 ? -1 : 1 });
    });
    // A lifted, dim secondary image makes the lensing cue readable in 3D without
    // pretending that this is a full general-relativistic ray tracer.
    const lensedBand = new THREE.Mesh(
      new THREE.TorusGeometry(3.3, .19, 12, 160, Math.PI * 1.45),
      new THREE.MeshBasicMaterial({ color: 0xffb04e, transparent: true, opacity: .42, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    lensedBand.rotation.set(Math.PI / 2.45, 0, -.38);
    lensedBand.position.y = .62;
    blackHole.add(lensedBand);
    const jets = [1, -1].map((sign) => {
      const jet = new THREE.Mesh(new THREE.ConeGeometry(.24, 3.6, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x6fdcff, transparent: true, opacity: .18, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
      jet.position.y = sign * 2.6;
      if (sign < 0) jet.rotation.x = Math.PI;
      blackHole.add(jet);
      return jet;
    });
    blackHole.rotation.set(.24, -.42, .08);
    specimen.add(blackHole);
    primaryParticles.push(blackHole);
    animated.push({ type: "blackHole", object: blackHole, photonRing, lensedBand, jets });
    setStatus("RELATIVISTIC ACCRETION-DISK MODEL · ready", true);
    return;
  }
  const star = makeSphere(1.75, new THREE.MeshStandardMaterial({ color: 0x8ccaff, emissive: 0x1756bc, emissiveIntensity: 1.4, roughness: .38 }), [0, 0, 0], 48);
  specimen.add(star); primaryParticles.push(star);
  for (let i = 0; i < 3; i += 1) {
    const field = new THREE.Mesh(new THREE.TorusGeometry(2.3 + i * .34, .028, 8, 100), new THREE.MeshBasicMaterial({ color: 0x7ef6ff, transparent: true, opacity: .58 }));
    field.rotation.set(.55 + i * .4, .3 + i * .5, 0); specimen.add(field); animated.push({ type: "ring", object: field, phase: i, speed: .12 + i * .03 });
  }
}

function createDenseBaryons() {
  createShell(3.7, 3);
  for (let i = 0; i < 34; i += 1) {
    const radius = Math.cbrt(Math.random()) * 3;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(rand(-1, 1));
    const mesh = makeSphere(.34, i % 5 === 0 ? mats.proton : mats.neutron, [radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta)], 16);
    tagComponent(mesh, i % 5 === 0 ? "proton" : "neutron", { medium: "dense matter" });
    specimen.add(mesh);
    primaryParticles.push(mesh);
    animated.push({ type: "jitter", object: mesh, base: mesh.position.clone(), phase: Math.random() * 8 });
  }
}

function createHybridMatter(model) {
  createShell(3.75, 3);
  const quarkFraction = deriveVisualState().quarkFraction;
  for (let i = 0; i < 44; i += 1) {
    const quark = i / 44 < quarkFraction;
    const side = quark ? 1 : -1;
    const p = new THREE.Vector3(side * rand(.25, 3), rand(-2.6, 2.6), rand(-2.25, 2.25));
    if (p.length() > 3.35) p.setLength(3.35);
    const quarkMaterial = i % 3 === 2 ? mats.strange : i % 2 ? mats.green : mats.red;
    const hadronMaterial = i % 5 === 0 ? mats.proton : mats.neutron;
    const quarkComponent = i % 3 === 2 ? "strangeQuark" : i % 2 ? "downQuark" : "upQuark";
    const hadronComponent = i % 5 === 0 ? "proton" : "neutron";
    const mesh = makeSphere(.36, quark ? quarkMaterial : hadronMaterial, p.toArray(), 18);
    mesh.scale.setScalar(quark ? .52 : 1);
    tagComponent(mesh, quark ? quarkComponent : hadronComponent, { phase: quark ? "quark" : "hadron" });
    Object.assign(mesh.userData, { hybridIndex: i / 44, quarkMaterial, hadronMaterial, quarkComponent, hadronComponent });
    specimen.add(mesh);
    primaryParticles.push(mesh);
    animated.push({ type: "hybrid", object: mesh, base: p.clone(), phase: rand(0, 8), speed: rand(.6, 1.4) });
  }
  const interfaceRing = new THREE.Mesh(new THREE.TorusGeometry(3.08, .035, 8, 96), new THREE.MeshBasicMaterial({ color: 0xf2bf5b, transparent: true, opacity: .5 }));
  interfaceRing.rotation.y = Math.PI / 2;
  interfaceRing.userData.fieldRole = "flux";
  tagComponent(interfaceRing, "gluonField", { interface: "quark-hadron crossover" });
  specimen.add(interfaceRing);
  fieldObjects.push(interfaceRing);
  animated.push({ type: "ring", object: interfaceRing, phase: 0, speed: .08 });
}

function createCondensateMatter(model) {
  if (model.id === "cflKaon") createQuarkMedium({ ...model, visual: "pairedMatter" });
  else createDenseBaryons();
  const amplitude = state.values.condensateFraction ?? .35;
  for (let i = 0; i < 5; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.3 + i * .48, .035 + amplitude * .025, 8, 96),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xee72d5 : 0x54d8ff, transparent: true, opacity: .24 + amplitude * .32 })
    );
    ring.rotation.set(i * .42, .35 + i * .31, i * .18);
    ring.userData.fieldRole = "condensate";
    tagComponent(ring, "condensate", { mode: i + 1 });
    specimen.add(ring);
    fieldObjects.push(ring);
    animated.push({ type: "ring", object: ring, phase: i, speed: .09 + i * .02 });
  }
}

function createCrystalMatter() {
  createShell(3.75, 2);
  const spacing = 1.28;
  const nodes = [];
  for (let x = -2; x <= 2; x += 1) {
    for (let y = -2; y <= 2; y += 1) {
      for (let z = -1; z <= 1; z += 1) {
        if ((Math.abs(x) + Math.abs(y) + Math.abs(z)) % 2) continue;
        const p = new THREE.Vector3(x * spacing, y * spacing, z * spacing);
        if (p.length() > 3.45) continue;
        const mesh = makeSphere(.19, nodes.length % 3 === 2 ? mats.strange : nodes.length % 2 ? mats.green : mats.red, p.toArray(), 14);
        tagComponent(mesh, nodes.length % 3 === 2 ? "strangeQuark" : nodes.length % 2 ? "downQuark" : "upQuark", { latticeSite: nodes.length + 1 });
        specimen.add(mesh);
        primaryParticles.push(mesh);
        animated.push({ type: "crystal", object: mesh, base: p.clone(), phase: nodes.length * .42 });
        nodes.push(p);
      }
    }
  }
  nodes.forEach((a, i) => {
    const b = nodes.find((candidate, j) => j > i && candidate.distanceTo(a) < spacing * 1.48);
    if (!b) return;
    const link = tubeBetween(a, b, new THREE.MeshBasicMaterial({ color: 0xee72d5, transparent: true, opacity: .34 }), .024);
    specimen.add(link);
    fieldObjects.push(link);
  });
}

const moleculePresets = {
  water: { atoms: [["O",0,.35,0],["H",-.78,-.28,0],["H",.78,-.28,0]], bonds: [[0,1],[0,2]] },
  ammonia: { atoms: [["N",0,.28,0],["H",-.82,-.34,.42],["H",.82,-.34,.42],["H",0,-.34,-.86]], bonds: [[0,1],[0,2],[0,3]] },
  methane: { atoms: [["C",0,0,0],["H",.82,.82,.82],["H",-.82,-.82,.82],["H",-.82,.82,-.82],["H",.82,-.82,-.82]], bonds: [[0,1],[0,2],[0,3],[0,4]] },
  ethanol: { atoms: [["C",-1.25,0,0],["C",.15,0,0],["O",1.35,.45,0],["H",2.05,-.18,0],["H",-1.65,.75,.55],["H",-1.65,.05,-.95],["H",-1.65,-.85,.38],["H",.35,-.55,.88],["H",.35,-.55,-.88]], bonds: [[0,1],[1,2],[2,3],[0,4],[0,5],[0,6],[1,7],[1,8]] },
  benzene: { atoms: Array.from({length:6},(_,i)=>["C",Math.cos(i*Math.PI/3)*1.45,Math.sin(i*Math.PI/3)*1.45,0]).concat(Array.from({length:6},(_,i)=>["H",Math.cos(i*Math.PI/3)*2.35,Math.sin(i*Math.PI/3)*2.35,0])), bonds: Array.from({length:6},(_,i)=>[i,(i+1)%6]).concat(Array.from({length:6},(_,i)=>[i,i+6])) }
};

const chemistryLibrary = {
  water: ["Вода", "H₂O", "O"], ammonia: ["Аммиак", "NH₃", "N"], methane: ["Метан", "CH₄", "C"],
  ethanol: ["Этанол", "C₂H₆O", "CCO"], benzene: ["Бензол", "C₆H₆", "c1ccccc1"], caffeine: ["Кофеин", "C₈H₁₀N₄O₂", "Cn1c(=O)c2c(ncn2C)n(C)c1=O"],
  hydrogen: ["Водород", "H₂", "[H][H]"], oxygen: ["Кислород", "O₂", "O=O"], carbonDioxide: ["Диоксид углерода", "CO₂", "O=C=O"],
  ethene: ["Этен", "C₂H₄", "C=C"], ethane: ["Этан", "C₂H₆", "CC"], hydrogenChloride: ["Хлороводород", "HCl", "Cl"],
  aceticAcid: ["Уксусная кислота", "C₂H₄O₂", "CC(=O)O"], ethylAcetate: ["Этилацетат", "C₄H₈O₂", "CCOC(=O)C"]
};

const chemistryReactionOptions = [
  ["waterFormation", "2 H₂ + O₂ → 2 H₂O"],
  ["methaneCombustion", "CH₄ + 2 O₂ → CO₂ + 2 H₂O"],
  ["etheneHydrogenation", "C₂H₄ + H₂ → C₂H₆"],
  ["esterification", "C₂H₆O + C₂H₄O₂ ⇌ C₄H₈O₂ + H₂O"]
];

function chemistryDraftFromPreset(preset) {
  const source = moleculePresets[preset] || moleculePresets.water;
  return {
    atoms: source.atoms.map((atom) => ({ element: atom[0], x: 140 + atom[1] * 34, y: 82 - atom[2] * 34 })),
    bonds: source.bonds.map((bond, index) => [bond[0], bond[1], preset === "benzene" && index < 6 && index % 2 === 0 ? 2 : 1])
  };
}

function ensureChemistryState(force = false) {
  if (state.selected?.visual !== "molecule") return null;
  const preset = state.values.moleculePreset || "water";
  if (force || !state.chemistry || state.chemistry.preset !== preset) {
    state.chemistry = {
      preset,
      atomTool: "C",
      bondOrder: 1,
      selectedAtom: null,
      draft: chemistryDraftFromPreset(preset),
      smilesInput: chemistryLibrary[preset]?.[2] || "O",
      original: null,
      display: null,
      addedCompounds: [],
      libraryChoice: "oxygen",
      reactionChoice: "waterFormation",
      reaction: null,
      busy: false,
      message: "Редактор готов · выберите атом и кликните по полю"
    };
  }
  return state.chemistry;
}

function chemistryElementMaterial(element) {
  const palette = {
    H: [0xf0f6f7, 0x000000], C: [0x34434c, 0x000000], N: [0x397be8, 0x0c2458], O: [0xef5168, 0x5a0814],
    F: [0x65dca3, 0x083b28], P: [0xf3a44f, 0x5a2606], S: [0xf0d75a, 0x594600], Cl: [0x4ed47b, 0x07351a],
    Br: [0x9e4434, 0x391008], I: [0x8050a8, 0x251037], B: [0xf2a7a0, 0x4b1714]
  };
  const [color, emissive] = palette[element] || [0x8ca0a6, 0x102025];
  return new THREE.MeshPhysicalMaterial({ color, emissive, emissiveIntensity: .28, roughness: .25, metalness: .04 });
}

function chemistryAtomRadius(element) {
  return ({ H:.27, C:.46, N:.49, O:.49, F:.45, P:.58, S:.58, Cl:.58, Br:.62, I:.67, B:.5 })[element] || .48;
}

function ensureSmartMatterState(force = false) {
  if (state.selected?.visual !== "smartMatter") return null;
  const preset = state.values.smartMoleculePreset || "water";
  const seed = Number(state.values.smartMatterSeed || 61453);
  if (force || !state.smartMatter || state.smartMatter.preset !== preset || state.smartMatter.seed !== seed) {
    state.smartMatter = {
      preset, seed, plan:null, busy:false, running:false, startedAt:0,
      stage:"READY", visibleAtoms:0, bondedAtoms:0, formedBonds:0,
      message:"RDKit target graph is ready to be calculated"
    };
  }
  return state.smartMatter;
}

async function prepareSmartMatterPlan(startAfter = false) {
  const smart = ensureSmartMatterState();
  if (!smart || smart.busy) return;
  smart.busy = true;
  smart.running = false;
  smart.stage = "CALCULATING";
  smart.message = "RDKit: ETKDGv3 conformer and molecular graph…";
  renderInspector();
  setStatus("SMART MATTER · RDKit target calculation", true);
  try {
    const pagesDemo=location.hostname.endsWith('.github.io');
    const response = pagesDemo ? await fetch(`./assets/smart-matter/${encodeURIComponent(smart.preset)}.json`) : await fetch("./api/solve", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ model:"smartMatterAssembler", values:{
        chemistryAction:"smart-matter-plan",
        smartMoleculePreset:state.values.smartMoleculePreset,
        smartMatterSeed:state.values.smartMatterSeed
      }})
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || "Smart-matter backend error");
    smart.plan = payload.result.state;
    smart.precomputed = pagesDemo;
    smart.sequence = createAssembly(smart.plan.particles);
    smart.visibleAtoms = smart.bondedAtoms = smart.formedBonds = 0;
    smart.stage = "READY";
    smart.message = `${smart.plan.formula} · ${smart.plan.forceField} · graph ${smart.plan.checks.valid ? "PASS" : "FAIL"}`;
    state.solverResult = payload.result;
    state.solverMs = payload.elapsed_ms;
    rebuildSpecimen();
    renderMetrics();
    drawChart();
    if (startAfter) startSmartMatterAssembly();
    else setStatus(`SMART MATTER · ${smart.message}`, false);
  } catch (error) {
    smart.stage = "ERROR";
    smart.message = `Ошибка: ${error.message}`;
    setStatus(`SMART MATTER · ${error.message}`, false);
  } finally {
    smart.busy = false;
    renderInspector();
  }
}

function startSmartMatterAssembly() {
  const smart = ensureSmartMatterState();
  if (!smart?.plan) { void prepareSmartMatterPlan(true); return; }
  if (!smart.plan.checks?.valid) {
    smart.message = "Сборка заблокирована: целевой граф не прошёл проверки";
    renderInspector();
    return;
  }
  smart.running = true;
  smart.sequence = createAssembly(smart.plan.particles);
  startAssembly(smart.sequence);
  smart.startedAt = clock.elapsedTime;
  smart.stage = "MATERIALIZING";
  smart.visibleAtoms = 0;
  smart.bondedAtoms = 0;
  smart.formedBonds = 0;
  state.interaction = "smartMatterAssembly";
  state.interactionTime = 0;
  rebuildSpecimen();
  renderInspector();
  setStatus(`i < 0 · ${smart.plan.particles.length} smart-matter particles are outside visible 3D`, true);
}

function ensureSmartProteinRepairState(force = false) {
  if (state.selected?.visual !== "smartProteinRepair") return null;
  const signature = [state.values.repairProteinPreset, state.values.photonCount, state.values.photonEnergyMeV,
    state.values.exposure, state.values.damageIntensity, state.values.damageSeed].join("|");
  if (force || !state.smartProteinRepair || state.smartProteinRepair.signature !== signature) {
    state.smartProteinRepair = {
      signature, plan:null, busy:false, running:false, startedAt:0, stage:"ORIGINAL",
      visibleParticles:0, placedParticles:0, restoredBonds:0,
      message:"RCSB/RDKit reference graph is ready to be calculated"
    };
  }
  return state.smartProteinRepair;
}

async function prepareSmartProteinRepairPlan() {
  const repair = ensureSmartProteinRepairState();
  if (!repair || repair.busy) return;
  repair.busy = true;
  repair.running = false;
  repair.message = "RCSB 1CRN → RDKit molecular graph → damage and repair plan…";
  renderInspector();
  setStatus("PROTEIN REPAIR · calculating G₀, Gᴅ and Gʀ", true);
  try {
    const pagesDemo = location.hostname.endsWith('.github.io');
    const response = pagesDemo ? await fetch('./assets/pdb/protein-repair-demo.json') : await fetch("./api/solve", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ model:"smartMatterProteinRepair", values:{
        biomoleculeAction:"smart-matter-protein-repair",
        pdbId:state.values.repairProteinPreset,
        photonCount:state.values.photonCount,
        photonEnergyMeV:state.values.photonEnergyMeV,
        exposure:state.values.exposure,
        damageIntensity:state.values.damageIntensity,
        damageSeed:state.values.damageSeed
      }})
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || "Protein-repair backend error");
    repair.plan = payload.result.state;
    repair.precomputed = pagesDemo;
    repair.stage = "ORIGINAL";
    repair.message = `${repair.plan.reference.pdbId} · ${repair.plan.reference.atoms.length} atoms · G₀ ready`;
    state.solverResult = payload.result;
    state.solverMs = payload.elapsed_ms;
    rebuildSpecimen();
    renderMetrics();
    drawChart();
    setStatus(`PROTEIN REPAIR · ${repair.message}`, false);
  } catch (error) {
    repair.stage = "ERROR";
    repair.message = `Ошибка: ${error.message}`;
    setStatus(`PROTEIN REPAIR · ${error.message}`, false);
  } finally {
    repair.busy = false;
    renderInspector();
  }
}

function irradiateSmartProtein() {
  const repair = ensureSmartProteinRepairState();
  if (!repair?.plan) { void prepareSmartProteinRepairPlan(); return; }
  repair.running = true;
  repair.stage = "IRRADIATING";
  repair.startedAt = clock.elapsedTime;
  repair.visibleParticles = repair.placedParticles = repair.restoredBonds = 0;
  state.view = "damageGraph";
  repair.message = `${repair.plan.damageEvents.length} DamageEvent · ${repair.plan.damageReport.atomsMissing} atoms missing · ${repair.plan.damageReport.brokenBonds} bonds broken`;
  rebuildSpecimen();
  renderInspector();
  setStatus(`GAMMA DAMAGE · ${repair.message}`, false);
}

function releaseProteinRepairMatter() {
  const repair = ensureSmartProteinRepairState();
  if (!repair?.plan) { void prepareSmartProteinRepairPlan(); return; }
  if (repair.stage === "ORIGINAL") { irradiateSmartProtein(); return; }
  repair.running = true;
  repair.stage = "REPAIRING";
  state.view = "damageGraph";
  repair.startedAt = clock.elapsedTime;
  repair.visibleParticles = repair.placedParticles = repair.restoredBonds = 0;
  repair.message = `${repair.plan.repairPlan.requiredSmartMatterParticles} particles hidden at i < 0`;
  rebuildSpecimen();
  renderInspector();
  setStatus(`SMART MATTER RELEASE · ${repair.message}`, true);
}

function setProteinGraphState(stage) {
  const repair = ensureSmartProteinRepairState();
  if (!repair?.plan || !["ORIGINAL", "DAMAGED", "REPAIRED"].includes(stage)) return;
  repair.running = false;
  repair.stage = stage;
  state.view = stage === "DAMAGED" ? "damageGraph" : stage === "REPAIRED" ? "repairedGraph" : "structure";
  repair.message = stage === "ORIGINAL" ? "G₀ · experimental PDB reference"
    : stage === "DAMAGED" ? "Gᴅ · explicit damaged molecular graph"
    : "Gʀ · graph restored with Smart Matter substitutes";
  rebuildSpecimen();
  renderInspector();
}

function chemistryMapAtoms(fromAtoms, toAtoms) {
  const remaining = new Map();
  toAtoms.forEach((atom, index) => {
    if (!remaining.has(atom.element)) remaining.set(atom.element, []);
    remaining.get(atom.element).push(index);
  });
  const fromTo = fromAtoms.map((atom) => remaining.get(atom.element)?.shift());
  if (fromTo.some((index) => index === undefined)) return null;
  const toFrom = Array(toAtoms.length).fill(-1);
  fromTo.forEach((target, source) => { toFrom[target] = source; });
  return { fromTo, toFrom };
}

function addChemicalBond(points, a, b, order, material, radius, target) {
  const count = Math.max(1, Math.min(3, Math.round(Number(order || 1))));
  const direction = points[b].clone().sub(points[a]).normalize();
  const side = new THREE.Vector3(0, 1, 0).cross(direction);
  if (side.lengthSq() < .01) side.set(1, 0, 0);
  side.normalize();
  const bonds = [];
  for (let lane = 0; lane < count; lane += 1) {
    const shift = side.clone().multiplyScalar((lane - (count - 1) / 2) * .16);
    const link = tubeBetween(points[a].clone().add(shift), points[b].clone().add(shift), material, radius);
    specimen.add(link); fieldObjects.push(link); bonds.push({ object: link, a, b, shift });
  }
  if (target) target.push(...bonds);
  return bonds;
}

function createMoleculeLab() {
  const chemistry = ensureChemistryState();
  const reaction = chemistry?.reaction;
  const solved = ["quantum-chemistry", "chemistry-structure", "chemistry-mixture"].includes(state.solverResult?.kind) ? state.solverResult.state : null;
  const fallback = moleculePresets[state.values.moleculePreset] || (state.values.moleculePreset === "caffeine" ? moleculePresets.benzene : moleculePresets.water);
  if (reaction?.reactants?.atoms?.length) {
    const fromAtoms = reaction.reactants.atoms;
    const toAtoms = reaction.products.atoms;
    const mapping = chemistryMapAtoms(fromAtoms, toAtoms);
    if (!mapping) { chemistry.message = "Шаблон не сбалансирован по атомам"; return; }
    const centreFrom = fromAtoms.reduce((sum, atom) => sum.add(new THREE.Vector3(atom.x, atom.y, atom.z)), new THREE.Vector3()).multiplyScalar(1 / fromAtoms.length);
    const centreTo = toAtoms.reduce((sum, atom) => sum.add(new THREE.Vector3(atom.x, atom.y, atom.z)), new THREE.Vector3()).multiplyScalar(1 / toAtoms.length);
    const scale = fromAtoms.length > 18 ? .72 : fromAtoms.length > 10 ? .9 : 1.14;
    const fromPoints = fromAtoms.map((atom) => new THREE.Vector3(atom.x, atom.y, atom.z).sub(centreFrom).multiplyScalar(scale));
    const toPoints = fromAtoms.map((_, index) => {
      const atom = toAtoms[mapping.fromTo[index]];
      return new THREE.Vector3(atom.x, atom.y, atom.z).sub(centreTo).multiplyScalar(scale);
    });
    const atomMeshes = fromAtoms.map((atom, index) => {
      const sphere = makeSphere(chemistryAtomRadius(atom.element), chemistryElementMaterial(atom.element), fromPoints[index].toArray(), 28);
      tagComponent(sphere, "chemicalAtom", { element:atom.element, atomIndex:index + 1 });
      specimen.add(sphere); primaryParticles.push(sphere); return sphere;
    });
    const reactantMaterial = new THREE.MeshPhysicalMaterial({ color:0x8bdce6, transparent:true, opacity:.82, roughness:.25 });
    const productMaterial = new THREE.MeshPhysicalMaterial({ color:0xf3c862, transparent:true, opacity:0, roughness:.25 });
    const reactantBonds = [];
    reaction.reactants.bonds.forEach(([a,b,order]) => addChemicalBond(fromPoints, a, b, order, reactantMaterial, .065, reactantBonds));
    const productBonds = [];
    reaction.products.bonds.forEach(([a,b,order]) => addChemicalBond(toPoints, mapping.toFrom[a], mapping.toFrom[b], order, productMaterial, .07, productBonds));
    animated.push({ type:"chemistryReaction", atomMeshes, fromPoints, toPoints, reactantBonds, productBonds,
                    reactantMaterial, productMaterial, startedAt:reaction.startedAt, running:reaction.running, chemistry });
    createShell(Math.max(5.2, 3.5 + fromAtoms.length * .09), 3);
    return;
  }
  const display = chemistry?.display || solved;
  const atoms = display?.atoms?.map((atom) => [atom.element, atom.x, atom.y, atom.z]) || fallback.atoms;
  const bonds = display?.bonds?.map((bond) => [bond[0], bond[1], bond[2] || 1]) || fallback.bonds.map((bond) => [bond[0], bond[1], 1]);
  const centre = atoms.reduce((sum, atom) => sum.add(new THREE.Vector3(atom[1], atom[2], atom[3])), new THREE.Vector3()).multiplyScalar(1 / atoms.length);
  const scale = atoms.length > 24 ? .72 : atoms.length > 12 ? .92 : atoms.length > 8 ? 1.15 : 1.55;
  const points = atoms.map((atom) => new THREE.Vector3(atom[1], atom[2], atom[3]).sub(centre).multiplyScalar(scale));
  const bondMaterial = new THREE.MeshPhysicalMaterial({ color:0x8bb6bf, transparent:true, opacity:.78, roughness:.25 });
  bonds.forEach(([a,b,order]) => addChemicalBond(points, a, b, order, bondMaterial, .07));
  atoms.forEach((atom, index) => {
    const sphere = makeSphere(chemistryAtomRadius(atom[0]), chemistryElementMaterial(atom[0]), points[index].toArray(), 28);
    tagComponent(sphere, "chemicalAtom", { element:atom[0], atomIndex:index + 1 });
    specimen.add(sphere); primaryParticles.push(sphere);
    animated.push({ type:"jitter", object:sphere, base:points[index].clone(), phase:index*.71, speed:.18 });
  });
  createShell(Math.max(3.5, 2.5 + atoms.length * .12), 3);
}

function createSmartMatterLab() {
  const smart = ensureSmartMatterState();
  const boundary = new THREE.Group();
  const slice = new THREE.Mesh(
    new THREE.SphereGeometry(7.1, 34, 22),
    new THREE.MeshBasicMaterial({ color:0x38d8ea, transparent:true, opacity:.035, wireframe:true, depthWrite:false })
  );
  const iAxis = new THREE.ArrowHelper(new THREE.Vector3(0,1,0), new THREE.Vector3(-6.3,-3.1,-5.1), 2.25, 0xee72d5, .28, .16);
  boundary.add(slice, iAxis);
  specimen.add(boundary);
  fieldObjects.push(slice, iAxis);
  if (!smart?.plan?.particles?.length) {
    const marker = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, .035, 8, 96),
      new THREE.MeshBasicMaterial({ color:0x66e9f5, transparent:true, opacity:.32 })
    );
    marker.rotation.x = Math.PI / 2;
    specimen.add(marker);
    animated.push({ type:"ring", object:marker, phase:0, speed:.12 });
    setStatus(smart?.busy ? "RDKIT · calculating target graph" : "SMART MATTER · calculate a target graph to begin", Boolean(smart?.busy));
    return;
  }

  const plan = smart.plan;
  const targetScale = plan.particles.length > 18 ? .82 : plan.particles.length > 10 ? 1.08 : 1.55;
  const startScale = plan.particles.length > 18 ? .72 : .84;
  const targetPoints = plan.particles.map((particle) => new THREE.Vector3(
    particle.targetPosition.x, particle.targetPosition.y, particle.targetPosition.z
  ).multiplyScalar(targetScale));
  const startPoints = plan.particles.map((particle) => new THREE.Vector3(
    particle.position.x, particle.position.y, particle.position.z
  ).multiplyScalar(startScale));

  const guide = new THREE.Group();
  guide.userData.ownsVisibility = true;
  const guideOpacity = Number(state.values.smartTargetOpacity ?? .18);
  const guideMaterial = new THREE.MeshBasicMaterial({ color:0x4bd9e9, transparent:true, opacity:guideOpacity, wireframe:true, depthWrite:false });
  targetPoints.forEach((point, index) => {
    const atom = plan.particles[index];
    const ghost = new THREE.Mesh(new THREE.SphereGeometry(chemistryAtomRadius(atom.assignedElement) * .92, 14, 10), guideMaterial);
    ghost.position.copy(point);
    guide.add(ghost);
  });
  plan.constructionOrder.forEach(([a,b]) => {
    const link = tubeBetween(targetPoints[a], targetPoints[b], guideMaterial, .018);
    guide.add(link);
  });
  specimen.add(guide);
  fieldObjects.push(guide);

  const neutralMaterial = new THREE.MeshPhysicalMaterial({ color:0x8ba8ae, emissive:0x163c43, emissiveIntensity:.42, roughness:.28, metalness:.08, transparent:true, opacity:.96 });
  const atomMeshes = plan.particles.map((particle, index) => {
    const material = neutralMaterial.clone();
    const targetMaterial = chemistryElementMaterial(particle.assignedElement);
    const mesh = makeSphere(chemistryAtomRadius(particle.assignedElement), material, startPoints[index].toArray(), 28);
    mesh.visible = false;
    mesh.userData.iPosition = particle.position.i;
    mesh.userData.ownsVisibility = true;
    mesh.userData.smartState = "FREE";
    tagComponent(mesh, "smartMatterParticle", {
      smartMatterId:particle.id, targetAtom:index + 1, assignedElement:particle.assignedElement,
      effectiveMass:particle.effectiveMass, formalCharge:particle.formalCharge,
      valence:particle.valence, capacity:particle.capacity, initialI:particle.position.i
    });
    specimen.add(mesh);
    primaryParticles.push(mesh);
    const path = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([startPoints[index], targetPoints[index]]),
      new THREE.LineDashedMaterial({ color:0x74cad4, transparent:true, opacity:.2, dashSize:.16, gapSize:.13, depthWrite:false })
    );
    path.computeLineDistances();
    path.visible = false;
    specimen.add(path);
    return { mesh, material, targetMaterial, neutralColor:material.color.clone(), path };
  });

  const bondMaterial = new THREE.MeshPhysicalMaterial({ color:0xcceef1, transparent:true, opacity:.88, roughness:.24 });
  const bonds = [];
  plan.constructionOrder.forEach(([a,b,order]) => {
    const entries = [];
    const count = Math.max(1, Math.min(3, Math.round(Number(order || 1))));
    const direction = targetPoints[b].clone().sub(targetPoints[a]).normalize();
    const side = new THREE.Vector3(0,1,0).cross(direction);
    if (side.lengthSq() < .01) side.set(1,0,0);
    side.normalize();
    for (let lane=0; lane<count; lane+=1) {
      const shift = side.clone().multiplyScalar((lane - (count - 1) / 2) * .16);
      const link = tubeBetween(targetPoints[a].clone().add(shift), targetPoints[b].clone().add(shift), bondMaterial.clone(), .065);
      link.visible = false;
      link.userData.ownsVisibility = true;
      specimen.add(link);
      fieldObjects.push(link);
      entries.push(link);
    }
    bonds.push({ a, b, order, entries });
  });
  const assembly = { type:"smartMatterAssembly", smart, atomMeshes, bonds, startPoints, targetPoints, guide };
  smart.sequence ||= createAssembly(plan.particles);
  animated.push(assembly);
  renderSmartAssembly(assembly);
  setStatus(smart.running ? `i < 0 · ${plan.particles.length} particles hidden outside visible 3D` : `RDKit TARGET · ${plan.formula} · ${plan.forceField}`, smart.running);
}

function createSmartProteinRepairLab() {
  const repair = ensureSmartProteinRepairState();
  const chamber = new THREE.Mesh(
    new THREE.SphereGeometry(7.5, 32, 20),
    new THREE.MeshBasicMaterial({ color:0x3fd9eb, transparent:true, opacity:.025, wireframe:true, depthWrite:false })
  );
  specimen.add(chamber);
  fieldObjects.push(chamber);
  if (!repair?.plan?.reference?.atoms?.length) {
    const rings = new THREE.Group();
    for (let index=0; index<4; index+=1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4 + index*.72, .025, 6, 96), new THREE.MeshBasicMaterial({ color:0x59dbe8, transparent:true, opacity:.18 }));
      ring.rotation.x = Math.PI/2;
      rings.add(ring);
    }
    specimen.add(rings);
    animated.push({ type:"ring", object:rings, phase:0, speed:.08 });
    return;
  }
  const plan = repair.plan;
  const referenceAtoms = plan.reference.atoms;
  const centre = referenceAtoms.reduce((sum, atom) => sum.add(new THREE.Vector3(atom.x, atom.y, atom.z)), new THREE.Vector3()).multiplyScalar(1/referenceAtoms.length);
  const extents = referenceAtoms.reduce((max, atom) => Math.max(max, new THREE.Vector3(atom.x, atom.y, atom.z).distanceTo(centre)), 1);
  const proteinScale = Math.min(.48, 5.7/extents);
  const pointFor = (atom) => new THREE.Vector3(atom.x, atom.y, atom.z).sub(centre).multiplyScalar(proteinScale);
  const referencePoints = referenceAtoms.map(pointFor);
  const graph = ["ORIGINAL","IRRADIATING"].includes(repair.stage) ? { atoms:plan.reference.atoms, bonds:plan.reference.bonds }
    : repair.stage === "REPAIRED" ? plan.repaired : plan.damaged;
  const atomById = new Map(graph.atoms.map((atom) => [Number(atom.id), atom]));
  const atomMeshes = new Map();
  graph.atoms.forEach((atom) => {
    const point = pointFor(atom);
    const present = atom.present !== false;
    if (!present) {
      const ghost = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(.1, chemistryAtomRadius(atom.element)*.38), 10, 8),
        new THREE.MeshBasicMaterial({ color:0xff4f78, transparent:true, opacity:.42, wireframe:true, depthWrite:false })
      );
      ghost.position.copy(referencePoints[Number(atom.id)]);
      ghost.userData.missingAtom = Number(atom.id);
      specimen.add(ghost);
      atomMeshes.set(Number(atom.id), ghost);
      return;
    }
    const material = chemistryElementMaterial(atom.element);
    if (atom.damaged) {
      material.emissive.setHex(0x8d1738);
      material.emissiveIntensity = .9;
    }
    const mesh = makeSphere(Math.max(.1, chemistryAtomRadius(atom.element)*.38), material, point.toArray(), 12);
    tagComponent(mesh, "proteinAtom", { atomId:Number(atom.id), element:atom.element, atomName:atom.atomName, residue:`${atom.residueName} ${atom.residueNumber}`, chain:atom.chain, damaged:Boolean(atom.damaged), smartMatter:Boolean(atom.smartMatter) });
    specimen.add(mesh);
    primaryParticles.push(mesh);
    atomMeshes.set(Number(atom.id), mesh);
    if (repair.stage === "REPAIRED" && atom.smartMatter && state.values.showSmartMatter !== "off") {
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(.15, chemistryAtomRadius(atom.element)*.53), 12, 8),
        new THREE.MeshBasicMaterial({ color:0xee72d5, transparent:true, opacity:.32, wireframe:true, depthWrite:false })
      );
      halo.position.copy(point);
      specimen.add(halo);
      animated.push({ type:"pulse", object:halo, phase:Number(atom.id)*.31, speed:1.4 });
    }
  });
  const brokenLines = [];
  const allProteinLines = [];
  graph.bonds.forEach((bond) => {
    const a = atomById.get(Number(bond.a));
    const b = atomById.get(Number(bond.b));
    if (!a || !b) return;
    const broken = Boolean(bond.broken || a.present === false || b.present === false);
    const material = broken
      ? new THREE.LineDashedMaterial({ color:0xff4f78, transparent:true, opacity:.72, dashSize:.09, gapSize:.08, depthWrite:false })
      : new THREE.LineBasicMaterial({ color:0xb8d9df, transparent:true, opacity:.5, depthWrite:false });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([referencePoints[Number(bond.a)], referencePoints[Number(bond.b)]]), material);
    if (broken) line.computeLineDistances();
    specimen.add(line);
    allProteinLines.push({line,a:Number(bond.a),b:Number(bond.b)});
    fieldObjects.push(line);
    if (broken) brokenLines.push(line);
  });
  if (repair.stage === "DAMAGED" || repair.stage === "REPAIRING") {
    plan.damageEvents.forEach((event, index) => {
      const atomId = Number(event.affectedAtomIds?.[0]);
      const marker = new THREE.Mesh(
        new THREE.TorusGeometry(.2 + (index%3)*.025, .018, 6, 30),
        new THREE.MeshBasicMaterial({ color:0xff5b7e, transparent:true, opacity:.78, depthWrite:false })
      );
      marker.position.copy(referencePoints[atomId]);
      marker.lookAt(camera.position);
      specimen.add(marker);
      animated.push({ type:"pulse", object:marker, phase:index*.37, speed:1.2 });
    });
  }
  if (repair.stage === "REPAIRING") {
    const particleEntries = plan.repairPlan.particles.map((particle, index) => {
      const target = referencePoints[Number(particle.targetAtom)].clone();
      const start = new THREE.Vector3(particle.position.x, particle.position.y, particle.position.z).sub(centre).multiplyScalar(proteinScale);
      const material = chemistryElementMaterial(particle.assignedElement);
      material.emissive.setHex(0xa31589);
      material.emissiveIntensity = .95;
      const mesh = makeSphere(Math.max(.1, chemistryAtomRadius(particle.assignedElement)*.38), material, start.toArray(), 12);
      mesh.visible = false;
      mesh.userData.iPosition = particle.position.i;
      tagComponent(mesh, "smartMatterProteinSubstitute", { smartMatterId:particle.id, targetAtom:particle.targetAtom, element:particle.assignedElement, residue:`${particle.residue.name} ${particle.residue.number}`, initialI:particle.position.i });
      specimen.add(mesh);
      primaryParticles.push(mesh);
      const path = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([start, target]),
        new THREE.LineDashedMaterial({ color:0xee72d5, transparent:true, opacity:.25, dashSize:.12, gapSize:.1, depthWrite:false })
      );
      path.computeLineDistances();
      path.visible = false;
      specimen.add(path);
      return { mesh, path, start, target, particle, ghost:atomMeshes.get(Number(particle.targetAtom)) };
    });
    animated.push({ type:"smartProteinRepair", repair, entries:particleEntries, brokenLines, finished:false });
  }
  if (repair.stage === "IRRADIATING") {
    const entries = plan.repairPlan.particles.map((particle,index) => {
      const target=referencePoints[Number(particle.targetAtom)].clone();
      const material=chemistryElementMaterial(particle.assignedElement);
      material.transparent=true;material.opacity=0;material.emissive.setHex(0x892778);
      const replacement=makeSphere(Math.max(.1,chemistryAtomRadius(particle.assignedElement)*.38),material,target.toArray(),12);
      replacement.visible=false;specimen.add(replacement);
      const photon=makeSphere(.07,new THREE.MeshBasicMaterial({color:0xffe79a}),[-12,target.y,target.z],8);
      specimen.add(photon);
      const beam=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-12,target.y,target.z),target]),new THREE.LineBasicMaterial({color:0xffcb6a,transparent:true,opacity:.22}));
      specimen.add(beam);
      return {particle,target,replacement,photon,beam,original:atomMeshes.get(Number(particle.targetAtom))};
    });
    // Non-absorbed photons form a visible side stream. These are context
    // markers, not an additional radiation-transport calculation.
    const stream=Array.from({length:Math.min(240,Number(state.values.photonCount)||72)},(_,j)=>{
      const photon=makeSphere(.045,new THREE.MeshBasicMaterial({color:0xffe79a}),[-12,Math.sin(j*2.399)*5,Math.cos(j*1.713)*5],6);
      specimen.add(photon);return {photon,start:j*.025};
    });
    animated.push({type:'gammaProteinRepair',repair,entries,stream,lines:allProteinLines,finished:false});
  }
  const label = repair.stage === "ORIGINAL" ? "G₀ · RCSB experimental structure"
    : repair.stage === "IRRADIATING" ? "γ → impact → i→3D · continuous repair"
    : repair.stage === "DAMAGED" ? "Gᴅ · radiation-damage graph"
    : repair.stage === "REPAIRING" ? "i→3D · Smart Matter repair"
    : "Gʀ · restored molecular graph";
  setStatus(`PROTEIN REPAIR · ${label}`, repair.stage === "REPAIRING");
}

function createSemiconductorLab() {
  const body = new THREE.Group();
  const pMat = new THREE.MeshPhysicalMaterial({ color:0xee72d5, transparent:true, opacity:.54, roughness:.32 });
  const nMat = new THREE.MeshPhysicalMaterial({ color:0x3dd4e7, transparent:true, opacity:.54, roughness:.32 });
  const iMat = new THREE.MeshPhysicalMaterial({ color:0xf3d87b, transparent:true, opacity:.32, roughness:.32 });
  const topology = state.values.deviceTopology || "pn";
  const layers = topology === "pin" ? [["p",-3.15,2.7],["i",0,3.6],["n",3.15,2.7]] : topology === "npn" ? [["n",-3.3,2.4],["p",0,4.2],["n",3.3,2.4]] : [["p",-2.25,4.5],["n",2.25,4.5]];
  layers.forEach(([type,x,width]) => { const layer=new THREE.Mesh(new THREE.BoxGeometry(width,2.8,3.4),type==="p"?pMat:type==="n"?nMat:iMat); layer.position.x=x; body.add(layer); });
  for (let side=-1; side<=1; side+=2) for (let i=0;i<28;i+=1) {
    const point = new THREE.Vector3(side*(.35+(i%7)*.55),-1.05+Math.floor(i/7)*.68,-.95+(i%3)*.92);
    body.add(makeSphere(.085,side<0?mats.pion:mats.electron,point.toArray(),10));
  }
  const depletion = new THREE.Mesh(new THREE.BoxGeometry(topology === "pin" ? 3.7 : .72,3.05,3.65),new THREE.MeshBasicMaterial({color:0xf3d87b,transparent:true,opacity:.16,depthWrite:false}));
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(-1,0,0),new THREE.Vector3(1.7,0,1.9),3.4,0xf2bf5b,.32,.18);
  body.add(depletion,arrow); body.rotation.x=-.18; specimen.add(body); primaryParticles.push(body); fieldObjects.push(depletion,arrow);
}

function createMultiquark(model) {
  createShell(3.35, 4);
  const positions = [
    new THREE.Vector3(-1.35, 0, 0), new THREE.Vector3(1.35, 0, 0),
    new THREE.Vector3(0, -1.35, 0), new THREE.Vector3(0, 1.35, 0),
    new THREE.Vector3(0, 0, -1.35), new THREE.Vector3(0, 0, 1.35)
  ];
  model.composition.forEach((flavor, index) => {
    const material = flavor === "s" ? mats.strange : index % 2 ? mats.green : mats.red;
    const group = new THREE.Group();
    const sphere = makeSphere(flavor === "s" ? .58 : .52, material, [0, 0, 0], 24);
    const label = labelSprite(flavor, flavor === "s" ? "#ee72d5" : "#65dca3", .5);
    label.position.z = .62;
    group.add(sphere, label);
    tagComponent(group, flavor === "u" ? "upQuark" : flavor === "d" ? "downQuark" : "strangeQuark", { flavor, index });
    group.position.copy(positions[index]);
    specimen.add(group);
    primaryParticles.push(group);
    animated.push({ type: "quark", object: group, phase: index * .9, base: positions[index].clone() });
  });
  for (let i = 0; i < positions.length; i += 1) {
    const link = tubeBetween(positions[i], positions[(i + 2) % positions.length], mats.flux, .035);
    specimen.add(link);
    fieldObjects.push(link);
  }
}

function createMeson(model) {
  const composition = model.composition || ["u", "dbar"];
  const leftFlavor = composition[0];
  const rightFlavor = composition.find((flavor, index) => index > 0 && (model.id === "scalarGlueball" || flavor !== "g")) || composition[1] || "dbar";
  const worldSeparation = clamp(state.values.separation || .8, .1, 4.5) * 1.7;
  const leftBase = new THREE.Vector3(-worldSeparation / 2, 0, 0);
  const rightBase = new THREE.Vector3(worldSeparation / 2, 0, 0);
  const left = createFlavorParticle(leftFlavor, leftBase);
  const right = createFlavorParticle(rightFlavor, rightBase);
  specimen.add(left, right);
  primaryParticles.push(left, right);

  const stringMaterial = new THREE.MeshPhysicalMaterial({ color: 0x56d8e7, emissive: 0x0b5260, emissiveIntensity: .8, transparent: true, opacity: .64, roughness: .24, metalness: .1 });
  const string = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 1, 18, 1, false), stringMaterial);
  tagComponent(string, "mesonFluxString", { parent: model.id });
  orientCylinderBetween(string, leftBase, rightBase);
  specimen.add(string);
  fieldObjects.push(string);

  const fieldShell = new THREE.Mesh(
    new THREE.CapsuleGeometry(.82, Math.max(.1, worldSeparation - 1.2), 8, 24),
    new THREE.MeshPhysicalMaterial({ color: 0x2ab8c9, transparent: true, opacity: .09, roughness: .18, transmission: .18, depthWrite: false })
  );
  fieldShell.rotation.z = Math.PI / 2;
  fieldShell.userData.fieldRole = "flux";
  tagComponent(fieldShell, "mesonFluxString", { envelope: true });
  specimen.add(fieldShell);
  fieldObjects.push(fieldShell);

  let gluonicMode = null;
  if (composition.includes("g") || model.id === "scalarGlueball") {
    gluonicMode = makeSphere(model.id === "scalarGlueball" ? 1.25 : .78, mats.flux, [0, .6, 0], 24);
    gluonicMode.material = new THREE.MeshPhysicalMaterial({ color: 0x5de8f4, emissive: 0x0c5660, emissiveIntensity: .8, transparent: true, opacity: .38, wireframe: true });
    tagComponent(gluonicMode, "gluonField", { excitation: model.id });
    specimen.add(gluonicMode);
    fieldObjects.push(gluonicMode);
    animated.push({ type: "ring", object: gluonicMode, phase: 0, speed: .22 });
  }

  mesonVisual = { left, right, string, fieldShell, leftBase, rightBase, worldSeparation, gluonicMode };
  animated.push({ type: "mesonIdle", object: string, phase: 0 });
}

function createColliderBeamParticle(x, direction, particleId = "proton") {
  const group = new THREE.Group();
  const baryon = BARYON_BEAMS[particleId];
  const hadron = Boolean(baryon) || ["pionPlus", "pionMinus"].includes(particleId);
  const componentId = particleId === "antiproton" ? "antiproton" : particleId.startsWith("pion") ? "pion" : particleId === "positron" ? "positron" : particleId.startsWith("muon") ? "muon" : particleId;
  if (particleId === "photon") {
    const core = makeSphere(.19, mats.photon, [0, 0, 0], 16);
    group.add(core);
    for (let i = 0; i < 3; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.3 + i * .12, .025, 8, 40), new THREE.MeshBasicMaterial({ color: 0xf7c652, transparent: true, opacity: .82 - i * .18 }));
      ring.rotation.y = Math.PI / 2;
      group.add(ring);
    }
  } else if (hadron) {
    const anti = particleId.startsWith("anti");
    const shellColor = anti ? 0xee72d5 : particleId === "pionPlus" ? 0x63df9b : particleId === "pionMinus" ? 0x6da2ff : particleId === "hyperon" ? 0x9b70e4 : 0xf0ba55;
    const shellRadius = particleId.startsWith("pion") ? .48 : .62;
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(shellRadius, 2), new THREE.MeshPhysicalMaterial({ color: shellColor, transparent: true, opacity: .2, roughness: .25, transmission: .1, depthWrite: false }));
    group.add(shell);
    const offsets = particleId.startsWith("pion") ? [[-.16, .12, 0], [.16, -.12, 0]] : [[-.2, .2, .12], [.22, .12, -.18], [0, -.26, .1]];
    offsets.forEach((offset, index) => {
      const flavor = baryon?.[1][index];
      group.add(makeSphere(.18, flavor?.startsWith("s") ? mats.strange : [mats.red, mats.green, mats.blue][index], offset, 14));
    });
  } else {
    const color = particleId === "electron" ? 0x6da2ff : particleId === "positron" ? 0xf2bf5b : particleId === "muonMinus" ? 0x7c86ff : 0xee72d5;
    const radius = particleId.startsWith("muon") ? .32 : .25;
    group.add(makeSphere(radius, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .28, roughness: .24 }), [0, 0, 0], 18));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.55, .025, 8, 44), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .72 }));
    ring.rotation.y = Math.PI / 2;
    group.add(ring);
  }
  group.position.set(x, 0, 0);
  group.rotation.z = direction < 0 ? Math.PI : 0;
  tagComponent(group, componentId, { beam: direction > 0 ? "A" : "B", particleId });
  specimen.add(group);
  primaryParticles.push(group);
  return group;
}

function createCollider(model) {
  const detector = new THREE.Group();
  const layers = [
    [2.1, 0x40d4e6, .32],
    [3.15, 0xf1b450, .24],
    [4.2, 0x6d90ff, .2],
    [5.15, 0xee72d5, .17]
  ];
  layers.forEach(([radius, color, opacity], index) => {
    const cylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 12.5, 64, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, wireframe: true, depthWrite: false, side: THREE.DoubleSide })
    );
    cylinder.rotation.z = Math.PI / 2;
    tagComponent(cylinder, "colliderDetector", { layer: index + 1 });
    // The transparent detector is a visual aid, not an event product.  Keep it
    // out of the picking path so it cannot hide a track behind it.
    cylinder.userData.pickable = false;
    detector.add(cylinder);
    for (const x of [-5.2, -3.2, 0, 3.2, 5.2]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .025, 6, 96), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacity * 1.4 }));
      ring.rotation.y = Math.PI / 2;
      ring.position.x = x;
      detector.add(ring);
    }
  });
  specimen.add(detector);
  const collision = state.collisionContext;
  const beamA = collision?.beamA || (model.id === "colliderWorkbench" ? state.values.beamA : "proton");
  const beamB = collision?.beamB || (model.id === "colliderWorkbench" ? state.values.beamB : "proton");
  const leftBeam = createColliderBeamParticle(-8, 1, beamA);
  const rightBeam = createColliderBeamParticle(8, -1, beamB);
  const vertex = makeSphere(.15, mats.boson, [0, 0, 0], 18);
  tagComponent(vertex, "colliderDetector", { layer: "interaction point" });
  vertex.userData.pickable = false;
  specimen.add(vertex);
  colliderVisual = { detector, leftBeam, rightBeam, vertex, beamA, beamB };
  applyParameterDrivenVisuals();
}

function createQuarkMedium(model) {
  createShell(model.visual === "strangelet" ? 2.75 : 3.65, model.visual === "strangelet" ? 4 : 2);
  const count = model.visual === "strangelet" ? clamp(Math.round((state.values.baryonNumber || 72) / 3), 18, 72) : 54;
  const paired = model.visual === "pairedMatter" || Boolean(model.pairing);
  const positions = [];
  for (let i = 0; i < count; i += 1) {
    const maxR = model.visual === "strangelet" ? 2.4 : 3.15;
    const radius = Math.cbrt(Math.random()) * maxR;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(rand(-1, 1));
    const p = new THREE.Vector3(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
    positions.push(p);
    const flavorIndex = i % 3;
    const material = flavorIndex === 2 ? mats.strange : (i % 2 ? mats.green : mats.red);
    const mesh = makeSphere(model.visual === "strangelet" ? .2 : .16, material, p.toArray(), 14);
    tagComponent(mesh, flavorIndex === 2 ? "strangeQuark" : i % 2 ? "downQuark" : "upQuark", { phase: model.title, index: i });
    specimen.add(mesh);
    primaryParticles.push(mesh);
    animated.push({ type: model.visual === "quarkFluid" ? "fluid" : "jitter", object: mesh, base: p.clone(), phase: Math.random() * 8, speed: rand(.7, 1.5) });
  }
  if (paired) {
    for (let i = 0; i + 1 < positions.length; i += 2) {
      const pairMat = new THREE.MeshBasicMaterial({ color: model.pairing === "CFL" ? 0xee72d5 : 0x6da2ff, transparent: true, opacity: .36 });
      const link = tubeBetween(positions[i], positions[i + 1], pairMat, .025);
      link.userData.fieldRole = "pair";
      tagComponent(link, "cooperPair", { pairing: model.pairing || "paired" });
      specimen.add(link);
      fieldObjects.push(link);
    }
  } else if (model.visual !== "strangelet") {
    for (let i = 0; i < 14; i += 1) {
      const a = positions[Math.floor(Math.random() * positions.length)];
      const b = positions[Math.floor(Math.random() * positions.length)];
      const link = tubeBetween(a, b, new THREE.MeshBasicMaterial({ color: 0x55cfe2, transparent: true, opacity: .13 }), .018);
      specimen.add(link);
      fieldObjects.push(link);
    }
  }
}

function helixPoints(startX, endX, radius, turns, phase = 0) {
  const pts = [];
  for (let i = 0; i <= 160; i += 1) {
    const t = i / 160;
    const a = phase + turns * Math.PI * 2 * t;
    pts.push(new THREE.Vector3(THREE.MathUtils.lerp(startX, endX, t), Math.cos(a) * radius, Math.sin(a) * radius));
  }
  return pts;
}

function createNeutrinoLens() {
  const lens = new THREE.Mesh(new THREE.IcosahedronGeometry(2.55, 5), mats.lens);
  tagComponent(lens, "lensMedium");
  specimen.add(lens);
  currentShell = lens;
  for (let i = 0; i < 3; i += 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.9 + i * .27, .028, 8, 100), new THREE.MeshBasicMaterial({ color: i === 1 ? 0xee72d5 : 0x4fd8e8, transparent: true, opacity: .42 }));
    ring.rotation.set(i * .66, .6 + i * .45, .2);
    specimen.add(ring);
    animated.push({ type: "ring", object: ring, phase: i, speed: .16 + i * .04 });
    fieldObjects.push(ring);
  }
  const inLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(helixPoints(-9, -2.45, .16, 3)), new THREE.LineBasicMaterial({ color: 0x54d8ff, transparent: true, opacity: .72 }));
  const coreLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(helixPoints(-2.4, 2.4, .22, 5)), new THREE.LineBasicMaterial({ color: 0xd9f9ff, transparent: true, opacity: .85 }));
  const outLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(helixPoints(2.45, 9, .32, 7, Math.PI / 2)), new THREE.LineBasicMaterial({ color: 0xee72d5, transparent: true, opacity: .84 }));
  specimen.add(inLine, coreLine, outLine);
  fieldObjects.push(inLine, coreLine, outLine);
  const neutrino = makeSphere(.18, mats.neutrino, [-8.5, 0, 0], 16);
  tagComponent(neutrino, "neutrino");
  specimen.add(neutrino);
  primaryParticles.push(neutrino);
  animated.push({ type: "beam", object: neutrino, phase: 0, speed: 1 });
  const bloch = new THREE.Group();
  bloch.position.set(0, 0, 0);
  const blochShell = new THREE.Mesh(new THREE.SphereGeometry(1.18, 24, 16), new THREE.MeshBasicMaterial({ color: 0x0f5360, transparent: true, opacity: .09, wireframe: true }));
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1.65, 0xf2bf5b, .26, .14);
  bloch.add(blochShell, arrow);
  specimen.add(bloch);
  animated.push({ type: "bloch", object: arrow, phase: 0 });
}

function rebuildSpecimen() {
  disposeGroup(specimen);
  disposeGroup(effects);
  disposeGroup(fieldLayer);
  animated = [];
  primaryParticles = [];
  fieldObjects = [];
  currentShell = null;
  mesonVisual = null;
  colliderVisual = null;
  const model = state.selected;
  if (isBaryonModel(model) && state.collisionContext) createCollider(model);
  else if (isBaryonModel(model) && state.view === "confinement") createConfinementDemo(model);
  else if (model.visual === "baryon") createBaryon(model);
  else if (model.visual === "lepton") createLepton(model);
  else if (model.visual === "atom") createAtom(model);
  else if (model.visual === "complexSpin") createComplexSpinQuasiparticle();
  else if (model.visual === "standingWaveCore") createGravitationalStandingWaveCore();
  else if (model.visual === "polytope4d") createTesseract();
  else if (model.id === "blackHole" && state.view === "blackHoleMerger") createBlackHoleMerger();
  else if (model.visual === "resonantTriple") createResonantTripleHypothesis();
  else if (model.visual === "mOrchestrator") mOrchestrator.build();
  else if (model.visual === "macro") createMacroObject(model);
  else if (model.visual === "denseBaryons") createDenseBaryons();
  else if (model.visual === "hybridMatter") createHybridMatter(model);
  else if (model.visual === "condensateMatter") createCondensateMatter(model);
  else if (model.visual === "crystalMatter") createCrystalMatter(model);
  else if (model.visual === "molecule") createMoleculeLab();
  else if (model.visual === "smartMatter") createSmartMatterLab();
  else if (model.visual === "smartProteinRepair") createSmartProteinRepairLab();
  else if (model.visual === "semiconductor") createSemiconductorLab();
  else if (model.visual === "biomolecule") { /* Mol* owns the central biomolecular canvas. */ }
  else if (model.visual === "multiquark") createMultiquark(model);
  else if (model.visual === "meson") createMeson(model);
  else if (model.visual === "collider") createCollider(model);
  else if (["quarkFluid", "strangeMatter", "pairedMatter", "strangelet"].includes(model.visual)) createQuarkMedium(model);
  else if (model.visual === "neutrinoLens") createNeutrinoLens();
  const cleanMacroStage = model.visual === "mOrchestrator" || model.visual === "macro" || model.visual === "resonantTriple" || model.visual === "biomolecule" || model.visual === "smartMatter" || model.visual === "smartProteinRepair";
  const colliderMode = model.visual === "collider" || Boolean(state.collisionContext && isBaryonModel(model));
  platform.visible = !colliderMode && !cleanMacroStage;
  platformRing.visible = !colliderMode && !cleanMacroStage;
  chamberRings.visible = !colliderMode && !cleanMacroStage;
  applyViewMode();
  applyParameterDrivenVisuals();
  hideComponentInfo();
}

function initializeValues(model) {
  state.values = Object.fromEntries(model.parameters.map((parameter) => [parameter.key, parameter.value]));
}

function colliderProcessOptions(values) {
  const automatic = [["auto", "Авто · по типам пучков"]];
  const hadrons = new Set([...Object.keys(BARYON_BEAMS), "pionPlus", "pionMinus"]);
  const leptons = new Set(["electron", "positron", "muonMinus", "muonPlus"]);
  const a = values.beamA;
  const b = values.beamB;
  if (hadrons.has(a) && hadrons.has(b)) return [...automatic, ...(BARYON_PARTNERS[a] === b ? [["annihilation", "Baryon–antibaryon annihilation"]] : []), ["softQCD", "Soft QCD / minimum-bias"], ["hardQCD", "Hard QCD / dijet"]];
  if ((leptons.has(a) && hadrons.has(b)) || (hadrons.has(a) && leptons.has(b))) return [...automatic, ["dis", "Deep-inelastic scattering"]];
  if ((a === "photon" && hadrons.has(b)) || (hadrons.has(a) && b === "photon")) return [...automatic, ["photoproduction", "Photoproduction"]];
  if (a === "photon" && b === "photon") return [...automatic, ["pairProduction", "γγ pair production"]];
  const conjugates = new Set(["electron:positron", "positron:electron", "muonMinus:muonPlus", "muonPlus:muonMinus"]);
  if (conjugates.has(`${a}:${b}`)) return [...automatic, ["annihilation", "γ*/Z annihilation"]];
  return automatic;
}

function beamLabel(id) {
  return ({ proton: "p", antiproton: "p̄", neutron: "n", antineutron: "n̄", hyperon: "Λ", antihyperon: "Λ̄", pionPlus: "π⁺", pionMinus: "π⁻", electron: "e⁻", positron: "e⁺", muonMinus: "μ⁻", muonPlus: "μ⁺", photon: "γ" })[id] || id;
}

function renderCatalog() {
  const filters = $("#familyFilters");
  const filterLocale = localStorage.getItem("qcd-neutrino-language") || "en";
  const filterLabels = ({
    en:{ hypothetical:"My hypotheses", biomolecule:"Biomolecules", chemistry:"Quantum chemistry", semiconductor:"Semiconductors", baryon:"Baryons", lepton:"Leptons", nuclear:"Nuclei and atoms", all:"All", dense:"Dense", quark:"QGP", meson:"Mesons", collider:"Collider", strange:"Strange", exotic:"Exotic matter", macro:"Macro objects", ordinary:"Ordinary" },
    ru:{ hypothetical:"Мои гипотезы", biomolecule:"Биомолекулы", chemistry:"Квантовая химия", semiconductor:"Полупроводники", baryon:"Барионы", lepton:"Лептоны", nuclear:"Ядра и атомы", all:"Все", dense:"Плотная", quark:"QGP", meson:"Мезоны", collider:"Коллайдер", strange:"Странная", exotic:"Экзотическая материя", macro:"Макрообъекты", ordinary:"Обычная" },
    he:{ hypothetical:"ההשערות שלי", biomolecule:"ביומולקולות", chemistry:"כימיה קוונטית", semiconductor:"מוליכים למחצה", baryon:"בריונים", lepton:"לפטונים", nuclear:"גרעינים ואטומים", all:"הכול", dense:"חומר צפוף", quark:"פלזמת QGP", meson:"מזונים", collider:"מאיץ", strange:"חומר מוזר", exotic:"חומר אקזוטי", macro:"עצמים מאקרוסקופיים", ordinary:"חומר רגיל" }
  })[filterLocale] || {};
  const baseFamilies = families.filter(([id]) => !["ordinary", "exotic", "macro"].includes(id));
  const macroFamily = families.find(([id]) => id === "macro");
  const ordinaryFamilies = [["baryon", "Baryons"], ["lepton", "Leptons"], ["nuclear", "Nuclei and atoms"]];
  const hypotheticalFamily = baseFamilies.find(([id]) => id === "hypothetical");
  const remainingBaseFamilies = baseFamilies.filter(([id]) => id !== "hypothetical");
  const orderedFamilies = [hypotheticalFamily, ...remainingBaseFamilies.slice(0, 1), ...ordinaryFamilies, ...remainingBaseFamilies.slice(1), families.find(([id]) => id === "exotic"), macroFamily].filter(Boolean);
  filters.innerHTML = orderedFamilies.map(([id, label]) => `<button type="button" class="${state.family === id ? "active" : ""}" data-family="${id}">${filterLabels[id] || label}</button>`).join("");
  const query = state.search.trim().toLowerCase();
  const familyMatches = (model) => {
    if (state.family === "all") return true;
    if (state.family === "baryon") return model.family === "baryon" || ["proton", "neutron"].includes(model.id);
    if (state.family === "nuclear") return ["hydrogen", "helium4"].includes(model.id);
    return model.family === state.family;
  };
  const visible = modelRegistry.filter((model) => familyMatches(model) && (!query || `${model.title} ${model.subtitle} ${model.description}`.toLowerCase().includes(query)));
  $("#modelCount").textContent = String(visible.length).padStart(2, "0");
  const locale = localStorage.getItem("qcd-neutrino-language") || "en";
  const familyLabels = Object.fromEntries(Object.entries(filterLabels).map(([key, value]) => [key, String(value).toLocaleUpperCase(locale)]));
  $("#modelList").innerHTML = visible.map((model) => `
    <button type="button" class="model-item ${state.selected.id === model.id ? "active" : ""}" data-model="${model.id}" data-status="${model.status}">
      <span class="model-dot" aria-hidden="true"></span>
      <span class="model-copy"><strong>${model.title}</strong><span>${model.subtitle}</span></span>
      <span class="model-family">${familyLabels[model.family] || model.family}</span>
    </button>`).join("");
  filters.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { state.family = button.dataset.family; renderCatalog(); }));
  $("#modelList").querySelectorAll("button").forEach((button) => button.addEventListener("click", () => selectModel(button.dataset.model)));
  $("#matterWorkspaceBtn").classList.toggle("active", state.family !== "collider");
  $("#colliderWorkspaceBtn").classList.toggle("active", state.family === "collider");
  if (!filters.dataset.wheelScroll) {
    filters.addEventListener("wheel", (event) => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        filters.scrollLeft += event.deltaY;
        event.preventDefault();
      }
    }, { passive: false });
    filters.dataset.wheelScroll = "true";
  }
}

function multiquarkLauncherPanel(model) {
  if (model.visual !== "multiquark" || !Array.isArray(model.composition)) return "";
  return `<section class="multiquark-launcher">
    <span>MULTI-QUARK DISCOVERY</span>
    <p>Открыть полный расчёт: квантовые числа, color-singlet/Pauli-фильтры, редукция базиса, эффективный гамильтониан, пороги распада и SystemVerilog-прототип аппаратного конвейера.</p>
    <button id="openMultiQuarkLabBtn" class="solver-btn" type="button"><i data-lucide="binary"></i> Расчёт многокварковой системы</button>
  </section>`;
}

function quantumGpuPanel(model) {
  if (model.id !== "gpuQuantumSimulator") return "";
  const result = state.solverResult?.kind === "gpu-quantum-statevector" ? state.solverResult : null;
  if (!result) return `<section class="quantum-gpu-panel"><span>DIRECTML QUANTUM</span><p>Запустите расчёт: одинаковая state-vector схема будет выполнена на CPU и GPU, после чего интерфейс проверит fidelity, норму и реального execution provider.</p></section>`;
  const q = result.state;
  const outcomes = (q.topOutcomes || []).slice(0, 6).map((item) => `<li><code>|${escapeHtml(item.basis)}⟩</code><b>${(100 * Number(item.probability)).toFixed(3)}%</b><small>${item.count} shots</small></li>`).join("");
  const cloud = q.cloudHardwareDemo;
  const cloudPanel = cloud ? `<div class="quantum-cloud-demo">
    <span>CLOUD-HARDWARE FRAGMENT · ${escapeHtml(cloud.executionState)}</span>
    <h4>${escapeHtml(cloud.name)} → |${escapeHtml(cloud.targetState)}⟩</h4>
    <p>Два кубита и стандартные H/X/CZ-гейты. Локальный GPU проверяет идеальный результат; отправка на реальный QPU выполняется отдельно через SamplerV2 и требует вашей облачной учётной записи.</p>
    <div class="quantum-cloud-actions"><button id="copyQuantumQasmBtn" class="solver-btn" type="button">Копировать OpenQASM</button><button id="copyQuantumPythonBtn" class="solver-btn" type="button">Копировать Python</button></div>
    <details><summary>OpenQASM 2.0</summary><pre><code>${escapeHtml(cloud.openQasm2)}</code></pre></details>
    <details><summary>Qiskit Runtime · SamplerV2</summary><pre><code>${escapeHtml(cloud.qiskitSamplerV2Python)}</code></pre></details>
    <small>${escapeHtml(cloud.credentialBoundary)}</small>
  </div>` : "";
  return `<section class="quantum-gpu-panel">
    <span>DIRECTML QUANTUM · GPU #${q.selectedDeviceId}</span>
    <div class="quantum-gpu-kpis"><div><small>кубиты</small><b>${q.qubits}</b></div><div><small>размерность</small><b>${mqCount(q.dimension)}</b></div><div><small>fidelity</small><b>${Number(q.fidelity).toFixed(9)}</b></div><div><small>GPU profile</small><b>${q.gpuNodeProviderConfirmed ? "CONFIRMED" : "NO"}</b></div></div>
    <p>${escapeHtml(result.backendHint)}</p><ul>${outcomes}</ul>${cloudPanel}
  </section>`;
}

const biomoleculeDefaults = {
  dna: {
    sequenceType: "dna",
    sequence: "GGGATGGCTGCTGCTGAAGTTGACGACGCTGCTGCTGAACTGGTTGACGCTGCTTAAACC",
    pdbId: "1BNA",
    accession: "P69905",
    title: "B-DNA dodecamer · PDB 1BNA"
  },
  protein: {
    sequenceType: "protein",
    sequence: "TTCCPSIVARSNFNVCRLPGTPEAICATYTGCIIIPGATCPGDYAN",
    pdbId: "1CRN",
    accession: "P69905",
    title: "Crambin · PDB 1CRN"
  }
};

const biomoleculeCopy = {
  en: {
    kicker:"BIOMOLECULAR STRUCTURE WORKBENCH", sequence:"Sequence and translation", sequenceType:"Sequence type",
    dna:"DNA", protein:"Protein", analyse:"Analyse sequence", useOrf:"Use selected ORF as protein", frame:"Reading frame",
    minOrf:"Minimum ORF length", noOrf:"No candidate ORF has been calculated yet.", proteinReady:"Protein supplied to prediction provider",
    sources:"3D structure sources", pdb:"PDB identifier", loadPdb:"Load PDB", afdb:"AlphaFold DB accession", lookup:"Lookup and load",
    localFile:"Open local PDB/mmCIF", prediction:"Protein folding providers", cloud:"Open ColabFold cloud", local:"Local ColabFold",
    unavailable:"not installed", available:"available", chimerax:"Open current structure in ChimeraX", refresh:"Refresh providers",
    boundary:"Cloud execution is never automatic: the protein sequence is copied and the official notebook is opened for an explicit submission.",
    ready:"Mol* is ready. Select a source or analyse a sequence.", reset:"Reset example", schematic:"Schematic", molecular:"Molecular"
  },
  ru: {
    kicker:"БИОМОЛЕКУЛЯРНАЯ ЛАБОРАТОРИЯ СТРУКТУР", sequence:"Последовательность и трансляция", sequenceType:"Тип последовательности",
    dna:"ДНК", protein:"Белок", analyse:"Анализировать", useOrf:"Взять выбранный ORF как белок", frame:"Рамка считывания",
    minOrf:"Минимальная длина ORF", noOrf:"Кандидаты ORF ещё не рассчитаны.", proteinReady:"Белок для провайдера предсказания",
    sources:"Источники 3D-структуры", pdb:"Идентификатор PDB", loadPdb:"Загрузить PDB", afdb:"Акцессия AlphaFold DB", lookup:"Найти и загрузить",
    localFile:"Открыть локальный PDB/mmCIF", prediction:"Провайдеры укладки белка", cloud:"Открыть ColabFold cloud", local:"Локальный ColabFold",
    unavailable:"не установлен", available:"доступен", chimerax:"Открыть текущую структуру в ChimeraX", refresh:"Обновить провайдеры",
    boundary:"Облачный расчёт не запускается автоматически: последовательность копируется, а официальный notebook открывается для явной отправки пользователем.",
    ready:"Mol* готов. Выберите источник структуры или проанализируйте последовательность.", reset:"Вернуть пример", schematic:"Схематическая", molecular:"Молекулярная"
  },
  he: {
    kicker:"סביבת עבודה למבנים ביומולקולריים", sequence:"רצף ותרגום", sequenceType:"סוג רצף",
    dna:"DNA", protein:"חלבון", analyse:"ניתוח רצף", useOrf:"שימוש ב‑ORF שנבחר כחלבון", frame:"מסגרת קריאה",
    minOrf:"אורך ORF מזערי", noOrf:"טרם חושבו מועמדי ORF.", proteinReady:"חלבון לספק החיזוי",
    sources:"מקורות למבנה תלת־ממדי", pdb:"מזהה PDB", loadPdb:"טעינת PDB", afdb:"מזהה AlphaFold DB", lookup:"איתור וטעינה",
    localFile:"פתיחת PDB/mmCIF מקומי", prediction:"ספקי קיפול חלבון", cloud:"פתיחת ColabFold בענן", local:"ColabFold מקומי",
    unavailable:"לא מותקן", available:"זמין", chimerax:"פתיחת המבנה הנוכחי ב‑ChimeraX", refresh:"רענון ספקים",
    boundary:"חישוב בענן אינו אוטומטי: הרצף מועתק והמחברת הרשמית נפתחת לשליחה מפורשת בידי המשתמש.",
    ready:"Mol* מוכן. בחרו מקור מבני או נתחו רצף.", reset:"שחזור דוגמה", schematic:"סכמטית", molecular:"מולקולרית"
  }
};

let molstarViewer = null;
let molstarViewerPromise = null;
const biomoleculeRepresentationModes = new Map();

function biomoleculeLocale() { return localStorage.getItem("qcd-neutrino-language") || "en"; }
function bioT(key) { return biomoleculeCopy[biomoleculeLocale()]?.[key] || biomoleculeCopy.en[key] || key; }

function ensureBiomoleculeState(model = state.selected, force = false) {
  const kind = model?.biomoleculeKind || "protein";
  if (force || !state.biomolecule || state.biomolecule.modelId !== model.id) {
    const preset = biomoleculeDefaults[kind];
    state.biomolecule = {
      modelId:model.id, kind, sequenceType:preset.sequenceType, sequence:preset.sequence,
      proteinSequence:kind === "protein" ? preset.sequence : "", readingFrame:1, minimumOrfLength:8,
      pdbId:preset.pdbId, accession:preset.accession, orfs:[], selectedOrf:"", alphaFoldEntry:null,
      providerStatus:state.backendStatusPayload?.scientific?.biomolecule || null, busy:false,
      message:bioT("ready"), currentStructureUrl:"", currentStructureTitle:"", loadedKey:"",
      representationMode:biomoleculeRepresentationModes.get(model.id) || "schematic", representationBusy:false
    };
  }
  return state.biomolecule;
}

async function biomoleculeBackendAction(values) {
  const response = await fetch("./api/solve", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ model:state.selected.id, values })
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload.result;
}

async function initMolstarViewer() {
  if (molstarViewer) return molstarViewer;
  if (molstarViewerPromise) return molstarViewerPromise;
  const fallback = $("#biomoleculeViewerFallback");
  fallback.hidden = false;
  if (!window.molstar?.Viewer) throw new Error("The local Mol* bundle did not initialise");
  molstarViewerPromise = window.molstar.Viewer.create($("#molstarViewer"), {
    layoutIsExpanded:false,
    layoutShowControls:false,
    layoutShowRemoteState:false,
    layoutShowSequence:true,
    layoutShowLog:false,
    layoutShowLeftPanel:false,
    viewportBackgroundColor:"#030a0f",
    viewportShowExpand:false,
    viewportShowSelectionMode:true,
    viewportShowAnimation:true,
    pdbProvider:"rcsb",
    emdbProvider:"rcsb"
  }).then((viewer) => {
    viewer.plugin.canvas3d?.setProps({ renderer:{ backgroundColor:0x030a0f } });
    molstarViewer = viewer;
    fallback.hidden = true;
    return viewer;
  }).catch((error) => {
    molstarViewerPromise = null;
    fallback.querySelector("strong").textContent = "Mol* could not start";
    fallback.querySelector("span").textContent = error.message;
    throw error;
  });
  return molstarViewerPromise;
}

function syncBiomoleculeRepresentationButtons() {
  const bio = state.selected?.visual === "biomolecule" ? ensureBiomoleculeState() : null;
  const schematic = $("#bioSchematicViewBtn");
  const molecular = $("#bioMolecularViewBtn");
  if (!bio || !schematic || !molecular) return;
  schematic.querySelector("span").textContent = bioT("schematic");
  molecular.querySelector("span").textContent = bioT("molecular");
  for (const [button, mode] of [[schematic, "schematic"], [molecular, "molecular"]]) {
    const active = bio.representationMode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.disabled = bio.representationBusy;
  }
  schematic.onclick = () => { void applyBiomoleculeRepresentation("schematic"); };
  molecular.onclick = () => { void applyBiomoleculeRepresentation("molecular"); };
}

async function applyBiomoleculeRepresentation(mode, { announce = true } = {}) {
  if (!["schematic", "molecular"].includes(mode)) return;
  const bio = ensureBiomoleculeState();
  bio.representationMode = mode;
  biomoleculeRepresentationModes.set(bio.modelId, mode);
  const viewer = await initMolstarViewer();
  const structures = viewer.plugin.managers.structure.hierarchy.current.structures;
  if (!structures.length) { syncBiomoleculeRepresentationButtons(); return; }
  const presetId = mode === "molecular"
    ? "preset-structure-representation-atomic-detail"
    : "preset-structure-representation-polymer-cartoon";
  const provider = viewer.plugin.builders.structure.representation.getPresets().find((candidate) => candidate.id === presetId);
  if (!provider) throw new Error(`Mol* representation preset is unavailable: ${presetId}`);
  bio.representationBusy = true;
  syncBiomoleculeRepresentationButtons();
  try {
    viewer.plugin.canvas3d?.setProps({ camera:{ manualReset:true } });
    await viewer.plugin.managers.structure.component.applyPreset(structures, provider);
    await viewer.plugin.managers.camera.reset();
    if (announce) setStatus(`MOL* · ${bioT(mode)}`, true);
  } catch (error) {
    bio.message = `Mol* representation: ${error.message}`;
    setStatus(bio.message, false);
  } finally {
    bio.representationBusy = false;
    syncBiomoleculeRepresentationButtons();
  }
}

async function loadBiomoleculeStructure(url, format, title, { binary = false, key = url, local = false } = {}) {
  const bio = ensureBiomoleculeState();
  bio.busy = true;
  bio.message = `Mol* · ${title}`;
  renderInspector();
  try {
    const viewer = await initMolstarViewer();
    await viewer.plugin.clear();
    await viewer.loadStructureFromUrl(url, format, binary, { label:title });
    await applyBiomoleculeRepresentation(bio.representationMode, { announce:false });
    bio.loadedKey = key;
    bio.currentStructureUrl = local ? "" : url;
    bio.currentStructureTitle = title;
    $("#biomoleculeViewerTitle").textContent = title;
    $("#biomoleculeViewerMeta").textContent = format.toUpperCase() + (binary ? " · binary" : " · interactive selection enabled");
    $("#biomoleculeViewerSource").textContent = local ? "MOL* · LOCAL FILE" : "MOL* · TRACEABLE REMOTE STRUCTURE";
    bio.message = `${title} · 3D loaded`;
    setStatus(`MOL* · ${title}`, true);
  } catch (error) {
    bio.message = `Mol* error: ${error.message}`;
    setStatus(bio.message, false);
  } finally {
    bio.busy = false;
    renderInspector();
  }
}

async function activateBiomoleculeWorkspace(model = state.selected) {
  if (model.visual !== "biomolecule") return;
  const bio = ensureBiomoleculeState(model);
  $("#biomoleculePanel").hidden = false;
  await initMolstarViewer();
  const key = `pdb:${bio.pdbId}`;
  if (!bio.loadedKey) {
    const url = `https://files.rcsb.org/download/${encodeURIComponent(bio.pdbId.toUpperCase())}.cif`;
    await loadBiomoleculeStructure(url, "mmcif", biomoleculeDefaults[bio.kind].title, { key });
  }
}

function biomoleculeWorkbenchPanel(model) {
  if (model.visual !== "biomolecule") return "";
  const bio = ensureBiomoleculeState(model);
  const provider = bio.providerStatus || state.backendStatusPayload?.scientific?.biomolecule || {};
  const selectedOrf = bio.orfs.find((row) => row.id === bio.selectedOrf) || bio.orfs[0];
  const protein = bio.proteinSequence || selectedOrf?.protein || (bio.sequenceType === "protein" ? bio.sequence : "");
  const orfOptions = bio.orfs.length
    ? bio.orfs.map((row) => `<option value="${row.id}" ${row.id === (bio.selectedOrf || bio.orfs[0].id) ? "selected" : ""}>${row.frame} · ${row.startBase}–${row.endBase} · ${row.lengthAa} aa${row.complete ? " · stop" : ""}</option>`).join("")
    : `<option value="">${bioT("noOrf")}</option>`;
  const localReady = Boolean(provider.colabfoldLocal?.available);
  const chimeraReady = Boolean(provider.chimerax?.available);
  const af = bio.alphaFoldEntry;
  const afInfo = af ? `<div class="bio-af-result"><b>${escapeHtml(af.entryId)}</b><span>${escapeHtml(af.gene || "")}${af.organism ? ` · ${escapeHtml(af.organism)}` : ""}</span><small>mean pLDDT ${Number(af.meanPlddt || 0).toFixed(2)} · ${af.sequenceLength || "?"} aa</small><a href="${af.entryUrl}" target="_blank" rel="noreferrer">AlphaFold DB entry ↗</a></div>` : "";
  return `<section class="biomolecule-workbench" dir="${biomoleculeLocale() === "he" ? "rtl" : "ltr"}">
    <header><div><span>${bioT("kicker")}</span><strong>Mol* 5.4.2 · MIT</strong></div><span class="bio-engine">${bio.busy ? "BUSY" : "LOCAL UI"}</span></header>
    <details open><summary>${bioT("sequence")}</summary>
      <div class="bio-inline"><label><span>${bioT("sequenceType")}</span><select id="bioSequenceType"><option value="dna" ${bio.sequenceType === "dna" ? "selected" : ""}>${bioT("dna")}</option><option value="protein" ${bio.sequenceType === "protein" ? "selected" : ""}>${bioT("protein")}</option></select></label><label><span>${bioT("frame")}</span><select id="bioReadingFrame">${[1,2,3,-1,-2,-3].map((frame) => `<option value="${frame}" ${frame === bio.readingFrame ? "selected" : ""}>${frame > 0 ? "+" : ""}${frame}</option>`).join("")}</select></label></div>
      <textarea id="bioSequence" spellcheck="false" rows="7">${escapeHtml(bio.sequence)}</textarea>
      <div class="bio-inline bio-actions"><button id="bioAnalyseBtn" class="primary-action" type="button" ${bio.busy ? "disabled" : ""}><i data-lucide="scan-search"></i>${bioT("analyse")}</button><button id="bioResetBtn" class="solver-btn" type="button"><i data-lucide="rotate-ccw"></i>${bioT("reset")}</button></div>
      ${bio.sequenceType === "dna" ? `<label class="bio-full"><span>${bioT("minOrf")}</span><input id="bioMinimumOrf" type="number" min="1" max="5000" value="${bio.minimumOrfLength}"></label><select id="bioOrfSelect" class="bio-full">${orfOptions}</select><button id="bioUseOrfBtn" class="solver-btn bio-full" type="button" ${selectedOrf ? "" : "disabled"}>${bioT("useOrf")}</button>` : ""}
      <label class="bio-protein"><span>${bioT("proteinReady")} · ${protein.length} aa</span><textarea id="bioProteinSequence" rows="4" spellcheck="false">${escapeHtml(protein)}</textarea></label>
    </details>
    <details open><summary>${bioT("sources")}</summary>
      <div class="bio-source-row"><label><span>${bioT("pdb")}</span><input id="bioPdbId" value="${escapeHtml(bio.pdbId)}" maxlength="12"></label><button id="bioLoadPdbBtn" class="solver-btn" type="button" ${bio.busy ? "disabled" : ""}>${bioT("loadPdb")}</button></div>
      <div class="bio-source-row"><label><span>${bioT("afdb")}</span><input id="bioAfAccession" value="${escapeHtml(bio.accession)}" maxlength="10"></label><button id="bioLoadAfBtn" class="solver-btn" type="button" ${bio.busy ? "disabled" : ""}>${bioT("lookup")}</button></div>
      ${afInfo}<label class="bio-file"><span>${bioT("localFile")}</span><input id="bioStructureFile" type="file" accept=".pdb,.cif,.mmcif,.bcif"></label>
    </details>
    <details><summary>${bioT("prediction")}</summary>
      <div class="bio-provider"><span>AlphaFold DB</span><b class="ready">${bioT("available")}</b><small>open predictions · accession lookup</small></div>
      <div class="bio-provider"><span>${bioT("local")}</span><b class="${localReady ? "ready" : "off"}">${localReady ? bioT("available") : bioT("unavailable")}</b><small>${escapeHtml(provider.colabfoldLocal?.executable || "RX 5500M is not a supported CUDA target")}</small></div>
      <button id="bioColabfoldCloudBtn" class="solver-btn bio-full" type="button" ${protein ? "" : "disabled"}><i data-lucide="cloud"></i>${bioT("cloud")}</button>
      <button id="bioChimeraxBtn" class="solver-btn bio-full" type="button" ${bio.currentStructureUrl && chimeraReady ? "" : "disabled"}><i data-lucide="external-link"></i>${bioT("chimerax")} · ${chimeraReady ? bioT("available") : bioT("unavailable")}</button>
      <button id="bioRefreshProvidersBtn" class="solver-btn bio-full" type="button">${bioT("refresh")}</button>
      <small class="bio-boundary">${bioT("boundary")}</small>
    </details>
    <div class="bio-message">${escapeHtml(bio.message)}</div>
  </section>`;
}

async function analyseBiomoleculeSequence() {
  const bio = ensureBiomoleculeState();
  bio.busy = true; bio.message = "Sequence analysis…"; renderInspector();
  try {
    const result = await biomoleculeBackendAction({ biomoleculeAction:"translate", sequence:bio.sequence, sequenceType:bio.sequenceType, readingFrame:bio.readingFrame, minimumOrfLength:bio.minimumOrfLength });
    bio.orfs = result.state.orfs || [];
    bio.selectedOrf = bio.orfs[0]?.id || "";
    bio.proteinSequence = result.state.protein || "";
    state.solverResult = result;
    bio.message = bio.sequenceType === "dna" ? `${bio.orfs.length} ORF candidates · NCBI table 1` : `${bio.proteinSequence.length} aa · protein sequence validated`;
    setStatus(`SEQUENCE · ${bio.message}`, true);
  } catch (error) { bio.message = `Sequence error: ${error.message}`; setStatus(bio.message, false); }
  finally { bio.busy = false; renderInspector(); }
}

async function loadAlphaFoldEntry() {
  const bio = ensureBiomoleculeState();
  bio.busy = true; bio.message = "AlphaFold DB lookup…"; renderInspector();
  try {
    const result = await biomoleculeBackendAction({ biomoleculeAction:"alphafold-db", accession:bio.accession });
    bio.alphaFoldEntry = result.state;
    state.solverResult = result;
    await loadBiomoleculeStructure(result.state.cifUrl, "mmcif", `${result.state.entryId} · AlphaFold DB`, { key:`afdb:${bio.accession}` });
  } catch (error) { bio.message = `AlphaFold DB: ${error.message}`; setStatus(bio.message, false); }
  finally { bio.busy = false; renderInspector(); }
}

async function refreshBiomoleculeProviders() {
  const bio = ensureBiomoleculeState();
  bio.busy = true; bio.message = "Checking local providers…"; renderInspector();
  try {
    const result = await biomoleculeBackendAction({ biomoleculeAction:"provider-status" });
    bio.providerStatus = result.state;
    bio.message = `Mol* local · ColabFold ${result.state.colabfoldLocal?.available ? "ready" : "not installed"} · ChimeraX REST ${result.state.chimerax?.available ? "ready" : "not running"}`;
  } catch (error) { bio.message = `Provider status: ${error.message}`; }
  finally { bio.busy = false; renderInspector(); }
}

function bindBiomoleculePanel() {
  const bio = ensureBiomoleculeState();
  syncBiomoleculeRepresentationButtons();
  $("#bioSequence")?.addEventListener("input", (event) => { bio.sequence = event.target.value; });
  $("#bioProteinSequence")?.addEventListener("input", (event) => { bio.proteinSequence = event.target.value.replace(/\s+/g, "").toUpperCase(); });
  $("#bioSequenceType")?.addEventListener("change", (event) => { bio.sequenceType = event.target.value; bio.orfs = []; bio.proteinSequence = bio.sequenceType === "protein" ? bio.sequence : ""; renderInspector(); });
  $("#bioReadingFrame")?.addEventListener("change", (event) => { bio.readingFrame = Number(event.target.value); });
  $("#bioMinimumOrf")?.addEventListener("change", (event) => { bio.minimumOrfLength = Number(event.target.value); });
  $("#bioPdbId")?.addEventListener("input", (event) => { bio.pdbId = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });
  $("#bioAfAccession")?.addEventListener("input", (event) => { bio.accession = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });
  $("#bioOrfSelect")?.addEventListener("change", (event) => { bio.selectedOrf = event.target.value; const row = bio.orfs.find((orf) => orf.id === bio.selectedOrf); if (row) bio.proteinSequence = row.protein; renderInspector(); });
  $("#bioAnalyseBtn")?.addEventListener("click", analyseBiomoleculeSequence);
  $("#bioUseOrfBtn")?.addEventListener("click", () => { const row = bio.orfs.find((orf) => orf.id === (bio.selectedOrf || bio.orfs[0]?.id)); if (row) { bio.proteinSequence = row.protein; bio.message = `${row.frame} · ${row.lengthAa} aa selected for prediction`; renderInspector(); } });
  $("#bioResetBtn")?.addEventListener("click", () => { const preset = biomoleculeDefaults[bio.kind]; bio.sequence = preset.sequence; bio.sequenceType = preset.sequenceType; bio.proteinSequence = bio.kind === "protein" ? preset.sequence : ""; bio.orfs = []; bio.message = bioT("ready"); renderInspector(); });
  $("#bioLoadPdbBtn")?.addEventListener("click", () => { const id = bio.pdbId.trim().toUpperCase(); if (!/^[A-Z0-9]{4,12}$/.test(id)) { bio.message = "Invalid PDB identifier"; renderInspector(); return; } loadBiomoleculeStructure(`https://files.rcsb.org/download/${encodeURIComponent(id)}.cif`, "mmcif", `PDB ${id}`, { key:`pdb:${id}` }); });
  $("#bioLoadAfBtn")?.addEventListener("click", loadAlphaFoldEntry);
  $("#bioStructureFile")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    const extension = file.name.toLowerCase().split(".").pop();
    const format = extension === "pdb" ? "pdb" : "mmcif";
    const binary = extension === "bcif";
    if (!["pdb","cif","mmcif","bcif"].includes(extension)) { bio.message = "Use PDB, CIF, mmCIF or BCIF"; renderInspector(); return; }
    const url = URL.createObjectURL(file);
    await loadBiomoleculeStructure(url, format, file.name, { binary, key:`file:${file.name}:${file.size}`, local:true });
    URL.revokeObjectURL(url);
  });
  $("#bioColabfoldCloudBtn")?.addEventListener("click", async () => {
    const protein = bio.proteinSequence.trim(); if (!protein) return;
    const opened = window.open("https://colab.research.google.com/github/sokrypton/ColabFold/blob/main/AlphaFold2.ipynb", "_blank", "noopener,noreferrer");
    const copied = await copyTextToClipboard(protein);
    bio.message = `${copied ? "Protein sequence copied" : "Clipboard blocked"} · ColabFold notebook ${opened ? "opened" : "popup blocked"}`;
    renderInspector();
  });
  $("#bioChimeraxBtn")?.addEventListener("click", async () => {
    try { await biomoleculeBackendAction({ biomoleculeAction:"chimerax-open", structureUrl:bio.currentStructureUrl }); bio.message = "Structure opened through ChimeraX localhost REST"; }
    catch (error) { bio.message = `ChimeraX: ${error.message}`; }
    renderInspector();
  });
  $("#bioRefreshProvidersBtn")?.addEventListener("click", refreshBiomoleculeProviders);
}

function chemistryEditorPanel(model) {
  if (model.visual !== "molecule") return "";
  const chemistry = ensureChemistryState();
  const draft = chemistry.draft;
  const elementColor = { H:"#ecf5f7", C:"#566a74", N:"#4f8cff", O:"#f26072", F:"#65dca3", P:"#f3a44f", S:"#f0d75a", Cl:"#4ed47b", Br:"#a64d3f", I:"#875cb1", B:"#efa19a" };
  const bonds = draft.bonds.map(([a,b,order]) => {
    const left = draft.atoms[a]; const right = draft.atoms[b];
    if (!left || !right) return "";
    return `<line x1="${left.x}" y1="${left.y}" x2="${right.x}" y2="${right.y}" stroke="#8ac8d1" stroke-width="${1.7 + Number(order || 1) * 1.25}" stroke-linecap="round" opacity=".78"/>`;
  }).join("");
  const atoms = draft.atoms.map((atom, index) => `<g class="chem-editor-atom ${chemistry.selectedAtom === index ? "selected" : ""}" data-chem-atom="${index}" transform="translate(${atom.x} ${atom.y})"><circle r="13" fill="${elementColor[atom.element] || "#82959b"}"/><text y="4" text-anchor="middle">${atom.element}</text></g>`).join("");
  const tools = ["H","B","C","N","O","F","P","S","Cl","Br","I"].map((element) => `<button type="button" data-chem-element="${element}" class="${chemistry.atomTool === element ? "active" : ""}">${element}</button>`).join("");
  const libraryOptions = Object.entries(chemistryLibrary).map(([key,[name,formula]]) => `<option value="${key}" ${chemistry.libraryChoice === key ? "selected" : ""}>${name} · ${formula}</option>`).join("");
  const reactionOptions = chemistryReactionOptions.map(([key,label]) => `<option value="${key}" ${chemistry.reactionChoice === key ? "selected" : ""}>${label}</option>`).join("");
  const chips = chemistry.addedCompounds.length ? chemistry.addedCompounds.map((key,index) => `<button type="button" class="chem-chip" data-chem-remove="${index}" title="Удалить реагент">${chemistryLibrary[key]?.[0] || key} <b>×</b></button>`).join("") : `<small>Дополнительные соединения ещё не добавлены.</small>`;
  const reactionInfo = chemistry.reaction ? `<div class="chem-reaction-result"><b>${escapeHtml(chemistry.reaction.equation)}</b><span>${escapeHtml(chemistry.reaction.conditions)}</span><small>${escapeHtml(chemistry.reaction.scientificBoundary)}</small></div>` : "";
  return `<section class="chemistry-workbench">
    <header><div><span>MOLECULE & REACTION WORKBENCH</span><strong>Свободный редактор молекул</strong></div><span class="chem-engine">RDKit · local</span></header>
    <details open><summary>Редактор атомов и связей</summary>
      <p>Выберите элемент. Клик по пустому полю добавляет атом; два последовательных клика по атомам создают связь выбранного порядка.</p>
      <div class="chem-tool-row">${tools}</div>
      <div class="chem-bond-row"><label>Связь <select id="chemBondOrder"><option value="1" ${chemistry.bondOrder===1?"selected":""}>одинарная</option><option value="2" ${chemistry.bondOrder===2?"selected":""}>двойная</option><option value="3" ${chemistry.bondOrder===3?"selected":""}>тройная</option></select></label><button id="chemDeleteAtomBtn" class="solver-btn" type="button">Удалить атом</button><button id="chemClearBtn" class="solver-btn" type="button">Очистить</button></div>
      <svg id="chemEditorCanvas" class="chem-editor-canvas" viewBox="0 0 280 164" role="img" aria-label="Редактор графа молекулы">${bonds}${atoms}</svg>
      <label class="chem-smiles"><span>SMILES (можно редактировать напрямую)</span><input id="chemSmilesInput" value="${escapeHtml(chemistry.smilesInput)}" placeholder="Например: CCO или c1ccccc1"></label>
      <button id="chemBuildBtn" class="primary-action chem-wide" type="button" ${chemistry.busy?"disabled":""}><i data-lucide="box"></i><span>Построить и оптимизировать 3D</span></button>
    </details>
    <details open><summary>Смесь и химическая реакция</summary>
      <p>Любую исходную молекулу можно поместить в общую 3D-сцену с соединениями из библиотеки.</p>
      <div class="chem-library-row"><select id="chemLibrarySelect">${libraryOptions}</select><button id="chemAddCompoundBtn" class="solver-btn" type="button" ${chemistry.busy?"disabled":""}>Добавить</button></div>
      <div class="chem-chips">${chips}</div>
      <label class="chem-reaction-select"><span>Проверенный стехиометрический шаблон</span><select id="chemReactionSelect">${reactionOptions}</select></label>
      <div class="chem-actions"><button id="chemRunReactionBtn" class="primary-action" type="button" ${chemistry.busy?"disabled":""}><i data-lucide="flask-conical"></i><span>Провести реакцию</span></button><button id="chemResetBtn" class="solver-btn" type="button"><i data-lucide="rotate-ccw"></i> Reset · исходная молекула</button></div>
      ${reactionInfo}<div class="chem-message">${escapeHtml(chemistry.busy ? "RDKit рассчитывает 3D-конформеры…" : chemistry.message)}</div>
      <small class="chem-boundary">Анимация показывает сбалансированные графы реагентов и продуктов. Это не квантовая молекулярная динамика и не рассчитанная траектория переходного состояния.</small>
    </details>
  </section>`;
}

function smartMatterPanel(model) {
  if (model.visual !== "smartMatter") return "";
  const smart = ensureSmartMatterState();
  const plan = smart.plan;
  const checks = plan?.checks;
  const valid = Boolean(checks?.valid);
  const totalAtoms = checks?.atomCount || 0;
  const totalBonds = checks?.bondCount || 0;
  return `<section class="smart-matter-workbench">
    ${smart.precomputed ? '<p>GitHub Pages · заранее рассчитанная цель RDKit, seed 61453. Сборка выполняется в браузере; новый научный расчёт доступен локально.</p>' : ''}
    <div class="smart-matter-head"><div><span>SMART MATTER ASSEMBLY</span><strong>${escapeHtml(plan?.formula || "RDKit target not calculated")}</strong></div><b class="${valid ? "pass" : "pending"}">${checks ? (valid ? "GRAPH PASS" : "GRAPH FAIL") : "WAITING"}</b></div>
    <p>Сначала — только каркас цели. Частица проходит i→0 в полном размере, занимает своё место и образует доступные связи. Затем начинает следующая.</p>
    <div class="smart-stage-track">${["READY","MATERIALIZING","NAVIGATING","BONDING","STABLE"].map((stage) => `<span class="${stage === smart.stage ? "active" : ""}">${stage}</span>`).join("")}</div>
    <div class="smart-counters">
      <div><span>Видимы в 3D</span><b id="smartVisibleCount">${smart.visibleAtoms} / ${totalAtoms}</b></div>
      <div><span>В целевой позиции</span><b id="smartBondedCount">${smart.bondedAtoms} / ${totalAtoms}</b></div>
      <div><span>Связи CanBond</span><b id="smartBondCount">${smart.formedBonds} / ${totalBonds}</b></div>
    </div>
    <div class="smart-science-split"><div><span>Научная часть</span><p>RDKit: граф, элементы, валентности, радиусы, ETKDGv3 и ${escapeHtml(plan?.forceField || "MMFF94/UFF")}‑конформер.</p></div><div><span>Авторская гипотеза</span><p>Полноразмерное появление частиц при переходе i&lt;0 → i=0 и программируемая перестройка материи.</p></div></div>
    <div class="smart-actions"><button id="smartMatterPrepareBtn" class="solver-btn" type="button" ${smart.busy ? "disabled" : ""}>Пересчитать цель</button><button id="smartMatterRandomBtn" class="solver-btn" type="button" ${smart.busy ? "disabled" : ""}>Новая конфигурация</button><button id="smartMatterResetBtn" class="solver-btn" type="button">Сброс</button></div>
    <div id="smartMatterMessage" class="chem-message">${escapeHtml(smart.busy ? "RDKit рассчитывает молекулярный граф…" : smart.message)}</div>
  </section>`;
}

function bindSmartMatterPanel() {
  const smart = ensureSmartMatterState();
  if (!smart) return;
  if (smart.precomputed) {
    const seed=$('#param-smartMatterSeed'); if(seed)seed.disabled=true;
    const random=$('#smartMatterRandomBtn'); if(random)random.disabled=true;
  }
  $("#smartMatterPrepareBtn")?.addEventListener("click", () => { smart.plan = null; void prepareSmartMatterPlan(false); });
  $("#smartMatterRandomBtn")?.addEventListener("click", () => {
    state.values.smartMatterSeed = Math.floor(Math.random() * 99998) + 1;
    const control = $("#param-smartMatterSeed");
    if (control) control.value = String(state.values.smartMatterSeed);
    const output = $("#out-smartMatterSeed");
    if (output) output.textContent = String(state.values.smartMatterSeed);
    ensureSmartMatterState(true);
    void prepareSmartMatterPlan(false);
  });
  $("#smartMatterResetBtn")?.addEventListener("click", () => {
    smart.running = false;
    smart.stage = "READY";
    smart.visibleAtoms = smart.bondedAtoms = smart.formedBonds = 0;
    smart.sequence = smart.plan ? createAssembly(smart.plan.particles) : null;
    state.interaction = null;
    rebuildSpecimen();
    renderInspector();
  });
}

function smartProteinRepairPanel(model) {
  if (model.visual !== "smartProteinRepair") return "";
  const repair = ensureSmartProteinRepairState();
  const plan = repair.plan;
  const report = plan?.damageReport || {};
  const content = plan?.smartMatterContent || {};
  const validation = plan?.validation || {};
  const required = Number(plan?.repairPlan?.requiredSmartMatterParticles || 0);
  const broken = Number(report.brokenBonds || 0);
  return `<section class="smart-matter-workbench protein-repair-workbench">
    <p class="smart-science-split">${repair.precomputed ? 'GitHub Pages · заранее рассчитанная демонстрация 1CRN; Python/RDKit здесь не выполняется. Параметры расчёта меняются в локальном приложении.' : 'Боковой поток γ → повреждение → немедленное замещение через i. Анимация событий модели; не расчёт Geant4-DNA.'}</p>
    <div class="smart-matter-head"><div><span>SMART MATTER PROTEIN REPAIR</span><strong>${escapeHtml(plan ? `${plan.reference.pdbId} · ${plan.reference.residues.length} residues · chain ${plan.reference.chains.join(",")}` : "RCSB/RDKit reference pending")}</strong></div><b class="${plan ? "pass" : "pending"}">${escapeHtml(repair.stage)}</b></div>
    <div class="protein-graph-switch" role="group" aria-label="Protein graph state">
      ${[["ORIGINAL","G₀ ORIGINAL"],["DAMAGED","Gᴅ DAMAGED"],["REPAIRED","Gʀ REPAIRED"]].map(([stage,label]) => `<button type="button" data-protein-stage="${stage}" class="${repair.stage===stage?"active":""}" ${plan?"":"disabled"}>${label}</button>`).join("")}
    </div>
    <div class="smart-stage-track protein-repair-track">${["ORIGINAL","IRRADIATION","DAMAGE ANALYSIS","REPAIR PLAN","i→3D","BONDING","REPAIRED"].map((stage) => `<span class="${stage === repair.stage || (repair.stage === "DAMAGED" && stage === "DAMAGE ANALYSIS") || (repair.stage === "REPAIRING" && stage === "i→3D") ? "active" : ""}">${stage}</span>`).join("")}</div>
    <div class="smart-counters">
      <div><span>Частицы вышли в 3D</span><b id="proteinRepairVisible">${repair.visibleParticles} / ${required}</b></div>
      <div><span>Заместители установлены</span><b id="proteinRepairPlaced">${repair.placedParticles} / ${required}</b></div>
      <div><span>Связи восстановлены</span><b id="proteinRepairBonds">${repair.restoredBonds} / ${broken}</b></div>
    </div>
    <details open><summary>DAMAGE REPORT</summary><div class="protein-report-grid">
      <span>Ionization events<b>${report.ionizationEvents ?? "—"}</b></span><span>Atoms affected<b>${report.atomsAffected ?? "—"}</b></span>
      <span>Atoms missing<b>${report.atomsMissing ?? "—"}</b></span><span>Broken bonds<b>${report.brokenBonds ?? "—"}</b></span>
      <span>Residues affected<b>${report.residuesAffected ?? "—"}</b></span><span>Backbone damage<b>${report.backboneDamage === undefined ? "—" : report.backboneDamage ? "YES" : "NO"}</b></span>
    </div></details>
    <details open><summary>REPAIR PLAN · ΔG = G₀ − Gᴅ</summary><div class="protein-report-grid">
      <span>Required Smart Matter<b>${required}</b></span><span>Atomic replacement<b>${content.atomicReplacementPercent?.toFixed?.(2) ?? "—"}%</b></span>
      <span>Mass replacement<b>${content.massReplacementPercent?.toFixed?.(2) ?? "—"}%</b></span><span>Topology match<b>${validation.topologyMatchPercent?.toFixed?.(0) ?? "—"}%</b></span>
    </div><p class="protein-elements">${escapeHtml(Object.entries(content.byElement || {}).map(([element,count]) => `${element}: ${count}`).join(" · ") || "No repair plan yet")}</p></details>
    <div class="smart-science-split"><div><span>Established / sourced</span><p>RCSB PDB 1CRN coordinates, RDKit molecular graph, elemental properties and the Compton energy-transfer equation.</p></div><div><span>Hypothesis / approximation</span><p>Smart Matter, movement through i and programmable substitution are hypothetical. Damage thresholds are illustrative, not Geant4‑DNA.</p></div></div>
    <div class="protein-validation ${validation.molecularDynamics?.startsWith?.("NOT RUN") ? "incomplete" : "pass"}"><b>VALIDATE REPAIR</b><span>Bond ${validation.bondValidation ? "PASS" : "—"} · topology ${validation.topologyMatchPercent ?? "—"}%</span><small>${escapeHtml(validation.molecularDynamics || "MD validation pending")}</small></div>
    <div class="smart-actions protein-actions"><button id="proteinIrradiateBtn" class="primary-action" type="button" ${plan && !repair.busy ? "" : "disabled"}>Gamma irradiation</button><button id="proteinReleaseBtn" class="solver-btn" type="button" ${plan && !repair.busy ? "" : "disabled"}>Release Smart Matter</button><button id="proteinRecalculateBtn" class="solver-btn" type="button" ${repair.busy ? "disabled" : ""}>Recalculate</button><button id="proteinResetBtn" class="solver-btn" type="button">Reset</button></div>
    <div class="smart-actions protein-actions"><button id="proteinChimeraxBtn" class="solver-btn" type="button" ${plan ? "" : "disabled"}>Open original in ChimeraX</button><button id="proteinExportBtn" class="solver-btn" type="button" ${plan ? "" : "disabled"}>Export PDB + Smart Matter JSON</button></div>
    <div id="proteinRepairMessage" class="chem-message">${escapeHtml(repair.busy ? "Calculating protein graphs…" : repair.message)}</div>
  </section>`;
}

function downloadProteinRepairBundle() {
  const repair = ensureSmartProteinRepairState();
  if (!repair?.plan) return;
  const graph = repair.stage === "DAMAGED" ? repair.plan.damaged : repair.stage === "ORIGINAL" ? {atoms:repair.plan.reference.atoms,bonds:repair.plan.reference.bonds} : repair.plan.repaired;
  const present = graph.atoms.filter((atom) => atom.present !== false);
  const serialById = new Map(present.map((atom,index) => [Number(atom.id), index+1]));
  const atomLines = present.map((atom,index) => {
    const serial=String(index+1).padStart(5," "), name=String(atom.atomName||atom.element).slice(0,4).padStart(4," ");
    const residue=String(atom.residueName||"UNK").slice(0,3).padStart(3," "), chain=String(atom.chain||"A").slice(0,1);
    const residueNumber=String(atom.residueNumber||1).padStart(4," ");
    const x=Number(atom.x).toFixed(3).padStart(8," "), y=Number(atom.y).toFixed(3).padStart(8," "), z=Number(atom.z).toFixed(3).padStart(8," ");
    return `ATOM  ${serial} ${name} ${residue} ${chain}${residueNumber}    ${x}${y}${z}  1.00  0.00          ${String(atom.element).padStart(2," ")}`;
  });
  const conect = graph.bonds.filter((bond) => !bond.broken && serialById.has(Number(bond.a)) && serialById.has(Number(bond.b)))
    .map((bond) => `CONECT${String(serialById.get(Number(bond.a))).padStart(5," ")}${String(serialById.get(Number(bond.b))).padStart(5," ")}`);
  const pdb = [...atomLines,...conect,"END",""].join("\n");
  const metadata = JSON.stringify({
    schema:"matter-frontier-lab.smart-matter.v1", pdbId:repair.plan.reference.pdbId, graphState:repair.stage,
    smartMatterAtoms:repair.plan.repaired.atoms.filter((atom) => atom.smartMatter).map((atom) => ({ atomId:atom.id, serial:serialById.get(Number(atom.id)) || null, effectiveElement:atom.element, residue:`${atom.residueName} ${atom.residueNumber}`, chain:atom.chain })),
    damageEvents:repair.plan.damageEvents, validation:repair.plan.validation
  }, null, 2);
  [[`${repair.plan.reference.pdbId}_${repair.stage.toLowerCase()}.pdb`,pdb,"chemical/x-pdb"],[`${repair.plan.reference.pdbId}_smart_matter_metadata.json`,metadata,"application/json"]].forEach(([name,content,type]) => {
    const link=document.createElement("a"); link.href=URL.createObjectURL(new Blob([content],{type})); link.download=name; link.click(); setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  });
}

function bindSmartProteinRepairPanel() {
  const repair = ensureSmartProteinRepairState();
  if (repair?.precomputed) document.querySelectorAll('[data-param]').forEach(control=>{
    if (['photonCount','photonEnergyMeV','exposure','damageIntensity','damageSeed'].includes(control.dataset.param)) control.disabled=true;
  });
  if (!repair) return;
  $$('[data-protein-stage]').forEach((button) => button.addEventListener("click", () => setProteinGraphState(button.dataset.proteinStage)));
  $("#proteinIrradiateBtn")?.addEventListener("click", irradiateSmartProtein);
  $("#proteinReleaseBtn")?.addEventListener("click", releaseProteinRepairMatter);
  $("#proteinRecalculateBtn")?.addEventListener("click", () => { ensureSmartProteinRepairState(true); void prepareSmartProteinRepairPlan(); });
  $("#proteinResetBtn")?.addEventListener("click", () => { if (repair.plan) setProteinGraphState("ORIGINAL"); });
  $("#proteinExportBtn")?.addEventListener("click", downloadProteinRepairBundle);
  $("#proteinChimeraxBtn")?.addEventListener("click", async () => {
    if (!repair.plan) return;
    repair.message = "Opening the sourced 1CRN structure through the optional ChimeraX REST bridge…"; renderInspector();
    try { await biomoleculeBackendAction({ biomoleculeAction:"chimerax-open", structureUrl:repair.plan.reference.sourceUrl }); repair.message = "Original structure opened in ChimeraX"; }
    catch (error) { repair.message = `ChimeraX: ${error.message}`; }
    renderInspector();
  });
}

function chemistryApplySolverResult(result, message) {
  state.solverResult = result;
  state.solverMs = 0;
  $("#chartSubtitle").textContent = result.primaryLabel;
  renderMetrics();
  drawChart();
  setStatus(message, false);
}

async function chemistryBackendAction(values) {
  if (!state.backendOnline) throw new Error("Локальный server.py не отвечает");
  const response = await fetch("./api/solve", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ model:"quantumChemistryLab", values:{ ...state.values, ...values } }) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Chemistry backend error");
  state.solverMs = payload.elapsed_ms;
  return payload.result;
}

async function buildChemistryStructure() {
  const chemistry = ensureChemistryState();
  chemistry.busy = true; renderInspector();
  try {
    const values = chemistry.smilesInput.trim()
      ? { chemistryAction:"structure", customSmiles:chemistry.smilesInput.trim(), customName:"Custom molecule" }
      : { chemistryAction:"structure", customGraph:chemistry.draft, customName:"Graph editor molecule" };
    const result = await chemistryBackendAction(values);
    chemistry.original = structuredClone(result.state);
    chemistry.display = structuredClone(result.state);
    chemistry.smilesInput = result.state.smiles;
    chemistry.addedCompounds = [];
    chemistry.reaction = null;
    chemistry.message = `${result.state.formula || "Молекула"} · ${result.state.forceField} · 3D готов`;
    chemistryApplySolverResult(result, `RDKIT · ${chemistry.message}`);
    rebuildSpecimen();
  } catch (error) {
    chemistry.message = `Ошибка структуры: ${error.message}`;
    setStatus(chemistry.message, false);
  } finally { chemistry.busy = false; renderInspector(); }
}

async function refreshChemistryMixture() {
  const chemistry = ensureChemistryState();
  const baseSmiles = chemistry.original?.smiles || chemistryLibrary[chemistry.preset]?.[2] || "O";
  const compounds = [{ smiles:baseSmiles, name:chemistry.original?.molecule || chemistryLibrary[chemistry.preset]?.[0] || "Molecule" },
    ...chemistry.addedCompounds.map((preset) => ({ preset }))];
  const result = await chemistryBackendAction({ chemistryAction:"mixture", compounds });
  chemistry.display = structuredClone(result.state);
  chemistry.reaction = null;
  chemistry.message = `В 3D-сцене соединений: ${compounds.length}`;
  chemistryApplySolverResult(result, `RDKIT MIXTURE · ${compounds.length} components`);
  rebuildSpecimen();
}

async function addChemistryCompound() {
  const chemistry = ensureChemistryState();
  chemistry.addedCompounds.push(chemistry.libraryChoice);
  chemistry.busy = true; renderInspector();
  try { await refreshChemistryMixture(); }
  catch (error) { chemistry.addedCompounds.pop(); chemistry.message = `Ошибка смеси: ${error.message}`; setStatus(chemistry.message, false); }
  finally { chemistry.busy = false; renderInspector(); }
}

async function runChemistryReaction() {
  const chemistry = ensureChemistryState();
  chemistry.busy = true; renderInspector();
  try {
    const result = await chemistryBackendAction({ chemistryAction:"reaction", reactionId:chemistry.reactionChoice });
    chemistry.reaction = { ...structuredClone(result.state), running:true, startedAt:clock.elapsedTime };
    chemistry.display = null;
    chemistry.addedCompounds = [];
    chemistry.message = `Запущено · ${result.state.equation}`;
    chemistryApplySolverResult(result, `RDKit REACTION · ${result.state.equation}`);
    rebuildSpecimen();
  } catch (error) { chemistry.message = `Ошибка реакции: ${error.message}`; setStatus(chemistry.message, false); }
  finally { chemistry.busy = false; renderInspector(); }
}

function resetChemistryWorkbench() {
  const chemistry = ensureChemistryState();
  chemistry.display = chemistry.original ? structuredClone(chemistry.original) : null;
  chemistry.reaction = null;
  chemistry.addedCompounds = [];
  chemistry.message = "Reset · восстановлена исходная одиночная молекула";
  rebuildSpecimen();
  renderInspector();
  setStatus(chemistry.message, false);
}

function bindChemistryPanel() {
  const chemistry = ensureChemistryState();
  if (!chemistry) return;
  $$("[data-chem-element]").forEach((button) => button.addEventListener("click", () => { chemistry.atomTool = button.dataset.chemElement; renderInspector(); }));
  $("#chemBondOrder")?.addEventListener("change", (event) => { chemistry.bondOrder = Number(event.target.value); });
  $("#chemSmilesInput")?.addEventListener("input", (event) => { chemistry.smilesInput = event.target.value; });
  $("#chemLibrarySelect")?.addEventListener("change", (event) => { chemistry.libraryChoice = event.target.value; });
  $("#chemReactionSelect")?.addEventListener("change", (event) => { chemistry.reactionChoice = event.target.value; });
  $("#chemEditorCanvas")?.addEventListener("click", (event) => {
    const atomNode = event.target.closest?.("[data-chem-atom]");
    if (atomNode) {
      const index = Number(atomNode.dataset.chemAtom);
      if (chemistry.selectedAtom !== null && chemistry.selectedAtom !== index) {
        const key = [chemistry.selectedAtom, index].sort((a,b)=>a-b);
        const existing = chemistry.draft.bonds.find((bond) => bond[0] === key[0] && bond[1] === key[1]);
        if (existing) existing[2] = chemistry.bondOrder;
        else chemistry.draft.bonds.push([key[0], key[1], chemistry.bondOrder]);
      }
      chemistry.selectedAtom = index;
    } else {
      const svg = $("#chemEditorCanvas"); const rect = svg.getBoundingClientRect();
      const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
      const local = point.matrixTransform(svg.getScreenCTM().inverse());
      const index = chemistry.draft.atoms.length;
      chemistry.draft.atoms.push({ element:chemistry.atomTool, x:clamp(local.x,14,266), y:clamp(local.y,14,150) });
      if (chemistry.selectedAtom !== null) chemistry.draft.bonds.push([Math.min(chemistry.selectedAtom,index), Math.max(chemistry.selectedAtom,index), chemistry.bondOrder]);
      chemistry.selectedAtom = index;
    }
    chemistry.smilesInput = "";
    chemistry.message = "Граф изменён · нажмите «Построить 3D»";
    renderInspector();
  });
  $("#chemDeleteAtomBtn")?.addEventListener("click", () => {
    const index = chemistry.selectedAtom;
    if (index === null) return;
    chemistry.draft.atoms.splice(index, 1);
    chemistry.draft.bonds = chemistry.draft.bonds.filter((bond) => !bond.includes(index)).map(([a,b,order]) => [a > index ? a-1 : a, b > index ? b-1 : b, order]);
    chemistry.selectedAtom = null; chemistry.smilesInput = ""; renderInspector();
  });
  $("#chemClearBtn")?.addEventListener("click", () => { chemistry.draft = { atoms:[], bonds:[] }; chemistry.selectedAtom = null; chemistry.smilesInput = ""; renderInspector(); });
  $("#chemBuildBtn")?.addEventListener("click", buildChemistryStructure);
  $("#chemAddCompoundBtn")?.addEventListener("click", addChemistryCompound);
  $$("[data-chem-remove]").forEach((button) => button.addEventListener("click", async () => {
    chemistry.addedCompounds.splice(Number(button.dataset.chemRemove), 1);
    chemistry.busy = true; renderInspector();
    try { if (chemistry.addedCompounds.length) await refreshChemistryMixture(); else resetChemistryWorkbench(); }
    catch (error) { chemistry.message = `Ошибка смеси: ${error.message}`; }
    finally { chemistry.busy = false; renderInspector(); }
  }));
  $("#chemRunReactionBtn")?.addEventListener("click", runChemistryReaction);
  $("#chemResetBtn")?.addEventListener("click", resetChemistryWorkbench);
}

function renderInspector() {
  const model = state.selected;
  const biomoleculeMode = model.visual === "biomolecule";
  $(".stage-panel").classList.toggle("biomolecule-mode", biomoleculeMode);
  $(".inspector-panel").classList.toggle("biomolecule-inspector", biomoleculeMode);
  $("#biomoleculePanel").hidden = !biomoleculeMode;
  renderViewModes(model);
  const communicationLabBtn = $("#communicationLabBtn");
  if (communicationLabBtn) communicationLabBtn.remove();
  const communicationViewBtn = $("#communicationViewBtn");
  if (communicationViewBtn) communicationViewBtn.hidden = model.id !== "neutrinoLens";
  const communicationInspector = $("#communicationInspector");
  if (model.id !== "neutrinoLens") {
    state.communicationOpen = false;
    $("#communicationPanel").hidden = true;
  }
  communicationInspector.hidden = !(model.id === "neutrinoLens" && state.communicationOpen);
  $("#inspectorTitle").textContent = model.title;
  $("#inspectorSubtitle").textContent = model.subtitle;
  $("#modelDescription").textContent = model.description;
  $("#modelFormula").textContent = model.formula;
  $("#modelApplicability").textContent = model.applicability;
  $("#sceneTitle").textContent = model.title;
  $("#sceneFamily").textContent = familyTitle(model.family).toUpperCase();
  $("#certaintyBadge").className = `certainty ${model.status}`;
  $("#certaintyBadge").textContent = model.statusLabel;
  $("#telemetryObject").textContent = model.composition?.join("") || model.title;
  $("#telemetryScale").textContent = model.visual === "atom" ? "10⁻¹⁰ m" : model.visual === "neutrinoLens" ? "macroscopic" : model.visual === "collider" ? "event display" : biomoleculeMode || model.visual === "smartMatter" ? "Å (target conformer)" : model.visual === "smartProteinRepair" ? "Å · PDB coordinates" : "1 fm";
  $("#telemetryState").textContent = model.status;
  const isMFieldRegion = model.visual === "complexSpin" && state.values.configuration === "lattice";
  const matrixPassage = isMFieldRegion && state.view === "passage";
  const phaseDemo = isMFieldRegion && state.view === "phaseDemo";
  const blackHoleMerger = model.id === "blackHole" && state.view === "blackHoleMerger";
  const standingWaveCore = model.visual === "standingWaveCore";
  const resonantTriple = model.visual === "resonantTriple";
  const smartMatter = model.visual === "smartMatter";
  const smartProteinRepair = model.visual === "smartProteinRepair";
  const runInteractionButton = $("#runInteractionBtn");
  runInteractionButton.hidden = biomoleculeMode || (["macro", "polytope4d"].includes(model.visual) && !blackHoleMerger && !resonantTriple) || (model.visual === "complexSpin" && !matrixPassage && !phaseDemo);
  const runInteractionLabel = $("#runInteractionBtn span");
  if (runInteractionLabel) runInteractionLabel.textContent = matrixPassage ? ((localStorage.getItem("qcd-neutrino-language") || "en") === "ru" ? "Запустить зонд" : "Run probe") : interactionLabel(model);

  if (phaseDemo && runInteractionLabel) runInteractionLabel.textContent = (localStorage.getItem("qcd-neutrino-language") || "en") === "ru" ? "Р—Р°РїСѓСЃС‚РёС‚СЊ РґРµРјРѕРЅСЃС‚СЂР°С†РёСЋ" : "Run demonstration";
  if (blackHoleMerger && runInteractionLabel) runInteractionLabel.textContent = state.blackHoleMergerRunning ? "Restart merger" : "Start merger";
  if (resonantTriple && runInteractionLabel) runInteractionLabel.textContent = state.resonantTripleRunning ? "Restart binary merger" : "Start binary merger";
  if (smartMatter) {
    const smart = ensureSmartMatterState();
    const label = smart.busy ? "RDKit рассчитывает…" : smart.running ? "Перезапустить сборку" : smart.stage === "STABLE" ? "Повторить сборку" : "Создать молекулу";
    runInteractionButton.innerHTML = `<i data-lucide="${smart.running ? "rotate-ccw" : "play"}"></i><span>${label}</span>`;
    runInteractionButton.disabled = smart.busy;
  }
  if (smartProteinRepair) {
    const repair = ensureSmartProteinRepairState();
    const label = repair.busy ? "RDKit рассчитывает…" : repair.running ? "Ремонт выполняется…" : repair.stage === "ORIGINAL" ? "Гамма-облучение" : repair.stage === "DAMAGED" ? "Выпустить умную материю" : "Повторить эксперимент";
    runInteractionButton.innerHTML = `<i data-lucide="${repair.stage === "ORIGINAL" ? "radiation" : repair.stage === "DAMAGED" ? "sparkles" : "rotate-ccw"}"></i><span>${label}</span>`;
    runInteractionButton.disabled = repair.busy || repair.running;
  }
  if (standingWaveCore) {
    const language = localStorage.getItem("qcd-neutrino-language") || "en";
    const label = state.paused
      ? ({ ru: "Воспроизвести волны", he: "הפעלת גלים", en: "Play waves" }[language] || "Play waves")
      : ({ ru: "Пауза волн", he: "השהיית גלים", en: "Pause waves" }[language] || "Pause waves");
    // Some translated shells render this control without the original <span>.
    // Update the button itself so the transport state is always visible.
    runInteractionButton.textContent = label;
    runInteractionButton.setAttribute("aria-label", label);
  }
  const visibleParameters = model.parameters.filter((parameter) => {
    const mFieldParameters = ["probeType", "probeAxis", "fieldTension", "mMode", "iPhase", "iCoupling", "leakage", "projectionCoherence"];
    if (mFieldParameters.includes(parameter.key)) return isMFieldRegion;
    // The 4D projection controls describe only the isolated 4D quasiparticle.
    if (isMFieldRegion && ["projection", "positionX", "positionY", "positionZ", "positionI", "precession", "phaseOffset"].includes(parameter.key)) return false;
    if (model.id === "blackHole" && parameter.key === "binaryMassC") return blackHoleMerger && Number(state.values.binaryCount) >= 3;
    if (model.id === "blackHole" && ["binaryCount", "binaryMassA", "binaryMassB", "binaryMassC", "spinA", "spinB", "initialSeparation", "mergerConfiguration", "inclination", "gridOpacity", "curvatureDepth", "waveOpacity"].includes(parameter.key)) return blackHoleMerger;
    if (model.id === "blackHole" && ["mass", "diskRadius"].includes(parameter.key)) return !blackHoleMerger;
    return true;
  });
  $("#parameterControls").innerHTML = visibleParameters.map((parameter) => {
    const value = state.values[parameter.key];
    if (parameter.type === "select") {
      const options = parameter.key === "processMode" ? colliderProcessOptions(state.values) : ["beamA", "beamB"].includes(parameter.key) ? colliderBeamOptions() : parameter.options;
      return `<div class="parameter-control">
        <label for="param-${parameter.key}"><span>${parameter.label}</span></label>
        <select id="param-${parameter.key}" data-param="${parameter.key}">${options.map(([optionValue, label]) => `<option value="${optionValue}" ${optionValue === value ? "selected" : ""}>${label}</option>`).join("")}</select>
      </div>`;
    }
    return `<div class="parameter-control">
      <label for="param-${parameter.key}"><span>${parameter.label}</span><output id="out-${parameter.key}">${formatParameter(value, parameter)}</output></label>
      <input id="param-${parameter.key}" data-param="${parameter.key}" type="range" min="${parameter.min}" max="${parameter.max}" step="${parameter.step}" value="${value}">
    </div>`;
  }).join("") + (model.visual === "mOrchestrator" ? mOrchestrator.panel() : "") + (blackHoleMerger ? blackHoleMergerPanel() : "") + (resonantTriple ? resonantTriplePanel() : "") + (isMFieldRegion ? mFieldProjectionPanel() : "") + (matrixPassage ? matrixPassageExplanation() : "") + (phaseDemo ? phaseDemoExplanation() : "") + smartMatterPanel(model) + smartProteinRepairPanel(model) + (model.visual === "collider" ? `
    <div class="collider-controls">
      <div class="collider-controls-title">Collider display</div>
      <label for="detectorOpacity"><span>Detector visibility</span><output id="detectorOpacityOut">${Math.round((state.values.detectorOpacity ?? 0) * 100)}%</output></label>
      <input id="detectorOpacity" type="range" min="0" max="1" step="0.01" value="${state.values.detectorOpacity ?? 0}">
      <label for="collisionSpeed"><span>Event speed</span><output id="collisionSpeedOut">${(state.values.collisionSpeed ?? 1).toFixed(2)}×</output></label>
      <input id="collisionSpeed" type="range" min="0.05" max="2" step="0.05" value="${state.values.collisionSpeed ?? 1}">
      <button id="colliderPauseBtn" class="solver-btn" type="button">${state.paused ? "Resume event" : "Pause event"}</button>
  </div>` : "") + (model.visual === "collider" ? collisionExplanation() : "") + (isBaryonModel(model) && state.view === "confinement" ? confinementControls() : "") + multiquarkLauncherPanel(model) + quantumGpuPanel(model) + chemistryEditorPanel(model) + biomoleculeWorkbenchPanel(model);
  $("#parameterControls").querySelectorAll("[data-param]").forEach((control) => control.addEventListener(control.tagName === "SELECT" ? "change" : "input", () => {
    const parameter = model.parameters.find((item) => item.key === control.dataset.param);
    state.values[control.dataset.param] = parameter.type === "select" ? control.value : Number(control.value);
    if (control.dataset.param === "moleculePreset") {
      ensureChemistryState(true);
      void buildChemistryStructure();
    }
    if (state.selected.visual === "smartMatter" && ["smartMoleculePreset", "smartMatterSeed"].includes(control.dataset.param)) {
      ensureSmartMatterState(true);
      state.interaction = null;
      rebuildSpecimen();
      if (control.dataset.param === "smartMoleculePreset") void prepareSmartMatterPlan(false);
    }
    if (state.selected.visual === "smartProteinRepair") {
      if (control.dataset.param === "showSmartMatter") {
        rebuildSpecimen();
      } else {
        ensureSmartProteinRepairState(true);
        state.interaction = null;
        rebuildSpecimen();
      }
    }
    if (control.dataset.param === "quantumCircuit" && control.value === "grover2") {
      state.values.quantumQubits = 2;
      const qubitControl = $("#param-quantumQubits");
      if (qubitControl) qubitControl.value = "2";
      const qubitOutput = $("#out-quantumQubits");
      if (qubitOutput) qubitOutput.textContent = "2";
    }
    if (parameter.type !== "select") $(`#out-${control.dataset.param}`).textContent = formatParameter(Number(control.value), parameter);
    if (control.dataset.param === "configuration") {
      state.view = "structure";
      state.interaction = null;
      renderViewModes(state.selected);
      renderInspector();
    }
    if (["beamA", "beamB"].includes(control.dataset.param)) {
      state.values.processMode = "auto";
      renderInspector();
    }
    const resonantTripleParameters = ["centralMassA", "centralMassB", "tertiaryMass", "centralSeparation", "outerTrajectory", "outerModulation", "curvatureDepth", "gridOpacity", "waveOpacity"];
    if (state.selected.visual === "resonantTriple" && resonantTripleParameters.includes(control.dataset.param)) {
      state.resonantTripleRunning = false;
      state.resonantTripleStabilizerAdded = false;
      state.resonantTwinStabilizerAdded = false;
      state.resonantTripleActivationTime = null;
      state.resonantTripleActivationProgress = 0;
      state.resonantTripleActivationAngle = 0;
      state.resonantTripleManualControl = false;
      state.resonantTripleManualAngle = 0;
      state.resonantTripleManualRadius = 1;
      state.interaction = null;
    }
    if (["beamA", "beamB", "processMode", "baryonNumber", "configuration", "binaryCount", "binaryMassA", "binaryMassB", "binaryMassC", "spinA", "spinB", "initialSeparation", "mergerConfiguration", "inclination", "coreCount"].includes(control.dataset.param) || ["molecule", "semiconductor", "smartProteinRepair"].includes(state.selected.visual) || (state.selected.visual === "smartMatter" && !state.smartMatter?.running) || (state.selected.visual === "resonantTriple" && resonantTripleParameters.includes(control.dataset.param)) || (state.selected.id === "blackHole" && ["mass", "diskRadius"].includes(control.dataset.param)) || (state.selected.visual === "meson" && ["separation", "stringTension", "constituentMass"].includes(control.dataset.param))) rebuildSpecimen();
    if (state.selected.visual === "resonantTriple" && resonantTripleParameters.includes(control.dataset.param)) renderInspector();
    if (state.selected.id === "blackHole" && state.view === "blackHoleMerger" && ["binaryCount", "binaryMassA", "binaryMassB", "binaryMassC", "spinA", "spinB", "initialSeparation", "mergerConfiguration", "inclination"].includes(control.dataset.param)) renderInspector();
    runLocalSolver();
    applyParameterDrivenVisuals();
    const visual = state.visual;
    const response = state.selected.id === "colliderWorkbench" ? `${beamLabel(state.values.beamA)} ↔ ${beamLabel(state.values.beamB)} · ${state.solverResult.state.processLabel}` : state.selected.visual === "hybridMatter" ? `quark fraction ${(visual.quarkFraction * 100).toFixed(0)}%` : `motion ${visual.motionSpeed.toFixed(2)}× · scale ${visual.specimenScale.toFixed(2)}×`;
    setStatus(`${parameter.label} · ${response}`, true);
    if (state.interaction) runInteraction();
  }));
  const detectorOpacity = $("#detectorOpacity");
  detectorOpacity?.addEventListener("input", () => {
    state.values.detectorOpacity = Number(detectorOpacity.value);
    $("#detectorOpacityOut").textContent = `${Math.round(state.values.detectorOpacity * 100)}%`;
    applyParameterDrivenVisuals();
  });
  const collisionSpeed = $("#collisionSpeed");
  collisionSpeed?.addEventListener("input", () => {
    state.values.collisionSpeed = Number(collisionSpeed.value);
    $("#collisionSpeedOut").textContent = `${state.values.collisionSpeed.toFixed(2)}×`;
  });
  $("#colliderPauseBtn")?.addEventListener("click", () => $("#pauseBtn").click());
  $("#randomizeMergerBtn")?.addEventListener("click", () => {
    state.values.orbitSeed = Math.floor(Math.random() * 2147483646) + 1;
    state.values.initialSeparation = Math.floor(48 + Math.random() * 36);
    state.blackHoleMergerRunning = false;
    state.interaction = null;
    rebuildSpecimen();
    runLocalSolver();
    renderInspector();
    setStatus("RANDOM PLANAR ORBIT LAYOUT · all bodies remain coplanar", true);
  });

$("#addResonantStabilizerBtn")?.addEventListener("click", () => {
  if (!state.resonantTripleRunning || state.resonantTripleStabilizerAdded) return;
  const progress = clamp(state.interactionTime / getMergerDuration(), .08, .86);
  state.resonantTripleStabilizerAdded = true;
  state.resonantTripleActivationTime = state.interactionTime;
  state.resonantTripleActivationProgress = progress;
  state.resonantTripleActivationAngle = progress * (8 + progress * 20) * Math.PI;
  state.resonantTripleManualControl = false;
  state.resonantTripleManualAngle = 0;
  state.resonantTripleManualRadius = 1;
  rebuildSpecimen();
  renderInspector();
  setStatus("TERTIARY BLACK HOLE ADDED · distance-dependent tidal coupling", true);
});

$("#addResonantTwinBtn")?.addEventListener("click", () => {
  if (!state.resonantTripleRunning || !state.resonantTripleStabilizerAdded || state.resonantTwinStabilizerAdded) return;
  state.resonantTwinStabilizerAdded = true;
  rebuildSpecimen();
  renderInspector();
  setStatus("SYMMETRIC BALANCING PAIR ADDED", true);
});

$("#resonantManualToggleBtn")?.addEventListener("click", () => {
  if (!state.resonantTripleStabilizerAdded) return;
  state.resonantTripleManualControl = !state.resonantTripleManualControl;
  renderInspector();
  setStatus(
    state.resonantTripleManualControl
      ? "TERTIARY MANUAL CONTROL · COPLANAR"
      : "TERTIARY AUTOMATIC ORBIT · COPLANAR",
    true,
  );
});

$("#resonantTertiaryAngle")?.addEventListener("input", (event) => {
  state.resonantTripleManualAngle = Number(event.target.value);
  $("#resonantTertiaryAngleOut").textContent = `${Math.round(state.resonantTripleManualAngle)}°`;
});

$("#resonantTertiaryRadius")?.addEventListener("input", (event) => {
  state.resonantTripleManualRadius = Number(event.target.value);
  $("#resonantTertiaryRadiusOut").textContent = `${state.resonantTripleManualRadius.toFixed(2)}×`;
});

$("#removeResonantStabilizerBtn")?.addEventListener("click", () => {
  if (!state.resonantTripleStabilizerAdded) return;
  state.resonantTripleStabilizerAdded = false;
  state.resonantTwinStabilizerAdded = false;
  state.resonantTripleManualControl = false;
  state.resonantTripleManualAngle = 0;
  state.resonantTripleManualRadius = 1;
  state.resonantTripleActivationTime = null;
  state.resonantTripleActivationProgress = 0;
  state.resonantTripleActivationAngle = 0;
  rebuildSpecimen();
  renderInspector();
  setStatus("TERTIARY REMOVED · A+B INSPIRAL RESUMED", true);
});
// Inspector controls are reconstructed on every render; delegation keeps the
// balancing-body controls alive after each state change.
document.addEventListener("click", (event) => {
  if (state.selected?.visual !== "resonantTriple") return;
  const id = event.target.closest("button")?.id;
  if (id === "addResonantStabilizerBtn") {
    if (!state.resonantTripleRunning || state.resonantTripleStabilizerAdded) return;
    const progress = clamp(state.interactionTime / getMergerDuration(), .08, .86);
    state.resonantTripleStabilizerAdded = true;
    state.resonantTripleActivationTime = state.interactionTime;
    state.resonantTripleActivationProgress = progress;
    state.resonantTripleActivationAngle = progress * (8 + progress * 20) * Math.PI;
    state.resonantTripleManualControl = false;
    state.resonantTripleManualAngle = 0;
    state.resonantTripleManualRadius = 1;
    rebuildSpecimen();
    renderInspector();
    setStatus("TERTIARY BLACK HOLE ADDED: distance-dependent tidal coupling", true);
  } else if (id === "addResonantTwinBtn") {
    if (!state.resonantTripleRunning || !state.resonantTripleStabilizerAdded || state.resonantTwinStabilizerAdded) return;
    state.resonantTwinStabilizerAdded = true;
    rebuildSpecimen();
    renderInspector();
    setStatus("SYMMETRIC BALANCING PAIR ADDED: coplanar fly-by enabled", true);
  } else if (id === "resonantManualToggleBtn") {
    if (!state.resonantTripleStabilizerAdded) return;
    state.resonantTripleManualControl = !state.resonantTripleManualControl;
    renderInspector();
  } else if (id === "removeResonantStabilizerBtn") {
    if (!state.resonantTripleStabilizerAdded) return;
    state.resonantTripleStabilizerAdded = false;
    state.resonantTwinStabilizerAdded = false;
    state.resonantTripleManualControl = false;
    state.resonantTripleManualAngle = 0;
    state.resonantTripleManualRadius = 1;
    state.resonantTripleActivationTime = null;
    state.resonantTripleActivationProgress = 0;
    state.resonantTripleActivationAngle = 0;
    rebuildSpecimen();
    renderInspector();
    setStatus("BALANCING BODIES REMOVED: A+B inspiral resumed", true);
  }
});

document.addEventListener("input", (event) => {
  if (state.selected?.visual !== "resonantTriple") return;
  if (event.target.id === "resonantTertiaryAngle") {
    state.resonantTripleManualAngle = Number(event.target.value);
    const out = $("#resonantTertiaryAngleOut");
    if (out) out.textContent = `${Math.round(state.resonantTripleManualAngle)} deg`;
  }
  if (event.target.id === "resonantTertiaryRadius") {
    state.resonantTripleManualRadius = Number(event.target.value);
    const out = $("#resonantTertiaryRadiusOut");
    if (out) out.textContent = `${state.resonantTripleManualRadius.toFixed(2)}x`;
  }
});

  $("#confinementRunBtn")?.addEventListener("click", () => {
    state.confinementPulled = true;
    state.interaction = "baryonConfinement";
    state.interactionTime = 0;
    state.interactionPhase = null;
    setStatus("CONFINEMENT · pulling selected valence quark", true);
    renderInspector();
  });
  $$("[data-confinement-quark]").forEach((button) => button.addEventListener("click", () => {
    state.confinementChoice = Number(button.dataset.confinementQuark);
    state.confinementPulled = false;
    state.interaction = null;
    state.interactionTime = 0;
    rebuildSpecimen();
    renderInspector();
  }));

  $("#blackHoleBackendBtn")?.addEventListener("click", () => runBackendSolver());
  $("#openMultiQuarkLabBtn")?.addEventListener("click", openMultiQuarkLab);
  $("#copyQuantumQasmBtn")?.addEventListener("click", async () => {
    const source = state.solverResult?.state?.cloudHardwareDemo?.openQasm2;
    if (!source) return;
    const copied = await copyTextToClipboard(source);
    setStatus(copied ? "OPENQASM 2.0 · скопировано · облачная отправка не выполнялась" : "OPENQASM 2.0 · копирование заблокировано браузером", copied);
  });
  $("#copyQuantumPythonBtn")?.addEventListener("click", async () => {
    const source = state.solverResult?.state?.cloudHardwareDemo?.qiskitSamplerV2Python;
    if (!source) return;
    const copied = await copyTextToClipboard(source);
    setStatus(copied ? "QISKIT SAMPLERV2 · скопировано · добавьте собственные credentials" : "QISKIT SAMPLERV2 · копирование заблокировано браузером", copied);
  });
  $("#sourceLinks").innerHTML = model.sources.map(([label, url]) => `<a href="${url}" target="_blank" rel="noreferrer"><span>${label}</span><i data-lucide="external-link" aria-hidden="true"></i></a>`).join("");
  if (model.id === "neutrinoLens" && state.communicationOpen) renderCommunicationControls();
  if (model.visual === "molecule") bindChemistryPanel();
  if (model.visual === "smartMatter") bindSmartMatterPanel();
  if (model.visual === "smartProteinRepair") bindSmartProteinRepairPanel();
  if (model.visual === "mOrchestrator") mOrchestrator.bind();
  if (model.visual === "biomolecule") bindBiomoleculePanel();
  window.lucide?.createIcons();
}

function renderViewModes(model) {
  const buttons = $$("#viewModes button[data-view]");
  const ru = (localStorage.getItem("qcd-neutrino-language") || "en") === "ru";
  const labels = model.id === "blackHole"
    ? [["structure", "orbit", ru ? "Чёрная дыра" : "Black hole"], ["blackHoleMerger", "waves", ru ? "Симулятор слияния" : "Black-hole merger simulator"]]
    : model.visual === "mOrchestrator"
    ? [["structure", "orbit", ({ru:"M-аркестратор · конструктор",he:"מתזמר M · בונה",en:"M-orchestrator · constructor"})[localStorage.getItem("qcd-neutrino-language") || "en"]]]
    : model.visual === "resonantTriple"
    ? [["structure", "orbit", ru ? "Стабильная конфигурация (гипотеза)" : "Stable configuration (hypothesis)"]]
    : model.visual === "biomolecule"
    ? [["structure", "dna", model.biomoleculeKind === "dna" ? bioT("dna") : bioT("protein")]]
    : model.visual === "macro"
    ? [["structure", "orbit", ru ? "Объект" : "Object"]]
    : model.visual === "complexSpin"
    ? [["structure", "layers-3", ru ? "3D-проекция" : "3D projection"], ...(state.values.configuration === "lattice" ? [["passage", "scan-line", ru ? "Прохождение" : "Passage"]] : [])]
    : model.visual === "smartMatter"
    ? [["structure", "atom", ru ? "Сборка i→3D" : "i→3D assembly"]]
    : model.visual === "smartProteinRepair"
    ? [["structure", "database", ru ? "G₀ Исходный" : "G₀ Original"], ["damageGraph", "radiation", ru ? "Gᴅ Повреждённый" : "Gᴅ Damaged"], ["repairedGraph", "sparkles", ru ? "Gʀ Восстановленный" : "Gʀ Repaired"]]
    : model.visual === "polytope4d"
    ? [["structure", "layers-3", ru ? "3D-проекция" : "3D projection"]]
    : isBaryonModel(model)
    ? [["structure", "orbit", ru ? "Структура" : "Structure"], ["collision", "swords", ru ? "Столкнуть" : "Collide"], ["annihilation", "zap", ru ? "Аннигиляция" : "Annihilate"], ["confinement", "stretch-horizontal", ru ? "Конфайнмент" : "Confinement"]]
    : [["structure", "orbit", ru ? "Структура" : "Structure"], ["interaction", "zap", ru ? "Взаимодействие" : "Interaction"], ["field", "waves", ru ? "Поле" : "Field"]];
  if (model.visual === "complexSpin" && state.values.configuration === "lattice") {
    labels.push(["phaseDemo", "orbit", ru ? "Р¤Р°Р·РѕРІР°СЏ РґРµРјРѕРЅСЃС‚СЂР°С†РёСЏ" : "Phase demonstration"]);
  }
  if (!labels.some(([view]) => view === state.view)) state.view = "structure";
  buttons.forEach((button, index) => {
    const entry = labels[index];
    button.hidden = !entry;
    if (!entry) return;
    const [view, icon, label] = entry;
    button.dataset.view = view;
    button.innerHTML = `<i data-lucide="${icon}"></i> ${label}`;
    button.classList.toggle("active", state.view === view);
  });
  window.lucide?.createIcons();
}

function colliderBeamOptions() {
  return [
    ...Object.entries(BARYON_BEAMS).map(([id, [label]]) => [id, label]),
    ["pionPlus", "π⁺ · pion"], ["pionMinus", "π⁻ · pion"], ["electron", "e⁻ · electron"], ["positron", "e⁺ · positron"], ["muonMinus", "μ⁻ · muon"], ["muonPlus", "μ⁺ · antimuon"], ["photon", "γ · photon"]
  ];
}

function collisionExplanation() {
  const ru = (localStorage.getItem("qcd-neutrino-language") || "en") === "ru";
  const event = state.solverResult?.event;
  const process = state.solverResult?.state?.processLabel || "p + p → hadrons";
  const tracks = event?.tracks || [];
  if (event?.mode === "annihilation") {
    return `<section class="collision-explanation"><span>${ru ? "Аннигиляция" : "Annihilation"}</span><strong>${process}</strong><p>${ru ? "В этой наглядной сцене энергия покоя пары барион–антибарион показана как расширяющиеся фотонные фронты γ — жёлтые кольца и лучи. Поэтому здесь намеренно нет случайных треков «заряженных адронов»." : "This explanatory scene renders the baryon–antibaryon rest energy as expanding photon wavefronts γ — yellow rings and rays. It deliberately avoids generic charged-hadron tracks."}</p><small>${ru ? "В реальных p–p̄ аннигиляциях часто образуются пионы и другие адроны, которые затем распадаются; «чистая энергия» здесь означает перенос энергии фотонами в идеализированном радиационном канале." : "Real p–p̄ annihilations often produce pions and other hadrons which later decay; “pure energy” here means photon-carried energy in an idealised radiative channel."}</small></section>`;
  }
  const charged = tracks.filter((track) => track.type === "chargedHadron").length;
  const neutral = tracks.filter((track) => track.type === "neutralHadron" || track.type === "photon").length;
  const result = tracks.length
    ? (ru ? `В учебном событии получились ${charged} заряженных и ${neutral} нейтральных/фотонных кандидатов. Треки показывают возможные конечные продукты, но не являются точной идентификацией вида частицы.` : `The generated educational event contains ${charged} charged and ${neutral} neutral / photon candidates. Tracks are possible final-state particles, not a species-identification claim.`)
    : (ru ? "Выберите пучки и запустите столкновение. Здесь появится описание конечных продуктов." : "Choose beams and run the collision. The panel will describe the generated final-state candidates here.");
  return `<section class="collision-explanation"><span>${ru ? "Результат столкновения" : "Collision outcome"}</span><strong>${process}</strong><p>${result}</p><small>${ru ? "В pp-столкновении цветные партоны образуют струи и адронизируются; свободные кварки не показываются из-за конфайнмента." : "For pp collisions, colored partons shower and hadronize; isolated quarks are not shown because of confinement."}</small></section>`;
}

function confinementControls() {
  const ru = (localStorage.getItem("qcd-neutrino-language") || "en") === "ru";
  const labels = state.selected.composition.map((flavor, index) => `${flavorVisual(flavor).label}${index + 1}`);
  const progress = state.confinementPulled
    ? (ru ? "Анимация идёт: струна растягивается, затем рождается q q̄-пара." : "Animation running: the string stretches, then a q q̄ pair appears.")
    : (ru ? "Выберите один валентный кварк и запустите его вытягивание." : "Choose one valence quark and start pulling it.");
  return `<section class="confinement-explanation"><span>${ru ? "Демонстрация конфайнмента" : "Confinement demonstration"}</span><p>${ru ? "Цветовая трубка запасает энергию приблизительно как V(r) ≈ σr. При достаточном растяжении вакуум создаёт q q̄-пару: остаточный дикварк с новым q образует барион, а вытянутый q с новым q̄ — мезон. Свободный кварк не появляется." : "The colour-flux tube stores energy approximately as V(r) ≈ σr. Once stretched far enough, the vacuum creates a q q̄ pair: the residual diquark plus the new q form a baryon, and the pulled q plus the new q̄ form a meson. No free quark appears."}</p><div class="confinement-choices">${labels.map((label, index) => `<button class="solver-btn ${index === state.confinementChoice ? "active" : ""}" data-confinement-quark="${index}" type="button">${label}</button>`).join("")}</div><button id="confinementRunBtn" class="solver-btn" type="button">${ru ? "Вытянуть выбранный кварк" : "Pull selected quark"}</button><small>${progress}</small></section>`;
}

function setFormulaTerms(target, terms) {
  target.replaceChildren();
  terms.forEach(([symbol, explanation]) => {
    const dt = document.createElement("dt"); dt.textContent = symbol;
    const dd = document.createElement("dd"); dd.textContent = explanation;
    target.append(dt, dd);
  });
}

function formulaTermsFor(model) {
  if (model.id === "neutrinoLens") return [
    ["H", "Эффективный гамильтониан: оператор, задающий изменение квантового состояния при распространении."],
    ["H_vac", "Вакуумная часть: осцилляции, которые происходили бы без среды."],
    ["H_MSW", "Материальный вклад MSW: изменение фаз нейтрино при прохождении через обычную материю."],
    ["κ ρ a σₓ", "Гипотетический управляемый член модели линзы: κ — сила связи, ρ — плотность, a — анизотропия, σₓ — матрица Паули."],
    ["η ρ s σᵧ", "Дополнительный спин-зависимый член: η — эффективная связь, s — выбранная поляризация/ориентация, σᵧ — матрица Паули."],
    ["δ σ_z", "Расстройка уровней: δ задаёт относительное смещение фаз, σ_z различает два базисных состояния."],
    ["i dψ/dx = Hψ", "Уравнение эволюции вдоль пути x. ψ — двухкомпонентная амплитуда состояния; это аналог уравнения Шрёдингера по координате." ]
  ];
  if (model.formula.includes("alpha") || model.formula.includes("α")) return [
    ["αₛ", "Безразмерная константа сильного взаимодействия; её значение зависит от энергетического масштаба."],
    ["σ / κ", "Эффективное натяжение цветовой струны или коэффициент конфайнмента в феноменологической модели."],
    ["r", "Расстояние между степенями свободы в выбранной эффективной модели."],
    ["Формула", "Запись описывает эффективную модель, а не прямую фотографию внутренней структуры частиц."]
  ];
  return [
    ["Формула", "Математическая запись выбранной феноменологической или теоретической модели."],
    ["Параметры", "Управляющие величины перечислены ниже с текущими значениями; изменение ползунков пересчитывает локальную демонстрацию."],
    ["Статус", "Физический статус и границы применимости указаны в основной карточке модели и научных источниках."]
  ];
}

function openFormulaModal() {
  const model = state.selected;
  $("#formulaModalTitle").textContent = model.title;
  $("#formulaModalIntro").textContent = model.description;
  $("#formulaModalEquation").textContent = model.formula;
  setFormulaTerms($("#formulaModalTerms"), formulaTermsFor(model));
  const parameters = model.parameters.length ? model.parameters.map((parameter) => [parameter.label, `${state.values[parameter.key]}${parameter.unit ? ` ${parameter.unit}` : ""}`]) : [["Параметры", "Для этой справочной записи интерактивные параметры не заданы."]];
  setFormulaTerms($("#formulaModalParameters"), parameters);
  $("#formulaModalLimit").textContent = model.applicability;
  $("#formulaModal").hidden = false;
  window.lucide?.createIcons();
}

function closeFormulaModal() { $("#formulaModal").hidden = true; }

function selectModel(id) {
  const model = modelRegistry.find((item) => item.id === id);
  if (!model) return;
  state.selected = model;
  state.collisionContext = null;
  closeFormulaModal();
  if (model.id !== "neutrinoLens") $("#communicationPanel").hidden = true;
  initializeValues(model);
  if (model.visual === "molecule") ensureChemistryState(true);
  if (model.visual === "smartMatter") ensureSmartMatterState(true);
  if (model.visual === "smartProteinRepair") ensureSmartProteinRepairState(true);
  if (model.visual === "mOrchestrator") mOrchestrator.select();
  if (model.visual === "biomolecule") ensureBiomoleculeState(model, true);
  state.interaction = null;
  state.resonantTripleRunning = false;
  state.resonantTripleStabilizerAdded = false;
  state.resonantTwinStabilizerAdded = false;
  state.resonantTripleActivationTime = null;
  state.resonantTripleActivationProgress = 0;
  state.resonantTripleActivationAngle = 0;
  state.resonantTripleManualControl = false;
  state.resonantTripleManualAngle = 0;
  state.resonantTripleManualRadius = 1;
  state.interactionTime = 0;
  renderCatalog();
  renderInspector();
  $(".inspector-panel").scrollTop = 0;
  rebuildSpecimen();
  if (model.visual === "biomolecule") {
    state.solverResult = null;
    void activateBiomoleculeWorkspace(model);
  } else if (model.visual === "smartMatter") {
    runLocalSolver();
    void prepareSmartMatterPlan(false);
  } else if (model.visual === "smartProteinRepair") {
    state.solverResult = null;
    void prepareSmartProteinRepairPlan();
  } else {
    runLocalSolver();
  }
  resetCamera(false);
  setStatus("Система готова", false);
}

window.addEventListener("qcd-language-change", (event) => {
  setCatalogLocale(event.detail?.locale || "en");
  renderCatalog();
  renderInspector();
});

function familyTitle(family) {
  return ({ ordinary: "ordinary matter", dense: "dense matter", quark: "quark matter", meson: "meson spectroscopy", collider: "collider event lab", strange: "strange matter", hypothetical: "my hypotheses", macro: "macro objects", chemistry: "quantum chemistry", semiconductor: "semiconductor TCAD", biomolecule: "biomolecular structures" })[family] || family;
}

function interactionLabel(model) {
  if (state.collisionContext && isBaryonModel(model)) return state.view === "annihilation" ? "Запустить аннигиляцию" : "Столкнуть частицы";
  if (model.interaction === "photon") return "Возбудить / ионизировать";
  if (model.interaction === "weak") return "Показать β-распад";
  if (model.interaction === "neutrino") return "Послать нейтрино";
  if (model.interaction === "eos") return "Сжать материю";
  if (model.interaction === "stability") return "Проверить устойчивость";
  if (model.interaction === "binding") return "Проверить связывание";
  if (model.interaction === "stringBreak") return "Растянуть QCD-струну";
  if (model.id === "colliderWorkbench") return "Столкнуть выбранные пучки";
  if (model.interaction === "collision") return "Столкнуть протоны";
  if (model.interaction === "quantumChemistry") return "Рассчитать электронную структуру";
  if (model.interaction === "smartMatter") return "Создать молекулу";
  if (model.interaction === "smartProteinRepair") return "Гамма-облучение";
  if (model.interaction === "semiconductor") return "Решить p–n-переход";
  if (model.interaction === "gpuCompute") return "Запустить GPU-расчёт";
  return "Возбудить глюонное поле";
}

function formatParameter(value, parameter) {
  if (parameter.type === "select") return String(value);
  const step = Number(parameter.step || 1);
  const decimals = step >= 1 ? 0 : Math.min(6, Math.max(1, Math.ceil(-Math.log10(step))));
  return `${value.toFixed(decimals)}${parameter.unit ? ` ${parameter.unit}` : ""}`;
}

function solveBlackHolePreview(values) {
  const m1 = Number(values.binaryMassA || 36);
  const m2 = Number(values.binaryMassB || 29);
  const total = m1 + m2;
  const eta = m1 * m2 / (total * total);
  const chirp = Math.pow(m1 * m2, .6) / Math.pow(total, .2);
  const separation = Number(values.initialSeparation || 28);
  const spin = (Number(values.spinA || 0) * m1 * m1 + Number(values.spinB || 0) * m2 * m2) / Math.max(total * total, .001);
  const radiated = total * (.028 + .065 * 4 * eta);
  const remnant = total - radiated;
  const finalSpin = clamp(.45 + 1.15 * eta + .42 * spin, 0, .98);
  const fMerge = 4397 / Math.max(total, .1) * Math.pow(6 / Math.max(separation, 6), 1.5);
  const data = Array.from({ length: 180 }, (_, index) => {
    const x = -1 + index / 179 * 1.22;
    const p = clamp((x + 1) / .98, 0, 1);
    const frequency = fMerge * (.18 + 1.9 * p * p);
    const phase = 2 * Math.PI * frequency * (x + 1) * (.22 + .78 * p);
    const ringdown = x > .03 ? Math.exp(-(x - .03) * 13) * Math.sin(2 * Math.PI * fMerge * 2.1 * (x - .03)) : 0;
    return { x, primary: x < .03 ? Math.pow(p, 1.65) * Math.sin(phase) : ringdown, secondary: frequency };
  });
  return { kind: "black-hole-merger", xLabel: "time relative to merger, s", yLabel: "dimensionless strain (normalised)", primaryLabel: "analytic inspiral + ringdown strain", secondaryLabel: "GW frequency", data, metrics: [["chirp mass", chirp, "M☉"], ["remnant mass", remnant, "M☉"], ["final spin χ", finalSpin, ""]], state: { supported: String(values.binaryCount || "2") === "2", chirpMass: chirp, schwarzschildA: 2.95325008 * m1, schwarzschildB: 2.95325008 * m2, remnantMass: remnant, finalSpin, mergerFrequency: fMerge }, event: { process: "binaryBlackHoleMerger", model: "leading-order inspiral + damped ringdown", initialSeparation: separation }, backendHint: "Einstein Toolkit waveform import / EinsteinPy geodesic adapter" };
}

function solveResonantTriplePreview(values) {
  const a = Number(values.centralMassA || 30);
  const b = Number(values.centralMassB || 28);
  const c = Number(values.tertiaryMass || 7);
  const total = a + b + c;
  const separation = Number(values.centralSeparation || 22);
  const modulation = Number(values.outerModulation || .68);
  const chirp = Math.pow(a * b, .6) / Math.pow(a + b, .2);
  const f0 = 4397 / Math.max(a + b, .1) * Math.pow(14 / Math.max(separation, 6), 1.5);
  const data = Array.from({ length: 220 }, (_, index) => {
    const time = index / 219 * 18;
    const phase = time * f0 * .085;
    const envelope = .25 + .65 * (1 + Math.sin(time * .52 + modulation * 1.4)) / 2;
    const tertiaryModulation = 1 - .35 * modulation * (1 + Math.cos(time * .48)) / 2;
    return { x: time, primary: envelope * tertiaryModulation * Math.sin(phase * 2 * Math.PI), secondary: f0 * (.7 + envelope) };
  });
  return {
    kind: "resonant-triple-hypothesis",
    xLabel: "illustrative time, s",
    yLabel: "qualitative strain",
    primaryLabel: "controlled quadrupolar-wave proxy",
    secondaryLabel: "central-pair frequency proxy",
    data,
    metrics: [["central chirp mass", chirp, "M☉"], ["total input mass", total, "M☉"], ["outer / central mass", c / Math.max(a + b, .1), ""]],
    state: { supported: true, chirpMass: chirp, totalMass: total, schwarzschildA: 2.95325008 * a, schwarzschildB: 2.95325008 * b, schwarzschildC: 2.95325008 * c },
    event: { process: "resonantTripleHypothesis", model: "prescribed coplanar tertiary perturbation", centralSeparation: separation },
    backendHint: "Numerical relativity is required for quantitative three-black-hole evolution."
  };
}

function runLocalSolver() {
  if (state.selected.visual === "mOrchestrator") {
    state.solverResult = mOrchestrator.result();
    $("#chartSubtitle").textContent = state.solverResult.primaryLabel;
    $("#telemetrySolver").textContent = "M-field · local integrator";
    renderMetrics(); drawChart(); return;
  }
  const start = performance.now();
  const collisionModel = state.collisionContext ? modelRegistry.find((model) => model.id === "colliderWorkbench") : null;
  const collisionValues = state.collisionContext ? { ...state.values, ...state.collisionContext } : state.values;
  state.solverResult = state.selected.visual === "resonantTriple" ? solveResonantTriplePreview(state.values) : state.selected.id === "blackHole" && state.view === "blackHoleMerger" ? solveBlackHolePreview(state.values) : solveModel(collisionModel || state.selected, collisionValues);
  state.solverMs = performance.now() - start;
  $("#telemetrySolver").textContent = `local / ${state.solverMs.toFixed(2)} ms`;
  $("#chartSubtitle").textContent = state.solverResult.primaryLabel;
  const supported = state.solverResult.state?.supported !== false;
  $("#runInteractionBtn").disabled = (state.selected.interaction === "collision" || Boolean(state.collisionContext && isBaryonModel(state.selected))) && !supported;
  if (state.selected.id === "colliderWorkbench" || state.collisionContext) {
    const pair = `${beamLabel(collisionValues.beamA)} ↔ ${beamLabel(collisionValues.beamB)}`;
    $("#sceneScale").textContent = `${pair} · ${state.solverResult.state.processLabel}`;
    $("#telemetryObject").textContent = pair;
    $("#telemetryState").textContent = supported ? state.solverResult.state.processLabel : "unsupported pair";
  }
  renderMetrics();
  drawChart();
}

function renderMetrics() {
  $("#metricRow").innerHTML = state.solverResult.metrics.map(([label, value, unit]) => `<div class="metric"><span>${label}</span><b>${formatMetric(value, unit)}</b></div>`).join("");
}

function drawChart() {
  const chart = $("#resultChart");
  const rect = chart.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const width = Math.max(300, rect.width);
  const height = Math.max(130, rect.height);
  chart.width = Math.round(width * dpr);
  chart.height = Math.round(height * dpr);
  const ctx = chart.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  const data = state.solverResult?.data || [];
  if (!data.length) return;
  const pad = { left: 42, right: 12, top: 10, bottom: 28 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.primary);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (Math.abs(maxY - minY) < 1e-8) maxY = minY + 1;
  if (minY > 0) minY = 0;
  const sx = (x) => pad.left + (x - minX) / Math.max(maxX - minX, 1e-9) * plotW;
  const sy = (y) => pad.top + plotH - (y - minY) / Math.max(maxY - minY, 1e-9) * plotH;

  ctx.strokeStyle = "rgba(80, 119, 130, .32)";
  ctx.fillStyle = "#789197";
  ctx.lineWidth = 1;
  ctx.font = "9px Segoe UI";
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + plotH * i / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    const value = maxY - (maxY - minY) * i / 4;
    ctx.fillText(formatAxis(value), 2, y + 3);
  }
  ctx.fillText(state.solverResult.xLabel, pad.left, height - 5);

  const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
  gradient.addColorStop(0, "rgba(61, 212, 231, .28)");
  gradient.addColorStop(1, "rgba(61, 212, 231, 0)");
  ctx.beginPath();
  data.forEach((point, index) => index ? ctx.lineTo(sx(point.x), sy(point.primary)) : ctx.moveTo(sx(point.x), sy(point.primary)));
  ctx.lineTo(sx(data[data.length - 1].x), pad.top + plotH);
  ctx.lineTo(sx(data[0].x), pad.top + plotH);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.beginPath();
  data.forEach((point, index) => index ? ctx.lineTo(sx(point.x), sy(point.primary)) : ctx.moveTo(sx(point.x), sy(point.primary)));
  ctx.strokeStyle = "#3dd4e7";
  ctx.lineWidth = 2;
  ctx.stroke();

  const current = state.solverResult.state?.current;
  if (current && Number.isFinite(current.x) && Number.isFinite(current.primary)) {
    ctx.beginPath();
    ctx.arc(sx(current.x), sy(current.primary), 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#f2bf5b";
    ctx.fill();
    ctx.strokeStyle = "#061016";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function formatAxis(value) {
  if (Math.abs(value) >= 10000) return value.toExponential(1);
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function applyViewMode() {
  fieldObjects.forEach((object) => { if (!object.userData.ownsVisibility) object.visible = true; });
  if (currentShell) currentShell.visible = state.view !== "field";
  primaryParticles.forEach((object) => { if (!object.userData.ownsVisibility) object.visible = true; });
}

function blackHoleMergerPanel() {
  const m1 = Number(state.values.binaryMassA || 36);
  const m2 = Number(state.values.binaryMassB || 29);
  const m3 = Number(state.values.binaryMassC || 18);
  const radiusA = 2.95325008 * m1;
  const radiusB = 2.95325008 * m2;
  const radiusC = 2.95325008 * m3;
  const threeBody = String(state.values.binaryCount) === "3";
  return `<section class="black-hole-merger-panel">
    <div class="collider-controls-title">Gravitational-wave merger laboratory</div>
    <strong>${threeBody ? "Three-body visual concept" : "Binary black-hole analytic preview"}</strong>
    <p>Schwarzschild radii are derived from mass, not chosen independently: rₛ(A) = ${radiusA.toFixed(1)} km, rₛ(B) = ${radiusB.toFixed(1)} km${threeBody ? `, rₛ(C) = ${radiusC.toFixed(1)} km` : ""}. The displayed horizon size changes proportionally with mass.</p>
    <p>${threeBody ? `The three bodies remain visible through a staged A+B merger followed by the final merger with C. The final display mass is ${ (m1 + m2 + m3).toFixed(1) } M☉, the sum of the input masses for visual continuity. Real mergers radiate energy, so this is not physical mass accounting.` : "The local backend calculates chirp mass, inspiral frequency, radiated-energy estimate and a ringdown proxy. The displayed strain is a leading-order educational waveform."}</p>
    <p><strong>What is sourced:</strong> the orbitable object rendering is informed by Eric Bruneton’s open black-hole shader and the catalogue links to its paper and source. <strong>What is illustrative:</strong> this animated surface is an embedding diagram for curvature and the outgoing quadrupole pulse; it is not a literal three-dimensional shape of spacetime.</p>
    <button id="randomizeMergerBtn" class="solver-btn" type="button">Randomise planar orbit layout</button>
    <button id="blackHoleBackendBtn" class="solver-btn" type="button">Recalculate with local backend</button>
    <small>For scientifically resolved spacetime evolution, import a traceable numerical-relativity waveform / dataset generated with Einstein Toolkit or another validated solver. EinsteinPy is suitable for optional geodesic calculations, not for replacing a full merger evolution.</small>
  </section>`;
}

function resonantTriplePanel() {
  const a = Number(state.values.centralMassA || 30);
  const b = Number(state.values.centralMassB || 28);
  const c = Number(state.values.tertiaryMass || 7);
  const running = state.resonantTripleRunning;
  const locale = state.locale || "en";
  const copy = locale === "ru" ? {
    title: "Периодическая балансировка четырьмя телами · проектная гипотеза",
    state: running ? "Автоматический цикл балансировки активен" : "Автоматическая балансирующая конфигурация готова",
    first: "Два центральных горизонта следуют барицентрическому циклу сближения и пролёта, создавая качественный квадрупольный волновой отклик. Четыре более лёгкие балансирующие чёрные дыры присутствуют с самого начала на одной орбитальной плоскости; ни одно тело не добавляется вручную во время опыта.",
    second: "Внешняя четвёрка движется по гладким фазово-заданным орбитам. Она подходит ближе всего около максимальной амплитуды центральной волны, создаёт симметричное приливное возмущение, а затем удаляется. Отображаемый цикл: сближение → пик волн → приливный пролёт → разлёт → новое сближение.",
    mass: `Центральные массы: A = ${a.toFixed(1)} M☉, B = ${b.toFixed(1)} M☉. Масса каждого балансировщика — ${c.toFixed(1)} M☉; используются четыре тела, чтобы компенсировать ведущий сдвиг центра масс, сохраняя видимый своевременный приливный вклад.`,
    scope: "Физические рамки:",
    scopeText: "это управляемая копланарная учебная модель начальных условий. Реальная длительная многотельная эволюция чёрных дыр с реакцией излучения требует численной ОТО и обычно не является постоянно устойчивой. Поэтому приложение показывает предписанную траекторию обратной связи, а не заявляет о новом устойчивом астрофизическом решении.",
    foot: "Кнопка «Запустить процесс» запускает или перезапускает полную конфигурацию. Центральные A+B показаны как гравитационно взаимодействующие тела; только внешняя четвёрка использует заданную траекторию обратной связи."
  } : locale === "he" ? {
    title: "איזון מחזורי בארבעה גופים · השערת פרויקט",
    state: running ? "מחזור האיזון האוטומטי פעיל" : "תצורת האיזון האוטומטית מוכנה",
    first: "שני האופקים המרכזיים נעים במחזור בריצנטרי של התקרבות ומעבר־חולף ומייצרים קירוב איכותי של גל כבידה קוודרופולי. ארבעה חורים שחורים מאזנים וקלים יותר קיימים מתחילת הניסוי באותו מישור מסלולי; שום גוף אינו נוסף ידנית במהלך ההרצה.",
    second: "הרביעייה החיצונית נעה במסלולים חלקים המתוזמנים לפי פאזה. היא מתקרבת ביותר סמוך לשיא משרעת הגל המרכזי, יוצרת הפרעת גאות סימטרית ואז מתרחקת. המחזור המוצג הוא: התקרבות → שיא גלים → מעבר גאות → התרחקות → התקרבות חדשה.",
    mass: `המסות המרכזיות: A = ${a.toFixed(1)} M☉, B = ${b.toFixed(1)} M☉. מסתו של כל גוף מאזן היא ${c.toFixed(1)} M☉; ארבעה גופים משמשים כדי לבטל את הדחף המוביל של מרכז המסה, תוך שמירה על תרומת גאות מתוזמנת ונראית.`,
    scope: "תחום פיזיקלי:",
    scopeText: "זהו מודל לימודי מבוקר וקו־מישורי של תנאי התחלה. אבולוציה אמיתית ארוכת־טווח של כמה חורים שחורים עם תגובת קרינה מחייבת יחסות נומרית ובדרך כלל אינה יציבה לצמיתות. לכן היישום מציג מסלול משוב מוגדר, ולא טענה לפתרון אסטרופיזי יציב חדש.",
    foot: "הכפתור «הפעלת התהליך» מפעיל או מפעיל מחדש את התצורה המלאה. הזוג A+B מוצג כגופים בעלי אינטראקציה כבידתית; רק הרביעייה החיצונית משתמשת במסלול משוב מוגדר."
  } : {
    title: "Periodic six-black-hole balancing · project hypothesis",
    state: running ? "Automatic balancing cycle active" : "Automatic balancing configuration ready",
    first: "Two central horizons follow a barycentric approach–fly-by cycle and emit a qualitative quadrupole-wave proxy. Four lighter balancing black holes are present from the start on the same orbital plane; no body is manually injected during the run.",
    second: "The outer quartet follows smooth, phase-scheduled orbital corrections. It approaches most closely near the maximum central-wave amplitude, applies a symmetric tidal perturbation, and then returns outward. The displayed cycle is: approach → peak wave emission → tidal fly-by → separation → next approach.",
    mass: `Central masses: A = ${a.toFixed(1)} M☉, B = ${b.toFixed(1)} M☉. Each balancing body has ${c.toFixed(1)} M☉; four bodies are used so their leading centre-of-mass push cancels while their timed tidal contribution remains visible.`,
    scope: "Physical scope:",
    scopeText: "this is a controlled, coplanar educational initial-condition model. Real long-lived multi-black-hole systems with radiation reaction require numerical relativity and are generally not permanently stable. The application therefore shows a prescribed feedback trajectory, not a claimed new stable astrophysical solution.",
    foot: "Use “Start process” to run or restart the complete configuration. Central A+B are displayed as gravitationally interacting bodies; only the outer quartet uses the designed feedback trajectory."
  };
  return `<section class="black-hole-merger-panel">
    <div class="collider-controls-title">${copy.title}</div>
    <strong>${copy.state}</strong>
    <p>${copy.first}</p>
    <p>${copy.second}</p>
    <p>${copy.mass}</p>
    <p><strong>${copy.scope}</strong> ${copy.scopeText}</p>
    <small>${copy.foot}</small>
  </section>`;
  const path = ({ rosette: "rosette precession", libration: "co-orbital libration", horseshoe: "horseshoe-like passage" })[state.values.outerTrajectory] || "controlled planar path";
  const started = state.resonantTripleRunning;
  const added = state.resonantTripleStabilizerAdded;
  const twinAdded = state.resonantTwinStabilizerAdded;
  const manual = state.resonantTripleManualControl;
  const complete = started && state.interactionTime >= getMergerDuration();
  const manualControls = added ? `
    <div class="collider-controls-title">Tertiary-body control</div>
    <button id="resonantManualToggleBtn" class="solver-btn" type="button">${manual ? "Use automatic orbit" : "Take manual control"}</button>
    <button id="removeResonantStabilizerBtn" class="solver-btn" type="button">Remove tertiary · resume A+B merger</button>
    ${manual ? `<label class="param-row"><span>Planar angle <output id="resonantTertiaryAngleOut">${Math.round(state.resonantTripleManualAngle)}°</output></span><input id="resonantTertiaryAngle" type="range" min="-180" max="180" step="1" value="${state.resonantTripleManualAngle}" /></label>
    <label class="param-row"><span>Orbital distance <output id="resonantTertiaryRadiusOut">${Number(state.resonantTripleManualRadius).toFixed(2)}×</output></span><input id="resonantTertiaryRadius" type="range" min="0.28" max="2.4" step="0.01" value="${state.resonantTripleManualRadius}" /></label>` : ""}
    <small>Manual control remains coplanar. At large distance the tertiary tidal effect fades and A+B follows the ordinary merger. Removing the third body restores the A+B inspiral at its current separation.</small>` : "";
  return `<section class="black-hole-merger-panel">
    <div class="collider-controls-title">Stable configuration · project hypothesis</div>
    <strong>${twinAdded ? "Symmetric two-body fly-by active" : added ? "Tertiary perturbation active" : "Base binary-inspiral mode"}</strong>
    <p>Before the tertiary is added, A+B follows the same barycentric inspiral and outgoing quadrupole-wave visual logic as the ordinary binary-merger laboratory. The two horizons orbit their common centre of mass while their separation contracts.</p>
    <button id="addResonantStabilizerBtn" class="solver-btn" type="button" ${(!started || added || complete) ? "disabled" : ""}>${added ? "Tertiary black hole added" : "Add tertiary black hole"}</button>
    <button id="addResonantTwinBtn" class="solver-btn" type="button" ${(!started || !added || twinAdded || complete) ? "disabled" : ""}>${twinAdded ? "Symmetric balancing body added" : "Add symmetric second balancing body"}</button>
    <p>${added ? `The lighter third body now follows the selected <strong>${path}</strong> path on the same plane. Its effect is tidal and depends on its distance: far away, A+B keeps the ordinary inspiral; nearby, the pair centre, orbital phase, and contraction rate are perturbed. This is not a proven permanent three-body equilibrium.` : (started ? "Add the tertiary during the inspiral to compare a distance-dependent perturbation with the base binary merger." : "Start the binary merger first; the third body is deliberately absent from the base state.")}</p>
    ${twinAdded ? `<p>Two equal external black holes now make a symmetric, coplanar fly-by. Their effect is evaluated from distance and phase: if they remain far away, A+B still merges; only a close, timed pass can redirect the central pair into a non-merging scattering pass. This is a controlled initial-condition scenario, not a claimed generic four-body equilibrium.</p>` : ""}
    ${manualControls}
    <p>Schwarzschild radii are derived from the masses: rₛ(A) = ${(2.95325008 * a).toFixed(1)} km, rₛ(B) = ${(2.95325008 * b).toFixed(1)} km, rₛ(C) = ${(2.95325008 * c).toFixed(1)} km. Horizon size in the scene follows these masses.</p>
    <p><strong>Physical scope:</strong> the changing third-body path is prescribed for an educational resonance demonstration. Full three-body evolution with gravitational radiation is chaotic and requires numerical relativity; this view does not claim a truly stable configuration that permanently prevents merger.</p>
    <small>Use the trajectory and modulation controls to compare visually distinct coplanar perturbations. The continuous wavefronts are a qualitative quadrupole proxy, not a LIGO-ready waveform.</small>
  </section>`;
}

function mFieldProjectionPanel() {
  const p = mFieldProjection();
  const rows = [
    ["Scalar / mass mode", p.scalar, "#66e9b4"],
    ["Vector / EM mode", p.vector, "#b48cff"],
    ["Tensor / metric mode", p.tensor, "#f4ce68"]
  ];
  return `<section class="collision-explanation"><div class="collider-controls-title">Phase-to-Spin Projection</div><p>The i-phase redistributes the visible 3D projection; it does not turn one literal spin into another.</p>${rows.map(([label, value, color]) => `<div style="display:grid;grid-template-columns:1fr auto;gap:6px;margin:8px 0 3px"><span>${label}</span><strong>${Math.round(value * 100)}%</strong></div><div style="height:5px;background:#10242d;border-radius:9px;overflow:hidden"><div style="height:100%;width:${(value * 100).toFixed(1)}%;background:${color}"></div></div>`).join("")}<small>i-coupling ${(p.coupling * 100).toFixed(0)}% · leakage Im(s) ${(p.leakage * 100).toFixed(0)}% · coherence ${(p.coherence * 100).toFixed(0)}%</small></section>`;
}

function matrixPassageExplanation() {
  const probe = {
    photon: ["Photon", "refraction and phase shift", "The ray bends slightly while crossing the effective M-field."],
    electron: ["Electron", "potential deflection", "The charged probe follows the strongest curved trajectory in the displayed field."],
    neutrino: ["Neutrino", "phase delay", "The path remains nearly straight; the visible response is an exaggerated phase marker."],
    protonPair: ["Proton pair", "effective repulsion control", "Two proton markers cross ordinary 3D space. The project M-field tension changes only their illustrative separation response."],
    microBlackHole: ["Microscopic black hole", "effective trajectory control", "A compact test-body marker crosses ordinary 3D space. In the tensor (spin-2) preset, two markers are shown so the tension control can illustrate stronger or weaker pair convergence."],
    atom: ["Neutral atom", "energy-level shift", "The trajectory is weakly perturbed and the orbit marker changes scale in the field."]
  }[state.values.probeType] || ["Probe", "effective response", "Choose a probe interaction."];
  const axis = {
    i: "i-axis reference phase",
    x: "x-axis transverse response",
    y: "y-axis lateral response",
    z: "z-axis longitudinal response"
  }[state.values.probeAxis] || "i-axis reference phase";
  const mode = {
    scalar: ["Scalar M-quant", "a localized phase and effective-mass response is sampled within the bounded 3D volume."],
    vector: ["Vector M-quant", "the field supplies a direction-dependent effective response, shown as the strongest probe deflection."],
    standing: ["Distributed M-wave", "the field is a standing spatial mode: a probe couples to a distributed amplitude rather than to individual lattice dots."]
  }[state.values.mMode] || ["M-field", "Choose a field mode."];
  return `<section class="collision-explanation"><div class="collider-controls-title">3D M-field passage · educational hypothesis</div><strong>${mode[0]}</strong><p>${mode[1]}</p><strong>${probe[0]}: ${probe[1]}</strong><p>${probe[2]}</p><p><strong>Selected control:</strong> ${axis}; M-field tension ${Math.round((state.values.fieldTension ?? .58) * 100)}%.</p><small>The probe moves only through ordinary x, y, z space. The grid is a 3D sampling of a bounded M-field; it is not a set of visible 4D particles. These trajectory and pair responses are author-defined teaching analogies, not an experimentally established interaction or a simulation of microscopic black holes.</small></section>`;
}

function phaseDemoExplanation() {
  const p = mFieldProjection();
  const scenario = p.tensor > p.vector && p.tensor > p.scalar
    ? ["Tensor / metric mode", "Two compact test bodies enter the bounded 3D field and follow visibly converging effective trajectories."]
    : p.vector > p.scalar
    ? ["Vector / magnetic mode", "Two magnetic dipoles demonstrate an effective attraction or repulsion inside the field volume."]
    : p.scalar > .45
    ? ["Scalar / mass mode", "A local two-body bound system breathes as its effective binding and mass response are modulated."]
    : ["Mixed projection", "The scene combines scalar, vector and metric-like responses in a single explicitly hypothetical visualization."];
  return `<section class="collision-explanation"><div class="collider-controls-title">Phase demonstration</div><strong>${scenario[0]}</strong><p>${scenario[1]}</p><small>These are qualitative effective-field analogies, not simulations of a new fundamental interaction or general relativity.</small></section>`;
}

function runInteraction() {
  if (state.selected.visual === "mOrchestrator") { mOrchestrator.toggle(); return; }
  const matrixPassage = state.selected.visual === "complexSpin" && state.values.configuration === "lattice" && state.view === "passage";
  const phaseDemo = state.selected.visual === "complexSpin" && state.values.configuration === "lattice" && state.view === "phaseDemo";
  const collisionMode = Boolean(state.collisionContext && isBaryonModel(state.selected));
  const blackHoleMerger = state.selected.id === "blackHole" && state.view === "blackHoleMerger";
  const resonantTriple = state.selected.visual === "resonantTriple";
  const standingWaveCore = state.selected.visual === "standingWaveCore";
  const smartMatter = state.selected.visual === "smartMatter";
  if (smartMatter) {
    startSmartMatterAssembly();
    return;
  }
  if (state.selected.visual === "smartProteinRepair") {
    const repair = ensureSmartProteinRepairState();
    if (repair?.stage === "DAMAGED") releaseProteinRepairMatter();
    else irradiateSmartProtein();
    return;
  }
  // The torus is continuously animated. Its primary action is therefore a
  // real transport control, not a one-shot particle interaction.
  if (standingWaveCore) {
    $("#pauseBtn").click();
    renderInspector();
    setStatus(state.paused ? "WAVE FIELD PAUSED" : "WAVE FIELD PLAYING", true);
    return;
  }
  if ((state.selected.interaction === "collision" || collisionMode) && state.solverResult?.state?.supported === false) {
    setStatus(`НЕПОДДЕРЖИВАЕМАЯ ПАРА · ${state.solverResult.state.reason}`, false);
    return;
  }
  state.interaction = resonantTriple ? "resonantTriple" : blackHoleMerger ? "blackHoleMerger" : standingWaveCore ? "standingWaveResonance" : phaseDemo ? "phaseDemo" : matrixPassage ? "matrixPassage" : collisionMode ? "collision" : state.selected.interaction;
  state.blackHoleMergerRunning = blackHoleMerger;
  state.resonantTripleRunning = resonantTriple;
  if (resonantTriple) {
    state.resonantTripleStabilizerAdded = false;
    state.resonantTwinStabilizerAdded = false;
    state.resonantTripleActivationTime = null;
    state.resonantTripleActivationProgress = 0;
    state.resonantTripleActivationAngle = 0;
    state.resonantTripleManualControl = false;
    state.resonantTripleManualAngle = 0;
    state.resonantTripleManualRadius = 1;
  }
  state.interactionTime = 0;
  state.interactionPhase = null;
  disposeGroup(effects);
  if (state.interaction === "phaseDemo") buildPhaseProjectionDemo();
  else if (state.interaction === "matrixPassage") buildMatrixPassageEffect();
  else if (state.interaction === "photon") buildPhotonEffect();
  else if (state.interaction === "weak") buildWeakEffect();
  else if (state.interaction === "neutrino") buildNeutrinoPulse();
  else if (state.interaction === "eos") buildCompressionEffect();
  else if (state.interaction === "stability") buildStabilityEffect();
  else if (state.interaction === "binding") buildBindingEffect();
  else if (state.interaction === "stringBreak") buildStringBreakingEffect();
  else if (state.interaction === "collision") buildCollisionEffect();
  else if (state.interaction === "blackHoleMerger") rebuildSpecimen();
  else if (state.interaction === "resonantTriple") rebuildSpecimen();
  else if (state.interaction === "standingWaveResonance") { /* scene animation owns this educational resonance view */ }
  else buildBosonEffect();
  if (["collision", "blackHoleMerger", "resonantTriple"].includes(state.interaction)) renderInspector();
  setStatus(interactionStatusText(state.interaction), true);
  $("#telemetryState").textContent = state.solverResult?.event?.process || state.interaction;
}

function buildPhaseProjectionDemo() {
  const p = mFieldProjection();
  const addTrail = (points, color, opacity = .7) => {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
    effects.add(line);
    return line;
  };
  if (p.tensor > p.vector && p.tensor > p.scalar) {
    const leftCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-7, -1.9, .5), new THREE.Vector3(-2.4, -1.1, .2), new THREE.Vector3(-.4, -.15, 0)]);
    const rightCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(7, 1.9, -.5), new THREE.Vector3(2.4, 1.1, -.2), new THREE.Vector3(.4, .15, 0)]);
    const left = makeSphere(.62, new THREE.MeshStandardMaterial({ color: 0x627fbd, roughness: .42, metalness: .35 }), leftCurve.getPointAt(0).toArray(), 28);
    const right = makeSphere(.62, new THREE.MeshStandardMaterial({ color: 0x7d90b5, roughness: .42, metalness: .35 }), rightCurve.getPointAt(0).toArray(), 28);
    tagComponent(left, "macroBody", { role: "test body A", interaction: "effective tensor / metric mode" });
    tagComponent(right, "macroBody", { role: "test body B", interaction: "effective tensor / metric mode" });
    effects.add(left, right);
    addTrail(leftCurve.getPoints(90), 0xf4ce68, .66);
    addTrail(rightCurve.getPoints(90), 0xf4ce68, .66);
    animated.push({ type: "metricPair", left, right, leftCurve, rightCurve });
    return;
  }
  if (p.vector > p.scalar) {
    const left = makeSphere(.76, new THREE.MeshStandardMaterial({ color: 0xe26b6b, emissive: 0x5c1010, emissiveIntensity: .7, roughness: .32 }), [-4.4, 0, 0], 28);
    const right = makeSphere(.76, new THREE.MeshStandardMaterial({ color: 0x5e8fe4, emissive: 0x0d2058, emissiveIntensity: .7, roughness: .32 }), [4.4, 0, 0], 28);
    const fieldA = new THREE.Mesh(new THREE.TorusGeometry(1.16, .022, 8, 72), new THREE.MeshBasicMaterial({ color: 0xb48cff, transparent: true, opacity: .72 }));
    const fieldB = fieldA.clone();
    fieldA.position.copy(left.position); fieldB.position.copy(right.position);
    fieldA.rotation.y = Math.PI / 2; fieldB.rotation.y = Math.PI / 2;
    tagComponent(left, "magneticDipole", { role: "north-south dipole A", interaction: "effective vector mode" });
    tagComponent(right, "magneticDipole", { role: "north-south dipole B", interaction: "effective vector mode" });
    effects.add(left, right, fieldA, fieldB);
    addTrail([left.position.clone(), new THREE.Vector3(0, .7, 0), right.position.clone()], 0xb48cff, .82);
    animated.push({ type: "magneticPair", left, right, fieldA, fieldB });
    return;
  }
  const left = makeSphere(.62, new THREE.MeshStandardMaterial({ color: 0x67e9b0, emissive: 0x0f593e, emissiveIntensity: .72, roughness: .32 }), [-3.7, 0, 0], 28);
  const right = makeSphere(.62, new THREE.MeshStandardMaterial({ color: 0x67e9b0, emissive: 0x0f593e, emissiveIntensity: .72, roughness: .32 }), [3.7, 0, 0], 28);
  const link = addTrail([left.position.clone(), new THREE.Vector3(), right.position.clone()], 0x66e9b4, .82);
  tagComponent(left, "boundProbe", { role: "bound system A", interaction: "effective scalar / mass mode" });
  tagComponent(right, "boundProbe", { role: "bound system B", interaction: "effective scalar / mass mode" });
  effects.add(left, right);
  animated.push({ type: "scalarPair", left, right, link });
}

function buildMatrixPassageEffect() {
  const probeType = state.values.probeType || "photon";
  const modes = mFieldProjection();
  const axisResponse = { i: .18, x: .92, y: -.78, z: .46 }[state.values.probeAxis] ?? .18;
  const tension = Number(state.values.fieldTension ?? .58);
  const settings = {
    photon: { color: 0xf7c652, bend: .8, radius: .11, label: "photon · refracted through M-field" },
    electron: { color: 0xb28cff, bend: 1.65, radius: .14, label: "electron · deflected by M-field" },
    neutrino: { color: 0x54d8ff, bend: .13, radius: .09, label: "neutrino · phase-shifted through M-field" },
    protonPair: { color: 0xff746b, bend: .42, radius: .18, label: "proton pair · illustrative M-field repulsion response" },
    microBlackHole: { color: 0x05070a, bend: .55, radius: .28, label: "microscopic black-hole marker · illustrative M-field trajectory" },
    atom: { color: 0x63df9b, bend: .45, radius: .17, label: "atom · energy shift in M-field" }
  }[probeType];
  const isPair = probeType === "protonPair" || (probeType === "microBlackHole" && state.values.mMode === "tensor");
  const points = [];
  for (let index = 0; index <= 120; index += 1) {
    const progress = index / 120;
    const x = THREE.MathUtils.lerp(-7.4, 7.4, progress);
    const vectorBend = .28 + modes.vector * 1.45;
    const tensorBend = modes.tensor * .48 * Math.sin(Math.PI * progress * 2);
    const y = settings.bend * (vectorBend + tensorBend + axisResponse * .7) * Math.sin(Math.PI * progress) * (probeType === "electron" ? Math.sin(Math.PI * progress) : 1);
    const z = (probeType === "photon" ? .35 * Math.sin(Math.PI * progress * 2) : probeType === "atom" ? .2 * Math.sin(Math.PI * progress) : 0)
      + modes.tensor * .26 * Math.sin(Math.PI * progress * 2) + modes.scalar * .1 * Math.sin(Math.PI * progress * 5);
    points.push(new THREE.Vector3(x, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: settings.color, transparent: true, opacity: .66 }));
  tagComponent(trail, probeType === "neutrino" ? "neutrino" : probeType, { role: settings.label, medium: "bounded 3D M-field / phase-to-spin projection" });
  const probeMaterial = probeType === "microBlackHole"
    ? new THREE.MeshStandardMaterial({ color: settings.color, roughness: .2, metalness: .05 })
    : new THREE.MeshBasicMaterial({ color: settings.color });
  const probe = makeSphere(settings.radius, probeMaterial, points[0].toArray(), 16);
  tagComponent(probe, probeType === "neutrino" ? "neutrino" : probeType, { role: settings.label, medium: "bounded 3D M-field / phase-to-spin projection" });
  const phaseRing = new THREE.Mesh(new THREE.TorusGeometry(.34, .025, 8, 40), new THREE.MeshBasicMaterial({ color: settings.color, transparent: true, opacity: .72 }));
  phaseRing.rotation.x = Math.PI / 2;
  phaseRing.visible = probeType === "neutrino" || probeType === "atom" || modes.scalar > .42;
  if (!isPair) {
    effects.add(trail, probe, phaseRing);
    animated.push({ type: "matrixProbe", object: probe, curve, trail, phaseRing, probeType, settings, phase: 0 });
    return;
  }
  const separation = probeType === "protonPair"
    ? .7 + tension * 1.7 + modes.vector * .35
    : .38 + (1 - tension) * .88;
  const leftPoints = points.map((point, index) => point.clone().add(new THREE.Vector3(0, separation * (1 - index / 120), .12 * Math.sin(index / 120 * Math.PI))));
  const rightPoints = points.map((point, index) => point.clone().add(new THREE.Vector3(0, -separation * (1 - index / 120), -.12 * Math.sin(index / 120 * Math.PI))));
  const left = makeSphere(settings.radius, probeMaterial.clone(), leftPoints[0].toArray(), 18);
  const right = makeSphere(settings.radius, probeMaterial.clone(), rightPoints[0].toArray(), 18);
  const pairTrail = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: settings.color, transparent: true, opacity: .72 }));
  pairTrail.geometry.setFromPoints([left.position, right.position]);
  const leftHalo = new THREE.Mesh(new THREE.TorusGeometry(settings.radius * 1.85, .028, 8, 36), new THREE.MeshBasicMaterial({ color: probeType === "microBlackHole" ? 0xf7c652 : settings.color, transparent: true, opacity: .74 }));
  leftHalo.rotation.x = Math.PI / 2;
  const rightHalo = leftHalo.clone();
  tagComponent(left, probeType === "microBlackHole" ? "blackHole" : "proton", { role: `${settings.label} · body A`, spinMode: state.values.mMode });
  tagComponent(right, probeType === "microBlackHole" ? "blackHole" : "proton", { role: `${settings.label} · body B`, spinMode: state.values.mMode });
  effects.add(trail, left, right, pairTrail, leftHalo, rightHalo);
  animated.push({ type: "matrixProbePair", left, right, leftCurve: new THREE.CatmullRomCurve3(leftPoints), rightCurve: new THREE.CatmullRomCurve3(rightPoints), trail, link: pairTrail, leftHalo, rightHalo, probeType, tension });
}

function buildPhotonEffect() {
  const event = state.solverResult?.event || { process: "elastic", targetN: 1 };
  const count = clamp(Math.round((state.values.photonCount || 48) / 4), 5, 24);
  for (let i = 0; i < count; i += 1) {
    const mesh = makeSphere(i === 0 ? .13 : .055, mats.photon, [-8 - i * .28, i === 0 ? 0 : rand(-.42, .42), i === 0 ? 0 : rand(-.42, .42)], 12);
    tagComponent(mesh, "photon", { role: "incident", energy: event.photonEnergy });
    effects.add(mesh);
    animated.push({ type: "atomicPhoton", object: mesh, phase: i * .035, speed: .9 + i * .015, event, primary: i === 0, scatter: new THREE.Vector3(4.4, i === 0 ? .95 : rand(-.65, .65), i === 0 ? .35 : rand(-.65, .65)) });
  }
  if (event.process === "excitation") {
    const radius = 2.45 + (event.targetN - 1) * .66;
    const curve = new THREE.EllipseCurve(0, 0, radius, radius * .48, 0, Math.PI * 2);
    const pts = curve.getPoints(120).map((p) => new THREE.Vector3(p.x, p.y, 0));
    const orbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xf7c652, transparent: true, opacity: .72 }));
    orbit.rotation.set(.8, .45, .15);
    orbit.scale.setScalar(.01);
    effects.add(orbit);
    animated.push({ type: "transitionOrbit", object: orbit, phase: 0 });
  } else if (event.process === "ionization") {
    const direction = new THREE.Vector3(1, .52, .24).normalize();
    const arrow = new THREE.ArrowHelper(direction, new THREE.Vector3(), 5.6, 0xf7c652, .34, .17);
    arrow.visible = false;
    effects.add(arrow);
    animated.push({ type: "ionizationArrow", object: arrow, phase: 0 });
    const emitted = makeSphere(.14, mats.photon, [0, 0, 0], 14);
    emitted.visible = false;
    tagComponent(emitted, "photon", { role: "radiative recombination", energy: event.photonEnergy });
    effects.add(emitted);
    animated.push({ type: "recombinationPhoton", object: emitted, phase: 0, event, direction: new THREE.Vector3(-1, .58, -.34).normalize() });
  }
}

function buildWeakEffect() {
  const w = makeSphere(.28, mats.boson, primaryParticles[1]?.position.toArray() || [0, 0, 0], 18);
  const electron = makeSphere(.14, mats.electron, [0, 0, 0], 14);
  const neutrino = makeSphere(.12, mats.neutrino, [0, 0, 0], 14);
  electron.visible = false;
  neutrino.visible = false;
  effects.add(w, electron, neutrino);
  animated.push({ type: "weak", object: w, electron, neutrino, phase: 0 });
}

function buildNeutrinoPulse() {
  for (let i = 0; i < 14; i += 1) {
    const mesh = makeSphere(.09, i % 2 ? mats.helicity : mats.neutrino, [-9 - i * .5, 0, 0], 12);
    effects.add(mesh);
    animated.push({ type: "neutrinoPulse", object: mesh, phase: i * .08, speed: 1 });
  }
}

function buildCompressionEffect() {
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xf2bf5b, transparent: true, opacity: .7 });
  for (let i = 0; i < 4; i += 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5.5 + i * .8, .04, 6, 96), ringMat.clone());
    ring.rotation.set(Math.PI / 2, i * .3, 0);
    effects.add(ring);
    animated.push({ type: "compression", object: ring, phase: i * .2 });
  }
}

function buildStabilityEffect() {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.1, .08, 8, 96), new THREE.MeshBasicMaterial({ color: 0xf2bf5b, transparent: true, opacity: .8 }));
  ring.rotation.x = Math.PI / 2;
  effects.add(ring);
  animated.push({ type: "stability", object: ring, phase: 0 });
}

function buildBindingEffect() {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.45, .07, 8, 96), new THREE.MeshBasicMaterial({ color: 0xee72d5, transparent: true, opacity: .72 }));
  ring.rotation.x = Math.PI / 2;
  effects.add(ring);
  animated.push({ type: "binding", object: ring, phase: 0 });
}

function buildBosonEffect() {
  for (let i = 0; i < 8; i += 1) {
    const mesh = makeSphere(.12, mats.boson, [0, 0, 0], 12);
    effects.add(mesh);
    animated.push({ type: "boson", object: mesh, phase: i / 8 });
  }
}

function buildStringBreakingEffect() {
  if (!mesonVisual) return;
  const event = state.solverResult?.event || { thresholdDistance: .75, pairMass: .33 };
  const createdQ = createFlavorParticle("u", new THREE.Vector3(.18, 0, 0), .72);
  const createdAnti = createFlavorParticle("ubar", new THREE.Vector3(-.18, 0, 0), .72);
  createdQ.visible = false;
  createdAnti.visible = false;
  effects.add(createdQ, createdAnti);
  const daughterMaterial = new THREE.MeshBasicMaterial({ color: 0xf2bf5b, transparent: true, opacity: .72 });
  const leftString = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, 1, 14), daughterMaterial.clone());
  const rightString = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, 1, 14), daughterMaterial.clone());
  leftString.visible = false;
  rightString.visible = false;
  tagComponent(leftString, "mesonFluxString", { daughter: "left" });
  tagComponent(rightString, "mesonFluxString", { daughter: "right" });
  effects.add(leftString, rightString);
  const pairFlash = new THREE.Mesh(new THREE.SphereGeometry(.52, 20, 12), new THREE.MeshBasicMaterial({ color: 0xf8f2cf, transparent: true, opacity: 0, wireframe: true }));
  effects.add(pairFlash);
  animated.push({ type: "stringBreak", object: mesonVisual.string, createdQ, createdAnti, leftString, rightString, pairFlash, event, phase: 0 });
}

function collisionTrackPoints(track, magneticField) {
  const origin = new THREE.Vector3(...(track.origin || [0, 0, 0]));
  const direction = new THREE.Vector3(
    Math.cos(track.theta),
    Math.sin(track.theta) * Math.cos(track.phi),
    Math.sin(track.theta) * Math.sin(track.phi)
  ).normalize();
  const length = clamp(3.6 + Math.log10(Math.max(track.momentum, .1) + 1) * 2.25, 4, 9.5);
  const curvature = track.charge ? track.charge * magneticField / Math.max(track.momentum, .45) * .2 : 0;
  const normal = new THREE.Vector3(0, -direction.z, direction.y).normalize();
  const points = [];
  for (let i = 0; i <= 64; i += 1) {
    const t = i / 64;
    points.push(origin.clone().addScaledVector(direction, length * t).addScaledVector(normal, curvature * length * length * t * t));
  }
  return points;
}

function buildCollisionEffect() {
  if (!colliderVisual) return;
  const event = state.solverResult?.event;
  if (!event) return;
  colliderVisual.leftBeam.position.x = -8;
  colliderVisual.rightBeam.position.x = 8;
  colliderVisual.leftBeam.visible = true;
  colliderVisual.rightBeam.visible = true;
  const flash = makeSphere(.34, mats.boson, [0, 0, 0], 20);
  flash.scale.setScalar(.01);
  effects.add(flash);
  animated.push({ type: "collisionFlash", object: flash, phase: 0 });
  if (event.mode === "annihilation") {
    for (let i = 0; i < 3; i += 1) {
      const wave = new THREE.Mesh(new THREE.TorusGeometry(.22, .035, 8, 96), new THREE.MeshBasicMaterial({ color: 0xffe58a, transparent: true, opacity: .9, blending: THREE.AdditiveBlending }));
      wave.rotation.set(Math.PI / 2 + i * .62, i * .7, 0);
      wave.visible = false;
      effects.add(wave);
      animated.push({ type: "annihilationWave", object: wave, delay: i * .11 });
    }
  }
  event.tracks.forEach((track, index) => {
    const points = collisionTrackPoints(track, event.magneticField || 0);
    const color = track.type === "photon" ? 0xf7c652 : track.type === "muon" ? 0xee72d5 : track.type === "electron" ? 0x6da2ff : track.type === "positron" ? 0xf2bf5b : track.type === "neutralHadron" ? 0x8da7ae : track.charge > 0 ? 0x63df9b : 0x6da2ff;
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: track.primary ? .98 : .72 });
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    geometry.setDrawRange(0, 0);
    const line = new THREE.Line(geometry, material);
    const component = track.type === "photon" ? "photon" : track.type === "muon" ? "muon" : track.type === "electron" ? "electron" : track.type === "positron" ? "positron" : track.type === "neutralHadron" ? "neutralHadron" : "chargedHadron";
    const annihilationPhoton = event.mode === "annihilation" && track.type === "photon";
    const eventProduct = track.type === "chargedHadron" ? `outgoing charged-hadron candidate, q=${track.charge > 0 ? "+" : "−"}e` : track.type === "neutralHadron" ? "outgoing neutral-hadron candidate" : track.type === "muon" ? `outgoing ${track.charge > 0 ? "μ+" : "μ−"}` : track.type === "electron" ? "outgoing e−" : track.type === "positron" ? "outgoing e+" : annihilationPhoton ? `annihilation photon γ, E ≈ ${track.momentum.toFixed(2)} GeV` : "outgoing photon";
    tagComponent(line, component, { momentum: track.momentum, charge: track.charge, displaced: track.displaced, eventProduct, annihilationPhoton });
    effects.add(line);
    const marker = makeSphere(track.primary ? .12 : .065, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .92 }), points[0].toArray(), 10);
    tagComponent(marker, component, { momentum: track.momentum, charge: track.charge, eventProduct, annihilationPhoton });
    marker.visible = false;
    effects.add(marker);
    animated.push({ type: "collisionTrack", object: line, marker, points, delay: index * .012, phase: 0 });
  });
  for (const vertex of event.vertices.slice(1)) {
    const marker = makeSphere(.16, mats.helicity, vertex, 14);
    marker.visible = false;
    tagComponent(marker, "colliderDetector", { layer: "displaced vertex" });
    marker.userData.pickable = false;
    effects.add(marker);
    animated.push({ type: "displacedVertex", object: marker, phase: 0 });
  }
}

function interactionStatusText(type) {
  if (type === "standingWaveResonance") return "STANDING-WAVE CORE · author-defined resonance excitation";
  if (type === "phaseDemo") return "PHASE-TO-SPIN PROJECTION · qualitative 3D demonstration";
  if (type === "photon") {
    const event = state.solverResult?.event;
    if (event?.process === "ionization") return `PHOTOIONIZATION · Eγ − Eion = ${event.electronEnergy.toFixed(2)} eV`;
    if (event?.process === "excitation") return `PHOTOEXCITATION · 1s → n=${event.targetN}`;
    return "RAYLEIGH SCATTERING · photon is off resonance";
  }
  return ({ weak: "WEAK VERTEX · d → u + W⁻", neutrino: "HYPOTHETICAL LENS · integrating i dψ/dx = Hψ", eos: "EOS SWEEP · P(ε) recalculated", stability: "FINITE SIZE · E/A scan", binding: "TWO-BARYON CHANNEL · V(r) and binding estimate", stringBreak: "QCD STRING · κr grows until q-q̄ pair creation", collision: `COLLISION · ${state.solverResult?.state?.processLabel || "event generator"} · HepMC-ready`, matrixPassage: "M-FIELD PASSAGE · qualitative probe response", boson: "GLUON FIELD · color exchange" })[type] || "Вычисление";
}

function setStatus(text, active) {
  const el = $("#interactionStatus");
  el.textContent = text;
  el.classList.toggle("active", active);
}

function showComponentInfo(object) {
  const info = componentCatalog[object.userData.componentId];
  if (!info) return;
  state.selectedComponent = object;
  $("#componentType").textContent = info.type;
  $("#componentTitle").textContent = object.userData.eventProduct || info.title;
  $("#componentDescription").textContent = object.userData.eventProduct ? `${info.description} This clicked object is an ${object.userData.eventProduct}; its precise species requires detector identification.` : info.description;
  const facts = $("#componentFacts");
  facts.replaceChildren();
  info.facts.forEach(([label, value]) => {
    const term = document.createElement("dt");
    const definition = document.createElement("dd");
    term.textContent = label;
    definition.textContent = value;
    facts.append(term, definition);
  });
  $("#componentCaveat").textContent = info.caveat;
  $("#componentPopover").hidden = false;
  setStatus(`SELECTED · ${info.title}`, true);
  window.lucide?.createIcons();
}

function hideComponentInfo() {
  state.selectedComponent = null;
  const popover = $("#componentPopover");
  if (popover) popover.hidden = true;
}

function pickSceneComponent(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects([...specimen.children, ...effects.children], true);
  for (const hit of hits) {
    let object = hit.object;
    while (object && !object.userData.componentId) object = object.parent;
    if (object?.userData.componentId && object.userData.pickable !== false) {
      showComponentInfo(object);
      return;
    }
  }
  hideComponentInfo();
}

// Controlled external trajectories, force-driven central binary.  This compact
// educational N-body model is not numerical relativity: A and B receive only
// gravity plus smooth radiation-reaction-inspired damping; no scripted stop or
// position override is applied to either central horizon.
function updateResonantTripleDynamics(item, dt) {
  const running = state.interaction === "resonantTriple" && state.resonantTripleRunning;
  const logicalDt = running ? Math.min(.014, Math.max(.001, dt * .34)) : 0;
  const massScale = 1 / 20;
  const mA = item.masses.a * massScale;
  const mB = item.masses.b * massScale;
  const mOuter = item.masses.c / 16;
  const total = mA + mB;
  const G = 5.2;
  const softening2 = .34;
  if (!item.physics) {
    const separation = item.baseSeparation;
    const orbitalSpeed = Math.sqrt(G * total / Math.max(separation, .1));
    item.physics = {
      time: 0,
      a: new THREE.Vector3(-separation * mB / total, 0, 0),
      b: new THREE.Vector3(separation * mA / total, 0, 0),
      va: new THREE.Vector3(0, 0, orbitalSpeed * mB / total),
      vb: new THREE.Vector3(0, 0, -orbitalSpeed * mA / total),
      statusClock: 0
    };
  }
  const physics = item.physics;
  if (running) physics.time += logicalDt;
  const modulation = clamp(Number(state.values.outerModulation ?? .68), 0, 1);
  const relativeBeforeStep = physics.b.clone().sub(physics.a);
  const separationBeforeStep = Math.max(relativeBeforeStep.length(), .1);
  const radialDirection = relativeBeforeStep.multiplyScalar(1 / separationBeforeStep);
  const radialRate = physics.vb.clone().sub(physics.va).dot(radialDirection);
  const phase = physics.time * (.24 + modulation * .16);
  // The controller only chooses trajectories for the outer bodies.  A+B are
  // never placed on a prescribed path: they react to the Newtonian/1PN proxy
  // force generated by the bodies that happen to be nearby.
  const targetSeparation = item.baseSeparation * (1.02 + .13 * Math.sin(physics.time * .26));
  const separationError = clamp((targetSeparation - separationBeforeStep) / item.baseSeparation, -.45, .45);
  const brakingDemand = clamp(separationError * 1.9 - radialRate * .28, -.72, .72);
  const outerRadius = item.outerRadius * (1.04 - .15 * Math.abs(brakingDemand) + .06 * Math.sin(phase * .7));
  const rosette = (angle, scale = 1) => new THREE.Vector3(
    Math.cos(angle) * outerRadius * scale,
    0,
    Math.sin(angle) * outerRadius * (.67 + .09 * Math.cos(phase * 1.7)) * scale
  );
  // Only these four positions are controlled.  The first opposite pair is
  // placed along the instantaneous binary axis, so when A+B approach too
  // quickly it produces an outward *tidal* pull.  The second pair is phase
  // shifted and supplies a smooth torque.  Each opposite pair has zero net
  // force at the barycentre; the central bodies move only under the resulting
  // gravitational field, never by a position override.
  const axisAngle = Math.atan2(radialDirection.z, radialDirection.x);
  const radialAngle = axisAngle + .14 * Math.sin(phase * 1.6);
  const torqueAngle = axisAngle + Math.PI / 4 + brakingDemand * .46 + .18 * Math.sin(phase * 1.13);
  const radialScale = .72 - brakingDemand * .16;
  const torqueScale = 1.02 + brakingDemand * .11;
  const external = [
    rosette(radialAngle, radialScale),
    rosette(radialAngle + Math.PI, radialScale),
    rosette(torqueAngle, torqueScale),
    rosette(torqueAngle + Math.PI, torqueScale)
  ];
  const acceleration = (position, other, otherMass) => {
    const delta = other.clone().sub(position);
    return delta.multiplyScalar(G * otherMass / Math.pow(delta.lengthSq() + softening2, 1.5));
  };
  const calculateAcceleration = (position, companion, companionMass, selfVelocity, companionVelocity) => {
    const result = acceleration(position, companion, companionMass);
    external.forEach((body) => result.add(acceleration(position, body, mOuter)));
    const relativeVelocity = selfVelocity.clone().sub(companionVelocity);
    const separation2 = position.distanceToSquared(companion) + softening2;
    // A continuous quadrupole-radiation proxy.  It is deliberately weak so
    // it cannot create the visually abrupt braking produced by the old
    // scripted phase curve.  This is not a replacement for numerical GR.
    const damping = .0012 * Math.pow((item.baseSeparation * item.baseSeparation) / separation2, 1.1);
    const pnFactor = 1 + clamp((3 * G * total) / (separation2 * 120), 0, .16);
    return result.multiplyScalar(pnFactor).addScaledVector(relativeVelocity, -damping);
  };
  if (logicalDt) {
    // Velocity-Verlet: A+B evolve from calculated forces rather than from a
    // decorative prescribed orbit.
    const aa0 = calculateAcceleration(physics.a, physics.b, mB, physics.va, physics.vb);
    const ab0 = calculateAcceleration(physics.b, physics.a, mA, physics.vb, physics.va);
    physics.a.addScaledVector(physics.va, logicalDt).addScaledVector(aa0, .5 * logicalDt * logicalDt);
    physics.b.addScaledVector(physics.vb, logicalDt).addScaledVector(ab0, .5 * logicalDt * logicalDt);
    const aa1 = calculateAcceleration(physics.a, physics.b, mB, physics.va, physics.vb);
    const ab1 = calculateAcceleration(physics.b, physics.a, mA, physics.vb, physics.va);
    physics.va.addScaledVector(aa0.add(aa1), .5 * logicalDt);
    physics.vb.addScaledVector(ab0.add(ab1), .5 * logicalDt);
  }
  item.centralA.group.position.copy(physics.a);
  item.centralB.group.position.copy(physics.b);
  item.tertiary.group.position.copy(external[0]);
  item.tertiaryTwin.group.position.copy(external[1]);
  item.tertiaryFlankA?.group.position.copy(external[2]);
  item.tertiaryFlankB?.group.position.copy(external[3]);
  const relative = physics.b.clone().sub(physics.a);
  const separation = relative.length();
  const pairAngle = Math.atan2(relative.z, relative.x);
  const centralSpeed = physics.va.clone().sub(physics.vb).length();
  const waveStrength = clamp((centralSpeed * centralSpeed / Math.max(separation, .25)) * .12, .04, .72);
  [item.centralA, item.centralB, item.tertiary, item.tertiaryTwin, item.tertiaryFlankA, item.tertiaryFlankB].filter(Boolean).forEach((body, index) => {
    body.group.rotation.y += dt * (.9 + index * .1);
    body.disk.rotation.y += dt * (1.25 + index * .11);
    body.photonRing.rotation.z += dt * (.1 + index * .025);
  });
  item.centralOrbit.rotation.y = pairAngle;
  item.tertiaryOrbit.rotation.y = phase;
  item.twinOrbit.rotation.y = phase + Math.PI;
  if (item.flankOrbit) item.flankOrbit.rotation.y = phase + Math.PI / 2;
  const sources = [
    { object: item.centralA.group, mass: item.masses.a }, { object: item.centralB.group, mass: item.masses.b },
    { object: item.tertiary.group, mass: item.masses.c }, { object: item.tertiaryTwin.group, mass: item.masses.c },
    { object: item.tertiaryFlankA.group, mass: item.masses.c * .9 }, { object: item.tertiaryFlankB.group, mass: item.masses.c * .9 }
  ];
  const position = item.spacetime.geometry.attributes.position;
  const base = item.spacetime.base;
  const depthScale = clamp(Number(state.values.curvatureDepth ?? 2.2), .5, 3.5);
  const waveRadius = (physics.time * 5.5) % 21;
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const index3 = vertex * 3;
    const x = base[index3];
    const z = -base[index3 + 1];
    const wells = sources.reduce((sum, source) => {
      const d2 = (x - source.object.position.x) ** 2 + (z - source.object.position.z) ** 2;
      return sum - 3.5 * depthScale * (source.mass / 30) / (1 + d2 * 1.16);
    }, 0);
    const radius = Math.hypot(x, z);
    const azimuth = Math.atan2(z, x);
    const quadrupole = Math.cos(2 * (azimuth - pairAngle)) * Math.sin(radius * 1.65 - physics.time * 4.7) * waveStrength * Math.exp(-radius * .11);
    const outgoing = Math.cos(2 * (azimuth - pairAngle)) * Math.sin((radius - waveRadius) * 5.3) * waveStrength * .5 * Math.exp(-((radius - waveRadius) ** 2) / 2.2);
    position.setZ(vertex, wells + quadrupole + outgoing);
  }
  position.needsUpdate = true;
  item.spacetime.grid.material.opacity = clamp(Number(state.values.gridOpacity ?? .24), .03, .65);
  const waveOpacity = clamp(Number(state.values.waveOpacity ?? .82), 0, 1);
  item.wave.children.forEach((ring, index) => {
    if (ring === item.wave.userData.mergerFlash) return;
    const local = (physics.time * .36 - index * .1 + 1) % 1;
    ring.visible = waveOpacity > .005;
    const radius = .5 + local * (5.2 + index * .12);
    ring.scale.set(radius, radius, radius);
    ring.material.opacity = waveOpacity * waveStrength * Math.max(.04, (.82 - index * .03) * (1 - local));
  });
  item.wave.userData.mergerFlash.visible = false;
  physics.statusClock += dt;
  if (physics.statusClock > .3) {
    setStatus(`FORCE-DRIVEN BINARY · separation ${separation.toFixed(2)} · outer tidal controller ${brakingDemand >= 0 ? "braking approach" : "releasing orbit"}`, true);
    physics.statusClock = 0;
  }
}

function renderSmartAssembly(item) {
  const smart=item.smart, frame=assemblyFrame(smart.sequence), total=frame.atoms.length;
  item.atomMeshes.forEach((entry,index)=>{
    const atom=frame.atoms[index], nav=atom.navigation;
    entry.mesh.visible=atom.visible;
    entry.mesh.userData.iPosition=atom.i;
    entry.mesh.userData.smartState=atom.placed?'PLACED':atom.visible?'NAVIGATING':'OUTSIDE_3D';
    entry.mesh.scale.setScalar(atom.scale);
    entry.mesh.position.copy(item.startPoints[index]).lerp(item.targetPoints[index],nav*nav*(3-2*nav));
    entry.material.color.copy(entry.targetMaterial.color);
    entry.material.emissive.copy(entry.targetMaterial.emissive);
    entry.path.visible=atom.visible&&nav>0&&nav<1;
  });
  let formed=0;
  item.bonds.forEach(bond=>{
    const a=frame.atoms[bond.a], b=frame.atoms[bond.b];
    const progress=a.placed&&b.placed&&smart.plan.checks.valid?Math.min(a.bonding,b.bonding):0;
    bond.entries.forEach(link=>{link.visible=progress>0;link.material.opacity=.88*progress;});
    if(progress===1)formed++;
  });
  const opacity=Number(state.values.smartTargetOpacity??.18);
  item.guide.visible=opacity>.001&&frame.phase!=='STABLE';
  item.guide.traverse(child=>{if(child.material)child.material.opacity=opacity;});
  // Keep only unfilled matrix slots and missing links visible during assembly.
  item.guide.children.forEach((child,index)=>{
    child.visible=index<total?!frame.atoms[index].placed:(()=>{
      const [a,b]=smart.plan.constructionOrder[index-total];
      return !(frame.atoms[a].placed&&frame.atoms[b].placed);
    })();
  });
  smart.stage=frame.phase;smart.visibleAtoms=frame.visible;
  smart.bondedAtoms=frame.placed;smart.formedBonds=formed;
  const write=(id,value)=>{const node=$(id);if(node)node.textContent=value;};
  write('#smartVisibleCount',`${frame.visible} / ${total}`);
  write('#smartBondedCount',`${frame.placed} / ${total}`);
  write('#smartBondCount',`${formed} / ${item.bonds.length}`);
  const activeI=frame.atoms[frame.activeIndex]?.i??0;
  smart.message=frame.phase==='READY'?`${smart.plan.formula} · каркас цели · частицы скрыты при i<0`
    :frame.phase==='STABLE'?`${smart.plan.formula} · сборка завершена · graph PASS`
    :`${frame.phase} · частица ${frame.activeIndex+1}/${total} · i=${activeI.toFixed(2)} · установлено ${frame.placed}/${total}`;
  write('#smartMatterMessage',smart.message);
  $$('.smart-stage-track span').forEach(node=>node.classList.toggle('active',node.textContent===frame.phase));
  // DOM telemetry mirrors the actual render frame for inspection and QA.
  Object.assign(canvas.dataset,{assemblyPhase:frame.phase,assemblyVisible:String(frame.visible),
    assemblyPlaced:String(frame.placed),assemblyActive:String(frame.activeIndex),assemblyI:String(activeI)});
  if(frame.phase==='STABLE'&&smart.running){
    smart.running=false;
    write('#runInteractionBtn span','Повторить сборку');
  }
  setStatus(`SMART MATTER · ${smart.message}`,smart.running);
}

function updateAnimations(time, dt) {
  if (state.selected.visual === "mOrchestrator") { specimen.scale.set(1, 1, 1); mOrchestrator.tick(dt); return; }
  const visual = state.visual || deriveVisualState();
  const speed = (state.values.timeScale || state.values.decaySpeed || 1) * visual.motionSpeed * (state.selected.visual === "collider" ? (state.values.collisionSpeed ?? 1) : 1);
  const scaleTarget = new THREE.Vector3(
    visual.specimenScale * visual.lensStretch,
    visual.specimenScale * (1 + (visual.anisotropy - .5) * .12),
    visual.specimenScale * (1 - (visual.anisotropy - .5) * .08)
  );
  specimen.scale.lerp(scaleTarget, 1 - Math.exp(-dt * 7));
  if (state.interaction === "collision" && colliderVisual) {
    const approach = clamp(state.interactionTime / 1.15, 0, 1);
    const eased = approach * approach * (3 - 2 * approach);
    colliderVisual.leftBeam.position.x = THREE.MathUtils.lerp(-8, -.22, eased);
    colliderVisual.rightBeam.position.x = THREE.MathUtils.lerp(8, .22, eased);
    const visible = state.interactionTime < 1.28;
    colliderVisual.leftBeam.visible = visible;
    colliderVisual.rightBeam.visible = visible;
  }
  for (const item of animated) {
    const t = time * speed;
    if (item.object && !item.object.parent) continue;
    if (item.core && !item.core.parent) continue;
    if (item.type === "metricPair") {
      const progress = Math.min(1, state.interactionTime * .12);
      item.left.position.copy(item.leftCurve.getPointAt(progress));
      item.right.position.copy(item.rightCurve.getPointAt(progress));
      item.left.scale.setScalar(1 + .08 * Math.sin(t * 2));
      item.right.scale.setScalar(1 + .08 * Math.sin(t * 2 + Math.PI));
    } else if (item.type === "magneticPair") {
      const separation = 4.4 - .75 * Math.sin(state.interactionTime * .42) ** 2;
      item.left.position.x = -separation;
      item.right.position.x = separation;
      item.fieldA.position.copy(item.left.position);
      item.fieldB.position.copy(item.right.position);
      item.fieldA.rotation.z += dt * .55;
      item.fieldB.rotation.z -= dt * .55;
    } else if (item.type === "scalarPair") {
      const distance = 3.7 - .48 * Math.sin(state.interactionTime * .72) ** 2;
      item.left.position.x = -distance;
      item.right.position.x = distance;
      item.left.scale.setScalar(1 + .18 * Math.sin(t * 2.4));
      item.right.scale.setScalar(1 + .18 * Math.sin(t * 2.4));
      item.link.geometry.setFromPoints([item.left.position.clone(), new THREE.Vector3(), item.right.position.clone()]);
    } else if (item.type === "matrixProbe") {
      const progress = (state.interactionTime * .24) % 1;
      item.object.position.copy(item.curve.getPointAt(progress));
      item.object.scale.setScalar(1 + .18 * Math.sin(t * 5));
      item.trail.material.opacity = .42 + .22 * Math.sin(t * 2.6) ** 2;
      item.phaseRing.position.copy(item.object.position);
      item.phaseRing.rotation.z += dt * (item.probeType === "neutrino" ? 3.5 : 1.6);
      item.phaseRing.scale.setScalar(.8 + .28 * Math.sin(t * 6) ** 2);
    } else if (item.type === "matrixProbePair") {
      const progress = (state.interactionTime * .24) % 1;
      item.left.position.copy(item.leftCurve.getPointAt(progress));
      item.right.position.copy(item.rightCurve.getPointAt(progress));
      const pulse = 1 + .12 * Math.sin(t * 5.2);
      item.left.scale.setScalar(pulse);
      item.right.scale.setScalar(pulse);
      item.link.geometry.setFromPoints([item.left.position, item.right.position]);
      item.link.material.opacity = .38 + .32 * Math.sin(t * 3.1) ** 2;
      item.leftHalo.position.copy(item.left.position);
      item.rightHalo.position.copy(item.right.position);
      item.leftHalo.rotation.z += dt * (item.probeType === "microBlackHole" ? 1.4 : .6);
      item.rightHalo.rotation.z -= dt * (item.probeType === "microBlackHole" ? 1.4 : .6);
      const haloScale = item.probeType === "protonPair"
        ? 1 + (1 - item.tension) * .3 + .1 * Math.sin(t * 3)
        : .9 + item.tension * .24 + .08 * Math.sin(t * 3);
      item.leftHalo.scale.setScalar(haloScale);
      item.rightHalo.scale.setScalar(haloScale);
    } else if (item.type === "complexSpin" || item.type === "complexSpinLattice") {
      const projection = complexSpinProjection();
      const visiblePosition = projection.axes.map((axis) => projection.coordinates[axis]);
      const sliceRadius = projection.sliceRadius;
      const origin = new THREE.Vector3(visiblePosition[0] * 1.55, visiblePosition[1] * 1.55, visiblePosition[2] * 1.55);
      if (item.type === "complexSpinLattice") {
        // This scene represents a bounded M-field inside ordinary x,y,z space.
        // Do not let hidden-coordinate sliders move this experimental volume.
        origin.set(0, 0, 0);
        const matrix = new THREE.Matrix4();
        const modes = mFieldProjection();
        // Small dots and wide gaps make the macroscopic field extent legible.
        const scale = .028 + .019 * modes.scalar + .024 * modes.vector + .031 * modes.tensor;
        item.offsets.forEach((offset, index) => {
          matrix.compose(origin.clone().add(offset), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale));
          item.lattice.setMatrixAt(index, matrix);
        });
        item.lattice.instanceMatrix.needsUpdate = true;
        item.lattice.visible = true;
        item.lattice.material.opacity = Math.max(.12, .22 + modes.coherence * .32 - modes.leakage * .15);
        item.lattice.material.color.set(modes.tensor > modes.vector && modes.tensor > modes.scalar ? 0xf4ce68 : modes.vector > modes.scalar ? 0xb48cff : 0x66e9b4);
        const passageMode = state.view === "passage" || state.view === "phaseDemo";
        item.fieldVolume.position.copy(origin);
        item.fieldEdges.position.copy(origin);
        item.fieldVolume.visible = passageMode;
        item.fieldEdges.visible = passageMode;
        item.fieldVolume.material.opacity = .015 + modes.coherence * .05;
        item.fieldEdges.material.opacity = .14 + modes.coherence * .28;
      } else {
        item.core.position.copy(origin);
        item.core.visible = sliceRadius > .002;
        item.core.scale.setScalar(Math.max(.0001, sliceRadius));
        item.core.material.opacity = sliceRadius > .002 ? .14 + sliceRadius * .81 : 0;
      }
      // This arrow denotes the fixed i-axis, rather than a physical 3D
      // precession trajectory.  Keeping it stationary makes the projection
      // reference frame legible while the hypersphere itself changes slice.
      if (item.spinArrow) {
        item.spinArrow.setDirection(new THREE.Vector3(0, 1, 0));
        item.spinArrow.position.copy(origin);
        item.spinArrow.visible = projection.axes.includes("i") && sliceRadius > .06;
        item.spinArrow.setLength(.22 + sliceRadius * 2.2, .28, .14);
      }
    } else if (item.type === "standingWaveCore") {
      const values = state.values;
      const amplitude = Number(values.waveAmplitude ?? .62);
      const frequency = Number(values.waveFrequency ?? .72);
      const majorRadius = Number(values.torusMajorRadius ?? item.majorRadius);
      const tubeRadius = Number(values.torusTubeRadius ?? item.tubeRadius);
      const verticalHeight = Number(values.torusHeight ?? 1.15);
      const density = Number(values.waveModeCount ?? 4);
      const stability = Number(values.resonanceStability ?? .84);
      const travellingPeak = values.wavePattern === "centralPeak";
      const active = 1;
      const phase = t * frequency * Math.PI * 2;
      const cross = values.polarization === "cross";
      const elliptical = values.polarization === "elliptical";

      // Deform the *surface* of a solid torus in phase with the visual wave.
      // This is deliberately an illustrative mode shape, not a GR solution.
      const corePositions = item.core.geometry.attributes.position.array;
      for (let index = 0; index < corePositions.length; index += 3) {
        const x = item.coreBase[index];
        const y = item.coreBase[index + 1];
        const z = item.coreBase[index + 2];
        const radial = Math.max(Math.hypot(x, y), .0001);
        const azimuth = Math.atan2(y, x);
        const tubeAngle = Math.atan2(z, radial - item.majorRadius);
        const polarisation = cross ? Math.sin(2 * azimuth) : elliptical ? .72 + .28 * Math.cos(2 * azimuth + phase * .22) : Math.cos(2 * azimuth);
        const wavePhase = travellingPeak
          ? density * azimuth - phase * 1.25
          : density * azimuth - phase;
        const ripple = Math.sin(wavePhase) * Math.cos(tubeAngle * 2 + phase * .35) * polarisation;
        const displacement = amplitude * active * .28 * ripple;
        const radialScale = (radial + displacement) / radial;
        corePositions[index] = x * radialScale;
        corePositions[index + 1] = y * radialScale;
        corePositions[index + 2] = z + displacement * .52 * Math.sin(tubeAngle);
      }
      item.core.geometry.attributes.position.needsUpdate = true;
      item.core.geometry.computeVertexNormals();
      const overallPulse = 1 + amplitude * active * .055 * Math.cos(phase);
      // The major radius lives in the local x/y plane; the tube radius lives
      // along local z. This keeps both torus-size controls visually honest.
      item.core.scale.set(
        (majorRadius / item.majorRadius) * overallPulse,
        (majorRadius / item.majorRadius) * overallPulse,
        (tubeRadius / item.tubeRadius) * verticalHeight * overallPulse
      );
      item.core.material.emissiveIntensity = .34 + amplitude * active * (.22 + .18 * Math.cos(phase));
      item.core.rotation.z = .08 * amplitude * active * Math.sin(phase * .5) * stability;

      const positions = item.grid.geometry.attributes.position.array;
      for (let index = 0; index < positions.length; index += 3) {
        const x = item.baseGrid[index];
        const z = item.baseGrid[index + 2];
        const radius = Math.hypot(x, z);
        const angle = Math.atan2(z, x);
        const polarisation = cross ? Math.sin(2 * angle) : elliptical ? .65 + .35 * Math.cos(2 * angle + phase * .22) : Math.cos(2 * angle);
        // The travelling mode deliberately concentrates its largest visible
        // displacement at r = 0, then sends concentric wave crests outward.
        // It is a controllable educational field profile, not a GR solution.
        const centralWidth = Math.max(majorRadius * .42, 1.1);
        const standing = travellingPeak
          ? Math.exp(-(radius * radius) / (centralWidth * centralWidth)) * Math.cos(phase - radius * (.82 + density * .1)) * 3.35
          : Math.sin(radius * (.52 + density * .17)) * Math.cos(phase);
        positions[index] = x;
        // The central-peak profile is axisymmetric, so its strongest point stays
        // visible at r = 0 regardless of the selected plus/cross convention.
        positions[index + 1] = item.baseGrid[index + 1] - amplitude * active * 1.55 * standing * (travellingPeak ? 1 : polarisation);
        positions[index + 2] = z;
      }
      item.grid.geometry.attributes.position.needsUpdate = true;
      item.grid.material.opacity = Number(values.gridOpacity ?? .52);

      item.fronts.forEach((front, index) => {
        const envelope = travellingPeak
          ? .35 + .65 * Math.cos(phase * 1.18 - index * .9)
          : .5 + .5 * Math.cos(phase * (1 + index * .11) + index);
        const scale = (2.25 + index * 1.58) * (1 + amplitude * active * (travellingPeak ? .3 : .18) * envelope);
        front.scale.setScalar(scale);
        front.material.opacity = Number(values.frontOpacity ?? .30) * (.3 + envelope * .7) * (index % 2 ? .82 : 1);
        front.rotation.y += dt * (.08 + index * .015);
      });
    } else if (item.type === "tesseract") {
      const positions = item.geometry.attributes.position.array;
      if (state.values.tesseractMode === "projection") {
        TESSERACT_EDGES.forEach(([from, to], edge) => {
          positions.set(projectTesseractVertex(TESSERACT_VERTICES[from]), edge * 6);
          positions.set(projectTesseractVertex(TESSERACT_VERTICES[to]), edge * 6 + 3);
        });
        item.geometry.setDrawRange(0, TESSERACT_EDGES.length * 2);
        item.object.visible = true;
      } else {
        const slice = tesseractSliceSegments();
        slice.segments.forEach(([start, end], edge) => {
          positions.set(start, edge * 6);
          positions.set(end, edge * 6 + 3);
        });
        item.geometry.setDrawRange(0, slice.segments.length * 2);
        item.object.visible = slice.segments.length > 0;
      }
      item.geometry.attributes.position.needsUpdate = true;
      item.geometry.computeBoundingSphere();
    } else if (item.type === "quark") {
      const inertia = item.object.userData.componentId === "strangeQuark" ? 1.18 - visual.strangeMass * .38 : 1;
      const amplitude = (.045 + .065 * visual.motionAmplitude) * inertia;
      item.object.position.copy(item.base).add(new THREE.Vector3(Math.sin(t * .75 + item.phase), Math.cos(t * .9 + item.phase), Math.sin(t * .55 + item.phase)).multiplyScalar(amplitude));
      item.object.rotation.y += dt * .3;
    } else if (item.type === "mesonIdle") {
      if (state.interaction !== "stringBreak" && !(state.interactionTime > 0 && effects.children.length)) {
        const motion = .05 + visual.motionAmplitude * .025;
        mesonVisual.left.position.copy(mesonVisual.leftBase).add(new THREE.Vector3(0, Math.sin(t * .8) * motion, 0));
        mesonVisual.right.position.copy(mesonVisual.rightBase).add(new THREE.Vector3(0, -Math.sin(t * .8) * motion, 0));
        mesonVisual.string.visible = true;
        mesonVisual.fieldShell.visible = true;
        orientCylinderBetween(mesonVisual.string, mesonVisual.left.position, mesonVisual.right.position);
      }
    } else if (item.type === "stringBreak") {
      const initial = mesonVisual.worldSeparation;
      const threshold = item.event.thresholdDistance * 1.7;
      const finalSeparation = Math.max(initial + 3.2, threshold * 1.65);
      const stretch = clamp(state.interactionTime / 3.3, 0, 1);
      const eased = stretch * stretch * (3 - 2 * stretch);
      const separation = THREE.MathUtils.lerp(initial, finalSeparation, eased);
      mesonVisual.left.position.set(-separation / 2, Math.sin(t * .7) * .07, 0);
      mesonVisual.right.position.set(separation / 2, -Math.sin(t * .7) * .07, 0);
      const breakProgress = clamp((separation - threshold) / Math.max(finalSeparation - threshold, .01), 0, 1);
      const broken = separation >= threshold;
      mesonVisual.string.visible = !broken;
      mesonVisual.fieldShell.visible = !broken;
      if (!broken) orientCylinderBetween(mesonVisual.string, mesonVisual.left.position, mesonVisual.right.position);
      item.createdQ.visible = broken;
      item.createdAnti.visible = broken;
      item.leftString.visible = broken;
      item.rightString.visible = broken;
      if (broken) {
        const daughterOffset = .2 + breakProgress * .72;
        item.createdAnti.position.set(-daughterOffset, .08, 0);
        item.createdQ.position.set(daughterOffset, -.08, 0);
        orientCylinderBetween(item.leftString, mesonVisual.left.position, item.createdAnti.position);
        orientCylinderBetween(item.rightString, item.createdQ.position, mesonVisual.right.position);
        item.pairFlash.material.opacity = Math.max(0, .8 - breakProgress * 1.2);
        item.pairFlash.scale.setScalar(.35 + breakProgress * 2.2);
      }
    } else if (item.type === "baryonConfinement") {
      const pull = clamp(state.interactionTime / 2.25, 0, 1);
      const eased = pull * pull * (3 - 2 * pull);
      item.object.position.copy(item.origin).lerp(item.final, eased);
      item.mainFlux.visible = state.interaction === "baryonConfinement" && pull < .88;
      if (item.mainFlux.visible) orientCylinderBetween(item.mainFlux, item.origin, item.object.position);
      const pair = clamp((state.interactionTime - 1.65) / .7, 0, 1);
      const pairEased = pair * pair * (3 - 2 * pair);
      const pairCenter = item.origin.clone().lerp(item.object.position, .55);
      item.createdQ.position.copy(pairCenter).lerp(pairCenter.clone().add(new THREE.Vector3(-.32, .42, 0)), pairEased);
      item.createdAnti.position.copy(pairCenter).lerp(pairCenter.clone().add(new THREE.Vector3(.32, -.42, 0)), pairEased);
      item.createdQ.visible = item.createdAnti.visible = pair > .02;
      item.flash.position.copy(pairCenter);
      item.flash.material.opacity = pair > 0 && pair < 1 ? .58 * Math.sin(pair * Math.PI) : .06;
      item.flash.scale.setScalar(.35 + pair * 1.9);
      item.coreFlux.visible = item.mesonFlux.visible = pair > .72;
      if (pair > .72) {
        orientCylinderBetween(item.coreFlux, item.origin, item.createdQ.position);
        orientCylinderBetween(item.mesonFlux, item.createdAnti.position, item.object.position);
      }
      item.baryonLabel.visible = item.mesonLabel.visible = pair > .88;
    } else if (item.type === "electron") {
      const event = state.interaction === "photon" && item.electronIndex === 0 ? state.solverResult?.event : null;
      if (event?.process === "ionization" && state.interactionTime > 1.05) {
        const captureStart = 4.3;
        const captureEnd = 5.8;
        const escapeVelocity = 1.8 + Math.sqrt(event.electronEnergy + .1) * .24;
        const orbitalPoint = new THREE.Vector3(Math.cos(t * item.speed + item.phase) * item.radius, Math.sin(t * item.speed + item.phase) * item.radius * .48, 0).applyEuler(item.tilt);
        if (state.interactionTime < captureStart) {
          const escape = state.interactionTime - 1.05;
          item.object.position.set(escape * escapeVelocity, .52 + escape * .78, .24 + escape * .28);
        } else if (state.interactionTime < captureEnd) {
          const escape = captureStart - 1.05;
          const escapedPoint = new THREE.Vector3(escape * escapeVelocity, .52 + escape * .78, .24 + escape * .28);
          const capture = clamp((state.interactionTime - captureStart) / (captureEnd - captureStart), 0, 1);
          const eased = capture * capture * (3 - 2 * capture);
          item.object.position.copy(escapedPoint).lerp(orbitalPoint, eased);
        } else {
          item.object.position.copy(orbitalPoint);
        }
      } else {
        const transition = event?.process === "excitation" ? clamp((state.interactionTime - .9) / 1.25, 0, 1) : 0;
        const targetRadius = event?.process === "excitation" ? 2.45 + (event.targetN - 1) * .66 : item.radius;
        const radius = THREE.MathUtils.lerp(item.radius, targetRadius, transition * transition * (3 - 2 * transition));
        const p = new THREE.Vector3(Math.cos(t * item.speed + item.phase) * radius, Math.sin(t * item.speed + item.phase) * radius * .48, 0);
        p.applyEuler(item.tilt);
        item.object.position.copy(p);
      }
    } else if (item.type === "smartMatterAssembly") {
      if (item.smart.running) {
        advanceAssembly(item.smart.sequence, dt,
          state.values.smartMaterialisationRate, state.values.smartAssemblyRate);
      }
      renderSmartAssembly(item);
    } else if (item.type === 'gammaProteinRepair') {
      const repair=item.repair;
      if (!repair.running) return;
      const elapsed=Math.max(0,time-repair.startedAt), frames=new Map();
      item.stream.forEach(({photon,start})=>{
        const progress=(elapsed-start)/2.5;
        photon.visible=progress>=0&&progress<1;
        photon.position.x=-12+24*progress;
      });
      let visible=0,placed=0;
      item.entries.forEach((entry,index)=>{
        const f=repairFrame(elapsed,index,item.entries.length,entry.particle.position.i);
        frames.set(Number(entry.particle.targetAtom),f);
        entry.photon.visible=entry.beam.visible=f.photonVisible;
        entry.photon.position.set(THREE.MathUtils.lerp(-12,entry.target.x,f.photonProgress),entry.target.y,entry.target.z);
        if (entry.original) {
          entry.original.position.copy(entry.target);
          entry.original.visible=!f.damaged||f.age<1.2;
          if(f.damaged){entry.original.position.x+=f.age*5;entry.original.position.y+=Math.sin(index*2.4)*f.age;}
        }
        entry.replacement.userData.iPosition=f.i;
        entry.replacement.visible=f.opacity>0;
        entry.replacement.material.opacity=f.opacity;
        entry.replacement.material.emissiveIntensity=f.placed?.12:.9;
        if(f.opacity>0)visible++;if(f.placed)placed++;
      });
      let bonds=0;
      item.lines.forEach(({line,a,b})=>{
        const fa=frames.get(a),fb=frames.get(b);
        const broken=(fa?.damaged&&!fa.placed)||(fb?.damaged&&!fb.placed);
        line.visible=!broken;
        if((fa||fb)&&!broken&&(!fa||fa.placed)&&(!fb||fb.placed))bonds++;
      });
      repair.visibleParticles=visible;repair.placedParticles=placed;repair.restoredBonds=bonds;
      const write=(id,value)=>{const node=$(id);if(node)node.textContent=value;};
      write('#proteinRepairVisible',`${visible} / ${item.entries.length}`);
      write('#proteinRepairPlaced',`${placed} / ${item.entries.length}`);
      write('#proteinRepairBonds',String(bonds));
      const current=item.entries.map(e=>e.replacement.userData.iPosition).find(i=>i<0&&i>-.8);
      write('#proteinRepairMessage',`γ → collision → i=${Number(current??0).toFixed(2)} → 3D · ${placed}/${item.entries.length}`);
      setStatus(`γ SIDE BEAM · i→3D · ${placed}/${item.entries.length}`,true);
      if(placed===item.entries.length&&elapsed>2.5+item.stream.length*.025&&!item.finished){
        item.finished=true;repair.running=false;repair.stage='REPAIRED';state.view='repairedGraph';
        repair.restoredBonds=repair.plan.repairPlan.brokenBondIds.length;
        repair.message='Gʀ · graph restored; molecular dynamics NOT RUN';
        setTimeout(()=>{if(state.smartProteinRepair===repair&&state.selected.visual==='smartProteinRepair'){rebuildSpecimen();renderInspector();}},0);
      }
    } else if (item.type === "smartProteinRepair") {
      const repair = item.repair;
      if (!repair.running) return;
      const elapsed = Math.max(0, time - Number(repair.startedAt || time));
      const entries = item.entries;
      const appearStart = .45;
      const appearStagger = .28;
      const navigationStart = 1.15;
      const navigationDuration = 3.1;
      const finishAt = navigationStart + navigationDuration + Math.max(0, entries.length - 1) * .18 + .75;
      let visible = 0;
      let placed = 0;
      entries.forEach((entry, index) => {
        const appearAt = appearStart + index * appearStagger;
        const iProgress = clamp((elapsed - (appearAt - .35))/.35, 0, 1);
        entry.mesh.userData.iPosition = THREE.MathUtils.lerp(Number(entry.particle.position.i), 0, iProgress);
        entry.mesh.visible = elapsed >= appearAt;
        if (!entry.mesh.visible) { entry.path.visible = false; return; }
        visible += 1;
        const navStart = navigationStart + index * .18;
        const progress = clamp((elapsed - navStart)/navigationDuration, 0, 1);
        const eased = progress*progress*(3-2*progress);
        entry.mesh.position.copy(entry.start).lerp(entry.target, eased);
        entry.mesh.position.y += Math.sin(progress*Math.PI)*(.35 + index*.025);
        entry.path.visible = progress > 0 && progress < 1;
        if (entry.ghost) entry.ghost.visible = progress < .94;
        entry.mesh.userData.smartState = progress >= 1 ? "BONDED" : progress > 0 ? "NAVIGATING" : "ASSIGNED";
        if (progress >= 1) placed += 1;
      });
      const bondProgress = clamp((elapsed - navigationStart - navigationDuration*.72)/1.2, 0, 1);
      item.brokenLines.forEach((line) => {
        line.material.opacity = .72 - bondProgress*.18;
        line.material.color.setHex(bondProgress >= .98 ? 0xb8d9df : 0xff4f78);
      });
      repair.visibleParticles = visible;
      repair.placedParticles = placed;
      repair.restoredBonds = Math.round(item.brokenLines.length*bondProgress);
      const visibleOut = $("#proteinRepairVisible"); if (visibleOut) visibleOut.textContent = `${visible} / ${entries.length}`;
      const placedOut = $("#proteinRepairPlaced"); if (placedOut) placedOut.textContent = `${placed} / ${entries.length}`;
      const bondsOut = $("#proteinRepairBonds"); if (bondsOut) bondsOut.textContent = `${repair.restoredBonds} / ${item.brokenLines.length}`;
      const message = $("#proteinRepairMessage");
      if (message) message.textContent = `i→3D ${visible}/${entries.length} · atoms ${placed}/${entries.length} · bonds ${repair.restoredBonds}/${item.brokenLines.length}`;
      setStatus(`SMART MATTER REPAIR · ${placed}/${entries.length} atoms · ${repair.restoredBonds}/${item.brokenLines.length} bonds`, true);
      if (elapsed >= finishAt && !item.finished) {
        item.finished = true;
        repair.running = false;
        repair.stage = "REPAIRED";
        state.view = "repairedGraph";
        repair.message = `Gʀ · topology ${repair.plan.validation.topologyMatchPercent.toFixed(0)}% · dynamic validation NOT RUN`;
        setTimeout(() => {
          if (state.selected.visual !== "smartProteinRepair") return;
          rebuildSpecimen();
          renderInspector();
          setStatus(`PROTEIN REPAIR COMPLETE · ${repair.message}`, false);
        }, 0);
      }
    } else if (item.type === "chemistryReaction") {
      const elapsed = Math.max(0, time - Number(item.startedAt || time));
      const progress = item.chemistry.reaction?.running ? clamp(elapsed / 6.2, 0, 1) : 1;
      const eased = progress * progress * (3 - 2 * progress);
      item.atomMeshes.forEach((mesh, index) => mesh.position.copy(item.fromPoints[index]).lerp(item.toPoints[index], eased));
      const updateBond = (entry) => {
        const start = item.atomMeshes[entry.a].position.clone().add(entry.shift);
        const end = item.atomMeshes[entry.b].position.clone().add(entry.shift);
        orientCylinderBetween(entry.object, start, end);
      };
      item.reactantBonds.forEach(updateBond);
      item.productBonds.forEach(updateBond);
      item.reactantMaterial.opacity = .82 * clamp(1 - progress * 2.05, 0, 1);
      item.productMaterial.opacity = .86 * clamp((progress - .43) * 2.05, 0, 1);
      if (progress >= 1 && item.chemistry.reaction?.running) {
        item.chemistry.reaction.running = false;
        item.chemistry.message = `Реакция завершена · ${item.chemistry.reaction.equation}`;
        setStatus(item.chemistry.message, false);
      } else if (item.chemistry.reaction?.running) {
        setStatus(`RDKit REACTION · ${item.chemistry.reaction.equation} · ${(progress * 100).toFixed(0)}%`, true);
      }
    } else if (item.type === "jitter") {
      const amplitude = .014 + .055 * visual.motionAmplitude * (1 - visual.coherence * .55);
      item.object.position.copy(item.base).add(new THREE.Vector3(Math.sin(t * .7 + item.phase), Math.cos(t * .63 + item.phase * 1.3), Math.sin(t * .52 + item.phase * .7)).multiplyScalar(amplitude));
    } else if (item.type === "fluid") {
      const amplitude = .08 + .18 * visual.motionAmplitude * (1 - visual.coherence * .45);
      item.object.position.copy(item.base).add(new THREE.Vector3(Math.sin(t * item.speed + item.phase), Math.cos(t * .8 + item.phase), Math.sin(t * .6 + item.phase * 1.7)).multiplyScalar(amplitude));
    } else if (item.type === "hybrid") {
      const isQuark = ["upQuark", "downQuark", "strangeQuark"].includes(item.object.userData.componentId);
      const amplitude = isQuark ? .08 + .18 * visual.motionAmplitude : .014 + .045 * visual.motionAmplitude;
      const frequency = isQuark ? item.speed : .62;
      item.object.position.copy(item.base).add(new THREE.Vector3(Math.sin(t * frequency + item.phase), Math.cos(t * .8 + item.phase), Math.sin(t * .6 + item.phase * 1.7)).multiplyScalar(amplitude));
    } else if (item.type === "crystal") {
      const modulation = .65 + visual.wave * .9;
      const amplitude = .018 + .052 * visual.motionAmplitude;
      item.object.position.copy(item.base).add(new THREE.Vector3(Math.sin(t * 1.8 + item.phase * modulation), Math.cos(t * 1.5 + item.phase), Math.sin(t * 1.3 + item.phase * modulation)).multiplyScalar(amplitude));
    } else if (item.type === "pulse") {
      const pulse = 1 + Math.sin(t * item.speed + item.phase) * .1;
      item.object.scale.setScalar(pulse);
      if (item.object.material) item.object.material.opacity = .24 + (Math.sin(t * item.speed + item.phase) + 1) * .12;
    } else if (item.type === "ring") {
      item.object.rotation.y += dt * item.speed;
      item.object.rotation.z += dt * item.speed * .45;
    } else if (item.type === "macroSpin") {
      item.object.rotation.y += dt * item.speed * (item.direction ?? 1);
    } else if (item.type === "blackHole") {
      item.photonRing.rotation.z += dt * .34;
      item.lensedBand.rotation.z += dt * .09;
      item.disk.rotation.y += dt * .12;
    } else if (item.type === "interactiveBlackHole") {
      item.diskUniforms.time.value += dt;
      item.disk.rotation.z += dt * .11;
      item.photonRing.rotation.z += dt * .045;
      item.upperImage.material.opacity = .68 + Math.sin(t * 1.8) * .13;
      item.lowerImage.material.opacity = .42 + Math.sin(t * 1.5 + .8) * .09;
      item.starField.rotation.y -= dt * .006;
    } else if (item.type === "nasaAccretionDisk") {
      // GIF frames are decoded by the browser; flagging the texture keeps the
      // animated NASA SVS source updating inside the WebGL scene.
      item.texture.needsUpdate = true;
    } else if (item.type === "blackHoleMerger") {
      // Keep the inspiral on screen long enough to inspect both the orbit and
      // the emitted wavefronts before the remnant replaces the binary.
      const duration = getMergerDuration();
      const p = state.blackHoleMergerRunning ? clamp(state.interactionTime / duration, 0, 1) : 0;
      const eased = p * p * (3 - 2 * p);
      const angle = item.configuration === "headOn" ? 0 : p * (8 + p * 20) * Math.PI;
      const activeSources = [];
      const merged = p >= 1;
      // Every initial body follows an orbit in the same x-z plane.  The
      // distance contracts continuously to the common horizon; no object is
      // removed before it reaches the merger centre.
      item.bodies.forEach((entry, index) => {
        const localAngle = entry.phase + entry.direction * angle * entry.rate;
        const radial = THREE.MathUtils.lerp(entry.radius, .03, eased);
        const headOnOffset = item.configuration === "headOn" ? (index % 2 ? 0 : Math.PI) : 0;
        entry.body.group.position.set(
          Math.cos(localAngle + headOnOffset) * radial,
          0,
          Math.sin(localAngle + headOnOffset) * radial * .64
        );
        entry.body.group.visible = !merged;
        entry.body.group.rotation.y += dt * (1.05 + p * 4.8) * entry.direction;
        entry.body.disk.rotation.y += dt * (1.7 + p * 3.1) * entry.direction;
        if (!merged) activeSources.push({ object: entry.body.group, mass: entry.mass });
      });
      item.orbit.visible = !merged;
      item.remnant.group.visible = merged;
      item.remnant.group.position.set(0, 0, 0);
      item.remnant.disk.rotation.y += dt * 3.4;
      if (merged) activeSources.push({ object: item.remnant.group, mass: item.remnantMass });
      // A spatial embedding diagram, explicitly not literal 3D spacetime.
      // The two moving wells and quadrupolar outgoing pulse make the curvature
      // and radiative degree of freedom observable in the laboratory scene.
      const position = item.spacetime.geometry.attributes.position;
      const base = item.spacetime.base;
      const sourceMass = activeSources.reduce((sum, source) => sum + source.mass, 0) || 1;
      const sourceX = activeSources.reduce((sum, source) => sum + source.object.position.x * source.mass, 0) / sourceMass;
      const sourceZ = activeSources.reduce((sum, source) => sum + source.object.position.z * source.mass, 0) / sourceMass;
      const chirpStrength = .04 + .22 * p * p;
      const pulseRadius = Math.max(0, (p - .54) * 20.5);
      for (let vertex = 0; vertex < position.count; vertex += 1) {
        const index3 = vertex * 3;
        const x = base[index3];
        const z = -base[index3 + 1];
        const r = Math.hypot(x - sourceX, z - sourceZ);
        const phi = Math.atan2(z - sourceZ, x - sourceX);
        // Each currently visible horizon contributes its own mass-weighted
        // well.  Once all three have joined, only the final summed remnant
        // remains as the source of the explanatory embedding surface.
        const wells = activeSources.reduce((sum, source) => {
          const distance2 = (x - source.object.position.x) ** 2 + (z - source.object.position.z) ** 2;
          const depth = clamp(Number(state.values.curvatureDepth ?? 1.55), .35, 2.5);
          return sum - 3.15 * depth * (source.mass / 36) / (1 + distance2 * 1.22);
        }, 0);
        const quadrupole = Math.cos(2 * (phi - angle)) * Math.sin(r * 1.65 - p * 22) * chirpStrength * Math.exp(-r * .11);
        const outgoing = pulseRadius > 0 ? Math.cos(2 * (phi - angle)) * Math.sin((r - pulseRadius) * 5.8) * .34 * Math.exp(-((r - pulseRadius) ** 2) / 1.5) : 0;
        position.setZ(vertex, wells + quadrupole + outgoing);
      }
      position.needsUpdate = true;
      const gridOpacity = clamp(Number(state.values.gridOpacity ?? .14), 0, .8);
      item.spacetime.grid.material.opacity = gridOpacity * (merged ? .72 : .8 + p * .2);
      item.wave.children.forEach((ring, index) => {
        if (ring === item.wave.userData.mergerFlash) return;
        // Several shells are emitted during the chirp; their increasing rate
        // and size make the approaching merger visible at every stage.
        const local = p > .06 ? (p * 2.45 - index * .095 + 1) % 1 : -1;
        const waveOpacity = clamp(Number(state.values.waveOpacity ?? .78), 0, 1);
        ring.visible = local >= 0 && waveOpacity > .005;
        if (merged) {
          // Preserve an observable wave train after coalescence rather than
          // clearing the evidence as soon as the final black hole is shown.
          const postRadius = 2.0 + index * .47;
          ring.scale.set(postRadius, postRadius, postRadius);
          ring.material.opacity = waveOpacity * Math.max(.1, .48 - index * .026);
        } else if (local >= 0) {
          const growth = .42 + local * (5.1 + index * .07);
          ring.scale.set(growth, growth, growth);
          ring.material.opacity = waveOpacity * Math.max(0, (.78 - index * .025) * (1 - local) * (1 - local * .35));
        }
      });
      const flash = item.wave.userData.mergerFlash;
      const burst = clamp((p - .88) / .12, 0, 1);
      const waveOpacity = clamp(Number(state.values.waveOpacity ?? .78), 0, 1);
      flash.visible = waveOpacity > .005 && burst > 0 && burst < 1;
      flash.material.opacity = waveOpacity * .86 * Math.sin(burst * Math.PI);
      flash.scale.setScalar(.4 + burst * 7.2);
  } else if (item.type === "resonantTriple") {
    updateResonantTripleDynamics(item, dt);
    continue;
      // Base state deliberately follows the binary-merger preview: a common
      // barycentric inspiral with a chirping quadrupole wave train.  The third
      // object is not present until the user explicitly adds it.
      const running = state.interaction === "resonantTriple" && state.resonantTripleRunning;
      const elapsed = running ? state.interactionTime : 0;
      // A complete periodic cycle is used instead of a one-way merger.  The
      // central binary still follows the same barycentric track; the outer
      // quartet supplies a pre-arranged tidal fly-by near the close approach.
      const cycleDuration = 13.8 / (.72 + .38 * clamp(Number(state.values.outerModulation ?? .68), 0, 1));
      const rawProgress = running ? Math.min(.999, (elapsed / cycleDuration) % 1) : 0;
      const stabilised = true;
      const twinStabilised = true;
      const manualTertiary = false;
      const activationProgress = clamp(Number(state.resonantTripleActivationProgress || 0), .08, .86);
      const afterActivation = elapsed;
      const pairMass = item.masses.a + item.masses.b;
      let tertiaryAngle = 0;
      let tertiaryRadius = item.outerRadius;
      const cycleEncounter = Math.exp(-Math.pow((rawProgress - .56) / .15, 2));
      if (stabilised) {
        if (manualTertiary) {
          tertiaryAngle = THREE.MathUtils.degToRad(clamp(Number(state.resonantTripleManualAngle || 0), -180, 180));
          tertiaryRadius *= clamp(Number(state.resonantTripleManualRadius || 1), .28, 2.4);
        } else {
          const outerPhase = afterActivation * (.19 + .12 * clamp(Number(state.values.outerModulation ?? .68), 0, 1));
          if (state.values.outerTrajectory === "libration") {
            tertiaryAngle = outerPhase + .34 * Math.sin(outerPhase * 1.45);
            tertiaryRadius *= 1 + .09 * Math.cos(outerPhase * 2);
          } else if (state.values.outerTrajectory === "horseshoe") {
            tertiaryAngle = outerPhase + .53 * Math.sin(outerPhase * 1.15);
            tertiaryRadius *= 1 + .16 * Math.cos(outerPhase);
          } else {
            tertiaryAngle = outerPhase + .31 * Math.sin(outerPhase * 2.35);
            tertiaryRadius *= 1 + .14 * Math.cos(outerPhase * 2.7);
          }
        }
      }
      // The balancers come closer only during the chosen phase window.  Far
      // from that window their tidal contribution falls rapidly as r^-3.
      tertiaryRadius *= 1.2 - cycleEncounter * .42;
      const tertiaryPosition = new THREE.Vector3(
        Math.cos(tertiaryAngle) * tertiaryRadius,
        0,
        Math.sin(tertiaryAngle) * tertiaryRadius * .72,
      );
      // The second balancing body is the phase-opposed partner of the first.
      // This keeps the prescribed intervention planar and avoids a hidden,
      // magic force at the binary centre.
      const twinPosition = tertiaryPosition.clone().multiplyScalar(-1);
      const flankAngle = tertiaryAngle + Math.PI / 2;
      const flankRadius = tertiaryRadius * (1.03 + .035 * Math.sin(afterActivation * .71));
      const flankAPosition = new THREE.Vector3(
        Math.cos(flankAngle) * flankRadius,
        0,
        Math.sin(flankAngle) * flankRadius * .72,
      );
      const flankBPosition = flankAPosition.clone().multiplyScalar(-1);
      // The third body alters the binary only through a distance-dependent
      // tidal term.  At a large separation this tends to zero, so A+B keeps
      // the ordinary merger track; it never freezes merely because C exists.
      const tertiaryDistance = stabilised ? Math.max(tertiaryPosition.length(), .35) : Infinity;
      const oneBodyTidalStrength = stabilised
        ? clamp((item.masses.c / pairMass) * Math.pow(item.baseSeparation / tertiaryDistance, 3) * 5.4, 0, .82)
        : 0;
      const tidalStrength = clamp(oneBodyTidalStrength * 4, 0, .96);
      const closeFlyby = clamp(tidalStrength * 1.3, 0, 1);
      const encounter = Math.exp(-Math.pow((rawProgress - .56) / .16, 2));
      const escape = clamp((rawProgress - .56) / .28, 0, 1);
      const progress = clamp(rawProgress - tidalStrength * .16 * (1 - rawProgress), 0, 1);
      const eased = progress * progress * (3 - 2 * progress);
      const baseAngle = progress * (8 + progress * 20) * Math.PI;
      const angle = baseAngle + tidalStrength * .24 * Math.sin(tertiaryAngle - baseAngle) + closeFlyby * (.38 * encounter + .62 * escape);
      const tidalStretch = 1 + tidalStrength * .16 * Math.cos(2 * (tertiaryAngle - baseAngle));
      const unperturbedSeparation = THREE.MathUtils.lerp(item.baseSeparation, .05, eased) * tidalStretch;
      const scatteringLift = closeFlyby * item.baseSeparation * (.24 * encounter + .72 * escape);
      const separation = Math.max(.035, unperturbedSeparation + scatteringLift);
      const relative = new THREE.Vector3(Math.cos(angle) * separation, 0, Math.sin(angle) * separation * .64);
      const pairCentre = twinStabilised ? new THREE.Vector3() : tertiaryPosition.clone().multiplyScalar(tidalStrength * .18);
      item.centralA.group.position.copy(pairCentre).addScaledVector(relative, -item.masses.b / pairMass);
      item.centralB.group.position.copy(pairCentre).addScaledVector(relative, item.masses.a / pairMass);
      const merged = rawProgress >= 1 && (!twinStabilised || closeFlyby < .14);
      item.centralA.group.visible = !merged;
      item.centralB.group.visible = !merged;
      item.remnant.group.visible = merged;
      item.remnant.group.position.copy(pairCentre);
      item.centralOrbit.visible = !merged;
      item.tertiary.group.position.copy(tertiaryPosition);
      item.tertiary.group.visible = true;
      item.tertiaryTwin.group.position.copy(twinPosition);
      item.tertiaryTwin.group.visible = true;
      if (item.tertiaryFlankA && item.tertiaryFlankB) {
        item.tertiaryFlankA.group.position.copy(flankAPosition);
        item.tertiaryFlankB.group.position.copy(flankBPosition);
        item.tertiaryFlankA.group.visible = true;
        item.tertiaryFlankB.group.visible = true;
      }
      item.tertiaryOrbit.visible = true;
      item.twinOrbit.visible = true;
      if (item.flankOrbit) item.flankOrbit.visible = true;
      [item.centralA, item.centralB, item.tertiary, item.tertiaryTwin, item.tertiaryFlankA, item.tertiaryFlankB].filter(Boolean).forEach((body, index) => {
        body.group.rotation.y += dt * (1.05 + progress * 4.1 + index * .08);
        body.disk.rotation.y += dt * (1.45 + progress * 2.4 + index * .12);
        body.photonRing.rotation.z += dt * (.15 + index * .05);
      });
      item.remnant.disk.rotation.y += dt * 3.1;
      item.centralOrbit.rotation.y = angle;
      item.tertiaryOrbit.rotation.y = tertiaryAngle * .18;
      item.twinOrbit.rotation.y = tertiaryAngle * .18 + Math.PI;
      if (item.flankOrbit) item.flankOrbit.rotation.y = tertiaryAngle * .18 + Math.PI / 2;

      const sources = merged
        ? [
            { object: item.remnant.group, mass: item.remnantMass },
            ...(stabilised ? [{ object: item.tertiary.group, mass: item.masses.c }] : []),
            ...(twinStabilised ? [{ object: item.tertiaryTwin.group, mass: item.masses.c }] : [])
          ]
        : [
            { object: item.centralA.group, mass: item.masses.a },
            { object: item.centralB.group, mass: item.masses.b },
            { object: item.tertiary.group, mass: item.masses.c },
            { object: item.tertiaryTwin.group, mass: item.masses.c },
            ...(item.tertiaryFlankA ? [{ object: item.tertiaryFlankA.group, mass: item.masses.c * .9 }] : []),
            ...(item.tertiaryFlankB ? [{ object: item.tertiaryFlankB.group, mass: item.masses.c * .9 }] : [])
          ];
      const position = item.spacetime.geometry.attributes.position;
      const base = item.spacetime.base;
      const depthScale = clamp(Number(state.values.curvatureDepth ?? 2.2), .5, 3.5);
      const wavePeak = Math.exp(-Math.pow((progress - .56) / .18, 2));
      for (let vertex = 0; vertex < position.count; vertex += 1) {
        const index3 = vertex * 3;
        const x = base[index3];
        const z = -base[index3 + 1];
        const wells = sources.reduce((sum, source) => {
          const distance2 = (x - source.object.position.x) ** 2 + (z - source.object.position.z) ** 2;
          return sum - 3.5 * depthScale * (source.mass / 30) / (1 + distance2 * 1.16);
        }, 0);
        const r = Math.hypot(x, z);
        const phi = Math.atan2(z, x);
        // The qualitative signal peaks at the closest central fly-by, rather
        // than at the arbitrary end of the display cycle.
        const chirp = .045 + .34 * wavePeak;
        const pulseRadius = Math.max(0, (progress - .56) * 23.5);
        const quadrupole = Math.cos(2 * (phi - angle)) * Math.sin(r * 1.65 - elapsed * 4.5) * chirp * Math.exp(-r * .11);
        const outgoing = pulseRadius > 0 ? Math.cos(2 * (phi - angle)) * Math.sin((r - pulseRadius) * 5.8) * .32 * Math.exp(-((r - pulseRadius) ** 2) / 1.5) : 0;
        position.setZ(vertex, wells + quadrupole + outgoing);
      }
      position.needsUpdate = true;
      item.spacetime.grid.material.opacity = clamp(Number(state.values.gridOpacity ?? .24), .03, .65);
      const waveOpacity = clamp(Number(state.values.waveOpacity ?? .82), 0, 1);
      item.wave.children.forEach((ring, index) => {
        if (ring === item.wave.userData.mergerFlash) return;
        const local = running ? (elapsed * .42 - index * .095 + 1) % 1 : -1;
        ring.visible = local >= 0 && waveOpacity > .005;
        if (merged) {
          const radius = 2 + index * .48;
          ring.scale.set(radius, radius, radius);
          ring.material.opacity = waveOpacity * Math.max(.1, .48 - index * .026);
        } else if (local >= 0) {
          const growth = .42 + local * (5.1 + index * .07);
          ring.scale.set(growth, growth, growth);
          ring.material.opacity = waveOpacity * (.22 + .78 * wavePeak) * Math.max(.025, (.78 - index * .025) * (1 - local));
        }
      });
      const flash = item.wave.userData.mergerFlash;
      const burst = merged ? clamp((rawProgress - .88) / .12, 0, 1) : 0;
      flash.visible = waveOpacity > .005 && burst > 0 && burst < 1;
      flash.material.opacity = waveOpacity * .86 * Math.sin(burst * Math.PI);
      flash.scale.setScalar(.4 + burst * 7.2);
    } else if (item.type === "beam") {
      const x = -8.5 + ((t * 2.4) % 17);
      item.object.position.x = x;
      const amp = x > 2.4 ? .32 : x > -2.4 ? .22 : .16;
      item.object.position.y = Math.sin(t * 8) * amp;
      item.object.position.z = Math.cos(t * 8) * amp;
      item.object.material = x > 2.4 ? mats.helicity : mats.neutrino;
    } else if (item.type === "bloch") {
      const result = state.solverResult?.state;
      if (result) item.object.setDirection(new THREE.Vector3(result.bx, result.bz, result.by).normalize());
    } else if (item.type === "atomicPhoton") {
      const phase = clamp((state.interactionTime - item.phase) / 1.05, 0, 1);
      item.object.position.x = THREE.MathUtils.lerp(-8 - item.phase * 8, -.12, phase);
      if (phase >= 1) {
        if (item.event.process === "elastic") {
          const scatterTime = state.interactionTime - 1.05 - item.phase;
          item.object.position.set(-.12 + scatterTime * item.scatter.x, scatterTime * item.scatter.y, scatterTime * item.scatter.z);
        } else item.object.visible = false;
      }
    } else if (item.type === "transitionOrbit") {
      const reveal = clamp((state.interactionTime - .8) / .85, 0, 1);
      item.object.scale.setScalar(Math.max(.01, reveal));
      item.object.material.opacity = .22 + .58 * reveal;
      item.object.rotation.z += dt * .14;
    } else if (item.type === "ionizationArrow") {
      item.object.visible = state.interactionTime > 1.02 && state.interactionTime < 4.3;
    } else if (item.type === "recombinationPhoton") {
      const emissionTime = state.interactionTime - 5.75;
      item.object.visible = emissionTime >= 0;
      if (emissionTime >= 0) {
        const photonSpeed = 5.8;
        item.object.position.copy(item.direction).multiplyScalar(emissionTime * photonSpeed);
        const wavelengthPulse = .82 + Math.sin(emissionTime * 18) * .18;
        item.object.scale.setScalar(wavelengthPulse);
      }
    } else if (item.type === "photon") {
      item.object.position.x += dt * 6.5 * item.speed;
      if (item.object.position.x >= -.2 && !item.scattered) {
        item.scattered = true;
        const theta = sampleThomsonAngle();
        const phi = Math.random() * Math.PI * 2;
        item.velocity = new THREE.Vector3(Math.cos(theta), Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi)).multiplyScalar(5.2);
      }
      if (item.scattered) item.object.position.addScaledVector(item.velocity, dt);
      if (item.object.position.length() > 16) {
        if (state.interaction === "photon") {
          item.object.position.set(-10 - Math.random() * 3, rand(-1.2, 1.2), rand(-1.2, 1.2));
          item.object.visible = true;
          item.scattered = false;
          item.velocity = null;
        } else {
          item.object.visible = false;
        }
      }
    } else if (item.type === "weak") {
      const phase = state.interactionTime;
      item.object.position.set(THREE.MathUtils.lerp(-.3, 1.4, clamp(phase / 1.2, 0, 1)), .1 + phase * .34, 0);
      if (phase > 1.15) {
        item.object.visible = false;
        item.electron.visible = true;
        item.neutrino.visible = true;
        item.electron.position.set(1.4 + (phase - 1.15) * 2.3, .5 + (phase - 1.15) * .5, .2);
        item.neutrino.position.set(1.4 + (phase - 1.15) * 3.1, .5 - (phase - 1.15) * .8, -.2);
      }
    } else if (item.type === "neutrinoPulse") {
      item.object.position.x += dt * 8;
      if (item.object.position.x > -2.4) {
        const flip = state.solverResult?.state?.primary || 0;
        item.object.material = Math.random() < flip ? mats.helicity : mats.neutrino;
        item.object.position.y = Math.sin(item.object.position.x * 3 + item.phase * 30) * .22;
      }
      if (item.object.position.x > 10) {
        if (state.interaction === "neutrino") {
          item.object.position.set(-9 - item.phase * 6, 0, 0);
          item.object.visible = true;
          item.object.material = mats.neutrino;
        } else {
          item.object.visible = false;
        }
      }
    } else if (item.type === "compression") {
      const phase = (state.interactionTime * .32 + item.phase) % 1;
      item.object.scale.setScalar(1 - phase * .82);
      item.object.material.opacity = 1 - phase;
    } else if (item.type === "stability") {
      item.object.scale.setScalar(1 + Math.sin(t * 2.5) * .06);
      item.object.rotation.z += dt * .5;
    } else if (item.type === "binding") {
      const pulse = .82 + Math.sin(t * 2.4) * .18;
      item.object.scale.setScalar(pulse);
      item.object.rotation.z += dt * .45;
    } else if (item.type === "boson") {
      const a = (t * .55 + item.phase) % 1;
      const start = primaryParticles[Math.floor(item.phase * 8) % Math.max(primaryParticles.length, 1)]?.position || new THREE.Vector3();
      const end = primaryParticles[(Math.floor(item.phase * 8) + 1) % Math.max(primaryParticles.length, 1)]?.position || new THREE.Vector3();
      item.object.position.copy(start).lerp(end, a);
    } else if (item.type === "collisionFlash") {
      const phase = clamp((state.interactionTime - 1.05) / .75, 0, 1);
      item.object.visible = state.interactionTime >= 1.05 && state.interactionTime < 2;
      item.object.scale.setScalar(.15 + Math.sin(phase * Math.PI) * 5.5);
    } else if (item.type === "annihilationWave") {
      const phase = clamp((state.interactionTime - 1.04 - item.delay) / 1.25, 0, 1);
      item.object.visible = phase > 0 && phase < 1;
      item.object.scale.setScalar(.3 + phase * 20);
      item.object.material.opacity = Math.max(0, .85 * (1 - phase));
    } else if (item.type === "collisionTrack") {
      const reveal = clamp((state.interactionTime - 1.18 - item.delay) / 1.75, 0, 1);
      const count = Math.max(0, Math.floor(reveal * item.points.length));
      item.object.geometry.setDrawRange(0, count);
      item.marker.visible = reveal > 0;
      if (count > 0) item.marker.position.copy(item.points[Math.min(count - 1, item.points.length - 1)]);
    } else if (item.type === "displacedVertex") {
      item.object.visible = state.interactionTime > 1.55;
      if (item.object.visible) item.object.scale.setScalar(.82 + Math.sin(t * 5) * .18);
    }
  }
  if (state.interaction === "stringBreak") {
    const event = state.solverResult?.event;
    const thresholdWorld = (event?.thresholdDistance || .7) * 1.7;
    const separation = mesonVisual ? mesonVisual.left.position.distanceTo(mesonVisual.right.position) : 0;
    const phase = separation >= thresholdWorld ? "hadronization" : "stretching";
    if (state.interactionPhase !== phase) {
      state.interactionPhase = phase;
      setStatus(phase === "hadronization" ? "STRING BREAKING · vacuum q-q̄ pair · two color singlets" : `CONFINEMENT · κr растёт · порог ${event?.thresholdDistance.toFixed(2)} fm`, true);
      $("#telemetryState").textContent = phase;
    }
  }
  if (state.interaction === "baryonConfinement") {
    const phase = state.interactionTime < 1.65 ? "stretching colour flux" : state.interactionTime < 2.35 ? "vacuum q q̄ pair creation" : "two colour-neutral hadrons";
    if (state.interactionPhase !== phase) {
      state.interactionPhase = phase;
      setStatus(`CONFINEMENT · ${phase}`, true);
      $("#telemetryState").textContent = phase;
    }
  }
  if (state.interaction === "collision") {
    const phase = state.interactionTime < 1.15 ? "beam crossing" : state.interactionTime < 3.2 ? "event development" : "detector event";
    if (state.interactionPhase !== phase) {
      state.interactionPhase = phase;
      setStatus(`${phase.toUpperCase()} · ${state.solverResult?.event?.mode || "pp"} · seed ${state.solverResult?.event?.seed || 0}`, true);
      $("#telemetryState").textContent = phase;
    }
  }
  if (state.interaction === "photon" && state.solverResult?.event?.process === "ionization") {
    let phase = "ionization";
    let text = `PHOTOIONIZATION · свободный e⁻ · K = ${state.solverResult.event.electronEnergy.toFixed(2)} eV`;
    if (state.interactionTime >= 4.3) {
      phase = "capture";
      text = "DEMO RADIATIVE CAPTURE · электрон захватывается ионом";
    }
    if (state.interactionTime >= 5.75) {
      phase = "recombination";
      text = "RECOMBINATION · e⁻ + ion → atom + γ";
    }
    if (state.interactionPhase !== phase) {
      state.interactionPhase = phase;
      setStatus(text, true);
      $("#telemetryState").textContent = phase;
    }
  }
  if (state.interaction) {
    state.interactionTime += dt * speed;
    if (state.interaction !== "resonantTriple") {
    const mergerDuration = state.interaction === "blackHoleMerger" ? getMergerDuration(state.values) : 9;
    if (state.interactionTime > mergerDuration) {
      if (state.interaction === "blackHoleMerger") state.interactionTime = mergerDuration;
      state.interaction = null;
      setStatus("Процесс завершён · результат обновлён", false);
      $("#telemetryState").textContent = state.selected.status;
      }
    }
  }
}

function sampleThomsonAngle() {
  for (;;) {
    const c = rand(-1, 1);
    if (Math.random() <= (1 + c * c) / 2) return Math.acos(c);
  }
}

async function checkBackend() {
  try {
    const response = await fetch("./api/status", { cache: "no-store" });
    if (!response.ok) throw new Error("offline");
    const data = await response.json();
    state.backendOnline = true;
    state.backendStatusPayload = data;
    $("#backendStatus").className = "compute-status online";
    const dispatch = data.scientific?.acceleration?.engine || data.engine;
    $("#backendStatus").innerHTML = `<i data-lucide="server"></i> backend: ${escapeHtml(dispatch)}`;
  } catch {
    state.backendOnline = false;
    state.backendStatusPayload = null;
    $("#backendStatus").className = "compute-status offline";
    $("#backendStatus").innerHTML = `<i data-lucide="server-off"></i> backend: optional`;
  }
  window.lucide?.createIcons();
}

const computeModelMap = {
  "NumPy/SciPy custom kernels": "directmlCompute",
  "Waveform ensemble kernel": "gpuWaveformEnsemble",
  "Finite-difference wave grid": "gpuWaveGrid",
  "3D finite-difference wave volume": "gpuWaveGrid3d",
  "Neutrino oscillation batch": "gpuNeutrinoBatch",
  "RDKit + PySCF quantum chemistry": "quantumChemistryLab",
  "DEVSIM semiconductor TCAD": "semiconductorDeviceLab",
  "Multi-Quark SystemVerilog architecture": "multiQuarkWorkbench",
  "Multi-quark DirectML threshold kernel": "multiQuarkWorkbench",
  "Quantum state-vector simulator": "gpuQuantumSimulator"
};

function computeEngineKind(engine) {
  if (engine.gpu) return "gpu";
  if (/data source|contract|not installed/i.test(engine.execution || "")) return "data";
  return "cpu";
}

function openComputeModal() {
  const locale = localStorage.getItem("qcd-neutrino-language") || "en";
  const copy = ({
    en: { title: "Scientific compute centre", intro: "Actual state of the local CPU/GPU engines. Select an available GPU kernel to open its model.", backend: "Backend", gpu: "GPU", kernels: "GPU kernels", policy: "Dispatch policy", open: "open calculation", offline: "Backend unavailable", offlineText: "Start the local server and check again.", caveat: "The GPU is used only where its output is checked against a CPU reference. An installed package is not automatically a GPU package." },
    ru: { title: "Центр научных вычислений", intro: "Фактическое состояние локальных CPU/GPU-движков. Выберите доступное GPU-ядро, чтобы открыть его модель.", backend: "Backend", gpu: "GPU", kernels: "GPU-ядра", policy: "Политика запуска", open: "открыть расчёт", offline: "Backend недоступен", offlineText: "Запустите локальный сервер и повторите проверку.", caveat: "GPU используется только там, где результат проверяется относительно CPU-эталона. Наличие пакета не означает, что весь пакет автоматически перенесён на видеокарту." },
    he: { title: "מרכז חישובים מדעיים", intro: "המצב בפועל של מנועי ה־CPU וה־GPU המקומיים. בחרו ליבת GPU זמינה כדי לפתוח את המודל שלה.", backend: "שרת חישוב", gpu: "מעבד גרפי", kernels: "ליבות GPU", policy: "מדיניות הרצה", open: "פתיחת החישוב", offline: "שרת החישוב אינו זמין", offlineText: "יש להפעיל את השרת המקומי ולבדוק שוב.", caveat: "ה־GPU משמש רק כאשר התוצאה נבדקת מול ייחוס CPU. התקנת חבילה אינה מעבירה אוטומטית את כולה ל־GPU." }
  })[locale] || null;
  $("#computeModalTitle").textContent = copy.title;
  $("#computeModalTitle").nextElementSibling.textContent = copy.intro;
  $("#computeModal .compute-caveat").textContent = copy.caveat;
  const payload = state.backendStatusPayload;
  const acceleration = payload?.scientific?.acceleration;
  const hardware = payload?.scientific?.hardware;
  const engines = acceleration?.engines || [];
  const gpuName = hardware?.displayAdapters?.[0]?.Name || "DirectX 12 adapter";
  $("#computeSummary").innerHTML = `
    <div class="accent"><span>${copy.backend}</span><b>${state.backendOnline ? "ONLINE" : "OFFLINE"}</b></div>
    <div><span>${copy.gpu}</span><b>${escapeHtml(gpuName)}</b></div>
    <div><span>${copy.kernels}</span><b>${acceleration ? `${acceleration.gpuPackages} / ${acceleration.totalPackages}` : "—"}</b></div>
    <div><span>${copy.policy}</span><b>${acceleration ? "HYBRID" : "—"}</b></div>`;
  $("#computeEngineGrid").innerHTML = engines.length ? engines.map((engine) => {
    const kind = computeEngineKind(engine);
    const model = computeModelMap[engine.package];
    return `<button class="compute-engine" type="button" ${model ? `data-model="${model}"` : "disabled"}>
      <span class="compute-engine-head"><h3>${escapeHtml(engine.package)}</h3><span class="compute-engine-badge ${kind}">${kind === "gpu" ? "GPU" : kind === "cpu" ? "CPU" : "DATA"}</span></span>
      <p>${escapeHtml(engine.strategy)}</p><small>${escapeHtml(engine.execution)}${model ? ` · ${copy.open}` : ""}</small>
    </button>`;
  }).join("") : `<div class="compute-engine"><h3>${copy.offline}</h3><p>${copy.offlineText}</p></div>`;
  $("#computeEngineGrid").querySelectorAll("[data-model]").forEach((button) => button.addEventListener("click", () => {
    $("#computeModal").hidden = true;
    state.family = "tool";
    selectModel(button.dataset.model);
  }));
  $("#computeModal").hidden = false;
  window.lucide?.createIcons();
}

function closeComputeModal() { $("#computeModal").hidden = true; }

function mqCount(value) {
  return new Intl.NumberFormat("ru-RU", { notation: Number(value) >= 1e9 ? "scientific" : "standard", maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function mqClassificationClass(label) {
  if (/unbound/i.test(label)) return "unbound";
  if (/bound/i.test(label)) return "bound";
  return "near";
}

function renderMultiQuarkResult(result) {
  state.multiQuarkResult = result;
  $("#mqExperimentId").textContent = `experiment ${result.experimentId}`;
  const q = result.quantumNumbers;
  $("#mqQuantumNumbers").innerHTML = [
    `Q = ${Number(q.charge).toFixed(2)}`,
    `B = ${Number(q.baryonNumber).toFixed(2)}`,
    `S = ${q.strangeness}`,
    `triality = ${q.triality}`,
  ].map((value) => `<span>${escapeHtml(value)}</span>`).join("");
  const maximum = Math.max(1, ...result.pipeline.map((stageItem) => Number(stageItem.count)));
  $("#mqPipeline").innerHTML = result.pipeline.map((stageItem) => {
    const ratio = Math.max(.035, Math.log10(Number(stageItem.count) + 1) / Math.log10(maximum + 1));
    return `<div class="mq-stage" style="--stage-ratio:${ratio.toFixed(3)}"><span>${escapeHtml(stageItem.label)}</span><b>${mqCount(stageItem.count)}</b></div>`;
  }).join("");
  const bestId = result.bestCandidate?.id;
  $("#mqCandidateRows").innerHTML = result.candidates.length ? result.candidates.slice(0, 16).map((candidate) => `<tr class="${candidate.id === bestId ? "best" : ""}">
    <td>${escapeHtml(candidate.id)}</td><td>${candidate.J}<sup>${escapeHtml(candidate.parity)}</sup></td><td>${escapeHtml(candidate.colorChannel)}</td>
    <td>${mqCount(candidate.basisDimension)}</td><td>${Number(candidate.energyMeV).toFixed(2)} ± ${Number(candidate.uncertaintyMeV).toFixed(2)}</td>
    <td>${Number(candidate.bindingMarginMeV).toFixed(2)}</td><td class="${mqClassificationClass(candidate.classification)}">${escapeHtml(candidate.classification)}</td>
  </tr>`).join("") : `<tr><td colspan="7">Все состояния отклонены физическими фильтрами.</td></tr>`;
  const rtl = result.rtlVerification || {};
  const gpu = result.gpuAcceleration || {};
  $("#mqRtlBadge").textContent = String(rtl.status || "generated").toUpperCase();
  $("#mqRtlBadge").classList.toggle("passed", rtl.status === "passed" || rtl.status === "compiled");
  const hardware = result.hardware;
  $("#mqHardwareStats").innerHTML = [
    ["Язык", hardware.language], ["Цель", hardware.target], ["Оценка частоты", `${hardware.estimatedClockMHz} MHz`],
    ["Оценка throughput", `${mqCount(hardware.estimatedCandidatesPerSecond)} cand/s`], ["RTL verification", rtl.status],
    ["Статус оценки", hardware.measured ? "MEASURED" : "PROJECTED, NOT MEASURED"],
    ["Raw Hilbert", mqCount(result.dimensions.rawHilbert)], ["Physical basis", mqCount(result.dimensions.physicalHilbert)],
    ["Вычисление", gpu.used ? `DirectML GPU #${gpu.selectedDeviceId}` : (gpu.engine || "CPU")],
    ["GPU profile", gpu.gpuNodeProviderConfirmed ? "CONFIRMED" : "not used"],
    ["CPU / GPU", gpu.measured ? `${Number(gpu.cpuMedianMs).toFixed(3)} / ${Number(gpu.gpuMedianMs).toFixed(3)} ms` : "—"],
    ["CPU↔GPU error", gpu.measured ? Number(gpu.maxRelativeError).toExponential(2) : "—"],
  ].map(([label, value]) => `<div><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`).join("");
  $("#mqSystemVerilog").textContent = result.systemVerilog;
}

async function runMultiQuarkSearch() {
  const button = $("#mqRunBtn");
  button.disabled = true;
  $("#mqRunStatus").className = "mq-run-status running";
  $("#mqRunStatus").textContent = "GENERATE → FILTER → REDUCE → ASSEMBLE → SCREEN → RTL";
  try {
    const values = {
      composition: $("#mqComposition").value,
      hamiltonianLevel: $("#mqHamiltonianLevel").value,
      orbitalModes: Number($("#mqOrbitalModes").value),
      colorSpinCoupling: Number($("#mqCoupling").value),
      searchBudget: Number($("#mqSearchBudget").value),
      computeBackend: $("#mqComputeBackend").value,
      candidateLimit: 16,
      hardwareTarget: $("#mqHardwareTarget").value,
    };
    const response = await fetch("./api/multiquark/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Multi-quark backend error");
    renderMultiQuarkResult(payload.result);
    const best = payload.result.bestCandidate;
    $("#mqRunStatus").className = "mq-run-status";
    $("#mqRunStatus").textContent = best
      ? `Завершено · лучший ${best.id}: ${best.classification} · E = ${Number(best.energyMeV).toFixed(2)} ± ${Number(best.uncertaintyMeV).toFixed(2)} MeV`
      : "Завершено · физически допустимых кандидатов не найдено";
  } catch (error) {
    $("#mqRunStatus").className = "mq-run-status error";
    $("#mqRunStatus").textContent = `Ошибка: ${error.message}`;
  } finally {
    button.disabled = false;
    window.lucide?.createIcons();
  }
}

function openMultiQuarkLab() {
  const model = state.selected;
  if (Array.isArray(model.composition)) $("#mqComposition").value = model.composition.join(" ");
  if (Number.isFinite(state.values.attraction)) $("#mqCoupling").value = clamp(state.values.attraction / 28, 0, 2).toFixed(2);
  $("#mqCouplingOut").textContent = Number($("#mqCoupling").value).toFixed(2);
  $("#multiquarkModal").hidden = false;
  window.lucide?.createIcons();
  runMultiQuarkSearch();
}

function closeMultiQuarkLab() { $("#multiquarkModal").hidden = true; }

function downloadMultiQuarkSystemVerilog() {
  const source = state.multiQuarkResult?.systemVerilog;
  if (!source) return;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([source], { type: "text/plain;charset=utf-8" }));
  link.download = "multiquark_physics_frontend.sv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function runBackendSolver() {
  if (state.selected.visual === "mOrchestrator") { runLocalSolver(); setStatus("M-field · local numerical hypothesis model", false); return; }
  const button = $("#backendSolveBtn");
  if (!state.backendOnline) {
    setStatus("Backend не запущен · использован browser solver", false);
    runLocalSolver();
    return;
  }
  button.disabled = true;
  setStatus("BACKEND · расчёт модели", true);
  try {
    const solverValues = { ...state.values };
    if (state.selected.visual === "molecule") {
      const chemistry = ensureChemistryState();
      solverValues.chemistryAction = "quantum";
      if (chemistry?.original?.smiles) {
        solverValues.customSmiles = chemistry.original.smiles;
        solverValues.customName = chemistry.original.molecule || "Custom molecule";
      } else if (!chemistry?.smilesInput?.trim() && chemistry?.draft?.atoms?.length) {
        solverValues.customGraph = chemistry.draft;
        solverValues.customName = "Graph editor molecule";
      } else if (chemistry?.smilesInput?.trim()) {
        solverValues.customSmiles = chemistry.smilesInput.trim();
      }
    }
    const response = await fetch("./api/solve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: state.selected.id, values: solverValues }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Backend error");
    state.solverResult = payload.result;
    state.solverMs = payload.elapsed_ms;
    $("#telemetrySolver").textContent = `backend / ${payload.elapsed_ms.toFixed(2)} ms`;
    $("#chartSubtitle").textContent = state.solverResult.primaryLabel;
    renderMetrics();
    drawChart();
    if (["molecule", "semiconductor"].includes(state.selected.visual)) rebuildSpecimen();
    if (state.selected.id === "gpuQuantumSimulator") renderInspector();
    setStatus(`BACKEND · ${payload.engine} · завершено`, false);
  } catch (error) {
    setStatus(`Backend error · ${error.message}`, false);
  } finally {
    button.disabled = false;
  }
}

function resetCamera(immediate = true) {
  if (state.selected.visual === "mOrchestrator") { mOrchestrator.fitCamera(); return; }
  controls.maxDistance = 34;
  const target = new THREE.Vector3(0, .3, 0);
  const position = state.selected.visual === "neutrinoLens" ? new THREE.Vector3(11, 5.5, 13.5) : state.selected.visual === "collider" ? new THREE.Vector3(13.5, 9.2, 15.5) : new THREE.Vector3(10.5, 6.2, 12.5);
  if (immediate) {
    camera.position.copy(position);
    controls.target.copy(target);
  } else {
    camera.position.lerp(position, .72);
    controls.target.lerp(target, .72);
  }
  controls.update();
}

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / Math.max(rect.height, 1);
  camera.updateProjectionMatrix();
  drawChart();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), state.selected.visual === "mOrchestrator" ? .25 : .04);
  const time = clock.elapsedTime;
  if (!state.paused) {
    updateAnimations(time, dt);
    platformRing.material.opacity = .48 + Math.sin(time * 1.2) * .09;
  } else if (state.selected.visual === "mOrchestrator") mOrchestrator.tick(0);
  controls.update();
  renderer.render(scene, camera);
}

$("#modelSearch").addEventListener("input", (event) => { state.search = event.target.value; renderCatalog(); });
$("#formulaExplainBtn").addEventListener("click", openFormulaModal);
$("#formulaModalClose").addEventListener("click", closeFormulaModal);
$("#formulaModal").addEventListener("click", (event) => { if (event.target === $("#formulaModal")) closeFormulaModal(); });
window.addEventListener("keydown", (event) => { if (event.key === "Escape" && !$("#formulaModal").hidden) closeFormulaModal(); });
$("#matterWorkspaceBtn").addEventListener("click", () => { state.family = "all"; state.search = ""; $("#modelSearch").value = ""; selectModel("proton"); });
$("#colliderWorkspaceBtn").addEventListener("click", () => { state.family = "collider"; state.search = ""; $("#modelSearch").value = ""; selectModel("colliderWorkbench"); });
const communicationSettings = [
  ["neutrinoRate", { en: "Neutrino rate", ru: "Поток нейтрино" }, 10, 220, 1, " / s"],
  ["photonRate", { en: "Photon / EM rate", ru: "Поток фотонов / ЭМ" }, 5, 180, 1, " / s"],
  ["energy", { en: "Neutrino energy", ru: "Энергия нейтрино" }, 1, 100, 1, " GeV"],
  ["rockThickness", { en: "Rock thickness", ru: "Толщина породы" }, 120, 320, 1, " m"],
  ["reflectivity", { en: "Photon reflectivity", ru: "Отражение фотонов" }, 30, 100, 1, "%"]
];

const communicationLocale = () => localStorage.getItem("qcd-neutrino-language") || "en";
const communicationText = (key) => ({
  waiting: { en: "Waiting for a complete message.", ru: "Ожидание полного сообщения." },
  ready: { en: "Ready for cavity polarization modulation", ru: "Готово к модуляции поляризации в линзе" },
  throughRock: { en: "Ready to transmit through rock", ru: "Готово к передаче через породу" }
}[key]?.[communicationLocale()] || { waiting: "Waiting for a complete message.", ready: "Ready for cavity polarization modulation", throughRock: "Ready to transmit through rock" }[key]);

function communicationDocument() {
  try { return $("#communicationFrame").contentDocument; } catch { return null; }
}

function prepareCommunicationFrame() {
  const doc = communicationDocument();
  if (!doc?.head) return;
  if (!doc.querySelector("#matter-frontier-embed-style")) {
    const style = doc.createElement("style");
    style.id = "matter-frontier-embed-style";
    style.textContent = ".project-nav,.panel,.detector-card,.caption,.science-note,.comm-panel,.message-card{display:none!important}body{overflow:hidden!important}canvas#scene{inset:0!important;width:100%!important;height:100%!important}";
    doc.head.append(style);
  }
  syncCommunicationToFrame();
}

function syncCommunicationToFrame() {
  const doc = communicationDocument();
  if (!doc) return;
  for (const [key] of communicationSettings) {
    const control = doc.getElementById(key);
    if (!control) continue;
    control.value = state.communicationValues[key];
    control.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function updateCommunicationMetrics() {
  if (!state.communicationOpen) return;
  const doc = communicationDocument();
  if (!doc) return;
  [["nuEmitted","commNuEmitted"],["nuThrough","commNuThrough"],["nuDetected","commNuDetected"],["photonReflected","commPhotonReflected"]].forEach(([from,to]) => {
    const source = doc.getElementById(from); const target = $("#" + to);
    if (source && target) target.textContent = source.textContent;
  });
  const status = doc.getElementById("commStatus")?.textContent;
  if (status) $("#communicationStatus").textContent = status === "Ready for cavity polarization modulation" ? communicationText("ready") : status === "Ready to transmit through rock" ? communicationText("throughRock") : status;
  const txBits = doc.getElementById("txBits")?.textContent?.trim();
  const rxBits = doc.getElementById("rxBits")?.textContent?.trim();
  if (txBits) $("#communicationTxBits").textContent = txBits;
  if (rxBits) $("#communicationRxBits").textContent = rxBits;
  const decoded = doc.querySelector("#messageInbox .message-entry b")?.textContent?.trim();
  $("#communicationDecoded").textContent = decoded || communicationText("waiting");
}

function renderCommunicationControls() {
  const host = $("#communicationControls");
  host.innerHTML = communicationSettings.map(([key, label, min, max, step, unit]) => `<div class="parameter-control"><label for="comm-${key}"><span>${label[communicationLocale()] || label.en}</span><output id="comm-out-${key}">${state.communicationValues[key]}${unit}</output></label><input id="comm-${key}" data-comm-param="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${state.communicationValues[key]}"></div>`).join("");
  host.querySelectorAll("[data-comm-param]").forEach((control) => control.addEventListener("input", () => {
    const setting = communicationSettings.find(([key]) => key === control.dataset.commParam);
    state.communicationValues[setting[0]] = Number(control.value);
    $("#comm-out-" + setting[0]).textContent = `${control.value}${setting[5]}`;
    syncCommunicationToFrame();
  }));
}

function openCommunication() {
  if (state.selected.id !== "neutrinoLens") return;
  state.communicationOpen = true;
  const frame = $("#communicationFrame");
  if (!frame.src) frame.src = location.pathname.includes("matter-lab") ? "../neutrino-communication/" : "./neutrino-communication/";
  $("#communicationPanel").hidden = false;
  renderInspector();
  prepareCommunicationFrame();
}

function closeCommunication() {
  state.communicationOpen = false;
  $("#communicationPanel").hidden = true;
  renderInspector();
}

$("#communicationFrame").addEventListener("load", prepareCommunicationFrame);
$("#communicationViewBtn").addEventListener("click", openCommunication);
$("#communicationCloseBtn").addEventListener("click", closeCommunication);
$("#communicationPauseBtn").addEventListener("click", () => communicationDocument()?.getElementById("pauseBtn")?.click());
$("#communicationBurstBtn").addEventListener("click", () => communicationDocument()?.getElementById("burstBtn")?.click());
$("#communicationResetBtn").addEventListener("click", () => communicationDocument()?.getElementById("resetBtn")?.click());
$("#communicationSendBtn").addEventListener("click", () => {
  const doc = communicationDocument();
  const message = $("#communicationMessage").value;
  const input = doc?.getElementById("commInput");
  if (!input || !message.trim()) return;
  input.value = message.slice(0, 96);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  doc.getElementById("sendCommBtn")?.click();
});
setInterval(updateCommunicationMetrics, 500);
$("#runInteractionBtn").addEventListener("click", () => {
  if (["quantumChemistry", "semiconductor", "gpuCompute"].includes(state.selected.interaction)) runBackendSolver();
  else runInteraction();
});
$("#backendSolveBtn").addEventListener("click", runBackendSolver);
$("#backendStatus").addEventListener("click", openComputeModal);
$("#computeModalClose").addEventListener("click", closeComputeModal);
$("#computeModal").addEventListener("click", (event) => { if (event.target === $("#computeModal")) closeComputeModal(); });
$("#multiquarkModalClose").addEventListener("click", closeMultiQuarkLab);
$("#multiquarkModal").addEventListener("click", (event) => { if (event.target === $("#multiquarkModal")) closeMultiQuarkLab(); });
$("#mqRunBtn").addEventListener("click", runMultiQuarkSearch);
$("#mqOrbitalModes").addEventListener("input", (event) => { $("#mqOrbitalModesOut").textContent = event.target.value; });
$("#mqCoupling").addEventListener("input", (event) => { $("#mqCouplingOut").textContent = Number(event.target.value).toFixed(2); });
$("#mqDownloadSvBtn").addEventListener("click", downloadMultiQuarkSystemVerilog);
$("#mqCopySvBtn").addEventListener("click", async () => {
  const source = state.multiQuarkResult?.systemVerilog;
  if (!source) return;
  await copyTextToClipboard(source);
  $("#mqCopySvBtn").textContent = "Скопировано";
  setTimeout(() => { $("#mqCopySvBtn").textContent = "Копировать"; }, 1200);
});
$("#resetParamsBtn").addEventListener("click", () => { if (state.selected.visual === "mOrchestrator") { mOrchestrator.reset(); return; } initializeValues(state.selected); renderInspector(); rebuildSpecimen(); runLocalSolver(); applyParameterDrivenVisuals(); });
$("#closeComponentPopover").addEventListener("click", hideComponentInfo);
canvas.addEventListener("pointerdown", (event) => { pointerStart = { x: event.clientX, y: event.clientY }; });
canvas.addEventListener("pointerup", (event) => {
  if (!pointerStart) return;
  const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
  pointerStart = null;
  if (moved <= 5 && state.selected.visual === "mOrchestrator" && mOrchestrator.mapClick(event)) return;
  if (moved <= 5) pickSceneComponent(event);
});
$("#pauseBtn").addEventListener("click", () => {
  state.paused = !state.paused;
  $("#pauseBtn").innerHTML = `<i data-lucide="${state.paused ? "play" : "pause"}"></i>`;
  $("#pauseBtn").setAttribute("aria-label", state.paused ? "Продолжить" : "Пауза");
  if (state.selected.visual === "mOrchestrator") mOrchestrator.tick(0);
  window.lucide?.createIcons();
});
$("#resetViewBtn").addEventListener("click", () => resetCamera(true));
$("#fullscreenBtn").addEventListener("click", () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
$("#viewModes").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-view]");
  if (!button) return;
  state.view = button.dataset.view;
  if (state.selected.visual === "smartProteinRepair") {
    setProteinGraphState(state.view === "damageGraph" ? "DAMAGED" : state.view === "repairedGraph" ? "REPAIRED" : "ORIGINAL");
    return;
  }
  if (state.view === "blackHoleMerger") window.dispatchEvent(new Event("qcd-black-hole-merger-view"));
  $$("#viewModes button").forEach((item) => item.classList.toggle("active", item === button));
  applyViewMode();
  if (["collision", "annihilation"].includes(state.view) && isBaryonModel(state.selected)) {
    const baryon = state.selected.id;
    const selectedMode = state.view;
    state.collisionContext = {
      beamA: baryon,
      beamB: selectedMode === "annihilation" ? BARYON_PARTNERS[baryon] : baryon,
      processMode: selectedMode === "annihilation" ? "annihilation" : "softQCD",
      beamEnergy: .25,
      hardScale: 90,
      eventSeed: 2401,
      detectorField: 3.8
    };
    runLocalSolver();
    rebuildSpecimen();
    renderInspector();
    runInteraction();
  } else {
    const leftBaryonCollider = Boolean(state.collisionContext && isBaryonModel(state.selected));
    if (leftBaryonCollider) {
      state.collisionContext = null;
      state.interaction = null;
      runLocalSolver();
      rebuildSpecimen();
      renderInspector();
    }
    if (state.view === "interaction") {
      runInteraction();
    } else if (state.view === "phaseDemo" && state.selected.visual === "complexSpin") {
      state.interaction = null;
      renderInspector();
      runInteraction();
    } else if (state.view === "passage" && state.selected.visual === "complexSpin") {
      state.interaction = null;
      renderInspector();
      setStatus("M-FIELD MATRIX · choose a probe interaction and run it", false);
    } else if (state.view === "confinement" && isBaryonModel(state.selected)) {
      state.confinementPulled = false;
      rebuildSpecimen();
      renderInspector();
      setStatus("CONFINEMENT · select a valence quark and pull it", false);
    }
  }
});
window.addEventListener("qcd-black-hole-merger-view", () => {
  if (state.selected.id !== "blackHole" || state.view !== "blackHoleMerger") return;
  state.blackHoleMergerRunning = false;
  state.interaction = null;
  rebuildSpecimen();
  runLocalSolver();
  renderInspector();
});
window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => { if (event.key === "Escape") { hideComponentInfo(); closeFormulaModal(); closeComputeModal(); } });

initializeValues(state.selected);
renderCatalog();
renderInspector();
rebuildSpecimen();
runLocalSolver();
const requestedModel = new URLSearchParams(location.search).get("model");
if (requestedModel === "resonantTripleBlackHole") {
  state.family = "hypothetical";
  selectModel(requestedModel);
}
resize();
checkBackend();
window.addEventListener("load", () => window.lucide?.createIcons());
animate();
