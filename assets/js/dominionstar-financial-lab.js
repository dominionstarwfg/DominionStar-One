/* DominionStar Educational Learning Lab — arithmetic only, no market or carrier data. */
(()=>{'use strict';
const ns='http://www.w3.org/2000/svg';
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Math.round(n));
function elem(tag,attrs={},value=''){const node=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));if(value!==null)node.textContent=String(value);return node}
function update(lab){
const type=lab.dataset.chart;const range=k=>Number(lab.querySelector('[data-range="'+k+'"]')?.value||0);const svg=lab.querySelector('[data-svg]');if(!svg)return;
let total=[],base=[],end=20,fmt='';if(type==='saving'){
const monthly=range('monthly');end=range('years');
total=Array.from({length:end+1},(_,i)=>monthly*12*i);
fmt=money(monthly)+' monthly for '+end+' years = '+money(total.at(-1))+' contributed, with 0% assumed growth.';
lab.querySelector('[data-output="monthly"]').textContent=money(monthly);
lab.querySelector('[data-output="years"]').textContent=end+' years';
}else{
const initial=range('initial'),rate=range('rate')/100;total=Array.from({length:end+1},(_,i)=>initial*Math.pow(1+rate,i));base=Array.from({length:end+1},()=>initial);
lab.querySelector('[data-output="initial"]').textContent=money(initial);lab.querySelector('[data-output="rate"]').textContent=(rate*100).toFixed(Number.isInteger(rate*100)?0:1)+'%';
fmt='Illustration: '+money(initial)+' initially, '+money(total.at(-1))+' after 20 years at a hypothetical '+(rate*100)+'% annual increase.';
}
const summary=lab.querySelector('[data-summary]');if(summary)summary.textContent=fmt;
svg.replaceChildren();
const max=Math.max(...total,...base,1)*1.07;const left=86,right=690,top=30,bottom=233,usableX=right-left,usableY=bottom-top;
const x=i=>left+i/end*usableX,y=v=>bottom-(v/max)*usableY;
for(let i=0;i<=4;i++){const value=max*i/4;const gy=y(value);svg.append(elem('line',{x1:left,x2:right,y1:gy,y2:gy,stroke:'#dae4ee','stroke-width':1}));svg.append(elem('text',{x:left-12,y:gy+4,fill:'#38556e','font-size':12,'text-anchor':'end'},money(value)))}
[0,Math.round(end/2),end].forEach(i=>svg.append(elem('text',{x:x(i),y:bottom+27,fill:'#395571','font-size':12,'text-anchor':'middle'},'Year '+i)));
if(base.length)svg.append(elem('polyline',{points:base.map((v,i)=>x(i)+','+y(v)).join(' '),fill:'none',stroke:'#153e66','stroke-width':3,'stroke-dasharray':'9 7'}));
svg.append(elem('polyline',{points:total.map((v,i)=>x(i)+','+y(v)).join(' '),fill:'none',stroke:'#2a8e84','stroke-width':4,'stroke-linejoin':'round','stroke-linecap':'round'}));
svg.append(elem('circle',{cx:x(end),cy:y(total.at(-1)),r:6,fill:'#2a8e84',stroke:'#fff','stroke-width':2}));
svg.append(elem('text',{x:right,y:14,'text-anchor':'end',fill:'#134765','font-size':13,'font-weight':'bold'},money(total.at(-1))));
}
document.querySelectorAll('[data-chart]').forEach(lab=>{lab.querySelectorAll('input[type="range"]').forEach(input=>input.addEventListener('input',()=>update(lab)));update(lab)});
})();