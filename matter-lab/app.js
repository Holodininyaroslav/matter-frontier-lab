import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { USDZLoader } from "three/addons/loaders/USDZLoader.js";
import { modelRegistry, families, setCatalogLocale } from "./models.js?v=20260723-tesseract-slice-modes";
import { solveModel, formatMetric } from "./solver.js?v=20260722e";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rand = (min, max) => min + Math.random() * (max - min);
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
  visual: null,
  selectedComponent: null,
  confinementChoice: 0,
  confinementPulled: false,
  communicationOpen: false,
  communicationValues: { neutrinoRate: 80, photonRate: 55, energy: 10, rockThickness: 190, reflectivity: 96 },
  blackHoleMergerRunning: false
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
  const count = Number(values.coreCount || 8);
  const radius = Number(values.coreOrbitRadius || 5.8);
  const core = new THREE.Group();
  const holes = [];
  const orbitPoints = [];

  for (let index = 0; index < 160; index += 1) {
    const angle = (index / 160) * Math.PI * 2;
    orbitPoints.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius * 0.54));
  }
  const orbit = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(orbitPoints),
    new THREE.LineBasicMaterial({ color: 0x55e7ff, transparent: true, opacity: 0.28 })
  );
  orbit.userData.pickable = false;
  core.add(orbit);

  for (let index = 0; index < count; index += 1) {
    const group = new THREE.Group();
    const horizon = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 28, 20),
      new THREE.MeshPhysicalMaterial({ color: 0x02040b, roughness: 0.15, metalness: 0.1, clearcoat: 0.8 })
    );
    const photonRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.57, 0.035, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0xffbd54, transparent: true, opacity: 0.88 })
    );
    photonRing.rotation.x = Math.PI / 2;
    const lensedBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.49, 0.022, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xff5e87, transparent: true, opacity: 0.55 })
    );
    lensedBand.rotation.set(0.72, 0.28, 0.22);
    group.add(horizon, photonRing, lensedBand);
    tagComponent(group, "gravitationalCoreNode", { index: index + 1, representation: "hypothetical compact horizon" });
    core.add(group);
    holes.push({ group, photonRing, lensedBand, phase: (index / count) * Math.PI * 2 });
  }
  specimen.add(core);

  const gridGeometry = new THREE.PlaneGeometry(23, 23, 48, 48);
  gridGeometry.rotateX(-Math.PI / 2);
  const baseGrid = Float32Array.from(gridGeometry.attributes.position.array);
  const grid = new THREE.Mesh(
    gridGeometry,
    new THREE.MeshBasicMaterial({ color: 0x81edff, wireframe: true, transparent: true, opacity: Number(values.gridOpacity ?? 0.52), depthWrite: false })
  );
  grid.position.y = -1.65;
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

  const nodes = [];
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const node = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0xe8f8ff, transparent: true, opacity: 0.65 })
    );
    node.position.set(Math.cos(angle) * 3.2, 0.06, Math.sin(angle) * 3.2 * 0.54);
    node.userData.pickable = false;
    specimen.add(node);
    nodes.push(node);
  }

  animated.push({ type: "standingWaveCore", core, holes, grid, baseGrid, fronts, nodes, count });
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

function createSpacetimeGrid() {
  const geometry = new THREE.PlaneGeometry(31, 21, 76, 52);
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
  else if (model.visual === "macro") createMacroObject(model);
  else if (model.visual === "denseBaryons") createDenseBaryons();
  else if (model.visual === "hybridMatter") createHybridMatter(model);
  else if (model.visual === "condensateMatter") createCondensateMatter(model);
  else if (model.visual === "crystalMatter") createCrystalMatter(model);
  else if (model.visual === "multiquark") createMultiquark(model);
  else if (model.visual === "meson") createMeson(model);
  else if (model.visual === "collider") createCollider(model);
  else if (["quarkFluid", "strangeMatter", "pairedMatter", "strangelet"].includes(model.visual)) createQuarkMedium(model);
  else if (model.visual === "neutrinoLens") createNeutrinoLens();
  const cleanMacroStage = model.visual === "macro";
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
  const baseFamilies = families.filter(([id]) => !["ordinary", "exotic", "macro"].includes(id));
  const macroFamily = families.find(([id]) => id === "macro");
  const ordinaryFamilies = [["baryon", "Барионы"], ["lepton", "Лептоны"], ["nuclear", "Ядра и атомы"]];
  const orderedFamilies = [...baseFamilies.slice(0, 1), ...ordinaryFamilies, ...baseFamilies.slice(1), families.find(([id]) => id === "exotic"), macroFamily].filter(Boolean);
  filters.innerHTML = orderedFamilies.map(([id, label]) => `<button type="button" class="${state.family === id ? "active" : ""}" data-family="${id}">${label}</button>`).join("");
  const query = state.search.trim().toLowerCase();
  const familyMatches = (model) => {
    if (state.family === "all") return true;
    if (state.family === "baryon") return model.family === "baryon" || ["proton", "neutron"].includes(model.id);
    if (state.family === "nuclear") return ["hydrogen", "helium4"].includes(model.id);
    return model.family === state.family;
  };
  const visible = modelRegistry.filter((model) => familyMatches(model) && (!query || `${model.title} ${model.subtitle} ${model.description}`.toLowerCase().includes(query)));
  $("#modelCount").textContent = String(visible.length).padStart(2, "0");
  const familyLabels = (localStorage.getItem("qcd-neutrino-language") || "en") === "ru"
    ? { baryon: "БАРИОН", lepton: "ЛЕПТОН", nuclear: "ЯДРО", ordinary: "ОБЫЧНАЯ", exotic: "ЭКЗОТИЧЕСКАЯ" }
    : { baryon: "BARYON", lepton: "LEPTON", nuclear: "NUCLEUS", ordinary: "ORDINARY", exotic: "EXOTIC" };
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

function renderInspector() {
  const model = state.selected;
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
  $("#telemetryScale").textContent = model.visual === "atom" ? "10⁻¹⁰ m" : model.visual === "neutrinoLens" ? "macroscopic" : model.visual === "collider" ? "event display" : "1 fm";
  $("#telemetryState").textContent = model.status;
  const isMFieldRegion = model.visual === "complexSpin" && state.values.configuration === "lattice";
  const matrixPassage = isMFieldRegion && state.view === "passage";
  const phaseDemo = isMFieldRegion && state.view === "phaseDemo";
  const blackHoleMerger = model.id === "blackHole" && state.view === "blackHoleMerger";
  const standingWaveCore = model.visual === "standingWaveCore";
  $("#runInteractionBtn").hidden = (["macro", "polytope4d"].includes(model.visual) && !blackHoleMerger) || (model.visual === "complexSpin" && !matrixPassage && !phaseDemo);
  const runInteractionLabel = $("#runInteractionBtn span");
  if (runInteractionLabel) runInteractionLabel.textContent = matrixPassage ? ((localStorage.getItem("qcd-neutrino-language") || "en") === "ru" ? "Запустить зонд" : "Run probe") : interactionLabel(model);

  if (phaseDemo && runInteractionLabel) runInteractionLabel.textContent = (localStorage.getItem("qcd-neutrino-language") || "en") === "ru" ? "Р—Р°РїСѓСЃС‚РёС‚СЊ РґРµРјРѕРЅСЃС‚СЂР°С†РёСЋ" : "Run demonstration";
  if (blackHoleMerger && runInteractionLabel) runInteractionLabel.textContent = state.blackHoleMergerRunning ? "Restart merger" : "Start merger";
  if (standingWaveCore && runInteractionLabel) runInteractionLabel.textContent = (localStorage.getItem("qcd-neutrino-language") || "en") === "ru" ? "Возбудить резонанс" : "Excite resonance";
  const visibleParameters = model.parameters.filter((parameter) => {
    const mFieldParameters = ["probeType", "mMode", "iPhase", "iCoupling", "leakage", "projectionCoherence"];
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
  }).join("") + (blackHoleMerger ? blackHoleMergerPanel() : "") + (isMFieldRegion ? mFieldProjectionPanel() : "") + (matrixPassage ? matrixPassageExplanation() : "") + (phaseDemo ? phaseDemoExplanation() : "") + (model.visual === "collider" ? `
    <div class="collider-controls">
      <div class="collider-controls-title">Collider display</div>
      <label for="detectorOpacity"><span>Detector visibility</span><output id="detectorOpacityOut">${Math.round((state.values.detectorOpacity ?? 0) * 100)}%</output></label>
      <input id="detectorOpacity" type="range" min="0" max="1" step="0.01" value="${state.values.detectorOpacity ?? 0}">
      <label for="collisionSpeed"><span>Event speed</span><output id="collisionSpeedOut">${(state.values.collisionSpeed ?? 1).toFixed(2)}×</output></label>
      <input id="collisionSpeed" type="range" min="0.05" max="2" step="0.05" value="${state.values.collisionSpeed ?? 1}">
      <button id="colliderPauseBtn" class="solver-btn" type="button">${state.paused ? "Resume event" : "Pause event"}</button>
  </div>` : "") + (model.visual === "collider" ? collisionExplanation() : "") + (isBaryonModel(model) && state.view === "confinement" ? confinementControls() : "");
  $("#parameterControls").querySelectorAll("[data-param]").forEach((control) => control.addEventListener(control.tagName === "SELECT" ? "change" : "input", () => {
    const parameter = model.parameters.find((item) => item.key === control.dataset.param);
    state.values[control.dataset.param] = parameter.type === "select" ? control.value : Number(control.value);
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
    if (["beamA", "beamB", "processMode", "baryonNumber", "configuration", "binaryCount", "binaryMassA", "binaryMassB", "binaryMassC", "spinA", "spinB", "initialSeparation", "mergerConfiguration", "inclination", "coreCount"].includes(control.dataset.param) || (state.selected.id === "blackHole" && ["mass", "diskRadius"].includes(control.dataset.param)) || (state.selected.visual === "meson" && ["separation", "stringTension", "constituentMass"].includes(control.dataset.param))) rebuildSpecimen();
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
  $("#sourceLinks").innerHTML = model.sources.map(([label, url]) => `<a href="${url}" target="_blank" rel="noreferrer"><span>${label}</span><i data-lucide="external-link" aria-hidden="true"></i></a>`).join("");
  if (model.id === "neutrinoLens" && state.communicationOpen) renderCommunicationControls();
  window.lucide?.createIcons();
}

function renderViewModes(model) {
  const buttons = $$("#viewModes button[data-view]");
  const ru = (localStorage.getItem("qcd-neutrino-language") || "en") === "ru";
  const labels = model.id === "blackHole"
    ? [["structure", "orbit", ru ? "Чёрная дыра" : "Black hole"], ["blackHoleMerger", "waves", ru ? "Симулятор слияния" : "Black-hole merger simulator"]]
    : model.visual === "macro"
    ? [["structure", "orbit", ru ? "Объект" : "Object"]]
    : model.visual === "complexSpin"
    ? [["structure", "layers-3", ru ? "3D-проекция" : "3D projection"], ...(state.values.configuration === "lattice" ? [["passage", "scan-line", ru ? "Прохождение" : "Passage"]] : [])]
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
  state.interaction = null;
  state.interactionTime = 0;
  renderCatalog();
  renderInspector();
  $(".inspector-panel").scrollTop = 0;
  rebuildSpecimen();
  runLocalSolver();
  resetCamera(false);
  setStatus("Система готова", false);
}

window.addEventListener("qcd-language-change", (event) => {
  setCatalogLocale(event.detail?.locale || "en");
  renderCatalog();
  renderInspector();
});

function familyTitle(family) {
  return ({ ordinary: "ordinary matter", dense: "dense matter", quark: "quark matter", meson: "meson spectroscopy", collider: "collider event lab", strange: "strange matter", hypothetical: "my hypotheses", macro: "macro objects" })[family] || family;
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
  return "Возбудить глюонное поле";
}

function formatParameter(value, parameter) {
  if (parameter.type === "select") return String(value);
  const decimals = parameter.step < .1 ? 2 : parameter.step < 1 ? 1 : 0;
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

function runLocalSolver() {
  const start = performance.now();
  const collisionModel = state.collisionContext ? modelRegistry.find((model) => model.id === "colliderWorkbench") : null;
  const collisionValues = state.collisionContext ? { ...state.values, ...state.collisionContext } : state.values;
  state.solverResult = state.selected.id === "blackHole" && state.view === "blackHoleMerger" ? solveBlackHolePreview(state.values) : solveModel(collisionModel || state.selected, collisionValues);
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
  fieldObjects.forEach((object) => { object.visible = true; });
  if (currentShell) currentShell.visible = state.view !== "field";
  primaryParticles.forEach((object) => { object.visible = true; });
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
    atom: ["Neutral atom", "energy-level shift", "The trajectory is weakly perturbed and the orbit marker changes scale in the field."]
  }[state.values.probeType] || ["Probe", "effective response", "Choose a probe interaction."];
  const mode = {
    scalar: ["Scalar M-quant", "a localized phase and effective-mass response is sampled within the bounded 3D volume."],
    vector: ["Vector M-quant", "the field supplies a direction-dependent effective response, shown as the strongest probe deflection."],
    standing: ["Distributed M-wave", "the field is a standing spatial mode: a probe couples to a distributed amplitude rather than to individual lattice dots."]
  }[state.values.mMode] || ["M-field", "Choose a field mode."];
  return `<section class="collision-explanation"><div class="collider-controls-title">3D M-field passage · educational hypothesis</div><strong>${mode[0]}</strong><p>${mode[1]}</p><strong>${probe[0]}: ${probe[1]}</strong><p>${probe[2]}</p><small>The probe moves only through ordinary x, y, z space. The grid is a 3D sampling of a bounded M-field; it is not a set of visible 4D particles and no claim of a new interaction is made.</small></section>`;
  return `<section class="collision-explanation"><div class="collider-controls-title">M-field passage · educational hypothesis</div><strong>${probe[0]}: ${probe[1]}</strong><p>${probe[2]}</p><small>This is a qualitative effective-medium demonstration for the proposed lattice, not an experimentally established 4D interaction.</small></section>`;
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
  const matrixPassage = state.selected.visual === "complexSpin" && state.values.configuration === "lattice" && state.view === "passage";
  const phaseDemo = state.selected.visual === "complexSpin" && state.values.configuration === "lattice" && state.view === "phaseDemo";
  const collisionMode = Boolean(state.collisionContext && isBaryonModel(state.selected));
  const blackHoleMerger = state.selected.id === "blackHole" && state.view === "blackHoleMerger";
  const standingWaveCore = state.selected.visual === "standingWaveCore";
  if ((state.selected.interaction === "collision" || collisionMode) && state.solverResult?.state?.supported === false) {
    setStatus(`НЕПОДДЕРЖИВАЕМАЯ ПАРА · ${state.solverResult.state.reason}`, false);
    return;
  }
  state.interaction = blackHoleMerger ? "blackHoleMerger" : standingWaveCore ? "standingWaveResonance" : phaseDemo ? "phaseDemo" : matrixPassage ? "matrixPassage" : collisionMode ? "collision" : state.selected.interaction;
  state.blackHoleMergerRunning = blackHoleMerger;
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
  else if (state.interaction === "standingWaveResonance") { /* scene animation owns this educational resonance view */ }
  else buildBosonEffect();
  if (["collision", "blackHoleMerger"].includes(state.interaction)) renderInspector();
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
  const settings = {
    photon: { color: 0xf7c652, bend: .8, radius: .11, label: "photon · refracted through M-field" },
    electron: { color: 0xb28cff, bend: 1.65, radius: .14, label: "electron · deflected by M-field" },
    neutrino: { color: 0x54d8ff, bend: .13, radius: .09, label: "neutrino · phase-shifted through M-field" },
    atom: { color: 0x63df9b, bend: .45, radius: .17, label: "atom · energy shift in M-field" }
  }[probeType];
  const points = [];
  for (let index = 0; index <= 120; index += 1) {
    const progress = index / 120;
    const x = THREE.MathUtils.lerp(-7.4, 7.4, progress);
    const vectorBend = .28 + modes.vector * 1.45;
    const tensorBend = modes.tensor * .48 * Math.sin(Math.PI * progress * 2);
    const y = settings.bend * (vectorBend + tensorBend) * Math.sin(Math.PI * progress) * (probeType === "electron" ? Math.sin(Math.PI * progress) : 1);
    const z = (probeType === "photon" ? .35 * Math.sin(Math.PI * progress * 2) : probeType === "atom" ? .2 * Math.sin(Math.PI * progress) : 0)
      + modes.tensor * .26 * Math.sin(Math.PI * progress * 2) + modes.scalar * .1 * Math.sin(Math.PI * progress * 5);
    points.push(new THREE.Vector3(x, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: settings.color, transparent: true, opacity: .66 }));
  tagComponent(trail, probeType === "neutrino" ? "neutrino" : probeType, { role: settings.label, medium: "bounded 3D M-field / phase-to-spin projection" });
  const probe = makeSphere(settings.radius, new THREE.MeshBasicMaterial({ color: settings.color }), points[0].toArray(), 16);
  tagComponent(probe, probeType === "neutrino" ? "neutrino" : probeType, { role: settings.label, medium: "bounded 3D M-field / phase-to-spin projection" });
  const phaseRing = new THREE.Mesh(new THREE.TorusGeometry(.34, .025, 8, 40), new THREE.MeshBasicMaterial({ color: settings.color, transparent: true, opacity: .72 }));
  phaseRing.rotation.x = Math.PI / 2;
  phaseRing.visible = probeType === "neutrino" || probeType === "atom" || modes.scalar > .42;
  effects.add(trail, probe, phaseRing);
  animated.push({ type: "matrixProbe", object: probe, curve, trail, phaseRing, probeType, settings, phase: 0 });
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

function updateAnimations(time, dt) {
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
      const orbitalRadius = Number(values.coreOrbitRadius ?? 5.8);
      const orbitalRate = Number(values.coreOrbitRate ?? .32);
      const density = Number(values.nodeDensity ?? 3);
      const stability = Number(values.resonanceStability ?? .84);
      const active = state.interaction === "standingWaveResonance" ? 1 : .38;
      const phase = t * frequency * Math.PI * 2;
      const cross = values.polarization === "cross";
      const elliptical = values.polarization === "elliptical";

      item.holes.forEach((hole, index) => {
        const angle = hole.phase + t * orbitalRate * (.3 + .7 * stability);
        const offset = cross ? Math.PI / 4 : 0;
        hole.group.position.set(
          Math.cos(angle + offset) * orbitalRadius,
          .13 * Math.sin(phase + index),
          Math.sin(angle + offset) * orbitalRadius * .54
        );
        const pulse = 1 + .18 * amplitude * active * Math.cos(phase * 1.7 + index * Math.PI * 2 / item.count);
        hole.group.scale.setScalar(pulse);
        hole.photonRing.rotation.z += dt * (.7 + orbitalRate);
        hole.lensedBand.rotation.y += dt * (.3 + orbitalRate * .5);
      });

      const positions = item.grid.geometry.attributes.position.array;
      for (let index = 0; index < positions.length; index += 3) {
        const x = item.baseGrid[index];
        const z = item.baseGrid[index + 2];
        const radius = Math.hypot(x, z);
        const angle = Math.atan2(z, x);
        const polarisation = cross ? Math.sin(2 * angle) : elliptical ? .65 + .35 * Math.cos(2 * angle + phase * .22) : Math.cos(2 * angle);
        const standing = Math.sin(radius * (.52 + density * .17)) * Math.cos(phase);
        positions[index] = x;
        positions[index + 1] = item.baseGrid[index + 1] - amplitude * active * 1.55 * standing * polarisation;
        positions[index + 2] = z;
      }
      item.grid.geometry.attributes.position.needsUpdate = true;
      item.grid.material.opacity = Number(values.gridOpacity ?? .52);

      item.fronts.forEach((front, index) => {
        const envelope = .5 + .5 * Math.cos(phase * (1 + index * .11) + index);
        const scale = (2.25 + index * 1.58) * (1 + amplitude * active * .18 * envelope);
        front.scale.setScalar(scale);
        front.material.opacity = Number(values.frontOpacity ?? .30) * (.3 + envelope * .7) * (index % 2 ? .82 : 1);
        front.rotation.y += dt * (.08 + index * .015);
      });
      item.nodes.forEach((node, index) => {
        const strength = .35 + .65 * Math.abs(Math.sin(phase + index * density * .34));
        node.scale.setScalar(.55 + strength);
        node.material.opacity = .25 + strength * .65;
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
    const mergerDuration = state.interaction === "blackHoleMerger" ? getMergerDuration(state.values) : 9;
    if (state.interactionTime > mergerDuration) {
      if (state.interaction === "blackHoleMerger") state.interactionTime = mergerDuration;
      state.interaction = null;
      setStatus("Процесс завершён · результат обновлён", false);
      $("#telemetryState").textContent = state.selected.status;
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
    $("#backendStatus").className = "online";
    $("#backendStatus").innerHTML = `<i data-lucide="server"></i> backend: ${data.engine}`;
  } catch {
    state.backendOnline = false;
    $("#backendStatus").className = "offline";
    $("#backendStatus").innerHTML = `<i data-lucide="server-off"></i> backend: optional`;
  }
  window.lucide?.createIcons();
}

async function runBackendSolver() {
  const button = $("#backendSolveBtn");
  if (!state.backendOnline) {
    setStatus("Backend не запущен · использован browser solver", false);
    runLocalSolver();
    return;
  }
  button.disabled = true;
  setStatus("BACKEND · расчёт модели", true);
  try {
    const response = await fetch("./api/solve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: state.selected.id, values: state.values }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Backend error");
    state.solverResult = payload.result;
    state.solverMs = payload.elapsed_ms;
    $("#telemetrySolver").textContent = `backend / ${payload.elapsed_ms.toFixed(2)} ms`;
    renderMetrics();
    drawChart();
    setStatus(`BACKEND · ${payload.engine} · завершено`, false);
  } catch (error) {
    setStatus(`Backend error · ${error.message}`, false);
  } finally {
    button.disabled = false;
  }
}

function resetCamera(immediate = true) {
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
  const dt = Math.min(clock.getDelta(), .04);
  const time = clock.elapsedTime;
  if (!state.paused) {
    updateAnimations(time, dt);
    platformRing.material.opacity = .48 + Math.sin(time * 1.2) * .09;
  }
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
$("#runInteractionBtn").addEventListener("click", runInteraction);
$("#backendSolveBtn").addEventListener("click", runBackendSolver);
$("#resetParamsBtn").addEventListener("click", () => { initializeValues(state.selected); renderInspector(); rebuildSpecimen(); runLocalSolver(); applyParameterDrivenVisuals(); });
$("#closeComponentPopover").addEventListener("click", hideComponentInfo);
canvas.addEventListener("pointerdown", (event) => { pointerStart = { x: event.clientX, y: event.clientY }; });
canvas.addEventListener("pointerup", (event) => {
  if (!pointerStart) return;
  const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
  pointerStart = null;
  if (moved <= 5) pickSceneComponent(event);
});
$("#pauseBtn").addEventListener("click", () => {
  state.paused = !state.paused;
  $("#pauseBtn").innerHTML = `<i data-lucide="${state.paused ? "play" : "pause"}"></i>`;
  $("#pauseBtn").setAttribute("aria-label", state.paused ? "Продолжить" : "Пауза");
  window.lucide?.createIcons();
});
$("#resetViewBtn").addEventListener("click", () => resetCamera(true));
$("#fullscreenBtn").addEventListener("click", () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
$("#viewModes").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-view]");
  if (!button) return;
  state.view = button.dataset.view;
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
window.addEventListener("keydown", (event) => { if (event.key === "Escape") hideComponentInfo(); });

initializeValues(state.selected);
renderCatalog();
renderInspector();
rebuildSpecimen();
runLocalSolver();
resize();
checkBackend();
window.addEventListener("load", () => window.lucide?.createIcons());
animate();
