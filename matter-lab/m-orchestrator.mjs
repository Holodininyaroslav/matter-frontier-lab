// Author-defined M-field experiment. This is NOT GR, a graviton solver, or an
// established spin-2 screening effect. The only controller actuator is u_ij:
// the occupation of a local, oriented spin-2 M-field channel between i and j.
// F_ij = (1-k*u_ij) G mi mj r_ij / (r²+eps²)^(3/2).
// All bodies are integrated; no orbit placement, velocity reversal, minimum
// separation clamp, or tangential thrust is applied by the controller.
export const UNITS = { lengthKm: 500, massSolar: 30, timeSeconds: .0056036, radiusPerMass: .177195 };
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
export const radiusOf = mass => UNITS.radiusPerMass * mass;

export function presetBodies(count=2, seed=1) {
  count=clamp(Math.round(count),2,8);
  let s=seed>>>0;
  const random=()=>((s=(1664525*s+1013904223)>>>0)/4294967296);
  const phase=(random()-.5)*.25;
  return Array.from({length:count},(_,i)=>{
    const angle=2*Math.PI*i/count+phase;
    const radius=7+(count-2)*1.1;
    // Nonzero angular momentum is essential: weakening attraction cannot
    // deflect a perfectly radial, zero-impact-parameter collision sideways.
    let inwardGravity=0;
    for(let j=1;j<count;j++) inwardGravity+=1/(4*radius*radius*Math.sin(Math.PI*j/count));
    const vt=.20*Math.sqrt(inwardGravity*radius);
    return {id:String.fromCharCode(65+i),mass:1,x:radius*Math.cos(angle),z:radius*Math.sin(angle),
      vx:-vt*Math.sin(angle)-.012*Math.cos(angle),vz:vt*Math.cos(angle)-.012*Math.sin(angle)};
  });
}

export function validateBodies(bodies) {
  if(bodies.length<2 || bodies.length>8) throw Error('Use 2–8 black holes.');
  const ids=new Set();
  for(const b of bodies) {
    if(ids.has(b.id)) throw Error('Duplicate body ID.');
    ids.add(b.id);
    if(![b.mass,b.x,b.z,b.vx,b.vz].every(Number.isFinite)||b.mass<=0) throw Error('Invalid mass or coordinates.');
  }
  for(let i=0;i<bodies.length;i++) for(let j=i+1;j<bodies.length;j++)
    if(Math.hypot(bodies[i].x-bodies[j].x,bodies[i].z-bodies[j].z)<=radiusOf(bodies[i].mass+bodies[j].mass))
      throw Error('Initial horizons overlap. Move the bodies apart.');
}

export function createSimulation(bodies=presetBodies(), options={}) {
  validateBodies(bodies);
  const sim={bodies:structuredClone(bodies),initial:structuredClone(bodies),time:0,stepSize:options.stepSize||.002,
    enabled:options.enabled??true,cyclic:options.cyclic??true,strength:options.strength??.999,activation:options.activation??6.5,
    softening:.025,radiation:options.radiation??.002,channels:{},events:[],history:[],work:0,radiated:0,
    minGap:Infinity,minDistance:Infinity,captures:0,activations:0,escapes:0,status:'READY',accumulator:0};
  sim.initialEnergy=energy(sim);
  sample(sim);
  return sim;
}

function pairData(a,b) {
  const dx=b.x-a.x,dz=b.z-a.z,r=Math.hypot(dx,dz),vx=b.vx-a.vx,vz=b.vz-a.vz;
  const radial=(dx*vx+dz*vz)/r, h=dx*vz-dz*vx, mu=a.mass+b.mass;
  const specificEnergy=(vx*vx+vz*vz)/2-mu/r;
  const e=Math.sqrt(Math.max(0,1+2*specificEnergy*h*h/(mu*mu)));
  const pericenter=h*h/(mu*(1+e));
  return {dx,dz,r,vx,vz,radial,h,pericenter,capture:radiusOf(mu)};
}

function updateChannels(sim,dt) {
  const seen=new Set();
  for(let i=0;i<sim.bodies.length;i++) for(let j=i+1;j<sim.bodies.length;j++) {
    const a=sim.bodies[i],b=sim.bodies[j],key=`${a.id}:${b.id}`,p=pairData(a,b);
    seen.add(key);
    const c=sim.channels[key] ||= {key,a:a.id,b:b.id,u:0,latched:false,passed:false};
    const trigger=Math.max(sim.activation,5*p.capture);
    const risk=p.pericenter<Math.max(3*p.capture,1.4);
    if(sim.enabled && !c.latched && p.radial<0 && p.r<trigger && risk) {
      c.latched=true; c.passed=false; c.entryRadius=p.r; sim.activations++;
      sim.events.push({t:sim.time,type:'SPIN_2_ON',pair:key,pericenter:p.pericenter});
    }
    if(c.latched && p.radial>0 && !c.passed) {
      c.passed=true;sim.escapes++;sim.events.push({t:sim.time,type:'TANGENTIAL_PASS',pair:key,r:p.r});
    }
    // Restore attraction at the entry radius, not far outside it. Symmetric
    // switching returns the screening energy to the M-field rather than
    // injecting enough net work for unbound scattering. No velocity is reset.
    if(c.latched && p.radial>0 && p.r>(sim.cyclic?c.entryRadius:trigger*1.65)) {
      c.latched=false;
      sim.events.push({t:sim.time,type:'ATTRACTION_RESTORED',pair:key,r:p.r});
    }
    if(!sim.enabled)c.latched=false;
    const previous=c.u,target=c.latched?1:0;
    // Finite response, not an instantaneous velocity impulse. k*u is always
    // <=1: this law can screen attraction, never turn it into repulsion.
    c.u=target+(c.u-target)*Math.exp(-dt/((target||sim.cyclic)?.035:.7));
    sim.work+=sim.strength*(c.u-previous)*a.mass*b.mass/Math.sqrt(p.r*p.r+sim.softening**2);
    Object.assign(c,{x:(a.x+b.x)/2,z:(a.z+b.z)/2,nx:p.dx/p.r,nz:p.dz/p.r,
      distance:p.r,radial:p.radial,pericenter:p.pericenter,capture:p.capture,
      coupling:1-sim.strength*c.u,risk});
  }
  for(const key of Object.keys(sim.channels)) if(!seen.has(key)) delete sim.channels[key];
}

export function accelerations(sim) {
  const out=sim.bodies.map(()=>({x:0,z:0}));
  for(let i=0;i<sim.bodies.length;i++) for(let j=i+1;j<sim.bodies.length;j++) {
    const a=sim.bodies[i],b=sim.bodies[j],dx=b.x-a.x,dz=b.z-a.z;
    const u=sim.channels[`${a.id}:${b.id}`]?.u||0;
    const q=(1-sim.strength*u)/Math.pow(dx*dx+dz*dz+sim.softening**2,1.5);
    out[i].x+=b.mass*q*dx;out[i].z+=b.mass*q*dz;
    out[j].x-=a.mass*q*dx;out[j].z-=a.mass*q*dz;
  }
  return out;
}

export function energy(sim) {
  let e=sim.bodies.reduce((sum,b)=>sum+b.mass*(b.vx*b.vx+b.vz*b.vz)/2,0);
  for(let i=0;i<sim.bodies.length;i++) for(let j=i+1;j<sim.bodies.length;j++) {
    const a=sim.bodies[i],b=sim.bodies[j],u=sim.channels[`${a.id}:${b.id}`]?.u||0;
    e-=(1-sim.strength*u)*a.mass*b.mass/Math.sqrt((a.x-b.x)**2+(a.z-b.z)**2+sim.softening**2);
  }
  return e;
}

function radiationKick(sim,dt) {
  // Dissipative educational proxy. This is not calibrated GW radiation
  // reaction; no PyCBC / Einstein Toolkit output is claimed here.
  for(let i=0;i<sim.bodies.length;i++) for(let j=i+1;j<sim.bodies.length;j++) {
    const a=sim.bodies[i],b=sim.bodies[j],p=pairData(a,b),u=sim.channels[`${a.id}:${b.id}`]?.u||0;
    const loss=1-Math.exp(-dt*sim.radiation*(1-sim.strength*u)**2*(a.mass+b.mass)**2/Math.max(p.r,.1)**3);
    const fractionA=b.mass/(a.mass+b.mass),fractionB=a.mass/(a.mass+b.mass);
    const before=(a.mass*(a.vx*a.vx+a.vz*a.vz)+b.mass*(b.vx*b.vx+b.vz*b.vz))/2;
    a.vx+=p.vx*loss*fractionA;a.vz+=p.vz*loss*fractionA;
    b.vx-=p.vx*loss*fractionB;b.vz-=p.vz*loss*fractionB;
    sim.radiated+=before-(a.mass*(a.vx*a.vx+a.vz*a.vz)+b.mass*(b.vx*b.vx+b.vz*b.vz))/2;
  }
}

export function step(sim,dt=sim.stepSize) {
  if(sim.status==='CAPTURE') return;
  updateChannels(sim,dt);
  radiationKick(sim,dt/2);
  const before=accelerations(sim);
  sim.bodies.forEach((b,i)=>{b.vx+=before[i].x*dt/2;b.vz+=before[i].z*dt/2;b.x+=b.vx*dt;b.z+=b.vz*dt;});
  const after=accelerations(sim);
  sim.bodies.forEach((b,i)=>{b.vx+=after[i].x*dt/2;b.vz+=after[i].z*dt/2;});
  radiationKick(sim,dt/2);
  sim.time+=dt;sim.status=sim.enabled?'RUNNING':'FIELD_OFF';
  for(let i=0;i<sim.bodies.length;i++)for(let j=i+1;j<sim.bodies.length;j++) {
    const p=pairData(sim.bodies[i],sim.bodies[j]);
    sim.minDistance=Math.min(sim.minDistance,p.r);sim.minGap=Math.min(sim.minGap,p.r/p.capture);
    if(p.r<=p.capture) {
      sim.captures++;sim.status='CAPTURE';
      sim.events.push({t:sim.time,type:'CAPTURE',pair:`${sim.bodies[i].id}:${sim.bodies[j].id}`});
      // Stop at the approximation boundary. No fake safe orbit or fabricated
      // numerical-relativity merger is substituted for an actual collision.
    }
  }
  if(!sim.bodies.every(b=>[b.x,b.z,b.vx,b.vz].every(Number.isFinite)))throw Error('Non-finite trajectory');
  if(!sim.history.length || sim.time-sim.history.at(-1).t>=.24)sample(sim);
}

function sample(sim) {
  const a=accelerations(sim);
  let plus=0,cross=0,min=Infinity;
  sim.bodies.forEach((b,i)=>{
    plus+=2*b.mass*(b.vx*b.vx-b.vz*b.vz+b.x*a[i].x-b.z*a[i].z);
    cross+=2*b.mass*(2*b.vx*b.vz+b.x*a[i].z+b.z*a[i].x);
  });
  for(let i=0;i<sim.bodies.length;i++)for(let j=i+1;j<sim.bodies.length;j++)min=Math.min(min,pairData(sim.bodies[i],sim.bodies[j]).r);
  sim.history.push({t:sim.time,plus,cross,min});
  if(sim.history.length>1200)sim.history.shift();
}

export function advance(sim,duration) {
  sim.accumulator+=Math.max(0,duration);
  while(sim.accumulator+1e-10>=sim.stepSize && sim.status!=='CAPTURE') {step(sim);sim.accumulator-=sim.stepSize;}
}

export function diagnostics(sim) {
  const momentum=sim.bodies.reduce((s,b)=>({x:s.x+b.mass*b.vx,z:s.z+b.mass*b.vz}),{x:0,z:0});
  const angular=sim.bodies.reduce((s,b)=>s+b.mass*(b.x*b.vz-b.z*b.vx),0);
  return {time:sim.time,bodies:sim.bodies.length,captures:sim.captures,activations:sim.activations,passes:sim.escapes,
    minGap:sim.minGap,minDistance:sim.minDistance,work:sim.work,radiated:sim.radiated,
    energyResidual:energy(sim)-sim.initialEnergy-sim.work+sim.radiated,momentum,angular,
    activeChannels:Object.values(sim.channels).filter(c=>c.u>.05).length};
}

export function verifyPreset(count, duration=240, options={}) {
  const sim=createSimulation(presetBodies(count,options.seed||1),options);
  advance(sim,duration);
  const d=diagnostics(sim);
  return {...d,passed:d.captures===0&&d.passes>0&&d.activations>0&&sim.time>=duration-.02,
    criterion:'no capture + actual approach-to-separation turning point + spin activation over finite test window',
    duration,scientificStatus:'AUTHOR-DEFINED M-FIELD LAW; NOT GENERAL RELATIVITY'};
}
