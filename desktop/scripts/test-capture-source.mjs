import assert from 'node:assert/strict';
import {resolveCaptureSource} from '../src/capture-source.mjs';

const sources=[
  {id:'screen:new:0',display_id:'42',name:'Entire Screen'},
  {id:'window:new:7',display_id:'',name:'Quarterly Presentation'}
];

assert.equal(resolveCaptureSource(sources,{sourceId:'screen:old:0',kind:'screen',displayId:'42'})?.id,'screen:new:0');
assert.equal(resolveCaptureSource(sources,{sourceId:'window:old:7',kind:'window',sourceName:' quarterly presentation '})?.id,'window:new:7');
assert.equal(resolveCaptureSource(sources,{sourceId:'missing',kind:'window',sourceName:'Unknown'}),null);
console.log('Desktop capture source recovery passed.');
