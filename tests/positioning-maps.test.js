import test from 'node:test';
import assert from 'node:assert/strict';
import { reportPositioningMaps, groupPositioningPoints } from '../src/utils/positioningMaps.js';
import { completeCpmEstimates } from '../src/utils/cpmEstimates.js';
const factors=['social','website','product_service','industry_specific'].map(id=>({id,label:id,weight:.25,dependentVariables:[{id:'g',weight:1,independentVariables:[{id:'c',weight:1,scoring:{type:'range',min:0,max:3}}]}]}));
function report(){return {cpmModel:{factors},cpmMatrix:{rows:Array.from({length:11},(_,i)=>({name:`brand ${i}`,isTarget:i===0,comparable:i<2,factorScores:Object.fromEntries(factors.map(f=>[f.id,{score:i<2?.7:null,dependentScores:{g:{score:i<2?.7:null,independentScores:{c:{rawScore:i<2?2.1:null,normalizedScore:i<2?.7:null,status:i<2?'scored':'not_available',evidenceIds:[]}}}}}]))}))}};}
test('estimate-enabled maps contain all 11 brands on all four maps and match the CPM table',()=>{
 const data=report();data.cpmEstimation={enabled:true};const original=structuredClone(data);
 const maps=reportPositioningMaps(data),table=completeCpmEstimates(data.cpmModel,data.cpmMatrix);
 assert.equal(maps.length,4);
 for(const map of maps){assert.equal(map.source,'cpm_factor_estimates');assert.equal(map.data.length,11);assert.equal(map.data.filter(p=>p.isTarget).length,1);
 for(const point of map.data){const row=table.rows.find(r=>r.name===point.name);assert.equal(point.x,row.factorScores[map.xFactorId].score);assert.equal(point.y,row.factorScores[map.yFactorId].score);}}
 assert.deepEqual(data,original);
});
test('observed-only reports retain the evidence filter',()=>{for(const map of reportPositioningMaps(report())){assert.equal(map.data.length,2);assert.equal(map.source,'cpm_factor_scores');}});
test('overlapping target and rivals remain separately identifiable without moving coordinates',()=>{
 const points=[{name:'target',x:.70001,y:.8,isTarget:true},{name:'rival',x:.70002,y:.8,isTarget:false,estimated:true},{name:'other',x:.9,y:.5,isTarget:false}];
 const groups=groupPositioningPoints(points);assert.equal(groups.length,2);assert.equal(groups[0].members.length,2);assert.equal(groups[0].isTarget,true);assert.equal(groups[0].estimated,true);assert.equal(groups[0].x,points[0].x);assert.deepEqual(groups.flatMap(g=>g.members),points);
});

test('website score updates rebuild both website maps instead of using saved maps', () => {
 const data=report();
 data.positioningMaps=reportPositioningMaps(data);
 data.cpmMatrix.rows[0].factorScores.website.score=.21;
 const maps=reportPositioningMaps(data);
 assert.equal(maps.find(map=>map.yFactorId==='website').data[0].y,.21);
 assert.equal(maps.find(map=>map.xFactorId==='website').data[0].x,.21);
 assert.equal(data.positioningMaps[0].data[0].y,.7);
});

test('each coincident brand gets a separate symbol position while scores remain unchanged', async () => {
 const {layoutPositioningMarkers}=await import('../src/utils/positioningMaps.js');
 for(const width of [180,400,800]) {
 const points=Array.from({length:11},(_,i)=>({name:`brand ${i}`,x:.7,y:.85,symbolIndex:i}));
 const result=layoutPositioningMarkers(points,[0,1],width,240);
 assert.equal(result.length,11);
 for(const [i,p] of result.entries()) {
 assert.equal(p.x,points[i].x);assert.equal(p.y,points[i].y);assert.equal(p.symbolIndex,i);
 for(const other of result.slice(0,i)) assert.ok(Math.hypot(p.markerDx-other.markerDx,p.markerDy-other.markerDy)>=28);
 }
 assert.deepEqual(result,layoutPositioningMarkers(points,[0,1],width,240));
 }
});
