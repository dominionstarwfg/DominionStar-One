/* DominionStar public education tools
 * Financial scenarios use only visitor-selected fictional assumptions.
 * They do not request API data, compare carriers, collect client information, or provide quotes.
 */
(()=>{'use strict';
const ns='http://www.w3.org/2000/svg';
const dollars=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Math.round(v));
const percent=v=>(Number(v).toFixed(Number.isInteger(Number(v))?0:1))+'%';
function svgElement(tag,attrs={},txt){const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(txt!==undefined)n.textContent=String(txt);return n}
function renderAnnuity(root){
 const value=k=>Number(root.querySelector('[data-input="'+k+'"]')?.value||0);
 const premium=value('premium'),rate=value('rate')/100,years=value('years'),surrender=value('surrender')/100;
 const amount=premium*Math.pow(1+rate,years),fee=amount*surrender,net=amount-fee;
 const labels={premium:dollars(premium),rate:percent(value('rate')),years:years+' '+(years===1?'year':'years'),surrender:percent(value('surrender'))};
 for(const [name,label]of Object.entries(labels)){const output=root.querySelector('[data-value="'+name+'"]');if(output)output.textContent=label}
 for(const [name,n]of Object.entries({accumulation:amount,deduction:fee,net})){const el=root.querySelector('[data-result="'+name+'"]');if(el)el.textContent=dollars(n)}
 const insight=root.querySelector('[data-annuity-insight]');
 if(insight)insight.textContent='Fictional scenario: '+dollars(premium)+' deposited once, compounding annually at a constant hypothetical '+percent(value('rate'))+' for '+years+' years, resulting in '+dollars(amount)+' before a '+percent(value('surrender'))+' surrender deduction. That hypothetical deduction would be '+dollars(fee)+'. Taxes, contract expenses and adjustments are excluded.';
 const svg=root.querySelector('[data-annuity-chart]');if(!svg)return;
 svg.replaceChildren();
 const startX=89,endX=817,topY=34,bottomY=241;
 const max=Math.max(amount,premium,1)*1.12;
 const x=i=>startX+(i/years)*(endX-startX),y=v=>bottomY-v/max*(bottomY-topY);
 for(let n=0;n<=4;n++){const amount=max*n/4,py=y(amount);svg.append(svgElement('line',{x1:startX,y1:py,x2:endX,y2:py,stroke:'#dfe9ee'}));svg.append(svgElement('text',{x:startX-10,y:py+4,'text-anchor':'end','font-size':12,fill:'#52687b'},dollars(amount)))}
 const vals=Array.from({length:years+1},(_,i)=>premium*Math.pow(1+rate,i));
 svg.append(svgElement('polyline',{points:vals.map((v,i)=>x(i)+','+y(v)).join(' '),fill:'none',stroke:'#18817e','stroke-width':4,'stroke-linejoin':'round','stroke-linecap':'round'}));
 svg.append(svgElement('line',{x1:startX,y1:y(premium),x2:endX,y2:y(premium),stroke:'#c59a5b','stroke-width':2,'stroke-dasharray':'6 6'}));
 svg.append(svgElement('circle',{cx:endX,cy:y(amount),r:7,fill:'#18817e',stroke:'#fff','stroke-width':2}));
 [0,Math.round(years/2),years].forEach(i=>svg.append(svgElement('text',{x:x(i),y:bottomY+24,'text-anchor':'middle','font-size':12,fill:'#45647b'},'Year '+i)));
 svg.append(svgElement('text',{x:endX,y:22,'text-anchor':'end','font-size':12,fill:'#284b63'},'Illustrative contract value before taxes / deductions'));
}
function renderLtc(root){
 const value=k=>Number(root.querySelector('[data-input="'+k+'"]')?.value||0);
 const care=value('care'),years=value('years'),inf=value('inflation')/100,benefit=value('benefit'),growth=value('benefitgrowth')/100,wait=value('wait');
 const futureCost=care*Math.pow(1+inf,years),futureBenefit=benefit*Math.pow(1+growth,years);
 const coveredMonths=Math.max(0,12-wait/30); // 30-day periods, all inputs divisible by 30
 const yearExpense=futureCost*12,eligiblePerMonth=Math.min(futureCost,futureBenefit);
 const maxPaid=eligiblePerMonth*coveredMonths,gap=Math.max(0,yearExpense-maxPaid);
 const labels={care:dollars(care),years:years+' '+(years===1?'year':'years'),inflation:percent(value('inflation')),benefit:dollars(benefit),benefitgrowth:percent(value('benefitgrowth')),wait:wait+' days'};
 for(const [name,label]of Object.entries(labels)){const output=root.querySelector('[data-value="'+name+'"]');if(output)output.textContent=label}
 for(const [name,n]of Object.entries({futurecost:futureCost,futurebenefit:futureBenefit,gap})){const o=root.querySelector('[data-result="'+name+'"]');if(o)o.textContent=dollars(n)}
 const insight=root.querySelector('[data-ltc-insight]');if(insight)insight.textContent='Hypothetical first year: '+dollars(yearExpense)+' total care expense. After a simplified '+wait+'-day waiting period, up to '+dollars(maxPaid)+' could be covered under the assumed monthly limit, leaving '+dollars(gap)+' for the family. This assumes the claim qualifies and no other policy limitations or benefit-pool constraints apply.';
 const svg=root.querySelector('[data-ltc-chart]');if(!svg)return;
 svg.replaceChildren();
 const items=[['Year of care',yearExpense,'#204a72'],['Potential benefit maximum',maxPaid,'#13837b'],['Family expense gap',gap,'#b48b45']];
 const x0=223,x1=800,max=Math.max(yearExpense,1)*1.04;
 items.forEach(([name,amount,color],i)=>{
  const yy=39+i*70,w=Math.max(0,(amount/max)*(x1-x0));
  svg.append(svgElement('text',{x:12,y:yy+17,'font-size':14,fill:'#315267','font-weight':'700'},name));
  svg.append(svgElement('rect',{x:x0,y:yy-2,width:x1-x0,height:29,rx:8,fill:'#e5eef2'}));
  if(w>0)svg.append(svgElement('rect',{x:x0,y:yy-2,width:w,height:29,rx:8,fill:color}));
  svg.append(svgElement('text',{x:x1,y:yy+46,'text-anchor':'end','font-size':12,fill:'#38536a'},dollars(amount)));
 });
}
const defaults={annuity:{premium:'100000',rate:'4',years:'10',surrender:'5'},ltc:{care:'6000',years:'15',inflation:'3',benefit:'5000',benefitgrowth:'3',wait:'90'}};
document.querySelectorAll('[data-financial-tool]').forEach(root=>{
 const type=root.dataset.financialTool;if(!(type in defaults))return;
 const render=()=>{if(type==='annuity')renderAnnuity(root);else renderLtc(root)};
 root.querySelectorAll('input[type="range"]').forEach(input=>input.addEventListener('input',render));
 root.querySelector('[data-reset-tool]')?.addEventListener('click',()=>{
  for(const [key,v]of Object.entries(defaults[type])){const input=root.querySelector('[data-input="'+key+'"]');if(input)input.value=v}render();
 });
 render();
});
})();