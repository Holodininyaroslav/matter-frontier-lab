(() => {
  const select = document.querySelector('#languageSelect');
  const modelNames = {
    'Протон':['Proton','פרוטון'], 'Нейтрон':['Neutron','נייטרון'], 'Атом водорода':['Hydrogen atom','אטום מימן'], 'Гелий-4':['Helium-4','הליום-4'], 'Λ-гиперон':['Lambda hyperon','היפרון למבדה'], 'Нейтронная материя':['Neutron matter','חומר נייטרונים'], 'Кварк-глюонная плазма':['Quark–gluon plasma','פלזמת קווארק-גלואון'], 'Strange quark matter':['Strange quark matter','חומר קווארקי מוזר'], 'NJL quark matter':['NJL quark matter','חומר קווארקי NJL'], '2SC phase':['2SC phase','פאזת 2SC'], 'CFL phase':['CFL phase','פאזת CFL'], 'Strangelet':['Strangelet','סטריינג׳לט'], 'Гиперонная материя':['Hyperonic matter','חומר היפרוני'], 'Каонный конденсат':['Kaon condensate','קונדנסט קאונים'], 'Кваркионическая материя':['Quarkyonic matter','חומר קווארקיוני'], 'QHC21 crossover':['QHC21 crossover','מעבר QHC21'], 'LOFF crystal':['LOFF crystal','גביש LOFF'], 'gCFL phase':['gCFL phase','פאזת gCFL'], 'CFL-K⁰ phase':['CFL-K⁰ phase','פאזת CFL-K⁰'], 'CFL-strangelet':['CFL strangelet','סטריינג׳לט CFL'], 'H-дибарион':['H dibaryon','דיבריון H'], 'ΩΩ-дибарион':['Omega–Omega dibaryon','דיבריון אומגה–אומגה'], 'Пион π⁺':['Pion π⁺','פאון π⁺'], 'Каон K⁺':['Kaon K⁺','קאון K⁺'], 'ρ⁰-мезон':['ρ⁰ meson','מזון ρ⁰'], 'Скалярный glueball 0⁺⁺':['Scalar glueball 0⁺⁺','גלובול סקלרי 0⁺⁺'], 'Гибридный мезон q q̄ g':['Hybrid meson q q̄ g','מזון היברידי q q̄ g'], 'Нейтринная линза':['Neutrino lens','עדשת ניטרינו']
  };
  const ui = {
    en: { matter:'Matter', collider:'Collider', registry:'MODEL REGISTRY', selected:'SELECTED MODEL', parameters:'Parameters', structure:'Structure', interaction:'Interaction', field:'Field', search:'Search model or phase', all:'All', ordinary:'Ordinary', hypotheses:'My hypotheses', dense:'Dense', mesons:'Mesons', strange:'Strange', object:'Object', scale:'Scale', state:'State', ready:'System ready', run:'Run process', language:'Interface language', model:'Interactive educational model. Scientific status and limitations are shown in this panel.', subtitle:'Model specification', source:'Scientific sources', result:'Solver result' },
    ru: { matter:'Материя', collider:'Коллайдер', registry:'РЕЕСТР МОДЕЛЕЙ', selected:'ВЫБРАННАЯ МОДЕЛЬ', parameters:'Параметры', structure:'Структура', interaction:'Взаимодействие', field:'Поле', search:'Найти модель или фазу', all:'Все', ordinary:'Обычная', hypotheses:'Мои гипотезы', dense:'Плотная', mesons:'Мезоны', strange:'Странная', object:'Объект', scale:'Масштаб', state:'Состояние', ready:'Система готова', run:'Запустить процесс', language:'Язык интерфейса', model:'Интерактивная учебная модель. Научный статус и ограничения показаны в этой панели.', subtitle:'Спецификация модели', source:'Научные источники', result:'Результат solver' },
    he: { matter:'חומר', collider:'מאיץ', registry:'מאגר מודלים', selected:'מודל נבחר', parameters:'פרמטרים', structure:'מבנה', interaction:'אינטראקציה', field:'שדה', search:'חיפוש מודל או פאזה', all:'הכול', ordinary:'רגיל', hypotheses:'ההשערות שלי', dense:'צפוף', mesons:'מזונים', strange:'מוזר', object:'אובייקט', scale:'קנה מידה', state:'מצב', ready:'המערכת מוכנה', run:'הפעלת תהליך', language:'שפת ממשק', model:'מודל לימודי אינטראקטיבי. המעמד המדעי והמגבלות מוצגים בלוח זה.', subtitle:'מפרט המודל', source:'מקורות מדעיים', result:'תוצאת פותר' }
  };
  const parameterLabels = { 'Сильная связь αₛ':'Strong coupling αₛ', 'Натяжение σ':'String tension σ', 'Энергия фотона':'Photon energy', 'Энергия √s':'Energy √s', 'Масса H':'Higgs mass', 'Прицельный параметр b':'Impact parameter b', 'Поле соленоида B':'Solenoid field B', 'Seed события':'Event seed', 'Гипотетическая масса Z′':'Hypothetical Z′ mass', 'Энергия нейтрино':'Neutrino energy', 'Плотность':'Density', 'Анизотропия':'Anisotropy', 'Длина линзы':'Lens length' };
  function modelName(text, lang) {
    const entry = Object.entries(modelNames).find(([ru,pair]) => text===ru || text===pair[0] || text===pair[1]);
    if (!entry) return text;
    const [ru,pair]=entry;
    return lang==='ru' ? ru : lang==='he' ? pair[1] : pair[0];
  }
  function setText(el, text) { if (el && text != null && el.textContent !== text) el.textContent = text; }
  function localize() {
    const lang = select.value; const t = ui[lang];
    document.documentElement.lang = lang; document.documentElement.dir = lang==='he'?'rtl':'ltr'; select.setAttribute('aria-label',t.language);
    const simple = [['#matterWorkspaceBtn span',t.matter],['#colliderWorkspaceBtn span',t.collider],['.catalog-panel .eyebrow',t.registry],['.inspector-head .eyebrow',t.selected],['#parameterControls',null],['#interactionStatus',t.ready]];
    simple.forEach(([selector,text])=>setText(document.querySelector(selector),text));
    document.querySelectorAll('#viewModes button').forEach((el,i)=>{ const label=[t.structure,t.interaction,t.field][i]; const node=el.childNodes[el.childNodes.length-1]; if(label&&node&&node.nodeValue!==' '+label) node.nodeValue=' '+label; });
    document.querySelectorAll('.family-filters button').forEach(el=>{ const map={'Все':t.all,'Обычная':t.ordinary,'Мои гипотезы':t.hypotheses,'Плотная':t.dense,'Мезоны':t.mesons,'Странная':t.strange,'All':t.all,'Ordinary':t.ordinary,'My hypotheses':t.hypotheses,'ההשערות שלי':t.hypotheses,'Dense':t.dense,'Mesons':t.mesons,'Strange':t.strange}; setText(el,map[el.textContent.trim()]||el.textContent); });
    const search=document.querySelector('#modelSearch'); if(search) search.placeholder=t.search;
    document.querySelectorAll('.model-copy strong,#inspectorTitle,#sceneTitle').forEach(el=>setText(el,modelName(el.textContent.trim(),lang)));
    document.querySelectorAll('.model-copy span').forEach(el=>{ if(lang==='en') setText(el,'Model specification'); else if(lang==='he') setText(el,'מפרט המודל'); });
    setText(document.querySelector('#inspectorSubtitle'),t.subtitle); setText(document.querySelector('#modelDescription'),t.model); setText(document.querySelector('#runInteractionBtn span'),t.run);
    document.querySelectorAll('.telemetry-bar div span').forEach((el,i)=>{ const label=[t.object,t.scale,t.state,'Solver'][i]; setText(el,label); });
    document.querySelectorAll('#parameterControls label span').forEach(el=>{ const raw=el.textContent.trim(); if(lang==='en') setText(el,parameterLabels[raw]||'Model parameter'); else if(lang==='he') setText(el,'פרמטר מודל'); });
    document.querySelectorAll('.section-title h3').forEach(el=>{ const raw=el.textContent.trim(); if(raw.includes('Параметры')||raw==='Parameters') setText(el,t.parameters); if(raw.includes('источники')||raw==='Scientific sources') setText(el,t.source); if(raw.includes('solver')||raw==='Solver result') setText(el,t.result); });
  }
  select.value = localStorage.getItem('qcd-neutrino-language') || 'en';
  select.addEventListener('change',()=>{ localStorage.setItem('qcd-neutrino-language',select.value); localize(); });
  new MutationObserver(()=>localize()).observe(document.body,{subtree:true,childList:true,characterData:true});
  localize();
})();
