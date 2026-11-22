import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverSeoFiles, seoAudit } from '../public/_worker.js';
import { configureWebsiteScoring, measuredWebsiteScore } from '../src/utils/websiteScoring.js';
import { calculateCpmRow } from '../src/utils/cpm.js';
import reference from '../src/utils/digitalCriteriaReference.json' with { type: 'json' };

test('discovers robots-declared sitemap without a link in HTML, validates XML', async () => {
  const calls=[];
  const result=await discoverSeoFiles('https://example.test/fa',async url=>{
    calls.push(url);
    if(url.endsWith('/robots.txt'))return new Response('User-agent: *\nSitemap: https://example.test/custom.xml');
    if(url.endsWith('/custom.xml'))return new Response('<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap/></sitemapindex>');
    return new Response('<html>SPA fallback</html>');
  });
  assert.equal(result.robots.present,true);assert.equal(result.sitemap.present,true);
  assert.ok(calls.includes('https://example.test/custom.xml'));
});
test('missing paths, blocked requests and HTML fallback never prove sitemap absence',async()=>{
  for(const response of [()=>new Response('Not found',{status:404}),()=>new Response('Denied',{status:403}),()=>new Response('<html>sitemap.xml</html>'),()=>{throw Error('timeout');}]){
    const result=await discoverSeoFiles('https://example.test',async()=>response());
    assert.equal(result.sitemap.present,null);
  }
});
test('HTML mentioning file names is not a file audit',()=>{
  const result=seoAudit('<html>robots.txt sitemap.xml</html>',new URL('https://example.test'),{ok:true,status:200});
  assert.equal(result.checks.sitemap,null);assert.equal(result.checks.robots,null);
});
const evidence=(onPage,sitemap=true)=>[{id:'e1',channel:'website',metrics:{seo:{version:2,onPage,checks:{status:200,https:true,sitemap}}}}];
test('different measured page checks yield different scores; unknown remains null',()=>{
  const c={id:'technical_seo'};
  assert.equal(measuredWebsiteScore(c,evidence(100)).rawScore,3);
  assert.equal(measuredWebsiteScore(c,evidence(400/7)).rawScore,12/7);
  assert.equal(measuredWebsiteScore({id:'candidate_technical_seo_compliance'},evidence(100,null)).rawScore,null);
});
test('website preserves relative criterion weights and reports missing coverage',()=>{
  const model=configureWebsiteScoring({factors:[{...structuredClone(reference[1]),weight:1}]});
  const factor=model.factors[0];
  const factorScores={website:{dependentScores:Object.fromEntries(factor.dependentVariables.map(g=>[g.id,{independentScores:Object.fromEntries(g.independentVariables.map(c=>[c.id,{rawScore:0}]))}]))}};
  const row=calculateCpmRow(model,{factorScores},{name:'test',websiteEvidence:evidence(400/7),strictEvidence:true,evidenceIds:['e1'],evidenceChannels:{e1:'website'}});
  assert.equal(row.factorScores.website.coverage,.75);
  assert.equal(row.factorScores.website.score,.7143);
  assert.equal(row.factorScores.website.dependentScores.supplemental_website.independentScores.candidate_website_ux_lead_tools.rawScore,null);
  const missing=calculateCpmRow(model,{factorScores},{name:'test',websiteEvidence:evidence(400/7,null)});
  assert.equal(missing.factorScores.website.coverage,.5);
  assert.equal(missing.factorScores.website.score,.5714);
});
