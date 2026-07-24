(() => {
  const select = document.querySelector('#languageSelect');
  if (!select) return;
  const en = { matter:'Matter', collider:'Collider', registry:'MODEL REGISTRY', selected:'SELECTED MODEL', structure:'Structure', interaction:'Interaction', field:'Field', communication:'Neutrino Communication', search:'Search model or phase', all:'All', ordinary:'Ordinary', hypotheses:'My hypotheses', dense:'Dense', qgp:'QGP', mesons:'Mesons', strange:'Strange', parameters:'Parameters', sources:'Scientific sources', result:'Solver result', object:'Object', scale:'Scale', state:'State', ready:'System ready', run:'Run process', subtitle:'Model specification', description:'Interactive educational model. Scientific status, assumptions, and limitations are presented in this panel.', scope:'This visualization is an educational, interactive model; it is not a detector reconstruction or a prediction of a new physical state.', mathematical:'MATHEMATICAL CORE', confirmed:'EXPERIMENTALLY CONFIRMED', theoretical:'THEORETICAL MODEL', hypothetical:'HYPOTHETICAL EXTENSION', parameter:'Model parameter' };
  const englishNames = { proton:'Proton', neutron:'Neutron', hydrogen:'Hydrogen atom', helium:'Helium-4', lambda:'Lambda hyperon', neutronMatter:'Neutron matter', qgp:'Quark-gluon plasma', strangeMatter:'Strange quark matter', njl:'NJL quark matter', twoSC:'2SC phase', cfl:'CFL phase', strangelet:'Strangelet', hyperonic:'Hyperonic matter', kaonCondensate:'Kaon condensate', quarkyonic:'Quarkyonic matter', qhc21:'QHC21 crossover', loff:'LOFF crystal', gcfl:'gCFL phase', cflK0:'CFL-K0 phase', cflStrangelet:'CFL strangelet', hDibaryon:'H dibaryon', omegaDibaryon:'Omega-Omega dibaryon', pion:'Pion pi+', kaon:'Kaon K+', rho:'rho0 meson', glueball:'Scalar glueball 0++', hybridMeson:'Hybrid meson q qbar g', neutrinoLens:'Neutrino lens' };
  const parameterNames = { alphaS:'Strong coupling alpha_s', stringTension:'String tension sigma', probeEnergy:'Photon energy', colliderEnergy:'Collision energy sqrt(s)', higgsMass:'Higgs mass', impactParameter:'Impact parameter b', seed:'Event seed', solenoidField:'Solenoid field B', neutrinoEnergy:'Neutrino energy', density:'Density', anisotropy:'Anisotropy', spinCoupling:'Spin coupling', lensLength:'Lens length', configuration:'Configuration', mMode:'Projection preset', iPhase:'i-phase φ', iCoupling:'i-coupling strength', leakage:'Leakage Im(s)', projectionCoherence:'Projection coherence', probeType:'3D probe', projection:'Visible 3D axes', tesseractMode:'Display mode', positionX:'4D position x', positionY:'4D position y', positionZ:'4D position z', positionI:'4D position i', rotationXi:'4D rotation X–i', rotationYi:'4D rotation Y–i', rotationZi:'4D rotation Z–i', precession:'Real-spin precession Ω', phaseOffset:'Complex phase φ' };
  const $ = s => document.querySelector(s);
  const set = (el, value) => { if (el && value != null && el.textContent !== value) el.textContent = value; };
  const selected = () => window.qcdLabState?.selected;
  function applyEnglish() {
    const t = en;
    [['#matterWorkspaceBtn span',t.matter],['#colliderWorkspaceBtn span',t.collider],['.catalog-panel .eyebrow',t.registry],['.inspector-head .eyebrow',t.selected],['#inspectorSubtitle',t.subtitle],['#modelDescription',t.description],['#modelApplicability',t.scope],['#communicationViewBtn span',t.communication],['.communication-panel-head strong',t.communication]].forEach(([s,v]) => set($(s),v));
    // View-mode labels, status text and run-button text are rendered by app.js.
    // Keeping them out of this generic language pass prevents dynamic modes such
    // as the lattice passage experiment from being renamed as generic controls.
    const search=$('#modelSearch'); if(search) search.placeholder=t.search;
    const family={all:t.all,baryon:'Baryons',lepton:'Leptons',nuclear:'Nuclei & atoms',ordinary:t.ordinary,hypothetical:t.hypotheses,exotic:'Exotic matter',dense:t.dense,qgp:t.qgp,meson:t.mesons,collider:t.collider,strange:t.strange};
    document.querySelectorAll('.family-filters button').forEach(b=>set(b,family[b.dataset.family]||b.textContent));
    const model=selected(); const name=englishNames[model?.id];
    document.querySelectorAll('.model-item').forEach(item=>{ const itemName=englishNames[item.dataset.model]; if(itemName) set(item.querySelector('.model-copy strong'),itemName); });
    if(name) { document.querySelectorAll('.model-item.active .model-copy strong,#inspectorTitle,#sceneTitle').forEach(el=>set(el,name)); set($('#telemetryObject'),model?.composition?.join('') || name); }
    document.querySelectorAll('.model-copy span').forEach(el=>set(el,t.subtitle));
    document.querySelectorAll('.telemetry-bar div span').forEach((el,i)=>set(el,[t.object,t.scale,t.state,'Solver'][i]));
    document.querySelectorAll('.equation-block span').forEach(el=>set(el,t.mathematical));
    const badge=$('#certaintyBadge'); if(badge) set(badge,badge.classList.contains('confirmed')?t.confirmed:badge.classList.contains('theoretical')?t.theoretical:t.hypothetical);
    document.querySelectorAll('#parameterControls label').forEach(label=>{ const key=label.querySelector('[data-param]')?.dataset.param; set(label.querySelector('span'),parameterNames[key] || (key==='configuration' ? 'Configuration' : t.parameter)); });
    document.querySelectorAll('.section-title h3').forEach(el=>{ const raw=el.textContent.toLowerCase(); if(raw.includes('solver')||raw.includes('result')) set(el,t.result); else if(raw.includes('source')) set(el,t.sources); else set(el,t.parameters); });
  }
  function applyRussianCommunication() {
    [
      ['#communicationInspector .section-title h3','Нейтринная коммуникация'],
      ['#communicationState','Готово к передаче через породу'],
      ['#communicationStatus','Готово к модуляции поляризации в линзе'],
      ['#communicationInspector .scope-note','Учебное сравнение нейтринного и электромагнитного пучков, проходящих через породу. Линза — гипотеза проекта; это не проект устройства связи.'],
      ['#communicationPauseBtn','Пауза'], ['#communicationBurstBtn','Послать импульс'], ['#communicationResetBtn','Сброс']
    ].forEach(([s,v])=>{ if(v) set($(s),v); });
    const messageLabel=$('#communicationMessage')?.closest('label')?.querySelector('span'); set(messageLabel,'Сообщение');
    const message=$('#communicationMessage'); if(message) message.placeholder='Введите сообщение для нейтринной модуляции';
    set($('#communicationSendBtn'),'Передать сообщение');
    const bitPanel=$('.communication-bit-panel');
    if(bitPanel){ const labels=bitPanel.querySelectorAll('span'); set(labels[0],'Биты отправки'); set(labels[1],'Полученные биты'); set(labels[2],'Расшифрованное сообщение'); }
    const decoded=$('#communicationDecoded'); if(decoded && decoded.textContent.includes('Waiting')) set(decoded,'Ожидание полного сообщения.');
  }
  function localize() {
    document.documentElement.lang=select.value||'en';
    document.documentElement.dir=select.value==='he'?'rtl':'ltr';
    if(select.value==='en') applyEnglish();
    if(select.value==='ru') applyRussianCommunication();
  }
  select.value=localStorage.getItem('qcd-neutrino-language')||'en';
  select.addEventListener('change',()=>{ localStorage.setItem('qcd-neutrino-language',select.value); window.location.reload(); });
  new MutationObserver(localize).observe(document.body,{subtree:true,childList:true,characterData:true});
  localize();
})();
