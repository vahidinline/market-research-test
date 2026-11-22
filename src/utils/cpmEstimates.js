const round = value => Number(value.toFixed(4));
const median = values => {
  const sorted = [...values].sort((a,b)=>a-b);
  const middle = Math.floor(sorted.length/2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;
};
// A separate scenario, never a replacement for observed scores or evidence.
export function completeCpmEstimates(model, matrix, narratives = {}) {
  if (!model?.factors || !matrix?.rows) return matrix;
  const rows = structuredClone(matrix.rows);
  for (const [index,row] of rows.entries()) {
    let estimatedCount = 0;
    for (const factor of model.factors) {
      const result = row.factorScores[factor.id];
      let factorEstimated = false;
      for (const dependent of factor.dependentVariables) {
        const group = result.dependentScores[dependent.id];
        let groupEstimated = false;
        for (const criterion of dependent.independentVariables) {
          const scored = group.independentScores[criterion.id];
          if (scored.normalizedScore != null) continue;
          const peers = matrix.rows.filter((_,i)=>i!==index).flatMap(peer=>{
            const value=peer.factorScores?.[factor.id]?.dependentScores?.[dependent.id]?.independentScores?.[criterion.id];
            return value?.normalizedScore != null && value.status === 'scored' ? [{name:peer.name,score:value.normalizedScore}] : [];
          });
          const estimate=peers.length ? median(peers.map(peer=>peer.score)) : .5;
          const min=criterion.scoring.type==='binary'?0:Number(criterion.scoring.min??0);
          const max=criterion.scoring.type==='binary'?1:Number(criterion.scoring.max);
          Object.assign(scored,{
            rawScore:round(criterion.scoring.normalization==='ratio'?estimate*max:min+estimate*(max-min)),
            normalizedScore:round(estimate),status:'estimated',estimated:true,evidenceIds:[],
            observedRawScore:null,
            estimation:{method:peers.length?'peer_median':'neutral_assumption',peerCount:peers.length,peers},
            evidence:narratives[`${row.name}|${factor.id}|${dependent.id}|${criterion.id}`] || (peers.length
              ? `برآورد مقایسه‌ای: مقدار میانی امتیاز ${peers.length} برند بررسی‌شده در همین معیار، برای تکمیل مقایسه استفاده شده است.`
              : 'مبنای برآورد: مقدار میانی بازه امتیاز.'),
          });
          estimatedCount++;groupEstimated=true;factorEstimated=true;
        }
        if(groupEstimated){group.observedScore=group.score;group.score=round(dependent.independentVariables.reduce((sum,c)=>sum+group.independentScores[c.id].normalizedScore*Number(c.weight),0));group.estimated=true;}
      }
      result.observedScore=result.score;
      result.score=round(factor.dependentVariables.reduce((sum,d)=>sum+result.dependentScores[d.id].score*Number(d.weight),0));
      result.estimated=factorEstimated;
    }
    row.observedTotal=row.total;
    row.total=round(model.factors.reduce((sum,f)=>sum+row.factorScores[f.id].score*Number(f.weight),0));
    row.estimated=estimatedCount>0;row.estimatedCount=estimatedCount;
  }
  return {rows,method:'peer_median_v1',scenario:true};
}
