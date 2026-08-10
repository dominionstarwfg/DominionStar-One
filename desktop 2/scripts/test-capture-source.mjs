import assert from 'node:assert/strict';
import {isDominionStarCaptureSource,resolveCaptureSource,visibleCaptureSources} from '../src/capture-source.mjs';

const sources=[
  {id:'screen:new:0',display_id:'42',name:'Entire Screen'},
  {id:'window:new:7',display_id:'',name:'Quarterly Presentation'}
];

assert.equal(resolveCaptureSource(sources,{sourceId:'screen:old:0',kind:'screen',displayId:'42'})?.id,'screen:new:0');
assert.equal(resolveCaptureSource(sources,{sourceId:'window:old:7',kind:'window',sourceName:' quarterly presentation '})?.id,'window:new:7');
assert.equal(resolveCaptureSource(sources,{sourceId:'missing',kind:'window',sourceName:'Unknown'}),null);

const pickerSources=[
  ...sources,
  {id:'window:101:0',name:'DominionStar Meet'},
  {id:'window:102:0',name:'DOMINIONSTAR MEET — Personal Room'},
  {id:'window:103:0',name:'Private browser'}
];
assert.equal(isDominionStarCaptureSource(pickerSources[2]),true);
assert.deepEqual(visibleCaptureSources(pickerSources).map(source=>source.id),['screen:new:0','window:new:7','window:103:0']);
assert.equal(visibleCaptureSources(pickerSources,{includeOwnWindows:true}).length,pickerSources.length);
console.log('Desktop capture source recovery passed.');
