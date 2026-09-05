// Display timeline over a precomputed damage graph, NOT radiation transport.
export function repairFrame(time,index,count,initialI=-3) {
  const hit=.9+index*Math.min(.18,7/Math.max(1,count));
  const crossing=Math.max(0,Math.min(1,(time-hit-.03)/.7));
  const i=crossing===1?0:initialI*(1-crossing);
  return {hit,photonVisible:time>=hit-.8&&time<hit,
    photonProgress:Math.max(0,Math.min(1,(time-hit+.8)/.8)),
    damaged:time>=hit,age:Math.max(0,time-hit),i,
    // A thin visible projection layer: geometry remains full size throughout.
    opacity:Math.max(0,Math.min(1,1+i/.35)),placed:time>=hit+.9};
}
