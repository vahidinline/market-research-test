import test from 'node:test';
import assert from 'node:assert/strict';
import { editReportProse, editableReportFields, validateRewrites } from '../src/utils/reportEditor.js';
import { validatePlainSummary } from '../src/utils/plainLanguage.js';
import { factorOverviewRows } from '../src/utils/factorOverviews.js';
import { createStageRunner } from '../src/utils/analysisStages.js';
import { BASE_SOCIAL_CRITERIA, BASE_WEBSITE_CRITERIA, PROJECT_DIGITAL_CRITERIA, restoreSocialCriteria } from '../src/utils/socialCriteria.js';

test('base criteria are distinguished from the three reference-project additions', () => {
 assert.equal(BASE_SOCIAL_CRITERIA.length,8); assert.equal(BASE_WEBSITE_CRITERIA.length,1); assert.equal(PROJECT_DIGITAL_CRITERIA.length,3);
 const model=restoreSocialCriteria({factors:[{id:'social',dependentVariables:[]},{id:'website',dependentVariables:[]}]});
 model.factors[0].dependentVariables[0].independentVariables=model.factors[0].dependentVariables[0].independentVariables.filter(c=>!c.id.startsWith('candidate_'));
 assert.deepEqual(restoreSocialCriteria(model),model,'operator removal of optional reference additions survives reopening');
});
test('overview rows preserve namespaced brand, criterion and evidence identity', () => {
 const rows=factorOverviewRows({id:'social',dependentVariables:[{id:'quality',independentVariables:[{id:'written',label:'کیفیت متن'}]}]},[{name:'Brand',factorScores:{social:{dependentScores:{quality:{independentScores:{written:{rawScore:2,evidenceIds:['e1'],evidence:'متن خوانا'}}}}}}}]);
 assert.equal(rows[0].businessId,'b1'); assert.equal(rows[0].criterionId,'written'); assert.deepEqual(rows[0].evidenceIds,['e1']); assert.equal(rows[0].rawScore,2);
});
test('editor rejects added numbers and duplicate or unknown fields', () => {
 const group=[{id:'a',text:'این صفحه ۹۲۶ دنبال‌کننده دارد.'}];
 assert.throws(()=>validateRewrites({edits:[{id:'a',text:'این صفحه 927 دنبال‌کننده دارد.'}]},group));
 assert.doesNotThrow(()=>validateRewrites({edits:[{id:'a',text:'تعداد دنبال‌کنندگان این صفحه 926 نفر است.'}]},group));
 assert.throws(()=>validateRewrites({edits:[{id:'b',text:group[0].text}]},group));
 assert.throws(()=>validatePlainSummary('سهم بازار 80 درصد است.',[{evidence:'متن'}]));
});
test('semantic review rejects changed meaning while score models and evidence stay untouched', async () => {
 const report={industryOverview:'نتیجه خدمات مشخص نیست.',recommendations:[{description:'تبیین خدمات'}],cpmModel:{description:'اصل',weight:.25},researchEvidence:[{description:'متن منبع'}],cpmEvaluations:[{score:.73}]};
 const fields=editableReportFields(report);assert.equal(fields.length,2);
 const output=await editReportProse(report,{run:async(id,prompt,validate)=>id.startsWith('editorial:rewrite')?validate({edits:fields.map((f,i)=>({...f,text:i?'خدمات را توضیح دهید.':'کیفیت خدمات عالی است.'}))}):validate({approvedIds:[fields[1].id]})});
 assert.equal(output.industryOverview,report.industryOverview);assert.equal(output.recommendations[0].description,'خدمات را توضیح دهید.');
 for(const key of ['cpmModel','cpmEvaluations','researchEvidence']) assert.deepEqual(output[key],report[key]);
 assert.equal(output.editorialRevision.retained.length,1);assert.equal(report.recommendations[0].description,'تبیین خدمات');
});
test('editorial repair does not inject technical scoring rules',async()=>{
 let calls=0; const run=createStageRunner({execute:async(id,prompt)=>{if(calls++){assert.ok(!prompt.includes('Every factual score'));return {ok:true};}return {};}});
 await run('editorial:test','Write clearly',value=>{if(!value.ok)throw new Error('unclear');return value;});
});

test('failed style repair keeps original prose; durable storage failures still stop completion',async()=>{
 const source={industryOverview:'متن اصلی 12'};
 const edited=await editReportProse(source,{run:async()=>{throw Object.assign(new Error('bad rewrite'),{code:'EDITORIAL_INVALID'});}});
 assert.equal(edited.industryOverview,source.industryOverview);assert.equal(edited.editorialRevision.retained[0].reason,'invalid_rewrite');
 await assert.rejects(editReportProse(source,{run:async()=>{throw Object.assign(new Error('save failed'),{code:'STORAGE_FAILED'});}}),/save failed/);
});
test('factor introductions are editable but supporting source records remain unchanged',()=>{
 const report={factorOverviews:{social:'متن مقدمه'},factorOverviewSources:{social:[{evidence:'شاهد اصلی',summary:'اصل'}]}};
 assert.deepEqual(editableReportFields(report),[{id:'["factorOverviews","social"]',text:'متن مقدمه'}]);
});
test('score explanations can be edited but numeric scores, evidence IDs and source excerpts cannot',async()=>{
 const report={cpmEvaluations:[{factorScores:{social:{score:.3,dependentScores:{quality:{independentScores:{written:{rawScore:1,evidence:'تبیین شواهد',evidenceIds:['e1']}}}}}}}],researchEvidence:[{excerpt:'تبیین شواهد'}]};
 const fields=editableReportFields(report);assert.equal(fields.length,1);assert.match(fields[0].id,/evidence/);
 const result=await editReportProse(report,{run:async(id,prompt,validate)=>validate(id.includes(':rewrite:')?{edits:[{...fields[0],text:'توضیح شواهد'}]}:{approvedIds:[fields[0].id]})});
 assert.equal(result.cpmEvaluations[0].factorScores.social.score,.3);
 const scored=result.cpmEvaluations[0].factorScores.social.dependentScores.quality.independentScores.written;
 assert.equal(scored.rawScore,1);assert.deepEqual(scored.evidenceIds,['e1']);assert.deepEqual(result.researchEvidence,report.researchEvidence);
});
test('Persian decimal and thousands separators do not create false numeric failures',()=>{
 assert.doesNotThrow(()=>validateRewrites({edits:[{id:'a',text:'امتیاز ۰٫۷۵ و تعداد ۱٬۲۳۴'}]},[{id:'a',text:'امتیاز 0.75 و تعداد 1234'}]));
 assert.doesNotThrow(()=>validatePlainSummary('امتیاز ۰٫۷۵ است.',[{rawScore:.75}]));
});
test('an expanded rewrite cannot overflow the subsequent review prompt',()=>{
 assert.throws(()=>validateRewrites({edits:[{id:'a',text:'متن '.repeat(1000)}]},[{id:'a',text:'متن کوتاه'}]),error=>error.code==='EDITORIAL_INVALID');
});
test('legacy score arrays require explicit brand association before summary generation',()=>{
 assert.throws(()=>factorOverviewRows({id:'website',dependentVariables:[]},[{factorScores:{}}]),/نام برند/);
});

test('stored HTML audit reaches scoring without changing existing evidence IDs or claiming tested booking',async()=>{
 const {businessEvidence}=await import('../src/utils/researchEvidence.js');
 const input={website:'https://test.example',websiteData:{url:'https://test.example',status:200,pages:[{text:'خدمات',url:'https://test.example'}],hasBooking:true,seo:{overall:71,checks:{https:true,sitemap:false}}}};
 const before=businessEvidence({...input,websiteData:{...input.websiteData,seo:null}});
 const after=businessEvidence(input);
 assert.deepEqual(after.slice(0,before.length),before);
 assert.equal(after.at(-1).metrics.seo.overall,71);assert.equal(after.at(-1).metrics.interactionTested,false);assert.equal(after.at(-1).channel,'website');
 assert.equal(after.at(-1).metrics.bookingKeywordFound,true);
});
