/* DominionStar public OS continuity.
   Enhances standard links; no fake delays, forced navigation or SPA content swaps.
   Safe fallback: if JS fails, every existing page and link still works natively.
*/
(() => {
  'use strict';
  if(document.documentElement.dataset.dsPublicShellInit)return;
  document.documentElement.dataset.dsPublicShellInit='1';
  document.body.classList.add('ds-public-app');
  const paths=[
    {name:'Home',url:'/',desc:'Our purpose and latest updates',glyph:'home'},
    {name:'Mentorship',url:'/mentorship/',desc:'Developing professionals',glyph:'book'},
    {name:'Career Opportunities',url:'/opportunity/',desc:'Join our professional network',glyph:'users'},
    {name:'Financial Services',url:'/financial-services/',desc:'Financial education and protection',glyph:'shield'},
    {name:'Knowledge',url:'/knowledge/',desc:'Articles and practical resources',glyph:'book'},
    {name:'About DominionStar',url:'/about/',desc:'Our mission and founder',glyph:'star'},
    {name:'Request a Call',url:'/schedule/',desc:'Contact and scheduling',glyph:'calendar'},
    {name:'Member Login',url:'/member-login/',desc:'Your private agent workspace',glyph:'user'}
  ];
  const symbols={
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    home:'<path d="m3 10 9-7 9 7v11H3V10Zm6 11v-7h6v7"/>',
    book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5V4a2 2 0 0 1 2-2h14v19H6.5A2.5 2.5 0 0 1 4 19.5Z"/>',
    users:'<circle cx="8" cy="7" r="4"/><path d="M1 21v-2a7 7 0 0 1 14 0v2M16 3a4 4 0 0 1 0 8m2 5a6 6 0 0 1 5 5"/>',
    shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-4-10 3 3 5-6"/>',
    star:'<path d="m12 2 3 7 7 .7-5.4 4.7L18 22l-6-3.7L6 22l1.4-7.6L2 9.7 9 9l3-7Z"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>'
  };
  const vector = name => '<svg viewBox="0 0 24 24" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">'+(symbols[name]||symbols.star)+'</svg>';
  const activePath=location.pathname.endsWith('/index.html')?location.pathname.slice(0,-10):location.pathname;
  document.querySelectorAll('.main-nav a').forEach(anchor=>{
    const href=anchor.getAttribute('href');
    if(!href||!href.startsWith('/'))return;
    const current=activePath===href||activePath.replace(/\/$/,'')===href.replace(/\/$/,'');
    if(current)anchor.setAttribute('aria-current','page');
    else anchor.removeAttribute('aria-current');
  });
  const progress=document.createElement('div');
  progress.className='dsapp-progress';
  progress.setAttribute('aria-hidden','true');
  progress.innerHTML='<span class="dsapp-progress-bar"></span>';
  document.body.appendChild(progress);
  let moving=false;
  const clear=()=>{moving=false;progress.setAttribute('aria-hidden','true')};
  const begin=()=>{
    if(moving)return;
    moving=true;progress.setAttribute('aria-hidden','false');
  };
  window.addEventListener('pageshow',clear);
  window.addEventListener('pagehide',clear);
  document.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const anchor=event.target.closest('a[href]');
    if(!anchor||anchor.hasAttribute('download')||(anchor.target&&anchor.target!=='_self'))return;
    let url;
    try{url=new URL(anchor.href,location.href)}catch{return;}
    if(url.origin!==location.origin||!['http:','https:'].includes(url.protocol))return;
    if(url.pathname===location.pathname&&url.search===location.search)return;
    begin(); // No timer: the progress track represents a real document navigation.
  },{capture:true});
  const header=document.querySelector('.site-header .header-inner');
  if(!header)return;
  const button=document.createElement('button');
  button.type='button';button.className='dsapp-launch';
  button.setAttribute('aria-label','Explore DominionStar pages');
  button.innerHTML=vector('search')+'<span>Explore</span><kbd>⌘ K</kbd>';
  // Quick navigation belongs to the left-hand action area, directly by the brand.\n  const brand=header.querySelector('.brand');\n  if(brand)brand.insertAdjacentElement('afterend',button); else header.insertBefore(button,header.firstChild);
  const mobile=button.cloneNode(true);mobile.classList.add('dsapp-public-floating');mobile.setAttribute('aria-label','Explore DominionStar');document.body.appendChild(mobile);
  const dialog=document.createElement('dialog');dialog.className='dsapp-dialog';dialog.setAttribute('aria-label','Explore DominionStar');
  dialog.innerHTML='<div class="dsapp-dialog-header">'+vector('search')+'<strong>Explore DominionStar</strong><button class="dsapp-close" type="button" aria-label="Close quick navigation">×</button></div>'
    +'<label class="dsapp-sr" for="dsappSearch">Find a destination</label>'
    +'<input id="dsappSearch" class="dsapp-search" type="search" autocomplete="off" placeholder="Where would you like to go?">'
    +'<nav class="dsapp-results" aria-label="Quick destinations"></nav>'
    +'<footer class="dsapp-foot"><span>Navigate your DominionStar experience</span><span>Esc to close</span></footer>';
  document.body.appendChild(dialog);
  const input=dialog.querySelector('#dsappSearch'),results=dialog.querySelector('.dsapp-results');
  let origin=null;
  const render=()=>{
    const query=input.value.trim().toLowerCase();
    const matches=paths.filter(item=>(item.name+' '+item.desc).toLowerCase().includes(query));
    results.replaceChildren();
    if(!matches.length){
      const blank=document.createElement('p');blank.className='dsapp-empty';blank.textContent='No matching destination. Try a different term.';results.appendChild(blank);return;
    }
    for(const entry of matches){
      const link=document.createElement('a');
      link.className='dsapp-result';link.href=entry.url;
      link.innerHTML=vector(entry.glyph);
      const title=document.createElement('span');title.textContent=entry.name;
      const info=document.createElement('small');info.textContent=entry.desc;
      link.append(title,info);results.appendChild(link);
    }
  };
  const open=event=>{
    origin=event?.currentTarget||document.activeElement;
    if(typeof dialog.showModal!=='function')return;
    dialog.showModal();input.value='';render();input.focus();
  };
  const close=()=>{dialog.close();origin?.focus?.()};
  button.addEventListener('click',open);mobile.addEventListener('click',open);
  dialog.querySelector('.dsapp-close').addEventListener('click',close);
  dialog.addEventListener('click',event=>{
    if(event.target===dialog)close();
  });
  input.addEventListener('input',render);
  input.addEventListener('keydown',event=>{
    if(event.key==='Enter'){
      const first=results.querySelector('a');
      if(first){event.preventDefault();first.click();}
    }
  });
  document.addEventListener('keydown',event=>{
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
      event.preventDefault();
      if(dialog.open)close();else open(event);
    }
  });
})();
