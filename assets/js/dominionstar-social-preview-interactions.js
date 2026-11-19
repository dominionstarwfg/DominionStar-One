/* Backend-free visual review interaction demo. In-memory only.
 * Never persists to Supabase, sends a message, or posts to the network. */
(()=>{
  'use strict';
  const scopes=new Set(['dashboardSocialPreview','feedPageStream']);
  const message=(post,value)=>{
    let node=post.querySelector('.ds-review-preview-feedback');
    if(!node){
      node=document.createElement('p');
      node.className='ds-review-preview-feedback';
      node.setAttribute('role','status');
      node.setAttribute('aria-live','polite');
      post.appendChild(node);
    }
    node.textContent=value;
  };
  const localComments=post=>{
    let panel=post.querySelector('.ds-review-preview-comments');
    if(panel)return panel;
    panel=document.createElement('div');
    panel.className='ds-review-preview-comments';
    panel.hidden=true;
    const label=document.createElement('label');
    label.textContent='Try a sample comment (local preview only)';
    const form=document.createElement('form');
    const input=document.createElement('input');
    input.type='text';
    input.maxLength=240;
    input.required=true;
    input.placeholder='Write a comment…';
    const id='preview-comment-'+Math.random().toString(36).slice(2);
    input.id=id;label.htmlFor=id;
    const submit=document.createElement('button');
    submit.type='submit';submit.textContent='Add locally';
    form.append(input,submit);
    const history=document.createElement('div');
    history.className='ds-review-comment-history';
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const value=input.value.trim();
      if(!value)return;
      const comment=document.createElement('p');
      comment.className='ds-review-local-comment';
      comment.textContent='You (sample): '+value;
      history.appendChild(comment);
      input.value='';
      message(post,'Sample comment added to this browser view only. Nothing was published.');
    });
    panel.append(label,form,history);
    post.appendChild(panel);
    return panel;
  };
  document.addEventListener('click',async e=>{
    const button=e.target.closest('button[data-preview-action]');
    if(!button)return;
    const target=button.closest('#dashboardSocialPreview,#feedPageStream');
    if(!target||!scopes.has(target.id))return;
    const post=button.closest('.ds-review-post');
    if(!post)return;
    const action=button.dataset.previewAction;
    if(action==='like'||action==='love'){
      const on=button.getAttribute('aria-pressed')!=='true';
      button.setAttribute('aria-pressed',String(on));
      const label=action==='love'?'Love':'Like';
      const copy=button.querySelector('.ds-review-action-label');
      if(copy)copy.textContent=on?(action==='love'?'Loved':'Liked'):label;
      message(post,on?'Reaction shown in preview only. No agent activity was updated.':'Sample reaction removed locally.');
    }else if(action==='comment'){
      const panel=localComments(post);
      const open=panel.hidden;
      panel.hidden=!open;
      if(open)panel.querySelector('input')?.focus();
    }else if(action==='repost'){
      message(post,'Repost preview only. No post was published or forwarded to any member.');
    }else if(action==='share'){
      try{
        if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
        await navigator.clipboard.writeText(location.origin+'/feed/');
        message(post,'Preview Feed link copied. No real post was shared.');
      }catch{
        message(post,'Sharing is disabled in this review. Nothing was sent.');
      }
    }
  });
})();
