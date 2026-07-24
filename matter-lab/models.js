export const modelRegistry = [
  {
    id: "proton",
    family: "ordinary",
    title: "Протон",
    subtitle: "Валентная структура uud",
    status: "confirmed",
    statusLabel: "Экспериментально подтверждено",
    description: "Нуклон с двумя u-кварками и одним d-кварком. Цвета в сцене обозначают три цветовых заряда, а световые связи — схематическую конфигурацию глюонного поля.",
    formula: "Q = 2/3 + 2/3 − 1/3 = +1;  V(r) = −4αₛ/(3r) + σr",
    applicability: "Кварковая композиция подтверждена. Потенциал Cornell — феноменологическая модель тяжёлых кварков; внутренняя 3D-картинка является иллюстрацией, а не траекторией кварков.",
    visual: "baryon",
    composition: ["u", "u", "d"],
    interaction: "boson",
    parameters: [
      { key: "alphaS", label: "Сильная связь αₛ", min: 0.15, max: 0.65, step: 0.01, value: 0.35 },
      { key: "stringTension", label: "Натяжение σ", unit: "GeV/fm", min: 0.4, max: 1.4, step: 0.01, value: 0.9 },
      { key: "probeEnergy", label: "Энергия фотона", unit: "keV", min: 1, max: 900, step: 1, value: 120 }
    ],
    sources: [
      ["PDG: Quark Model review", "https://pdg.lbl.gov/2022/reviews/rpp2022-rev-quark-model.pdf"],
      ["PDG: Particle listings", "https://pdg.lbl.gov/"]
    ]
  },
  {
    id: "neutron",
    family: "ordinary",
    title: "Нейтрон",
    subtitle: "Валентная структура udd",
    status: "confirmed",
    statusLabel: "Экспериментально подтверждено",
    description: "Нейтральный нуклон с одним u-кварком и двумя d-кварками. Режим слабого взаимодействия показывает схему β-распада: d → u + W⁻, затем W⁻ → e⁻ + ν̄ₑ.",
    formula: "Q = 2/3 − 1/3 − 1/3 = 0;  d → u + W⁻ → u + e⁻ + ν̄ₑ",
    applicability: "Кварковый состав и слабый распад подтверждены. Сцена не показывает реальный пространственный размер W-бозона или кварков.",
    visual: "baryon",
    composition: ["u", "d", "d"],
    interaction: "weak",
    parameters: [
      { key: "alphaS", label: "Сильная связь αₛ", min: 0.15, max: 0.65, step: 0.01, value: 0.35 },
      { key: "decaySpeed", label: "Скорость демонстрации", unit: "×", min: 0.2, max: 2, step: 0.05, value: 0.7 },
      { key: "probeEnergy", label: "Энергия зонда", unit: "MeV", min: 0.1, max: 10, step: 0.1, value: 1.3 }
    ],
    sources: [["PDG: Particle Physics Booklet", "https://pdg.lbl.gov/"]]
  },
  {
    id: "hydrogen",
    family: "ordinary",
    title: "Атом водорода",
    subtitle: "Простейшая атомная мишень",
    status: "confirmed",
    statusLabel: "Экспериментально подтверждено",
    description: "Протон и электрон в состоянии 1s. Фотон ниже первого резонанса рассеивается, фотон с энергией линии Лаймана возбуждает электрон на уровень n, а при Eγ ≥ 13.598 eV атом ионизируется.",
    formula: "Eₙ = −13.598 eV/n²;  ΔE₁→ₙ = 13.598(1−1/n²);  Kₑ = Eγ−13.598 eV",
    applicability: "Порог и уровни водорода физичны. Ширина линий намеренно увеличена для интерактивной демонстрации; 3D-орбиты показывают вероятностный масштаб, а не классические траектории.",
    visual: "atom",
    nucleus: ["p"],
    electrons: 1,
    interaction: "photon",
    parameters: [
      { key: "probeEnergy", label: "Энергия фотона", unit: "eV", min: 1, max: 80, step: 0.01, value: 10.2 },
      { key: "photonCount", label: "Число фотонов", min: 12, max: 120, step: 1, value: 48 },
      { key: "timeScale", label: "Скорость", unit: "×", min: 0.2, max: 2, step: 0.05, value: 0.65 }
    ],
    sources: [
      ["NIST Atomic Spectra Database", "https://physics.nist.gov/PhysRefData/ASD/"],
      ["Geant4 photoelectric effect", "https://geant4.web.cern.ch/documentation/dev/prm_html/PhysicsReferenceManual/electromagnetic/gamma_incident/photoelectric/photoelec.html"]
    ]
  },
  {
    id: "helium4",
    family: "ordinary",
    title: "Гелий-4",
    subtitle: "2 протона + 2 нейтрона",
    status: "confirmed",
    statusLabel: "Экспериментально подтверждено",
    description: "Компактное α-ядро и два электрона в оболочке 1s². Дискретные резонансы переводят один электрон в возбуждённое состояние, а выше 24.587 eV начинается первая ионизация He → He⁺ + e⁻.",
    formula: "E_ion,1 = 24.587 eV;  Kₑ = Eγ−E_ion;  σ_exc ∝ Γ²/[(E−E₀)²+Γ²]",
    applicability: "Порог первой ионизации и положения выбранных линий взяты из спектроскопии. Многоэлектронная корреляция представлена эффективными резонансами.",
    visual: "atom",
    nucleus: ["p", "p", "n", "n"],
    electrons: 2,
    interaction: "photon",
    parameters: [
      { key: "probeEnergy", label: "Энергия фотона", unit: "eV", min: 1, max: 100, step: 0.01, value: 21.22 },
      { key: "photonCount", label: "Число фотонов", min: 12, max: 120, step: 1, value: 56 },
      { key: "timeScale", label: "Скорость", unit: "×", min: 0.2, max: 2, step: 0.05, value: 0.65 }
    ],
    sources: [
      ["NIST Helium spectrum", "https://physics.nist.gov/PhysRefData/Handbook/Tables/heliumtable5.htm"],
      ["Geant4 low-energy EM models", "https://geant4.web.cern.ch/documentation/dev/prm_html/PhysicsReferenceManual/electromagnetic/introduction/livermore.html"]
    ]
  },
  {
    id: "hyperon",
    family: "dense",
    title: "Λ-гиперон",
    subtitle: "Барион uds со странным кварком",
    status: "confirmed",
    statusLabel: "Частица подтверждена",
    description: "Лямбда-гиперон содержит u, d и s-кварки. В плотной материи появление гиперонов является теоретической возможностью и меняет уравнение состояния.",
    formula: "Λ⁰ = uds;  Q = 2/3 − 1/3 − 1/3 = 0",
    applicability: "Сама частица наблюдается. Макроскопическая гиперонная материя внутри нейтронных звёзд пока модельно-зависима.",
    visual: "baryon",
    composition: ["u", "d", "s"],
    interaction: "boson",
    parameters: [
      { key: "alphaS", label: "Сильная связь αₛ", min: 0.15, max: 0.8, step: 0.01, value: 0.42 },
      { key: "muB", label: "Химпотенциал μB", unit: "MeV", min: 900, max: 1800, step: 5, value: 1120 },
      { key: "strangeMass", label: "Масса s-кварка", unit: "MeV", min: 80, max: 180, step: 1, value: 95 }
    ],
    sources: [["PDG: Baryon listings", "https://pdg.lbl.gov/"]]
  },
  {
    id: "neutronMatter",
    family: "dense",
    title: "Нейтронная материя",
    subtitle: "Плотная барионная фаза",
    status: "theoretical",
    statusLabel: "Теоретическая модель",
    description: "Нейтроны в вырожденной многочастичной среде. Сцена показывает коллективную упаковку, а solver — упрощённую полytропную EOS для сравнения с кварковыми фазами.",
    formula: "P = K(n/n₀)^γ;  ε = mₙn + P/(γ − 1)",
    applicability: "Форма EOS здесь учебная. Для исследований нужно подключать табличные EOS из CompOSE или MUSES.",
    visual: "denseBaryons",
    interaction: "eos",
    parameters: [
      { key: "density", label: "Плотность n/n₀", min: 0.5, max: 10, step: 0.05, value: 3.2 },
      { key: "gamma", label: "Индекс γ", min: 1.5, max: 3.5, step: 0.01, value: 2.35 },
      { key: "temperature", label: "Температура", unit: "MeV", min: 0, max: 120, step: 1, value: 18 }
    ],
    sources: [["CompOSE EOS database", "https://compose.obspm.fr/"]]
  },
  {
    id: "qgp",
    family: "quark",
    title: "Кварк-глюонная плазма",
    subtitle: "Горячая деконфинированная QCD-среда",
    status: "confirmed",
    statusLabel: "Экспериментально подтверждено",
    description: "При высокой температуре кварки и глюоны образуют коллективную среду. Сцена показывает деконфинированные степени свободы, а EOS использует идеальный предел Стефана–Больцмана как ориентир.",
    formula: "P = (π²/90)g_eff T⁴;  ε = 3P",
    applicability: "QGP наблюдается в тяжёлоионных столкновениях. Идеальный газ — ориентир; точные результаты требуют lattice QCD или гидродинамического backend.",
    visual: "quarkFluid",
    interaction: "eos",
    parameters: [
      { key: "temperature", label: "Температура", unit: "MeV", min: 100, max: 800, step: 2, value: 260 },
      { key: "muB", label: "Химпотенциал μB", unit: "MeV", min: 0, max: 450, step: 5, value: 40 },
      { key: "coupling", label: "Эффективная связь", min: 0, max: 1, step: 0.01, value: 0.24 }
    ],
    sources: [["MUSES: 4D lattice BQS EOS", "https://musesframework.io/docs/modules/eos_taylor_4d/Index.html"]]
  },
  {
    id: "mitBag",
    family: "strange",
    title: "Strange quark matter",
    subtitle: "MIT Bag Model, u-d-s",
    status: "theoretical",
    statusLabel: "Теоретическая гипотеза",
    description: "Самосвязанная смесь u, d и s-кварков в феноменологическом bag-вакууме. Модель математически определена, но стабильная макроскопическая strange matter не обнаружена.",
    formula: "P = (ε − 4B)/3;  ε = ΣΩᵢ + B",
    applicability: "Упрощённый безмассовый предел. Параметр B и поправки αₛ существенно меняют устойчивость.",
    visual: "strangeMatter",
    interaction: "eos",
    parameters: [
      { key: "bag", label: "Bag constant B¹/⁴", unit: "MeV", min: 130, max: 210, step: 1, value: 155 },
      { key: "muB", label: "Химпотенциал μB", unit: "MeV", min: 850, max: 2100, step: 5, value: 1250 },
      { key: "strangeMass", label: "Масса s-кварка", unit: "MeV", min: 70, max: 200, step: 1, value: 100 },
      { key: "alphaS", label: "Поправка αₛ", min: 0, max: 0.8, step: 0.01, value: 0.3 }
    ],
    sources: [
      ["MUSES dense-matter modules", "https://musesframework.io/docs/"],
      ["Open EOS relation reference", "https://www.aanda.org/articles/aa/full_html/2013/05/aa20986-12/aa20986-12.html"]
    ]
  },
  {
    id: "njl",
    family: "strange",
    title: "NJL quark matter",
    subtitle: "Трёхфлейворная mean-field модель",
    status: "theoretical",
    statusLabel: "Теоретическая модель",
    description: "Nambu–Jona-Lasinio модель описывает динамическое нарушение киральной симметрии и допускает ди-кварковое спаривание. Встроенный пресет повторяет структуру параметров MUSES NJL.",
    formula: "Ω = Ω_free + GₛΣφᵢ² − 4Kφᵤφ_dφ_s + Gᵥn² + Ω_pair",
    applicability: "Эффективная, неперенормируемая модель. Для количественной работы запускается официальный MUSES backend.",
    visual: "strangeMatter",
    interaction: "eos",
    parameters: [
      { key: "muB", label: "Химпотенциал μB", unit: "MeV", min: 850, max: 2100, step: 5, value: 1320 },
      { key: "scalarCoupling", label: "Скалярная связь Gₛ", min: 0.5, max: 1.5, step: 0.01, value: 1 },
      { key: "vectorCoupling", label: "Векторная связь Gᵥ/Gₛ", min: 0, max: 1, step: 0.01, value: 0.25 },
      { key: "pairingGap", label: "Щель Δ", unit: "MeV", min: 0, max: 180, step: 1, value: 55 }
    ],
    sources: [["MUSES: NJL module", "https://musesframework.io/docs/modules/njl/index.html"]]
  },
  {
    id: "twoSC",
    family: "strange",
    title: "2SC phase",
    subtitle: "Двухфлейворная цветовая сверхпроводимость",
    status: "theoretical",
    statusLabel: "Теоретическая фаза",
    description: "u- и d-кварки двух цветов образуют куперовские пары; часть цветовых степеней свободы остаётся неспаренной.",
    formula: "E_Δ(p) = √[(p − μ)² + Δ²]",
    applicability: "Предсказанная QCD-эффективными моделями фаза при высокой плотности; прямого экспериментального наблюдения нет.",
    visual: "pairedMatter",
    pairing: "2SC",
    interaction: "eos",
    parameters: [
      { key: "muB", label: "Химпотенциал μB", unit: "MeV", min: 900, max: 2200, step: 5, value: 1380 },
      { key: "pairingGap", label: "Щель Δ", unit: "MeV", min: 0, max: 180, step: 1, value: 75 },
      { key: "temperature", label: "Температура", unit: "MeV", min: 0, max: 150, step: 1, value: 18 }
    ],
    sources: [["MUSES: NJL color-superconducting EOS", "https://musesframework.io/docs/modules/njl/index.html"]]
  },
  {
    id: "cfl",
    family: "strange",
    title: "CFL phase",
    subtitle: "Color–flavor locking",
    status: "theoretical",
    statusLabel: "Теоретическая фаза",
    description: "u, d и s кварки спариваются с блокировкой цветовой и флейворной симметрий. Сцена показывает пары и коллективную фазовую когерентность.",
    formula: "P ≈ 3μ⁴/(4π²) + 3Δ²μ²/π² − 3mₛ²μ²/(4π²) − B",
    applicability: "Приближённая EOS при большой μ. Нужны поправки нейтральности, β-равновесия и выбранной регуляризации.",
    visual: "pairedMatter",
    pairing: "CFL",
    interaction: "eos",
    parameters: [
      { key: "muB", label: "Химпотенциал μB", unit: "MeV", min: 900, max: 2400, step: 5, value: 1560 },
      { key: "pairingGap", label: "Щель Δ", unit: "MeV", min: 0, max: 220, step: 1, value: 100 },
      { key: "strangeMass", label: "Масса s-кварка", unit: "MeV", min: 70, max: 220, step: 1, value: 110 },
      { key: "bag", label: "Bag constant B¹/⁴", unit: "MeV", min: 130, max: 210, step: 1, value: 155 }
    ],
    sources: [["MUSES: NJL module", "https://musesframework.io/docs/modules/njl/index.html"]]
  },
  {
    id: "strangelet",
    family: "strange",
    title: "Strangelet",
    subtitle: "Конечная u-d-s капля",
    status: "theoretical",
    statusLabel: "Гипотетический объект",
    description: "Конечный кластер strange quark matter. Surface и curvature terms конкурируют с объёмной энергией; устойчивость зависит от A, B, mₛ и взаимодействий.",
    formula: "E(A) = ε_bulk A + a_s A^(2/3) + a_c A^(1/3);  Z/A ≪ 1",
    applicability: "Strangelets не обнаружены. Формула — жидкокапельная параметризация для интерактивного сравнения.",
    visual: "strangelet",
    interaction: "stability",
    parameters: [
      { key: "baryonNumber", label: "Барионное число A", min: 6, max: 300, step: 1, value: 72 },
      { key: "bag", label: "Bag constant B¹/⁴", unit: "MeV", min: 130, max: 210, step: 1, value: 155 },
      { key: "surfaceEnergy", label: "Поверхностный член", unit: "MeV", min: 5, max: 80, step: 1, value: 28 }
    ],
    sources: [["CERN/PDG strange-particle searches", "https://pdg.lbl.gov/"]]
  },
  {
    id: "hyperonMatter",
    family: "dense",
    title: "Гиперонная материя",
    subtitle: "n, p, Λ, Σ, Ξ в β-равновесии",
    status: "theoretical",
    statusLabel: "Литературная EOS-модель",
    description: "Плотная барионная среда, в которой при росте химического потенциала становятся энергетически выгодны гипероны. Их появление меняет состав и обычно смягчает уравнение состояния.",
    formula: "P = ΣᵢPᵢ − ½m²σ̄² + ½m²ω̄²;  μᵢ = bᵢμₙ − qᵢμₑ",
    applicability: "Гипероны наблюдаются как частицы, но гиперонная фаза внутри нейтронных звёзд остаётся модельно-зависимой.",
    visual: "denseBaryons",
    interaction: "eos",
    parameters: [
      { key: "density", label: "Плотность n/n₀", min: 1, max: 10, step: 0.05, value: 4.2 },
      { key: "gamma", label: "Базовый индекс γ", min: 1.5, max: 3.4, step: 0.01, value: 2.45 },
      { key: "hyperonFraction", label: "Доля гиперонов", min: 0, max: 0.65, step: 0.01, value: 0.22 },
      { key: "temperature", label: "Температура", unit: "MeV", min: 0, max: 100, step: 1, value: 12 }
    ],
    sources: [
      ["Hyperonic core EOS tables", "https://arxiv.org/abs/1708.08681"],
      ["CompOSE database", "https://compose.obspm.fr/table_selection"]
    ]
  },
  {
    id: "kaonCondensate",
    family: "dense",
    title: "Каонный конденсат",
    subtitle: "K⁻-конденсация в плотной материи",
    status: "theoretical",
    statusLabel: "Литературная теоретическая фаза",
    description: "При достаточно высокой плотности эффективная энергия K⁻ может сравняться с химическим потенциалом электронов, после чего возникает макроскопически занятая бозонная мода.",
    formula: "ω_K(n_c) = μₑ;  ε_K = m*K²|K|² + (f²/2)|D₀K|²",
    applicability: "Фаза предсказывается некоторыми киральными и mean-field моделями, но экспериментально в нейтронных звёздах не подтверждена.",
    visual: "condensateMatter",
    interaction: "eos",
    parameters: [
      { key: "density", label: "Плотность n/n₀", min: 1, max: 10, step: 0.05, value: 4.8 },
      { key: "onsetDensity", label: "Порог n_c/n₀", min: 2, max: 8, step: 0.05, value: 3.6 },
      { key: "condensateFraction", label: "Доля конденсата", min: 0, max: 0.8, step: 0.01, value: 0.34 },
      { key: "temperature", label: "Температура", unit: "MeV", min: 0, max: 100, step: 1, value: 8 }
    ],
    sources: [["Kaon condensates in neutron stars", "https://arxiv.org/abs/nucl-th/9305006"]]
  },
  {
    id: "quarkyonic",
    family: "quark",
    title: "Кваркионическая материя",
    subtitle: "Конфайнмент с кварковой ферми-поверхностью",
    status: "theoretical",
    statusLabel: "Теоретическая QCD-фаза",
    description: "Предлагаемая промежуточная область: глубокие состояния ферми-моря описываются кварками, а возбуждения около поверхности остаются конфайненными барионами.",
    formula: "P(μ) = (1−w)P_had + wP_quark;  w = ½[1+tanh((μ−μ_c)/Γ)]",
    applicability: "Надёжно мотивирована в пределе большого N_c; существование и границы при N_c=3 не установлены.",
    visual: "hybridMatter",
    interaction: "eos",
    parameters: [
      { key: "muB", label: "Химпотенциал μB", unit: "MeV", min: 850, max: 2200, step: 5, value: 1350 },
      { key: "crossoverDensity", label: "Центр перехода n/n₀", min: 1.5, max: 7, step: 0.05, value: 3.4 },
      { key: "crossoverWidth", label: "Ширина перехода Γ", min: 0.1, max: 2, step: 0.01, value: 0.55 },
      { key: "quarkFraction", label: "Кварковая доля", min: 0, max: 1, step: 0.01, value: 0.58 }
    ],
    sources: [["Quarkyonic Matter and the QCD phase diagram", "https://arxiv.org/abs/0808.1057"]]
  },
  {
    id: "qhc21",
    family: "quark",
    title: "QHC21 crossover",
    subtitle: "Непрерывный quark–hadron crossover",
    status: "theoretical",
    statusLabel: "Опубликованная EOS-модель",
    description: "Интерполяционная EOS соединяет киральную ядерную материю с трёхфлейворной NJL-кварковой материей без жёсткого фазового скачка.",
    formula: "P(μ_B) = P_h(μ_B)(1−w) + P_q(μ_B)w;  0 < cₛ² = dP/dε < 1",
    applicability: "Это семейство EOS, согласуемое с ограничениями нейтронных звёзд; микроскопический механизм crossover остаётся предметом исследований.",
    visual: "hybridMatter",
    interaction: "eos",
    parameters: [
      { key: "muB", label: "Химпотенциал μB", unit: "MeV", min: 850, max: 2200, step: 5, value: 1420 },
      { key: "crossoverDensity", label: "Центр перехода n/n₀", min: 1.5, max: 7, step: 0.05, value: 3.1 },
      { key: "crossoverWidth", label: "Ширина crossover", min: 0.1, max: 2, step: 0.01, value: 0.72 },
      { key: "vectorCoupling", label: "Векторная связь gᵥ", min: 0, max: 1.6, step: 0.01, value: 1 }
    ],
    sources: [
      ["QHC21 equation of state", "https://arxiv.org/abs/2111.11919"],
      ["CompOSE QHC tables", "https://compose.obspm.fr/eos/237"]
    ]
  },
  {
    id: "loff",
    family: "strange",
    title: "LOFF crystal",
    subtitle: "Кристаллическая цветовая сверхпроводимость",
    status: "theoretical",
    statusLabel: "Теоретическая QCD-фаза",
    description: "Кварки с различающимися ферми-импульсами образуют пары с ненулевым суммарным импульсом. Параметр порядка периодически меняется в пространстве.",
    formula: "Δ(r) = Σ_q Δ_q exp(2iq·r);  E± = δμ ± √(ξ²+|Δ(r)|²)",
    applicability: "Кандидатная фаза холодной плотной кварковой материи; прямых наблюдений нет.",
    visual: "crystalMatter",
    pairing: "LOFF",
    interaction: "eos",
    parameters: [
      { key: "muB", label: "Химпотенциал μB", unit: "MeV", min: 900, max: 2400, step: 5, value: 1510 },
      { key: "pairingGap", label: "Амплитуда Δ", unit: "MeV", min: 0, max: 180, step: 1, value: 62 },
      { key: "mismatch", label: "Рассогласование δμ", unit: "MeV", min: 0, max: 140, step: 1, value: 48 },
      { key: "waveVector", label: "Волновой вектор q", unit: "fm⁻¹", min: 0.1, max: 3, step: 0.01, value: 1.15 }
    ],
    sources: [["Crystalline Color Superconductivity", "https://arxiv.org/abs/hep-ph/0008208"]]
  },
  {
    id: "gCFL",
    family: "strange",
    title: "gCFL phase",
    subtitle: "Gapless color–flavor locking",
    status: "theoretical",
    statusLabel: "Теоретическая QCD-фаза",
    description: "Напряжённая CFL-фаза, в которой часть квазичастичных ветвей становится бесщелевой при росте mₛ²/μ относительно щели спаривания.",
    formula: "mₛ²/μ ≈ 2Δ;  E₋(p) = |δμ − √((p−μ)²+Δ²)|",
    applicability: "Модельная фаза нейтральной кварковой материи; возможные нестабильности требуют проверки выбранной эффективной теории.",
    visual: "pairedMatter",
    pairing: "gCFL",
    interaction: "eos",
    parameters: [
      { key: "muB", label: "Химпотенциал μB", unit: "MeV", min: 900, max: 2400, step: 5, value: 1450 },
      { key: "pairingGap", label: "Щель Δ", unit: "MeV", min: 0, max: 180, step: 1, value: 58 },
      { key: "strangeMass", label: "Масса s-кварка", unit: "MeV", min: 70, max: 240, step: 1, value: 150 },
      { key: "mismatch", label: "Рассогласование δμ", unit: "MeV", min: 0, max: 150, step: 1, value: 65 }
    ],
    sources: [["Gapless Color-Flavor-Locked Quark Matter", "https://arxiv.org/abs/hep-ph/0311286"]]
  },
  {
    id: "cflKaon",
    family: "strange",
    title: "CFL-K⁰ phase",
    subtitle: "CFL с каонным конденсатом",
    status: "theoretical",
    statusLabel: "Теоретическая QCD-фаза",
    description: "Нарушение SU(3)-флейворной симметрии в CFL-среде может вызвать конденсацию псевдоголдстоуновских каонных мод поверх кваркового спаривания.",
    formula: "μ_eff = mₛ²/(2p_F);  μ_eff > m_K ⇒ ⟨K⁰⟩ ≠ 0",
    applicability: "Высокоплотностная эффективная теория; существование при плотностях реальных звёзд не подтверждено.",
    visual: "condensateMatter",
    pairing: "CFL-K0",
    interaction: "eos",
    parameters: [
      { key: "muB", label: "Химпотенциал μB", unit: "MeV", min: 1000, max: 2500, step: 5, value: 1660 },
      { key: "pairingGap", label: "CFL-щель Δ", unit: "MeV", min: 0, max: 220, step: 1, value: 105 },
      { key: "strangeMass", label: "Масса s-кварка", unit: "MeV", min: 70, max: 220, step: 1, value: 135 },
      { key: "condensateFraction", label: "Амплитуда K⁰", min: 0, max: 1, step: 0.01, value: 0.46 }
    ],
    sources: [["High Density Quark Matter under Stress", "https://arxiv.org/abs/hep-ph/0105150"]]
  },
  {
    id: "cflStrangelet",
    family: "strange",
    title: "CFL-strangelet",
    subtitle: "Конечная спаренная u-d-s капля",
    status: "theoretical",
    statusLabel: "Гипотетический объект",
    description: "Конечная капля strange matter в CFL-состоянии. Спаривание понижает объёмную энергию, а заряд в простой модели масштабируется как Z ≈ 0.3A²ᐟ³.",
    formula: "E/A = ε_bulk − 3Δ²μ²/(π²n_B) + a_sA⁻¹ᐟ³;  Z ≈ 0.3A²ᐟ³",
    applicability: "CFL-strangelets не обнаружены; устойчивость сильно зависит от bag-параметров, массы s-кварка и конечных поправок.",
    visual: "strangelet",
    pairing: "CFL",
    interaction: "stability",
    parameters: [
      { key: "baryonNumber", label: "Барионное число A", min: 6, max: 300, step: 1, value: 96 },
      { key: "bag", label: "Bag constant B¹/⁴", unit: "MeV", min: 130, max: 210, step: 1, value: 152 },
      { key: "surfaceEnergy", label: "Поверхностный член", unit: "MeV", min: 5, max: 80, step: 1, value: 24 },
      { key: "pairingGap", label: "CFL-щель Δ", unit: "MeV", min: 0, max: 180, step: 1, value: 92 }
    ],
    sources: [["Color-flavor locked strangelets", "https://arxiv.org/abs/hep-ph/0108036"]]
  },
  {
    id: "hDibaryon",
    family: "strange",
    title: "H-дибарион",
    subtitle: "Кандидатное состояние uuddss",
    status: "theoretical",
    statusLabel: "Кандидатное многокварковое состояние",
    description: "Шестикварковое состояние со странностью −2, связанное с каналами ΛΛ, NΞ и ΣΣ. Глубоко связанный вариант исключён, но околопороговая динамика исследуется.",
    formula: "T⁻¹(k) = −μ/(2π)(−1/a₀ + r_eff k²/2 − ik)",
    applicability: "Существование связанного H при физических массах кварков не установлено.",
    visual: "multiquark",
    composition: ["u", "u", "d", "d", "s", "s"],
    interaction: "binding",
    parameters: [
      { key: "attraction", label: "Притяжение V₀", unit: "MeV", min: 1, max: 80, step: 1, value: 28 },
      { key: "range", label: "Радиус действия", unit: "fm", min: 0.2, max: 3, step: 0.01, value: 1.15 },
      { key: "coreStrength", label: "Отталкивающий кор", unit: "MeV", min: 0, max: 120, step: 1, value: 48 }
    ],
    sources: [["Quark-mass dependence of H-dibaryon", "https://arxiv.org/abs/1607.03628"]]
  },
  {
    id: "omegaOmega",
    family: "strange",
    title: "ΩΩ-дибарион",
    subtitle: "Шесть s-кварков, канал ¹S₀",
    status: "theoretical",
    statusLabel: "Кандидат по lattice QCD",
    description: "Пара Ω⁻Ω⁻ образует наиболее странный дибарионный канал. Lattice QCD указывает на притяжение около унитарного режима и малую энергию связи.",
    formula: "k cotδ₀(k) = −1/a₀ + r_eff k²/2;  B ≈ ℏ²κ²/(2μ)",
    applicability: "Расчёт lattice QCD поддерживает околопороговое состояние; прямого экспериментального подтверждения связанного дибариона пока нет.",
    visual: "multiquark",
    composition: ["s", "s", "s", "s", "s", "s"],
    interaction: "binding",
    parameters: [
      { key: "attraction", label: "Притяжение V₀", unit: "MeV", min: 1, max: 80, step: 1, value: 34 },
      { key: "range", label: "Радиус действия", unit: "fm", min: 0.2, max: 3, step: 0.01, value: 1.27 },
      { key: "coreStrength", label: "Отталкивающий кор", unit: "MeV", min: 0, max: 120, step: 1, value: 38 }
    ],
    sources: [["Most Strange Dibaryon from Lattice QCD", "https://arxiv.org/abs/1709.00654"]]
  },
  {
    id: "pionPlus",
    family: "meson",
    title: "Пион π⁺",
    subtitle: "Лёгкий мезон u d̄ · m = 139.570 MeV",
    status: "confirmed",
    statusLabel: "Экспериментально подтверждён",
    description: "Положительно заряженный псевдоскалярный мезон из валентных u и d̄. При растяжении цветовой трубки энергия поля растёт, но свободные кварки не появляются: вакуум создаёт новую q-q̄ пару и исходная система превращается в два цветонейтральных адрона.",
    formula: "V(r)=−4αₛ/(3r)+κr;  κr ≳ 2m_q,eff;  P(q q̄)∝exp(−πm_T²/κ)",
    applicability: "Масса и квантовые числа взяты из PDG. Движение концов струны и момент разрыва являются наглядной реализацией Lund-механизма; полная вероятность фрагментации требует генератора событий PYTHIA.",
    visual: "meson",
    composition: ["u", "dbar"],
    interaction: "stringBreak",
    parameters: [
      { key: "separation", label: "Разделение кварков r", unit: "fm", min: 0.2, max: 3.5, step: 0.01, value: 0.78 },
      { key: "stringTension", label: "Натяжение струны κ", unit: "GeV/fm", min: 0.55, max: 1.25, step: 0.01, value: 0.9 },
      { key: "constituentMass", label: "Эффективная масса q", unit: "GeV", min: 0.22, max: 0.55, step: 0.01, value: 0.33 },
      { key: "timeScale", label: "Скорость демонстрации", unit: "×", min: 0.2, max: 1.5, step: 0.05, value: 0.55 }
    ],
    sources: [
      ["PDG 2025: Meson summary tables", "https://pdg.lbl.gov/2025/tables/rpp2025-qtab-mesons.pdf"],
      ["PYTHIA 8: Lund string fragmentation", "https://pythia.org/latest-manual/StringFragmentation.html"]
    ]
  },
  {
    id: "kaonPlus",
    family: "meson",
    title: "Каон K⁺",
    subtitle: "Странный мезон u s̄ · m = 493.677 MeV",
    status: "confirmed",
    statusLabel: "Экспериментально подтверждён",
    description: "Заряженный каон содержит u-кварк и странный антикварк s̄. Более тяжёлая странная степень свободы подавляет рождение s-s̄ пар при разрыве струны относительно лёгких u-ū и d-d̄ пар.",
    formula: "K⁺=u s̄;  P(s s̄)/P(u ū)≈exp[−π(m_s,T²−m_u,T²)/κ]",
    applicability: "Состав и масса подтверждены. Коэффициент подавления зависит от настроек фрагментации и здесь вычисляется только как эффективная Schwinger-подобная оценка.",
    visual: "meson",
    composition: ["u", "sbar"],
    interaction: "stringBreak",
    parameters: [
      { key: "separation", label: "Разделение кварков r", unit: "fm", min: 0.2, max: 3.5, step: 0.01, value: 0.82 },
      { key: "stringTension", label: "Натяжение струны κ", unit: "GeV/fm", min: 0.55, max: 1.25, step: 0.01, value: 0.9 },
      { key: "constituentMass", label: "Эффективная масса пары", unit: "GeV", min: 0.22, max: 0.7, step: 0.01, value: 0.41 },
      { key: "timeScale", label: "Скорость демонстрации", unit: "×", min: 0.2, max: 1.5, step: 0.05, value: 0.5 }
    ],
    sources: [["PDG 2025: Meson summary tables", "https://pdg.lbl.gov/2025/tables/rpp2025-qtab-mesons.pdf"], ["PYTHIA 8: Hadronization", "https://pythia.org/latest-manual/HadronizationOverview.html"]]
  },
  {
    id: "rhoZero",
    family: "meson",
    title: "ρ⁰-мезон",
    subtitle: "Векторный резонанс · m ≈ 775.26 MeV",
    status: "confirmed",
    statusLabel: "Экспериментально подтверждён",
    description: "Короткоживущий векторный мезон, представляющий изоспиновую смесь u-ū и d-d̄. Режим показывает конфайнмент валентной пары, а не классические орбиты кварков.",
    formula: "|ρ⁰⟩≈(|u ū⟩−|d d̄⟩)/√2;  Jᴾᶜ=1⁻⁻",
    applicability: "Резонанс подтверждён. Изоспиновая волновая функция показана выбранным компонентом; реальное состояние является квантовой суперпозицией.",
    visual: "meson",
    composition: ["d", "dbar"],
    interaction: "stringBreak",
    parameters: [
      { key: "separation", label: "Разделение кварков r", unit: "fm", min: 0.2, max: 3.5, step: 0.01, value: 0.7 },
      { key: "stringTension", label: "Натяжение струны κ", unit: "GeV/fm", min: 0.55, max: 1.25, step: 0.01, value: 0.92 },
      { key: "constituentMass", label: "Эффективная масса q", unit: "GeV", min: 0.22, max: 0.55, step: 0.01, value: 0.33 },
      { key: "timeScale", label: "Скорость демонстрации", unit: "×", min: 0.2, max: 1.5, step: 0.05, value: 0.55 }
    ],
    sources: [["PDG 2025: Meson summary tables", "https://pdg.lbl.gov/2025/tables/rpp2025-qtab-mesons.pdf"]]
  },
  {
    id: "jPsi",
    family: "meson",
    title: "J/ψ",
    subtitle: "Чармоний c c̄ · m = 3096.9 MeV",
    status: "confirmed",
    statusLabel: "Экспериментально подтверждён",
    description: "Связанное состояние charm-кварка и антикварка. Для тяжёлого кваркония Cornell-потенциал особенно полезен как феноменологическая аппроксимация короткодистанционного кулоновского и дальнего линейного вкладов.",
    formula: "V(r)=−4αₛ/(3r)+κr;  Jᴾᶜ=1⁻⁻",
    applicability: "Масса и состояние подтверждены. Рождение лёгкой q-q̄ пары при разрыве струны не означает создание новой c-c̄ пары; тяжёлые пары экспоненциально подавлены.",
    visual: "meson",
    composition: ["c", "cbar"],
    interaction: "stringBreak",
    parameters: [
      { key: "separation", label: "Разделение c-c̄", unit: "fm", min: 0.12, max: 3.2, step: 0.01, value: 0.46 },
      { key: "stringTension", label: "Натяжение струны κ", unit: "GeV/fm", min: 0.55, max: 1.25, step: 0.01, value: 0.92 },
      { key: "constituentMass", label: "Масса создаваемой пары", unit: "GeV", min: 0.22, max: 0.75, step: 0.01, value: 0.33 },
      { key: "timeScale", label: "Скорость демонстрации", unit: "×", min: 0.2, max: 1.5, step: 0.05, value: 0.45 }
    ],
    sources: [["PDG 2025: Meson summary tables", "https://pdg.lbl.gov/2025/tables/rpp2025-qtab-mesons.pdf"]]
  },
  {
    id: "upsilon1S",
    family: "meson",
    title: "Υ(1S)",
    subtitle: "Боттомоний b b̄ · m = 9460.4 MeV",
    status: "confirmed",
    statusLabel: "Экспериментально подтверждён",
    description: "Компактное связанное состояние bottom-кварка и антикварка. Большая масса b делает систему медленнее и компактнее, а рождение b-b̄ из мягкой струны практически подавлено.",
    formula: "Υ(1S)=b b̄;  V(r)=−4αₛ/(3r)+κr",
    applicability: "Подтверждённый мезон. Анимация разрыва демонстрирует образование лёгких мезонов при достаточной энергии струны, а не точную динамику распада Υ.",
    visual: "meson",
    composition: ["b", "bbar"],
    interaction: "stringBreak",
    parameters: [
      { key: "separation", label: "Разделение b-b̄", unit: "fm", min: 0.1, max: 3, step: 0.01, value: 0.3 },
      { key: "stringTension", label: "Натяжение струны κ", unit: "GeV/fm", min: 0.55, max: 1.25, step: 0.01, value: 0.92 },
      { key: "constituentMass", label: "Масса создаваемой пары", unit: "GeV", min: 0.22, max: 0.75, step: 0.01, value: 0.33 },
      { key: "timeScale", label: "Скорость демонстрации", unit: "×", min: 0.2, max: 1.5, step: 0.05, value: 0.4 }
    ],
    sources: [["PDG 2025: Meson summary tables", "https://pdg.lbl.gov/2025/tables/rpp2025-qtab-mesons.pdf"]]
  },
  {
    id: "x3872",
    family: "meson",
    title: "χc1(3872) / X(3872)",
    subtitle: "Наблюдаемое состояние · внутренняя структура не решена",
    status: "confirmed",
    statusLabel: "Состояние подтверждено · структура спорна",
    description: "Узкий резонанс около порога D⁰D̄*⁰. Само состояние наблюдается, но его микроскопическая интерпретация может включать молекулу мезонов, компактный тетракварк и примесь чармония.",
    formula: "|X⟩=a|c c̄⟩+b|D⁰D̄*⁰+c.c.⟩+c|[cq][c̄q̄]⟩",
    applicability: "Нельзя называть X(3872) неподтверждённой частицей: неподтверждён именно единственный структурный сценарий. В сцене показан c-c̄ базис как один из компонентов.",
    visual: "meson",
    composition: ["c", "cbar"],
    interaction: "stringBreak",
    parameters: [
      { key: "separation", label: "Эффективное разделение", unit: "fm", min: 0.2, max: 4.5, step: 0.01, value: 1.35 },
      { key: "stringTension", label: "Натяжение струны κ", unit: "GeV/fm", min: 0.45, max: 1.25, step: 0.01, value: 0.82 },
      { key: "constituentMass", label: "Масса создаваемой пары", unit: "GeV", min: 0.22, max: 0.75, step: 0.01, value: 0.33 },
      { key: "timeScale", label: "Скорость демонстрации", unit: "×", min: 0.2, max: 1.5, step: 0.05, value: 0.45 }
    ],
    sources: [["PDG 2025: Meson summary tables", "https://pdg.lbl.gov/2025/tables/rpp2025-qtab-mesons.pdf"]]
  },
  {
    id: "scalarGlueball",
    family: "meson",
    title: "Скалярный glueball 0⁺⁺",
    subtitle: "Предсказанное глюонное состояние · чистое назначение не установлено",
    status: "theoretical",
    statusLabel: "QCD-предсказание · кандидат",
    description: "Цветонейтральное связанное состояние преимущественно из возбуждений глюонного поля. Lattice QCD предсказывает скалярный канал, но физические f₀-резонансы смешиваются с q-q̄ и единственного чистого glueball пока не выделено.",
    formula: "O₀⁺⁺(x)=Tr F_{μν}(x)F^{μν}(x);  C(t)=⟨O(t)O(0)⟩∝e^{−Mt}",
    applicability: "Визуализация показывает полевую моду без валентных кварков. Значение массы не вычисляется этой браузерной сценой и должно поступать из lattice-QCD таблиц.",
    visual: "meson",
    composition: ["g", "g"],
    interaction: "stringBreak",
    parameters: [
      { key: "separation", label: "Размер полевой моды", unit: "fm", min: 0.2, max: 2.8, step: 0.01, value: 0.72 },
      { key: "stringTension", label: "Эффективное κ", unit: "GeV/fm", min: 0.55, max: 1.35, step: 0.01, value: 1.02 },
      { key: "constituentMass", label: "Порог лёгкой пары", unit: "GeV", min: 0.22, max: 0.75, step: 0.01, value: 0.36 },
      { key: "timeScale", label: "Скорость демонстрации", unit: "×", min: 0.2, max: 1.5, step: 0.05, value: 0.5 }
    ],
    sources: [["PDG 2025: Meson summary tables", "https://pdg.lbl.gov/2025/tables/rpp2025-qtab-mesons.pdf"], ["PYTHIA 8: Hadronization overview", "https://pythia.org/latest-manual/HadronizationOverview.html"]]
  },
  {
    id: "hybridMeson",
    family: "meson",
    title: "Гибридный мезон q q̄ g",
    subtitle: "Кандидат с возбуждённой глюонной степенью свободы",
    status: "theoretical",
    statusLabel: "Кандидатное экзотическое состояние",
    description: "Мезонный кандидат, в котором помимо q-q̄ существенна возбуждённая глюонная полевая мода. Экзотические Jᴾᶜ могут помочь отличать гибриды от обычного кварк-антикваркового спектра.",
    formula: "|H⟩≈|q q̄; gluonic excitation⟩;  Jᴾᶜ may be spin-exotic",
    applicability: "Кандидаты наблюдаются, но состав и смешивание модельно зависимы. Сфера поля является визуальной меткой возбуждения, а не отдельным локализованным глюоном.",
    visual: "meson",
    composition: ["u", "ubar", "g"],
    interaction: "stringBreak",
    parameters: [
      { key: "separation", label: "Разделение q-q̄", unit: "fm", min: 0.2, max: 3.8, step: 0.01, value: 1.05 },
      { key: "stringTension", label: "Натяжение струны κ", unit: "GeV/fm", min: 0.55, max: 1.35, step: 0.01, value: 1.0 },
      { key: "constituentMass", label: "Порог лёгкой пары", unit: "GeV", min: 0.22, max: 0.75, step: 0.01, value: 0.34 },
      { key: "timeScale", label: "Скорость демонстрации", unit: "×", min: 0.2, max: 1.5, step: 0.05, value: 0.5 }
    ],
    sources: [["PDG 2025: Meson summary tables", "https://pdg.lbl.gov/2025/tables/rpp2025-qtab-mesons.pdf"]]
  },
  {
    id: "colliderWorkbench",
    family: "collider",
    title: "Collider Workbench",
    subtitle: "Выбор двух пучков · PYTHIA-compatible channels",
    status: "confirmed",
    statusLabel: "ПОДТВЕРЖДЁННЫЕ КЛАССЫ ПРОЦЕССОВ",
    description: "Отдельная коллайдерная площадка. Выберите частицы пучка A и B: сервис определит допустимый класс взаимодействия и построит событие с сохранением энергии, импульса и заряда. Поддерживаются адрон-адронные, лептон-антилептонные, лептон-адронные, фотон-адронные и фотон-фотонные конфигурации.",
    formula: "s=(p_A+p_B)²;  Σp⃗_T≈0;  pp/pπ→QCD;  ℓ⁺ℓ⁻→γ*/Z→f f̄;  ℓp→ℓX;  γh→jets+X",
    applicability: "Классы входных пучков соответствуют конфигурациям PYTHIA 8. Браузерный solver точно соблюдает базовую релятивистскую кинематику и квантовые числа, но использует параметрические конечные состояния. Сечения, PDF, parton shower, hadronization и транспорт через вещество для исследовательского результата должны вычисляться внешней цепочкой PYTHIA 8 → HepMC3 → Geant4.",
    visual: "collider",
    interaction: "collision",
    collisionMode: "workbench",
    parameters: [
      { key: "beamA", label: "Пучок A", type: "select", value: "proton", options: [["proton", "p · протон"], ["antiproton", "p̄ · антипротон"], ["pionPlus", "π⁺ · пион"], ["pionMinus", "π⁻ · пион"], ["electron", "e⁻ · электрон"], ["positron", "e⁺ · позитрон"], ["muonMinus", "μ⁻ · мюон"], ["muonPlus", "μ⁺ · антимюон"], ["photon", "γ · фотон"]] },
      { key: "beamB", label: "Пучок B", type: "select", value: "proton", options: [["proton", "p · протон"], ["antiproton", "p̄ · антипротон"], ["pionPlus", "π⁺ · пион"], ["pionMinus", "π⁻ · пион"], ["electron", "e⁻ · электрон"], ["positron", "e⁺ · позитрон"], ["muonMinus", "μ⁻ · мюон"], ["muonPlus", "μ⁺ · антимюон"], ["photon", "γ · фотон"]] },
      { key: "processMode", label: "Физическая модель", type: "select", value: "auto", options: [["auto", "Авто · по типам пучков"], ["softQCD", "Soft QCD / minimum-bias"], ["hardQCD", "Hard QCD / dijet"], ["annihilation", "γ*/Z annihilation"], ["dis", "Deep-inelastic scattering"], ["photoproduction", "Photoproduction"], ["pairProduction", "γγ pair production"]] },
      { key: "beamEnergy", label: "Энергия √s", unit: "TeV", min: 0.01, max: 14, step: 0.01, value: 0.25 },
      { key: "hardScale", label: "Жёсткая шкала Q", unit: "GeV", min: 1, max: 2000, step: 1, value: 90 },
      { key: "eventSeed", label: "Seed события", min: 1, max: 9999, step: 1, value: 2401 },
      { key: "detectorField", label: "Поле соленоида B", unit: "T", min: 0, max: 4, step: 0.05, value: 3.8 }
    ],
    sources: [["PYTHIA 8.3: Beam parameters", "https://pythia.org/latest-manual/BeamParameters.html"], ["PYTHIA 8.3 manual", "https://pythia.org/latest-manual/Frontpage.html"], ["Geant4 hadronic physics manual", "https://geant4.web.cern.ch/documentation/pipelines/master/prm_html/PhysicsReferenceManual/hadronic/index.html"]]
  },
  {
    id: "ppMinimumBias",
    family: "collider",
    title: "pp · minimum-bias",
    subtitle: "Мягкое протон-протонное событие",
    status: "confirmed",
    statusLabel: "Подтверждённый класс событий",
    description: "Отдельная коллайдерная площадка для типичного неупругого pp-события. Два протона встречаются в центре детектора, после чего быстрый генератор строит заряженную множественность, продольную кинематику и поперечные импульсы.",
    formula: "p+p→hadrons;  Σp⃗_T≈0;  N_ch sampled from an overdispersed multiplicity model",
    applicability: "Это быстрый феноменологический event display, а не замена PYTHIA или реконструкции CMS. Для исследовательских результатов необходимо подать HepMC-события внешнего генератора и провести детекторный транспорт Geant4.",
    visual: "collider",
    interaction: "collision",
    collisionMode: "minimumBias",
    parameters: [
      { key: "beamEnergy", label: "Энергия √s", unit: "TeV", min: 0.9, max: 13.6, step: 0.1, value: 13.6 },
      { key: "impactParameter", label: "Прицельный параметр b", unit: "fm", min: 0, max: 2, step: 0.01, value: 0.58 },
      { key: "eventSeed", label: "Seed события", min: 1, max: 9999, step: 1, value: 2026 },
      { key: "detectorField", label: "Поле соленоида B", unit: "T", min: 0, max: 4, step: 0.05, value: 3.8 }
    ],
    sources: [["PYTHIA 8.3 manual", "https://pythia.org/latest-manual/Frontpage.html"], ["CMS Open Data event display", "https://opendata.cern.ch/visualise/events/CMS"]]
  },
  {
    id: "ppDijet",
    family: "collider",
    title: "pp → dijet + X",
    subtitle: "Подтверждённое жёсткое QCD-рассеяние",
    status: "confirmed",
    statusLabel: "Наблюдаемый канал LHC",
    description: "Жёсткое parton-parton рассеяние создаёт два почти противоположных струйных конуса. Parton shower повышает множественность, а Lund-фрагментация преобразует цветные партоны в цветонейтральные адроны.",
    formula: "ij→kl;  Δφ_jj≈π;  Q²≈p_T²;  parton shower → Lund strings → hadrons",
    applicability: "Направления и баланс импульса соблюдаются на уровне event display. Дифференциальные сечения, PDF и систематики требуют полного генератора PYTHIA 8 и его tune.",
    visual: "collider",
    interaction: "collision",
    collisionMode: "dijet",
    parameters: [
      { key: "beamEnergy", label: "Энергия √s", unit: "TeV", min: 0.9, max: 13.6, step: 0.1, value: 13.6 },
      { key: "hardScale", label: "Шкала струй pT", unit: "GeV", min: 20, max: 1200, step: 5, value: 320 },
      { key: "eventSeed", label: "Seed события", min: 1, max: 9999, step: 1, value: 3141 },
      { key: "detectorField", label: "Поле соленоида B", unit: "T", min: 0, max: 4, step: 0.05, value: 3.8 }
    ],
    sources: [["PYTHIA 8.3 manual", "https://pythia.org/latest-manual/Frontpage.html"], ["PYTHIA: String fragmentation", "https://pythia.org/latest-manual/StringFragmentation.html"], ["CMS Open Data event display", "https://opendata.cern.ch/visualise/events/CMS"]]
  },
  {
    id: "ppHiggsGammaGamma",
    family: "collider",
    title: "pp → H → γγ",
    subtitle: "Подтверждённый бозон Хиггса · дипhoton topology",
    status: "confirmed",
    statusLabel: "Процесс подтверждён на LHC",
    description: "Сценарий показывает два высокоэнергичных фотонных кластера от распада скалярного резонанса. В системе покоя Хиггса фотоны разлетаются строго противоположно; продольный boost лаборатории меняет наблюдаемые углы.",
    formula: "m²_γγ=2E₁E₂(1−cosθ₁₂);  H→γγ;  m_H≈125.25 GeV",
    applicability: "Кинематика двухчастичного распада релятивистски согласована. Частота события, фон и отклик калориметра здесь не моделируются и должны поступать из генератора и Geant4/Delphes.",
    visual: "collider",
    interaction: "collision",
    collisionMode: "higgsDiphoton",
    parameters: [
      { key: "beamEnergy", label: "Энергия √s", unit: "TeV", min: 7, max: 13.6, step: 0.1, value: 13.6 },
      { key: "resonanceMass", label: "Масса H", unit: "GeV", min: 120, max: 130, step: 0.05, value: 125.25 },
      { key: "eventSeed", label: "Seed события", min: 1, max: 9999, step: 1, value: 1252 },
      { key: "detectorField", label: "Поле соленоида B", unit: "T", min: 0, max: 4, step: 0.05, value: 3.8 }
    ],
    sources: [["PDG: Higgs boson listings", "https://pdg.lbl.gov/"], ["CMS Open Data event display", "https://opendata.cern.ch/visualise/events/CMS"]]
  },
  {
    id: "ppZPrime",
    family: "collider",
    title: "pp → Z′ → μ⁺μ⁻",
    subtitle: "Гипотетический тяжёлый нейтральный бозон",
    status: "hypothetical",
    statusLabel: "НЕ НАБЛЮДАЛСЯ · BSM BENCHMARK",
    description: "Параметрический benchmark нового нейтрального резонанса с распадом на мюонную пару. Он нужен для проверки реконструкции инвариантной массы и чувствительности детектора, но не утверждает существование Z′.",
    formula: "m²_μμ=(p_μ+ + p_μ−)²;  pp→Z′→μ⁺μ⁻",
    applicability: "Гипотетический канал. Browser solver генерирует только кинематику резонанса; сечение, ширина и связи зависят от выбранной BSM-модели и должны задаваться внешним генератором.",
    visual: "collider",
    interaction: "collision",
    collisionMode: "zPrime",
    parameters: [
      { key: "beamEnergy", label: "Энергия √s", unit: "TeV", min: 7, max: 13.6, step: 0.1, value: 13.6 },
      { key: "resonanceMass", label: "Гипотетическая масса Z′", unit: "GeV", min: 250, max: 6000, step: 10, value: 1800 },
      { key: "eventSeed", label: "Seed события", min: 1, max: 9999, step: 1, value: 4242 },
      { key: "detectorField", label: "Поле соленоида B", unit: "T", min: 0, max: 4, step: 0.05, value: 3.8 }
    ],
    sources: [["PYTHIA 8.3 manual", "https://pythia.org/latest-manual/Frontpage.html"], ["CMS Open Data event display", "https://opendata.cern.ch/visualise/events/CMS"]]
  },
  {
    id: "ppHiddenValley",
    family: "collider",
    title: "pp → hidden-valley shower",
    subtitle: "Гипотетический displaced dark shower",
    status: "hypothetical",
    statusLabel: "НЕ НАБЛЮДАЛСЯ · GENERATOR BENCHMARK",
    description: "Гипотетический скрытый сектор создаёт долгоживущие состояния, которые распадаются на видимые частицы вдали от первичной вершины. Сцена подчёркивает смещённые вершины и необычную топологию треков.",
    formula: "pp→mediator→q_v q̄_v;  L=βγcτ;  dark shower→displaced visible decays",
    applicability: "Такой сигнал не подтверждён. Это генераторный benchmark: параметры скрытого сектора произвольны и должны быть связаны с конкретной лагранжевой моделью перед физическим анализом.",
    visual: "collider",
    interaction: "collision",
    collisionMode: "hiddenValley",
    parameters: [
      { key: "beamEnergy", label: "Энергия √s", unit: "TeV", min: 7, max: 13.6, step: 0.1, value: 13.6 },
      { key: "resonanceMass", label: "Масса медиатора", unit: "GeV", min: 100, max: 3500, step: 10, value: 900 },
      { key: "decayLength", label: "Средняя длина распада", unit: "cm", min: 1, max: 250, step: 1, value: 78 },
      { key: "eventSeed", label: "Seed события", min: 1, max: 9999, step: 1, value: 7331 }
    ],
    sources: [["PYTHIA 8.3 manual", "https://pythia.org/latest-manual/Frontpage.html"], ["PYTHIA: New fragmentation models", "https://pythia.org/latest-manual/ImplementNewFragmentation.html"]]
  },
  {
    id: "neutrinoLens",
    family: "hypothetical",
    title: "Нейтринная линза",
    subtitle: "Spin/helicity effective Hamiltonian",
    status: "hypothetical",
    statusLabel: "HYPOTHETICAL EXTENSION",
    description: "Проектная модель экзотической анизотропной среды. Линза добавляет к стандартному гамильтониану управляемый спин-зависимый член и поворачивает Bloch-вектор двухуровневого состояния.",
    formula: "H = H_vac + H_MSW + ½(κρa σₓ + ηρs σᵧ + δ σ_z);  i dψ/dx = Hψ",
    applicability: "Такой материал не известен и эффект не подтверждён. κ и η — пользовательские эффективные коэффициенты, а результат является проверкой гипотезы, не предсказанием существующего вещества.",
    visual: "neutrinoLens",
    interaction: "neutrino",
    parameters: [
      { key: "neutrinoEnergy", label: "Энергия нейтрино", unit: "GeV", min: 0.1, max: 100, step: 0.1, value: 10 },
      { key: "density", label: "Плотность ρ/ρ₀", min: 0, max: 20, step: 0.1, value: 6.5 },
      { key: "anisotropy", label: "Анизотропия a", min: 0, max: 1, step: 0.01, value: 0.62 },
      { key: "spinCoupling", label: "Гипотетическая связь κ", min: 0, max: 2, step: 0.01, value: 0.72 },
      { key: "lensLength", label: "Толщина линзы", unit: "m", min: 1, max: 100, step: 1, value: 38 }
    ],
    sources: [
      ["nuSQuIDS: neutrino propagation", "https://www.sciencedirect.com/science/article/pii/S0010465522000649"],
      ["nuSQuIDS source code", "https://github.com/arguelles/nuSQuIDS"]
    ]
  }
];

// Curated representative models. Each local visual is educational; source links
// identify the corresponding open scientific code or primary literature.
modelRegistry.push(
  { id:'strangeStar', family:'macro', title:'Strange star', subtitle:'Self-bound u-d-s quark-matter compact object', status:'theoretical', statusLabel:'THEORETICAL MODEL', description:'A compact-star hypothesis in which bulk strange quark matter is self-bound. The display is a qualitative density profile, not a relativistic stellar solution.', formula:'P = -Omega; epsilon/n_B < 930 MeV', applicability:'Strange stars remain hypothetical. This is a parameterized educational comparison with neutron-star matter.', visual:'strangeMatter', interaction:'strong', parameters:[{key:'density',label:'Central density',unit:'n0',min:1,max:15,step:.1,value:6},{key:'bag',label:'Bag constant',unit:'MeV/fm3',min:40,max:110,step:1,value:70}], sources:[['Strange-matter review','https://arxiv.org/abs/astro-ph/0402014'],['CompOSE equation-of-state database','https://compose.obspm.fr/']] },
  { id:'axionField', family:'exotic', title:'Axion dark-matter field', subtitle:'Ultralight scalar-field dark-matter candidate', status:'hypothetical', statusLabel:'UNDETECTED CANDIDATE', description:'An axion or axion-like field can behave as dark matter. This scene visualizes an oscillating scalar amplitude; it does not claim a detection.', formula:'phi_ddot + 3 H phi_dot + m_a^2 phi = 0', applicability:'Axions are motivated candidates but have not been detected. The linked code computes cosmological observables.', visual:'condensateMatter', interaction:'field', parameters:[{key:'axionMass',label:'Axion mass',unit:'eV',min:1e-24,max:1e-20,step:1e-24,value:1e-22},{key:'density',label:'Field density',unit:'rho0',min:.1,max:10,step:.1,value:1}], sources:[['AxionCAMB open source','https://github.com/dgrin1/axionCAMB'],['AxionCAMB physics paper','https://arxiv.org/abs/1410.2896']] },
  { id:'fuzzyDarkMatter', family:'exotic', title:'Fuzzy dark matter', subtitle:'Wave-like ultralight dark-matter halo', status:'hypothetical', statusLabel:'THEORETICAL MODEL', description:'A very light bosonic dark-matter candidate whose de Broglie wavelength can be astrophysically large. The visualization represents interference and a solitonic core.', formula:'i hbar dpsi/dt = -(hbar^2/2m) laplacian psi + m Phi psi', applicability:'This is a Schrödinger-Poisson toy visualization, not a cosmological N-body run.', visual:'condensateMatter', interaction:'field', parameters:[{key:'particleMass',label:'Particle mass',unit:'eV',min:1e-23,max:5e-21,step:1e-23,value:1e-22},{key:'coreRadius',label:'Core radius',unit:'kpc',min:.1,max:5,step:.1,value:1}], sources:[['GADGET-4 open N-body code','https://wwwmpa.mpa-garching.mpg.de/gadget4/'],['Fuzzy-dark-matter review','https://arxiv.org/abs/1705.01837']] },
  { id:'qBall', family:'exotic', title:'Q-ball', subtitle:'Non-topological scalar-field soliton', status:'theoretical', statusLabel:'THEORETICAL MODEL', description:'A localized scalar-field configuration stabilized by a conserved charge Q. The scene is a qualitative radial field profile.', formula:'Phi(r,t) = phi(r) exp(-i omega t); Q = integral j0 d3x', applicability:'Q-balls are theoretical objects. The linked notebook solves the radial Klein-Gordon problem for a chosen potential.', visual:'condensateMatter', interaction:'field', parameters:[{key:'frequency',label:'Field frequency',unit:'m',min:.1,max:.99,step:.01,value:.65},{key:'coupling',label:'Self coupling',min:0,max:2,step:.01,value:.5}], sources:[['Open Q-ball PINN notebook','https://github.com/PedroBritodSa/Physics-Informed-Neural-Network-Project'],['Q-ball review','https://arxiv.org/abs/hep-th/0103183']] },
  { id:'bosonStar', family:'macro', title:'Boson star', subtitle:'Self-gravitating scalar-field compact object', status:'theoretical', statusLabel:'THEORETICAL MODEL', description:'A hypothetical compact object supported by a bosonic field. Variants include mini, rotating, self-interacting and axion stars.', formula:'G_mu_nu = 8 pi G T_mu_nu[phi]; (Box - m^2) phi = 0', applicability:'No boson star has been confirmed. A realistic model solves Einstein-Klein-Gordon equations numerically.', visual:'condensateMatter', interaction:'gravity', parameters:[{key:'fieldMass',label:'Boson mass',unit:'eV',min:1e-22,max:1e-10,step:1e-22,value:1e-12},{key:'compactness',label:'Compactness',min:.01,max:.45,step:.01,value:.16}], sources:[['Einstein Toolkit','https://einsteintoolkit.org/'],['Einstein Toolkit paper','https://arxiv.org/abs/1111.3344']] },
  { id:'mirrorMatter', family:'exotic', title:'Mirror matter', subtitle:'Parity-mirrored hidden-sector hypothesis', status:'hypothetical', statusLabel:'SPECULATIVE SECTOR', description:'A hidden sector containing mirror counterparts of Standard-Model particles. The visual is a conceptual two-sector coupling diagram.', formula:'L = L_SM + L_mirror + epsilon F Fprime', applicability:'Mirror matter is a model class, not an observed material. Portal strength is a demonstration parameter.', visual:'hybridMatter', interaction:'portal', parameters:[{key:'mixing',label:'Kinetic mixing',min:0,max:.1,step:.001,value:.01},{key:'sectorDensity',label:'Mirror-sector density',min:0,max:10,step:.1,value:2}], sources:[['Mirror matter review','https://arxiv.org/abs/0804.0622'],['GADGET-4 framework','https://wwwmpa.mpa-garching.mpg.de/gadget4/']] },
  { id:'darkHadron', family:'exotic', title:'Dark hadron sector', subtitle:'Dark-QCD bound-state benchmark', status:'hypothetical', statusLabel:'GENERATOR BENCHMARK', description:'A generic confined hidden sector with dark quarks, dark pions and dark baryons. The local scene is illustrative.', formula:'SU(N)_D confinement; pp -> mediator -> dark shower', applicability:'This model has no experimental confirmation. Masses and portal couplings are benchmark parameters.', visual:'hybridMatter', interaction:'portal', parameters:[{key:'confinement',label:'Dark confinement scale',unit:'GeV',min:.1,max:20,step:.1,value:2},{key:'portal',label:'Portal coupling',min:0,max:1,step:.01,value:.12}], sources:[['PYTHIA 8 hidden-valley documentation','https://pythia.org/latest-manual/HiddenValley.html'],['Hidden-valley phenomenology','https://arxiv.org/abs/0903.0883']] },
  { id:'magneticMonopole', family:'exotic', title:'Magnetic monopole', subtitle:'Magnetically charged particle hypothesis', status:'hypothetical', statusLabel:'UNOBSERVED PARTICLE', description:'A particle carrying magnetic charge. Field lines in this scene represent the monopole ansatz, not detector data.', formula:'div B = 4 pi g delta(r); e g = n hbar c / 2', applicability:'No fundamental magnetic monopole has been observed. Search limits depend on mass and production assumptions.', visual:'multiquark', interaction:'field', parameters:[{key:'magneticCharge',label:'Magnetic charge',unit:'gD',min:1,max:6,step:1,value:1},{key:'mass',label:'Mass scale',unit:'TeV',min:.1,max:10,step:.1,value:2}], sources:[['MoEDAL monopole programme','https://moedal.web.cern.ch/'],['PDG monopole review','https://pdg.lbl.gov/']] },
  { id:'cosmicString', family:'exotic', title:'Cosmic string', subtitle:'Topological defect — catalog entry only', status:'theoretical', statusLabel:'NO LOCAL 3D MODEL', description:'A one-dimensional topological defect predicted in some symmetry-breaking models. No local 3D scene is shown, because the previous lattice of spheres was not a cosmic-string model.', formula:'mu approx 2 pi eta^2; delta T/T proportional to G mu', applicability:'Cosmic strings have not been detected. This entry documents the theory and sources only; it is not a simulation. CosmoLattice is an open lattice-field platform suitable for implementing Abelian-Higgs string dynamics, but it is not embedded here yet.', visual:'unavailable', interaction:'field', parameters:[], sources:[['Cosmic-string review','https://arxiv.org/abs/1010.2511'],['CosmoLattice: open lattice-field code','https://cosmolattice.net/'],['Computational Frontiers of String Theory','https://www.compstring.org/']] },
  { id:'metamaterial', family:'exotic', title:'Electromagnetic metamaterial', subtitle:'Engineered effective-medium structure', status:'confirmed', statusLabel:'LABORATORY MATERIAL', description:'Unlike most entries in this family, metamaterials are real engineered structures. Their response is set by geometry.', formula:'n_eff = +/- sqrt(epsilon_eff mu_eff)', applicability:'This is a qualitative effective-medium display. Full-wave simulation needs a geometry-resolved solver such as MEEP.', visual:'crystalMatter', interaction:'photon', parameters:[{key:'permittivity',label:'Effective permittivity',min:-5,max:5,step:.1,value:-1.2},{key:'permeability',label:'Effective permeability',min:-5,max:5,step:.1,value:-.8}], sources:[['MEEP open-source FDTD solver','https://github.com/NanoComp/meep'],['MEEP reference paper','https://doi.org/10.1016/j.cpc.2009.11.008']] },
  { id:'preonMatter', family:'exotic', title:'Preon matter', subtitle:'Subquark compositeness hypothesis', status:'hypothetical', statusLabel:'SPECULATIVE MODEL', description:'A compositeness model in which quarks and leptons have smaller constituents. The scene is a conceptual hierarchy, not evidence for substructure.', formula:'Lambda_comp >> v; deviations scale as 1/Lambda_comp^2', applicability:'No compositeness has been observed. Collider analyses quote limits rather than a confirmed preon material.', visual:'multiquark', interaction:'collision', parameters:[{key:'compositeness',label:'Compositeness scale',unit:'TeV',min:1,max:50,step:1,value:15},{key:'binding',label:'Binding strength',min:0,max:2,step:.01,value:.6}], sources:[['PDG compositeness review','https://pdg.lbl.gov/'],['CMS Open Data event display','https://opendata.cern.ch/visualise/events/CMS']] }
);

// Complete taxonomy from the project brief.  These are registry entries, not
// claimed simulations: an entry stays visual-free until a traceable model is
// integrated for that particular physical system.
const exoticTaxonomy = [
  ['strange-quark-family','Strange-quark matter','Bulk strange quark matter; strangelets; nuclearites; strange nuggets; antistrangelets; strange stars; strange dwarfs; strange planets.'],
  ['unconfined-quark-family','Unconfined quark matter','Two- and three-flavour matter; heavy-quark, charm and bottom matter; multiquark matter; quark liquid; quark crystal.'],
  ['color-superconducting-family','Color-superconducting matter','2SC; CFL; g2SC; gCFL; LOFF; crystalline colour superconductivity; polar, planar and A phases; colour-spin locked phase.'],
  ['qcd-phase-family','Quark–gluon exotic phases','Quark–gluon plasma; supercooled QGP; glasma; colour-glass condensate; quarkyonic matter; semi-QGP; sQGP; gluon-condensate, pure-glue, glueball and flux-tube matter.'],
  ['exotic-hadron-family','Exotic hadronic matter','Hyperon and hypernuclear matter; kaon and pion condensates; dibaryon and H-dibaryon matter; tetra-, penta- and hexaquark matter; glueball condensate; hybrid and pasta phases.'],
  ['dark-matter-family','Dark matter candidates and structures','WIMPs; neutralinos; supersymmetric, Kaluza–Klein, sterile-neutrino, gravitino, axino and hidden-sector matter; axions/ALPs, axion condensates, stars and miniclusters; fuzzy, wave, scalar, vector, dark-photon and superfluid dark matter; self-interacting, atomic and asymmetric dark sectors; compact clumps, macros, nuggets and primordial black holes.'],
  ['mirror-hidden-family','Mirror and hidden-sector matter','Mirror electrons, nucleons, atoms, molecules, stars, planets and galaxies; hidden-valley, secluded, dark-QCD, dark-quark, dark-hadron, dark-pion, dark-glueball, dark-baryon, dark-nucleus and dark-atom matter; Higgs, vector, neutrino, axion and gravitational portals.'],
  ['soliton-family','Solitonic and field matter','Q-balls, gauged/supersymmetric/baryonic/leptonic/rotating/charged Q-balls, Q-shells and Q-stars; oscillons, oscillatons, scalarons, Skyrmions, sine-Gordon solitons, domain walls, vortons and non-topological solitons.'],
  ['bosonic-family','Bosonic condensates and stars','Gravitationally bound, scalar, vector, axion, dilaton, modulus, inflaton, Higgs and graviton condensates; mini, massive, rotating, charged, Proca, solitonic, multistate, fermion-boson, dark and phantom boson stars.'],
  ['fermionic-family','Fermionic exotic matter','Fermion balls; sterile- and heavy-neutrino matter and neutrino stars; dark fermions; gravitino, photino and axino matter; preon matter and stars; technifermion and composite-fermion matter.'],
  ['subquark-family','Preon and subquark matter','Preon matter and plasma; subquark, rishon and haplon matter; compositeness matter; technicolour condensate; technibaryonic matter.'],
  ['monopole-family','Magnetically charged matter','Magnetic-monopole matter and plasma; monopole condensates, monopolium, monopole stars and primordial monopole matter; dyonic matter, plasma, condensates and stars.'],
  ['topological-defect-family','Topological-defect matter','Cosmic and superconducting strings; domain walls; monopole networks; textures; semilocal strings; vortons; cosmic necklaces; string walls; QCD and axion domain walls; loops, wall nuggets, defect stars and defect networks.'],
  ['negative-energy-family','Negative-mass and energy-condition-violating matter','Negative inertial/gravitational mass, runaway pairs and negative-mass fluids; Casimir-like negative energy, exotic stress-energy, phantom and ghost matter, NEC/WEC violation and wormhole-supporting matter; quintom and negative-kinetic fields.'],
  ['tachyon-family','Tachyonic matter','Tachyon particles, condensates and matter; rolling tachyons; tachyon dark energy; tachyonic vacuum and superluminal field configurations.'],
  ['extra-dimension-family','Extra-dimensional matter','Kaluza–Klein, bulk and brane matter; brane-localised particles; radion matter; KK-graviton condensates; warped and universal-extra-dimension matter; string winding and momentum modes.'],
  ['quantum-gravity-family','String and quantum-gravity matter','String matter and gas; brane gas and D-brane matter; fundamental strings and cosmic superstrings; fuzzballs, Planck and quantum-foam matter; spin networks, loop-quantum-gravity and quantum-gravity condensates; electromagnetic, gravitational, quantum and AdS geons; holographic matter.'],
  ['vacuum-cosmology-family','Vacuum and cosmological forms','False-vacuum matter, true-vacuum bubbles, metastable domains and vacuum condensates; dark energy, quintessence, k-essence, phantom energy, Chaplygin gas, vacuum-energy stars, gravastar interiors, inflaton and early-dark-energy fields.'],
  ['antimatter-exotic-family','Exotic antimatter forms','Antimatter stars, planets, galaxies, neutron stars and quark stars; anti-strangelets; unobserved antinuclei; antimatter domains, nuggets and antimatter dark matter.'],
  ['compact-object-family','Exotic compact objects','Boson, fermion, Proca, axion, Q-, quark, strange, hybrid, preon, gravastar, dark, mirror, electroweak, Planck, black and wormhole stars; fuzzballs, anisotropic/elastic stars, dark-matter-admixed objects and black-hole mimickers; warp-bubble, firewall, quantum-hair and horizonless compact matter.'],
  ['programmable-family','Programmable and information matter','Programmable, claytronic, modular-robotic, computational and digital matter; smart dust, utility fog and foglets; self-assembling, self-repairing, morphogenetic, swarm, neural and quantum-programmable matter.'],
  ['metamatter-family','Metamatter','Electromagnetic, negative-index, hyperbolic, acoustic, mechanical, topological, quantum, spacetime, non-Hermitian, programmable, active and self-reconfigurable metamaterials; gravitational, neutrino and weak-interaction metamaterials.'],
  ['author-hypothesis-family','Author hypothetical models','Programmable atoms; neutrino-sensitive matter and neutrino lenses; polarisation and spin-programmable matter; quark crystals; seeded/adaptive/self-assembling strange matter and programmable strangelets; neutrino-activated, information-linked, combinatorial and distributed computational matter; artificial living matter.']
];

modelRegistry.push(...exoticTaxonomy.map(([id, title, entries]) => ({
  id, family:'exotic', title, subtitle:'Complete taxonomy entry — no local 3D model',
  status:'catalog', statusLabel:'CATALOGUE ONLY', description:`Included forms: ${entries}`,
  formula:'No single equation of state applies to this heterogeneous category.',
  applicability:'This is a classified reference entry. No local visualization is shown unless a specific, traceable scientific model is available.',
  visual:'unavailable', interaction:'none', parameters:[], sources:[]
})));

const catalogOriginal = new Map(modelRegistry.map((model) => [model.id, {
  title: model.title, subtitle: model.subtitle, description: model.description,
  applicability: model.applicability, statusLabel: model.statusLabel
}]));

const russianExoticCatalog = {
  strangeStar:['Странная звезда','Самосвязанная компактная звезда из u-d-s-кварковой материи','Гипотетический компактный объект, состоящий из объёмной странной кварковой материи.'],
  axionField:['Аксионное поле тёмной материи','Кандидат на роль ультралёгкой скалярной тёмной материи','Аксион или аксионоподобное поле — гипотетический кандидат на тёмную материю; локальная сцена иллюстрирует осцилляции поля.'],
  fuzzyDarkMatter:['Нечёткая тёмная материя','Волновой гало ультралёгкой тёмной материи','Кандидат из очень лёгких бозонов с астрофизически большой длиной волны де Бройля.'],
  qBall:['Q-шар','Нетопологический солитон комплексного скалярного поля','Локализованная конфигурация скалярного поля, стабилизированная сохраняющимся зарядом Q.'],
  bosonStar:['Бозонная звезда','Самогравитирующий компактный объект из скалярного поля','Гипотетический компактный объект, поддерживаемый бозонным полем; подтверждённых наблюдений нет.'],
  mirrorMatter:['Зеркальная материя','Гипотеза скрытого сектора с зеркальной симметрией','Скрытый сектор с зеркальными аналогами частиц Стандартной модели.'],
  darkHadron:['Сектор тёмных адронов','Эталон скрытого сектора с тёмной КХД','Конфайнированный скрытый сектор с тёмными кварками, пионами и барионами.'],
  magneticMonopole:['Магнитный монополь','Гипотеза частицы с магнитным зарядом','Гипотетическая частица с магнитным зарядом; фундаментальных монополей пока не обнаружено.'],
  cosmicString:['Космическая струна','Топологический дефект — только запись каталога','Одномерный топологический дефект некоторых моделей нарушения симметрии. Локальная 3D-сцена намеренно не показана: ранее использованная сетка не была моделью струны.'],
  metamaterial:['Электромагнитный метаматериал','Искусственная структура с эффективным откликом среды','В отличие от большинства записей раздела, метаматериалы — реальные инженерные структуры; их отклик задаётся геометрией.'],
  preonMatter:['Преонная материя','Гипотеза субкварковой составности','Модель, в которой кварки и лептоны имеют более мелкие составляющие; наблюдательных подтверждений нет.'],
  'strange-quark-family':['Странная кварковая материя','Полная классификация — локальной 3D-модели нет','Объёмная странная материя; стрэнджлеты; нуклеариты; странные самородки; антистрэнджлеты; странные звёзды, карлики и планеты.'],
  'unconfined-quark-family':['Неконфайненная кварковая материя','Полная классификация — локальной 3D-модели нет','Двух- и трёхфлейворная, тяжёлая кварковая, charm- и bottom-материя; многокварковая материя; кварковая жидкость и кристалл.'],
  'color-superconducting-family':['Цветовая сверхпроводимость','Полная классификация — локальной 3D-модели нет','Фазы 2SC, CFL, g2SC, gCFL, LOFF, кристаллическая цветовая сверхпроводимость, polar, planar, A и color-spin-locked.'],
  'qcd-phase-family':['Экзотические кварк-глюонные фазы','Полная классификация — локальной 3D-модели нет','Кварк-глюонная плазма, переохлаждённая КГП, гласма, цветовой стеклянный конденсат, кварконионная материя, semi-QGP, sQGP, глюонный конденсат, чистая глюонная и глюбольная материя.'],
  'exotic-hadron-family':['Экзотическая адронная материя','Полная классификация — локальной 3D-модели нет','Гиперонная и гиперядерная материя; каонный и пионный конденсаты; дибарионы, H-дибарионы; тетра-, пента- и гексакварковая материя; смешанные pasta-фазы.'],
  'dark-matter-family':['Тёмная материя','Полная классификация — локальной 3D-модели нет','WIMP, нейтралино, стерильные нейтрино, гравитино, аксионы и аксионные звёзды; нечёткая, волновая, векторная и сверхтекучая тёмная материя; самовзаимодействующие и компактные формы.'],
  'mirror-hidden-family':['Зеркальная и скрытосекторная материя','Полная классификация — локальной 3D-модели нет','Зеркальные частицы, атомы, звёзды и галактики; hidden-valley, тёмная КХД, тёмные адроны, атомы и порталы Хиггса, векторный, нейтринный, аксионный и гравитационный.'],
  'soliton-family':['Солитонная и полевая материя','Полная классификация — локальной 3D-модели нет','Q-шары и их подтипы; осциллоны, осциллатоны, скалароны, скирмионы, sine-Gordon солитоны, доменные стенки, vortons и нетопологические солитоны.'],
  'bosonic-family':['Бозонные конденсаты и звёзды','Полная классификация — локальной 3D-модели нет','Скалярные, векторные, аксионные, дилатонные, инфлатонные, хиггсовские и гравитонные конденсаты; мини-, вращающиеся, заряженные, Proca-, тёмные и фантомные бозонные звёзды.'],
  'fermionic-family':['Фермионная экзотическая материя','Полная классификация — локальной 3D-модели нет','Фермионные шары, стерильная и тяжёлая нейтринная материя, нейтринные звёзды, тёмные фермионы, гравитино, фотино, аксино, преоны и технифермионы.'],
  'subquark-family':['Преонная и субкварковая материя','Полная классификация — локальной 3D-модели нет','Преонная плазма, субкварки, ришоны, хаплоны, составная материя, техницветовой конденсат и технобарионная материя.'],
  'monopole-family':['Магнитно заряженная материя','Полная классификация — локальной 3D-модели нет','Магнитные монополи, монопольная плазма и конденсат, монополиум и монопольные звёзды; дионная материя, плазма, конденсат и звёзды.'],
  'topological-defect-family':['Материя топологических дефектов','Полная классификация — локальной 3D-модели нет','Космические и сверхпроводящие струны, доменные стенки, монопольные сети, текстуры, полулокальные струны, vortons, космические ожерелья, QCD- и аксионные стенки, петли и сети дефектов.'],
  'negative-energy-family':['Отрицательная масса и энергия','Полная классификация — локальной 3D-модели нет','Отрицательная инертная и гравитационная масса, runaway-пары и жидкости; распределения энергии типа Казимира, фантомные и ghost-поля, нарушение NEC/WEC и материя для червоточин.'],
  'tachyon-family':['Тахионная материя','Полная классификация — локальной 3D-модели нет','Тахионные частицы, конденсаты и материя, rolling tachyon, тахионная тёмная энергия, тахионный вакуум и сверхсветовые конфигурации поля.'],
  'extra-dimension-family':['Материя дополнительных измерений','Полная классификация — локальной 3D-модели нет','Материя Калуцы—Клейна, bulk- и brane-материя, локализованные на бране частицы, радионы, KK-гравитоны, warped- и universal-extra-dimension формы, winding и momentum-моды.'],
  'quantum-gravity-family':['Струнная и квантово-гравитационная материя','Полная классификация — локальной 3D-модели нет','Струнная материя и газ, браны и D-браны, фундаментальные и космические суперструны, fuzzball, материя Планка и квантовой пены, спиновые сети, конденсаты петлевой квантовой гравитации, геоны и голографическая материя.'],
  'vacuum-cosmology-family':['Вакуумные и космологические формы','Полная классификация — локальной 3D-модели нет','Ложный и истинный вакуум, метастабильные домены и вакуумные конденсаты; тёмная энергия, квинтэссенция, k-essence, фантомная энергия, газ Чаплыгина, гравистары и инфлатонные поля.'],
  'antimatter-exotic-family':['Экзотические формы антиматерии','Полная классификация — локальной 3D-модели нет','Антизвёзды, антипланеты, антигалактики, антинейтронные и антикварковые звёзды, антистрэнджлеты, ещё не наблюдавшиеся антиядра, домены и самородки антиматерии.'],
  'compact-object-family':['Экзотические компактные объекты','Полная классификация — локальной 3D-модели нет','Бозонные, фермионные, Proca-, аксионные, кварковые, странные, гибридные, преонные, тёмные и зеркальные звёзды; гравистары, fuzzball, планковские, червоточинные, безгоризонтные и имитаторы чёрных дыр.'],
  'programmable-family':['Программируемая и информационная материя','Полная классификация — локальной 3D-модели нет','Программируемая, клейтронная, модульно-роботизированная, вычислительная и цифровая материя; умная пыль, utility fog, самосборка, самовосстановление, swarm-, neural- и квантово-программируемая материя.'],
  'metamatter-family':['Метаматерия','Полная классификация — локальной 3D-модели нет','Электромагнитные, отрицательно-преломляющие, гиперболические, акустические, механические, топологические, квантовые, пространственно-временные, неэрмитовы, программируемые, активные и самореконфигурируемые метаматериалы; гравитационные, нейтринные и слабовзаимодействующие варианты.'],
  'author-hypothesis-family':['Авторские гипотетические модели','Полная классификация — локальной 3D-модели нет','Программируемые атомы, нейтрино-чувствительная материя и нейтринные линзы, поляризационная и спин-программируемая материя, кварковые кристаллы, самособирающаяся странная материя, программируемые стрэнджлеты и информационно-связанная материя.']
};

export function setCatalogLocale(locale = 'en') {
  modelRegistry.forEach((model) => {
    const original = catalogOriginal.get(model.id);
    if (original) Object.assign(model, original);
    if (locale !== 'ru') return;
    const translated = russianExoticCatalog[model.id];
    if (translated) {
      model.title = translated[0]; model.subtitle = translated[1]; model.description = translated[2];
      if (translated[3]) model.applicability = translated[3];
      if (translated[4]) model.statusLabel = translated[4];
      model.applicability = model.visual === 'unavailable'
        ? 'Это справочная запись. Локальная визуализация не показана, пока для конкретной системы нет проверяемой научной модели.'
        : model.applicability;
    }
    if (model.status === 'catalog') model.statusLabel = 'ТОЛЬКО КАТАЛОГ';
    if (model.id === 'cosmicString') model.statusLabel = 'ЛОКАЛЬНОЙ 3D-МОДЕЛИ НЕТ';
  });
}

const standardParticleRegistry = [
  ['antiproton','baryon','Антипротон','Антибарион ūūd̄','ūūd̄','-1 e',['uBar','uBar','dBar']],
  ['antineutron','baryon','Антинейтрон','Антибарион ūd̄d̄','ūd̄d̄','0',['uBar','dBar','dBar']],
  ['antihyperon','baryon','Анти-лямбда-гиперон','Антибарион ūd̄s̄','ūd̄s̄','0',['uBar','dBar','sBar']],
  ['electron','lepton','Электрон','Заряженный лептон первого поколения','e⁻','-1 e','charged'],
  ['positron','lepton','Позитрон','Античастица электрона','e⁺','+1 e','charged',true],
  ['muon','lepton','Мюон','Заряженный лептон второго поколения','μ⁻','-1 e','charged'],
  ['antimuon','lepton','Антимюон','Античастица мюона','μ⁺','+1 e','charged',true],
  ['tau','lepton','Тау-лептон','Заряженный лептон третьего поколения','τ⁻','-1 e','charged'],
  ['antitau','lepton','Антитау','Античастица тау-лептона','τ⁺','+1 e','charged',true],
  ['electronNeutrino','lepton','Электронное нейтрино','Нейтрино первого поколения','νₑ','0','neutrino'],
  ['electronAntineutrino','lepton','Электронное антинейтрино','Античастица электронного нейтрино','ν̄ₑ','0','neutrino',true],
  ['muonNeutrino','lepton','Мюонное нейтрино','Нейтрино второго поколения','ν_μ','0','neutrino'],
  ['muonAntineutrino','lepton','Мюонное антинейтрино','Античастица мюонного нейтрино','ν̄_μ','0','neutrino',true],
  ['tauNeutrino','lepton','Тау-нейтрино','Нейтрино третьего поколения','ν_τ','0','neutrino'],
  ['tauAntineutrino','lepton','Тау-антинейтрино','Античастица тау-нейтрино','ν̄_τ','0','neutrino',true]
];

modelRegistry.push(...standardParticleRegistry.map(([id, family, title, subtitle, symbol, charge, kindOrComposition, antiparticle = false]) => {
  const baryon = Array.isArray(kindOrComposition);
  return {
    id, family, title, subtitle, status:'confirmed', statusLabel:'ЭКСПЕРИМЕНТАЛЬНО ПОДТВЕРЖДЕНО',
    description: baryon
      ? `${title} — составной антибарион. Его внутренняя цветовая структура в сцене показана схематически.`
      : `${title} — фундаментальный лептон Стандартной модели. Визуальный размер частицы условен и не является физическим размером.`,
    formula: baryon ? `Валентный состав: ${symbol}; заряд ${charge}` : `Заряд ${charge}; спин 1/2`,
    applicability: baryon
      ? 'Антибарионы наблюдаются в ускорительных экспериментах. Сцена показывает валентный состав, а не пространственную траекторию кварков.'
      : 'Лептонная идентичность и античастицы экспериментально подтверждены. Нейтринные массы и осцилляции требуют квантового описания, которое не сводится к этой иконке.',
    visual: baryon ? 'baryon' : 'lepton', composition: baryon ? kindOrComposition : undefined,
    leptonKind: baryon ? undefined : kindOrComposition, symbol: baryon ? undefined : symbol, antiparticle,
    interaction: baryon ? 'boson' : kindOrComposition === 'neutrino' ? 'weak' : 'photon', parameters: [],
    sources:[['PDG: Particle Physics Booklet','https://pdg.lbl.gov/']]
  };
}));

modelRegistry.push(
  { id:'sun', family:'macro', title:'Sun', subtitle:'G-type main-sequence star', status:'confirmed', statusLabel:'OBSERVED STAR', description:'A locally rendered solar sphere using the texture from NASA’s downloadable Sun USDZ asset, with a restrained corona for readability.', formula:'L = 4πR²σT_eff⁴', applicability:'Visual representation only; it is not a magnetohydrodynamic solar calculation.', visual:'macro', macroKind:'sun', interaction:'field', parameters:[{key:'temperature',label:'Photosphere temperature',unit:'K',min:3500,max:7500,step:50,value:5772},{key:'activity',label:'Magnetic activity',min:0,max:1,step:.01,value:.42}], sources:[['NASA Sun 3D model (USDZ source texture)','https://science.nasa.gov/learn/heat/resource/sun-3d-model/'],['NASA 3D Resources','https://github.com/nasa/NASA-3D-Resources']] },
  { id:'jupiter', family:'macro', title:'Jupiter', subtitle:'Gas giant — hydrogen/helium atmosphere', status:'confirmed', statusLabel:'OBSERVED PLANET', description:'NASA glTF model, stored locally in this laboratory with its original mesh and texture.', formula:'v_esc = √(2GM/R);  P(r) = ∫ρg dr', applicability:'Imported visual asset; this is not an atmospheric fluid simulation.', visual:'macro', macroKind:'jupiter', interaction:'field', parameters:[{key:'rotationPeriod',label:'Rotation period',unit:'h',min:7,max:14,step:.1,value:9.9},{key:'bandContrast',label:'Band contrast',min:0,max:1,step:.01,value:.65}], sources:[['NASA Jupiter 3D model (glTF download)','https://science.nasa.gov/resource/jupiter-3d-model/'],['NASA Eyes on the Solar System','https://science.nasa.gov/eyes/']] },
  { id:'blackHole', family:'macro', title:'Black hole', subtitle:'Educational 3D accretion-disk model', status:'confirmed', statusLabel:'OBSERVED COMPACT OBJECT', description:'A native 3D laboratory model: event horizon, photon ring, layered hot accretion disk, lensed secondary band, and bipolar jets. It replaces the former title-card image.', formula:'r_s = 2GM/c²;  ds² = −(1−r_s/r)c²dt² + (1−r_s/r)⁻¹dr² + r²dΩ²', applicability:'Physics-motivated explanatory rendering, not a general-relativistic ray-tracing or MHD run.', visual:'macro', macroKind:'blackHole', interaction:'gravity', parameters:[{key:'mass',label:'Mass',unit:'M☉',min:3,max:1000000,step:1,value:4300000},{key:'diskRadius',label:'Disk radius',unit:'r_s',min:2,max:14,step:.1,value:6}], sources:[['NASA SVS: Black Hole Accretion Disk Visualization','https://svs.gsfc.nasa.gov/13326/'],['NASA black-hole visualisation context','https://science.nasa.gov/universe/black-holes/supermassive-black-holes/new-nasa-black-hole-visualization-takes-viewers-beyond-the-brink/'],['CC-BY downloadable reference model — Sebastian Sosnowski','https://sketchfab.com/3d-models/black-hole-cfd16738ad2c402b9dc8e38a9c05c8d4']] },
  { id:'neutronStar', family:'macro', title:'Neutron star', subtitle:'Magnetised compact remnant', status:'confirmed', statusLabel:'OBSERVED COMPACT OBJECT', description:'Procedural representation of a rotating magnetised neutron star with polar emission cones. NASA supplies a data-derived 3D Crab Nebula resource powered by a pulsar.', formula:'M ≈ 1–2 M☉;  R ≈ 10–14 km;  B_p ∝ μ/R³', applicability:'Explanatory pulsar/magnetosphere view, not a numerical general-relativistic MHD solution.', visual:'macro', macroKind:'neutronStar', interaction:'field', parameters:[{key:'spinFrequency',label:'Spin frequency',unit:'Hz',min:.1,max:716,step:.1,value:30},{key:'magneticField',label:'Surface field',unit:'10¹² G',min:.01,max:1000,step:.01,value:1}], sources:[['NASA Crab Nebula 3D resource','https://science.nasa.gov/3d-resources/crab-nebula/'],['NASA NICER neutron-star science','https://science.nasa.gov/mission/nicer/']] }
);

// These records are appended after the original catalogue snapshot above.
// Register their English baseline and their complete Russian catalogue labels.
["sun", "jupiter", "blackHole", "neutronStar"].forEach((id) => {
  const model = modelRegistry.find((item) => item.id === id);
  catalogOriginal.set(id, { title: model.title, subtitle: model.subtitle, description: model.description, applicability: model.applicability, statusLabel: model.statusLabel });
});
Object.assign(russianExoticCatalog, {
  sun: ["Солнце", "Звезда главной последовательности класса G", "Локальная сфера Солнца с текстурой из загружаемой USDZ-модели NASA и сдержанной короной для наглядности."],
  jupiter: ["Юпитер", "Газовый гигант — атмосфера из водорода и гелия", "Локально встроенная glTF-модель NASA с исходной геометрией и текстурой."],
  blackHole: ["Чёрная дыра", "Учебная 3D-модель аккреционного диска", "Нативная 3D-модель лаборатории: горизонт событий, фотонное кольцо, слоистый горячий аккреционный диск, линзированная вторичная полоса и биполярные джеты. Она заменяет прежнюю картинку-заставку."],
  neutronStar: ["Нейтронная звезда", "Магнитизированный компактный остаток", "Процедурная модель вращающейся магнитизированной нейтронной звезды с полярными пучками; NASA публикует 3D-ресурс Крабовидной туманности, питаемой пульсаром."]
});

// Explicitly a project hypothesis. It borrows the language of effective non-Hermitian
// Hamiltonians, while its 4D geometry and particle interpretation are illustrative.
modelRegistry.push({
  id: "complexSpinQuasiparticle",
  family: "hypothetical",
  title: "4D complex-spin quasiparticle",
  subtitle: "PT-symmetric effective non-Hermitian projection",
  status: "hypothetical",
  statusLabel: "PROJECT HYPOTHESIS",
  description: "A hypothetical 4D quasiparticle rendered as its changing 3D slice. The real effective-spin response is drawn as precession; the imaginary response controls gain/loss-like breathing and phase displacement. It is not a claimed elementary particle or a prediction of a new physical state.",
  formula: "r₃ = √(R₄² − h²);  H_eff = Ω σ_z + iΓ σ_x + κh σ_y",
  applicability: "Non-Hermitian and PT-symmetric effective Hamiltonians are established tools for open systems. The interpretation as a 4D particle and the geometry shown here are an author-defined, educational hypothesis.",
  visual: "complexSpin",
  interaction: "field",
  parameters: [
    { key: "configuration", label: "Configuration", type: "select", value: "single", options: [["single", "4D quasiparticle: 3D slice"], ["lattice", "3D M-field region — 100 × 100 × 100 samples (sparse display)"]] },
    { key: "mMode", label: "Projection preset", type: "select", value: "phase", options: [["phase", "Phase-controlled projection"], ["scalar", "Scalar resonance — spin 0"], ["vector", "Vector resonance — spin 1"], ["tensor", "Tensor resonance — spin 2"], ["mixed", "Mixed projection"]] },
    { key: "iPhase", label: "i-phase φ", unit: "rad", min: 0, max: 6.283, step: .01, value: 0.52 },
    { key: "iCoupling", label: "i-coupling strength", min: 0, max: 1, step: .01, value: .72 },
    { key: "leakage", label: "Leakage Im(s)", min: 0, max: 1, step: .01, value: .18 },
    { key: "projectionCoherence", label: "Projection coherence", min: 0, max: 1, step: .01, value: .84 },
    { key: "probeType", label: "3D probe", type: "select", value: "photon", options: [["photon", "Photon — refraction / phase shift"], ["electron", "Electron — deflection"], ["neutrino", "Neutrino — phase delay"], ["atom", "Atom — energy-level shift"]] },
    { key: "projection", label: "Visible 3D axes", type: "select", value: "xyi", options: [["xyz", "X · Y · Z (hide i)"], ["xyi", "X · Y · i (hide z)"], ["xzi", "X · Z · i (hide y)"], ["yzi", "Y · Z · i (hide x)"]] },
    { key: "positionX", label: "4D position x", min: -3, max: 3, step: .01, value: 0 },
    { key: "positionY", label: "4D position y", min: -3, max: 3, step: .01, value: 0 },
    { key: "positionZ", label: "4D position z", min: -3, max: 3, step: .01, value: 0 },
    { key: "positionI", label: "4D position i", min: -3, max: 3, step: .01, value: 0 },
    { key: "precession", label: "Real-spin precession Ω", unit: "rad/s", min: .1, max: 3, step: .05, value: 1.1 },
    { key: "phaseOffset", label: "Complex phase φ", unit: "rad", min: 0, max: 6.28, step: .01, value: .6 }
  ],
  sources: [
    ["Non-Hermitian Physics — review", "https://arxiv.org/abs/2006.01837"],
    ["Continuous-spin particles — review", "https://arxiv.org/abs/1708.01030"]
  ]
});
const complexSpinModel = modelRegistry.find((model) => model.id === "complexSpinQuasiparticle");
catalogOriginal.set(complexSpinModel.id, { title: complexSpinModel.title, subtitle: complexSpinModel.subtitle, description: complexSpinModel.description, applicability: complexSpinModel.applicability, statusLabel: complexSpinModel.statusLabel });
russianExoticCatalog.complexSpinQuasiparticle = [
  "4D квазичастица с комплексным спином",
  "PT-симметричная эффективная неэрмитова проекция",
  "Гипотетическая 4D-квазичастица, показанная через изменяющийся 3D-срез. Реальная часть эффективного спина отображается прецессией, мнимая — пульсацией, фазовым сдвигом и неэрмитовым откликом. Это не заявленная элементарная частица и не предсказание нового состояния вещества.",
  "Неэрмитовы и PT-симметричные эффективные гамильтонианы применяются для открытых систем; трактовка объекта как 4D-частицы и его геометрия здесь являются авторской учебной гипотезой.",
  "АВТОРСКАЯ ГИПОТЕЗА"
];

// Geometric catalogue entry. The coordinates are rendered natively in the lab;
// it is an exact mathematical object, not a proposed physical particle.
modelRegistry.push({
  id: "tesseract4d",
  family: "hypothetical",
  title: "Tesseract (4D hypercube)",
  subtitle: "Interactive 4D projection and 3D-slice explorer",
  status: "catalog",
  statusLabel: "MATHEMATICAL OBJECT",
  description: "A tesseract is the four-dimensional analogue of a cube. Choose a full 4D perspective projection, or a physical 3D hyperplane slice: in slice mode the drawing disappears exactly when the selected 3D space no longer intersects the tesseract.",
  formula: "v ∈ {−1,+1}⁴;  32 edges;  R₄D = R_Zi R_Yi R_Xi",
  applicability: "This is an exact mathematical polytope, not a particle or a physical state of matter. The 3D-slice mode shows the true intersection of the tesseract's square faces with the selected visible space; projection mode is provided separately for geometric intuition.",
  visual: "polytope4d",
  interaction: "field",
  parameters: [
    { key: "tesseractMode", label: "Display mode", type: "select", value: "slice", options: [["slice", "3D slice — leaves visible space"], ["projection", "4D perspective projection"]] },
    { key: "projection", label: "Visible 3D axes", type: "select", value: "xyi", options: [["xyz", "X · Y · Z (hide i)"], ["xyi", "X · Y · i (hide z)"], ["xzi", "X · Z · i (hide y)"], ["yzi", "Y · Z · i (hide x)"]] },
    { key: "positionX", label: "4D position x", min: -1.2, max: 1.2, step: .01, value: 0 },
    { key: "positionY", label: "4D position y", min: -1.2, max: 1.2, step: .01, value: 0 },
    { key: "positionZ", label: "4D position z", min: -1.2, max: 1.2, step: .01, value: 0 },
    { key: "positionI", label: "4D position i", min: -1.2, max: 1.2, step: .01, value: 0 },
    { key: "rotationXi", label: "4D rotation X–i", unit: "rad", min: -3.14, max: 3.14, step: .01, value: .38 },
    { key: "rotationYi", label: "4D rotation Y–i", unit: "rad", min: -3.14, max: 3.14, step: .01, value: -.24 },
    { key: "rotationZi", label: "4D rotation Z–i", unit: "rad", min: -3.14, max: 3.14, step: .01, value: .18 }
  ],
  sources: [
    ["Tesseract Explorer — MIT source", "https://github.com/tsherif/tesseract-explorer"],
    ["four — 4D renderer and slicing reference (CC BY 4.0)", "https://github.com/mwalczyk/four"]
  ]
});
const tesseractModel = modelRegistry.find((model) => model.id === "tesseract4d");
catalogOriginal.set(tesseractModel.id, { title: tesseractModel.title, subtitle: tesseractModel.subtitle, description: tesseractModel.description, applicability: tesseractModel.applicability, statusLabel: tesseractModel.statusLabel });
russianExoticCatalog.tesseract4d = [
  "Тессеракт (4D-гиперкуб)",
  "Интерактивная каркасная 4D→3D-проекция",
  "Тессеракт — четырёхмерный аналог куба. Нативная модель лаборатории проецирует его 16 вершин и 32 ребра в выбранную тройку видимых осей; геометрия пересчитывается при повороте в четырёхмерном пространстве.",
  "Это точный математический многогранник, а не частица и не состояние вещества. Отображение является учебной перспективной проекцией, вычисленной из 4D-координат.",
  "МАТЕМАТИЧЕСКИЙ ОБЪЕКТ"
];

export const families = [
  ["exotic", "Exotic matter"],
  ["all", "Все"],
  ["ordinary", "Обычная"],
  ["hypothetical", "Мои гипотезы"],
  ["dense", "Плотная"],
  ["quark", "QGP"],
  ["meson", "Мезоны"],
  ["collider", "Коллайдер"],
  ["strange", "Странная"],
  ["macro", "Macro objects"]
];
