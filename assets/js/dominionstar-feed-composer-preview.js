/* DominionStar One — local Feed composer preview (no network, no storage).
 * Works for authenticated, approved agents and backend-disabled design previews.
 * Text/links/hashtags only; media remains a blocked local draft until release gate.
 */
(()=>{
  'use strict';
  const body=document.getElementById('feedComposerBody');
  const toggle=document.getElementById('feedComposerPreviewToggle');
  const panel=document.getElementById('feedComposerPreview');
  const content=document.getElementById('feedComposerPreviewText');
  const styleLabel=document.getElementById('feedComposerPreviewKind');
  const counter=document.getElementById('feedComposerCharacterCount');
  if(!body||!toggle||!panel||!content)return;

  const TAG=/(#[\p{L}\p{N}_]{1,64})/gu;
  const URLS=/(https?:\/\/[^\s<>"']+)/gi;
  const ZOOM=/https?:\/\/(?:[\w-]+\.)*zoom\.us\/(?:j\/|my\/|wc\/join\/|s\/)/i;
  const safeExternal=(text)=>{
    const ending=(text.match(/[).,!?;:]+$/)||[])[0]||'';
    const candidate=text.slice(0,text.length-ending.length);
    try{
      const url=new URL(candidate);
      if(url.protocol!=='https:'&&url.protocol!=='http:')return null;
      return {href:url.href,label:candidate,ending};
    }catch{return null;}
  };
  const addTags=(root,text)=>{
    String(text).split(TAG).forEach(part=>{
      if(/^#[\p{L}\p{N}_]{1,64}$/u.test(part)){
        const a=document.createElement('a');
        a.className='ds30-hashtag';
        a.href='/feed/?tag='+encodeURIComponent(part.slice(1));
        a.textContent=part;
        root.appendChild(a);
      }else root.appendChild(document.createTextNode(part));
    });
  };
  const writeRichText=(root,text)=>{
    root.replaceChildren();
    String(text).split(URLS).forEach(part=>{
      if(!/^https?:\/\//i.test(part)){addTags(root,part);return;}
      const safe=safeExternal(part);
      if(!safe){root.appendChild(document.createTextNode(part));return;}
      const a=document.createElement('a');
      a.href=safe.href;
      a.target='_blank';
      a.rel='noopener noreferrer nofollow';
      a.textContent=safe.label;
      root.appendChild(a);
      if(safe.ending)root.appendChild(document.createTextNode(safe.ending));
    });
  };
  const getKind=text=>ZOOM.test(text)?'meeting':/https?:\/\/[^\s<>"']+/i.test(text)?'link':'text';
  const updateIdentity=()=>{
    const source=document.getElementById('feedPageAvatar');
    const previewPhoto=document.getElementById('feedComposerPreviewAvatar');
    const previewInitials=document.getElementById('feedComposerPreviewInitials');
    const sourceInitials=document.getElementById('feedPageInitials');
    const name=document.getElementById('feedPageName')?.textContent?.trim()||'DominionStar Member';
    const rank=document.getElementById('feedPageRank')?.textContent?.trim()||'Approved member';
    const nameOut=document.getElementById('feedComposerPreviewAuthor');
    const rankOut=document.getElementById('feedComposerPreviewRank');
    if(nameOut)nameOut.textContent=name;
    if(rankOut)rankOut.textContent=rank;
    if(previewInitials)previewInitials.textContent=sourceInitials?.textContent?.trim()||name.split(/\s+/).map(word=>word[0]).slice(0,2).join('').toUpperCase()||'DS';
    if(previewPhoto&&source?.src&&source.complete&&source.naturalWidth>0){
      previewPhoto.src=source.src;
      previewPhoto.hidden=false;
      if(previewInitials)previewInitials.hidden=true;
    }else if(previewPhoto){
      previewPhoto.hidden=true;previewPhoto.removeAttribute('src');
      if(previewInitials)previewInitials.hidden=false;
    }
  };
  const render=()=>{
    const raw=String(body.value||'');
    const text=raw.trim();
    const kind=getKind(text);
    if(counter){
      const limit=Number(body.maxLength)||2000;
      counter.textContent=raw.length+' / '+limit+' characters';
      counter.classList.toggle('ds30-char-limit',raw.length>=limit);
    }
    panel.dataset.postKind=kind;
    if(styleLabel)styleLabel.textContent=kind==='meeting'?'Zoom meeting link':kind==='link'?'Link post':'Text post';
    if(!text){
      content.textContent='Your post will appear here exactly as readers will see it.';
      content.classList.add('ds30-preview-placeholder');
    }else{
      content.classList.remove('ds30-preview-placeholder');
      writeRichText(content,text);
    }
    updateIdentity();
  };
  const setOpen=open=>{
    panel.hidden=!open;
    toggle.setAttribute('aria-expanded',String(open));
    toggle.textContent=open?'Hide preview':'Preview post';
    if(open)render();
  };
  toggle.addEventListener('click',()=>setOpen(panel.hidden));
  body.addEventListener('input',()=>{
    if(!panel.hidden)render();
    else if(counter){
      const limit=Number(body.maxLength)||2000;
      counter.textContent=body.value.length+' / '+limit+' characters';
    }
  });
  const sourceImage=document.getElementById('feedPageAvatar');
  sourceImage?.addEventListener('load',()=>{if(!panel.hidden)updateIdentity();});
  sourceImage?.addEventListener('error',()=>{if(!panel.hidden)updateIdentity();});
  document.getElementById('feedPageComposer')?.addEventListener('reset',()=>setOpen(false));
  document.addEventListener('click',event=>{
    // An unconfigured Netlify review never publishes. No network request.
    if(!document.body.classList.contains('ds-visual-review'))return;
    if(event.target.closest('#feedComposerPublish')){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },true);
  // On Netlify visual reviews the identity fixture applies its body class
  // at DOMContentLoaded, after deferred scripts. Check at event time instead.
  document.getElementById('feedPageComposer')?.addEventListener('submit',event=>{
    if(!document.body.classList.contains('ds-visual-review'))return;
    event.preventDefault();
    event.stopImmediatePropagation();
  },true);
  render();
  window.DSFeedComposerPreview=Object.freeze({getKind,render});
})();
