import test from 'node:test';
import assert from 'node:assert/strict';
import {readReportRoute,reportUrl,REPORT_TABS} from '../src/utils/reportRoute.js';

test('each report and tab round-trips through its address for refresh and history',()=>{
 for(const projectId of ['a-123','b-456','گزارش تست'])for(const tab of REPORT_TABS){
 const address=reportUrl('https://market.test/',projectId,tab);
 assert.deepEqual(readReportRoute(address),{projectId,tab,owner:false});
 }
 assert.notEqual(reportUrl('/', 'first','maps'),reportUrl('/','second','maps'));
});
test('home and invalid tabs use the default report tab',()=>{
 assert.deepEqual(readReportRoute('/'),{projectId:null,tab:'industry',owner:false});
 assert.equal(readReportRoute('/?project=a&tab=bad').tab,'industry');
 assert.equal(reportUrl('/','a','bad'),'/?project=a&tab=industry');
});
test('owner tab navigation preserves its scoped access link',()=>{
 const href='https://market.test/?panel=owner&project=a&token=example-token';
 const address=reportUrl(href,'a','cpm');
 const params=new URL(address,'https://market.test').searchParams;
 assert.equal(params.get('token'),'example-token');assert.equal(params.get('panel'),'owner');
 assert.deepEqual(readReportRoute(address),{projectId:'a',tab:'cpm',owner:true});
});
test('return to home clears report navigation and owner authorization parameters',()=>{
 assert.equal(reportUrl('/?project=a&tab=cpm&panel=owner&token=example-token',null),'/');
 assert.equal(reportUrl('/?project=a&tab=cpm&lang=fa',null),'/?lang=fa');
});
