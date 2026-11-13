/* DominionStar One — private Team Groups.
 * Preview: local in-memory sample data, no persistence or external requests.
 * Authenticated mode: explicitly gated until private groups RLS/RPC and
 * member_public_profiles are verified in isolated staging.
 * Never fall back to raw member_profiles for peer identity.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const gate=$('teamGroupsGate'),app=$('teamGroupsApp');
if(!gate||!app)return;
const el=(tag,cls,text)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text!==undefined)node.textContent=String(text);
  return node;
};
const nodes={
  mode:$('dsgModeNotice'),groups:$('dsgGroupList'),search:$('dsgSearch'),
  count:$('dsgGroupCount'),name:$('dsgActiveName'),topic:$('dsgActiveTopic'),
  icon:$('dsgActiveIcon'),messages:$('dsgMessages'),input:$('dsgMessageInput'),
  send:$('dsgSendButton'),form:$('dsgMessageForm'),status:$('dsgActionStatus'),
  members:$('dsgMemberList'),memberCount:$('dsgMembersCount'),
  activeCount:$('dsgActiveMembersCount'),memberPanel:$('dsgMembersPanel'),
  toggle:$('dsgMembersToggle'),invite:$('dsgInviteButton'),
  leave:$('dsgLeaveButton'),mute:$('dsgMuteButton'),create:$('dsgCreateButton'),
  edit:$('dsgEditButton'),editDialog:$('dsgEditDialog'),editForm:$('dsgEditForm'),
  createDialog:$('dsgCreateDialog'),createForm:$('dsgCreateForm'),
  inviteDialog:$('dsgInviteDialog'),inviteList:$('dsgInviteChoices'),inviteSearch:$('dsgInviteSearch')
};
const state={preview:false,client:null,uid:null,groups:[],selected:null,
  memberships:new Map(),messages:new Map(),contacts:[],profiles:new Map(),
  muted:new Set(),busy:false,version:0};
const status=(msg,error=false)=>{
  nodes.status.textContent=msg||'';
  nodes.status.style.color=error?'#ffc8b6':'#b7d6fa';
};
const clear=node=>node.replaceChildren();
const previewEnabled=()=>document.body.classList.contains('ds-visual-review');
const approved=(profile)=>profile?.verification_status==='approved';
const glyph=name=>name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'DS';
const relativeTime=t=>{
  const date=new Date(t);
  return Number.isFinite(date.getTime())?date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'Just now';
};
const safeLinkify=(root,text)=>{
  String(text).split(/(https?:\/\/[^\s<>"']+)/gi).forEach(part=>{
    if(!/^https?:\/\//i.test(part)){root.append(document.createTextNode(part));return;}
    const ending=(part.match(/[).,!?;:]+$/)||[])[0]||'';
    const raw=part.slice(0,part.length-ending.length);
    try{
      const url=new URL(raw);
      if(!['https:','http:'].includes(url.protocol))throw Error('Unsupported URL');
      const link=el('a',null,raw);
      link.href=url.href;link.target='_blank';link.rel='noopener noreferrer nofollow';
      root.append(link);
      if(ending)root.append(document.createTextNode(ending));
    }catch{root.append(document.createTextNode(part));}
  });
};
const selected=()=>state.groups.find(g=>g.id===state.selected);
const membership=id=>state.memberships.get(id)||[];
const mine=g=>membership(g.id).find(m=>m.user_id===state.uid);
const isAdmin=g=>['owner','admin'].includes(mine(g)?.role)&&mine(g)?.status==='active';
const isOwner=g=>mine(g)?.role==='owner'&&mine(g)?.status==='active'&&g.owner_id===state.uid;
const isActive=g=>mine(g)?.status==='active';
const displayName=id=>state.profiles.get(id)?.full_name||
  (id===state.uid?'You':'Community member');
const groupIcon=g=>glyph(g.name).slice(0,2);
const show=()=>{
  gate.classList.add('member-hidden');
  app.classList.remove('member-hidden');
};
const disabled=message=>{
  gate.replaceChildren(el('strong',null,'Private Team Groups are not yet available on the live platform.'),
    el('p',null,message));
  gate.classList.remove('member-hidden');
  app.classList.add('member-hidden');
};
const groupRow=g=>{
  const b=el('button','dsg-group-item');
  b.type='button';b.setAttribute('role','option');
  b.setAttribute('aria-selected',String(g.id===state.selected));
  const avatar=el('span','dsg-group-avatar',groupIcon(g));
  avatar.setAttribute('aria-hidden','true');
  const copy=el('span','dsg-group-text');
  copy.append(el('b',null,g.name),el('small',null,g.topic||'Team conversation'));
  b.append(avatar,copy);
  if(mine(g)?.status==='invited')b.append(el('span','dsg-group-unread','Invite'));
  b.addEventListener('click',()=>selectGroup(g.id));
  return b;
};
function renderGroups(){
  clear(nodes.groups);
  const search=(nodes.search.value||'').trim().toLowerCase();
  const items=state.groups.filter(g=>(g.name+' '+(g.topic||'')).toLowerCase().includes(search));
  nodes.count.textContent=String(state.groups.length);
  if(!items.length)nodes.groups.append(el('p','dsg-empty-item','No groups found. Create one to start.'));
  for(const g of items)nodes.groups.append(groupRow(g));
}
function renderMembers(g){
  clear(nodes.members);
  const list=membership(g.id);
  const active=list.filter(m=>m.status==='active');
  nodes.memberCount.textContent=String(active.length);
  nodes.activeCount.textContent=String(active.length);
  for(const m of list){
    const line=el('div','dsg-member-item');
    line.append(el('span','dsg-member-badge',glyph(displayName(m.user_id))));
    const name=el('div','dsg-member-name',displayName(m.user_id));
    name.append(el('small',null,
      (m.role==='owner'?'Owner':m.role==='admin'?'Admin':'Member')+
      (m.status==='invited'?' · Invitation pending':'')));
    line.append(name);
    const canModerate=isAdmin(g)&&m.user_id!==state.uid&&m.role!=='owner'&&
      (m.role!=='admin'||isOwner(g));
    if(canModerate){
      const label=m.status==='invited'?'Cancel invitation':'Remove member';
      const button=el('button','dsg-member-remove',label);
      button.type='button';
      button.setAttribute('aria-label',label+' for '+displayName(m.user_id));
      button.addEventListener('click',async()=>{
        if(state.busy)return;
        const target=displayName(m.user_id);
        const question=m.status==='invited'?'Cancel invitation for '+target+'?':
          'Remove '+target+' from this private group?';
        if(!confirm(question))return;
        state.busy=true;button.disabled=true;
        try{
          await removeMember(g,m);
          status(m.status==='invited'?'Invitation cancelled.':target+' was removed from the group.');
        }catch(err){status(err?.message||'Unable to update membership.',true);}
        finally{state.busy=false;button.disabled=false;}
      });
      line.append(button);
    }
    nodes.members.append(line);
  }
}
function renderMessages(g){
  clear(nodes.messages);
  const my=mine(g);
  if(my?.status==='invited'){
    const box=el('div','dsg-chat-empty');
    box.append(el('span',null,'✉'),el('strong',null,'You have been invited to this private group.'),
      el('p',null,'Accept to join before reading or sending messages.'));
    const accept=el('button','dsg-button dsg-primary','Accept invitation');
    accept.type='button';accept.addEventListener('click',async()=>{
      try{await acceptInvite(g);status('You joined '+g.name+'.');}
      catch(error){status(error?.message||'Unable to accept invitation.',true);}
    });
    const decline=el('button','dsg-button dsg-secondary','Decline invitation');
    decline.type='button';decline.addEventListener('click',async()=>{
      if(!confirm('Decline your invitation to '+g.name+'?'))return;
      try{await declineInvite(g);status('Invitation declined.');}
      catch(error){status(error?.message||'Unable to decline invitation.',true);}
    });
    const actions=el('div','dsg-invite-response');
    actions.append(accept,decline);
    box.append(actions);nodes.messages.append(box);return;
  }
  const messages=state.messages.get(g.id)||[];
  if(!messages.length){
    const box=el('div','dsg-chat-empty');
    box.append(el('span',null,'✦'),el('strong',null,'A private space for your team.'),
      el('p',null,'Send the first message to begin the conversation.'));
    nodes.messages.append(box);return;
  }
  for(const msg of messages){
    const mineMessage=msg.author_id===state.uid;
    const line=el('div','dsg-chat-message'+(mineMessage?' dsg-mine':''));
    const meta=el('div','dsg-message-meta');
    meta.append(el('strong',null,mineMessage?'You':displayName(msg.author_id)),
      el('time',null,relativeTime(msg.created_at)));
    const bubble=el('div','dsg-chat-bubble');
    safeLinkify(bubble,msg.body);
    line.append(meta,bubble);nodes.messages.append(line);
  }
  nodes.messages.scrollTop=nodes.messages.scrollHeight;
}
async function selectGroup(id){
  if(!state.groups.some(g=>g.id===id))return;
  state.selected=id;const g=selected();
  nodes.name.textContent=g.name;
  nodes.topic.textContent=g.topic||'Private team discussion';
  nodes.icon.textContent=groupIcon(g);
  nodes.input.disabled=!isActive(g);
  nodes.send.disabled=!isActive(g);
  nodes.invite.disabled=!isAdmin(g);
  nodes.edit.disabled=!isOwner(g);
  nodes.leave.disabled=mine(g)?.role==='owner'||!isActive(g);
  nodes.mute.disabled=!isActive(g);
  nodes.mute.textContent=state.muted.has(g.id)?'Unmute':'Mute';
  renderGroups();renderMembers(g);
  if(!state.preview&&isActive(g)){
    try{await loadMessages(g.id);}catch(e){status('Could not load this private conversation.',true);}
  }else renderMessages(g);
}
async function loadMembers(id){
  const r=await state.client.from('agent_group_members')
    .select('group_id,user_id,role,status,muted').eq('group_id',id).limit(200);
  if(r.error)throw r.error;
  state.memberships.set(id,r.data||[]);
  for(const item of r.data||[])if(item.user_id===state.uid&&item.muted)state.muted.add(id);
  await loadSafeProfiles((r.data||[]).map(m=>m.user_id));
}
async function loadSafeProfiles(ids){
  if(state.preview)return;
  const allowed=[...new Set(ids)].filter(Boolean);
  if(!allowed.length)return;
  const res=await state.client.from('member_public_profiles')
    .select('id,full_name,rank').in('id',allowed);
  if(res.error)throw res.error;
  for(const p of res.data||[])state.profiles.set(p.id,p);
}
async function loadMessages(id){
  if(state.preview)return;
  const version=++state.version;
  const result=await state.client.from('agent_group_messages')
    .select('id,group_id,author_id,body,created_at').eq('group_id',id)
    .order('created_at',{ascending:true}).limit(150);
  if(result.error)throw result.error;
  if(state.selected!==id||version!==state.version)return;
  state.messages.set(id,result.data||[]);
  renderMessages(selected());
}
async function loadGroups(){
  const groups=await state.client.from('agent_groups')
    .select('id,name,topic,owner_id,created_at').order('created_at',{ascending:false}).limit(80);
  if(groups.error)throw groups.error;
  state.groups=groups.data||[];
  const previous=state.selected;
  for(const g of state.groups)await loadMembers(g.id);
  renderGroups();
  if(state.groups.length)await selectGroup(state.groups.some(g=>g.id===previous)?previous:state.groups[0].id);
  else resetEmptyGroup();
}
function resetEmptyGroup(){
  state.selected=null;
  clear(nodes.messages);
  nodes.messages.append(el('p','dsg-empty-item','Create your first team group.'));
  clear(nodes.members);
  nodes.name.textContent='No groups yet';
  nodes.topic.textContent='Create a private group to get started.';
  nodes.icon.textContent='✦';
  nodes.count.textContent=String(state.groups.length);
  nodes.memberCount.textContent='0';
  nodes.activeCount.textContent='0';
  for(const name of ['input','send','invite','leave','mute','edit'])nodes[name].disabled=true;
}
async function acceptInvite(g){
  if(state.preview){
    mine(g).status='active';
    renderMembers(g);await selectGroup(g.id);
    return;
  }
  const r=await state.client.from('agent_group_members')
    .update({status:'active'}).eq('group_id',g.id).eq('user_id',state.uid).eq('status','invited')
    .select('group_id').single();
  if(r.error)throw r.error;
  await loadGroups();
}
async function editGroup(name,topic){
  const g=selected();
  if(!g||!isOwner(g))throw Error('Only the group owner can edit its details.');
  if(name.length<3||name.length>70||topic.length>200)
    throw Error('Use a group name of 3–70 characters and a topic of 200 or fewer.');
  if(!state.preview){
    const r=await state.client.from('agent_groups')
      .update({name,topic}).eq('id',g.id).eq('owner_id',state.uid)
      .select('id,name,topic').single();
    if(r.error)throw r.error;
    g.name=r.data.name;
    g.topic=r.data.topic;
  }else{
    g.name=name;g.topic=topic;
  }
  await selectGroup(g.id);
}
async function removeMember(g,m){
  if(!isAdmin(g)||m.role==='owner'||m.user_id===state.uid||
     (m.role==='admin'&&!isOwner(g)))
    throw Error('You do not have permission to remove this member.');
  if(state.preview){
    state.memberships.set(g.id,membership(g.id).filter(x=>x.user_id!==m.user_id));
    renderMembers(g);
    return;
  }
  const r=await state.client.from('agent_group_members')
    .delete().eq('group_id',g.id).eq('user_id',m.user_id)
    .select('user_id').single();
  if(r.error)throw r.error;
  await loadMembers(g.id);
  renderMembers(g);
}
async function declineInvite(g){
  if(mine(g)?.status!=='invited')throw Error('No pending invitation to decline.');
  if(!state.preview){
    const r=await state.client.from('agent_group_members')
      .delete().eq('group_id',g.id).eq('user_id',state.uid)
      .select('user_id').single();
    if(r.error)throw r.error;
    await loadGroups();
    return;
  }
  state.groups=state.groups.filter(x=>x.id!==g.id);
  state.selected=null;
  renderGroups();
  if(state.groups.length)await selectGroup(state.groups[0].id);
  else resetEmptyGroup();
}
async function createGroup(name,topic){
  if(state.preview){
    const id='preview-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
    const g={id,name,topic,owner_id:state.uid,created_at:new Date().toISOString()};
    state.groups.unshift(g);
    state.memberships.set(id,[{group_id:id,user_id:state.uid,role:'owner',status:'active',muted:false}]);
    state.messages.set(id,[]);
    await selectGroup(id);
    return;
  }
  const r=await state.client.rpc('create_agent_group',{p_name:name,p_topic:topic});
  if(r.error)throw r.error;
  await loadGroups();
  if(r.data)await selectGroup(r.data);
}
async function sendMessage(text){
  const g=selected();
  if(!g||!isActive(g))throw Error('Join this group before sending a message.');
  if(state.preview){
    state.messages.get(g.id).push({
      id:'local-'+Math.random().toString(36).slice(2),group_id:g.id,
      author_id:state.uid,body:text,created_at:new Date().toISOString()
    });
    renderMessages(g);return;
  }
  const r=await state.client.from('agent_group_messages')
    .insert({group_id:g.id,author_id:state.uid,body:text}).select('id').single();
  if(r.error)throw r.error;
  await loadMessages(g.id);
}
async function invitePerson(id){
  const g=selected();
  if(!g||!isAdmin(g))throw Error('Only group owners and admins can invite members.');
  if(membership(g.id).some(m=>m.user_id===id))throw Error('This person already belongs to or has an invitation to the group.');
  if(state.preview){
    state.memberships.get(g.id).push({group_id:g.id,user_id:id,role:'member',status:'invited',muted:false});
    renderMembers(g);return;
  }
  const r=await state.client.from('agent_group_members').insert({
    group_id:g.id,user_id:id,role:'member',status:'invited',invited_by:state.uid
  });
  if(r.error)throw r.error;
  await loadMembers(g.id);renderMembers(g);
}
async function leaveGroup(){
  const g=selected();
  if(!g||!isActive(g)||mine(g)?.role==='owner')throw Error('Owners must transfer or close their group before leaving.');
  if(state.preview){
    state.groups=state.groups.filter(x=>x.id!==g.id);
    state.selected=null;
    renderGroups();
    if(state.groups.length)await selectGroup(state.groups[0].id);
    else resetEmptyGroup();
    return;
  }
  const r=await state.client.from('agent_group_members')
    .delete().eq('group_id',g.id).eq('user_id',state.uid);
  if(r.error)throw r.error;
  state.selected=null;await loadGroups();
}
async function toggleMute(){
  const g=selected();
  if(!g||!isActive(g))return;
  const next=!state.muted.has(g.id);
  if(!state.preview){
    const r=await state.client.from('agent_group_members')
      .update({muted:next}).eq('group_id',g.id).eq('user_id',state.uid).select('group_id').single();
    if(r.error)throw r.error;
  }
  if(next)state.muted.add(g.id);else state.muted.delete(g.id);
  nodes.mute.textContent=next?'Unmute':'Mute';
}
const openDialog=dialog=>{
  if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
};
const closeDialog=dialog=>{
  if(dialog.close)dialog.close();else dialog.removeAttribute('open');
};
function inviteCandidates(){
  const filter=(nodes.inviteSearch.value||'').trim().toLowerCase();
  clear(nodes.inviteList);
  const g=selected();
  const possible=state.contacts.filter(p=>
    p.id!==state.uid&&p.full_name.toLowerCase().includes(filter))
    .filter(p=>!g||!membership(g.id).some(m=>m.user_id===p.id));
  if(!possible.length)nodes.inviteList.append(el('p','dsg-empty-item','No eligible, directory-visible agents found.'));
  for(const person of possible.slice(0,40)){
    const b=el('button','dsg-invite-choice');b.type='button';
    const name=el('span');name.append(el('strong',null,person.full_name),
      el('small',null,person.rank||'Approved agent'));
    b.append(name,el('span',null,'＋ Invite'));
    b.addEventListener('click',async()=>{
      b.disabled=true;
      try{await invitePerson(person.id);status('Invitation created for '+person.full_name+'.');
        closeDialog(nodes.inviteDialog);await selectGroup(state.selected);}
      catch(err){b.disabled=false;status(err?.message||'Invitation failed.',true);}
    });
    nodes.inviteList.append(b);
  }
}
async function prepareInvites(){
  const g=selected();
  if(!g||!isAdmin(g))return;
  if(!state.preview){
    // Peer identity is read ONLY from the approved safe projection and only
    // after the public-member-profile cutover is enabled.
    const r=await state.client.from('member_public_profiles')
      .select('id,full_name,rank').eq('verification_status','approved')
      .order('full_name').limit(60);
    if(r.error)throw r.error;
    state.contacts=(r.data||[]).filter(p=>p.full_name);
    for(const p of state.contacts)state.profiles.set(p.id,p);
  }
  nodes.inviteSearch.value='';inviteCandidates();openDialog(nodes.inviteDialog);
}
function bindEvents(){
  nodes.create.addEventListener('click',()=>openDialog(nodes.createDialog));
  nodes.edit.addEventListener('click',()=>{
    const g=selected();
    if(!g||!isOwner(g))return;
    $('dsgEditName').value=g.name;
    $('dsgEditTopic').value=g.topic||'';
    openDialog(nodes.editDialog);
  });
  nodes.editForm.addEventListener('submit',async event=>{
    event.preventDefault();
    if(state.busy)return;
    const name=$('dsgEditName').value.trim();
    const topic=$('dsgEditTopic').value.trim();
    state.busy=true;
    try{
      await editGroup(name,topic);
      closeDialog(nodes.editDialog);
      status(state.preview?'Sample group details updated in this browser only.':'Group details updated.');
    }catch(err){status(err?.message||'Unable to update group details.',true);}
    finally{state.busy=false;}
  });
  document.querySelectorAll('[data-close-dialog]').forEach(b=>
    b.addEventListener('click',()=>closeDialog(b.closest('dialog'))));
  nodes.createForm.addEventListener('submit',async event=>{
    event.preventDefault();
    if(state.busy)return;
    const name=$('dsgNewName').value.trim();
    const topic=$('dsgNewTopic').value.trim();
    if(name.length<3||name.length>70||topic.length>200){status('Group name must be 3–70 characters.',true);return;}
    state.busy=true;
    try{await createGroup(name,topic);closeDialog(nodes.createDialog);nodes.createForm.reset();
      status(state.preview?'Sample group created in this browser only.':'Private group created. Invite approved agents to join.');}
    catch(err){status(err?.message||'Group could not be created.',true);}
    finally{state.busy=false;}
  });
  nodes.form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(state.busy)return;
    const text=nodes.input.value.trim();
    if(!text||text.length>2000)return;
    state.busy=true;nodes.send.disabled=true;
    try{await sendMessage(text);nodes.input.value='';
      status(state.preview?'Sample message shown locally. No real member was notified.':'Message sent.');}
    catch(err){status(err?.message||'Message could not be sent.',true);}
    finally{nodes.send.disabled=!selected()||!isActive(selected());state.busy=false;}
  });
  nodes.search.addEventListener('input',renderGroups);
  nodes.invite.addEventListener('click',()=>prepareInvites().catch(err=>status(err?.message||'Unable to find eligible members.',true)));
  nodes.inviteSearch.addEventListener('input',inviteCandidates);
  nodes.leave.addEventListener('click',async()=>{
    if(!confirm('Leave this private group? You will no longer be able to read its messages.'))return;
    try{await leaveGroup();status('You left the group.');}catch(err){status(err.message,true);}
  });
  nodes.mute.addEventListener('click',()=>toggleMute().catch(err=>status(err.message,true)));
  nodes.toggle.addEventListener('click',()=>{
    const now=nodes.memberPanel.hidden;
    nodes.memberPanel.hidden=!now;
    nodes.toggle.setAttribute('aria-expanded',String(now));
  });
}
function localDemo(){
  state.preview=true;state.uid='review-founder';
  state.profiles.set(state.uid,{full_name:'Demo Founder',rank:'Senior Marketing Director'});
  const contacts=[
    {id:'demo-a',full_name:'Jordan Taylor',rank:'Marketing Director'},
    {id:'demo-b',full_name:'Alex Morgan',rank:'Senior Associate'},
    {id:'demo-c',full_name:'Casey Brooks',rank:'Associate'},
    {id:'demo-d',full_name:'Riley Parker',rank:'Training Associate'}
  ];
  state.contacts=contacts;
  contacts.forEach(p=>state.profiles.set(p.id,p));
  const groups=[
    {id:'demo-leadership',name:'DominionStar Leadership',topic:'Team vision, events & weekly priorities',owner_id:state.uid,created_at:'2026-11-10T00:00:00Z'},
    {id:'demo-training',name:'New Agent Training',topic:'Licensing, development & coaching',owner_id:'demo-a',created_at:'2026-11-09T00:00:00Z'}
  ];
  state.groups=groups;
  state.memberships.set('demo-leadership',[
    {user_id:state.uid,role:'owner',status:'active'},
    {user_id:'demo-a',role:'admin',status:'active'},
    {user_id:'demo-b',role:'member',status:'active'},
    {user_id:'demo-c',role:'member',status:'active'}
  ]);
  state.memberships.set('demo-training',[
    {user_id:state.uid,role:'member',status:'active'},
    {user_id:'demo-a',role:'owner',status:'active'},
    {user_id:'demo-d',role:'member',status:'active'}
  ]);
  state.messages.set('demo-leadership',[
    {author_id:'demo-a',body:'Good morning, team! Our focus this week is training consistency and helping new agents move forward.',created_at:'2026-11-13T13:15:00Z'},
    {author_id:'demo-b',body:'Sharing our weekly Saving Your Future session: https://zoom.us/j/7443001370\nWednesday · 9 PM ET / 8 PM CT / 6 PM PT',created_at:'2026-11-13T13:17:00Z'},
    {author_id:state.uid,body:'Please bring your licensing questions to the next session. We will also recognize recent exam milestones.',created_at:'2026-11-13T13:19:00Z'},
    {author_id:'demo-c',body:'Thanks for the update! I will share the details with my team.',created_at:'2026-11-13T13:21:00Z'}
  ]);
  state.messages.set('demo-training',[
    {author_id:'demo-a',body:'Welcome to the New Agent Training group. Here we can share study progress and next steps.',created_at:'2026-11-13T10:30:00Z'},
    {author_id:'demo-d',body:'I am reviewing the state exam prep this week. Looking forward to our coaching call.',created_at:'2026-11-13T11:00:00Z'}
  ]);
  nodes.mode.textContent='INTERACTIVE VISUAL PREVIEW · These groups, invitations, and messages exist only in this browser session. Nothing is sent or saved.';
  show();bindEvents();renderGroups();selectGroup('demo-leadership');
}
async function authenticated(){
  if(!window.DSAuth?.ready){disabled('Authentication is unavailable. No group data has been loaded.');return;}
  let client;
  try{client=await window.DSAuth.init();}catch{disabled('We could not verify your secure session.');return;}
  const session=(await client.auth.getSession()).data?.session;
  if(!session?.user?.id){location.href='/member-login/';return;}
  const res=await client.from('member_profiles').select('id,full_name,rank,verification_status')
    .eq('id',session.user.id).maybeSingle();
  if(res.error||!approved(res.data)){
    disabled('Only Founder-approved agents may access team groups.');return;
  }
  // Critical: never send group queries to a database that has not completed
  // the reviewed RLS migration and safe public-directory cutover.
  const flags=window.DOMINIONSTAR_AGENT_DATA_FEATURES||{};
  if(flags.teamGroupsV1!==true||flags.publicMemberProfilesV2!==true){
    disabled('Secure group messaging is being prepared. It will become available after the isolated database and permissions release.');return;
  }
  state.client=client;state.uid=session.user.id;
  state.profiles.set(state.uid,{full_name:res.data.full_name||'You',rank:res.data.rank});
  nodes.mode.textContent='Private · Approved members only · Invitations require acceptance';
  show();bindEvents();
  try{await loadGroups();}catch(err){
    nodes.mode.textContent='Groups unavailable. Please try again after the secure service is restored.';
    status('Could not load private groups.',true);
  }
}
const start=()=>{if(previewEnabled())localDemo();else authenticated().catch(()=>
  disabled('Secure group verification could not be completed.'));};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();
