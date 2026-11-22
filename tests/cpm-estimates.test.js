import test from 'node:test';
import assert from 'node:assert/strict';
import {completeCpmEstimates} from '../src/utils/cpmEstimates.js';
const model={factors:[{id:'social',weight:1,dependentVariables:[{id:'g',weight:1,independentVariables:[{id:'c',weight:1,scoring:{type:'range',min:0,max:3}}]}]}]};
const row=(name,score)=>({name,total:score,factorScores:{social:{score,dependentScores:{g:{score,independentScores:{c:{normalizedScore:score,rawScore:score==null?null:score*3,status:score==null?'not_available':'scored',evidenceIds:score==null?[]:['e1'],evidence:'original'}}}}}}});
test('estimates from observed peers without changing source matrix or inventing evidence',()=>{
 const matrix={rows:[row('target',null),row('a',.2),row('b',.8)]},before=structuredClone(matrix);
 const result=completeCpmEstimates(model,matrix),scored=result.rows[0].factorScores.social.dependentScores.g.independentScores.c;
 assert.equal(scored.normalizedScore,.5);assert.equal(scored.status,'estimated');assert.equal(scored.estimation.peerCount,2);assert.deepEqual(scored.evidenceIds,[]);
 assert.equal(result.rows[0].total,.5);assert.equal(result.rows[0].observedTotal,null);
 assert.deepEqual(matrix,before);assert.deepEqual(result.rows[1].factorScores.social.dependentScores.g.independentScores.c,matrix.rows[1].factorScores.social.dependentScores.g.independentScores.c);
});
test('all-missing criterion uses explicit neutral assumption, never another estimate as evidence',()=>{
 const result=completeCpmEstimates(model,{rows:[row('a',null),row('b',null)]});
 for(const r of result.rows){const c=r.factorScores.social.dependentScores.g.independentScores.c;assert.equal(c.rawScore,1.5);assert.equal(c.estimation.method,'neutral_assumption');assert.equal(c.estimation.peerCount,0);}
});
