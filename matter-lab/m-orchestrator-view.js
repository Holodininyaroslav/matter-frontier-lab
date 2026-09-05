import {createSimulation,presetBodies,validateBodies,advance,diagnostics,verifyPreset,radiusOf,energy,UNITS} from './m-orchestrator.mjs?v=20260905-public2';

const texts={
  ru:{title:'Конструктор M-аркестратора',start:'Запустить M-аркестратор',pause:'Пауза',resume:'Продолжить',reset:'Сбросить опыт',preset:'Начальная конфигурация',bodies:'чёрные дыры',place:'Добавить на карту',cancel:'Отменить размещение',hint:'Нажмите на площадку: новая чёрная дыра получит касательную начальную скорость. Все тела лежат в одной плоскости.',edit:'Начальные условия · изменение запускает опыт заново',apply:'Применить начальные условия',field:'Автоматическое переключение M-поля',screen:'Ослабление притяжения в режиме спина 2',range:'Расстояние включения',speed:'Скорость воспроизведения',grid:'Сетка пространства-времени',dots:'Частицы M',waves:'Волны на сетке',fit:'Следить камерой за всей системой',verify:'Проверить 2 / 3 / 4 тела',export:'Скачать опыт и журнал',active:'Активные каналы спина 2',passes:'Пролёты по касательной',capture:'Контакт горизонтов: граница модели достигнута',ready:'Готово',running:'Расчёт идёт',off:'M-поле выключено',distance:'Минимальный зазор / сумма радиусов',work:'Работа M-поля',loss:'Условные потери',error:'Баланс энергии · погрешность',mass:'Масса, M☉',remove:'Удалить',pair:'Пара',mode:'Режим',coupling:'Gэфф / G',direction:'Ось канала',journal:'Журнал переключений',scope:'Закон гипотезы: спин 2 экранирует притяжение. Алгоритм управляет только локальными каналами M-поля. Тела не получают команд на скорость или положение. Поток энергии поля учитывается явно. Это ньютоновское приближение с условной диссипацией, не численная ОТО. Волновой график — квадрупольный индикатор, не калиброванный сигнал детектора.',limit:'Пролёт требует ненулевого начального углового момента. Произвольная конфигурация может столкнуться; проверка не доказывает вечную устойчивость.',verified:'Контрольный прогон, 240 единиц времени',fieldon:'С M-полем',fieldoff:'Без M-поля',pass:'Пройдено',fail:'Контакт / нет пролёта',errorPrefix:'Ошибка',standby:'ожидание',spin:'спин 2',units:'x, z — по 500 км; скорости — в единицах модели. rₛ = 2GM/c².',wave:'Квадрупольный индикатор · условные единицы',selected:'Выбрано',finished:'Проверка завершена',readonly:'Диагностика текущего опыта',noEvents:'Сначала запустите опыт.',placing:'Размещение: нажмите на карту',count:'Количество тел'},
  en:{title:'M-orchestrator constructor',start:'Start M-orchestrator',pause:'Pause',resume:'Resume',reset:'Reset experiment',preset:'Initial configuration',bodies:'black holes',place:'Add on map',cancel:'Cancel placement',hint:'Click the plane to add a black hole with a tangential initial velocity. All bodies remain coplanar.',edit:'Initial conditions · changes restart the experiment',apply:'Apply initial conditions',field:'Automatic M-field switching',screen:'Attraction screening in spin-2 mode',range:'Activation distance',speed:'Playback speed',grid:'Spacetime grid',dots:'M particles',waves:'Waves on the grid',fit:'Keep all bodies in view',verify:'Verify 2 / 3 / 4 bodies',export:'Download experiment and log',active:'Active spin-2 channels',passes:'Tangential passes',capture:'Horizon contact: model boundary reached',ready:'Ready',running:'Integrating',off:'M-field disabled',distance:'Minimum gap / sum of radii',work:'M-field work',loss:'Dissipation proxy',error:'Energy balance residual',mass:'Mass, M☉',remove:'Remove',pair:'Pair',mode:'Mode',coupling:'Geff / G',direction:'Channel axis',journal:'Switching log',scope:'Hypothesis law: spin 2 screens attraction. Only local M-field channels are controlled. Bodies receive no position or velocity commands. Field energy exchange is explicitly recorded. This is a Newtonian approximation with illustrative dissipation, not numerical GR. The wave graph is a quadrupole indicator, not calibrated detector strain.',limit:'A fly-by requires nonzero initial angular momentum. Arbitrary configurations can collide; finite tests do not prove eternal stability.',verified:'Reference run, 240 time units',fieldon:'M-field on',fieldoff:'M-field off',pass:'Passed',fail:'Contact / no pass',errorPrefix:'Error',standby:'idle',spin:'spin 2',units:'x, z: 500 km per unit; velocities in model units. rₛ = 2GM/c².',wave:'Quadrupole indicator · arbitrary units',selected:'Selected',finished:'Verification complete',readonly:'Live experiment diagnostics',noEvents:'Start the experiment first.',placing:'Placement: click the map',count:'Body count'},
  he:{title:'בונה מתזמר M',start:'הפעלת מתזמר M',pause:'השהיה',resume:'המשך',reset:'איפוס הניסוי',preset:'תצורה התחלתית',bodies:'חורים שחורים',place:'הוספה למפה',cancel:'ביטול מיקום',hint:'לחצו על המישור להוספת חור שחור עם מהירות משיקית התחלתית. כל הגופים באותו מישור.',edit:'תנאי התחלה · שינוי מאתחל את הניסוי',apply:'החלת תנאי ההתחלה',field:'מיתוג אוטומטי של שדה M',screen:'החלשת המשיכה במצב ספין 2',range:'מרחק הפעלה',speed:'מהירות ההדמיה',grid:'רשת מרחב־זמן',dots:'חלקיקי M',waves:'גלים על הרשת',fit:'כל הגופים בשדה הראייה',verify:'בדיקת 2 / 3 / 4 גופים',export:'הורדת הניסוי והיומן',active:'ערוצי ספין 2 פעילים',passes:'מעברים משיקיים',capture:'מגע אופקים: הושג גבול המודל',ready:'מוכן',running:'חישוב פעיל',off:'שדה M כבוי',distance:'מרווח מינימלי / סכום רדיוסים',work:'עבודת שדה M',loss:'פיזור אנרגיה משוער',error:'שארית מאזן האנרגיה',mass:'מסה, M☉',remove:'הסרה',pair:'זוג',mode:'מצב',coupling:'Geff / G',direction:'ציר הערוץ',journal:'יומן מיתוג',scope:'חוק ההשערה: ספין 2 מחליש משיכה. רק ערוצי שדה M מקומיים נשלטים. אין פקודות מיקום או מהירות לגופים. חילופי האנרגיה עם השדה נרשמים. זהו קירוב ניוטוני עם פיזור המחשה, לא יחסות כללית נומרית. הגרף הוא מדד קוודרופולי ולא אות גלאי מכויל.',limit:'מעבר משיקי דורש תנע זוויתי התחלתי. תצורות שרירותיות עלולות להתנגש; בדיקה סופית אינה מוכיחה יציבות נצחית.',verified:'הרצת ייחוס, 240 יחידות זמן',fieldon:'שדה M פועל',fieldoff:'שדה M כבוי',pass:'עבר',fail:'מגע / ללא מעבר',errorPrefix:'שגיאה',standby:'המתנה',spin:'ספין 2',units:'x,z: כל יחידה היא 500 ק״מ; מהירויות ביחידות המודל. rₛ = 2GM/c².',wave:'מדד קוודרופולי · יחידות יחסיות',selected:'נבחר',finished:'הבדיקה הושלמה',readonly:'מדדי הניסוי הנוכחי',noEvents:'הפעילו את הניסוי.',placing:'מיקום: לחצו על המפה',count:'מספר גופים'}
};
const $=s=>document.querySelector(s);
const fmt=x=>Number.isFinite(x)?Number(x).toFixed(3):'—';

export function createMOrchestrator(ctx) {
  const {THREE,specimen,canvas,camera,controls}=ctx;
  let sim=null,draft=[],running=false,placing=false,view=null,lastUI=0,report=null;
  const config={count:2,seed:1,enabled:true,strength:.999,activation:6.5,speed:4,grid:.18,dots:.65,waves:.4,fit:true};
  const t=key=>(texts[localStorage.getItem('qcd-neutrino-language')]||texts.en)[key]||key;
  function reset(newDraft) {
    const input=newDraft||draft;
    validateBodies(input);
    draft=structuredClone(input);sim=createSimulation(draft,config);running=false;placing=false;
    config.count=draft.length;ctx.refresh();fitCamera();
  }
  function ensure() {if(!sim){draft=presetBodies(config.count,config.seed);sim=createSimulation(draft,config);}return sim;}
  function label() {return running&&!ctx.isPaused()?t('pause'):sim?.time?t('resume'):t('start');}
  function toggle() {
    ensure();
    if(sim.status==='CAPTURE'){reset();return;}
    if(ctx.isPaused()){ctx.unpause();running=true;}
    else running=!running;
    placing=false;updateUI();
  }
  function panel() {
    ensure();
    const slider=(key,min,max,step,text)=>`<label class="m-orch-slider">${t(text)} <output id="mo-out-${key}">${config[key]}</output><input aria-label="${t(text)}" type="range" data-mo="${key}" min="${min}" max="${max}" step="${step}" value="${config[key]}"></label>`;
    return `<section class="m-orch-panel" data-m-orchestrator>
      <h3>${t('title')}</h3><p class="m-orch-caption">${t('edit')}</p><p class="m-orch-legend"><span>● M · ${t('standby')}</span><span>● M · ${t('spin')}</span></p>
      <label>${t('preset')}<select id="mo-preset">${[2,3,4,5,6,7,8].map(n=>`<option value="${n}" ${n===config.count?'selected':''}>${n} ${t('bodies')}</option>`).join('')}</select></label>
      <div class="m-orch-actions"><button id="mo-place" class="solver-btn">${placing?t('cancel'):t('place')}</button><button id="mo-reset" class="solver-btn">${t('reset')}</button></div>
      <p id="mo-hint">${placing?t('hint'):t('units')}</p>
      <details><summary>${t('edit')}</summary><div class="m-orch-table-scroll"><table class="m-orch-editor"><thead><tr><th>ID</th><th>${t('mass')}</th><th>x</th><th>z</th><th>vₓ</th><th>v_z</th><th></th></tr></thead><tbody>${draft.map(b=>`<tr data-body="${b.id}"><th>${b.id}</th>${['mass','x','z','vx','vz'].map(key=>`<td><input aria-label="${b.id} ${key}" data-key="${key}" type="number" step="${key==='mass'?'1':'.01'}" ${key==='mass'?'min="3" max="120"':'min="-100" max="100"'} value="${+(key==='mass'?b.mass*30:b[key]).toFixed(4)}"></td>`).join('')}<td><button type="button" data-remove="${b.id}" aria-label="${t('remove')} ${b.id}" ${draft.length<=2?'disabled':''}>×</button></td></tr>`).join('')}</tbody></table></div><button id="mo-apply" class="solver-btn">${t('apply')}</button></details>
      <label class="m-orch-check"><input id="mo-enabled" type="checkbox" ${config.enabled?'checked':''}>${t('field')}</label>
      ${slider('strength',0,.999,.001,'screen')}${slider('activation',2,12,.1,'range')}${slider('speed',.5,12,.5,'speed')}
      <details><summary>${t('grid')} / M / h</summary>${slider('grid',0,.6,.01,'grid')}${slider('dots',0,1,.01,'dots')}${slider('waves',0,1,.01,'waves')}<label class="m-orch-check"><input id="mo-fit" type="checkbox" ${config.fit?'checked':''}>${t('fit')}</label></details>
      <div id="mo-diagnostics" aria-live="off"></div><div class="m-orch-table-scroll"><table class="m-orch-pairs"><thead><tr><th>${t('pair')}</th><th>${t('mode')}</th><th>${t('coupling')}</th><th>${t('direction')}</th></tr></thead><tbody id="mo-pairs"></tbody></table></div>
      <details><summary>${t('journal')}</summary><pre id="mo-log"></pre></details>
      <div class="m-orch-actions"><button id="mo-verify" class="solver-btn">${t('verify')}</button><button id="mo-export" class="solver-btn">${t('export')}</button></div>
      <div id="mo-report">${reportHTML()}</div><p class="m-orch-scope">${t('scope')}</p><p class="m-orch-caption">${t('limit')}</p>
    </section>`;
  }
  function reportHTML() {
    if(!report)return '';
    return `<strong>${t('verified')}</strong><table class="m-orch-pairs"><thead><tr><th>N</th><th>${t('fieldon')}</th><th>${t('fieldoff')}</th><th>r_min / Σrₛ</th></tr></thead><tbody>${report.map(r=>`<tr><th>${r.count}</th><td>${r.on.passed?t('pass'):t('fail')} · ${r.on.passes}</td><td>${r.off.captures?t('capture'):t('running')}</td><td>${fmt(r.on.minGap)}</td></tr>`).join('')}</tbody></table>`;
  }
  function safe(action){try{action();}catch(error){ctx.status(`${t('errorPrefix')}: ${error.message}`,false);}}
  function bind() {
    $('#mo-preset')?.addEventListener('change',e=>safe(()=>reset(presetBodies(+e.target.value,config.seed))));
    $('#mo-reset')?.addEventListener('click',()=>safe(()=>reset()));
    $('#mo-place')?.addEventListener('click',()=>{
      if(draft.length>=8){ctx.status('8 / 8',false);return;}
      running=false;placing=!placing;$('#mo-place').textContent=placing?t('cancel'):t('place');
      $('#mo-hint').textContent=placing?t('hint'):t('units');updateUI();
      if(placing){canvas.scrollIntoView({block:'center',behavior:'smooth'});ctx.status(t('placing'),true);}
    });
    $('#mo-apply')?.addEventListener('click',()=>safe(()=>{
      const candidate=[...document.querySelectorAll('[data-body]')].map(row=>{
        const b={id:row.dataset.body};row.querySelectorAll('[data-key]').forEach(input=>{b[input.dataset.key]=Number(input.value)/(input.dataset.key==='mass'?30:1);});return b;
      });reset(candidate);
    }));
    document.querySelectorAll('[data-remove]').forEach(button=>button.addEventListener('click',()=>safe(()=>reset(draft.filter(b=>b.id!==button.dataset.remove)))));
    $('#mo-enabled')?.addEventListener('change',e=>{config.enabled=sim.enabled=e.target.checked;updateUI();});
    $('#mo-fit')?.addEventListener('change',e=>{config.fit=e.target.checked;});
    document.querySelectorAll('[data-mo]').forEach(input=>input.addEventListener('input',()=>{
      const key=input.dataset.mo;config[key]=+input.value;$('#mo-out-'+key).textContent=input.value;
      if(key==='strength'){const before=energy(sim);sim.strength=config.strength;sim.work+=energy(sim)-before;}
      if(key==='activation')sim.activation=config.activation;
    }));
    $('#mo-verify')?.addEventListener('click',async()=>{
      const button=$('#mo-verify');button.disabled=true;
      await new Promise(resolve=>requestAnimationFrame(resolve));
      report=[];
      for(const count of [2,3,4]) {
        if(!$('#mo-report'))break;
        report.push({count,on:verifyPreset(count),off:verifyPreset(count,240,{enabled:false})});
        $('#mo-report').innerHTML=reportHTML();
        await new Promise(resolve=>requestAnimationFrame(resolve));
      }
      button.disabled=false;ctx.status(t('finished'),true);
    });
    $('#mo-export')?.addEventListener('click',()=>{
      const blob=new Blob([JSON.stringify({version:1,law:'M-spin-2 screening hypothesis; Newtonian proxy',units:UNITS,initial:draft,config,diagnostics:diagnostics(sim),bodies:sim.bodies,channels:sim.channels,events:sim.events,history:sim.history,verification:report},null,2)],{type:'application/json'});
      const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='m-orchestrator-experiment.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
    });
    updateUI();
  }
  function mapClick(event) {
    if(!placing)return false;
    const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
    const pos=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());
    if(!pos)return true;
    safe(()=>{
      const r=Math.max(pos.length(),1),v=.12*Math.sqrt(draft.reduce((s,b)=>s+b.mass,0)/r);
      const id=Array.from('ABCDEFGH').find(id=>!draft.some(b=>b.id===id));
      if(Math.abs(pos.x)>45||Math.abs(pos.z)>45)throw Error('Choose a point inside the map (±45).');
      reset([...draft,{id,mass:1,x:pos.x,z:pos.z,vx:-pos.z/r*v,vz:pos.x/r*v}]);
    });return true;
  }
  function makeLabel(text,color) {
    const c=document.createElement('canvas');c.width=256;c.height=64;
    const g=c.getContext('2d');g.fillStyle=color;g.font='bold 30px Segoe UI';g.textAlign='center';g.fillText(text,128,40);
    const material=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false});
    const sprite=new THREE.Sprite(material);sprite.scale.set(2.5,.625,1);return sprite;
  }
  function build() {
    ensure();
    specimen.scale.set(1,1,1);
    const colors=[0x61e2ef,0xffca76,0xe39dff,0x82efaa,0xffa7b5,0x93b4ff,0xffffff,0xe4f887];
    const objects=sim.bodies.map((b,i)=>{
      const body=ctx.createBlackHole({scale:radiusOf(b.mass)/1.34,compact:true,diskTilt:.06});specimen.add(body.group);
      const label=makeLabel(`${b.id} · ${Math.round(b.mass*30)} M☉`,'#c9f8ff');specimen.add(label);
      const arrow=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(),1,colors[i],.18,.09);specimen.add(arrow);
      const trail=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:colors[i],transparent:true,opacity:.65}));specimen.add(trail);
      return {body,label,arrow,trail,points:[]};
    });
    const grid=ctx.createGrid(100,100,100,100);
    const positions=[],base=[];
    for(let x=-48;x<=48;x+=1.6)for(let z=-48;z<=48;z+=1.6){positions.push(x,.15,z);base.push({x,z});}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(positions.length),3));
    const points=new THREE.Points(geometry,new THREE.PointsMaterial({size:.12,vertexColors:true,transparent:true,opacity:.65,depthWrite:false,blending:THREE.AdditiveBlending}));specimen.add(points);
    const axes=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xef9cff,transparent:true,opacity:.7,depthWrite:false}));specimen.add(axes);
    view={objects,grid,points,base,axes,trailClock:0};tick(0);return view;
  }
  function tick(dt) {
    if(!view)return;
    if(running && !ctx.isPaused())advance(sim,dt*config.speed);
    if(sim.status==='CAPTURE')running=false;
    view.trailClock+=dt;
    sim.bodies.forEach((b,i)=>{
      const o=view.objects[i];o.body.group.position.set(b.x,0,b.z);o.label.position.set(b.x,.75,b.z);
      o.body.disk.rotation.y=sim.time*.15;
      const v=new THREE.Vector3(b.vx,0,b.vz);o.arrow.position.copy(o.body.group.position);o.arrow.setDirection(v.clone().normalize());o.arrow.setLength(Math.max(.45,v.length()*3),.18,.09);
      if(running&&view.trailClock>.05){o.points.push(new THREE.Vector3(b.x,0,b.z));if(o.points.length>900)o.points.shift();o.trail.geometry.dispose();o.trail.geometry=new THREE.BufferGeometry().setFromPoints(o.points);}
    });
    if(view.trailClock>.05)view.trailClock=0;
    const active=Object.values(sim.channels).filter(c=>c.u>.01),colors=view.points.geometry.attributes.color,lines=[];
    view.base.forEach((p,i)=>{
      let best=0,axis=null;
      for(const c of active){const dx=p.x-c.x,dz=p.z-c.z,along=dx*c.nx+dz*c.nz,cross=dx*c.nz-dz*c.nx;
        const influence=c.u*Math.exp(-cross*cross/2.5-Math.max(0,Math.abs(along)-c.distance/2)**2/2.5);
        if(influence>best){best=influence;axis=c;}}
      colors.setXYZ(i,.25+best*.75,.52-best*.17,.65+best*.35);
      if(best>.32&&axis&&i%2===0){lines.push(p.x-axis.nx*.24,.16,p.z-axis.nz*.24,p.x+axis.nx*.24,.16,p.z+axis.nz*.24);}
    });colors.needsUpdate=true;view.points.material.opacity=config.dots;
    view.axes.geometry.dispose();view.axes.geometry=new THREE.BufferGeometry();view.axes.geometry.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));view.axes.material.opacity=config.dots;
    const position=view.grid.geometry.attributes.position,base=view.grid.base,history=sim.history;
    for(let i=0;i<position.count;i++){
      const x=base[3*i],z=-base[3*i+1],r=Math.hypot(x,z),angle=Math.atan2(z,x);
      const wells=sim.bodies.reduce((s,b)=>s-2.4*b.mass/Math.sqrt(1+((x-b.x)**2+(z-b.z)**2)*1.8),0);
      const retarded=sim.time-r/2.5;
      const sample=retarded<0?null:history[Math.max(0,history.length-1-Math.round((sim.time-retarded)/.24))];
      const wave=sample?config.waves*(sample.plus*Math.cos(2*angle)+sample.cross*Math.sin(2*angle))*Math.exp(-r*.045)*.6:0;
      position.setZ(i,wells+wave);
    }position.needsUpdate=true;view.grid.grid.material.opacity=config.grid;
    if(config.fit){const r=Math.max(...sim.bodies.map(b=>Math.hypot(b.x,b.z)));const required=Math.max(30,r*3);const offset=camera.position.clone().sub(controls.target);if(offset.length()<required)camera.position.copy(controls.target).add(offset.setLength(Math.min(170,offset.length()+(required-offset.length())*.03)));}
    lastUI+=dt;
    if(lastUI>.2||dt===0){lastUI=0;updateUI();ctx.onResult(result());}
  }
  function result(){ensure();const d=diagnostics(sim);return {primaryLabel:t('wave'),xLabel:'t / T₀',data:sim.history.map(h=>({x:h.t,primary:h.plus,secondary:h.cross})),metrics:[[t('active'),d.activeChannels,''],[t('passes'),d.passes,''],['r_min / Σrₛ',Number.isFinite(d.minGap)?d.minGap:0,'']],state:{kind:'m-field-hypothesis',...d}};}
  function fitCamera(){controls.maxDistance=180;camera.position.set(18,14,20);controls.target.set(0,-.3,0);controls.update();}
  function updateUI() {
    if(!sim)return;
    const d=diagnostics(sim),status=sim.status==='CAPTURE'?t('capture'):placing?t('placing'):!running||ctx.isPaused()?t('ready'):sim.enabled?t('running'):t('off');
    const run=$('#runInteractionBtn');if(run){run.textContent=label();run.disabled=false;}
    const viewButton=$('#viewModes [data-view="structure"]');if(viewButton&&viewButton.textContent!==t('title'))viewButton.textContent=t('title');
    const out=$('#mo-diagnostics');if(out)out.innerHTML=`<strong class="${sim.status==='CAPTURE'?'m-orch-alert':''}" id="mo-state">${status}</strong><div class="m-orch-stats"><span>t / T₀<b id="mo-time">${sim.time.toFixed(2)}</b></span><span>${t('count')}<b>${d.bodies}</b></span><span>${t('active')}<b id="mo-active">${d.activeChannels}</b></span><span>${t('passes')}<b id="mo-passes">${d.passes}</b></span><span>${t('distance')}<b id="mo-gap">${fmt(d.minGap)}</b></span><span>${t('work')}<b>${d.work.toExponential(3)}</b></span><span>${t('loss')}<b>${d.radiated.toExponential(3)}</b></span><span>${t('error')}<b>${d.energyResidual.toExponential(2)}</b></span></div>`;
    const pairs=$('#mo-pairs');if(pairs)pairs.innerHTML=Object.values(sim.channels).map(c=>`<tr><th>${c.key}</th><td class="${c.u>.5?'m-orch-lit':''}">${c.u>.5?t('spin'):t('standby')}</td><td>${(1-sim.strength*c.u).toFixed(4)}</td><td>(${fmt(c.nx)}, ${fmt(c.nz)})</td></tr>`).join('');
    const log=$('#mo-log');if(log)log.textContent=sim.events.slice(-18).map(e=>`${e.t.toFixed(2)}  ${e.pair}  ${e.type}`).join('\n')||t('noEvents');
    $('#sceneScale').textContent=`${sim.bodies.length} BH · M spin 2 · t=${sim.time.toFixed(1)} T₀ · ${t('selected')} G_eff`;
    $('#telemetryScale').textContent='L₀ = 500 km';$('#telemetryState').textContent=status;
  }
  return {panel,bind,build,tick,reset:()=>reset(),select:()=>{sim=null;draft=[];running=false;placing=false;report=null;ensure();},toggle,label,mapClick,result,fitCamera,getSnapshot:()=>({diagnostics:diagnostics(ensure()),initial:structuredClone(draft),bodies:structuredClone(sim.bodies),channels:structuredClone(sim.channels)})};
}
