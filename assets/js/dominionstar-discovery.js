/* DominionStar V12 · Financial Education Discovery
 * No intake, profiling, network requests, local storage, eligibility or product recommendations.
 */
(()=>{'use strict';
const data={
 life:{
  label:'LIFE INSURANCE',
  title:'What if someone depends on your income or care?',
  why:"Life insurance can help designated beneficiaries manage the financial impact of an insured person's death while coverage is in force, subject to the policy terms.",
  audience:'People with dependents, shared financial obligations, or others who would face costs or income loss after their death.',
  question:'If your contribution stopped unexpectedly, which ongoing expenses might other people need to cover?',
  guide:'/financial-services/life-insurance/',guideLabel:'Open the Life Insurance Guide',
  tool:'/financial-services/term-life/',toolLabel:'Explore the Term Coverage Illustration',
  source:'https://content.naic.org/insurance-topics/life-insurance',sourceLabel:'Read NAIC Life Insurance guidance'
 },
 ltc:{
  label:'LONG-TERM CARE',
  title:'What if someone needs extended help with everyday activities?',
  why:'Future assistance at home or in a care setting may create costs and caregiver responsibilities. Qualifying insurance benefits depend on contract triggers, limits and exclusions.',
  audience:'Adults considering extended-care expenses and relatives or caregivers who may be responsible for arranging support.',
  question:'If extended care became necessary, who would arrange it, what setting would matter, and how might costs be managed?',
  guide:'/financial-services/long-term-care/',guideLabel:'Open the Long-Term Care Guide',
  tool:'/financial-services/long-term-care/#ltc-gap-tool',toolLabel:'Explore the Care-Cost & Benefit-Gap Tool',
  source:'https://content.naic.org/consumer/long-term-care-insurance.htm',sourceLabel:'Read NAIC Long-Term Care guidance'
 },
 annuity:{
  label:'ANNUITIES',
  title:'How important is predictable retirement income or long-term accumulation?',
  why:'Annuity contracts can serve certain long-term retirement or accumulation purposes, with different contractual payment features, investment risks, liquidity restrictions and costs.',
  audience:'People exploring long-term retirement-income goals who can weigh time horizons, access to funds, contract expenses and the issuer’s financial strength.',
  question:'When might you need access to the money, what income objective matters, and what contractual restrictions would you accept?',
  guide:'/financial-services/annuities/',guideLabel:'Open the Annuities Guide',
  tool:'/financial-services/annuities/#annuity-calculator',toolLabel:'Explore the Annuity Learning Tool',
  source:'https://www.investor.gov/introduction-investing/investing-basics/investment-products/annuities',sourceLabel:'Read Investor.gov Annuities guidance'
 }
};
document.querySelectorAll('[data-discovery]').forEach(root=>{
 const buttons=Array.from(root.querySelectorAll('[data-discovery-choice]'));
 const label=root.querySelector('[data-discovery-eyebrow]');
 const title=root.querySelector('[data-discovery-title]');
 const why=root.querySelector('[data-discovery-why]');
 const audience=root.querySelector('[data-discovery-audience]');
 const question=root.querySelector('[data-discovery-question]');
 const guide=root.querySelector('[data-discovery-guide]');
 const tool=root.querySelector('[data-discovery-tool]');
 const source=root.querySelector('[data-discovery-source]');
 if(!buttons.length||[label,title,why,audience,question,guide,tool,source].some(v=>!v))return;
 function choose(id,focus=false){
  const item=data[id];if(!item)return;
  buttons.forEach(button=>{
   const selected=button.dataset.discoveryChoice===id;
   button.classList.toggle('is-active',selected);
   button.setAttribute('aria-pressed',String(selected));
   if(selected&&focus)button.focus();
  });
  label.textContent='YOUR CHOSEN TOPIC · '+item.label;
  title.textContent=item.title;why.textContent=item.why;
  audience.textContent=item.audience;question.textContent=item.question;
  guide.href=item.guide;guide.textContent=item.guideLabel+' ↗';
  tool.href=item.tool;tool.textContent=item.toolLabel+' →';
  source.href=item.source;source.textContent=item.sourceLabel+' ↗';
 }
 buttons.forEach((button,i)=>{
  button.addEventListener('click',()=>choose(button.dataset.discoveryChoice));
  button.addEventListener('keydown',event=>{
   if(event.key!=='ArrowDown'&&event.key!=='ArrowUp'&&event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
   event.preventDefault();
   const offset=event.key==='ArrowDown'||event.key==='ArrowRight'?1:-1;
   const next=buttons[(i+offset+buttons.length)%buttons.length];
   choose(next.dataset.discoveryChoice,true);
  });
 });
 // Default is life insurance; no visitor input is sent or stored.
 choose('life');
});
})();