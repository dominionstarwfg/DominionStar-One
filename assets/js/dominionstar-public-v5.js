
(()=>{
const toggle=document.querySelector('.menu-button'),nav=document.querySelector('.main-nav');
toggle?.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'×':'☰'});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){nav?.classList.remove('open');toggle?.setAttribute('aria-expanded','false');closeAurora()}});
document.querySelectorAll('.faq-item button').forEach(btn=>btn.addEventListener('click',()=>{const open=btn.getAttribute('aria-expanded')==='true';btn.setAttribute('aria-expanded',String(!open));btn.nextElementSibling.hidden=open;btn.querySelector('span').textContent=open?'+':'−'}));
const launch=document.querySelector('.aurora-trigger'),panel=document.querySelector('.aurora-panel'),close=document.querySelector('.aurora-head button'),form=document.querySelector('.aurora-form'),input=document.querySelector('.aurora-form input'),chat=document.querySelector('.aurora-chat');
function closeAurora(){if(panel){panel.hidden=true;launch?.setAttribute('aria-expanded','false')}}
function openAurora(){panel.hidden=false;launch?.setAttribute('aria-expanded','true');input?.focus()}
launch?.addEventListener('click',()=>panel.hidden?openAurora():closeAurora());close?.addEventListener('click',closeAurora);
function say(msg,mine=false,url='',label=''){const d=document.createElement('div');d.className='aurora-bubble'+(mine?' mine':'');d.textContent=msg;if(url){const a=document.createElement('a');a.href=url;a.textContent='\n'+label+' →';d.appendChild(a)}chat.appendChild(d);chat.scrollTop=chat.scrollHeight}
const guides=[
{words:['mentor','coaching','training','support','guidance','program'],reply:'DominionStar offers three mentorship pathways: Getting Started, Professional Growth and Leadership Mentorship. Program availability is confirmed through a conversation.',url:'/mentorship/',label:'Explore Mentorship Programs'},
{words:['license','exam','study','agent'],reply:'Licensing requirements depend on your jurisdiction. Our mentorship information explains preparation, expectations and how to request individual guidance.',url:'/mentorship/',label:'Licensing & Mentorship'},
{words:['career','job','opportun','recruit','joining','income','commission'],reply:'Explore the professional journey, possible licensing requirements, mentorship and important expectations. Compensation is not guaranteed.',url:'/opportunity/',label:'Explore Careers'},
{words:['long-term','ltc','insurance','retire','protect','financial','famil','wealth','college','legacy'],reply:'Our financial-services pages explain family protection, retirement preparation, long-term care considerations and planning topics. Personalized options require a licensed professional.',url:'/financial-services/',label:'Financial Services'},
{words:['founder','mission','about','history','leader'],reply:'DominionStar is guided by the mission “No Family Left Behind.” Read the founder introduction, leadership philosophy and values on the About page.',url:'/about/',label:'About DominionStar'},
{words:['call','contact','appointment','schedule','book','speak'],reply:'You can request a DominionStar conversation through our appointment page. Please note that an appointment request is not a confirmed booking.',url:'/schedule/',label:'Request a Call'}
];
function answer(v){const text=v.trim().slice(0,450);if(!text)return;say(text,true);const q=text.toLowerCase();let chosen=guides.find(g=>g.words.some(w=>q.includes(w)));if(!chosen){say('I can help you find information about mentorship, careers, financial services, our founder, or booking a conversation. Which would you like to explore?');return}say(chosen.reply,false,chosen.url,chosen.label)}
form?.addEventListener('submit',e=>{e.preventDefault();answer(input.value);input.value=''});
document.querySelectorAll('[data-aurora-question]').forEach(b=>b.addEventListener('click',()=>{openAurora();answer(b.dataset.auroraQuestion)}));
window.DominionStarAurora={open:openAurora};
})();
