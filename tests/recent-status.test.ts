import test from 'node:test';import assert from 'node:assert/strict';import {recentCollectionLabel,type HistoricalMeta} from '../lib/historical-api';
const now=Date.parse('2026-11-26T04:00:00Z');
const meta:HistoricalMeta={network:'test',observedAt:new Date(now).toISOString(),snapshot:'snapshot',sync:{workerState:'running',workerObservedAt:new Date(now).toISOString(),lastSuccessfulCollectionAt:new Date(now-1000).toISOString(),finalizedObservedAt:new Date(now).toISOString(),observationStale:false,currentLatestnessConfirmed:false}};
test('Recent copy distinguishes observed running, stopped, stale and unknown in both languages',()=>{
 for(const ko of [true,false]){
  assert.match(recentCollectionLabel(meta,ko,now),ko?/마지막 관측 기준/:/as last observed/);
  assert.match(recentCollectionLabel({...meta,sync:{...meta.sync!,workerState:'stopped'}},ko,now),ko?/일시 중단/:/stopped/);
  assert.match(recentCollectionLabel({...meta,sync:{...meta.sync!,observationStale:true}},ko,now),ko?/최신 기록 반영 여부 확인 불가/:/latest coverage unconfirmed/);
  for(const v of [{...meta,sync:undefined},meta])assert.match(recentCollectionLabel(v,ko,now+90001),ko?/상태 확인 불가/:/status unavailable/);
 }
});

test("Recent health survives the deployed Gateway window contract",()=>{const v={...meta,sync:undefined,window:{requestedRange:{from:0,through:0},finalizedAnchor:{number:0,hash:"h",observedAt:meta.observedAt},collectionStatus:"complete",completedThrough:0,unscannedGap:null,sync:meta.sync}};assert.equal(recentCollectionLabel(v,true,now),recentCollectionLabel(meta,true,now));});
