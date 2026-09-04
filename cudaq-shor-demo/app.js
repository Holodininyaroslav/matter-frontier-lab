(() => {
  "use strict";
  const T=(en,ru,he)=>({en,ru,he});

  const interactiveCopy={
    en:{workbenchEyebrow:"LIVE IDEAL-CIRCUIT WALKTHROUGH",workbenchTitle:"Follow eight qubits from |1⟩ to the factors 3 and 5.",simulatorBadge:"browser explanation · CUDA-Q source below",run:"▶ Run",pause:"Ⅱ Pause",step:"Next step",reset:"Reset",measurementEyebrow:"IDEAL MEASUREMENT",measurementTitle:"Phase-estimation outcomes",measurementText:"For r=4 and a four-qubit control register, the noiseless distribution has four exact peaks. A physical QPU would broaden and distort them."},
    ru:{workbenchEyebrow:"ИНТЕРАКТИВНЫЙ РАЗБОР ИДЕАЛЬНОЙ СХЕМЫ",workbenchTitle:"Проследите восемь кубитов от |1⟩ до множителей 3 и 5.",simulatorBadge:"объяснение в браузере · исходник CUDA-Q ниже",run:"▶ Запустить",pause:"Ⅱ Пауза",step:"Следующий этап",reset:"Сброс",measurementEyebrow:"ИДЕАЛЬНОЕ ИЗМЕРЕНИЕ",measurementTitle:"Результаты оценки фазы",measurementText:"При r=4 и четырёх управляющих кубитах идеальное распределение имеет четыре точных пика. На физическом QPU шум расширит и исказит их."},
    he:{workbenchEyebrow:"פירוט אינטראקטיבי של המעגל האידיאלי",workbenchTitle:"מעקב אחר שמונה קיוביטים מ-|1⟩ אל הגורמים 3 ו-5.",simulatorBadge:"הסבר בדפדפן · קוד CUDA-Q בהמשך",run:"▶ הרצה",pause:"Ⅱ השהיה",step:"השלב הבא",reset:"איפוס",measurementEyebrow:"מדידה אידיאלית",measurementTitle:"תוצאות אמידת הפאזה",measurementText:"עבור r=4 ורגיסטר בקרה של ארבעה קיוביטים, להתפלגות חסרת רעש ארבעה שיאים מדויקים. QPU פיזי ירחיב ויעוות אותם."}
  };

  const walkthrough=[
    {title:T("Prepare the registers","Подготовка регистров","הכנת הרגיסטרים"),text:T("Four control qubits start in |0000⟩. The four-qubit work register stores |0001⟩, the multiplicative identity modulo 15.","Четыре управляющих кубита начинаются в |0000⟩. Рабочий четырёхкубитный регистр хранит |0001⟩ — мультипликативную единицу по модулю 15.","ארבעת קיוביטי הבקרה מתחילים ב-|0000⟩. רגיסטר העבודה בן ארבעת הקיוביטים שומר |0001⟩, יחידת הכפל מודולו 15."),formula:"|0⟩⁴ |1⟩"},
    {title:T("Create superposition","Создание суперпозиции","יצירת סופרפוזיציה"),text:T("Hadamard gates put the control register into an equal superposition of all 16 exponents x.","Вентили Адамара переводят управляющий регистр в равную суперпозицию всех 16 показателей x.","שערי הדמר מעבירים את רגיסטר הבקרה לסופרפוזיציה אחידה של כל 16 המעריכים x."),formula:"H⊗⁴|0000⟩ = ¼ Σₓ₌₀¹⁵ |x⟩"},
    {title:T("Compute modular powers","Вычисление модульных степеней","חישוב חזקות מודולריות"),text:T("Controlled cyclic bit rotations implement U|y⟩=|2y mod 15⟩. The control register becomes correlated with 2ˣ mod 15 without measuring x.","Управляемые циклические перестановки битов реализуют U|y⟩=|2y mod 15⟩. Управляющий регистр коррелируется с 2ˣ mod 15 без измерения x.","סיבובי ביטים מחזוריים מבוקרים מממשים U|y⟩=|2y mod 15⟩. רגיסטר הבקרה נקשר ל-2ˣ mod 15 בלי למדוד את x."),formula:"|x⟩|1⟩ → |x⟩|2ˣ mod 15⟩"},
    {title:T("Apply inverse QFT","Применение обратного QFT","הפעלת QFT הפוך"),text:T("The inverse quantum Fourier transform converts periodic phase relationships into computational-basis peaks separated by 16/r.","Обратное квантовое преобразование Фурье превращает периодические фазовые соотношения в пики вычислительного базиса с шагом 16/r.","התמרת פורייה הקוונטית ההפוכה ממירה יחסי פאזה מחזוריים לשיאים בבסיס החישובי בהפרש 16/r."),formula:"QFT⁻¹ → y ∈ {0,4,8,12}"},
    {title:T("Measure the phase register","Измерение регистра фазы","מדידת רגיסטר הפאזה"),text:T("Repeated shots reveal the peaks. Continued fractions map a non-zero phase y/16 to an order candidate r=4, verified by 2⁴ mod 15 = 1.","Повторные измерения выявляют пики. Цепные дроби переводят ненулевую фазу y/16 в кандидат r=4, проверяемый равенством 2⁴ mod 15 = 1.","מדידות חוזרות חושפות את השיאים. שברים משולבים ממפים פאזה לא-אפס y/16 למועמד r=4, המאומת ב-2⁴ mod 15 = 1."),formula:"r = 4; 2⁴ ≡ 1 (mod 15)"},
    {title:T("Recover factors on the CPU","Восстановление множителей на CPU","שחזור הגורמים ב-CPU"),text:T("The quantum kernel returns an order, not the factors directly. Classical GCD post-processing converts the even order into the two non-trivial divisors.","Квантовое ядро возвращает порядок, а не сами множители. Классическая GCD-постобработка превращает чётный порядок в два нетривиальных делителя.","הליבה הקוונטית מחזירה סדר, לא את הגורמים ישירות. עיבוד GCD קלאסי ממיר את הסדר הזוגי לשני המחלקים הלא-טריוויאליים."),formula:"gcd(2²−1,15)=3; gcd(2²+1,15)=5"}
  ];

  let interactiveLanguage="en";
  let walkthroughStep=0;
  let walkthroughTimer=null;

  const loc=value=>typeof value==="string"?value:(value?.[interactiveLanguage]||value?.en||"");

  function circuitGate(label,step,extra=""){
    return label?`<span class="gate ${extra}" data-circuit-step="${step}">${label}</span>`:"<span></span>";
  }

  function buildCircuit(){
    const root=document.querySelector("#shorCircuit");
    if(!root||root.dataset.ready) return;
    const rows=[];
    for(let q=0;q<8;q++){
      const control=q<4;
      const gates=[
        circuitGate(q===4?"X":"",0),
        circuitGate(control?"H":"",1),
        circuitGate(q===0?"●":q===1?"●":!control?"U":"",2,q<2?"control":"modular"),
        circuitGate(control?"QFT⁻¹":"",3,"qft"),
        circuitGate(control?"M":"",4,"measure"),
        "<span></span>"
      ].join("");
      rows.push(`<div class="qubit-wire"><span class="qubit-label">q${q} <i class="qubit-state">|${q===4?1:0}⟩</i></span>${gates}</div>`);
    }
    root.innerHTML=`<span class="register-tag control">CONTROL · 4 QUBITS</span><span class="register-tag work">WORK · 4 QUBITS</span><i class="register-divider"></i>${rows.join("")}`;
    root.dataset.ready="true";
  }

  function idealDistribution(){
    const probabilities=new Array(16).fill(0);
    [0,4,8,12].forEach(index=>{probabilities[index]=.25});
    return probabilities;
  }

  function buildHistogram(){
    const root=document.querySelector("#phaseHistogram");
    if(!root||root.dataset.ready) return;
    root.innerHTML=idealDistribution().map((probability,index)=>`<span class="phase-bar ${probability?"peak":""}" data-phase="${index}" data-probability="${probability}"><i style="height:2px"></i><b>${index.toString(2).padStart(4,"0")}</b></span>`).join("");
    root.dataset.ready="true";
  }

  function updateWalkthrough(){
    const step=walkthrough[walkthroughStep];
    document.querySelector("#shorStepKicker").textContent=`${String(walkthroughStep+1).padStart(2,"0")} / 06`;
    document.querySelector("#shorStepTitle").textContent=loc(step.title);
    document.querySelector("#shorStepText").textContent=loc(step.text);
    document.querySelector("#shorFormula").textContent=step.formula;
    document.querySelectorAll("[data-circuit-step]").forEach(gate=>gate.classList.toggle("active",Number(gate.dataset.circuitStep)===walkthroughStep));
    document.querySelectorAll("[data-walkthrough-step]").forEach(button=>button.classList.toggle("active",Number(button.dataset.walkthroughStep)===walkthroughStep));
    const reveal=walkthroughStep>=4;
    const factors=walkthroughStep>=5;
    document.querySelectorAll(".phase-bar").forEach(bar=>{
      const probability=Number(bar.dataset.probability);
      bar.querySelector("i").style.height=reveal?`${Math.max(2,probability*500)}px`:"2px";
      bar.classList.toggle("revealed",factors&&probability>0);
    });
    document.querySelector("#orderValue").textContent=reveal?"4":"?";
    document.querySelector("#factorValue").textContent=factors?"3 × 5":"? × ?";
  }

  function stopWalkthrough(){
    if(walkthroughTimer){clearInterval(walkthroughTimer);walkthroughTimer=null}
    const copy=interactiveCopy[interactiveLanguage]||interactiveCopy.en;
    const run=document.querySelector("#shorRun");
    if(run) run.textContent=copy.run;
  }

  function renderInteractive(language){
    interactiveLanguage=language;
    const copy=interactiveCopy[language]||interactiveCopy.en;
    document.querySelectorAll("[data-shor-copy]").forEach(el=>el.textContent=copy[el.dataset.shorCopy]||"");
    buildCircuit();buildHistogram();
    const rail=document.querySelector("#shorStageRail");
    rail.innerHTML=walkthrough.map((step,index)=>`<button type="button" data-walkthrough-step="${index}">${String(index+1).padStart(2,"0")} · ${loc(step.title)}</button>`).join("");
    rail.querySelectorAll("[data-walkthrough-step]").forEach(button=>button.addEventListener("click",()=>{stopWalkthrough();walkthroughStep=Number(button.dataset.walkthroughStep);updateWalkthrough()}));
    const run=document.querySelector("#shorRun"),next=document.querySelector("#shorStep"),reset=document.querySelector("#shorReset");
    run.textContent=walkthroughTimer?copy.pause:copy.run;next.textContent=copy.step;reset.textContent=copy.reset;
    if(!run.dataset.ready){
      run.addEventListener("click",()=>{
        if(walkthroughTimer){stopWalkthrough();return}
        run.textContent=(interactiveCopy[interactiveLanguage]||interactiveCopy.en).pause;
        if(walkthroughStep===walkthrough.length-1) walkthroughStep=0;
        updateWalkthrough();
        walkthroughTimer=setInterval(()=>{if(walkthroughStep>=walkthrough.length-1){stopWalkthrough();return}walkthroughStep+=1;updateWalkthrough()},850);
      });
      next.addEventListener("click",()=>{stopWalkthrough();walkthroughStep=(walkthroughStep+1)%walkthrough.length;updateWalkthrough()});
      reset.addEventListener("click",()=>{stopWalkthrough();walkthroughStep=0;updateWalkthrough()});
      run.dataset.ready=next.dataset.ready=reset.dataset.ready="true";
    }
    updateWalkthrough();
  }

  window.INSPECTOR_CONFIG={
    copy:{
      en:{documentTitle:"Shor on CUDA-Q · Matter Frontier Lab",eyebrow:"OPEN CUDA-Q · EXECUTABLE TEACHING CIRCUIT",title:"Shor's algorithm, from eight qubits to the factors of 15.",intro:"This first hybrid demonstration follows NVIDIA's open CUDA-Q implementation pattern while using a compact, mathematically clean N=15, a=2 circuit. Animate the ideal circuit, inspect every source line, then run the same versioned Python kernel on a supported CUDA-Q CPU/GPU simulator or configured QPU.",flowTitle:"Click the hybrid Shor pipeline to inspect its exact code",flowIntro:"Only order finding is quantum. Input checks, continued fractions, validation and GCD factor recovery remain explicit classical stages." ,architectureTitle:"One algorithm, two compute domains",stagesTitle:"Open the runnable CUDA-Q implementation",sourcesTitle:"Executable source and provenance",boundaryTitle:"What this demonstration actually proves"},
      ru:{documentTitle:"Алгоритм Шора на CUDA-Q · Matter Frontier Lab",eyebrow:"ОТКРЫТЫЙ CUDA-Q · ИСПОЛНЯЕМАЯ УЧЕБНАЯ СХЕМА",title:"Алгоритм Шора: от восьми кубитов до множителей числа 15.",intro:"Первая гибридная демонстрация следует архитектуре открытой реализации NVIDIA CUDA-Q, используя компактную и математически чистую схему N=15, a=2. Запустите анимацию идеальной схемы, разберите каждую строку, затем выполните тот же версионируемый Python-код на поддерживаемом CUDA-Q CPU/GPU-симуляторе или настроенном QPU.",flowTitle:"Нажмите на узел гибридного конвейера Шора",flowIntro:"Квантовым является только нахождение порядка. Проверки входа, цепные дроби, валидация и восстановление множителей через GCD остаются явными классическими этапами.",architectureTitle:"Один алгоритм — две вычислительные области",stagesTitle:"Откройте запускаемую реализацию CUDA-Q",sourcesTitle:"Исполняемый код и происхождение",boundaryTitle:"Что в действительности подтверждает демонстрация"},
      he:{documentTitle:"אלגוריתם שור ב-CUDA-Q · Matter Frontier Lab",eyebrow:"CUDA-Q פתוח · מעגל לימודי ניתן להרצה",title:"אלגוריתם שור: משמונה קיוביטים אל הגורמים של 15.",intro:"ההדגמה ההיברידית הראשונה עוקבת אחר מבנה המימוש הפתוח של NVIDIA CUDA-Q ומשתמשת במעגל קומפקטי ונקי מתמטית N=15,a=2. הפעילו את אנימציית המעגל האידיאלי, בדקו כל שורת קוד ולאחר מכן הריצו את אותה ליבת Python על סימולטור CPU/GPU נתמך או QPU מוגדר.",flowTitle:"לחצו על צינור שור ההיברידי כדי לבדוק את הקוד",flowIntro:"רק מציאת הסדר היא קוונטית. בדיקות קלט, שברים משולבים, אימות ושחזור גורמים באמצעות GCD נשארים שלבים קלאסיים מפורשים.",architectureTitle:"אלגוריתם אחד, שני תחומי חישוב",stagesTitle:"פתיחת מימוש CUDA-Q הניתן להרצה",sourcesTitle:"קוד בר-הרצה ומקור",boundaryTitle:"מה ההדגמה באמת מוכיחה"}
    },
    renderInteractive,
    flow:{columns:5,rows:3,lanes:[{row:1,kind:"reference",title:T("CLASSICAL HOST","КЛАССИЧЕСКИЙ HOST","מארח קלאסי")},{row:2,kind:"parallel",title:T("CUDA-Q QUANTUM KERNEL","КВАНТОВОЕ ЯДРО CUDA-Q","ליבת CUDA-Q קוונטית")}],nodes:[
      {id:"input",stage:0,column:1,row:1,title:T("Check N and a","Проверить N и a","בדיקת N ו-a"),caption:T("N=15 · a=2","N=15 · a=2","N=15 · a=2"),kind:"reference"},
      {id:"prepare",stage:3,column:1,row:2,title:T("Prepare 8 qubits","Подготовить 8 кубитов","הכנת 8 קיוביטים"),caption:T("4 control + 4 work","4 управляющих + 4 рабочих","4 בקרה + 4 עבודה"),kind:"parallel"},
      {id:"modexp",stage:2,column:2,row:2,title:T("Controlled modular powers","Управляемые модульные степени","חזקות מודולריות מבוקרות"),caption:T("2ˣ mod 15","2ˣ mod 15","2ˣ mod 15"),kind:"parallel"},
      {id:"qft",stage:1,column:3,row:2,title:T("Inverse QFT","Обратное QFT","QFT הפוך"),caption:T("phase → peaks","фаза → пики","פאזה → שיאים"),kind:"parallel"},
      {id:"sample",stage:4,column:4,row:2,title:T("Sample control register","Измерить управляющий регистр","דגימת רגיסטר הבקרה"),caption:T("counts → r","counts → r","ספירות → r"),kind:"parallel"},
      {id:"gcd",stage:5,column:5,row:1,title:T("Recover 3 and 5","Получить 3 и 5","שחזור 3 ו-5"),caption:T("continued fractions + GCD","цепные дроби + GCD","שברים משולבים + GCD"),kind:"reference"}
    ],edges:[
      {from:"input",to:"prepare",kind:"reference",label:T("validated input","проверенный вход","קלט מאומת")},{from:"prepare",to:"modexp",kind:"runtime"},{from:"modexp",to:"qft",kind:"runtime"},{from:"qft",to:"sample",kind:"runtime"},{from:"sample",to:"gcd",kind:"reference",label:T("measured phases","измеренные фазы","פאזות נמדדות")}
    ],note:T("The browser animation visualises the ideal distribution. The versioned Python file is the executable CUDA-Q boundary; a GPU target simulates qubits, while a configured provider target submits to a physical QPU.","Браузерная анимация показывает идеальное распределение. Версионируемый Python-файл является исполняемой границей CUDA-Q: GPU-таргет моделирует кубиты, а настроенный provider-таргет отправляет задачу на физический QPU.","אנימציית הדפדפן מציגה התפלגות אידיאלית. קובץ Python המנוהל בגרסאות הוא גבול CUDA-Q הניתן להרצה: יעד GPU מדמה קיוביטים, ויעד ספק מוגדר שולח ל-QPU פיזי.")},
    status:[
      {title:T("Open implementation","Открытая реализация","מימוש פתוח"),text:T("CUDA-Q is Apache-2.0; the adapted project kernel is versioned and inspectable.","CUDA-Q распространяется по Apache-2.0; адаптированное ядро проекта версионируется и доступно для проверки.","CUDA-Q הוא Apache-2.0; ליבת הפרויקט המותאמת מנוהלת בגרסאות וניתנת לבדיקה.")},
      {title:T("Real execution boundary","Реальная граница исполнения","גבול הרצה אמיתי"),text:T("qpp-cpu and nvidia are simulators. Provider targets require credentials and access to a physical QPU.","qpp-cpu и nvidia — симуляторы. Provider-таргеты требуют учётных данных и доступа к физическому QPU.","qpp-cpu ו-nvidia הם סימולטורים. יעדי ספק דורשים הרשאות וגישה ל-QPU פיזי.")},
      {title:T("Honest scale","Честный масштаб","קנה מידה כן"),text:T("The modular circuit is compiled for 15; it does not claim useful RSA factorisation.","Модульная схема скомпилирована для 15 и не выдаётся за практическую факторизацию RSA.","המעגל המודולרי מהודר עבור 15 ואינו טוען לפירוק RSA שימושי.")}
    ],
    architecture:[
      {title:T("Host input","Host-вход","קלט מארח"),text:T("Validate coprimality and choose the compiled teaching case.","Проверить взаимную простоту и выбрать скомпилированный учебный случай.","אימות זרות ובחירת המקרה הלימודי המהודר.")},
      {title:T("Quantum registers","Квантовые регистры","רגיסטרים קוונטיים"),text:T("Encode exponents and modular values in four qubits each.","Закодировать показатели и модульные значения четырьмя кубитами каждый.","קידוד מעריכים וערכים מודולריים בארבעה קיוביטים כל אחד.")},
      {title:T("Order finding","Нахождение порядка","מציאת סדר"),text:T("Controlled modular powers and inverse QFT expose periodicity.","Управляемые модульные степени и обратное QFT выявляют периодичность.","חזקות מודולריות מבוקרות ו-QFT הפוך חושפים מחזוריות.")},
      {title:T("Host recovery","Host-восстановление","שחזור מארח"),text:T("Continued fractions, modular verification and GCD return factors.","Цепные дроби, модульная проверка и GCD возвращают множители.","שברים משולבים, אימות מודולרי ו-GCD מחזירים גורמים.")}
    ],
    stages:[
      {kicker:T("01 · HOST MATHEMATICS","01 · HOST-МАТЕМАТИКА","01 · מתמטיקת מארח"),title:T("Verify order and factor recovery","Проверка порядка и восстановления множителей","אימות סדר ושחזור גורמים"),summary:T("The deterministic preview establishes the expected r=4, checks the even-order condition and obtains 3 and 5 without claiming a quantum run.","Детерминированный preview устанавливает ожидаемый r=4, проверяет чётность порядка и получает 3 и 5, не выдавая это за квантовый запуск.","התצוגה המקדימה הדטרמיניסטית קובעת r=4, בודקת סדר זוגי ומקבלת 3 ו-5 בלי לטעון להרצה קוונטית."),source:"../scientific_backend/cudaq_shor_demo.py",sourceLabel:T("CUDA-Q Python source","Исходник CUDA-Q Python","קוד Python של CUDA-Q"),start:"def classical_order",end:"if cudaq is not None",substeps:[{title:T("Find expected order","Найти ожидаемый порядок","מציאת הסדר הצפוי"),start:"def classical_order",end:"def recover_factors"},{title:T("GCD boundary","Граница GCD","גבול GCD"),start:"def recover_factors",end:"if cudaq is not None"}],notes:[{contains:"gcd(a, modulus)",text:T("Rejects an invalid base before allocating any qubits.","Отклоняет неверное основание до выделения кубитов.","דוחה בסיס לא תקין לפני הקצאת קיוביטים.")},{contains:"pow(a, order // 2, modulus)",text:T("Computes the modular square root used by Shor's classical post-processing.","Вычисляет модульный корень, используемый классической постобработкой Шора.","מחשב את השורש המודולרי המשמש בעיבוד הקלאסי של שור.")}]},
      {kicker:T("02 · FOURIER KERNEL","02 · ЯДРО ФУРЬЕ","02 · ליבת פורייה"),title:T("Build QFT and its adjoint","Построение QFT и сопряжённого ядра","בניית QFT והצמוד שלו"),summary:T("CUDA-Q composes Hadamard and controlled phase rotations, then generates inverse QFT with an adjoint operation.","CUDA-Q собирает вентили Адамара и управляемые фазовые повороты, затем создаёт обратное QFT операцией adjoint.","CUDA-Q מרכיב שערי הדמר וסיבובי פאזה מבוקרים, ואז יוצר QFT הפוך באמצעות adjoint."),source:"../scientific_backend/cudaq_shor_demo.py",sourceLabel:T("Fourier kernels","Ядра Фурье","ליבות פורייה"),start:"def quantum_fourier_transform",end:"def multiply_by_2_mod_15",substeps:[{title:T("Forward QFT","Прямое QFT","QFT קדמי"),start:"def quantum_fourier_transform",end:"def inverse_qft"},{title:T("Adjoint","Сопряжение","צמוד"),start:"def inverse_qft",end:"def multiply_by_2_mod_15"}],notes:[{contains:"cr1(angle",text:T("Adds the controlled relative phases read by phase estimation.","Добавляет управляемые относительные фазы для оценки фазы.","מוסיף פאזות יחסיות מבוקרות הנקראות באמידת פאזה.")},{contains:"cudaq.adjoint",text:T("Asks CUDA-Q to invert the unitary instead of maintaining a second hand-written circuit.","Поручает CUDA-Q обратить унитарный оператор вместо второй ручной схемы.","מבקש מ-CUDA-Q להפוך את האופרטור היוניטרי במקום לתחזק מעגל ידני נוסף.")}]},
      {kicker:T("03 · MODULAR ARITHMETIC","03 · МОДУЛЬНАЯ АРИФМЕТИКА","03 · אריתמטיקה מודולרית"),title:T("Compile multiplication modulo 15","Компиляция умножения по модулю 15","הידור כפל מודולו 15"),summary:T("For the fixed N=15 case, reversible cyclic bit rotations implement multiplication by 2 and 4 without a large generic arithmetic circuit.","Для фиксированного N=15 обратимые циклические перестановки реализуют умножение на 2 и 4 без крупной универсальной арифметической схемы.","במקרה הקבוע N=15, סיבובי ביטים הפיכים מממשים כפל ב-2 וב-4 ללא מעגל אריתמטי כללי גדול."),source:"../scientific_backend/cudaq_shor_demo.py",sourceLabel:T("Modular kernels","Модульные ядра","ליבות מודולריות"),start:"def multiply_by_2_mod_15",end:"def shor_order_finding",substeps:[{title:T("Multiply by 2","Умножение на 2","כפל ב-2"),start:"def multiply_by_2_mod_15",end:"def multiply_by_4_mod_15"},{title:T("Controlled powers","Управляемые степени","חזקות מבוקרות"),start:"def multiply_by_4_mod_15",end:"def shor_order_finding"}],notes:[{contains:"swap(work[3], work[2])",text:T("Begins a reversible cyclic permutation of the four encoded bits.","Начинает обратимую циклическую перестановку четырёх кодирующих битов.","מתחיל תמורה מחזורית הפיכה של ארבעת הביטים המקודדים.")},{contains:"U^4 is identity",text:T("Uses the known compiled-case order to omit two identity-controlled blocks; this is why the circuit is not general.","Использует известный порядок скомпилированного случая, убирая два единичных блока; поэтому схема не универсальна.","משתמש בסדר הידוע של המקרה המהודר כדי להשמיט שני בלוקי זהות; לכן המעגל אינו כללי.")}]},
      {kicker:T("04 · ORDER FINDING","04 · НАХОЖДЕНИЕ ПОРЯДКА","04 · מציאת סדר"),title:T("Assemble and measure eight qubits","Сборка и измерение восьми кубитов","הרכבה ומדידה של שמונה קיוביטים"),summary:T("The entry-point kernel allocates both registers, prepares |1>, creates the exponent superposition, computes modular powers, applies inverse QFT and measures only the control register.","Входное ядро выделяет оба регистра, готовит |1>, создаёт суперпозицию показателей, вычисляет модульные степени, применяет обратное QFT и измеряет только управляющий регистр.","ליבת הכניסה מקצה את שני הרגיסטרים, מכינה |1>, יוצרת סופרפוזיציית מעריכים, מחשבת חזקות מודולריות, מפעילה QFT הפוך ומודדת רק את רגיסטר הבקרה."),source:"../scientific_backend/cudaq_shor_demo.py",sourceLabel:T("Order-finding kernel","Ядро нахождения порядка","ליבת מציאת סדר"),start:"def shor_order_finding",end:"def _counts_dictionary",substeps:[{title:T("Allocate registers","Выделить регистры","הקצאת רגיסטרים"),start:"def shor_order_finding",end:"x(work[0])"},{title:T("Quantum pipeline","Квантовый конвейер","צינור קוונטי"),start:"x(work[0])",end:"def _counts_dictionary"}],notes:[{contains:"h(exponent)",text:T("Creates all exponent candidates coherently rather than looping over classical x values.","Когерентно создаёт все показатели вместо классического перебора x.","יוצר את כל מועמדי המעריך קוהרנטית במקום לולאה קלאסית על x.")},{contains:"mz(exponent)",text:T("Measures only the phase register; the work register is not needed by classical recovery.","Измеряет только регистр фазы; рабочий регистр не нужен классическому восстановлению.","מודד רק את רגיסטר הפאזה; רגיסטר העבודה אינו נדרש לשחזור הקלאסי.")}]},
      {kicker:T("05 · PHASE RECOVERY","05 · ВОССТАНОВЛЕНИЕ ФАЗЫ","05 · שחזור פאזה"),title:T("Convert shot counts into a verified order","Преобразование измерений в проверенный порядок","המרת ספירות לסדר מאומת"),summary:T("The host sorts measured bit strings, approximates phases with continued fractions, and accepts a denominator multiple only after modular verification.","Host сортирует измеренные строки, аппроксимирует фазы цепными дробями и принимает кратное знаменателя только после модульной проверки.","המארח ממיין מחרוזות מדודות, מקרב פאזות בשברים משולבים ומקבל כפולה של המכנה רק לאחר אימות מודולרי."),source:"../scientific_backend/cudaq_shor_demo.py",sourceLabel:T("Phase post-processing","Постобработка фазы","עיבוד פאזה"),start:"def infer_order",end:"def select_target",substeps:[{title:T("Rank measurements","Ранжировать измерения","דירוג מדידות"),start:"def infer_order",end:"fraction ="},{title:T("Verify period","Проверить период","אימות מחזור"),start:"fraction =",end:"def select_target"}],notes:[{contains:"Fraction(",text:T("Builds the continued-fraction approximation through Python's exact rational type.","Строит цепно-дробную аппроксимацию через точный рациональный тип Python.","בונה קירוב שבר משולב באמצעות טיפוס רציונלי מדויק של Python.")},{contains:"pow(a, candidate, modulus) == 1",text:T("Prevents an attractive histogram peak from being accepted as an invalid order.","Не позволяет принять красивый пик гистограммы как неверный порядок.","מונע משיא מושך בהיסטוגרמה להתקבל כסדר שגוי.")}]},
      {kicker:T("06 · EXECUTION TARGET","06 · СРЕДА ИСПОЛНЕНИЯ","06 · יעד הרצה"),title:T("Select CPU, GPU simulator, or configured QPU","Выбор CPU, GPU-симулятора или настроенного QPU","בחירת CPU, סימולטור GPU או QPU מוגדר"),summary:T("The runner records the selected CUDA-Q target, samples the actual kernel and returns counts, order, factors and the compiled-case limitation together.","Runner фиксирует выбранный таргет CUDA-Q, измеряет реальное ядро и вместе возвращает counts, порядок, множители и ограничение скомпилированного случая.","ה-runner מתעד את יעד CUDA-Q, דוגם את הליבה בפועל ומחזיר יחד ספירות, סדר, גורמים ומגבלת המקרה המהודר."),source:"../scientific_backend/cudaq_shor_demo.py",sourceLabel:T("Runner and provenance","Runner и provenance","runner ו-provenance"),start:"def select_target",end:"def preview",substeps:[{title:T("Target selection","Выбор таргета","בחירת יעד"),start:"def select_target",end:"def run_quantum"},{title:T("Sample + report","Измерить и отчитаться","דגימה ודיווח"),start:"def run_quantum",end:"def preview"}],notes:[{contains:"num_available_gpus",text:T("Chooses NVIDIA state-vector simulation only when CUDA-Q can actually see a compatible GPU.","Выбирает NVIDIA state-vector simulation только когда CUDA-Q действительно видит совместимый GPU.","בוחר סימולציית וקטור מצב של NVIDIA רק כאשר CUDA-Q מזהה GPU תואם.")},{contains:"scientificBoundary",text:T("Carries the non-general compiled-circuit limitation in the machine-readable result.","Переносит ограничение неуниверсальной схемы в машинно-читаемый результат.","נושא את מגבלת המעגל המהודר הלא-כללי בתוצאה קריאת-מכונה.")}]}
    ],
    sources:[
      {title:T("Runnable project implementation","Запускаемая реализация проекта","מימוש הפרויקט הניתן להרצה"),text:T("CUDA-Q kernel, classical preview, target selection, phase recovery and explicit provenance.","Ядро CUDA-Q, классический preview, выбор таргета, восстановление фазы и явный provenance.","ליבת CUDA-Q, תצוגה קלאסית, בחירת יעד, שחזור פאזה ו-provenance מפורש."),path:"../scientific_backend/cudaq_shor_demo.py"},
      {title:T("Design and upstream references","Архитектура и первичные источники","תכנון ומקורות ראשוניים"),text:T("Execution commands, NVIDIA CUDA-Q tutorial, repository licence and Shor's original paper.","Команды запуска, руководство NVIDIA CUDA-Q, лицензия репозитория и оригинальная статья Шора.","פקודות הרצה, מדריך NVIDIA CUDA-Q, רישיון המאגר והמאמר המקורי של שור."),path:"../docs/cudaq-shor-demo.md"}
    ],
    boundary:T("The executable quantum circuit is a compiled eight-qubit teaching case for N=15 and a=2. The browser runs an ideal explanatory probability model; it does not execute CUDA-Q or contact a QPU. Running the Python file with the nvidia target performs a classical state-vector simulation on a supported NVIDIA GPU. Only an explicitly configured provider target executes on physical quantum hardware. None of these small demonstrations factors a cryptographic RSA modulus or demonstrates quantum advantage.","Исполняемая квантовая схема — скомпилированный восьмикубитный учебный случай для N=15 и a=2. Браузер выполняет идеальную объясняющую вероятностную модель, а не CUDA-Q и не обращение к QPU. Запуск Python-файла с таргетом nvidia выполняет классическую state-vector симуляцию на поддерживаемой NVIDIA GPU. Только явно настроенный provider-таргет исполняется на физическом квантовом оборудовании. Ни одна из этих малых демонстраций не факторизует криптографический модуль RSA и не показывает квантовое преимущество.","המעגל הקוונטי הניתן להרצה הוא מקרה לימודי מהודר בן שמונה קיוביטים עבור N=15 ו-a=2. הדפדפן מריץ מודל הסתברות אידיאלי להסבר; הוא אינו מריץ CUDA-Q ואינו פונה ל-QPU. הרצת קובץ Python עם יעד nvidia מבצעת סימולציית וקטור מצב קלאסית על GPU נתמך של NVIDIA. רק יעד ספק שמוגדר במפורש רץ על חומרה קוונטית פיזית. אף אחת מן ההדגמות הקטנות אינה מפרקת מודול RSA קריפטוגרפי או מדגימה יתרון קוונטי.")
  };
})();
