(() => {
  "use strict";
  const config = window.INSPECTOR_CONFIG;
  if (!config) throw new Error("INSPECTOR_CONFIG is missing");

  const common = {
    en:{language:"Language",back:"← Matter Frontier Lab",demonstrations:"Hybrid demonstrations",tabShor:"01 · Shor / CUDA-Q",tabAsic:"02 · ASIC + CUDA-Q",tabQuark:"03 · Multi-quark search",flow:"Live dependency map",runtimeDependency:"Runtime data dependency",referenceDependency:"Reference / verification path",parallelLane:"Parallel-capable lane",architecture:"Computation architecture",architectureIntro:"Each block has a narrow, inspectable responsibility.",stages:"Open the algorithm stage by stage",stagesIntro:"Choose a stage or substage. The table loads the exact repository source and annotates every displayed line.",line:"Line",code:"Exact source",substage:"Substage",annotation:"What this line does",previous:"Previous stage",next:"Next stage",sources:"Source inventory",boundary:"Scientific boundary",loading:"Loading exact source…",blank:"Blank line separates logical blocks.",comment:"Source comment documents intent or a scientific limitation.",import:"Imports a dependency used by this computation block.",definition:"Defines a reusable function, class, or hardware module.",condition:"Selects a path only when its stated condition is true.",loop:"Repeats the operation over candidates, samples, or hardware lanes.",return:"Returns the stage result to the next pipeline boundary.",assignment:"Creates or updates a named intermediate value.",hardware:"Declares or updates a synthesizable SystemVerilog signal.",fallback:"Executable project line in the selected stage."},
    ru:{language:"Язык",back:"← Matter Frontier Lab",demonstrations:"Гибридные демонстрации",tabShor:"01 · Шор / CUDA-Q",tabAsic:"02 · ASIC + CUDA-Q",tabQuark:"03 · Поиск кварковых систем",flow:"Актуальная карта зависимостей",runtimeDependency:"Зависимость данных при запуске",referenceDependency:"Эталонная / проверочная ветвь",parallelLane:"Параллельно исполнимая ветвь",architecture:"Архитектура вычислений",architectureIntro:"У каждого блока есть узкая и проверяемая ответственность.",stages:"Откройте алгоритм по этапам",stagesIntro:"Выберите этап или подэтап. Таблица загружает точный исходник репозитория и поясняет каждую показанную строку.",line:"Строка",code:"Точный исходник",substage:"Подэтап",annotation:"Что делает строка",previous:"Предыдущий этап",next:"Следующий этап",sources:"Состав исходников",boundary:"Научная граница",loading:"Загрузка точного исходника…",blank:"Пустая строка разделяет логические блоки.",comment:"Комментарий исходника фиксирует назначение или научное ограничение.",import:"Подключает зависимость, используемую этим вычислительным блоком.",definition:"Определяет переиспользуемую функцию, класс или аппаратный модуль.",condition:"Выбирает ветвь только при выполнении указанного условия.",loop:"Повторяет операцию для кандидатов, измерений или аппаратных каналов.",return:"Передаёт результат этапа на следующую границу конвейера.",assignment:"Создаёт или обновляет именованное промежуточное значение.",hardware:"Объявляет или обновляет синтезируемый сигнал SystemVerilog.",fallback:"Исполняемая строка проекта в выбранном этапе."},
    he:{language:"שפה",back:"Matter Frontier Lab ←",demonstrations:"הדגמות היברידיות",tabShor:"01 · שור / CUDA-Q",tabAsic:"02 · ASIC + CUDA-Q",tabQuark:"03 · חיפוש רב־קווארקי",flow:"מפת תלויות עדכנית",runtimeDependency:"תלות נתונים בזמן ריצה",referenceDependency:"נתיב ייחוס / אימות",parallelLane:"נתיב הניתן להרצה במקביל",architecture:"ארכיטקטורת החישוב",architectureIntro:"לכל בלוק אחריות צרה וניתנת לבדיקה.",stages:"פתיחת האלגוריתם שלב אחר שלב",stagesIntro:"בחרו שלב או תת־שלב. הטבלה טוענת את קוד המקור המדויק מהמאגר ומסבירה כל שורה מוצגת.",line:"שורה",code:"קוד מקור מדויק",substage:"תת־שלב",annotation:"מה השורה עושה",previous:"השלב הקודם",next:"השלב הבא",sources:"מפת קבצי המקור",boundary:"גבול מדעי",loading:"טוען קוד מקור מדויק…",blank:"שורה ריקה מפרידה בין בלוקים לוגיים.",comment:"הערת המקור מתעדת כוונה או מגבלה מדעית.",import:"מייבא תלות שבה משתמש בלוק החישוב.",definition:"מגדיר פונקציה, מחלקה או מודול חומרה לשימוש חוזר.",condition:"בוחר מסלול רק כאשר התנאי מתקיים.",loop:"חוזר על הפעולה עבור מועמדים, מדידות או ערוצי חומרה.",return:"מחזיר את תוצאת השלב לגבול הצינור הבא.",assignment:"יוצר או מעדכן ערך ביניים בעל שם.",hardware:"מכריז או מעדכן אות SystemVerilog הניתן לסינתזה.",fallback:"שורת פרויקט ניתנת להרצה בשלב שנבחר."}
  };

  const sourceCache = new Map();
  const supportedLanguages = new Set(["en", "ru", "he"]);
  const requestedLanguage = new URLSearchParams(location.search).get("lang");
  let language = supportedLanguages.has(requestedLanguage)
    ? requestedLanguage
    : (localStorage.getItem("mfl-pages-language") || localStorage.getItem("qcd-neutrino-language") || "en");
  let stageIndex = 0;
  let focusedSubstep = null;
  const localize = value => typeof value === "string" ? value : (value?.[language] || value?.en || "");
  const ui = key => common[language]?.[key] || common.en[key];
  const numberedKicker = (index,value) => /^\d{2}\s*·/.test(String(value).trim()) ? String(value) : `${String(index+1).padStart(2,"0")} · ${value}`;

  function setStaticCopy(){
    const copy=config.copy[language]||config.copy.en;
    document.documentElement.lang=language;
    document.documentElement.dir=language==="he"?"rtl":"ltr";
    document.title=copy.documentTitle;
    document.querySelectorAll("[data-copy]").forEach(el=>{const key=el.dataset.copy; if(copy[key]) el.textContent=copy[key]});
    document.querySelectorAll("[data-common]").forEach(el=>el.textContent=ui(el.dataset.common));
    document.querySelector("#languageSelect").value=language;
    persistLanguage();
    renderDemoTabs();
  }

  function persistLanguage(){
    localStorage.setItem("mfl-pages-language",language);
    localStorage.setItem("qcd-neutrino-language",language);
    const current=new URL(location.href);
    current.searchParams.set("lang",language);
    history.replaceState(null,"",current);
  }

  function withLanguage(path){
    const url=new URL(path,location.href);
    url.searchParams.set("lang",language);
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function renderDemoTabs(){
    const root=document.querySelector("[data-demo-tabs]");
    if(!root) return;
    root.setAttribute("aria-label",ui("demonstrations"));
    root.querySelectorAll("[data-demo-page]").forEach(link=>{
      const key=link.dataset.demoPage;
      const labels={shor:"tabShor",asic:"tabAsic",quark:"tabQuark"};
      if(labels[key]) link.textContent=ui(labels[key]);
      link.href=withLanguage(link.dataset.href||link.getAttribute("href"));
      link.classList.toggle("active",document.body.dataset.demoPage===key);
    });
    const back=document.querySelector(".top-actions .ghost");
    if(back) back.href=withLanguage("../");
  }

  function renderStatus(){
    document.querySelector("#statusGrid").innerHTML=config.status.map(item=>`<article class="status-card"><b>${escapeHtml(localize(item.title))}</b><span>${escapeHtml(localize(item.text))}</span></article>`).join("");
  }

  function renderArchitecture(){
    const root=document.querySelector("#architecture");
    root.style.setProperty("--columns",String(Math.min(config.architecture.length,5)));
    root.innerHTML=config.architecture.map((item,index)=>`<article><b>${String(index+1).padStart(2,"0")} · ${escapeHtml(localize(item.title))}</b><p>${escapeHtml(localize(item.text))}</p></article>`).join("");
  }

  function renderFlowMap(){
    const root=document.querySelector("#flowMap");
    if(!root||!config.flow) return;
    const flow=config.flow;
    const lanes=(flow.lanes||[]).map(lane=>`<div class="flow-lane ${escapeHtml(lane.kind||"")}" style="grid-column:1/-1;grid-row:${Number(lane.row)}"><span>${escapeHtml(localize(lane.title))}</span></div>`).join("");
    const nodes=(flow.nodes||[]).map((node,index)=>{
      const stage=config.stages[node.stage];
      const title=localize(node.title)||localize(stage?.title);
      const kicker=localize(node.kicker)||localize(stage?.kicker)||localize(stage?.sourceLabel);
      return `<button class="flow-node ${node.kind||"runtime"} ${node.stage===stageIndex?"active":""}" data-flow-node="${escapeHtml(node.id||String(index))}" data-flow-stage="${Number(node.stage)}" type="button" style="grid-column:${Number(node.column)};grid-row:${Number(node.row)}"><small>${escapeHtml(numberedKicker(Number(node.stage),kicker))}</small><strong>${escapeHtml(title)}</strong><span>${escapeHtml(localize(node.caption)||"")}</span></button>`;
    }).join("");
    root.innerHTML=`<div class="flow-canvas" style="--flow-columns:${Number(flow.columns||5)};--flow-rows:${Number(flow.rows||3)}"><svg class="flow-lines" aria-hidden="true"></svg>${lanes}${nodes}</div><p class="flow-note">${escapeHtml(localize(flow.note)||"")}</p>`;
    root.querySelectorAll("[data-flow-stage]").forEach(button=>button.addEventListener("click",()=>{
      openStage(Number(button.dataset.flowStage));
      document.querySelector(".inspector")?.scrollIntoView({behavior:"smooth",block:"start"});
    }));
    requestAnimationFrame(drawFlowConnections);
  }

  function drawFlowConnections(){
    const canvas=document.querySelector(".flow-canvas");
    const svg=canvas?.querySelector(".flow-lines");
    if(!canvas||!svg||!config.flow) return;
    const bounds=canvas.getBoundingClientRect();
    svg.setAttribute("viewBox",`0 0 ${Math.max(1,bounds.width)} ${Math.max(1,bounds.height)}`);
    svg.innerHTML=`<defs><marker id="flow-arrow-runtime" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"></path></marker><marker id="flow-arrow-reference" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"></path></marker></defs>`;
    canvas.querySelectorAll(".flow-edge-label").forEach(label=>label.remove());
    for(const edge of config.flow.edges||[]){
      const from=canvas.querySelector(`[data-flow-node="${cssEscape(edge.from)}"]`);
      const to=canvas.querySelector(`[data-flow-node="${cssEscape(edge.to)}"]`);
      if(!from||!to) continue;
      const a=from.getBoundingClientRect(), b=to.getBoundingClientRect();
      const ac={x:a.left-bounds.left+a.width/2,y:a.top-bounds.top+a.height/2};
      const bc={x:b.left-bounds.left+b.width/2,y:b.top-bounds.top+b.height/2};
      const horizontal=Math.abs(bc.x-ac.x)>=Math.abs(bc.y-ac.y);
      let x1=ac.x,y1=ac.y,x2=bc.x,y2=bc.y;
      if(horizontal){const direction=bc.x>=ac.x?1:-1;x1+=direction*a.width/2;x2-=direction*b.width/2}
      else{const direction=bc.y>=ac.y?1:-1;y1+=direction*a.height/2;y2-=direction*b.height/2}
      const bend=horizontal?Math.max(28,Math.abs(x2-x1)*.42):Math.max(28,Math.abs(y2-y1)*.42);
      const path=document.createElementNS("http://www.w3.org/2000/svg","path");
      const d=horizontal?`M ${x1} ${y1} C ${x1+(x2>=x1?bend:-bend)} ${y1}, ${x2-(x2>=x1?bend:-bend)} ${y2}, ${x2} ${y2}`:`M ${x1} ${y1} C ${x1} ${y1+(y2>=y1?bend:-bend)}, ${x2} ${y2-(y2>=y1?bend:-bend)}, ${x2} ${y2}`;
      path.setAttribute("d",d);path.setAttribute("class",`flow-edge ${edge.kind==="reference"?"reference":"runtime"}`);path.setAttribute("marker-end",`url(#flow-arrow-${edge.kind==="reference"?"reference":"runtime"})`);svg.appendChild(path);
      if(edge.label){
        const label=document.createElement("span");label.className=`flow-edge-label ${edge.kind==="reference"?"reference":"runtime"}`;label.textContent=localize(edge.label);label.style.left=`${(x1+x2)/2}px`;label.style.top=`${(y1+y2)/2}px`;canvas.appendChild(label);
      }
    }
  }

  function cssEscape(value){return window.CSS?.escape?window.CSS.escape(String(value)):String(value).replace(/[^a-zA-Z0-9_-]/g,"\\$&")}

  function renderStageList(){
    document.querySelector("#stageList").innerHTML=config.stages.map((stage,index)=>`<button class="stage-button ${index===stageIndex?"active":""}" data-stage="${index}" type="button"><small>${escapeHtml(numberedKicker(index,localize(stage.kicker)||localize(stage.sourceLabel)))}</small><span>${escapeHtml(localize(stage.title))}</span></button>`).join("");
    document.querySelectorAll("[data-stage]").forEach(button=>button.addEventListener("click",()=>openStage(Number(button.dataset.stage))));
  }

  function renderSources(){
    document.querySelector("#sources").innerHTML=config.sources.map(source=>`<article class="source-row"><div><b>${escapeHtml(localize(source.title))}</b><span>${escapeHtml(localize(source.text))}</span></div><a href="${source.path}" target="_blank" rel="noreferrer">${escapeHtml(source.path.replace(/^\.\.\//,""))} ↗</a></article>`).join("");
  }

  async function sourceLines(path){
    if(sourceCache.has(path)) return sourceCache.get(path);
    const response=await fetch(path,{cache:"no-store"});
    if(!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const lines=(await response.text()).replace(/\r/g,"").split("\n");
    sourceCache.set(path,lines); return lines;
  }

  function locate(lines,marker,from=0){
    if(!marker) return from;
    const index=lines.findIndex((line,i)=>i>=from&&line.includes(marker));
    return index<0?from:index;
  }

  function semanticAnnotation(line,stage){
    const trimmed=line.trim();
    const special=(stage.notes||[]).find(note=>trimmed.includes(note.contains));
    if(special) return localize(special.text);
    if(!trimmed) return ui("blank");
    if(trimmed.startsWith("#")||trimmed.startsWith("//")||trimmed.startsWith("/*")||trimmed.startsWith("*")) return ui("comment");
    if(/^(from |import )/.test(trimmed)) return ui("import");
    if(/^(@dataclass|class |def |async def |module )/.test(trimmed)) return ui("definition");
    if(/^(if |elif |else:|case |if \(|else if)/.test(trimmed)) return ui("condition");
    if(/^(for |while |foreach )/.test(trimmed)) return ui("loop");
    if(/^return\b/.test(trimmed)) return ui("return");
    if(/^(input|output|logic|parameter|always_|end|endmodule)/.test(trimmed)||trimmed.includes(" <= ")) return ui("hardware");
    if(trimmed.includes("=")||trimmed.includes("append(")||trimmed.includes("set_target(")||trimmed.includes("sample(")) return ui("assignment");
    return localize(stage.fallback)||ui("fallback");
  }

  function substepFor(stage,line,absoluteIndex,lines,start){
    for(const substep of stage.substeps||[]){
      const begin=locate(lines,substep.start,start);
      const end=substep.end?locate(lines,substep.end,begin+1):lines.length;
      if(absoluteIndex>=begin&&absoluteIndex<end) return substep;
    }
    return null;
  }

  async function openStage(index){
    stageIndex=Math.max(0,Math.min(index,config.stages.length-1)); focusedSubstep=null;
    renderStageList();
    document.querySelectorAll("[data-flow-stage]").forEach(node=>node.classList.toggle("active",Number(node.dataset.flowStage)===stageIndex));
    const stage=config.stages[stageIndex];
    document.querySelector("#stageKicker").textContent=numberedKicker(stageIndex,localize(stage.kicker)||localize(stage.sourceLabel));
    document.querySelector("#stageTitle").textContent=localize(stage.title);
    document.querySelector("#stageSummary").textContent=localize(stage.summary);
    const link=document.querySelector("#sourceLink"); link.href=stage.source; link.textContent=localize(stage.sourceLabel)||stage.source;
    document.querySelector("#prevStage").disabled=stageIndex===0;
    document.querySelector("#nextStage").disabled=stageIndex===config.stages.length-1;
    const subRoot=document.querySelector("#substeps");
    subRoot.innerHTML=(stage.substeps||[]).map((step,i)=>`<button class="substep" data-substep="${i}" type="button">${escapeHtml(localize(step.title))}</button>`).join("");
    subRoot.hidden=!stage.substeps?.length;
    document.querySelector("#tableWrap").innerHTML=`<div class="loading">${escapeHtml(ui("loading"))}</div>`;
    try{
      const lines=await sourceLines(stage.source);
      const start=locate(lines,stage.start,0);
      const end=stage.end?locate(lines,stage.end,start+1):lines.length;
      const rows=lines.slice(start,end).map((line,offset)=>{
        const absolute=start+offset;
        const substep=substepFor(stage,line,absolute,lines,start);
        const subId=substep?(stage.substeps||[]).indexOf(substep):-1;
        return `<tr data-row-substep="${subId}"><td class="line-no">${absolute+1}</td><td class="code-cell ${line.trim()?"":"blank"}">${escapeHtml(line||" ")}</td><td class="substage-cell">${escapeHtml(substep?localize(substep.title):localize(stage.kicker))}</td><td class="note-cell">${escapeHtml(semanticAnnotation(line,stage))}</td></tr>`;
      }).join("");
      document.querySelector("#tableWrap").innerHTML=`<table class="code-table"><thead><tr><th>${ui("line")}</th><th>${ui("code")}</th><th>${ui("substage")}</th><th>${ui("annotation")}</th></tr></thead><tbody>${rows}</tbody></table>`;
      document.querySelectorAll("[data-substep]").forEach(button=>button.addEventListener("click",()=>focusSubstep(Number(button.dataset.substep))));
    }catch(error){document.querySelector("#tableWrap").innerHTML=`<div class="error">${escapeHtml(String(error))}</div>`}
  }

  function focusSubstep(index){
    focusedSubstep=focusedSubstep===index?null:index;
    document.querySelectorAll("[data-substep]").forEach(button=>button.classList.toggle("active",Number(button.dataset.substep)===focusedSubstep));
    document.querySelectorAll("[data-row-substep]").forEach(row=>row.classList.toggle("focus",Number(row.dataset.rowSubstep)===focusedSubstep));
    if(focusedSubstep!==null) document.querySelector(`[data-row-substep="${focusedSubstep}"]`)?.scrollIntoView({behavior:"smooth",block:"center"});
  }

  function escapeHtml(value){const node=document.createElement("span");node.textContent=String(value);return node.innerHTML}
  function rerender(){setStaticCopy();renderFlowMap();renderStatus();renderArchitecture();renderStageList();renderSources();document.querySelector("#boundaryText").textContent=localize(config.boundary);config.renderInteractive?.(language);openStage(stageIndex)}
  document.querySelector("#languageSelect").addEventListener("change",event=>{language=event.target.value;persistLanguage();rerender()});
  document.querySelector("#prevStage").addEventListener("click",()=>openStage(stageIndex-1));
  document.querySelector("#nextStage").addEventListener("click",()=>openStage(stageIndex+1));
  window.addEventListener("resize",()=>requestAnimationFrame(drawFlowConnections));
  rerender();
})();
