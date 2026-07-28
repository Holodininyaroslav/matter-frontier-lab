(() => {
  const select = document.getElementById("languageSelect");
  if (!select) return;

  const text = {
    en: {
      matter: "Matter", collider: "Collider", registry: "Model registry", selected: "Selected model",
      structure: "Structure", interaction: "Interaction", field: "Field", communication: "Neutrino communication",
      search: "Search model or phase", all: "All", ordinary: "Ordinary", baryons: "Baryons", leptons: "Leptons",
      nuclei: "Nuclei and atoms", dense: "Dense", qgp: "QGP", mesons: "Mesons", strange: "Strange",
      exotic: "Exotic matter", macro: "Macro objects", hypotheses: "My hypotheses", parameters: "Parameters",
      sources: "Scientific sources", result: "Solver result", object: "Object", scale: "Scale", state: "State",
      ready: "System ready", run: "Run process", specification: "Model specification", mathematical: "Mathematical core",
      description: "Interactive educational model. Its scientific status, assumptions and limitations are shown in this panel.",
      limitation: "This visualization is an educational interactive model; it is not a detector reconstruction or a prediction of a new physical state.",
      confirmed: "Experimentally confirmed", theoretical: "Theoretical model", hypothetical: "Hypothetical extension", catalog: "Catalogue entry",
      parameter: "Model parameter", reset: "Reset parameters", pause: "Pause", resume: "Resume", send: "Send pulse",
      collision: "Collide", annihilate: "Annihilate", confinement: "Confinement", projection: "3D projection", passage: "Passage",
      merger: "Black-hole merger", mergerRun: "Run merger", status: "Status", solver: "local"
    },
    ru: {
      matter: "Материя", collider: "Коллайдер", registry: "Реестр моделей", selected: "Выбранная модель",
      structure: "Структура", interaction: "Взаимодействие", field: "Поле", communication: "Нейтринная связь",
      search: "Найти модель или фазу", all: "Все", ordinary: "Обычная", baryons: "Барионы", leptons: "Лептоны",
      nuclei: "Ядра и атомы", dense: "Плотная", qgp: "КГП", mesons: "Мезоны", strange: "Странная",
      exotic: "Экзотическая материя", macro: "Макрообъекты", hypotheses: "Мои гипотезы", parameters: "Параметры",
      sources: "Научные источники", result: "Результат solver", object: "Объект", scale: "Масштаб", state: "Состояние",
      ready: "Система готова", run: "Запустить процесс", specification: "Описание модели", mathematical: "Математическое ядро",
      description: "Интерактивная учебная модель. Научный статус, допущения и ограничения показаны в этой панели.",
      limitation: "Визуализация носит учебный характер и не является реконструкцией детектора или прогнозом нового физического состояния.",
      confirmed: "Экспериментально подтверждено", theoretical: "Теоретическая модель", hypothetical: "Гипотетическое расширение", catalog: "Запись каталога",
      parameter: "Параметр модели", reset: "Сбросить параметры", pause: "Пауза", resume: "Продолжить", send: "Послать импульс",
      collision: "Столкнуть", annihilate: "Аннигиляция", confinement: "Конфайнмент", projection: "3D-проекция", passage: "Прохождение",
      merger: "Слияние чёрных дыр", mergerRun: "Запустить слияние", status: "Статус", solver: "локальный"
    },
    he: {
      matter: "חומר", collider: "מאיץ", registry: "מאגר מודלים", selected: "המודל שנבחר",
      structure: "מבנה", interaction: "אינטראקציה", field: "שדה", communication: "תקשורת נייטרינו",
      search: "חיפוש מודל או פאזה", all: "הכול", ordinary: "רגיל", baryons: "בריונים", leptons: "לפטונים",
      nuclei: "גרעינים ואטומים", dense: "חומר צפוף", qgp: "פלזמת קווארקים–גלואונים", mesons: "מזונים", strange: "חומר מוזר",
      exotic: "חומר אקזוטי", macro: "עצמים מאקרוסקופיים", hypotheses: "ההשערות שלי", parameters: "פרמטרים",
      sources: "מקורות מדעיים", result: "תוצאת הפותר", object: "עצם", scale: "קנה מידה", state: "מצב",
      ready: "המערכת מוכנה", run: "הפעלת התהליך", specification: "מפרט המודל", mathematical: "ליבה מתמטית",
      description: "מודל לימודי אינטראקטיבי. המעמד המדעי, ההנחות והמגבלות מוצגים בלוח זה.",
      limitation: "ההדמיה היא מודל לימודי ואינטראקטיבי; היא אינה שחזור גלאי ואינה תחזית למצב פיזיקלי חדש.",
      confirmed: "אושר בניסוי", theoretical: "מודל תאורטי", hypothetical: "הרחבה היפותטית", catalog: "רשומת קטלוג",
      parameter: "פרמטר מודל", reset: "איפוס פרמטרים", pause: "השהיה", resume: "המשך", send: "שליחת פולס",
      collision: "התנגשות", annihilate: "איון", confinement: "כליאה", projection: "היטל תלת־ממדי", passage: "מעבר",
      merger: "מיזוג חורים שחורים", mergerRun: "הפעלת מיזוג", status: "מצב", solver: "מקומי"
    }
  };

  const modelNames = {
    en: { proton:"Proton", neutron:"Neutron", hydrogen:"Hydrogen atom", helium4:"Helium-4", hyperon:"Lambda hyperon", neutrinoLens:"Neutrino lens", complexSpinQuasiparticle:"4D complex-spin quasiparticle", tesseract4d:"Tesseract (4D hypercube)", sun:"Sun", jupiter:"Jupiter", blackHole:"Black hole", neutronStar:"Neutron star" },
    ru: { proton:"Протон", neutron:"Нейтрон", hydrogen:"Атом водорода", helium4:"Гелий-4", hyperon:"Λ-гиперон", neutrinoLens:"Нейтринная линза", complexSpinQuasiparticle:"4D квазичастица с комплексным спином", tesseract4d:"Тессеракт (4D-гиперкуб)", sun:"Солнце", jupiter:"Юпитер", blackHole:"Чёрная дыра", neutronStar:"Нейтронная звезда" },
    he: { proton:"פרוטון", neutron:"נייטרון", hydrogen:"אטום מימן", helium4:"הליום‑4", hyperon:"היפרון למדא", neutrinoLens:"עדשת נייטרינו", complexSpinQuasiparticle:"קוואזי־חלקיק 4D בעל ספין מרוכב", tesseract4d:"טסרקט (היפר־קובייה 4D)", sun:"שמש", jupiter:"צדק", blackHole:"חור שחור", neutronStar:"כוכב נייטרונים" }
  };

  const set = (selector, value) => document.querySelectorAll(selector).forEach((node) => { if (value && node.textContent !== value) node.textContent = value; });
  const setAttr = (selector, name, value) => document.querySelectorAll(selector).forEach((node) => node.setAttribute(name, value));
  const locale = () => select.value || "en";

  function applyLocale() {
    const code = locale();
    const t = text[code] || text.en;
    document.documentElement.lang = code;
    document.documentElement.dir = code === "he" ? "rtl" : "ltr";
    document.body.classList.toggle("rtl", code === "he");

    set("[data-i18n='matter']", t.matter); set("[data-i18n='collider']", t.collider);
    set("[data-i18n='registry']", t.registry); set("[data-i18n='selected']", t.selected);
    set("[data-i18n='parameters']", t.parameters); set("[data-i18n='sources']", t.sources);
    set("[data-i18n='result']", t.result); set("[data-i18n='mathematical']", t.mathematical);
    set("[data-i18n='object']", t.object); set("[data-i18n='scale']", t.scale); set("[data-i18n='state']", t.state);
    set("[data-i18n='description']", t.description); set("[data-i18n='limitation']", t.limitation);
    set(".model-title", t.matter); set(".model-count + h2", t.matter); set(".eyebrow", t.registry);
    setAttr("#modelSearch", "placeholder", t.search);
    setAttr("#pauseBtn", "aria-label", t.pause); setAttr("#pauseBtn", "data-tooltip", t.pause);
    setAttr("#resetViewBtn", "aria-label", t.reset); setAttr("#resetViewBtn", "data-tooltip", t.reset);
    set("[data-family='all']", t.all); set("[data-family='ordinary']", t.ordinary); set("[data-family='baryon']", t.baryons);
    set("[data-family='lepton']", t.leptons); set("[data-family='nucleus'], [data-family='nuclear']", t.nuclei); set("[data-family='dense']", t.dense);
    set("[data-family='qgp'], [data-family='quark']", t.qgp); set("[data-family='meson']", t.mesons); set("[data-family='strange']", t.strange);
    set("[data-family='exotic']", t.exotic); set("[data-family='macro']", t.macro); set("[data-family='hypothetical']", t.hypotheses); set("[data-family='collider']", t.collider);
    document.querySelectorAll("#viewModes [data-view]").forEach((button) => {
      const key = { structure:"structure", interaction:"interaction", field:"field", communication:"communication", collision:"collision", annihilation:"annihilate", confinement:"confinement", projection:"projection", passage:"passage", blackHoleMerger:"merger" }[button.dataset.view];
      if (key) button.textContent = t[key];
    });
    set("#runInteractionBtn", t.run); set("#statusText", t.ready);
    document.querySelectorAll(".model-item[data-model]").forEach((item) => {
      const name = modelNames[code]?.[item.dataset.model];
      const heading = item.querySelector("strong");
      if (name && heading) heading.textContent = name;
    });
    document.querySelectorAll(".parameter-card h3, .parameter-section h3").forEach((heading) => {
      if (/parameters|параметры|פרמטרים/i.test(heading.textContent)) heading.textContent = t.parameters;
    });
    if (code === "he") {
      const familyText = {
        ordinary: t.ordinary, baryon: t.baryons, lepton: t.leptons,
        nuclear: t.nuclei, dense: t.dense, quark: t.qgp, meson: t.mesons,
        collider: t.collider, strange: t.strange, exotic: t.exotic,
        macro: t.macro, hypothetical: t.hypotheses
      };
      document.querySelectorAll(".model-family").forEach((node) => {
        const key = node.textContent.trim().toLowerCase();
        if (familyText[key]) node.textContent = familyText[key];
      });
      const sceneFamily = document.querySelector("#sceneFamily");
      if (sceneFamily && /ordinary|обыч/i.test(sceneFamily.textContent)) sceneFamily.textContent = t.ordinary;
      const hebrewParameterNames = {
        alphaS: "\u05d4\u05e6\u05d9\u05de\u05d5\u05d3 \u05d4\u05d7\u05d6\u05e7 \u03b1\u209b",
        stringTension: "\u05de\u05ea\u05d7 \u05d4\u05de\u05d9\u05ea\u05e8 \u03c3",
        probeEnergy: "\u05d0\u05e0\u05e8\u05d2\u05d9\u05d9\u05ea \u05d4\u05e4\u05d5\u05d8\u05d5\u05df"
      };
      document.querySelectorAll("label[for^='param-'] span").forEach((node) => {
        const key = node.parentElement.htmlFor.replace("param-", "");
        if (/[А-Яа-яЁё]/.test(node.textContent)) node.textContent = hebrewParameterNames[key] || t.parameter;
      });
      document.querySelectorAll(".metric span").forEach((node) => {
        if (/[А-Яа-яЁё]/.test(node.textContent)) node.textContent = "\u05de\u05d8\u05e2\u05df \u05e6\u05d1\u05e2";
      });
      const leaves = {
        "Материя":"חומר", "Коллайдер":"מאיץ", "Русский":"רוסית", "Английский":"אנגלית", "Иврит":"עברית",
        "Найти модель":"חיפוש מודל", "Все":"הכול", "Барионы":"בריונים", "Лептоны":"לפטונים",
        "Ядра и атомы":"גרעינים ואטומים", "Мои гипотезы":"ההשערות שלי", "Плотная":"חומר צפוף",
        "Мезоны":"מזונים", "Странная":"חומר מוזר", "Объект":"עצם", "Масштаб":"קנה מידה",
        "Состояние":"מצב", "Математическое ядро":"ליבה מתמטית", "Параметры":"פרמטרים",
        "Результат solver":"תוצאת הפותר", "Научные источники":"מקורות מדעיים", "КОМПОНЕНТ":"רכיב",
        "Частица":"חלקיק", "Разбор обозначений":"פירוק הסימונים", "Система готова":"המערכת מוכנה",
        "Структура":"מבנה", "Взаимодействие":"אינטראקציה", "Поле":"שדה", "Столкновение":"התנגשות",
        "Аннигиляция":"איון", "Конфайнмент":"כליאה"
      };
      document.querySelectorAll("body *").forEach((element) => {
        if (element.children.length) return;
        const original = element.textContent.trim();
        if (leaves[original]) element.textContent = leaves[original];
      });
      select.querySelectorAll("option").forEach((option) => {
        option.textContent = { en:"אנגלית", ru:"רוסית", he:"עברית" }[option.value] || option.textContent;
      });
    }
  }

  // Keep the same preference key as the application itself.  The legacy key is
  // read once for compatibility with early local builds.
  const storedLocale = localStorage.getItem("qcd-neutrino-language") || localStorage.getItem("qcd-language") || "en";
  select.value = storedLocale;
  select.addEventListener("change", () => {
    localStorage.setItem("qcd-neutrino-language", locale());
    localStorage.setItem("qcd-language", locale());
    document.documentElement.lang = locale();
    document.documentElement.dir = locale() === "he" ? "rtl" : "ltr";
    location.reload();
  });
  applyLocale();
  window.addEventListener("load", applyLocale, { once: true });
  setTimeout(applyLocale, 0);
  setTimeout(applyLocale, 250);
  window.addEventListener("qcd-language-change", applyLocale);
})();
