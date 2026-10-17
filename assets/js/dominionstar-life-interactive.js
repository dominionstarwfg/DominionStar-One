/* DominionStar Term Life Coverage Timeline
   An illustrative contract-duration visualization; no actuarial probabilities or quotes. */
(()=>{'use strict';
const ns='http://www.w3.org/2000/svg';
const cash=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
function el(tag,attrs={},str){const o=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>o.setAttribute(k,String(v)));if(str!==undefined)o.textContent=str;return o}
document.querySelectorAll('[data-term-demo]').forEach(panel=>{
 const term=panel.querySelector('[data-term]'),coverage=panel.querySelector('[data-coverage]');
 const outTerm=panel.querySelector('[data-term-output]'),outCover=panel.querySelector('[data-coverage-output]');
 const svg=panel.querySelector('[data-term-svg]'),summary=panel.querySelector('[data-term-summary]');
 if(!term||!coverage||!svg)return;
 function render(){
  const years=Number(term.value),amount=Number(coverage.value);
  outTerm.textContent=years+' years';outCover.textContent=cash(amount);
  const start=65,stop=720,y=90,w=stop-start,scale=35;
  const right=start+years/scale*w;
  svg.replaceChildren();
  svg.append(el('rect',{x:start,y:52,width:w,height:82,rx:12,fill:'#e9eff4'}));
  svg.append(el('rect',{x:start,y:52,width:right-start,height:82,rx:12,fill:'#1c847e'}));
  svg.append(el('line',{x1:right,y1:38,x2:right,y2:151,stroke:'#c49340','stroke-width':3,'stroke-dasharray':'5 4'}));
  svg.append(el('text',{x:start+15,y:83,fill:'#fff','font-size':14,'font-weight':'800'},'COVERAGE IN FORCE'));
  svg.append(el('text',{x:start+15,y:111,fill:'#fff','font-size':16,'font-weight':'850'},cash(amount)+' face amount'));
  if(stop-right>110)svg.append(el('text',{x:right+15,y:100,fill:'#37556c','font-size':12,'font-weight':'800'},'Expired term'));
  [0,5,10,15,20,25,30,35].forEach(yv=>{
   const x=start+yv/scale*w;
   svg.append(el('line',{x1:x,y1:146,x2:x,y2:153,stroke:'#91a8b7'}));
   svg.append(el('text',{x,y:176,'text-anchor':'middle','font-size':12,fill:'#3b5c70'},String(yv)));
  });
  svg.append(el('text',{x:(start+stop)/2,y:204,'text-anchor':'middle','font-size':13,fill:'#3b5c70'},'Years since issue — illustrative timeline'));
  svg.append(el('text',{x:right,y:32,'text-anchor':'middle','font-size':11,fill:'#805b20','font-weight':'900'},'TERM ENDS'));
  summary.textContent='Fictional example: '+cash(amount)+' of term life coverage for '+years+' years. A covered death while the policy is active could trigger the contract death benefit. A death after the contract term ends would not trigger that expired policy’s benefit.';
 }
 term.addEventListener('input',render);coverage.addEventListener('input',render);render();
});
})();