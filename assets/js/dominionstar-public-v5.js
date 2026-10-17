// DominionStar Aurora Financial Education Guide (curated, deterministic, no API requests)
(()=>{"use strict";
const createAnswer=function makeAnswer(raw,context=""){
  const q=String(raw||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[’‘]/g,"'").replace(/\s+/g," ").trim();
  const last=String(context||"");
  const link={life:"https://content.naic.org/insurance-topics/life-insurance",ltc:"https://content.naic.org/insurance-topics/long-term-care-insurance",annuity:"https://www.investor.gov/introduction-investing/investing-basics/investment-products/annuities"};
  const mk=(topic,message,url="/financial-services/",label="Explore Financial Services",source="")=>({topic,message,url,label,source});
  if(!q) return mk("welcome","Ask about life insurance, long-term care, annuities, career mentorship or scheduling a conversation.","/financial-services/","Explore financial services");
  // Product prices, policy guarantees, carriers and personalized tax questions need verified information.
  if(/\b(guaranteed?\s+(?:\d+(?:\.\d+)?%\s*)?(?:returns?|profits?|growth|income)|guaranteed?\s+\d+(?:\.\d+)?%|(?:cost|price|premium|rate) (?:of|for|on) (?:my|me|an?|iul|policy)|what(?:'s| is) the (?:exact )?(?:rate|premium)|quote (?:me|for)|live (?:carrier|rate|pricing)|do you (?:sell|offer|have) (?:\w+\s*)?(?:polic(?:y|ies)|products?|insurance)|do you work with (?:\w+\s*)?(?:carriers?|companies))\b/.test(q))
    return mk("quotes","Aurora has no live insurer rates, underwriting results or approved product catalog. It cannot confirm a return, crediting rate, premium, guarantee, specific carrier relationship or policy availability. Please verify current details through an appropriately licensed professional.","/consultation/","Request verified product information");
  if(/\b(living benefits?|accelerated death benefits?)\b/.test(q))
    return mk("living-benefits","Some life insurance policies have riders that may accelerate part of a death benefit upon qualifying illness or other defined events. Conditions, limitations, charges and effects on the remaining benefit differ by contract. These are not automatically equivalent to comprehensive long-term care insurance.","/consultation/","Discuss policy riders",link.life);
  if(/\b(tax[- ]free retirement|tax[- ]free (?:income|withdrawals?)|tax advantages?|tax deferred|avoid (?:all )?tax|taxation of iul)\b/.test(q))
    return mk("tax","Tax treatment depends on contract structure, applicable law and how money is accessed. Life insurance loans are not automatically tax-free in every situation; lapse or surrender with an outstanding loan can create taxable income. Aurora does not provide individualized tax advice.","/consultation/","Discuss planning and tax questions",link.life);
  if(/\b(borrow from (?:my |a |the )?(?:insurance|life insurance|policy)|insurance policy loan)\b/.test(q))
    return mk("cash-value","Some permanent life policies may permit loans against available cash value. Loans generally accrue interest and can reduce remaining benefits or lead to lapse and possible tax consequences. Review the current policy contract and illustration.","/financial-services/","Explore cash-value basics",link.life);
  // Always respond to intent involving action before broad financial words.
  if(/\b(book|schedule|appointment|consultation|contact|phone number|speak to|talk to|call you|call someone|request a call)\b/.test(q))
    return mk("contact","You can request a conversation using the DominionStar appointment page. Submitting a request does not mean a specific time has been confirmed.","/schedule/","Request a conversation");
  if(/\b(mentorship|mentor|coaching|coach|onboarding|training|license exam|become licensed|prelicens|how to get licen[sc]ed)\b/.test(q))
    return mk("mentorship","DominionStar describes three mentorship pathways: Getting Started, Professional Growth and Leadership Mentorship. Licensing requirements, training, fees and available support vary by jurisdiction and program.","/mentorship/","Explore mentorship");
  if(/\b(career|job opening|recruit|joining the team|become an agent|commission|earnings)\b/.test(q))
    return mk("career","A financial-services career generally requires understanding licensing, client responsibilities, expenses, compensation structure and ongoing professional education. Recruiting or compensation outcomes are not guaranteed.","/opportunity/","Explore careers");
  if(/\b(founder|founded dominionstar|who founded|about dominionstar|what is dominionstar|mission|no family left behind)\b/.test(q))
    return mk("about","DominionStar's mission is “No Family Left Behind.” Its public programs focus on family financial education, responsible mentorship and leadership development.","/about/","Our mission");
  const paired=(a,b)=>a.test(q)&&b.test(q);
  if(paired(/\bterm\b/,/\bwhole\b/))
    return mk("term-whole","Term life generally covers a defined period and typically has no cash value. Whole life is permanent life insurance with policy-defined premiums and cash-value provisions. Compare the amount of coverage, affordability, long-term need, policy terms and potential cash-value tradeoffs; neither is universally best.","/financial-services/","Explore life insurance",link.life);
  if(paired(/\biul\b|indexed universal/,/\bwhole\b/))
    return mk("iul-whole","Whole life generally follows contract-defined premiums and cash-value schedules. Indexed universal life (IUL) is a flexible-premium permanent policy with interest crediting tied to an index formula, subject to caps, spreads, policy costs and non-guaranteed assumptions. Compare guaranteed and illustrated values, lapse risk, funding requirements and loan provisions.","/financial-services/","Explore protection planning",link.life);
  if(paired(/\bterm\b/,/\biul\b|indexed universal/))
    return mk("term-iul","Term life generally provides protection for a specified period without accumulating cash value. Indexed universal life (IUL) is permanent coverage with cash value affected by indexed interest crediting and ongoing charges. IUL is more complex, may need additional premiums to remain in force, and should be evaluated using both guaranteed and non-guaranteed illustrations.","/financial-services/","Discuss insurance options",link.life);
  if(paired(/\bannuit/,/\blife insurance\b|\biul\b/))
    return mk("life-annuity","Life insurance mainly addresses the financial impact of an insured person's death, though certain policies have living benefits or cash value. An annuity is an insurance contract generally used for accumulation or retirement income; its risks, fees, guarantees and withdrawal rules differ. Both need a contract-specific review.","/financial-services/","Explore retirement education",link.annuity);
  if(paired(/\bltc\b|long.term care/,/\blife insurance\b|\bhybrid\b|\btraditional\b/))
    return mk("ltc-hybrid","Traditional long-term care coverage generally provides benefits for qualifying care needs, subject to eligibility conditions and limits. Hybrid policies combine life insurance or annuity features with qualifying long-term care benefits. Review benefit triggers, elimination periods, inflation options, premiums, riders and the tradeoff between death and care benefits.","/financial-services/","Discuss long-term care",link.ltc);
  // Questions requiring personal underwriting, product illustrations or real-time authority must not turn into unsupported promises.
  if(/\b(what (should|must) i buy|which (policy|product|carrier|company) (is best|should i)|recommend (me|a policy|the best)|best policy for me|should i replace|is this right for me|which one should i choose|can i qualify|will i qualify|i have (diabetes|cancer|a condition)|my medical history)\b/.test(q))
    return mk("personalized","The right coverage depends on your needs, budget, jurisdiction, health and other details. Aurora cannot determine suitability, underwriting eligibility or recommend a particular policy. A properly licensed professional can explain available options and review the official contract and illustration.","/consultation/","Request a licensed consultation");
  if(/\b(how much (does|will|would)|give me (a )?quote|exact price|premium quote|cost for (me|a |someone)|carrier rates|guarantee(d)? (return|profit|income)|which (carrier|company) do you (sell|offer|work with)|is (transamerica|nationwide|pacific life) available)\b/.test(q))
    return mk("quotes","Aurora has no live carrier catalog, underwriting results, product illustrations or rates. It cannot confirm premiums, current features, guarantees or availability. These vary by insurer, policy, jurisdiction and applicant, and must be verified from current approved materials.","/consultation/","Request product details");
  if(/\b(iul|indexed universal|equity indexed universal)\b/.test(q))
    return mk("iul","Indexed universal life (IUL) is permanent life insurance with cash value credited using an index-linked formula, not direct investment in the stock index. Crediting caps, participation rates, spreads, insurance costs and policy loans affect results. Illustrated growth is not guaranteed; insufficient funding or withdrawals may cause a policy to lapse.","/financial-services/","Explore life insurance",link.life);
  if(/\b(vul|variable universal life|variable life)\b/.test(q))
    return mk("vul","Variable universal life combines permanent life coverage with investment-related account options and market risk. Contract charges and market losses can reduce cash value and jeopardize coverage. Products of this type can have securities licensing and prospectus requirements, so consult a properly licensed professional.","/financial-services/","Explore protection",link.life);
  if(/\b(whole life|whole.life)\b/.test(q))
    return mk("whole","Whole life is a type of permanent life insurance that commonly provides a death benefit and cash value under policy terms. Depending on the contract, premiums may be scheduled and dividends, if offered, are not guaranteed. Costs, guarantees, exclusions and surrender consequences should be reviewed.","/financial-services/","Explore life insurance",link.life);
  if(/\b(universal life|\bul\b|flexible premium)\b/.test(q))
    return mk("ul","Universal life is permanent life insurance that may allow adjustments to premiums and death benefits within contract rules. Its cash value pays ongoing insurance costs, and the policy can lapse if it is not adequately funded. Always distinguish guaranteed contract values from non-guaranteed projections.","/financial-services/","Explore protection",link.life);
  if(/\bterm life|term insurance|temporary insurance|coverage for 10|coverage for 20|coverage for 30\b/.test(q))
    return mk("term","Term life insurance generally provides a death benefit if the insured dies during a specified coverage term, provided the policy is in force. It usually does not accumulate cash value. Renewal, conversion privileges, exclusions and premiums depend on the particular contract.","/financial-services/","Explore life insurance",link.life);
  if(/\b(insurance loan|policy loan|borrow from (my )?(policy|cash value)|cash value|withdraw from (my )?policy)\b/.test(q))
    return mk("cash-value","Some permanent life policies build cash value and allow loans or withdrawals. Loans accrue interest and can reduce the death benefit; excessive loans or withdrawals may trigger lapse and possible tax consequences. Actual amounts and conditions require the policy's current illustration and contract.","/financial-services/","Discuss cash value",link.life);
  if(/\b(living benefit|accelerated death|chronic illness rider|critical illness rider|terminal illness)\b/.test(q))
    return mk("living-benefits","Some life policies include or offer riders that may accelerate a portion of the death benefit after qualifying health events. Definitions, exclusions, reductions to the remaining death benefit, charges and potential tax issues depend on the contract. This is not automatically the same as comprehensive long-term care coverage.","/consultation/","Ask about contract riders",link.life);
  if(/\b(hybrid long.term|hybrid ltc|life with ltc)\b/.test(q))
    return mk("ltc-hybrid","Hybrid long-term care arrangements pair qualifying care benefits with life-insurance or annuity features. Coverage triggers, waiting periods, benefit amounts, care settings, inflation provisions and what happens to unused benefits differ by policy. Review the complete illustration and contract.","/financial-services/","Explore long-term care",link.ltc);
  if(/\b(long.term care|long term care|\bltc\b|nursing home|assisted living|home care)\b/.test(q))
    return mk("ltc","Long-term care planning addresses help with daily activities or cognitive impairment and may involve care at home, assisted living or other settings. Policies vary in benefit triggers, daily or monthly limits, elimination periods, benefit duration, inflation protection, exclusions and premium-change provisions.","/financial-services/","Explore long-term care",link.ltc);
  if(/\b(fixed indexed annuit(?:y|ies)|indexed annuit(?:y|ies)|\bfia\b)\b/.test(q))
    return mk("indexed-annuity","A fixed indexed annuity is an insurance contract where credited interest is linked to an index formula rather than direct stock ownership. Interest caps, participation rates, spreads, surrender charges and contract rules can limit outcomes. Guarantees rely on the issuing insurer's ability to pay claims.","/financial-services/","Explore retirement topics",link.annuity);
  if(/\b(variable annuit(?:y|ies)|registered index.linked annuit(?:y|ies)|\brila\b)\b/.test(q))
    return mk("variable-annuity","Variable annuities expose value to investment options and can lose money; registered index-linked annuities can also have defined downside exposure. Fees, surrender charges, prospectuses and applicable securities requirements deserve careful review. Aurora does not make investment recommendations.","/financial-services/","Explore retirement topics",link.annuity);
  if(/\b(fixed annuit|myga|multi.year guaranteed annuit)\b/.test(q))
    return mk("fixed-annuity","A fixed annuity may credit interest at a contract-defined rate for a specified period. Review how and when the rate can change, surrender charges, access to funds, the insurer's claims-paying ability and whether the contract is appropriate to the time horizon.","/financial-services/","Explore retirement topics",link.annuity);
  if(/\b(annuity|annuities|guaranteed lifetime income|retirement income product)\b/.test(q))
    return mk("annuity","An annuity is an insurance contract that can provide tax-deferred accumulation, an income stream, or both, depending on contract type. Fixed, fixed-indexed, registered index-linked and variable annuities differ significantly in risk, potential returns and fees. Withdrawals may involve charges or tax penalties.","/financial-services/","Explore retirement topics",link.annuity);
  if(/\b(tax.free retirement|tax free withdrawal|tax free income|tax advantage|tax.defer|taxable|tax.free|retirement strategy|life insurance for retirement)\b/.test(q))
    return mk("tax","Tax treatment depends on contract design, applicable law and the way money is withdrawn. Life-insurance loans are not automatically tax-free in every circumstance; lapse or surrender with outstanding loans can create taxable income. Aurora cannot provide individualized tax advice.","/consultation/","Discuss your planning questions",link.life);
  if(/\b(529|college|education fund|university|tuition)\b/.test(q))
    return mk("college","Education planning can include savings, scholarships, grants and accounts such as 529 plans, each with different rules and risks. Aurora can explain general concepts but cannot confirm that DominionStar offers a particular investment product or provide investment recommendations.","/financial-services/college-planning/","Explore education planning");
  if(/\b(key.person|keyman|buy.sell|business succession|business protect|business insurance)\b/.test(q))
    return mk("business","Business-protection planning can address key-person risks, buy-sell funding, succession and continuity. Insurance ownership, beneficiaries, valuation and tax matters should be reviewed with appropriately qualified professionals.","/financial-services/business-solutions/","Explore business solutions");
  if(/\b(disability insurance|income replacement|income protect)\b/.test(q))
    return mk("income-protection","Income protection may involve savings, employer benefits, disability coverage and life insurance, which address different risks. Review what each source actually covers and whether an appropriately licensed professional can discuss the specific product.","/financial-services/family-protection/","Family protection education");
  if(/\b(death benefit|beneficiary|life insurance claim)\b/.test(q))
    return mk("beneficiary","A life insurance death benefit is generally payable according to the policy's terms when a covered claim occurs. Beneficiary designations, policy ownership, exclusions, contestability and claim procedures can affect payment. Actual claims require review of the contract and insurer documentation.","/financial-services/family-protection/","Explore family protection",link.life);
  if(/\b(life insurance|insurance product|insurance policy)\b/.test(q))
    return mk("life","Life insurance can help provide financial protection after an insured person's death. Major categories include term life and permanent coverage such as whole, universal and indexed universal life. Differences include premiums, guarantees, potential cash value, expenses and risk of lapse. Which is suitable requires a personalized review.","/financial-services/","Explore life insurance",link.life);
  if(/\b(retire|retirement|pension|ira|401k|wealth)\b/.test(q))
    return mk("retirement","Retirement preparation may include workplace plans, personal savings, Social Security and, in some cases, insurance-based arrangements. Product selection and tax consequences depend on goals and circumstances. Aurora provides general education rather than individualized financial or investment advice.","/financial-services/","Explore retirement planning");
  if(/\b(famil|protect|financial|products|services|coverage)\b/.test(q))
    return mk("overview","I can explain general concepts about term life, whole life, indexed universal life, long-term care, annuities and family protection. Ask about one topic, or request a conversation about options available in your jurisdiction.","/financial-services/","Explore financial services");
  if(last && /\b(what about|how about|and the|tell me more|more detail)\b/.test(q)){
    const reminder={term:"term life",whole:"whole life",iul:"indexed universal life",ltc:"long-term care",annuity:"annuities"}[last];
    if(reminder)return makeAnswer(reminder,"");
  }
  return mk("unmatched","I don't have a verified answer to that specific question. I can explain term and permanent life insurance, IUL, long-term care, annuities, mentorship and general planning concepts. For contract-specific or personal questions, request a licensed professional.","/schedule/","Request a conversation");
};
const launch=document.querySelector('.aurora-trigger');
const panel=document.querySelector('.aurora-panel');
const close=document.querySelector('.aurora-head button');
const form=document.querySelector('.aurora-form');
const input=document.querySelector('.aurora-form input');
const chat=document.querySelector('.aurora-chat');
const shortcuts=document.querySelector('.aurora-prompts');
let previousTopic="";
function closeAurora(){if(!panel)return;panel.hidden=true;launch?.setAttribute('aria-expanded','false');}
function openAurora(){if(!panel)return;panel.hidden=false;launch?.setAttribute('aria-expanded','true');input?.focus();}
launch?.addEventListener('click',()=>panel.hidden?openAurora():closeAurora());
close?.addEventListener('click',closeAurora);
const menu=document.querySelector('.menu-button'),nav=document.querySelector('.main-nav');
menu?.addEventListener('click',()=>{const expanded=nav?.classList.toggle('open')||false;menu.setAttribute('aria-expanded',String(expanded));menu.textContent=expanded?'×':'☰'});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeAurora();nav?.classList.remove('open');menu?.setAttribute('aria-expanded','false');}});
document.querySelectorAll('.faq-item button').forEach(btn=>btn.addEventListener('click',()=>{const expand=btn.getAttribute('aria-expanded')!=='true';btn.setAttribute('aria-expanded',String(expand));btn.nextElementSibling.hidden=!expand;const span=btn.querySelector('span');if(span)span.textContent=expand?'−':'+';}));
function addBubble(message,mine=false){
 if(!chat)return null;
 const d=document.createElement('div');
 d.className='aurora-bubble'+(mine?' mine':'');
 d.textContent=message;
 chat.appendChild(d);
 chat.scrollTop=chat.scrollHeight;
 return d;
}
function linkTo(bubble,url,label,external=false){
 if(!bubble||!url||!label)return;
 const a=document.createElement('a');
 a.href=url;a.textContent=label+' ↗';a.style.display='block';a.style.marginTop='7px';
 if(external){a.target='_blank';a.rel='noopener noreferrer';}
 bubble.appendChild(a);
}
function ask(question){
 const value=String(question||'').trim().slice(0,450);
 if(!value)return;
 addBubble(value,true);
 const ans=createAnswer(value,previousTopic);
 previousTopic=ans.topic;
 const result=addBubble(ans.message,false);
 linkTo(result,ans.url,ans.label);
 if(ans.source)linkTo(result,ans.source,'Independent educational source (NAIC / SEC)',true);
}
form?.addEventListener('submit',e=>{e.preventDefault();ask(input?.value);if(input)input.value='';});
document.querySelectorAll('[data-aurora-question]').forEach(btn=>btn.addEventListener('click',()=>{openAurora();ask(btn.dataset.auroraQuestion);}));
if(shortcuts){
 shortcuts.replaceChildren();
 const suggestions=[['Term vs Whole','Compare term and whole life insurance'],['IUL','What is IUL life insurance?'],['Long-Term Care','Explain long-term care insurance'],['Annuities','What are annuities?'],['Mentorship','What mentorship is available?'],['Book a Call','How do I book a call?']];
 suggestions.forEach(([label,question])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>ask(question));shortcuts.appendChild(b);});
}
const note=document.querySelector('.aurora-note');
if(note)note.textContent='Educational topic guide, not live generative AI. Questions stay in this browser; avoid sharing sensitive personal or medical information. No quotes or personalized recommendations.';
const head=document.querySelector('.aurora-head small');
if(head)head.textContent='Financial education & website guidance';
window.DominionStarAurora={open:openAurora,answerForQuestion:createAnswer,version:'6.0-education'};
})();
