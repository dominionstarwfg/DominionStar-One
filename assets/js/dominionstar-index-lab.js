/* DominionStar indexed crediting educational scenario.
   Fictional annual returns. Cumulative series are indices, NOT policy values. */
(()=>{"use strict";
const svgNS='http://www.w3.org/2000/svg';
const years=[-24,21,12,-14,17,-7,10,18,-19,13,7,-9]; // purely synthetic, no historical attribution
const elem=(tag,attrs={},text)=>{const n=document.createElementNS(svgNS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));if(text!==undefined)n.textContent=String(text);return n};
const percent=n=>(n>0?'+':'')+Number(n).toFixed(1)+'%';
const dollar=n=>new Intl.NumberFormat('en-US',{style:'decimal',maximumFractionDigits:1}).format(n);
document.querySelectorAll('[data-iul-lab]').forEach(lab=>{
 const cap=lab.querySelector('[data-cap]'),part=lab.querySelector('[data-participation]'),floor=lab.querySelector('[data-floor]');
 const svg=lab.querySelector('[data-index-svg]'),tbody=lab.querySelector('[data-index-rows]'),detail=lab.querySelector('[data-chart-insight]');
 const reset=lab.querySelector('[data-reset]');if(!cap||!part||!floor||!svg||!tbody)return;
 function render(selected=3){
  const capValue=Number(cap.value),participation=Number(part.value)/100,floorValue=Number(floor.value);
  lab.querySelector('[data-cap-output]').textContent=capValue+'%';
  lab.querySelector('[data-participation-output]').textContent=Number(part.value)+'%';
  lab.querySelector('[data-floor-output]').textContent=floorValue+'%';
  const credits=years.map(v=>Math.max(floorValue,Math.min(capValue,Math.max(0,v)*participation)));
  const ref=[100],credited=[100];years.forEach((v,i)=>{ref.push(ref.at(-1)*(1+v/100));credited.push(credited.at(-1)*(1+credits[i]/100))});
  const losses=years.filter(x=>x<0).length,atFloor=credits.filter(x=>x===floorValue).length;
  lab.querySelector('[data-loss-years]').textContent=losses+' of '+years.length;
  lab.querySelector('[data-floor-years]').textContent=atFloor+' of '+years.length;
  lab.querySelector('[data-gross-credit]').textContent=(credited.at(-1)-100).toFixed(1)+'% before charges';
  const max=Math.max(...ref,...credited)*1.08,min=Math.min(75,...ref,...credited)*.9;
  const left=75,right=825,top=31,bottom=277,x=i=>left+(i/12)*(right-left),y=v=>bottom-((v-min)/(max-min))*(bottom-top);
  svg.replaceChildren();
  [0,1,2,3,4].forEach(i=>{let v=min+(max-min)*i/4,yy=y(v);svg.append(elem('line',{x1:left,x2:right,y1:yy,y2:yy,stroke:'#dce8ee','stroke-width':1}));svg.append(elem('text',{x:left-12,y:yy+4,'text-anchor':'end',fill:'#607a8e','font-size':12},dollar(v)))});
  [0,2,4,6,8,10,12].forEach(i=>svg.append(elem('text',{x:x(i),y:bottom+25,'text-anchor':'middle',fill:'#456477','font-size':12},'Y'+i)));
  const points=list=>list.map((v,i)=>x(i)+','+y(v)).join(' ');
  svg.append(elem('polyline',{points:points(ref),fill:'none',stroke:'#ba7c3a','stroke-width':3.5,'stroke-linejoin':'round','stroke-linecap':'round'}));
  svg.append(elem('polyline',{points:points(credited),fill:'none',stroke:'#087f85','stroke-width':4,'stroke-linejoin':'round','stroke-linecap':'round'}));
  svg.append(elem('circle',{cx:x(selected+1),cy:y(ref[selected+1]),r:5,fill:'#ba7c3a',stroke:'#fff','stroke-width':2}));
  svg.append(elem('circle',{cx:x(selected+1),cy:y(credited[selected+1]),r:5,fill:'#087f85',stroke:'#fff','stroke-width':2}));
  svg.append(elem('text',{x:right,y:18,'text-anchor':'end',fill:'#3f5f70','font-size':13},'Illustrative index units • starts at 100'));
  tbody.replaceChildren();
  years.forEach((v,i)=>{
   const tr=document.createElement('tr');
   const reason=v<0?'Floor applies':v*participation>capValue?'Cap limits credit':'Participation applies';
   [String(i+1),percent(v),percent(credits[i]),reason].forEach((value,j)=>{
    const td=document.createElement('td');td.textContent=value;if(j===2)td.className='index-credit-cell';tr.append(td);
   });
   if(i===selected)tr.classList.add('is-selected');
   tr.tabIndex=0;tr.setAttribute('aria-label','Year '+(i+1)+': '+percent(v)+' index change, '+percent(credits[i])+' gross interest credit');
   tr.addEventListener('click',()=>render(i));tr.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();render(i)}});
   tbody.append(tr);
  });
  const message='Year '+(selected+1)+': hypothetical reference index '+percent(years[selected])+'; indexed-interest credit '+percent(credits[selected])+'. '+
    (years[selected]<0?'The illustrated floor reduces negative index-linked credited interest to '+floorValue+'%; it does not eliminate policy charges.':years[selected]*participation>capValue?'The cap limits positive interest credit to '+capValue+'%, before insurance costs.':'The hypothetical participation formula determines the credit before charges.');
  detail.textContent=message;
 }
 [cap,part,floor].forEach(e=>e.addEventListener('input',()=>render(3)));
 reset?.addEventListener('click',()=>{cap.value='8';part.value='80';floor.value='0';render(3)});
 render();
});
})();