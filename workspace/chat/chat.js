(()=>{
  const $=s=>document.querySelector(s);
  const contacts=[];
  const histories={};
  let active=null;
  const escapeHtml=s=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function renderContacts(filter=''){
    const term=filter.trim().toLowerCase();
    const list=contacts.filter(c=>`${c.name} ${c.preview||''}`.toLowerCase().includes(term));
    $('#conversationList').innerHTML=list.length
      ? list.map(c=>`<button class="conversation" role="option" aria-selected="${c.id===active}" data-id="${c.id}"><img src="${c.avatar||'/assets/logo.jpeg'}" alt=""><span class="conversation-copy"><strong>${escapeHtml(c.name)}</strong><span>${escapeHtml(c.preview||'')}</span></span></button>`).join('')
      : '<div class="chat-empty"><strong>No conversations yet</strong><span>Verified member conversations will appear here.</span><a href="/member-directory/">Open member directory</a></div>';
  }
  function renderMessages(){
    const messages=$('#messages');
    if(!active){messages.innerHTML='<div class="chat-empty chat-empty-main"><strong>Start a conversation</strong><span>Select an approved agent or member from the directory.</span><a href="/member-directory/">Find a member</a></div>';return;}
    const c=contacts.find(x=>x.id===active);
    messages.innerHTML=(histories[active]||[]).map(m=>`<div class="message-row ${m.mine?'mine':''}">${m.mine?'':`<img src="${c.avatar||'/assets/logo.jpeg'}" alt="">`}<div class="message-block"><div class="message-bubble">${escapeHtml(m.text)}</div><div class="message-time">${escapeHtml(m.time)}</div></div></div>`).join('');
  }
  function activate(id){
    const c=contacts.find(x=>x.id===id);if(!c)return;
    active=id;
    $('#activeName').textContent=c.name;$('#profileName').textContent=c.name;
    $('#activeAvatar').src=c.avatar||'/assets/logo.jpeg';$('#profileAvatar').src=c.avatar||'/assets/logo.jpeg';
    $('#profileAbout').textContent=c.role||'DominionStar member';
    renderContacts($('#conversationSearch').value);renderMessages();
  }
  $('#conversationList')?.addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(b)activate(b.dataset.id)});
  $('#conversationSearch')?.addEventListener('input',e=>renderContacts(e.target.value));
  $('#composer')?.addEventListener('submit',e=>{e.preventDefault();if(!active){window.dispatchEvent(new CustomEvent('ds-toast',{detail:'Select a verified member before sending a message.'}));return;}});
  $('#attachButton')?.addEventListener('click',()=>{if(active)$('#fileInput').click();});
  $('#emojiButton')?.addEventListener('click',()=>{if(active){$('#messageInput').value+=' 🙂';$('#messageInput').focus();}});
  $('#audioCall')?.addEventListener('click',()=>{if(active)location.href='/meet/?audio=1';});
  renderContacts();renderMessages();
})();