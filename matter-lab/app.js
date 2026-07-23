import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { modelRegistry, families } from "./models.js?v=20260722e";
import { solveModel, formatMetric } from "./solver.js?v=20260722e";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rand = (min, max) => min + Math.random() * (max - min);
const clock = new THREE.Clock();

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
  solverResult: null,
  solverMs: 0,
  backendOnline: false,
  visual: null,
  selectedComponent: null
};

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
  if (state.selected.visual === "hybridMatter") {
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
    const group = new THREE.Group();
    const sphere = makeSphere(flavor === "s" ? 0.84 : 0.76, flavor === "s" ? mats.strange : chargeMats[index], [0, 0, 0], 32);
    const ring = new THREE.Mesh(new THREE.TorusGeometry((flavor === "s" ? 0.84 : 0.76) * 1.08, 0.035, 8, 48), chargeMats[index]);
    ring.rotation.x = Math.PI / 2;
    const label = labelSprite(flavor, flavor === "s" ? "#ee72d5" : ["#ff655e", "#63df9b", "#6da2ff"][index]);
    label.position.set(0, 0, 0.86);
    group.add(sphere, ring, label);
    tagComponent(group, flavor === "u" ? "upQuark" : flavor === "d" ? "downQuark" : "strangeQuark", { flavor, index });
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
  const hadron = ["proton", "antiproton", "pionPlus", "pionMinus"].includes(particleId);
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
    const shellColor = particleId === "antiproton" ? 0xee72d5 : particleId === "pionPlus" ? 0x63df9b : particleId === "pionMinus" ? 0x6da2ff : 0xf0ba55;
    const shellRadius = particleId.startsWith("pion") ? .48 : .62;
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(shellRadius, 2), new THREE.MeshPhysicalMaterial({ color: shellColor, transparent: true, opacity: .2, roughness: .25, transmission: .1, depthWrite: false }));
    group.add(shell);
    const offsets = particleId.startsWith("pion") ? [[-.16, .12, 0], [.16, -.12, 0]] : [[-.2, .2, .12], [.22, .12, -.18], [0, -.26, .1]];
    offsets.forEach((offset, index) => group.add(makeSphere(.18, [mats.red, mats.green, mats.blue][index], offset, 14)));
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
    detector.add(cylinder);
    for (const x of [-5.2, -3.2, 0, 3.2, 5.2]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .025, 6, 96), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacity * 1.4 }));
      ring.rotation.y = Math.PI / 2;
      ring.position.x = x;
      detector.add(ring);
    }
  });
  specimen.add(detector);
  const beamA = model.id === "colliderWorkbench" ? state.values.beamA : "proton";
  const beamB = model.id === "colliderWorkbench" ? state.values.beamB : "proton";
  const leftBeam = createColliderBeamParticle(-8, 1, beamA);
  const rightBeam = createColliderBeamParticle(8, -1, beamB);
  const vertex = makeSphere(.15, mats.boson, [0, 0, 0], 18);
  tagComponent(vertex, "colliderDetector", { layer: "interaction point" });
  specimen.add(vertex);
  colliderVisual = { detector, leftBeam, rightBeam, vertex, beamA, beamB };
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
  if (model.visual === "baryon") createBaryon(model);
  else if (model.visual === "atom") createAtom(model);
  else if (model.visual === "denseBaryons") createDenseBaryons();
  else if (model.visual === "hybridMatter") createHybridMatter(model);
  else if (model.visual === "condensateMatter") createCondensateMatter(model);
  else if (model.visual === "crystalMatter") createCrystalMatter(model);
  else if (model.visual === "multiquark") createMultiquark(model);
  else if (model.visual === "meson") createMeson(model);
  else if (model.visual === "collider") createCollider(model);
  else if (["quarkFluid", "strangeMatter", "pairedMatter", "strangelet"].includes(model.visual)) createQuarkMedium(model);
  else if (model.visual === "neutrinoLens") createNeutrinoLens();
  const colliderMode = model.visual === "collider";
  platform.visible = !colliderMode;
  platformRing.visible = !colliderMode;
  chamberRings.visible = !colliderMode;
  applyViewMode();
  applyParameterDrivenVisuals();
  hideComponentInfo();
}

function initializeValues(model) {
  state.values = Object.fromEntries(model.parameters.map((parameter) => [parameter.key, parameter.value]));
}

function colliderProcessOptions(values) {
  const automatic = [["auto", "Авто · по типам пучков"]];
  const hadrons = new Set(["proton", "antiproton", "pionPlus", "pionMinus"]);
  const leptons = new Set(["electron", "positron", "muonMinus", "muonPlus"]);
  const a = values.beamA;
  const b = values.beamB;
  if (hadrons.has(a) && hadrons.has(b)) return [...automatic, ["softQCD", "Soft QCD / minimum-bias"], ["hardQCD", "Hard QCD / dijet"]];
  if ((leptons.has(a) && hadrons.has(b)) || (hadrons.has(a) && leptons.has(b))) return [...automatic, ["dis", "Deep-inelastic scattering"]];
  if ((a === "photon" && hadrons.has(b)) || (hadrons.has(a) && b === "photon")) return [...automatic, ["photoproduction", "Photoproduction"]];
  if (a === "photon" && b === "photon") return [...automatic, ["pairProduction", "γγ pair production"]];
  const conjugates = new Set(["electron:positron", "positron:electron", "muonMinus:muonPlus", "muonPlus:muonMinus"]);
  if (conjugates.has(`${a}:${b}`)) return [...automatic, ["annihilation", "γ*/Z annihilation"]];
  return automatic;
}

function beamLabel(id) {
  return ({ proton: "p", antiproton: "p̄", pionPlus: "π⁺", pionMinus: "π⁻", electron: "e⁻", positron: "e⁺", muonMinus: "μ⁻", muonPlus: "μ⁺", photon: "γ" })[id] || id;
}

function renderCatalog() {
  const filters = $("#familyFilters");
  filters.innerHTML = families.map(([id, label]) => `<button type="button" class="${state.family === id ? "active" : ""}" data-family="${id}">${label}</button>`).join("");
  const query = state.search.trim().toLowerCase();
  const visible = modelRegistry.filter((model) => (state.family === "all" || model.family === state.family) && (!query || `${model.title} ${model.subtitle} ${model.description}`.toLowerCase().includes(query)));
  $("#modelCount").textContent = String(visible.length).padStart(2, "0");
  $("#modelList").innerHTML = visible.map((model) => `
    <button type="button" class="model-item ${state.selected.id === model.id ? "active" : ""}" data-model="${model.id}" data-status="${model.status}">
      <span class="model-dot" aria-hidden="true"></span>
      <span class="model-copy"><strong>${model.title}</strong><span>${model.subtitle}</span></span>
      <span class="model-family">${model.family}</span>
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
  const communicationLabBtn = $("#communicationLabBtn");
  if (communicationLabBtn) communicationLabBtn.hidden = model.id !== "neutrinoLens";
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
  $("#runInteractionBtn span").textContent = interactionLabel(model);

  $("#parameterControls").innerHTML = model.parameters.map((parameter) => {
    const value = state.values[parameter.key];
    if (parameter.type === "select") {
      const options = parameter.key === "processMode" ? colliderProcessOptions(state.values) : parameter.options;
      return `<div class="parameter-control">
        <label for="param-${parameter.key}"><span>${parameter.label}</span></label>
        <select id="param-${parameter.key}" data-param="${parameter.key}">${options.map(([optionValue, label]) => `<option value="${optionValue}" ${optionValue === value ? "selected" : ""}>${label}</option>`).join("")}</select>
      </div>`;
    }
    return `<div class="parameter-control">
      <label for="param-${parameter.key}"><span>${parameter.label}</span><output id="out-${parameter.key}">${formatParameter(value, parameter)}</output></label>
      <input id="param-${parameter.key}" data-param="${parameter.key}" type="range" min="${parameter.min}" max="${parameter.max}" step="${parameter.step}" value="${value}">
    </div>`;
  }).join("");
  $("#parameterControls").querySelectorAll("[data-param]").forEach((control) => control.addEventListener(control.tagName === "SELECT" ? "change" : "input", () => {
    const parameter = model.parameters.find((item) => item.key === control.dataset.param);
    state.values[control.dataset.param] = parameter.type === "select" ? control.value : Number(control.value);
    if (parameter.type !== "select") $(`#out-${control.dataset.param}`).textContent = formatParameter(Number(control.value), parameter);
    if (["beamA", "beamB"].includes(control.dataset.param)) {
      state.values.processMode = "auto";
      renderInspector();
    }
    if (["beamA", "beamB", "processMode", "baryonNumber"].includes(control.dataset.param) || (state.selected.visual === "meson" && ["separation", "stringTension", "constituentMass"].includes(control.dataset.param))) rebuildSpecimen();
    runLocalSolver();
    applyParameterDrivenVisuals();
    const visual = state.visual;
    const response = state.selected.id === "colliderWorkbench" ? `${beamLabel(state.values.beamA)} ↔ ${beamLabel(state.values.beamB)} · ${state.solverResult.state.processLabel}` : state.selected.visual === "hybridMatter" ? `quark fraction ${(visual.quarkFraction * 100).toFixed(0)}%` : `motion ${visual.motionSpeed.toFixed(2)}× · scale ${visual.specimenScale.toFixed(2)}×`;
    setStatus(`${parameter.label} · ${response}`, true);
    if (state.interaction) runInteraction();
  }));

  $("#sourceLinks").innerHTML = model.sources.map(([label, url]) => `<a href="${url}" target="_blank" rel="noreferrer"><span>${label}</span><i data-lucide="external-link" aria-hidden="true"></i></a>`).join("");
  window.lucide?.createIcons();
}

function selectModel(id) {
  const model = modelRegistry.find((item) => item.id === id);
  if (!model) return;
  state.selected = model;
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

function familyTitle(family) {
  return ({ ordinary: "ordinary matter", dense: "dense matter", quark: "quark matter", meson: "meson spectroscopy", collider: "collider event lab", strange: "strange matter", hypothetical: "hypothetical extension" })[family] || family;
}

function interactionLabel(model) {
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

function runLocalSolver() {
  const start = performance.now();
  state.solverResult = solveModel(state.selected, state.values);
  state.solverMs = performance.now() - start;
  $("#telemetrySolver").textContent = `local / ${state.solverMs.toFixed(2)} ms`;
  $("#chartSubtitle").textContent = state.solverResult.primaryLabel;
  const supported = state.solverResult.state?.supported !== false;
  $("#runInteractionBtn").disabled = state.selected.interaction === "collision" && !supported;
  if (state.selected.id === "colliderWorkbench") {
    const pair = `${beamLabel(state.values.beamA)} ↔ ${beamLabel(state.values.beamB)}`;
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
  const data = state.solverResult.data;
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

function runInteraction() {
  if (state.selected.interaction === "collision" && state.solverResult?.state?.supported === false) {
    setStatus(`НЕПОДДЕРЖИВАЕМАЯ ПАРА · ${state.solverResult.state.reason}`, false);
    return;
  }
  state.interaction = state.selected.interaction;
  state.interactionTime = 0;
  state.interactionPhase = null;
  disposeGroup(effects);
  if (state.interaction === "photon") buildPhotonEffect();
  else if (state.interaction === "weak") buildWeakEffect();
  else if (state.interaction === "neutrino") buildNeutrinoPulse();
  else if (state.interaction === "eos") buildCompressionEffect();
  else if (state.interaction === "stability") buildStabilityEffect();
  else if (state.interaction === "binding") buildBindingEffect();
  else if (state.interaction === "stringBreak") buildStringBreakingEffect();
  else if (state.interaction === "collision") buildCollisionEffect();
  else buildBosonEffect();
  setStatus(interactionStatusText(state.interaction), true);
  $("#telemetryState").textContent = state.solverResult?.event?.process || state.interaction;
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
  event.tracks.forEach((track, index) => {
    const points = collisionTrackPoints(track, event.magneticField || 0);
    const color = track.type === "photon" ? 0xf7c652 : track.type === "muon" ? 0xee72d5 : track.type === "electron" ? 0x6da2ff : track.type === "positron" ? 0xf2bf5b : track.type === "neutralHadron" ? 0x8da7ae : track.charge > 0 ? 0x63df9b : 0x6da2ff;
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: track.primary ? .98 : .72 });
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    geometry.setDrawRange(0, 0);
    const line = new THREE.Line(geometry, material);
    const component = track.type === "photon" ? "photon" : track.type === "muon" ? "muon" : track.type === "electron" ? "electron" : track.type === "positron" ? "positron" : track.type === "neutralHadron" ? "neutralHadron" : "chargedHadron";
    tagComponent(line, component, { momentum: track.momentum, charge: track.charge, displaced: track.displaced });
    effects.add(line);
    const marker = makeSphere(track.primary ? .12 : .065, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .92 }), points[0].toArray(), 10);
    tagComponent(marker, component, { momentum: track.momentum, charge: track.charge });
    marker.visible = false;
    effects.add(marker);
    animated.push({ type: "collisionTrack", object: line, marker, points, delay: index * .012, phase: 0 });
  });
  for (const vertex of event.vertices.slice(1)) {
    const marker = makeSphere(.16, mats.helicity, vertex, 14);
    marker.visible = false;
    tagComponent(marker, "colliderDetector", { layer: "displaced vertex" });
    effects.add(marker);
    animated.push({ type: "displacedVertex", object: marker, phase: 0 });
  }
}

function interactionStatusText(type) {
  if (type === "photon") {
    const event = state.solverResult?.event;
    if (event?.process === "ionization") return `PHOTOIONIZATION · Eγ − Eion = ${event.electronEnergy.toFixed(2)} eV`;
    if (event?.process === "excitation") return `PHOTOEXCITATION · 1s → n=${event.targetN}`;
    return "RAYLEIGH SCATTERING · photon is off resonance";
  }
  return ({ weak: "WEAK VERTEX · d → u + W⁻", neutrino: "HYPOTHETICAL LENS · integrating i dψ/dx = Hψ", eos: "EOS SWEEP · P(ε) recalculated", stability: "FINITE SIZE · E/A scan", binding: "TWO-BARYON CHANNEL · V(r) and binding estimate", stringBreak: "QCD STRING · κr grows until q-q̄ pair creation", collision: `COLLISION · ${state.solverResult?.state?.processLabel || "event generator"} · HepMC-ready`, boson: "GLUON FIELD · color exchange" })[type] || "Вычисление";
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
  $("#componentTitle").textContent = info.title;
  $("#componentDescription").textContent = info.description;
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
    if (object?.userData.componentId) {
      showComponentInfo(object);
      return;
    }
  }
  hideComponentInfo();
}

function updateAnimations(time, dt) {
  const visual = state.visual || deriveVisualState();
  const speed = (state.values.timeScale || state.values.decaySpeed || 1) * visual.motionSpeed;
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
    if (!item.object?.parent) continue;
    if (item.type === "quark") {
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
    if (state.interactionTime > 9) {
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
$("#matterWorkspaceBtn").addEventListener("click", () => { state.family = "all"; state.search = ""; $("#modelSearch").value = ""; selectModel("proton"); });
$("#colliderWorkspaceBtn").addEventListener("click", () => { state.family = "collider"; state.search = ""; $("#modelSearch").value = ""; selectModel("colliderWorkbench"); });
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
  $$("#viewModes button").forEach((item) => item.classList.toggle("active", item === button));
  applyViewMode();
  if (state.view === "interaction") runInteraction();
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
