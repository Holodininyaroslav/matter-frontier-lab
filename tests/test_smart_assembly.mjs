import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssembly,startAssembly,advanceAssembly,assemblyFrame} from '../matter-lab/smart-assembly.mjs';
const particles=Array.from({length:9},(_,i)=>({position:{i:-3-i*.2}}));
test('Ready scene has only the target matrix: all real particles are hidden',()=>{
  const s=createAssembly(particles);advanceAssembly(s,100);
  const f=assemblyFrame(s);assert.equal(f.phase,'READY');assert.equal(f.visible,0);
  assert.ok(f.atoms.every(a=>a.i<0&&a.scale===1));
});
test('Particles cross i and take their places strictly one at a time',()=>{
  const s=createAssembly(particles);startAssembly(s);
  for(let t=0;t<24;t+=.013){
    advanceAssembly(s,.013);const f=assemblyFrame(s);
    assert.ok(f.visible-f.placed<=1);
    f.atoms.forEach((a,i)=>{
      if(a.i>-3-i*.2 && i>0)assert.equal(f.atoms[i-1].placed,true);
      assert.equal(a.visible,a.i===0);assert.equal(a.scale,1);
      if(a.navigation>0)assert.equal(a.visible,true);
    });
  }
  assert.equal(s.phase,'STABLE');assert.equal(assemblyFrame(s).placed,9);
});
test('Pause, live speed changes, restart and frame chunking preserve order',()=>{
  const a=createAssembly(particles);startAssembly(a);advanceAssembly(a,.3);
  const paused=structuredClone(a);advanceAssembly(a,0);assert.deepEqual(a,paused);
  advanceAssembly(a,.1,2,.35);assert.equal(assemblyFrame(a).visible,0);
  startAssembly(a);assert.equal(assemblyFrame(a).visible,0);
  const b=createAssembly(particles);startAssembly(b);
  advanceAssembly(a,6);for(let i=0;i<600;i++)advanceAssembly(b,.01);
  const fa=assemblyFrame(a),fb=assemblyFrame(b);
  assert.equal(fa.phase,fb.phase);assert.equal(fa.placed,fb.placed);
  fa.atoms.forEach((atom,i)=>assert.ok(Math.abs(atom.i-fb.atoms[i].i)<1e-9));
});
