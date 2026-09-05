// Display choreography for the author's i-coordinate hypothesis, not MD.
// The RDKit graph supplies targets; this queue supplies only presentation time.
const clamp = x => Math.max(0, Math.min(1, x));
const rate = x => Number.isFinite(Number(x)) ? Math.max(.05, Number(x)) : 1;
export function createAssembly(particles) {
  return { index:0, phase:'READY', progress:0,
    atoms:particles.map(p=>({initialI:Math.min(-.01, Number(p.position.i)||-3),
      iProgress:0, navigation:0, bonding:0})) };
}
export function startAssembly(sequence) {
  sequence.index=0; sequence.progress=0;
  sequence.phase=sequence.atoms.length?'MATERIALIZING':'STABLE';
  sequence.atoms.forEach(a=>{a.iProgress=0;a.navigation=0;a.bonding=0;});
}
export function advanceAssembly(sequence,dt,materialRate=1,assemblyRate=1) {
  if (!Number.isFinite(dt)||dt<=0) return;
  let left=dt;
  while(left>0 && sequence.phase!=='READY' && sequence.phase!=='STABLE') {
    const atom=sequence.atoms[sequence.index];
    const duration=sequence.phase==='MATERIALIZING'?.7/rate(materialRate)
      :sequence.phase==='NAVIGATING'?1.1/rate(assemblyRate):.22/rate(assemblyRate);
    const consume=Math.min(left,(1-sequence.progress)*duration);
    sequence.progress=clamp(sequence.progress+consume/duration);left-=consume;
    const property=sequence.phase==='MATERIALIZING'?'iProgress'
      :sequence.phase==='NAVIGATING'?'navigation':'bonding';
    atom[property]=sequence.progress;
    if(sequence.progress<1-1e-10) break;
    atom[property]=1;sequence.progress=0;
    if(sequence.phase==='MATERIALIZING')sequence.phase='NAVIGATING';
    else if(sequence.phase==='NAVIGATING')sequence.phase='BONDING';
    else {
      sequence.index++;
      sequence.phase=sequence.index===sequence.atoms.length?'STABLE':'MATERIALIZING';
    }
  }
}
export function assemblyFrame(sequence) {
  const atoms=sequence.atoms.map(a=>({
    i:a.iProgress===1?0:a.initialI*(1-a.iProgress),
    visible:a.iProgress===1, navigation:a.navigation,
    placed:a.navigation===1, bonding:a.bonding,
    scale:1 // i displacement changes visibility, never the particle's size.
  }));
  return {phase:sequence.phase,activeIndex:sequence.index,
    atoms,visible:atoms.filter(a=>a.visible).length,placed:atoms.filter(a=>a.placed).length};
}
