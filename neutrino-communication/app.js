import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rand = (min, max) => min + Math.random() * (max - min);
const v = (x, y, z) => new THREE.Vector3(x, y, z);

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050b12);
scene.fog = new THREE.Fog(0x050b12, 420, 920);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 1600);
camera.position.set(250, 160, 230);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.target.set(0, 0, 0);
controls.minDistance = 80;
controls.maxDistance = 680;

const params = {
  neutrinoRate: 80,
  photonRate: 55,
  energyGeV: 10,
  detectorRadiusM: 32,
  detectorDepthM: 42,
  rockThicknessM: 190,
  rockOpacity: 0.72,
  reflectivity: 0.96,
  paused: false,
};

const stats = {
  nuEmitted: 0,
  nuThrough: 0,
  nuDetected: 0,
  photonEmitted: 0,
  photonReflected: 0,
  photonDetected: 0,
};

const positions = {
  sourceX: -220,
  rockX: 0,
  detectorX: 230,
  neutrinoLaneZ: 48,
  photonLaneZ: -48,
};

const materials = {
  source: new THREE.MeshStandardMaterial({ color: 0x2a9dff, roughness: 0.35, metalness: 0.45 }),
  sourceGlow: new THREE.MeshBasicMaterial({ color: 0x4bdcff, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
  laser: new THREE.MeshStandardMaterial({ color: 0xffb329, roughness: 0.28, metalness: 0.48, emissive: 0x4a2600, emissiveIntensity: 0.35 }),
  laserGlow: new THREE.MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.26, side: THREE.DoubleSide }),
  rock: new THREE.MeshStandardMaterial({ color: 0x65635a, roughness: 0.98, metalness: 0.01, transparent: true, opacity: params.rockOpacity, flatShading: true, side: THREE.DoubleSide }),
  rockEdge: new THREE.LineBasicMaterial({ color: 0xc2c9c7, transparent: true, opacity: 0.24 }),
  rockCrack: new THREE.LineBasicMaterial({ color: 0x101820, transparent: true, opacity: 0.58 }),
  cavity: new THREE.MeshBasicMaterial({ color: 0x00131a, transparent: true, opacity: 0.68, side: THREE.DoubleSide, depthWrite: false, depthTest: false }),
  cavityEdge: new THREE.LineBasicMaterial({ color: 0x52d7ff, transparent: true, opacity: 0.76, depthTest: false }),
  modulator: new THREE.MeshBasicMaterial({ color: 0x8cf3ff, transparent: true, opacity: 0.92, depthTest: false }),
  modulatorHalo: new THREE.MeshBasicMaterial({ color: 0x52d7ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthTest: false }),
  polarization0: new THREE.LineBasicMaterial({ color: 0x52d7ff, transparent: true, opacity: 0.72, depthTest: false }),
  polarization1: new THREE.LineBasicMaterial({ color: 0xff64d8, transparent: true, opacity: 0.84, depthTest: false }),
  detector: new THREE.MeshPhysicalMaterial({ color: 0x2b7cff, roughness: 0.18, metalness: 0.05, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
  detectorRing: new THREE.MeshStandardMaterial({ color: 0x7fb2ff, roughness: 0.26, metalness: 0.66 }),
  photonDetector: new THREE.MeshPhysicalMaterial({ color: 0xffbd35, roughness: 0.2, metalness: 0.08, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
  photonDetectorRing: new THREE.MeshStandardMaterial({ color: 0xffd45a, roughness: 0.24, metalness: 0.58 }),
  floor: new THREE.MeshStandardMaterial({ color: 0x0c2632, roughness: 0.86, metalness: 0.02 }),
  neutrino: new THREE.MeshBasicMaterial({ color: 0x52d7ff }),
  neutrinoTrail: new THREE.LineBasicMaterial({ color: 0x52d7ff, transparent: true, opacity: 0.38 }),
  photon: new THREE.MeshBasicMaterial({ color: 0xffd45a }),
  photonTrail: new THREE.LineBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.55 }),
  hit: new THREE.MeshBasicMaterial({ color: 0x49e58b, transparent: true, opacity: 0.82 }),
  blocked: new THREE.MeshBasicMaterial({ color: 0xff6b6b, transparent: true, opacity: 0.62 }),
  grid: new THREE.LineBasicMaterial({ color: 0x3d708c, transparent: true, opacity: 0.24 }),
};

scene.add(new THREE.AmbientLight(0x89b5d6, 0.36));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(120, 260, 120);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
scene.add(keyLight);
const rimLight = new THREE.PointLight(0x52d7ff, 1.8, 520);
rimLight.position.set(positions.sourceX, 50, 0);
scene.add(rimLight);
const detectorLight = new THREE.PointLight(0x668bff, 1.4, 420);
detectorLight.position.set(positions.detectorX, 40, 0);
scene.add(detectorLight);

const world = new THREE.Group();
scene.add(world);

const sourceGroup = new THREE.Group();
const rockGroup = new THREE.Group();
const detectorGroup = new THREE.Group();
const particleGroup = new THREE.Group();
const labelGroup = new THREE.Group();
world.add(sourceGroup, rockGroup, detectorGroup, particleGroup, labelGroup);

let detectorMesh;
let rockMesh;
let rockWire;
let modulatorSphere;
let modulatorHalo;
let modulatorRings = [];
let detectorRings = [];
let particles = [];
let spawnNuCarry = 0;
let spawnPhotonCarry = 0;
let lastTime = performance.now();
const comms = {
  active: false,
  bitInterval: 0.34,
  travelDelay: 1.05,
  txBits: "",
  sentBits: "",
  rxBits: "",
  sentIndex: 0,
  pendingBits: [],
  message: "",
  bytes: [],
  log: [],
  currentBit: null,
  modulatorPulse: 0,
};

const LANG_KEY = "neutrino-lab-language";
let currentLanguage = localStorage.getItem(LANG_KEY) || "en";

const translations = {
  en: {
    dir: "ltr",
    title: "Neutrino Rock Penetration Lab",
    header: "Two left-side emitters: neutrino beam and photon laser. Two right-side detectors measure what passes the thick hollow convex rock.",
    languageLabel: "Language",
    scienceTitle: "What happens in the simulation",
    scienceP1: "Two independent installations run on the left: the blue channel emits neutrinos and the yellow channel emits laser photons. The thick rock reflects photons, while neutrinos pass through the rock and the sealed cavity with almost no loss.",
    scienceP2: "Scientific basis: the Fermilab NuMI/MINERvA experiment transmitted a message with neutrino pulses through 1.035 km, including 240 m of earth.",
    paperPrefix: "Paper:",
    paperTitle: "Stancil et al., Demonstration of Communication using Neutrinos",
    paperMeta: "Fermilab-Pub-12-073-E; arXiv:1203.2847; DOI: 10.1142/S0217732312500770",
    commTitle: "Neutrino message console",
    commPlaceholder: "Type a message for neutrino modulation",
    transmit: "Transmit",
    clearLog: "Clear log",
    commReady: "Ready for cavity polarization modulation",
    commActive: (sent, total, rx) => `CAVITY MOD ${sent}/${total} bits | DETECTOR RX ${rx}/${total} bits`,
    commHelp: "The source stays constant. The small sphere inside the rock cavity flips the neutrino-beam polarization: 0 = cyan pass, 1 = magenta deflected twist. The detector reconstructs UTF-8 bytes.",
    pause: "Pause",
    resume: "Resume",
    reset: "Reset",
    burst: "Burst",
    neutrinoRate: "Neutrino rate",
    photonRate: "Photon / EM rate",
    energy: "Neutrino energy",
    detectorRadius: "Detector radius",
    detectorDepth: "Detector thickness",
    rockThickness: "Rock thickness",
    rockOpacity: "Rock opacity",
    reflectivity: "Photon reflectivity",
    metricsNu: "Neutrinos emitted",
    metricsThrough: "Through rock",
    metricsDetected: "Detected",
    metricsPhoton: "Photons emitted",
    metricsReflected: "Photons reflected",
    metricsPhotonDetected: "Photons detected",
    metricsInteraction: "Interaction P",
    footerNu: "Neutrinos: pass through rock and hollow space with negligible loss",
    footerPhoton: "Photons / EM: mostly reflect from the rock surface",
    footerHit: "Green flash: detector event in the matching channel",
    detectorTitle: "Detector parameters",
    medium: "Medium",
    water: "water Cherenkov",
    density: "Density",
    photonChannel: "Photon channel",
    laserSensor: "laser sensor",
    nucleonColumn: "Nucleon column",
    crossSection: "Cross section",
    rockLoss: "Rock loss",
    messagesTitle: "Neutrino messages",
    txBits: "TX bits",
    rxBits: "RX bits",
    waiting: "waiting",
    noMessages: "No decoded messages yet",
    bitSuffix: "bits",
    capSource: "NEUTRINO SOURCE",
    capLaser: "PHOTON LASER",
    capRock: "THICK HOLLOW CONVEX ROCK",
    capDetector: "NEUTRINO DETECTOR",
    capPhotonDetector: "PHOTON DETECTOR",
    visual: "visual",
  },
  ru: {
    dir: "ltr",
    title: "Лаборатория прохождения нейтрино через скалу",
    header: "Слева два излучателя: нейтринный пучок и фотонный лазер. Справа два детектора измеряют, что проходит через толстую выпуклую скалу с полостью.",
    languageLabel: "Язык",
    scienceTitle: "Что происходит в симуляции",
    scienceP1: "Слева работают две независимые установки: голубой канал выпускает нейтрино, желтый канал выпускает лазерные фотоны. Толстая скала отражает фотоны, а нейтрино проходят через скалу и закрытую полость почти без потерь.",
    scienceP2: "Научная основа: эксперимент NuMI/MINERvA в Fermilab передал сообщение нейтринными импульсами через 1.035 км, включая 240 м земли.",
    paperPrefix: "Работа:",
    paperTitle: "Stancil et al., Demonstration of Communication using Neutrinos",
    paperMeta: "Fermilab-Pub-12-073-E; arXiv:1203.2847; DOI: 10.1142/S0217732312500770",
    commTitle: "Консоль нейтринного сообщения",
    commPlaceholder: "Введите сообщение для нейтринной модуляции",
    transmit: "Передать",
    clearLog: "Очистить журнал",
    commReady: "Готово к модуляции поляризации в полости",
    commActive: (sent, total, rx) => `МОДУЛЯТОР ${sent}/${total} бит | ДЕТЕКТОР ${rx}/${total} бит`,
    commHelp: "Источник остается постоянным. Маленькая сфера внутри полости скалы меняет поляризацию нейтринного пучка: 0 = голубое прохождение, 1 = пурпурное отклонение/закрутка. Детектор восстанавливает UTF-8 байты.",
    pause: "Пауза",
    resume: "Продолжить",
    reset: "Сброс",
    burst: "Всплеск",
    neutrinoRate: "Частота нейтрино",
    photonRate: "Частота фотонов / ЭМ",
    energy: "Энергия нейтрино",
    detectorRadius: "Радиус детектора",
    detectorDepth: "Толщина детектора",
    rockThickness: "Толщина скалы",
    rockOpacity: "Прозрачность скалы",
    reflectivity: "Отражение фотонов",
    metricsNu: "Выпущено нейтрино",
    metricsThrough: "Через скалу",
    metricsDetected: "Зарегистрировано",
    metricsPhoton: "Выпущено фотонов",
    metricsReflected: "Отражено фотонов",
    metricsPhotonDetected: "Фотонов в детекторе",
    metricsInteraction: "Вероятность",
    footerNu: "Нейтрино: проходят через скалу и полость почти без потерь",
    footerPhoton: "Фотоны / ЭМ: в основном отражаются поверхностью скалы",
    footerHit: "Зеленая вспышка: событие регистрации в нужном канале",
    detectorTitle: "Параметры детектора",
    medium: "Среда",
    water: "водный черенковский",
    density: "Плотность",
    photonChannel: "Фотонный канал",
    laserSensor: "лазерный сенсор",
    nucleonColumn: "Нуклонная колонка",
    crossSection: "Сечение",
    rockLoss: "Потери в скале",
    messagesTitle: "Нейтринные сообщения",
    txBits: "TX биты",
    rxBits: "RX биты",
    waiting: "ожидание",
    noMessages: "Расшифрованных сообщений пока нет",
    bitSuffix: "бит",
    capSource: "ИСТОЧНИК НЕЙТРИНО",
    capLaser: "ФОТОННЫЙ ЛАЗЕР",
    capRock: "ТОЛСТАЯ СКАЛА С ПОЛОСТЬЮ",
    capDetector: "НЕЙТРИННЫЙ ДЕТЕКТОР",
    capPhotonDetector: "ФОТОННЫЙ ДЕТЕКТОР",
    visual: "визуально",
  },
  he: {
    dir: "rtl",
    title: "מעבדת חדירת נייטרינו בסלע",
    header: "בצד שמאל יש שני פולטים: אלומת נייטרינו ולייזר פוטונים. בצד ימין שני גלאים מודדים מה עובר דרך הסלע הקמור והעבה עם החלל הפנימי.",
    languageLabel: "שפה",
    scienceTitle: "מה קורה בסימולציה",
    scienceP1: "משמאל פועלות שתי מערכות נפרדות: הערוץ הכחול פולט נייטרינו והערוץ הצהוב פולט פוטוני לייזר. הסלע העבה מחזיר פוטונים, בעוד נייטרינו עוברים דרך הסלע והחלל הסגור כמעט ללא איבוד.",
    scienceP2: "בסיס מדעי: ניסוי NuMI/MINERvA ב-Fermilab העביר הודעה באמצעות פולסי נייטרינו דרך 1.035 קמ, כולל 240 מטר אדמה.",
    paperPrefix: "מאמר:",
    paperTitle: "Stancil et al., Demonstration of Communication using Neutrinos",
    paperMeta: "Fermilab-Pub-12-073-E; arXiv:1203.2847; DOI: 10.1142/S0217732312500770",
    commTitle: "מסוף הודעות נייטרינו",
    commPlaceholder: "הקלד הודעה למודולציית נייטרינו",
    transmit: "שדר",
    clearLog: "נקה יומן",
    commReady: "מוכן למודולציית קיטוב בחלל",
    commActive: (sent, total, rx) => `מודולטור ${sent}/${total} ביטים | גלאי ${rx}/${total} ביטים`,
    commHelp: "המקור נשאר קבוע. הכדור הקטן בתוך חלל הסלע משנה את קיטוב אלומת הנייטרינו: 0 = מעבר כחול, 1 = סטייה/סיבוב מגנטה. הגלאי משחזר בתי UTF-8.",
    pause: "השהה",
    resume: "המשך",
    reset: "אפס",
    burst: "פרץ",
    neutrinoRate: "קצב נייטרינו",
    photonRate: "קצב פוטונים / EM",
    energy: "אנרגיית נייטרינו",
    detectorRadius: "רדיוס הגלאי",
    detectorDepth: "עובי הגלאי",
    rockThickness: "עובי הסלע",
    rockOpacity: "שקיפות הסלע",
    reflectivity: "החזרת פוטונים",
    metricsNu: "נייטרינו נפלטו",
    metricsThrough: "עברו בסלע",
    metricsDetected: "זוהו",
    metricsPhoton: "פוטונים נפלטו",
    metricsReflected: "פוטונים הוחזרו",
    metricsPhotonDetected: "פוטונים בגלאי",
    metricsInteraction: "הסתברות",
    footerNu: "נייטרינו: עוברים דרך הסלע והחלל כמעט ללא איבוד",
    footerPhoton: "פוטונים / EM: מוחזרים בעיקר מפני הסלע",
    footerHit: "הבזק ירוק: אירוע זיהוי בערוץ המתאים",
    detectorTitle: "פרמטרי הגלאי",
    medium: "תווך",
    water: "צ'רנקוב מים",
    density: "צפיפות",
    photonChannel: "ערוץ פוטונים",
    laserSensor: "חיישן לייזר",
    nucleonColumn: "עמודת נוקלאונים",
    crossSection: "חתך פעולה",
    rockLoss: "איבוד בסלע",
    messagesTitle: "הודעות נייטרינו",
    txBits: "ביטי TX",
    rxBits: "ביטי RX",
    waiting: "ממתין",
    noMessages: "עדיין אין הודעות מפוענחות",
    bitSuffix: "ביטים",
    capSource: "מקור נייטרינו",
    capLaser: "לייזר פוטונים",
    capRock: "סלע עבה עם חלל",
    capDetector: "גלאי נייטרינו",
    capPhotonDetector: "גלאי פוטונים",
    visual: "חזותי",
  },
};

function t(key) {
  return translations[currentLanguage]?.[key] ?? translations.en[key] ?? key;
}

const lensTranslations = {
  en: {
    title: "Neutrino lens: hypothetical cavity modulator",
    p1: "Inside the sealed rock cavity the sphere is treated as a neutrino lens: a hypothetical exotic material that casts a controllable shadow in the neutrino stream and changes the beam state used for bit encoding.",
    p2: "Scientific basis: neutrinos do interact weakly with matter and their quantum state can change through known effects such as matter-driven oscillation. The engineered polarization material shown here does not exist today; it is a speculative but physics-motivated component, not a proven device.",
    useTitle: "Why this matters",
    useP1: "The point of the lens is underground communication: from a depth where ordinary photon, radio, or laser signals cannot escape through rock, the neutrino beam can still carry a modulated message. In this conceptual model the limiting factor is detector sensitivity and alignment, not whether the message source is buried under meters or kilometers of rock.",
    useP2: "In this project the payload can be a face-recognition result: a detected face, ID, or name is encoded into bits by the underground neutrino lens and decoded after passing through the rock. In the satellite demonstration, a neutrino source satellite, a neutrino detector satellite, and an underground lens form a relay; when the satellites pass over the target point, a message is sent from below ground through the neutrino channel.",
    commHelp: "The source stays constant. The neutrino lens inside the rock cavity modulates the passing beam: 0 = cyan pass, 1 = magenta deflected polarization twist. The detector reconstructs UTF-8 bytes from those state changes.",
  },
  ru: {
    title: "Нейтринная линза: гипотетический модулятор в полости",
    p1: "Сфера внутри закрытой полости скалы здесь называется нейтринной линзой: это гипотетический экзотический материал, который создает управляемую тень в нейтринном потоке и меняет состояние пучка для кодирования битов.",
    p2: "Научная основа: нейтрино действительно слабо взаимодействуют с веществом, а их квантовое состояние может меняться в известных эффектах, например в осцилляциях в среде. Показанный материал для управляемой поляризации сегодня не существует; это спекулятивный, но физически мотивированный элемент, а не доказанное устройство.",
    useTitle: "Зачем это нужно",
    useP1: "Смысл линзы - подземная связь: из глубины породы, откуда обычный фотонный, радио- или лазерный сигнал не выходит через скалу, нейтринный пучок все равно может нести модулированное сообщение. В этой концептуальной модели ограничение задают чувствительность и наведение детектора, а не то, находится источник сообщения под метрами или километрами породы.",
    useP2: "В рамках этого проекта полезная нагрузка может быть результатом распознавания лиц: найденное лицо, ID или имя кодируется в биты подземной нейтринной линзой и расшифровывается после прохождения через скалу. В спутниковой демонстрации спутник-источник нейтрино, спутник-детектор нейтрино и подземная линза образуют канал: когда спутники проходят над нужной точкой, сообщение уходит из-под земли через нейтринный канал.",
    commHelp: "Источник остается постоянным. Нейтринная линза внутри полости скалы модулирует проходящий пучок: 0 = голубое прохождение, 1 = пурпурное отклонение/закрутка поляризации. Детектор восстанавливает UTF-8 байты по этим изменениям состояния.",
  },
  he: {
    title: "עדשת נייטרינו: מודולטור היפותטי בחלל",
    p1: "הכדור בתוך חלל הסלע הסגור נקרא כאן עדשת נייטרינו: חומר אקזוטי היפותטי שיוצר צל נשלט בזרם הנייטרינו ומשנה את מצב האלומה לצורך קידוד ביטים.",
    p2: "בסיס מדעי: נייטרינו אכן מקיימים אינטראקציה חלשה עם חומר, ומצבם הקוונטי יכול להשתנות באפקטים מוכרים כמו אוסצילציות בחומר. חומר הקיטוב הנשלט שמוצג כאן אינו קיים כיום; זה רכיב ספקולטיבי אך בעל מוטיבציה פיזיקלית, לא התקן מוכח.",
    useTitle: "למה זה חשוב",
    useP1: "המטרה של העדשה היא תקשורת תת-קרקעית: מעומק שבו אות פוטוני, רדיו או לייזר רגיל לא יכול לצאת דרך סלע, אלומת נייטרינו עדיין יכולה לשאת הודעה ממודולצת. במודל הקונספטואלי הזה המגבלה היא רגישות ויישור הגלאי, לא אם מקור ההודעה נמצא מתחת למטרים או לקילומטרים של סלע.",
    useP2: "בפרויקט הזה המטען יכול להיות תוצאת זיהוי פנים: פנים שזוהו, מזהה או שם מקודדים לביטים על ידי עדשת הנייטרינו התת-קרקעית ומפוענחים אחרי מעבר דרך הסלע. בהדגמת הלוויינים, לוויין מקור נייטרינו, לוויין גלאי נייטרינו ועדשה תת-קרקעית יוצרים ממסר; כאשר הלוויינים חולפים מעל נקודת היעד, הודעה נשלחת מתחת לקרקע דרך ערוץ הנייטרינו.",
    commHelp: "המקור נשאר קבוע. עדשת הנייטרינו בתוך חלל הסלע מווסתת את האלומה העוברת: 0 = מעבר כחול, 1 = סטייה/סיבוב קיטוב מגנטה. הגלאי משחזר בתי UTF-8 משינויי המצב האלה.",
  },
};

function lensText(key) {
  return lensTranslations[currentLanguage]?.[key] ?? lensTranslations.en[key] ?? key;
}

function makeFloor() {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(760, 320), materials.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -58;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(760, 38, 0x6bb8d8, 0x25465a);
  grid.position.y = -57.8;
  grid.material.transparent = true;
  grid.material.opacity = 0.25;
  scene.add(grid);
}

function makeSource() {
  sourceGroup.clear();

  const buildEmitter = (laneZ, bodyMaterial, glowMaterial, coilColor, radius, labelBarWidth) => {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 68, 40), bodyMaterial);
    body.rotation.z = Math.PI / 2;
    body.position.set(positions.sourceX, 0, laneZ);
    body.castShadow = true;
    sourceGroup.add(body);

    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius * 0.86, 24, 40), glowMaterial);
    muzzle.rotation.z = Math.PI / 2;
    muzzle.position.set(positions.sourceX + 42, 0, laneZ);
    sourceGroup.add(muzzle);

    const coilMat = new THREE.MeshStandardMaterial({
      color: coilColor,
      roughness: 0.18,
      metalness: 0.5,
      emissive: coilColor,
      emissiveIntensity: 0.18,
    });
    for (let i = 0; i < 7; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius + 3, 1.2, 12, 64), coilMat);
      ring.position.set(positions.sourceX - 30 + i * 10, 0, laneZ);
      ring.rotation.y = Math.PI / 2;
      sourceGroup.add(ring);
    }

    const bar = new THREE.Mesh(new THREE.BoxGeometry(labelBarWidth, 2.5, 4), coilMat);
    bar.position.set(positions.sourceX + 6, radius + 10, laneZ);
    sourceGroup.add(bar);
  };

  buildEmitter(positions.neutrinoLaneZ, materials.source, materials.sourceGlow, 0x54e0ff, 24, 70);
  buildEmitter(positions.photonLaneZ, materials.laser, materials.laserGlow, 0xffd45a, 20, 58);
}

function buildDetector(laneZ, radius, depth, shellMaterial, ringMaterial, sensorColor, count) {
  const group = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 64, 1, true), shellMaterial);
  shell.rotation.z = Math.PI / 2;
  shell.position.set(positions.detectorX, 0, laneZ);
  shell.castShadow = true;
  group.add(shell);

  for (let i = -2; i <= 2; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 1.6, 14, 80), ringMaterial);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(positions.detectorX + (i * depth) / 5, 0, laneZ);
    detectorRings.push(ring);
    group.add(ring);
  }

  const sensorMat = new THREE.MeshStandardMaterial({
    color: sensorColor,
    roughness: 0.24,
    metalness: 0.2,
    emissive: sensorColor,
    emissiveIntensity: 0.25,
  });
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TAU;
    const x = positions.detectorX + rand(-depth * 0.42, depth * 0.42);
    const y = Math.cos(angle) * (radius + 2);
    const z = laneZ + Math.sin(angle) * (radius + 2);
    const sensor = new THREE.Mesh(new THREE.SphereGeometry(2.1, 16, 10), sensorMat);
    sensor.position.set(x, y, z);
    group.add(sensor);
  }

  detectorGroup.add(group);
  return shell;
}

function makeDetector() {
  detectorGroup.clear();
  detectorRings = [];
  const radius = params.detectorRadiusM;
  const depth = params.detectorDepthM;

  detectorMesh = buildDetector(
    positions.neutrinoLaneZ,
    radius,
    depth,
    materials.detector,
    materials.detectorRing,
    0x9ad8ff,
    26,
  );

  buildDetector(
    positions.photonLaneZ,
    Math.max(18, radius * 0.74),
    Math.max(18, depth * 0.72),
    materials.photonDetector,
    materials.photonDetectorRing,
    0xffd45a,
    18,
  );
}

function makeSealedRockGeometry(thickness, radiusY, radiusZ) {
  const geometry = new THREE.IcosahedronGeometry(1, 4);
  const pos = geometry.attributes.position;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    vertex.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
    const ridge =
      1
      + 0.13 * Math.sin(vertex.x * 8.1 + vertex.y * 3.4)
      + 0.09 * Math.cos(vertex.z * 9.7 - vertex.x * 2.8)
      + 0.06 * Math.sin((vertex.x + vertex.y - vertex.z) * 15.0);
    const shelf = vertex.y < -0.56 ? 0.72 + (vertex.y + 1.0) * 0.18 : 1;
    const x = vertex.x * (thickness * 0.52) * ridge;
    const y = vertex.y * radiusY * ridge * shelf - 2;
    const z = vertex.z * radiusZ * (0.92 + 0.08 * Math.sin(vertex.x * 6.0)) * ridge;
    pos.setXYZ(i, x, y, z);
  }

  geometry.computeVertexNormals();
  return geometry;
}

function addRockCracks(thickness, radiusY, radiusZ) {
  for (let i = 0; i < 34; i++) {
    const points = [];
    const baseX = rand(-thickness * 0.42, thickness * 0.42);
    const angle = rand(-0.35, Math.PI + 0.35);
    const side = Math.random() < 0.58 ? 1 : -1;
    const length = rand(10, 28);
    for (let j = 0; j < 4; j++) {
      const u = (j / 3 - 0.5) * length;
      const x = baseX + u * rand(-0.55, 0.55);
      const y = Math.cos(angle + u * 0.012) * radiusY * rand(0.74, 0.95);
      const z = side * Math.abs(Math.sin(angle + u * 0.01)) * radiusZ * rand(0.78, 0.98);
      points.push(v(x, y - 2, z));
    }
    const crack = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), materials.rockCrack);
    rockGroup.add(crack);
  }
}

function makeCavityOutline(scaleX, scaleY, scaleZ, center) {
  const makeLoop = (axis) => {
    const points = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * TAU;
      if (axis === "xy") points.push(v(Math.cos(a) * scaleX, Math.sin(a) * scaleY, 0));
      if (axis === "xz") points.push(v(Math.cos(a) * scaleX, 0, Math.sin(a) * scaleZ));
      if (axis === "yz") points.push(v(0, Math.cos(a) * scaleY, Math.sin(a) * scaleZ));
    }
    const loop = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), materials.cavityEdge);
    loop.position.copy(center);
    rockGroup.add(loop);
  };

  makeLoop("xy");
  makeLoop("xz");
  makeLoop("yz");
}

function makeRock() {
  rockGroup.clear();
  modulatorSphere = null;
  modulatorHalo = null;
  modulatorRings = [];
  const thickness = params.rockThicknessM;
  const radiusY = 118;
  const radiusZ = 178;
  const geometry = makeSealedRockGeometry(thickness, radiusY, radiusZ);
  rockMesh = new THREE.Mesh(geometry, materials.rock);
  rockMesh.position.set(positions.rockX, 0, 0);
  rockMesh.castShadow = true;
  rockMesh.receiveShadow = true;
  rockGroup.add(rockMesh);

  const edges = new THREE.EdgesGeometry(geometry, 17);
  rockWire = new THREE.LineSegments(edges, materials.rockEdge);
  rockWire.position.copy(rockMesh.position);
  rockGroup.add(rockWire);

  addRockCracks(thickness, radiusY, radiusZ);

  const cavityCenter = v(positions.rockX, 0, positions.neutrinoLaneZ);
  const cavityScaleX = thickness * 0.28;
  const cavityScaleY = 38;
  const cavityScaleZ = 44;
  const cavity = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), materials.cavity);
  cavity.scale.set(cavityScaleX, cavityScaleY, cavityScaleZ);
  cavity.position.copy(cavityCenter);
  cavity.renderOrder = 8;
  rockGroup.add(cavity);
  makeCavityOutline(cavityScaleX, cavityScaleY, cavityScaleZ, cavityCenter);

  const voidAxisMat = new THREE.LineBasicMaterial({ color: 0x52d7ff, transparent: true, opacity: 0.82, depthTest: false });
  const voidAxis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      v(positions.rockX - cavityScaleX, 0, positions.neutrinoLaneZ),
      v(positions.rockX + cavityScaleX, 0, positions.neutrinoLaneZ),
    ]),
    voidAxisMat,
  );
  voidAxis.renderOrder = 9;
  rockGroup.add(voidAxis);

  modulatorSphere = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 20), materials.modulator.clone());
  modulatorSphere.position.copy(cavityCenter);
  modulatorSphere.renderOrder = 12;
  rockGroup.add(modulatorSphere);

  modulatorHalo = new THREE.Mesh(new THREE.SphereGeometry(15, 32, 16), materials.modulatorHalo.clone());
  modulatorHalo.position.copy(cavityCenter);
  modulatorHalo.renderOrder = 11;
  rockGroup.add(modulatorHalo);

  const ringMat = materials.cavityEdge.clone();
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(17 + i * 4, 0.75, 10, 72), ringMat.clone());
    ring.position.copy(cavityCenter);
    ring.rotation.x = i === 0 ? Math.PI / 2 : Math.PI / 2.5;
    ring.rotation.y = i === 2 ? Math.PI / 2 : 0;
    ring.renderOrder = 13;
    modulatorRings.push(ring);
    rockGroup.add(ring);
  }
}

function makeGuideLines() {
  const guideGroup = new THREE.Group();
  world.add(guideGroup);
  const axisMat = new THREE.LineBasicMaterial({ color: 0x88e7ff, transparent: true, opacity: 0.42 });
  const neutrinoLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([v(-260, 0, positions.neutrinoLaneZ), v(310, 0, positions.neutrinoLaneZ)]),
    axisMat,
  );
  guideGroup.add(neutrinoLine);

  const photonLineMat = new THREE.LineBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.18 });
  for (let i = 0; i < 5; i++) {
    const y = -52 + i * 26;
    const guide = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        v(-232, y, positions.photonLaneZ - 18),
        v(-20, y * 0.3, positions.photonLaneZ - 5),
      ]),
      photonLineMat,
    );
    guideGroup.add(guide);
  }
}

function interactionProbability() {
  const sigmaCm2 = 0.7e-38 * params.energyGeV;
  const densityGcm3 = 1.0;
  const detectorDepthCm = params.detectorDepthM * 100;
  const nucleonsPerGram = 6.022e23;
  const column = densityGcm3 * detectorDepthCm * nucleonsPerGram;
  const p = 1 - Math.exp(-sigmaCm2 * column);
  return { p, sigmaCm2, column };
}

function detectorEffectiveProbability() {
  const { p } = interactionProbability();
  return clamp(p * 3.5e10, 0.0002, 0.12);
}

function randomBeamOffset(radius = 26) {
  const r = Math.sqrt(Math.random()) * radius;
  const a = Math.random() * TAU;
  return { y: Math.cos(a) * r, z: Math.sin(a) * r };
}

function makeTrail(points, material) {
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
}

function spawnNeutrino(multiplier = 1) {
  for (let i = 0; i < multiplier; i++) {
    const offset = randomBeamOffset(params.detectorRadiusM * 0.56);
    const laneZ = positions.neutrinoLaneZ;
    const start = v(positions.sourceX + 48, offset.y, laneZ + offset.z);
    const end = v(positions.detectorX + params.detectorDepthM * 0.55 + 44, offset.y * 0.5, laneZ + offset.z * 0.5);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(2.1, 12, 8), materials.neutrino);
    mesh.position.copy(start);
    const trail = makeTrail([start, start.clone()], materials.neutrinoTrail.clone());
    particleGroup.add(mesh, trail);
    particles.push({
      type: "neutrino",
      mesh,
      trail,
      start,
      end,
      age: 0,
      life: rand(2.6, 3.6),
      throughCounted: false,
      detectorChecked: false,
      detected: false,
      targetOffset: offset,
    });
    stats.nuEmitted += 1;
  }
}

function makePhotonWaveMesh(points) {
  const line = makeTrail(points, materials.photonTrail.clone());
  return line;
}

function spawnPhoton(multiplier = 1) {
  for (let i = 0; i < multiplier; i++) {
    const offset = randomBeamOffset(32);
    const laneZ = positions.photonLaneZ;
    const start = v(positions.sourceX + 48, offset.y, laneZ + offset.z * 0.6);
    const hitX = positions.rockX - params.rockThicknessM * 0.5 - 2;
    const hit = v(hitX, offset.y * 0.72, laneZ + offset.z * 0.42);
    const reflect = Math.random() < params.reflectivity;
    const end = reflect
      ? v(positions.sourceX - 64, -offset.y * rand(0.35, 1.05), laneZ - offset.z * rand(0.35, 0.95))
      : v(positions.detectorX + params.detectorDepthM * 0.38 + 34, offset.y * 0.2, laneZ + offset.z * 0.18);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(2.6, 12, 8), materials.photon);
    mesh.position.copy(start);
    const wave = makePhotonWaveMesh([start, start.clone()]);
    particleGroup.add(mesh, wave);
    particles.push({
      type: "photon",
      mesh,
      trail: wave,
      start,
      hit,
      end,
      reflect,
      age: 0,
      life: reflect ? rand(1.6, 2.2) : rand(1.9, 2.5),
      reflectedCounted: false,
      detectedCounted: false,
    });
    stats.photonEmitted += 1;
  }
}

function spawnHit(position, strong = false) {
  const hit = new THREE.Mesh(new THREE.SphereGeometry(strong ? 7 : 5, 24, 16), materials.hit.clone());
  hit.position.copy(position);
  particleGroup.add(hit);
  particles.push({ type: "hit", mesh: hit, age: 0, life: strong ? 0.65 : 0.42 });
}

function spawnPolarizationPacket(bit) {
  const start = v(positions.rockX, 0, positions.neutrinoLaneZ);
  const end = v(positions.detectorX + params.detectorDepthM * 0.35, bit === "1" ? 8 : -8, positions.neutrinoLaneZ + (bit === "1" ? 8 : -8));
  const packetMaterial = new THREE.MeshBasicMaterial({
    color: bit === "1" ? 0xff64d8 : 0x52d7ff,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
  });
  const trailMaterial = bit === "1" ? materials.polarization1.clone() : materials.polarization0.clone();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(bit === "1" ? 4.8 : 3.6, 18, 12), packetMaterial);
  mesh.position.copy(start);
  mesh.renderOrder = 15;
  const trail = makeTrail([start, start.clone()], trailMaterial);
  trail.renderOrder = 14;
  particleGroup.add(mesh, trail);
  particles.push({
    type: "polarized",
    bit,
    mesh,
    trail,
    start,
    end,
    age: 0,
    life: 1.05,
  });
}

function spawnBlocked(position) {
  const flash = new THREE.Mesh(new THREE.SphereGeometry(4.2, 18, 12), materials.blocked.clone());
  flash.position.copy(position);
  particleGroup.add(flash);
  particles.push({ type: "blocked", mesh: flash, age: 0, life: 0.38 });
}

function sampleQuadratic(a, b, c, t) {
  const ab = a.clone().lerp(b, t);
  const bc = b.clone().lerp(c, t);
  return ab.lerp(bc, t);
}

function updateNeutrino(particle, t) {
  const pos = particle.start.clone().lerp(particle.end, t);
  particle.mesh.position.copy(pos);
  particle.mesh.material.opacity = 1;
  const points = [particle.start, pos];
  particle.trail.geometry.dispose();
  particle.trail.geometry = new THREE.BufferGeometry().setFromPoints(points);

  const rockExit = positions.rockX + params.rockThicknessM * 0.5;
  if (!particle.throughCounted && pos.x > rockExit) {
    particle.throughCounted = true;
    stats.nuThrough += 1;
  }

  const detectorStart = positions.detectorX - params.detectorDepthM * 0.5;
  const detectorEnd = positions.detectorX + params.detectorDepthM * 0.5;
  if (!particle.detectorChecked && pos.x > detectorStart && pos.x < detectorEnd) {
    particle.detectorChecked = true;
    const radius = Math.hypot(pos.y, pos.z - positions.neutrinoLaneZ);
    if (radius <= params.detectorRadiusM && Math.random() < detectorEffectiveProbability()) {
      particle.detected = true;
      stats.nuDetected += 1;
      spawnHit(pos, true);
    }
  }
}

function updatePhoton(particle, t) {
  let pos;
  let points;
  if (particle.reflect) {
    const control = particle.hit.clone().add(v(-30, rand(-18, 18), rand(-18, 18)));
    pos = t < 0.5
      ? particle.start.clone().lerp(particle.hit, t / 0.5)
      : sampleQuadratic(particle.hit, control, particle.end, (t - 0.5) / 0.5);
    points = [];
    for (let i = 0; i <= 32; i++) {
      const u = i / 32;
      const base = u < 0.5
        ? particle.start.clone().lerp(particle.hit, u / 0.5)
        : sampleQuadratic(particle.hit, control, particle.end, (u - 0.5) / 0.5);
      base.y += Math.sin(u * TAU * 5 + particle.age * 14) * 3.0;
      points.push(base);
    }
    if (!particle.reflectedCounted && t > 0.5) {
      particle.reflectedCounted = true;
      stats.photonReflected += 1;
      spawnBlocked(particle.hit);
    }
  } else {
    pos = particle.start.clone().lerp(particle.end, t);
    points = [];
    for (let i = 0; i <= 22; i++) {
      const u = i / 22;
      const base = particle.start.clone().lerp(pos, u);
      base.z += Math.sin(u * TAU * 4 + particle.age * 12) * 2.6;
      points.push(base);
    }
    if (!particle.detectedCounted && t > 0.82) {
      particle.detectedCounted = true;
      stats.photonDetected += 1;
      spawnHit(pos, false);
    }
  }
  particle.mesh.position.copy(pos);
  particle.trail.geometry.dispose();
  particle.trail.geometry = new THREE.BufferGeometry().setFromPoints(points);
}

function updatePolarizedPacket(particle, t) {
  const pos = particle.start.clone().lerp(particle.end, t);
  const twist = particle.bit === "1" ? Math.sin(t * TAU * 2.0 + particle.age * 8.0) * 10 : Math.sin(t * TAU * 1.2) * 2.8;
  pos.y += twist;
  pos.z += particle.bit === "1" ? Math.cos(t * TAU * 2.0 + particle.age * 8.0) * 8 : 0;
  particle.mesh.position.copy(pos);

  const points = [];
  for (let i = 0; i <= 28; i++) {
    const u = i / 28;
    const p = particle.start.clone().lerp(pos, u);
    if (particle.bit === "1") {
      p.y += Math.sin(u * TAU * 3 + particle.age * 7) * 5.5;
      p.z += Math.cos(u * TAU * 3 + particle.age * 7) * 5.5;
    } else {
      p.y += Math.sin(u * TAU * 2 + particle.age * 5) * 1.7;
    }
    points.push(p);
  }
  particle.trail.geometry.dispose();
  particle.trail.geometry = new THREE.BufferGeometry().setFromPoints(points);
}

function updateParticle(particle, dt) {
  particle.age += dt;
  const t = clamp(particle.age / particle.life, 0, 1);
  if (particle.type === "neutrino") updateNeutrino(particle, t);
  if (particle.type === "photon") updatePhoton(particle, t);
  if (particle.type === "polarized") updatePolarizedPacket(particle, t);
  if (particle.type === "hit" || particle.type === "blocked") {
    const fade = 1 - t;
    particle.mesh.scale.setScalar(1 + t * 2.4);
    particle.mesh.material.opacity = fade;
  }
  return t < 1;
}

function cleanupParticle(particle) {
  particleGroup.remove(particle.mesh);
  if (particle.trail) particleGroup.remove(particle.trail);
  particle.mesh.geometry?.dispose?.();
  if (particle.trail) particle.trail.geometry?.dispose?.();
}

function updateSpawning(dt) {
  spawnNuCarry += params.neutrinoRate * dt;
  spawnPhotonCarry += params.photonRate * dt;
  const nuCount = Math.floor(spawnNuCarry);
  const photonCount = Math.floor(spawnPhotonCarry);
  spawnNuCarry -= nuCount;
  spawnPhotonCarry -= photonCount;
  if (nuCount > 0) spawnNeutrino(Math.min(nuCount, 18));
  if (photonCount > 0) spawnPhoton(Math.min(photonCount, 14));
}

function updateUi() {
  document.getElementById("nuEmitted").textContent = stats.nuEmitted.toLocaleString();
  document.getElementById("nuThrough").textContent = stats.nuThrough.toLocaleString();
  document.getElementById("nuDetected").textContent = stats.nuDetected.toLocaleString();
  document.getElementById("photonEmitted").textContent = stats.photonEmitted.toLocaleString();
  document.getElementById("photonReflected").textContent = stats.photonReflected.toLocaleString();
  document.getElementById("photonDetected").textContent = stats.photonDetected.toLocaleString();

  const physics = interactionProbability();
  document.getElementById("interactionP").textContent = `${(detectorEffectiveProbability() * 100).toFixed(3)}% visual`;
  document.getElementById("crossSection").textContent = `${physics.sigmaCm2.toExponential(2)} cm²`;
  document.getElementById("columnDensity").textContent = `${physics.column.toExponential(2)} nucleons/cm²`;
}

function rebuildGeometry() {
  materials.rock.opacity = params.rockOpacity;
  makeRock();
  makeDetector();
  updateUi();
}

function bindSlider(id, valueId, formatter, apply) {
  const input = document.getElementById(id);
  const value = document.getElementById(valueId);
  const update = () => {
    const n = Number(input.value);
    value.textContent = formatter(n);
    apply(n);
    updateUi();
  };
  input.addEventListener("input", update);
  update();
}

function bytesToBits(bytes) {
  return Array.from(bytes, (byte) => byte.toString(2).padStart(8, "0")).join("");
}

function formatBits(bits, groupSize = 8) {
  if (!bits) return "waiting";
  return bits.match(new RegExp(`.{1,${groupSize}}`, "g")).join(" ");
}

function appendReceivedMessage(message, bitCount) {
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  comms.log.unshift({ time, message, bitCount });
  comms.log = comms.log.slice(0, 8);
}

function setText(selector, text) {
  const element = document.querySelector(selector);
  if (element) element.textContent = text;
}

function applyLanguage(lang = currentLanguage) {
  currentLanguage = translations[lang] ? lang : "en";
  localStorage.setItem(LANG_KEY, currentLanguage);
  document.documentElement.lang = currentLanguage;
  document.documentElement.dir = t("dir");
  document.body.classList.toggle("rtl", t("dir") === "rtl");
  document.title = t("title");

  setText(".panel header h1", t("title"));
  setText(".panel header p", t("header"));
  setText(".language-control span", t("languageLabel"));
  const select = document.getElementById("languageSelect");
  if (select) select.value = currentLanguage;

  setText(".science-note h2", t("scienceTitle"));
  setText("[data-i18n='scienceP1']", t("scienceP1"));
  const scienceP2 = document.querySelector("[data-i18n='scienceP2']");
  if (scienceP2) {
    scienceP2.innerHTML = `${t("scienceP2")} ${t("paperPrefix")} <a href="https://lss.fnal.gov/archive/2012/pub/fermilab-pub-12-073-e.pdf" target="_blank" rel="noreferrer">${t("paperTitle")}</a><span class="paper-meta">${t("paperMeta")}</span>`;
  }
  setText("[data-lens='title']", lensText("title"));
  setText("[data-lens='p1']", lensText("p1"));
  setText("[data-lens='p2']", lensText("p2"));
  setText("[data-lens='useTitle']", lensText("useTitle"));
  setText("[data-lens='useP1']", lensText("useP1"));
  setText("[data-lens='useP2']", lensText("useP2"));

  setText(".comm-panel h2", t("commTitle"));
  const commInput = document.getElementById("commInput");
  if (commInput) commInput.placeholder = t("commPlaceholder");
  setText("#sendCommBtn", t("transmit"));
  setText("#clearCommBtn", t("clearLog"));
  const commHelp = document.querySelector(".comm-panel p");
  if (commHelp) commHelp.textContent = lensText("commHelp");

  setText("#pauseBtn", params.paused ? t("resume") : t("pause"));
  setText("#resetBtn", t("reset"));
  setText("#burstBtn", t("burst"));
  setText("[data-label='neutrinoRate']", t("neutrinoRate"));
  setText("[data-label='photonRate']", t("photonRate"));
  setText("[data-label='energy']", t("energy"));
  setText("[data-label='detectorRadius']", t("detectorRadius"));
  setText("[data-label='detectorDepth']", t("detectorDepth"));
  setText("[data-label='rockThickness']", t("rockThickness"));
  setText("[data-label='rockOpacity']", t("rockOpacity"));
  setText("[data-label='reflectivity']", t("reflectivity"));

  setText("[data-metric='nuEmitted']", t("metricsNu"));
  setText("[data-metric='nuThrough']", t("metricsThrough"));
  setText("[data-metric='nuDetected']", t("metricsDetected"));
  setText("[data-metric='photonEmitted']", t("metricsPhoton"));
  setText("[data-metric='photonReflected']", t("metricsReflected"));
  setText("[data-metric='photonDetected']", t("metricsPhotonDetected"));
  setText("[data-metric='interactionP']", t("metricsInteraction"));

  const footer = document.querySelector(".panel footer");
  if (footer) {
    footer.innerHTML = `
      <div><i class="dot neutrino"></i>${t("footerNu")}</div>
      <div><i class="dot photon"></i>${t("footerPhoton")}</div>
      <div><i class="dot hit"></i>${t("footerHit")}</div>
    `;
  }

  setText(".detector-card h2", t("detectorTitle"));
  setText("[data-detector='medium']", t("medium"));
  setText("[data-detector='water']", t("water"));
  setText("[data-detector='density']", t("density"));
  setText("[data-detector='photonChannel']", t("photonChannel"));
  setText("[data-detector='laserSensor']", t("laserSensor"));
  setText("[data-detector='nucleonColumn']", t("nucleonColumn"));
  setText("[data-detector='crossSection']", t("crossSection"));
  setText("[data-detector='rockLoss']", t("rockLoss"));

  setText(".message-card h2", t("messagesTitle"));
  setText("[data-bits='tx']", t("txBits"));
  setText("[data-bits='rx']", t("rxBits"));
  setText(".caption.source", t("capSource"));
  setText(".caption.laser", t("capLaser"));
  setText(".caption.rock", t("capRock"));
  setText(".caption.detector", t("capDetector"));
  setText(".caption.photon-detector", t("capPhotonDetector"));

  updateCommsUi();
  updateUi();
}

function updateCommsUi() {
  const status = document.getElementById("commStatus");
  const txBits = document.getElementById("txBits");
  const rxBits = document.getElementById("rxBits");
  const inbox = document.getElementById("messageInbox");
  const progress = document.getElementById("commProgress");

  if (status) {
    status.textContent = comms.active
      ? t("commActive")(comms.sentIndex, comms.txBits.length, comms.rxBits.length)
      : t("commReady");
  }
  if (progress) {
    const total = Math.max(1, comms.txBits.length);
    progress.style.width = `${clamp((comms.rxBits.length / total) * 100, 0, 100)}%`;
  }
  if (txBits) txBits.textContent = comms.sentBits ? formatBits(comms.sentBits.slice(-96), 8) : t("waiting");
  if (rxBits) rxBits.textContent = comms.rxBits ? formatBits(comms.rxBits.slice(-96), 8) : t("waiting");
  if (inbox) {
    inbox.innerHTML = comms.log.length
      ? comms.log.map((entry) => `
        <div class="message-entry">
          <span>${entry.time} | ${entry.bitCount} ${t("bitSuffix")}</span>
          <b>${entry.message.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]))}</b>
        </div>
      `).join("")
      : `<div class="message-empty">${t("noMessages")}</div>`;
  }
}

function finishTransmission() {
  comms.active = false;
  comms.currentBit = null;
  const decoded = new TextDecoder().decode(new Uint8Array(comms.bytes));
  appendReceivedMessage(decoded, comms.txBits.length);
  updateCommsUi();
}

function receiveCommunicationBit(bit) {
  comms.rxBits += bit;
  spawnHit(v(positions.detectorX, 0, positions.neutrinoLaneZ), true);
  updateCommsUi();
  if (comms.active && comms.rxBits.length >= comms.txBits.length && comms.pendingBits.length === 0) {
    finishTransmission();
  }
}

function updateCommunication(dt) {
  if (!comms.active) return;

  comms.pendingBits.forEach((item) => { item.delay -= dt; });
  const arrived = comms.pendingBits.filter((item) => item.delay <= 0);
  comms.pendingBits = comms.pendingBits.filter((item) => item.delay > 0);
  arrived.forEach((item) => receiveCommunicationBit(item.bit));

  comms.timer = (comms.timer || 0) + dt;
  while (comms.timer >= comms.bitInterval && comms.sentIndex < comms.txBits.length) {
    comms.timer -= comms.bitInterval;
    const bit = comms.txBits[comms.sentIndex];
    comms.sentIndex += 1;
    comms.sentBits += bit;
    comms.currentBit = bit;
    comms.modulatorPulse = 1;
    spawnPolarizationPacket(bit);
    comms.pendingBits.push({ bit, delay: comms.travelDelay });
  }

  if (comms.active && comms.sentIndex >= comms.txBits.length && comms.pendingBits.length === 0 && comms.rxBits.length >= comms.txBits.length) {
    finishTransmission();
  } else {
    updateCommsUi();
  }
}

function updateModulatorVisual(dt, now) {
  if (!modulatorSphere) return;
  comms.modulatorPulse = Math.max(0, comms.modulatorPulse - dt * 1.8);
  const isOne = comms.currentBit === "1";
  const baseColor = isOne ? new THREE.Color(0xff64d8) : new THREE.Color(0x8cf3ff);
  const idleColor = new THREE.Color(0x52d7ff);
  const blend = comms.active ? 0.15 : 0.75;
  const color = baseColor.clone().lerp(idleColor, blend);
  modulatorSphere.material.color.copy(color);
  modulatorSphere.material.opacity = 0.76 + comms.modulatorPulse * 0.22;
  const scale = 1 + comms.modulatorPulse * (isOne ? 0.75 : 0.38) + Math.sin(now * 0.004) * 0.04;
  modulatorSphere.scale.setScalar(scale);

  if (modulatorHalo) {
    modulatorHalo.material.color.copy(color);
    modulatorHalo.material.opacity = 0.14 + comms.modulatorPulse * 0.28;
    modulatorHalo.scale.setScalar(1.0 + comms.modulatorPulse * 1.1);
  }

  modulatorRings.forEach((ring, index) => {
    ring.material.color.copy(color);
    ring.material.opacity = 0.38 + comms.modulatorPulse * 0.42;
    ring.rotation.z += dt * (0.8 + index * 0.4) * (isOne ? 1.8 : 0.8);
    ring.rotation.x += dt * 0.16 * (index + 1);
  });
}

function startTransmission() {
  const input = document.getElementById("commInput");
  const text = (input?.value || "").trim();
  if (!text || comms.active) return;

  const encoded = new TextEncoder().encode(text.slice(0, 96));
  comms.active = true;
  comms.timer = 0;
  comms.message = text.slice(0, 96);
  comms.bytes = Array.from(encoded);
  comms.txBits = bytesToBits(encoded);
  comms.sentBits = "";
  comms.rxBits = "";
  comms.sentIndex = 0;
  comms.pendingBits = [];
  comms.currentBit = null;
  comms.modulatorPulse = 0;
  updateCommsUi();
}

let hiveOutboxInitialized = false;
let lastHiveMessageTimestamp = "";

async function pollHiveFaceRecognition() {
  try {
    const response = await fetch("http://127.0.0.1:8876/api/neutrino-outbox", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    const newest = Array.isArray(payload.messages) ? payload.messages[0] : null;
    if (!newest?.timestamp_iso || !newest?.message) return;

    if (!hiveOutboxInitialized) {
      hiveOutboxInitialized = true;
      lastHiveMessageTimestamp = newest.timestamp_iso;
      return;
    }
    if (newest.timestamp_iso === lastHiveMessageTimestamp) return;
    lastHiveMessageTimestamp = newest.timestamp_iso;

    const input = document.getElementById("commInput");
    if (input) input.value = String(newest.identity || newest.message).slice(0, 96);
    if (!comms.active) startTransmission();
  } catch {
    // Hive is optional for the standalone neutrino simulation.
  }
}

function clearCommunicationLog() {
  comms.log = [];
  comms.sentBits = "";
  comms.rxBits = "";
  comms.currentBit = null;
  comms.modulatorPulse = 0;
  updateCommsUi();
}

function resetStats() {
  for (const particle of particles) cleanupParticle(particle);
  particles = [];
  stats.nuEmitted = 0;
  stats.nuThrough = 0;
  stats.nuDetected = 0;
  stats.photonEmitted = 0;
  stats.photonReflected = 0;
  stats.photonDetected = 0;
  spawnNuCarry = 0;
  spawnPhotonCarry = 0;
  updateUi();
}

function setupUi() {
  const panelHeader = document.querySelector(".panel header");
  if (panelHeader && !document.querySelector(".language-control")) {
    const languageControl = document.createElement("label");
    languageControl.className = "language-control";
    languageControl.innerHTML = `
      <span>Language</span>
      <select id="languageSelect">
        <option value="en">English</option>
        <option value="he">עברית</option>
        <option value="ru">Русский</option>
      </select>
    `;
    panelHeader.appendChild(languageControl);
  }

  const headerText = document.querySelector(".panel header p");
  if (headerText) {
    headerText.textContent = t("header");
  }
  if (panelHeader && !document.querySelector(".science-note")) {
    const note = document.createElement("section");
    note.className = "science-note";
    note.innerHTML = `
      <h2></h2>
      <p data-i18n="scienceP1"></p>
      <p data-i18n="scienceP2"></p>
      <div class="lens-note">
        <h3 data-lens="title"></h3>
        <p data-lens="p1"></p>
        <p data-lens="p2"></p>
        <h3 data-lens="useTitle"></h3>
        <p data-lens="useP1"></p>
        <p data-lens="useP2"></p>
      </div>
    `;
    panelHeader.insertAdjacentElement("afterend", note);
  }
  const scienceNote = document.querySelector(".science-note");
  if (scienceNote && !document.querySelector(".comm-panel")) {
    const commPanel = document.createElement("section");
    commPanel.className = "comm-panel";
    commPanel.innerHTML = `
      <h2></h2>
      <textarea id="commInput" maxlength="96" rows="3"></textarea>
      <div class="comm-actions">
        <button id="sendCommBtn">Transmit</button>
        <button id="clearCommBtn">Clear log</button>
      </div>
      <div id="commStatus" class="comm-status"></div>
      <div class="comm-progress"><i id="commProgress"></i></div>
      <p></p>
    `;
    scienceNote.insertAdjacentElement("afterend", commPanel);
  }
  const commStatus = document.getElementById("commStatus");
  if (commStatus && !comms.active) {
    commStatus.textContent = t("commReady");
  }
  const commHelp = document.querySelector(".comm-panel p");
  if (commHelp) {
    commHelp.textContent = lensText("commHelp");
  }
  if (!document.querySelector(".message-card")) {
    const messageCard = document.createElement("aside");
    messageCard.className = "message-card";
    messageCard.innerHTML = `
      <h2></h2>
      <div class="bit-readout">
        <span data-bits="tx"></span>
        <code id="txBits"></code>
      </div>
      <div class="bit-readout">
        <span data-bits="rx"></span>
        <code id="rxBits"></code>
      </div>
      <div id="messageInbox" class="message-inbox">
        <div class="message-empty"></div>
      </div>
    `;
    document.body.appendChild(messageCard);
  }
  document.querySelector(".detector-card .row:nth-child(2) span")?.setAttribute("data-detector", "medium");
  document.querySelector(".detector-card .row:nth-child(2) b")?.setAttribute("data-detector", "water");
  document.querySelector(".detector-card .row:nth-child(3) span")?.setAttribute("data-detector", "density");
  document.querySelector(".detector-card .row:nth-child(4) span")?.setAttribute("data-detector", "photonChannel");
  document.querySelector(".detector-card .row:nth-child(4) b")?.setAttribute("data-detector", "laserSensor");
  document.querySelector(".detector-card .row:nth-child(5) span")?.setAttribute("data-detector", "nucleonColumn");
  document.querySelector(".detector-card .row:nth-child(6) span")?.setAttribute("data-detector", "crossSection");
  document.querySelector(".detector-card .row:nth-child(7) span")?.setAttribute("data-detector", "rockLoss");

  document.getElementById("pauseBtn").addEventListener("click", () => {
    params.paused = !params.paused;
    document.getElementById("pauseBtn").textContent = params.paused ? t("resume") : t("pause");
  });
  document.getElementById("resetBtn").addEventListener("click", resetStats);
  document.getElementById("burstBtn").addEventListener("click", () => {
    spawnNeutrino(90);
    spawnPhoton(50);
  });
  document.getElementById("sendCommBtn")?.addEventListener("click", startTransmission);
  document.getElementById("clearCommBtn")?.addEventListener("click", clearCommunicationLog);
  document.getElementById("languageSelect")?.addEventListener("change", (event) => {
    applyLanguage(event.target.value);
  });
  document.getElementById("commInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      startTransmission();
    }
  });

  bindSlider("neutrinoRate", "neutrinoRateValue", (n) => `${n} / s`, (n) => { params.neutrinoRate = n; });
  bindSlider("photonRate", "photonRateValue", (n) => `${n} / s`, (n) => { params.photonRate = n; });
  bindSlider("energy", "energyValue", (n) => `${n} GeV`, (n) => { params.energyGeV = n; });
  bindSlider("detectorRadius", "detectorRadiusValue", (n) => `${n} m`, (n) => { params.detectorRadiusM = n; makeDetector(); });
  bindSlider("detectorDepth", "detectorDepthValue", (n) => `${n} m`, (n) => { params.detectorDepthM = n; makeDetector(); });
  bindSlider("rockThickness", "rockThicknessValue", (n) => `${n} m`, (n) => { params.rockThicknessM = n; makeRock(); });
  bindSlider("rockOpacity", "rockOpacityValue", (n) => `${n}%`, (n) => { params.rockOpacity = n / 100; materials.rock.opacity = params.rockOpacity; });
  bindSlider("reflectivity", "reflectivityValue", (n) => `${n}%`, (n) => { params.reflectivity = n / 100; });
  applyLanguage(currentLanguage);
}

function animate(now) {
  const dt = clamp((now - lastTime) / 1000, 0, 0.05);
  lastTime = now;

  if (!params.paused) {
    updateCommunication(dt);
    updateSpawning(dt);
    const alive = [];
    for (const particle of particles) {
      if (updateParticle(particle, dt)) alive.push(particle);
      else cleanupParticle(particle);
    }
    particles = alive;
  }

  const pulse = 0.5 + Math.sin(now * 0.006) * 0.5;
  updateModulatorVisual(dt, now);
  rimLight.intensity = 1.3 + pulse * 1.0;
  detectorLight.intensity = 1.0 + pulse * 0.55;
  detectorRings.forEach((ring, index) => {
    ring.rotation.z += dt * (0.35 + index * 0.04);
  });

  updateUi();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

makeFloor();
makeSource();
makeRock();
makeDetector();
makeGuideLines();
setupUi();
resetStats();
pollHiveFaceRecognition();
setInterval(pollHiveFaceRecognition, 1000);
requestAnimationFrame(animate);
