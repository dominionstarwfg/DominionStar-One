/* Aurora 7.0: curated financial knowledge + secure optional AI */
(()=>{"use strict";
const createAnswer=function makeAnswer(raw,context=""){
  const q=String(raw||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[’‘]/g,"'").replace(/\s+/g," ").trim();
  const last=String(context||"");
  const link={life:"https://content.naic.org/insurance-topics/life-insurance",ltc:"https://content.naic.org/insurance-topics/long-term-care-insurance",annuity:"https://www.investor.gov/introduction-investing/investing-basics/investment-products/annuities"};
  const mk=(topic,message,url="/financial-services/",label="Explore Financial Services",source="")=>({topic,message,url,label,source});
  if(!q) return mk("welcome","Ask about life insurance, long-term care, annuities, career mentorship or scheduling a conversation.","/financial-services/","Explore financial services");
  // Explain who might explore a topic and why it matters; never determine individual suitability.
  const whoWhy=/\b(who (?:needs?|should|might|could|would)|why (?:is|does|are)|is it important|what is the purpose|who would benefit|what should i consider)\b/.test(q);
  const asksLife=/\b(life insurance|death benefit|term life|family protection)\b/.test(q);
  const asksCare=/\b(long.term care|long term care|ltc|extended care)\b/.test(q);
  const asksAnnuity=/\b(annuit(?:y|ies)|retirement income)\b/.test(q);
  if((whoWhy&&[asksLife,asksCare,asksAnnuity].filter(Boolean).length>1)||/\b(who needs (?:which|financial|insurance)|which solution is right|where should i start)\b/.test(q))
    return mk("discovery","Life insurance, long-term care and annuities answer different financial questions. Life insurance can help people left behind after an insured's death; LTC planning addresses potential extended-care costs and caregiving; annuities may address certain long-term accumulation or retirement-income goals. Start by considering who depends on you, what care responsibilities could arise, and when access to money matters. These questions are educational, not a personal suitability assessment.","/financial-services/discovery/","Explore Who Needs It & Why","https://content.naic.org/insurance-topics/life-insurance");
  if(whoWhy&&asksLife)
    return mk("life-why","Life insurance may be worth exploring when someone's death could leave dependents, a partner, relatives, or business stakeholders facing expenses or lost financial support. Its purpose is to provide an eligible death benefit to named beneficiaries while coverage is in force. Ask: Who would depend on my contribution, what obligations could remain, and how long might protection be needed? Coverage type and amount require individual review.","/financial-services/discovery/","Explore the Life Insurance discovery pathway","https://content.naic.org/insurance-topics/life-insurance");
  if(whoWhy&&asksCare)
    return mk("ltc-why","Long-term care planning may matter to people considering the cost and practical burden of assistance with everyday activities or cognitive needs. Planning can help families consider care settings, who might arrange support, benefit waiting periods and costs insurance may not cover. Ask: Who might help with care, and how would expenses be addressed? Whether insurance fits depends on individual facts and policy terms.","/financial-services/discovery/","Explore the Long-Term Care discovery pathway","https://content.naic.org/consumer/long-term-care-insurance.htm");
  if(whoWhy&&asksAnnuity)
    return mk("annuity-why","Annuities are insurance contracts sometimes explored for long-term accumulation or retirement income. They may be relevant when a person can weigh income objectives, the intended holding period, access to funds, fees and the insurer's guarantees. Ask: When might I need this money and what contract restrictions am I prepared to accept? Aurora cannot determine whether an annuity is suitable for a particular visitor.","/financial-services/discovery/","Explore the Annuities discovery pathway","https://www.investor.gov/introduction-investing/investing-basics/investment-products/annuities");
  if(/\b(guarantee|guaranteed|guarantees|promised|promise)\b/.test(q)&&/(?:\d+(?:\.\d+)?\s*%|return|profit|income|crediting rate|interest rate)/.test(q))
    return mk("quotes","Aurora cannot guarantee any return, policy crediting rate, premium, income or investment outcome. Review any contractual guarantees in the current carrier-approved policy documents with an appropriately licensed professional.","/consultation/","Discuss contract terms");
  if(/\b(1%|2%|1 to 2 percent|one percent|two percent|how many term policies (pay|payout)|percentage of term policies|term payout rate)\b/.test(q))
    return mk("term-statistics","The widely repeated claim that only 1–2% of term life policies ever pay a death benefit cannot be confirmed from a current industry-wide dataset. An analysis of 2023 data reported roughly 2% of all individual life policies in force paid a benefit that year, combining term and permanent life; it does not describe a term-only lifetime payout rate. A policy ending because the insured outlives the term is not the same as a valid death claim being denied.","/financial-services/term-life/","Read the Term Life data explanation","https://www.investopedia.com/is-your-term-life-insurance-a-waste-of-money-8774621");
  // Estate/probate and Canadian recruiting are educational, jurisdiction-dependent subjects.
  if(/\b(aretha franklin|prince['’]?s estate|prince died without|prince.*without a will|probate stor(?:y|ies)|real probate case)\b/.test(q))
    return mk("probate-stories","Two documented estate stories show why clear instructions matter. Aretha Franklin’s competing handwritten wills were considered in a Michigan probate case; a 2023 jury recognized the 2014 document. Prince died without a will and his estate faced years of administration and disputes. Read their histories and the practical lessons on our Probate & Legacy page. These stories do not establish what would happen to your family.","/financial-services/probate-estate/","Read the real probate stories");
  if(/\b(probate|probate court|intestate|intestacy|dying without a will|dying without will|estate court|executor|estate trustee|inheritance|what happens without a will|estate planning|last will|wills?\b|beneficiar(?:y|ies))\b/.test(q))
    return mk("probate","Probate is a court-supervised process that may confirm a will or a representative’s authority to administer an estate. It is not always required; the rules depend on the location and assets. A will does not automatically avoid probate. Life-insurance beneficiary designations can affect whether proceeds flow to the estate. Review your beneficiary choices and ask a qualified estate lawyer about your jurisdiction.","/financial-services/probate-estate/","Explore probate, wills & beneficiaries","https://www.ontario.ca/page/apply-probate-estate");
  if(/\b(canada|canadian|canadians|ontario|qu[eé]bec|alberta|british columbia|nova scotia|manitoba|saskatchewan|llqp|cipr|provincial licen[sc]e|territorial licen[sc]e)\b/.test(q))
    return mk("canada","DominionStar welcomes Canadian career and mentorship inquiries. Licensing is provincial or territorial, not automatically covered by a U.S. insurance license. In many provinces, new life-insurance applicants complete approved LLQP preparation and examinations. Québec has specific AMF requirements. Eligibility, insurer sponsorship or contracting, and program availability must be confirmed for your province.","/opportunity/canada/","Explore the Canada recruiting pathway","https://www.fsrao.ca/licensing/life-and-accident-sickness-agent/apply-new-life-and-accident-sickness-insurance-licence");
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
    return mk("term-whole","Term life generally covers a defined period and typically has no cash value. Whole life is permanent life insurance with policy-defined premiums and cash-value provisions. Compare the amount of coverage, affordability, long-term need, policy terms and potential cash-value tradeoffs; neither is universally best.","/financial-services/life-insurance/","Compare life insurance categories",link.life);
  if(paired(/\biul\b|indexed universal/,/\bwhole\b/))
    return mk("iul-whole","Whole life generally follows contract-defined premiums and cash-value schedules. Indexed universal life (IUL) is a flexible-premium permanent policy with interest crediting tied to an index formula, subject to caps, spreads, policy costs and non-guaranteed assumptions. Compare guaranteed and illustrated values, lapse risk, funding requirements and loan provisions.","/financial-services/indexed-universal-life/","Explore IUL and Whole Life",link.life);
  if(paired(/\bterm\b/,/\biul\b|indexed universal/))
    return mk("term-iul","Term life generally provides protection for a specified period without accumulating cash value. Indexed universal life (IUL) is permanent coverage with cash value affected by indexed interest crediting and ongoing charges. IUL is more complex, may need additional premiums to remain in force, and should be evaluated using both guaranteed and non-guaranteed illustrations.","/financial-services/term-life/","Compare Term and IUL",link.life);
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
    return mk("iul","Indexed universal life (IUL) is permanent life insurance with cash value credited using an index-linked formula, not direct investment in the stock index. Crediting caps, participation rates, spreads, insurance costs and policy loans affect results. Illustrated growth is not guaranteed; insufficient funding or withdrawals may cause a policy to lapse.","/financial-services/indexed-universal-life/","Read the IUL guide",link.life);
  if(/\b(vul|variable universal life|variable life)\b/.test(q))
    return mk("vul","Variable universal life combines permanent life coverage with investment-related account options and market risk. Contract charges and market losses can reduce cash value and jeopardize coverage. Products of this type can have securities licensing and prospectus requirements, so consult a properly licensed professional.","/financial-services/","Explore protection",link.life);
  if(/\b(whole life|whole.life)\b/.test(q))
    return mk("whole","Whole life is a type of permanent life insurance that commonly provides a death benefit and cash value under policy terms. Depending on the contract, premiums may be scheduled and dividends, if offered, are not guaranteed. Costs, guarantees, exclusions and surrender consequences should be reviewed.","/financial-services/whole-life/","Read the Whole Life guide",link.life);
  if(/\b(universal life|\bul\b|flexible premium)\b/.test(q))
    return mk("ul","Universal life is permanent life insurance that may allow adjustments to premiums and death benefits within contract rules. Its cash value pays ongoing insurance costs, and the policy can lapse if it is not adequately funded. Always distinguish guaranteed contract values from non-guaranteed projections.","/financial-services/universal-life/","Read the Universal Life guide",link.life);
  if(/\bterm life|term insurance|temporary insurance|coverage for 10|coverage for 20|coverage for 30\b/.test(q))
    return mk("term","Term life insurance generally provides a death benefit if the insured dies during a specified coverage term, provided the policy is in force. It usually does not accumulate cash value. Renewal, conversion privileges, exclusions and premiums depend on the particular contract.","/financial-services/term-life/","Read the Term Life guide",link.life);
  if(/\b(insurance loan|policy loan|borrow from (my )?(policy|cash value)|cash value|withdraw from (my )?policy)\b/.test(q))
    return mk("cash-value","Some permanent life policies build cash value and allow loans or withdrawals. Loans accrue interest and can reduce the death benefit; excessive loans or withdrawals may trigger lapse and possible tax consequences. Actual amounts and conditions require the policy's current illustration and contract.","/financial-services/","Discuss cash value",link.life);
  if(/\b(living benefit|accelerated death|chronic illness rider|critical illness rider|terminal illness)\b/.test(q))
    return mk("living-benefits","Some life policies include or offer riders that may accelerate a portion of the death benefit after qualifying health events. Definitions, exclusions, reductions to the remaining death benefit, charges and potential tax issues depend on the contract. This is not automatically the same as comprehensive long-term care coverage.","/consultation/","Ask about contract riders",link.life);
  if(/\b(hybrid long.term|hybrid ltc|life with ltc)\b/.test(q))
    return mk("ltc-hybrid","Hybrid long-term care arrangements pair qualifying care benefits with life-insurance or annuity features. Coverage triggers, waiting periods, benefit amounts, care settings, inflation provisions and what happens to unused benefits differ by policy. Review the complete illustration and contract.","/financial-services/","Explore long-term care",link.ltc);
  if(/\b(long.term care|long term care|\bltc\b|nursing home|assisted living|home care)\b/.test(q))
    return mk("ltc","Long-term care planning addresses help with daily activities or cognitive impairment and may involve care at home, assisted living or other settings. Policies vary in benefit triggers, daily or monthly limits, elimination periods, benefit duration, inflation protection, exclusions and premium-change provisions.","/financial-services/long-term-care/#ltc-gap-tool","Open LTC guide and benefit-gap tool",link.ltc);
  if(/\b(fixed indexed annuit(?:y|ies)|indexed annuit(?:y|ies)|\bfia\b)\b/.test(q))
    return mk("indexed-annuity","A fixed indexed annuity is an insurance contract where credited interest is linked to an index formula rather than direct stock ownership. Interest caps, participation rates, spreads, surrender charges and contract rules can limit outcomes. Guarantees rely on the issuing insurer's ability to pay claims.","/financial-services/annuities/","Open the Annuity guide and tool",link.annuity);
  if(/\b(variable annuit(?:y|ies)|registered index.linked annuit(?:y|ies)|\brila\b)\b/.test(q))
    return mk("variable-annuity","Variable annuities expose value to investment options and can lose money; registered index-linked annuities can also have defined downside exposure. Fees, surrender charges, prospectuses and applicable securities requirements deserve careful review. Aurora does not make investment recommendations.","/financial-services/annuities/","Open the Annuity guide and tool",link.annuity);
  if(/\b(fixed annuit|myga|multi.year guaranteed annuit)\b/.test(q))
    return mk("fixed-annuity","A fixed annuity may credit interest at a contract-defined rate for a specified period. Review how and when the rate can change, surrender charges, access to funds, the insurer's claims-paying ability and whether the contract is appropriate to the time horizon.","/financial-services/annuities/","Open the Annuity guide and tool",link.annuity);
  if(/\b(annuity|annuities|guaranteed lifetime income|retirement income product)\b/.test(q))
    return mk("annuity","An annuity is an insurance contract that can provide tax-deferred accumulation, an income stream, or both, depending on contract type. Fixed, fixed-indexed, registered index-linked and variable annuities differ significantly in risk, potential returns and fees. Withdrawals may involve charges or tax penalties.","/financial-services/annuities/","Open the Annuity guide and tool",link.annuity);
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


const launcher=document.querySelector('.aurora-trigger'),panel=document.querySelector('.aurora-panel');
const route=window.location.pathname.replace(/\/index\.html$/,'/')||'/';
const contexts=[
 [/^\/mentorship/,{name:'Mentorship Programs',prompts:[['Getting Started','How does mentorship help a new professional?'],['Professional Growth','What can I learn after getting licensed?'],['Leadership','What is leadership mentorship?']]}],
 [/^\/opportunity/,{name:'Careers & Licensing',prompts:[['Licensing','How does insurance licensing work?'],['Early career','What should a new agent learn first?'],['Canada opportunity','How can I explore a financial services career in Canada?']]}],
 [/^\/financial-services\/discovery\//,{name:'Financial Discovery',prompts:[['Who needs life insurance?','Who might need life insurance and why does it matter?'],['Why plan for care?','Who might consider long-term care planning and why?'],['Annuity goals','Who might consider annuities and why are they important?']]}],
 [/^\/financial-services\/annuities\//,{name:'Annuities Education',prompts:[['Fixed annuities','How does a fixed annuity work?'],['Surrender costs','What is a surrender charge?'],['Indexed annuities','What is a fixed indexed annuity?']]}],
 [/^\/financial-services\/long-term-care\//,{name:'Long-Term Care',prompts:[['Benefit limits','How do LTC benefit limits work?'],['Elimination periods','What does a 90 day elimination period mean?'],['LTC coverage','Does Medicare cover long-term care?']]}],
 [/^\/financial-services/,{name:'Financial Education',prompts:[['Life insurance','Compare term and whole life insurance'],['Long-Term Care','How does long-term care insurance work?'],['Annuities','What are annuities and how do surrender charges work?']]}],
 [/^\/about/,{name:'Our Mission',prompts:[['Mission','What does No Family Left Behind mean?'],['Mentorship','What mentorship programs are available?'],['Contact','How can I speak to the team?']]}],
 [/^\/(join|schedule|consultation)/,{name:'Plan Your Next Step',prompts:[['Book a call','How do I request an appointment?'],['Life insurance','What are common life insurance types?'],['Mentorship','What support is offered to new agents?']]}]
];
const context=contexts.find(item=>item[0].test(route))?.[1]||{name:'DominionStar',prompts:[['Mentorship','What mentorship programs are available?'],['Family protection','How does life insurance work?'],['Probate & legacy','What is probate and how do beneficiaries work?']]};
const state={available:false,webSearchAvailable:false,research:false,ai:false,busy:false,lastTopic:'',history:[],lastReply:''};
const sensitive=/\b\d{3}[- ]?\d{2}[- ]?\d{4}\b|\b(?:ssn|social security|credit card|bank account|routing number|password|my diagnosis|account number)\b|(?:\b(?:\d[ -]*?){13,16}\b)/i;
let chat,field,send,indicator,switcher,note,mic,sourceToggle;
function permitted(url){
 if(/^\/(?!\/)[A-Za-z0-9/?=&#%-]*$/.test(url))return true;
 try{
  const u=new URL(url,location.origin);
  if(u.protocol!=='https:')return false;
  const valid=['content.naic.org','naic.org','tdi.texas.gov','fsrao.ca','lautorite.qc.ca','canada.ca','investor.gov','irs.gov'];
  return valid.some(domain=>u.hostname===domain||u.hostname.endsWith('.'+domain));
 }catch{return false}
}
function openChat(){if(!panel)return;panel.hidden=false;launcher.setAttribute('aria-expanded','true');field?.focus();}
function closeChat(){if(!panel)return;panel.hidden=true;launcher.setAttribute('aria-expanded','false');launcher.focus();}
function updateMode(){
 if(!indicator)return;
 indicator.textContent=state.ai?'AI MODE':state.available?'AI AVAILABLE':'GUIDED KNOWLEDGE';
 switcher.hidden=!state.available;
 if(sourceToggle){sourceToggle.hidden=!(state.available&&state.ai&&state.webSearchAvailable);sourceToggle.setAttribute('aria-pressed',String(state.research));sourceToggle.textContent=state.research?'Search official sources ✓':'Search official sources';}
 switcher.textContent=state.ai?'Turn off AI':'Enable AI answers';
 switcher.setAttribute('aria-pressed',String(state.ai));
 note.textContent=state.ai?(state.research?'Research mode may search approved regulator sites; links appear only when actually cited. Questions and recent chat go to an AI provider.':'AI answers may use your question and recent conversation. Turn on source search to research selected regulator websites.'):'Instant educational guidance from a curated knowledge guide. It is not a live web search.';
}
function line(text,kind,tag){
 const item=document.createElement('article');
 item.className='aurora-v8-message '+kind;
 const head=document.createElement('small');head.textContent=tag|| (kind==='user'?'YOU':'AURORA · GUIDED');
 const p=document.createElement('p');p.textContent=text;item.append(head,p);chat.append(item);chat.scrollTop=chat.scrollHeight;
 return item;
}
function action(parent,url,label){
 if(!url||!permitted(url))return;
 const a=document.createElement('a');a.href=url;a.textContent=label+' ↗';
 a.className='aurora-v8-link';
 if(url.startsWith('https:')){a.target='_blank';a.rel='noopener noreferrer';}
 parent.append(a);
}
function reply(text,tag,knowledge,searchMeta){
 const bubble=line(text,'assistant',tag);
 const actions=document.createElement('div');actions.className='aurora-v8-actions';
 action(actions,knowledge?.url,knowledge?.label||'Explore this page');
 if(searchMeta?.researchPerformed){
  const sourceHeader=document.createElement('strong');sourceHeader.className='aurora-source-title';sourceHeader.textContent=searchMeta.sources?.length?'Sources used in this web search':'Web search completed · No verified citation links returned';actions.append(sourceHeader);
  for(const item of (searchMeta.sources||[]))action(actions,item.url,'Source: '+(item.title||'Official reference'));
 }else if(knowledge?.source){action(actions,knowledge.source,'Reference reading · not live searched');}
 action(actions,'/schedule/','Request a conversation');
 if(actions.childNodes.length)bubble.append(actions);
 const tools=document.createElement('div');tools.className='aurora-v8-message-tools';
 const copy=document.createElement('button');copy.type='button';copy.textContent='Copy';
 copy.addEventListener('click',()=>navigator.clipboard?.writeText(text).then(()=>copy.textContent='Copied').catch(()=>{}));
 tools.append(copy);
 if('speechSynthesis' in window){
  const listen=document.createElement('button');listen.type='button';listen.textContent='Listen';
  listen.addEventListener('click',()=>{if(window.speechSynthesis.speaking){window.speechSynthesis.cancel();return;}
   const utterance=new SpeechSynthesisUtterance(text);utterance.lang='en-US';window.speechSynthesis.speak(utterance);});
  tools.append(listen);
 }
 bubble.append(tools);state.lastReply=text;
}
function chips(list){
 chat.querySelectorAll('.aurora-v8-chips').forEach(n=>n.remove());
 const row=document.createElement('div');row.className='aurora-v8-chips';
 list.slice(0,3).forEach(pair=>{const button=document.createElement('button');button.type='button';button.textContent=pair[0]+' ↗';button.addEventListener('click',()=>ask(pair[1]));row.append(button);});
 chat.append(row);chat.scrollTop=chat.scrollHeight;
}
function suggestions(topic){
 const more={
  'discovery':[['Protect family','Who might need life insurance and why?'],['Plan for care','Who might consider LTC planning and why?'],['Retirement income','Who might consider annuities and why?']],
  'life-why':[['Policy types','Compare term and whole life insurance'],['Legacy planning','How do beneficiary designations affect probate?']],
  'ltc-why':[['Waiting periods','What is an LTC elimination period?'],['Care cost tool','How do LTC benefit limits work?']],
  'annuity-why':[['Fixed indexed','What is a fixed indexed annuity?'],['Surrender charges','What are annuity surrender charges?']],
 'probate':[['Beneficiaries','Can life insurance proceeds pass outside probate?'],['Real stories','Tell me about real probate estate cases']],
 'probate-stories':[['How probate works','What is probate court?'],['Beneficiaries','Why are beneficiary designations important?']],
 'canada':[['LLQP preparation','What is the LLQP licensing process in Canada?'],['Mentorship','Does DominionStar offer Canadian mentorship inquiries?']],
 'term-statistics':[['Read term coverage','How does term life insurance work?'],['Claim conditions','What happens to term life when it expires?']],
 'term-whole':[['Cost differences','Why can term and whole life cost differently?'],['Policy duration','What happens when term life expires?']],
 'iul':[['Policy charges','What are policy charges in IUL?'],['Lapse risk','Can an IUL policy lapse?']],
 'ltc':[['Hybrid LTC','What are hybrid long-term care policies?'],['Benefit triggers','How are LTC benefits triggered?']],
 'annuity':[['Surrender costs','What is an annuity surrender charge?'],['Fixed indexed annuities','How do fixed indexed annuities work?']],
 'mentorship':[['Getting Started','What does beginner mentorship cover?'],['Leadership','What is leadership mentorship?']],
 'career':[['Licensing','How do I prepare for the license exam?'],['First 90 days','What is the early career path?']],
 'annuity':[['Fixed indexed','What is a fixed indexed annuity?'],['Surrender charges','What are annuity surrender charges?']]
 };return more[topic]||context.prompts;
}
async function ask(raw){
 const q=String(raw||'').trim().slice(0,450);
 if(!q||state.busy)return;
 if(sensitive.test(q)){line('Please avoid sharing sensitive financial, medical or identifying information. Contact our team privately for a personal discussion.','assistant','AURORA · PRIVACY');return;}
 openChat();chat.querySelectorAll('.aurora-v8-chips').forEach(n=>n.remove());
 line(q,'user','YOU');
 const trusted=createAnswer(q,state.lastTopic);
 state.lastTopic=trusted.topic;
 const previous=state.history.slice(-6);
 state.history.push({role:'user',content:q});
 field.value='';state.busy=true;send.disabled=true;field.disabled=true;
 let pending;
 try{
  if(state.ai){
   pending=line(state.research?'Checking official sources for your question…':'Preparing an AI answer to your question…','assistant pending',state.research?'AURORA · SOURCE RESEARCH':'AURORA · WORKING');
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),state.research?24000:17500);
   let result;
   try{result=await fetch('/.netlify/functions/aurora-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q,page:route,history:previous,research:state.research&&state.webSearchAvailable}),signal:controller.signal});}finally{clearTimeout(timeout);}
   const data=await result.json().catch(()=>({}));
   pending.remove();pending=null;
   if(result.ok && data.mode==='ai' && data.answer){
    reply(String(data.answer).replace(/cite[^]+/g,'').slice(0,2600),data.researchPerformed?'AURORA · RESEARCHED ANSWER':'AURORA · AI RESPONSE',trusted,data);
   }else if(result.status===422){
    reply('Please avoid sharing private identifying, financial or medical details in this chat. Request a private conversation instead.','AURORA · PRIVACY',{url:'/schedule/',label:'Request a call'});
   }else{
    reply(trusted.message,'AURORA · VERIFIED GUIDE',trusted);
    line(result.status===429?'AI requests are temporarily limited. Aurora switched to its educational guide.':'The live AI service is unavailable. Aurora switched to its educational guide.','system','AURORA STATUS');
   }
  }else{
   reply(trusted.message,'AURORA · VERIFIED GUIDE',trusted);
  }
 }catch{
  pending?.remove();
  reply(trusted.message,'AURORA · VERIFIED GUIDE',trusted);
  line('AI could not be reached. Aurora used its educational guide instead.','system','AURORA STATUS');
 }finally{
  state.history.push({role:'assistant',content:state.lastReply.slice(0,900)});
  state.history=state.history.slice(-8);
  state.busy=false;send.disabled=false;field.disabled=false;
  chips(suggestions(trusted.topic));field.focus();
 }
}
function clearChat(){
 state.history=[];state.lastTopic='';state.lastReply='';
 chat.replaceChildren();
 const intro=document.createElement('div');intro.className='aurora-v8-welcome';
 intro.innerHTML='<span>DOMINIONSTAR INTELLIGENCE</span><h3>A conversation built around you.</h3><p>Ask about financial protection, mentorship, professional growth or your next step. Browse as much as you want before booking.</p>';
 const ctx=document.createElement('div');ctx.className='aurora-v8-context';ctx.textContent='✧ Currently exploring: '+context.name;intro.append(ctx);chat.append(intro);
 chips(context.prompts);
}

function enhanceContactPanels(){
 const svg=(kind)=>{
 const paths={phone:'<path d="M22 17v3a2 2 0 0 1-2.2 2A20 20 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.7 2.7a2 2 0 0 1-.5 2.1L7.9 9.8a16 16 0 0 0 6.3 6.3l1.3-1.3a2 2 0 0 1 2.1-.5c.9.4 1.8.6 2.7.7A2 2 0 0 1 22 17z"/>',
 mail:'<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m3 6 9 7 9-7"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 15h3"/>'};
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[kind]+'</svg>';
 };
 document.querySelectorAll('.contact-panel').forEach(panel=>{
  panel.classList.add('contact-executive');
  panel.innerHTML='<div class="connect-heading"><p class="connect-kicker"><span class="connect-dot"></span> CONNECT WITH DOMINIONSTAR</p>'+
   '<h3>Start the right conversation.</h3><p>Financial services, mentorship or career development—reach our team in the way that works for you.</p>'+
   '<span class="connect-region">United States & Canada inquiries</span></div>'+
   '<div class="connect-actions">'+
   '<a class="connect-option" href="tel:+13462042641"><span class="connect-icon">'+svg('phone')+'</span><span class="connect-title">Call DominionStar</span><span class="connect-detail">(346) 204-2641</span><span class="connect-arrow">Call now ↗</span></a>'+
   '<a class="connect-option" href="mailto:dominionstarwfg@gmail.com"><span class="connect-icon">'+svg('mail')+'</span><span class="connect-title">Email our team</span><span class="connect-detail">dominionstarwfg@gmail.com</span><span class="connect-arrow">Write an email ↗</span></a>'+
   '<a class="connect-option connect-primary" href="/schedule/"><span class="connect-icon">'+svg('calendar')+'</span><span class="connect-title">Request a conversation</span><span class="connect-detail">Select a topic and preferred time</span><span class="connect-arrow">Request a call ↗</span></a>'+
   '</div><p class="connect-legal">Appointment requests are subject to confirmation by our team.</p>';
 });
}

function setup(){
 enhanceContactPanels();
 if(!launcher||!panel)return;
 launcher.classList.add('aurora-v8-launch');
 launcher.innerHTML=['<span class="aurora-v8-spark" aria-hidden="true">✦</span>','<span><strong>Ask Aurora</strong><small>Your intelligence guide</small></span>','<span aria-hidden="true">↗</span>'].join('');
 launcher.setAttribute('aria-label','Open Aurora assistant');
 panel.classList.add('aurora-v8-panel');
 panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-labelledby','auroraV8Title');
 panel.innerHTML=[
 '<header class="aurora-v8-head"><div class="aurora-v8-orb" aria-hidden="true">✦</div>',
 '<div class="aurora-v8-heading"><strong id="auroraV8Title">Aurora <em>7.0</em></strong><small>DominionStar • No Family Left Behind</small></div>',
 '<div class="aurora-v8-headbtns"><button type="button" data-aurora-clear title="New conversation" aria-label="Clear conversation">↺</button><button type="button" data-aurora-wide title="Expand assistant" aria-label="Expand assistant">⤢</button><button type="button" data-aurora-close aria-label="Close assistant">×</button></div></header>',
 '<div class="aurora-v8-mode"><span class="aurora-v8-indicator" role="status">GUIDED KNOWLEDGE</span><div class="aurora-v8-mode-tools"><button type="button" class="aurora-v8-research" hidden aria-pressed="false" title="Search official regulator sources using AI">Search official sources</button><button type="button" class="aurora-v8-switch" hidden aria-pressed="false">Enable AI answers</button></div></div>',
 '<div class="aurora-chat aurora-v8-transcript" role="log" aria-label="Aurora conversation" aria-live="polite"></div>',
 '<div class="aurora-v8-bottom"><form class="aurora-v8-form"><textarea rows="2" maxlength="450" aria-label="Message Aurora" required placeholder="Ask about life insurance, IUL, LTC, mentoring…"></textarea>',
 '<div class="aurora-v8-sendrow"><small>Enter to send · Shift+Enter for new line</small><div><button type="button" class="aurora-v8-mic" hidden title="Speak to Aurora" aria-label="Speak to Aurora"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5.5 10.5v1.5a6.5 6.5 0 0 0 13 0v-1.5M12 18.5v3M8 21.5h8"/></svg></button><button type="submit" class="aurora-v8-send" aria-label="Send message to Aurora"><span>Send</span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg></button></div></div></form>',
 '<p class="aurora-v8-note">Educational information only. Do not share sensitive information.</p></div>'
 ].join('');
 chat=panel.querySelector('.aurora-v8-transcript');field=panel.querySelector('textarea');
 send=panel.querySelector('.aurora-v8-send');indicator=panel.querySelector('.aurora-v8-indicator');
 switcher=panel.querySelector('.aurora-v8-switch');sourceToggle=panel.querySelector('.aurora-v8-research');note=panel.querySelector('.aurora-v8-note');mic=panel.querySelector('.aurora-v8-mic');
 launcher.addEventListener('click',()=>panel.hidden?openChat():closeChat());
 panel.querySelector('[data-aurora-close]').addEventListener('click',closeChat);
 panel.querySelector('[data-aurora-clear]').addEventListener('click',clearChat);
 panel.querySelector('[data-aurora-wide]').addEventListener('click',()=>panel.classList.toggle('aurora-v8-wide'));
 switcher.addEventListener('click',()=>{state.ai=!state.ai;if(!state.ai)state.research=false;updateMode();line(state.ai?'AI mode enabled. Future messages may be processed by a model provider.':'Guided educational mode enabled.','system','AURORA STATUS')});
 sourceToggle.addEventListener('click',()=>{if(!state.available||!state.ai||!state.webSearchAvailable)return;state.research=!state.research;updateMode();});
 panel.querySelector('form').addEventListener('submit',e=>{e.preventDefault();ask(field.value)});
 field.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();ask(field.value)}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)closeChat()});
 const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(SpeechRecognition){
  mic.hidden=false;
  mic.addEventListener('click',()=>{
   if(!window.confirm('Use browser speech recognition? Audio may be processed by your browser’s speech service. Avoid sensitive information.'))return;
   const recognition=new SpeechRecognition();recognition.lang='en-US';recognition.interimResults=false;
   recognition.onresult=e=>{field.value=String(e.results?.[0]?.[0]?.transcript||'').slice(0,450);field.focus()};
   recognition.onend=()=>mic.classList.remove('is-listening');recognition.onerror=()=>mic.classList.remove('is-listening');
   mic.classList.add('is-listening');recognition.start();
  });
 }
 document.querySelectorAll('[data-aurora-question]').forEach(btn=>btn.addEventListener('click',()=>ask(btn.dataset.auroraQuestion)));
 clearChat();updateMode();
 fetch('/.netlify/functions/aurora-chat',{method:'GET',cache:'no-store'})
.then(r=>r.ok?r.json():null).then(d=>{state.available=d?.mode==='available';state.webSearchAvailable=!!d?.webSearchAvailable;updateMode()})
 .catch(()=>{state.available=false;updateMode()});
 window.DominionStarAurora={open:openChat,answerForQuestion:createAnswer,version:'7.0'};
}
const menu=document.querySelector('.menu-button'),nav=document.querySelector('.main-nav');
menu?.addEventListener('click',()=>{const open=nav?.classList.toggle('open')||false;menu.setAttribute('aria-expanded',String(open));menu.textContent=open?'×':'☰'});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){nav?.classList.remove('open');menu?.setAttribute('aria-expanded','false')}});
document.querySelectorAll('.faq-item button').forEach(btn=>btn.addEventListener('click',()=>{const open=btn.getAttribute('aria-expanded')!=='true';btn.setAttribute('aria-expanded',String(open));if(btn.nextElementSibling)btn.nextElementSibling.hidden=!open;const span=btn.querySelector('span');if(span)span.textContent=open?'−':'+'}));
const region=new URLSearchParams(location.search).get('region');
if(region==='canada'){
 const country=document.querySelector('select[name="country"]');
 const interest=document.querySelector('select[name="goal"]');
 if(country)country.value='Canada';
 if(interest)interest.value='Canada recruiting / mentorship';
}
const topic=new URLSearchParams(location.search).get('topic');
const options=new Set(['family-protection','long-term-care','retirement','wealth-education','college-planning','business-solutions','annual-review','general']);
const interest=document.querySelector('select[name="interest"]');if(interest&&options.has(topic))interest.value=topic;
const today=new Date();const minDate=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
document.querySelectorAll('input[type="date"]').forEach(input=>input.min=minDate);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();