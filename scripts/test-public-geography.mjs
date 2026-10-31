#!/usr/bin/env node
/* Source-driven test of the shared public location/time-zone controller. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=path=>readFileSync(root+path,'utf8');
const app=read('assets/js/dominionstar-geography.js');

class TestOption {
  constructor(text,value){this.text=text;this.value=value??text;}
}
class TestEvent {
  constructor(type){this.type=type;}
}
class TestSelect {
  constructor(values=['']) {
    this.options=values.map(x=>new TestOption(x,x));
    this.value='';this.disabled=false;this.listeners={};this.dataset={};
  }
  add(option){this.options.push(option);}
  replaceChildren(...options){this.options=[...options];this.value='';}
  addEventListener(type,callback){(this.listeners[type]??=[]).push(callback);}
  dispatchEvent(event){for(const callback of this.listeners[event.type]||[])callback(event);return true;}
}
const country=()=>new TestSelect(['','United States','Canada','Other']);
const element=(selectors)=>({querySelector:key=>selectors[key]||null});

function boot(search=''){
  const makeForm=()=>{
    const form={
      country:country(),region:new TestSelect(),zone:new TestSelect(),
      helper:{textContent:''}
    };
    form.element=element({
      '[data-ds-country]':form.country,
      '[data-ds-region]':form.region,
      '[data-ds-timezone]':form.zone,
      '[data-ds-tz-feedback]':form.helper
    });
    return form;
  };
  const appointment=makeForm(),consultation=makeForm();
  const panel={
    country:country(),region:new TestSelect(),
    output:{textContent:''},link:{href:'/consultation/'},regulator:{href:'#',hidden:true,textContent:''}
  };
  panel.element=element({
    '[data-ds-country]':panel.country,
    '[data-ds-region]':panel.region,
    '[data-ds-jurisdiction-text]':panel.output,
    '[data-ds-jurisdiction-link]':panel.link,
    '[data-ds-regulator-link]':panel.regulator
  });
  const document={
    querySelectorAll:()=>[appointment.element,consultation.element],
    querySelector:key=>key==='[data-ds-geography]'?panel.element:null
  };
  vm.runInNewContext(app,{
    document,window:{location:{search}},location:{search},
    Option:TestOption,Event:TestEvent,URL,URLSearchParams,Intl,Date
  },{timeout:1500,filename:'dominionstar-geography.js'});
  return {appointment,consultation,panel};
}
const values=select=>select.options.map(option=>option.value);
const choose=(select,value)=>{
  assert.ok(values(select).includes(value),'Missing option: '+value);
  select.value=value;select.dispatchEvent(new TestEvent('change'));
};

const t=boot();
assert.ok(t.appointment.region.disabled,'Region initially disabled until country selected');
choose(t.appointment.country,'Canada');
assert.ok(values(t.appointment.region).includes('Ontario'),'Canadian provinces must appear');
assert.ok(values(t.appointment.region).includes('Yukon'),'Canadian territories must appear');
assert.ok(!values(t.appointment.region).includes('New York'),'U.S. states must not appear under Canada');
choose(t.appointment.region,'Ontario');
choose(t.appointment.country,'United States');
assert.equal(t.appointment.region.value,'','Changing country must reset selected region');
assert.ok(values(t.appointment.region).includes('Kentucky'));
assert.ok(values(t.appointment.region).includes('Puerto Rico'));
assert.ok(!values(t.appointment.region).includes('Ontario'));
assert.ok(values(t.appointment.zone).includes('America/Toronto'));
assert.ok(values(t.appointment.zone).includes('America/St_Johns'));
assert.ok(values(t.appointment.zone).includes('America/Regina'));
choose(t.appointment.zone,'America/Chicago');
assert.match(t.appointment.helper.textContent,/Current time there:/);

choose(t.panel.country,'United States');
choose(t.panel.region,'New York');
assert.match(t.panel.output.textContent,/riders can vary by state/);
assert.match(t.panel.output.textContent,/Living-benefit and long-term-care terms/);
assert.match(t.panel.link.href,/country=United\+States&region=New\+York/);
assert.equal(t.panel.regulator.hidden,false);
assert.match(t.panel.regulator.href,/content\.naic\.org\/state-insurance-departments/);
choose(t.panel.country,'Canada');
choose(t.panel.region,'Quebec');
assert.match(t.panel.output.textContent,/Canadian licensing/);
assert.match(t.panel.link.href,/country=Canada&region=Quebec/);
assert.equal(t.panel.regulator.hidden,false);
assert.match(t.panel.regulator.href,/canada\.ca\/en\/financial-consumer-agency/);

const prefilled=boot('?country=Canada&region=Ontario');
assert.equal(prefilled.appointment.country.value,'Canada');
assert.equal(prefilled.appointment.region.value,'Ontario');
assert.equal(prefilled.consultation.region.value,'Ontario');
assert.equal(prefilled.panel.region.value,'Ontario');
const rejected=boot('?country=Canada&region=New%20York');
assert.equal(rejected.appointment.region.value,'','Mismatched country/region URL values must be rejected');

for(const path of ['schedule/index.html','consultation/index.html']){
  const html=read(path);
  for(const field of ['data-ds-country','data-ds-region','data-ds-timezone','name="time-zone"','dominionstar-geography.js']){
    assert.ok(html.includes(field),path+' missing '+field);
  }
  assert.match(html,/data-netlify="true"/);
  assert.match(html,/name="campaign_source"/);
}
assert.match(read('join/index.html'),/data-ds-region/);
assert.match(read('financial-services/index.html'),/data-ds-geography/);
for(const page of ['financial-services/life-insurance/index.html','financial-services/long-term-care/index.html']){
  assert.match(read(page),/data-ds-geography/);
  assert.match(read(page),/dominionstar-geography\.js/);
}
console.log('DOMINIONSTAR_PUBLIC_GEO_TEST_OK');
