/* DominionStar Community media draft — local-only, review branch.
 * Deliberate fail-closed behavior: no Storage/API upload calls.
 * Never accept a browser toggle as server-side authorization.
 */
(() => {
  'use strict';
  const RULES = Object.freeze({
    'image/jpeg':{ext:['jpg','jpeg'],max:15*1024*1024,kind:'photo'},
    'image/png': {ext:['png'],max:15*1024*1024,kind:'photo'},
    'image/webp':{ext:['webp'],max:15*1024*1024,kind:'photo'},
    'application/pdf':{ext:['pdf'],max:12*1024*1024,kind:'flyer'},
    'video/mp4': {ext:['mp4'],max:80*1024*1024,kind:'video'},
    'video/webm':{ext:['webm'],max:80*1024*1024,kind:'video'}
  });
  const MAX_ITEMS=4;
  const MAX_TOTAL=100*1024*1024;
  const safeType = (file) => RULES[String(file?.type||'').toLowerCase()];
  const extension = (name) => String(name||'').toLowerCase().split('.').pop();
  function validateFile(file) {
    if(!file || typeof file.size!=='number')return {ok:false,reason:'The selected file is invalid.'};
    const rule=safeType(file);
    if(!rule || !rule.ext.includes(extension(file.name)))return {ok:false,reason:'Use JPG, PNG, WebP, PDF, MP4, or WebM files.'};
    if(file.size<1)return {ok:false,reason:'The file is empty.'};
    if(file.size>rule.max)return {ok:false,reason:rule.kind==='video'?'Videos must be 80 MB or less.':'Photos and flyers must meet their size limits.'};
    return {ok:true,kind:rule.kind,max:rule.max};
  }
  async function validateSignature(file) {
    const check=validateFile(file);
    if(!check.ok)return check;
    if(typeof file.slice!=='function')return {ok:false,reason:'Cannot inspect this file.'};
    const buf=await file.slice(0,16).arrayBuffer();
    const b=new Uint8Array(buf);
    const eq=(offset,expected)=>expected.every((value,i)=>b[offset+i]===value);
    const type=String(file.type).toLowerCase();
    const matched=(
      (type==='image/jpeg' && eq(0,[0xff,0xd8,0xff])) ||
      (type==='image/png' && eq(0,[137,80,78,71,13,10,26,10])) ||
      (type==='image/webp' && eq(0,[82,73,70,70])&&eq(8,[87,69,66,80])) ||
      (type==='application/pdf' && eq(0,[37,80,68,70,45])) ||
      (type==='video/webm' && eq(0,[26,69,223,163])) ||
      (type==='video/mp4' && eq(4,[102,116,121,112]))
    );
    return matched ? check : {ok:false,reason:'File type and content do not match. Choose a valid original file.'};
  }
  const bytes = size => size>=1048576 ? (size/1048576).toFixed(1)+' MB' : Math.ceil(size/1024)+' KB';

  function mount({form,root} = {}) {
    if(!form||!root)throw new Error('Community composer not found.');
    if(root.dataset.mediaDraftMounted==='true')return;
    root.dataset.mediaDraftMounted='true';
    // The user can select and inspect attachments as a local draft; no uploads.
    const attach=root.querySelector('[data-draft-attach]');
    const input=root.querySelector('[data-draft-file-input]');
    if(!attach||!input)throw new Error('The unified attachment control is unavailable.');
    const tray=root.querySelector('[data-draft-tray]');
    const note=root.querySelector('[data-draft-note]');
    const publish=form.querySelector('#communityPostSubmit,[data-draft-publish]');
    if(!publish)throw new Error('The publish control is unavailable.');
    const entries=[];
    const objectUrls=new Set();
     let validationInProgress=false;
    const setNote=(value,error=false)=>{
      note.textContent=value;
      note.classList.toggle('is-error',error);
    };
    const discard=(item)=>{
      if(item.url){ URL.revokeObjectURL(item.url);objectUrls.delete(item.url); }
      const at=entries.indexOf(item);if(at>=0)entries.splice(at,1);
    };
    const render=()=>{
      tray.replaceChildren();
      const count=document.createElement('p');
      count.className='dsmedia-tray-title';
      count.textContent=entries.length
        ? entries.length+' attachment'+(entries.length===1?'':'s')+' selected · local preview only'
        : 'No attachments selected';
      tray.appendChild(count);
      for(const item of entries){
        const card=document.createElement('div');card.className='dsmedia-file-card';
        const preview=document.createElement('div');preview.className='dsmedia-file-thumb';
        if(item.kind==='photo'){
          const img=document.createElement('img');img.src=item.url;img.alt='Selected photo preview';
          preview.appendChild(img);
        }else if(item.kind==='video'){
          const video=document.createElement('video');video.src=item.url;video.muted=true;
          video.controls=true;video.preload='metadata';video.playsInline=true;
          video.setAttribute('aria-label','Selected video preview');preview.appendChild(video);
        }else{
          preview.textContent='PDF';
          preview.setAttribute('aria-label','Selected PDF flyer');
        }
        const info=document.createElement('div');info.className='dsmedia-file-info';
        const name=document.createElement('strong');name.textContent=item.file.name;
        const detail=document.createElement('small');detail.textContent=(item.kind==='photo'?'Photo':item.kind==='flyer'?'Flyer (PDF)':'Video')+' · '+bytes(item.file.size);
        info.append(name,detail);
        const remove=document.createElement('button');remove.type='button';remove.className='dsmedia-remove';remove.textContent='Remove';
        remove.setAttribute('aria-label','Remove '+item.file.name);
        remove.addEventListener('click',()=>{discard(item);render();});
        card.append(preview,info,remove);
        tray.appendChild(card);
      }
      const hasFiles=entries.length>0;
      const blocked=hasFiles||validationInProgress;
      // Prevent the existing text-only submit handler from publishing a
      // misleading successful post when media files remain unuploaded.
      publish.disabled=blocked;
      if(attach)attach.disabled=validationInProgress;
      publish.textContent=validationInProgress?'Checking attachments…':hasFiles?'Remove attachments to publish':'Publish Post';
      if(validationInProgress)setNote('Checking file type and size. Publishing is paused until validation finishes.');
      else if(hasFiles)setNote('Draft only — attachments have NOT been uploaded. Remove attachments to publish a text-only post.');
      else setNote('Text and links can be published. Secure media uploads are not enabled.');
    };
    attach?.addEventListener('click',()=>{
      if(validationInProgress)return;
      input.value='';
      input.click();
    });
    input?.addEventListener('change',async()=>{
      if(validationInProgress)return;
      validationInProgress=true;
      render();
      const selected=Array.from(input.files||[]);
      let validationError='';
      for(const file of selected){
        if(entries.length>=MAX_ITEMS){validationError='A post can hold up to four draft attachments.';break;}
        if(entries.some(item=>item.file.name===file.name&&item.file.size===file.size)){
          validationError='This file is already in your draft.';continue;
        }
        if(entries.reduce((n,item)=>n+item.file.size,0)+file.size>MAX_TOTAL){
          validationError='The combined draft may not exceed 100 MB.';continue;
        }
        let validated;
        try{validated=await validateSignature(file);}catch{validated={ok:false,reason:'Unable to inspect file.'};}
        if(!validated.ok){validationError=validated.reason;continue;}
        const url=validated.kind==='flyer'?null:URL.createObjectURL(file);
        if(url)objectUrls.add(url);
        entries.push({file,kind:validated.kind,url});
      }
      input.value='';
      validationInProgress=false;
      render();
      if(validationError)setNote(validationError,true);
    });
    form.addEventListener('submit',event=>{
      if(!entries.length&&!validationInProgress)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setNote(validationInProgress?'File validation is still running. Please finish checking the attachments.':'Media is not published. Remove the draft attachments to publish your text.',true);
    },true);
    window.addEventListener('pagehide',()=>{
      for(const url of objectUrls)URL.revokeObjectURL(url);
      objectUrls.clear();
    },{once:true});
    render();
    return {get selectedCount(){return entries.length;},clear(){[...entries].forEach(discard);render();}};
  }
  window.DSCommunityMediaDraft=Object.freeze({mount,validateFile,validateSignature,RULES,MAX_ITEMS,MAX_TOTAL});
  const form=document.getElementById('communityPostForm');
  const root=document.getElementById('communityMediaDraft');
  if(form && root)mount({form,root});
  const feedForm=document.getElementById('feedPageComposer');
  const feedRoot=document.getElementById('feedMediaDraft');
  if(feedForm && feedRoot)mount({form:feedForm,root:feedRoot});
})();