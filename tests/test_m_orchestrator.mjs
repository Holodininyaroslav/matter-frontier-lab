import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,presetBodies,advance,step,diagnostics,verifyPreset,validateBodies,accelerations} from '../matter-lab/m-orchestrator.mjs';

for (const n of [2,3,4]) {
  test(`${n} bodies: M-only controller produces safe tangential scattering; same initial data without it reaches capture`,()=>{
    const on=verifyPreset(n),off=verifyPreset(n,240,{enabled:false});
    assert.equal(on.passed,true);
    assert.ok(on.minGap>4);
    assert.equal(on.captures,0);
    assert.ok(off.captures>0);
    assert.ok(Math.hypot(on.momentum.x,on.momentum.z)<1e-10);
    assert.ok(Math.abs(on.energyResidual)<1e-5,'M-field work and dissipated energy close the balance');
  });
}

test('No spurious direction reversal or velocity kick when the M channel switches',()=>{
  const sim=createSimulation();let maxDv=0;
  for(let i=0;i<60000;i++){
    const previous=structuredClone(sim.bodies);step(sim);
    assert.ok(diagnostics(sim).angular>0);
    sim.bodies.forEach((b,i)=>{maxDv=Math.max(maxDv,Math.hypot(b.vx-previous[i].vx,b.vz-previous[i].vz));});
  }
  assert.ok(sim.activations>0);
  assert.ok(maxDv<.01,'velocities change by integrated force, not a controller impulse');
});

test('Time-step convergence and frame chunk independence',()=>{
  const a=createSimulation(presetBodies(4)),b=createSimulation(presetBodies(4),{stepSize:.004});
  advance(a,120);advance(b,120);
  a.bodies.forEach((p,i)=>assert.ok(Math.hypot(p.x-b.bodies[i].x,p.z-b.bodies[i].z)<.02));
  const c=createSimulation();for(let i=0;i<1000;i++)advance(c,.12);
  const d=createSimulation();advance(d,120);
  c.bodies.forEach((p,i)=>assert.ok(Math.hypot(p.x-d.bodies[i].x,p.z-d.bodies[i].z)<.01));
});

test('Exact radial collision is reported, not hidden by a fake tangential controller',()=>{
  const bodies=presetBodies(2).map(b=>({...b,vx:-b.x*.015,vz:-b.z*.015}));
  const sim=createSimulation(bodies);advance(sim,240);
  assert.ok(sim.captures>0);
  assert.equal(sim.status,'CAPTURE');
});

test('Zero screening cannot prevent capture despite enabled channel logic',()=>{
  assert.ok(verifyPreset(2,240,{strength:0}).captures>0);
});

test('All computed pair forces remain attractive and action/reaction symmetric',()=>{
  const sim=createSimulation();advance(sim,32);
  const f=accelerations(sim),[a,b]=sim.bodies;
  assert.ok(f[0].x*(b.x-a.x)+f[0].z*(b.z-a.z)>=0);
  assert.ok(Math.abs(a.mass*f[0].x+b.mass*f[1].x)<1e-12);
  assert.ok(Math.abs(a.mass*f[0].z+b.mass*f[1].z)<1e-12);
});

test('Constructor rejects overlapping horizons, duplicate IDs and invalid coordinates',()=>{
  const bodies=presetBodies();bodies[1].x=bodies[0].x;bodies[1].z=bodies[0].z;
  assert.throws(()=>validateBodies(bodies),/overlap/);
  assert.throws(()=>validateBodies([presetBodies()[0],presetBodies()[0]]),/Duplicate/);
  assert.throws(()=>validateBodies(presetBodies().map(b=>({...b,x:NaN}))),/Invalid/);
});

test('Switching the field off mid-run leaves position and velocity continuous',()=>{
  const sim=createSimulation();advance(sim,32);
  const before=structuredClone(sim.bodies);sim.enabled=false;
  assert.deepEqual(sim.bodies,before);
  step(sim);
  sim.bodies.forEach((b,i)=>assert.ok(Math.hypot(b.vx-before[i].vx,b.vz-before[i].vz)<.01));
});

for(const n of [2,3,4]) test(`${n} bodies repeat cyclic encounters for 600 model time units`,()=>{
  const sim=createSimulation(presetBodies(n));
  let largestRadius=0;
  for(let t=0;t<600;t++) {
    advance(sim,1);
    largestRadius=Math.max(largestRadius,...sim.bodies.map(b=>Math.hypot(b.x,b.z)));
  }
  assert.equal(sim.captures,0);
  assert.ok(sim.activations>=6);
  assert.ok(sim.escapes>=6);
  assert.ok(sim.events.some(e=>e.type==='ATTRACTION_RESTORED'));
  assert.ok(largestRadius<25,'preset stays spatially bounded over the tested interval');
  assert.ok(Math.abs(diagnostics(sim).energyResidual)<1e-5);
});
