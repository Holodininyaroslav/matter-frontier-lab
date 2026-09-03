(() => {
  "use strict";
  const config = window.INSPECTOR_CONFIG;
  if (!config) throw new Error("INSPECTOR_CONFIG is missing");

  const common = {
    en:{language:"Language",back:"← Matter Frontier Lab",architecture:"Computation architecture",architectureIntro:"Each block has a narrow, inspectable responsibility.",stages:"Open the algorithm stage by stage",stagesIntro:"Choose a stage or substage. The table loads the exact repository source and annotates every displayed line.",line:"Line",code:"Exact source",substage:"Substage",annotation:"What this line does",previous:"Previous stage",next:"Next stage",sources:"Source inventory",boundary:"Scientific boundary",loading:"Loading exact source…",blank:"Blank line separates logical blocks.",comment:"Source comment documents intent or a scientific limitation.",import:"Imports a dependency used by this computation block.",definition:"Defines a reusable function, class, or hardware module.",condition:"Selects a path only when its stated condition is true.",loop:"Repeats the operation over candidates, samples, or hardware lanes.",return:"Returns the stage result to the next pipeline boundary.",assignment:"Creates or updates a named intermediate value.",hardware:"Declares or updates a synthesizable SystemVerilog signal.",fallback:"Executable project line in the selected stage."},
    ru:{language:"Язык",back:"← Matter Frontier Lab",architecture:"Архитектура вычислений",architectureIntro:"У каждого блока есть узкая и проверяемая ответственность.",stages:"Откройте алгоритм по этапам",stagesIntro:"Выберите этап или подэтап. Таблица загружает точный исходник репозитория и поясняет каждую показанную строку.",line:"Строка",code:"Точный исходник",substage:"Подэтап",annotation:"Что делает строка",previous:"Предыдущий этап",next:"Следующий этап",sources:"Состав исходников",boundary:"Научная граница",loading:"Загрузка точного исходника…",blank:"Пустая строка разделяет логические блоки.",comment:"Комментарий исходника фиксирует назначение или научное ограничение.",import:"Подключает зависимость, используемую этим вычислительным блоком.",definition:"Определяет переиспользуемую функцию, класс или аппаратный модуль.",condition:"Выбирает ветвь только при выполнении указанного условия.",loop:"Повторяет операцию для кандидатов, измерений или аппаратных каналов.",return:"Передаёт результат этапа на следующую границу конвейера.",assignment:"Создаёт или обновляет именованное промежуточное значение.",hardware:"Объявляет или обновляет синтезируемый сигнал SystemVerilog.",fallback:"Исполняемая строка проекта в выбранном этапе."},
    he:{language:"שפה",back:"Matter Frontier Lab ←",architecture:"ארכיטקטורת החישוב",architectureIntro:"לכל בלוק אחריות צרה וניתנת לבדיקה.",stages:"פתיחת האלגוריתם שלב אחר שלב",stagesIntro:"בחרו שלב או תת־שלב. הטבלה טוענת את קוד המקור המדויק מהמאגר ומסבירה כל שורה מוצגת.",line:"שורה",code:"קוד מקור מדויק",substage:"תת־שלב",annotation:"מה השורה עושה",previous:"השלב הקודם",next:"השלב הבא",sources:"מפת קבצי המקור",boundary:"גבול מדעי",loading:"טוען קוד מקור מדויק…",blank:"שורה ריקה מפרידה בין בלוקים לוגיים.",comment:"הערת המקור מתעדת כוונה או מגבלה מדעית.",import:"מייבא תלות שבה משתמש בלוק החישוב.",definition:"מגדיר פונקציה, מחלקה או מודול חומרה לשימוש חוזר.",condition:"בוחר מסלול רק כאשר התנאי מתקיים.",loop:"חוזר על הפעולה עבור מועמדים, מדידות או ערוצי חומרה.",return:"מחזיר את תוצאת השלב לגבול הצינור הבא.",assignment:"יוצר או מעדכן ערך ביניים בעל שם.",hardware:"מכריז או מעדכן אות SystemVerilog הניתן לסינתזה.",fallback:"שורת פרויקט ניתנת להרצה בשלב שנבחר."}
  };

  const sourceCache = new Map();
  let language = localStorage.getItem("mfl-pages-language") || "en";
  let stageIndex = 0;
  let focusedSubstep = null;
  const localize = value => typeof value === "string" ? value : (value?.[language] || value?.en || "");
  const ui = key => common[language]?.[key] || common.en[key];

  function setStaticCopy(){
    const copy=config.copy[language]||config.copy.en;
    document.documentElement.lang=language;
    document.documentElement.dir=language==="he"?"rtl":"ltr";
    document.title=copy.documentTitle;
    document.querySelectorAll("[data-copy]").forEach(el=>{const key=el.dataset.copy; if(copy[key]) el.textContent=copy[key]});
    document.querySelectorAll("[data-common]").forEach(el=>el.textContent=ui(el.dataset.common));
    document.querySelector("#languageSelect").value=language;
  }

  function renderStatus(){
    document.querySelector("#statusGrid").innerHTML=config.status.map(item=>`<article class="status-card"><b>${escapeHtml(localize(item.title))}</b><span>${escapeHtml(localize(item.text))}</span></article>`).join("");
  }

  function renderArchitecture(){
    const root=document.querySelector("#architecture");
    root.style.setProperty("--columns",String(Math.min(config.architecture.length,5)));
    root.innerHTML=config.architecture.map((item,index)=>`<article><b>${String(index+1).padStart(2,"0")} · ${escapeHtml(localize(item.title))}</b><p>${escapeHtml(localize(item.text))}</p></article>`).join("");
  }

  function renderStageList(){
    document.querySelector("#stageList").innerHTML=config.stages.map((stage,index)=>`<button class="stage-button ${index===stageIndex?"active":""}" data-stage="${index}" type="button"><small>${String(index+1).padStart(2,"0")} · ${escapeHtml(localize(stage.kicker)||localize(stage.sourceLabel))}</small><span>${escapeHtml(localize(stage.title))}</span></button>`).join("");
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
    const stage=config.stages[stageIndex];
    document.querySelector("#stageKicker").textContent=`${String(stageIndex+1).padStart(2,"0")} · ${localize(stage.kicker)||localize(stage.sourceLabel)}`;
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
  function rerender(){setStaticCopy();renderStatus();renderArchitecture();renderStageList();renderSources();document.querySelector("#boundaryText").textContent=localize(config.boundary);openStage(stageIndex)}
  document.querySelector("#languageSelect").addEventListener("change",event=>{language=event.target.value;localStorage.setItem("mfl-pages-language",language);rerender()});
  document.querySelector("#prevStage").addEventListener("click",()=>openStage(stageIndex-1));
  document.querySelector("#nextStage").addEventListener("click",()=>openStage(stageIndex+1));
  rerender();
})();
