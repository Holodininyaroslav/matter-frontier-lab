import test from 'node:test';
import assert from 'node:assert/strict';
import {repairFrame} from '../matter-lab/gamma-repair-timeline.mjs';
test('Side photon arrives before damage and i-coordinate replacement',()=>{
  const f=repairFrame(.5,0,20);
  assert.equal(f.photonVisible,true);
  assert.equal(f.damaged,false);
  assert.equal(f.opacity,0);
  assert.equal(repairFrame(.91,0,20).damaged,true);
  assert.equal(repairFrame(.91,0,20).opacity,0);
  assert.equal(repairFrame(2,0,20).placed,true);
  assert.equal(repairFrame(2,0,20).i,0);
});
test('Projection appears only as i crosses the thin visible slice',()=>{
  let previous=-3;
  for(let t=0;t<3;t+=.01){
    const f=repairFrame(t,0,20);
    assert.ok(f.i>=previous);previous=f.i;
    assert.ok(f.opacity>=0&&f.opacity<=1);
    if(f.i<=-.35)assert.equal(f.opacity,0);
  }
});
