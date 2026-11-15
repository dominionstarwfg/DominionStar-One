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
  inviteDialog:$('dsgInviteDialog'),inviteList:$('dsgInviteChoices'),inviteSearch:$('dsgInviteSearch'),
  unreadTotal:$('dsgUnreadTotal'),refresh:$('dsgRefreshButton'),sound:$('dsgSoundToggle'),
  incoming:$('dsgIncomingNotice'),simulate:$('dsgSimulateButton'),hint:$('dsgUpdateHint'),
  chatTab:$('dsgChatTab'),postsTab:$('dsgPostsTab'),postsPanel:$('dsgPostsPanel'),
  postForm:$('dsgPostForm'),postKind:$('dsgPostKind'),postBody:$('dsgPostBody'),
  postCount:$('dsgPostCount'),postSubmit:$('dsgPostSubmit'),postList:$('dsgPostList'),
  postAttachButton:$('dsgPostAttachButton'),postFile:$('dsgPostFile'),
  attachmentPreview:$('dsgAttachmentPreview'),attachmentContent:$('dsgAttachmentContent'),
  attachmentInfo:$('dsgAttachmentInfo'),attachmentNotice:$('dsgAttachmentNotice'),
  removeAttachment:$('dsgRemoveAttachment'),chatShareRow:$('dsgChatShareRow'),
  chatShareFlyer:$('dsgChatShareFlyer')
};
const state={preview:false,client:null,uid:null,groups:[],selected:null,
  memberships:new Map(),messages:new Map(),posts:new Map(),postReactions:new Map(),
  postComments:new Map(),expandedPostComments:new Set(),openCommentForms:new Set(),
  commentDrafts:new Map(),attachment:null,previewMediaUrls:new Set(),
  activeView:'chat',contacts:[],profiles:new Map(),
  muted:new Set(),unread:new Map(),lastRead:new Map(),
  soundEnabled:false,hasUnreadSnapshot:false,polling:false,pollTimer:null,
  busy:false,version:0};
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
  if(mine(g)?.status==='invited'){
    b.append(el('span','dsg-group-unread','Invite'));
  }else if(isActive(g)){
    const unread=Number(state.unread.get(g.id)||0);
    if(unread>0){
      const badge=el('span','dsg-group-unread',unread>99?'99+':String(unread));
      badge.setAttribute('aria-label',unread+' unread messages');
      b.append(badge);
    }
  }
  b.addEventListener('click',()=>selectGroup(g.id));
  return b;
};
function renderGroups(){
  clear(nodes.groups);
  const search=(nodes.search.value||'').trim().toLowerCase();
  const items=state.groups.filter(g=>(g.name+' '+(g.topic||'')).toLowerCase().includes(search));
  nodes.count.textContent=String(state.groups.length);
  const total=state.groups.reduce((sum,g)=>sum+
    (isActive(g)?Math.max(0,Number(state.unread.get(g.id)||0)):0),0);
  nodes.unreadTotal.hidden=total===0;
  nodes.unreadTotal.textContent=total>99?'99+':String(total);
  nodes.unreadTotal.setAttribute('aria-label',total+' unread group messages');
  if(!items.length)nodes.groups.append(el('p','dsg-empty-item','No groups found. Create one to start.'));
  for(const g of items)nodes.groups.append(groupRow(g));
}
function renderMembers(g){
  clear(nodes.members);
  const own=mine(g);
  // An invited agent may know their invitation but not enumerate the group's
  // active membership until they have explicitly accepted it.
  const list=own?.status==='invited'?membership(g.id).filter(m=>m.user_id===state.uid):membership(g.id);
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
    if(isOwner(g)&&m.user_id!==state.uid&&m.status==='active'
        &&(m.role==='member'||m.role==='admin')){
      const nextAdmin=m.role!=='admin';
      const label=nextAdmin?'Make admin':'Remove admin';
      const adminButton=el('button','dsg-member-admin',label);
      adminButton.type='button';
      adminButton.setAttribute('aria-label',label+' for '+displayName(m.user_id));
      adminButton.addEventListener('click',async()=>{
        if(state.busy)return;
        if(!confirm(label+' for '+displayName(m.user_id)+'?'))return;
        state.busy=true;adminButton.disabled=true;
        try{
          await setMemberAdmin(g,m,nextAdmin);
          status(displayName(m.user_id)+(nextAdmin?' can now manage members.':' no longer has admin privileges.'));
        }catch(err){status(err?.message||'Unable to update admin rights.',true);}
        finally{state.busy=false;adminButton.disabled=false;}
      });
      line.append(adminButton);
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

function switchGroupView(view){
  state.activeView=view==='posts'?'posts':'chat';
  const posts=state.activeView==='posts';
  nodes.chatTab.setAttribute('aria-selected',String(!posts));
  nodes.postsTab.setAttribute('aria-selected',String(posts));
  nodes.chatTab.tabIndex=posts?-1:0;
  nodes.postsTab.tabIndex=posts?0:-1;
  nodes.messages.hidden=posts;
  nodes.form.hidden=posts;
  nodes.chatShareRow.hidden=posts;
  nodes.postsPanel.hidden=!posts;
  if(posts){const g=selected();if(g)renderPosts(g);}
}

const MAX_GROUP_POST_MEDIA=15*1024*1024;
const allowedGroupMediaTypes=new Set(['image/png','image/jpeg','image/webp','application/pdf']);
const mediaType=(file)=>{
  const t=String(file?.type||'').toLowerCase();
  if(!allowedGroupMediaTypes.has(t))return null;
  const ext=String(file?.name||'').toLowerCase().split('.').pop();
  const extension={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',
    webp:'image/webp',pdf:'application/pdf'}[ext];
  return extension===t?t:null;
};
const mediaBytes=size=>size>=1024*1024?(size/1024/1024).toFixed(1)+' MB':
  Math.max(1,Math.ceil(size/1024))+' KB';
function setMediaNotice(message,error=false){
  nodes.attachmentNotice.textContent=message;
  nodes.attachmentNotice.dataset.error=String(error);
}
function resetAttachment({keepUrl=false}={}){
  if(state.attachment?.url&&!keepUrl){
    URL.revokeObjectURL(state.attachment.url);
    state.previewMediaUrls.delete(state.attachment.url);
  }
  state.attachment=null;
  nodes.postFile.value='';
  nodes.attachmentPreview.hidden=true;
  nodes.attachmentInfo.textContent='';
  clear(nodes.attachmentContent);
  setMediaNotice(state.preview?
    'Local preview only. Your selected file is not uploaded or saved.':
    'Media publishing requires secure storage integration. Text posts remain available.');
}
function renderAttachment(){
  clear(nodes.attachmentContent);
  const media=state.attachment;
  nodes.attachmentPreview.hidden=!media;
  if(!media)return;
  if(media.mime.startsWith('image/')){
    const img=el('img','dsg-flyer-preview');
    img.alt='Full flyer or photo preview: '+media.name;
    img.src=media.url;
    img.loading='eager';
    img.decoding='async';
    nodes.attachmentContent.append(img);
  }else{
    const pdf=el('div','dsg-pdf-file');
    pdf.append(el('span','dsg-pdf-icon','PDF'));
    const details=el('span','dsg-pdf-details');
    details.append(el('strong',null,media.name),
      el('small',null,'Document attached · PDF contents are not embedded'));
    pdf.append(details);
    nodes.attachmentContent.append(pdf);
  }
  nodes.attachmentInfo.textContent=media.name+' · '+mediaBytes(media.size);
  setMediaNotice(state.preview?
    'Local preview only — this attachment stays in your current browser session.':
    'Selected locally. Secure media storage is not enabled; do not publish this file yet.');
}
function pickAttachment(file){
  if(!file)return;
  const type=mediaType(file);
  if(!type){
    nodes.postFile.value='';
    setMediaNotice('Choose a JPG, PNG, WebP or PDF file. Other formats are not supported.',true);
    status('Unsupported file format. Choose a flyer image or PDF.',true);
    return;
  }
  if(file.size<=0||file.size>MAX_GROUP_POST_MEDIA){
    nodes.postFile.value='';
    setMediaNotice('File size must be greater than 0 and no more than 15 MB.',true);
    status('This file is too large or empty. Maximum: 15 MB.',true);
    return;
  }
  resetAttachment();
  const url=URL.createObjectURL(file);
  state.attachment={name:file.name.slice(0,140),size:file.size,mime:type,url};
  state.previewMediaUrls.add(url);
  renderAttachment();
}
function renderPostedMedia(media){
  if(!state.preview||!media?.url||!state.previewMediaUrls.has(media.url))return null;
  const wrapper=el('div','dsg-post-media');
  if(media.mime.startsWith('image/')){
    const img=el('img','dsg-post-media-image');
    img.alt=media.name||'Attached group flyer';
    img.src=media.url;
    img.loading='lazy';
    wrapper.append(img);
  }else if(media.mime==='application/pdf'){
    const pdf=el('div','dsg-pdf-file');
    pdf.append(el('span','dsg-pdf-icon','PDF'));
    const copy=el('span','dsg-pdf-details');
    copy.append(el('strong',null,media.name),
      el('small',null,mediaBytes(media.size)+' · Sample file (not uploaded)'));
    pdf.append(copy);
    wrapper.append(pdf);
  }
  return wrapper;
}
const groupPostTitle=kind=>kind==='milestone'?'🎉 Milestone & Recognition':
  kind==='announcement'?'📣 Team Announcement':'Team Update';
function renderPosts(g){
  clear(nodes.postList);
  const active=isActive(g);
  nodes.postBody.disabled=!active;
  nodes.postSubmit.disabled=!active;
  nodes.postKind.disabled=!active;
  nodes.postAttachButton.disabled=!active;
  nodes.postFile.disabled=!active;
  nodes.chatShareFlyer.disabled=!active;
  if(!active){
    nodes.postList.append(el('p','dsg-post-empty',
      'Accept the private group invitation to view posts and celebrate milestones.'));
    return;
  }
  const posts=state.posts.get(g.id)||[];
  if(!posts.length){
    nodes.postList.append(el('p','dsg-post-empty',
      'No team posts yet. Share a milestone, training update or an announcement.'));
    return;
  }
  for(const post of posts){
    const card=el('article','dsg-post-card dsg-kind-'+post.kind);
    const label=el('span','dsg-post-label',groupPostTitle(post.kind));
    const head=el('div','dsg-post-byline');
    head.append(el('span','dsg-member-badge',glyph(displayName(post.author_id))));
    const by=el('span');
    by.append(el('strong',null,post.author_id===state.uid?'You':displayName(post.author_id)),
      el('small',null,relativeTime(post.created_at)));
    head.append(by);
    const copy=el('p','dsg-post-copy');
    safeLinkify(copy,post.body);
    const imageOrFile=renderPostedMedia(post.attachment);
    if(imageOrFile)card.append(label,head,copy,imageOrFile);
    const reactions=state.postReactions.get(post.id)||[];
    const footer=el('div','dsg-post-reactions');
    const counts=el('span','dsg-post-reaction-counts',
      (reactions.filter(r=>r.reaction==='like').length)+' likes · '+
      (reactions.filter(r=>r.reaction==='celebrate').length)+' celebrations');
    footer.append(counts);
    const own=reactions.find(r=>r.user_id===state.uid)?.reaction;
    for(const [type,text] of [['like','👍 Like'],['celebrate','🎉 Celebrate']]){
      const button=el('button','dsg-post-react',text);
      button.type='button';
      button.setAttribute('aria-pressed',String(own===type));
      button.addEventListener('click',async()=>{
        if(state.busy)return;
        state.busy=true;button.disabled=true;
        try{await reactToPost(post,type);}
        catch(err){status(err?.message||'Unable to update reaction.',true);}
        finally{state.busy=false;}
      });
      footer.append(button);
    }
    if(!imageOrFile)card.append(label,head,copy);
    card.append(footer);
    const section=el('section','dsg-post-comments');
    section.setAttribute('aria-label','Replies to '+groupPostTitle(post.kind));
    const comments=state.postComments.get(post.id)||[];
    const count=el('span','dsg-post-comment-count',
      comments.length+' '+(comments.length===1?'reply':'replies'));
    const action=el('button','dsg-post-comment-toggle','💬 Comment');
    action.type='button';
    action.setAttribute('aria-expanded',String(state.openCommentForms.has(post.id)));
    action.addEventListener('click',()=>{
      if(state.openCommentForms.has(post.id))state.openCommentForms.delete(post.id);
      else state.openCommentForms.add(post.id);
      renderPosts(g);
      if(state.openCommentForms.has(post.id))
        nodes.postList.querySelector('[data-post-reply-id="'+post.id+'"] textarea')?.focus();
    });
    const heading=el('div','dsg-post-comment-head');
    heading.append(count,action);
    section.append(heading);
    if(comments.length){
      const visible=state.expandedPostComments.has(post.id)?comments:comments.slice(-2);
      const thread=el('div','dsg-post-comment-thread');
      for(const comment of visible){
        const row=el('div','dsg-post-comment-row');
        row.append(el('span','dsg-member-badge',glyph(displayName(comment.author_id))));
        const bubble=el('div','dsg-post-comment-bubble');
        const meta=el('div','dsg-post-comment-meta');
        meta.append(el('strong',null,comment.author_id===state.uid?
          'You':displayName(comment.author_id)),
          el('small',null,relativeTime(comment.created_at)));
        const text=el('p','dsg-post-comment-text');
        safeLinkify(text,comment.body);
        bubble.append(meta,text);
        row.append(bubble);
        thread.append(row);
      }
      section.append(thread);
      if(comments.length>2){
        const more=state.expandedPostComments.has(post.id);
        const toggle=el('button','dsg-post-comment-more',
          more?'Show fewer replies':'View more replies');
        toggle.type='button';
        toggle.setAttribute('aria-expanded',String(more));
        toggle.addEventListener('click',()=>{
          if(more)state.expandedPostComments.delete(post.id);
          else state.expandedPostComments.add(post.id);
          renderPosts(g);
        });
        section.append(toggle);
      }
    }else section.append(el('p','dsg-post-no-replies',
      'No replies yet. Congratulate your teammate or share your thoughts.'));
    const reply=el('form','dsg-post-reply-form');
    reply.dataset.postReplyId=post.id;
    reply.hidden=!state.openCommentForms.has(post.id);
    const replyLabel=el('label','dsg-screenreader','Write a reply');
    const input=el('textarea','dsg-post-reply-input');
    input.maxLength=1200;
    input.required=true;
    input.rows=2;
    input.placeholder='Write a reply to this team post…';
    input.value=state.commentDrafts.get(post.id)||'';
    const inputId='dsg-reply-'+post.id;
    input.id=inputId;
    replyLabel.htmlFor=inputId;
    input.addEventListener('input',()=>state.commentDrafts.set(post.id,input.value));
    const submit=el('button','dsg-button dsg-primary','Post reply');
    submit.type='submit';
    reply.addEventListener('submit',async event=>{
      event.preventDefault();
      if(state.busy)return;
      const text=input.value.trim();
      if(!text||text.length>1200)return;
      state.busy=true;submit.disabled=true;
      try{
        await sendPostComment(post,text);
        state.commentDrafts.delete(post.id);
        state.openCommentForms.add(post.id);
        renderPosts(g);
        status(state.preview?'Sample reply added in this browser only.':'Reply posted privately.');
      }catch(err){status(err?.message||'Could not post this reply.',true);}
      finally{state.busy=false;submit.disabled=false;}
    });
    reply.append(replyLabel,input,submit);
    section.append(reply);
    card.append(section);
    nodes.postList.append(card);
  }
}
async function loadPosts(id){
  if(state.preview)return;
  const g=state.groups.find(item=>item.id===id);
  if(!g||!isActive(g))return;
  const result=await state.client.from('agent_group_posts')
    .select('id,group_id,author_id,kind,body,created_at')
    .eq('group_id',id).order('created_at',{ascending:false}).limit(80);
  if(result.error)throw result.error;
  const posts=result.data||[];
  const map=new Map();
  if(posts.length){
    const reactionResult=await state.client.from('agent_group_post_reactions')
      .select('post_id,user_id,reaction').in('post_id',posts.map(p=>p.id)).limit(1000);
    if(reactionResult.error)throw reactionResult.error;
    for(const reaction of reactionResult.data||[]){
      if(!map.has(reaction.post_id))map.set(reaction.post_id,[]);
      map.get(reaction.post_id).push(reaction);
    }
  }
  const commentMap=new Map();
  if(posts.length){
    // Fetch only the newest 1,000 replies across this page of group posts.
    // No public thread data: RLS checks membership on each parent post.
    const commentResult=await state.client.from('agent_group_post_comments')
      .select('id,post_id,author_id,body,created_at')
      .in('post_id',posts.map(p=>p.id))
      .order('created_at',{ascending:false}).limit(1000);
    if(commentResult.error)throw commentResult.error;
    for(const reply of commentResult.data||[]){
      if(!commentMap.has(reply.post_id))commentMap.set(reply.post_id,[]);
      commentMap.get(reply.post_id).push(reply);
    }
    for(const thread of commentMap.values())
      thread.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  }
  state.posts.set(id,posts);
  for(const p of posts){
    state.postReactions.set(p.id,map.get(p.id)||[]);
    state.postComments.set(p.id,commentMap.get(p.id)||[]);
  }
  if(state.selected===id&&state.activeView==='posts')renderPosts(g);
}
async function publishGroupPost(kind,body){
  const g=selected();
  if(!g||!isActive(g))throw Error('Only joined group members can publish.');
  const attachment=state.attachment;
  if(!['update','milestone','announcement'].includes(kind)||
    (!body.trim()&&!attachment)||body.trim().length>3000)throw Error('Invalid post.');
  // Never silently discard an uploaded-looking file in authenticated mode.
  // The real private storage bucket, RLS and post-media schema are NOT ready.
  if(attachment&&!state.preview)
    throw Error('Flyer uploads are not yet enabled for real groups. Remove the file to publish a text post.');
  if(state.preview){
    const id='sample-post-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    const post={id,group_id:g.id,author_id:state.uid,kind,body,attachment:attachment?
      {name:attachment.name,mime:attachment.mime,size:attachment.size,url:attachment.url}:null,
      created_at:new Date().toISOString()};
    state.posts.set(g.id,[post,...(state.posts.get(g.id)||[])]);
    state.postReactions.set(id,[]);
    state.postComments.set(id,[]);
    resetAttachment({keepUrl:Boolean(attachment)});
    renderPosts(g);
    return;
  }
  const result=await state.client.from('agent_group_posts')
    .insert({group_id:g.id,author_id:state.uid,kind,body})
    .select('id').single();
  if(result.error)throw result.error;
  await loadPosts(g.id);
}
async function sendPostComment(post,body){
  const g=selected();
  if(!g||!isActive(g)||post.group_id!==g.id)
    throw Error('Join this private group to reply to posts.');
  if(!body.trim()||body.trim().length>1200)throw Error('Invalid reply.');
  if(state.preview){
    const list=state.postComments.get(post.id)||[];
    list.push({id:'local-comment-'+Math.random().toString(36).slice(2),
      post_id:post.id,author_id:state.uid,body,
      created_at:new Date().toISOString()});
    state.postComments.set(post.id,list);
    state.expandedPostComments.add(post.id);
    renderPosts(g);
    return;
  }
  const result=await state.client.from('agent_group_post_comments')
    .insert({post_id:post.id,author_id:state.uid,body})
    .select('id').single();
  if(result.error)throw result.error;
  state.expandedPostComments.add(post.id);
  await loadPosts(g.id);
}
async function reactToPost(post,reaction){
  const g=selected();
  if(!g||!isActive(g)||post.group_id!==g.id)throw Error('Join this group to react.');
  const list=state.postReactions.get(post.id)||[];
  const own=list.find(r=>r.user_id===state.uid);
  if(!state.preview){
    let result;
    if(own?.reaction===reaction){
      result=await state.client.from('agent_group_post_reactions')
        .delete().eq('post_id',post.id).eq('user_id',state.uid);
    }else if(own){
      result=await state.client.from('agent_group_post_reactions')
        .update({reaction}).eq('post_id',post.id).eq('user_id',state.uid);
    }else{
      result=await state.client.from('agent_group_post_reactions')
        .insert({post_id:post.id,user_id:state.uid,reaction});
    }
    if(result.error)throw result.error;
    await loadPosts(g.id);
    return;
  }
  state.postReactions.set(post.id,
    [...list.filter(r=>r.user_id!==state.uid),...(own?.reaction===reaction?[]:
      [{post_id:post.id,user_id:state.uid,reaction}])]);
  renderPosts(g);
}
async function setMemberAdmin(g,m,makeAdmin){
  if(!isOwner(g)||m.user_id===state.uid||m.status!=='active'||
      !['admin','member'].includes(m.role))
    throw Error('Only the group owner can appoint or remove administrators.');
  if(state.preview){
    m.role=makeAdmin?'admin':'member';
    renderMembers(g);
    return;
  }
  const result=await state.client.rpc('set_agent_group_admin',{
    p_group:g.id,p_member:m.user_id,p_make_admin:makeAdmin});
  if(result.error)throw result.error;
  await loadMembers(g.id);
  renderMembers(g);
}
async function selectGroup(id){
  if(!state.groups.some(g=>g.id===id))return;
  if(state.selected!==id&&state.attachment)resetAttachment();
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
  nodes.postBody.disabled=!isActive(g);
  nodes.postSubmit.disabled=!isActive(g);
  nodes.postKind.disabled=!isActive(g);
  nodes.postAttachButton.disabled=!isActive(g);
  nodes.postFile.disabled=!isActive(g);
  nodes.chatShareFlyer.disabled=!isActive(g);
  renderPosts(g);
  if(!state.preview&&isActive(g)){
    try{
      await loadMessages(g.id);
      await loadPosts(g.id);
    }catch(e){status('Could not load this private group.',true);}
  }else{
    renderMessages(g);
    if(state.preview&&isActive(g)&&document.visibilityState!=='hidden'){
      state.unread.set(g.id,0);
      renderGroups();
    }
  }
}
async function loadMembers(id){
  const r=await state.client.from('agent_group_members')
    .select('group_id,user_id,role,status,muted,last_read_at').eq('group_id',id).limit(200);
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
  if(document.visibilityState!=='hidden'&&result.data?.length){
    const latest=result.data[result.data.length-1]?.created_at;
    if(latest){
      // This is the latest message ACTUALLY displayed, not a blanket
      // mark-read-to-now that could hide messages arriving during the fetch.
      const own=mine(selected());
      const current=Date.parse(own?.last_read_at||'1970-01-01T00:00:00Z');
      if(Date.parse(latest)>current){
        const read=await state.client.from('agent_group_members')
          .update({last_read_at:latest}).eq('group_id',id).eq('user_id',state.uid)
          .eq('status','active').select('group_id,last_read_at').maybeSingle();
        if(!read.error&&read.data){
          own.last_read_at=read.data.last_read_at;
          state.unread.set(id,0);
          renderGroups();
        }
      }else{
        state.unread.set(id,0);
        renderGroups();
      }
    }
  }
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
  clear(nodes.postList);
  nodes.postList.append(el('p','dsg-post-empty','Create a group to share team milestones.'));
  clear(nodes.members);
  nodes.name.textContent='No groups yet';
  nodes.topic.textContent='Create a private group to get started.';
  nodes.icon.textContent='✦';
  nodes.count.textContent=String(state.groups.length);
  nodes.memberCount.textContent='0';
  nodes.activeCount.textContent='0';
  if(state.attachment)resetAttachment();
  for(const name of ['input','send','invite','leave','mute','edit',
    'postBody','postSubmit','postKind','postAttachButton',
    'postFile','chatShareFlyer'])nodes[name].disabled=true;
}
const soundPulse=()=>{
  if(!state.soundEnabled)return;
  try{
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)return;
    const ctx=new Audio();
    const oscillator=ctx.createOscillator();
    const gain=ctx.createGain();
    oscillator.type='sine';oscillator.frequency.value=740;
    gain.gain.setValueAtTime(0.018,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.15);
    oscillator.connect(gain);gain.connect(ctx.destination);
    oscillator.start();oscillator.stop(ctx.currentTime+0.16);
    oscillator.onended=()=>ctx.close().catch(()=>{});
  }catch{/* browser audio permissions are optional; never block messages */}
};
const incomingNotice=(group,count)=>{
  if(state.muted.has(group.id))return;
  nodes.incoming.hidden=false;
  nodes.incoming.textContent=count+' new '+(count===1?'message':'messages')+
    ' in '+group.name+'. Select that group to read.';
  soundPulse();
};
async function refreshUnread({notify=true}={}){
  if(state.preview){renderGroups();return;}
  if(!state.client||document.visibilityState==='hidden')return;
  const result=await state.client.rpc('list_agent_group_unread');
  if(result.error)throw result.error;
  const before=new Map(state.unread);
  const next=new Map();
  for(const record of result.data||[]){
    if(!state.groups.some(g=>g.id===record.group_id&&isActive(g)))continue;
    const count=Math.max(0,Number(record.unread_count||0));
    next.set(record.group_id,count);
    if(record.muted)state.muted.add(record.group_id);
    else state.muted.delete(record.group_id);
  }
  state.unread=next;
  renderGroups();
  if(notify&&state.hasUnreadSnapshot){
    const changed=state.groups.filter(g=>isActive(g)&&g.id!==state.selected)
      .map(g=>({group:g,delta:(next.get(g.id)||0)-(before.get(g.id)||0)}))
      .filter(x=>x.delta>0&&!state.muted.has(x.group.id));
    if(changed.length){
      const item=changed[0];
      incomingNotice(item.group,item.delta);
    }
  }
  state.hasUnreadSnapshot=true;
}
async function refreshUpdates({manual=false}={}){
  if(state.preview){
    renderGroups();
    status('Sample messages are local to this browser. Use Simulate message to try unread alerts.');
    return;
  }
  if(state.polling||!state.client||document.visibilityState==='hidden')return;
  state.polling=true;
  try{
    if(manual)await loadGroups();
    else{
      await refreshUnread();
      const g=selected();
      if(g&&isActive(g)){
        await loadMessages(g.id);
        if(state.activeView==='posts')await loadPosts(g.id);
      }
    }
    if(manual)await refreshUnread({notify:false});
    if(manual)status('Your private groups are up to date.');
  }catch(e){
    if(manual)status('Could not refresh private groups. Please try again.',true);
  }finally{state.polling=false;}
}
function startRefresh(){
  if(state.preview||state.pollTimer)return;
  // Bounded foreground polling only. No Realtime subscription, emails or push.
  state.pollTimer=window.setInterval(()=>refreshUpdates(),20000);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')refreshUpdates();
  });
  window.addEventListener('pagehide',()=>{
    window.clearInterval(state.pollTimer);state.pollTimer=null;
  },{once:true});
}
function simulateIncoming(){
  if(!state.preview)return;
  const destination=state.groups.find(g=>g.id!==state.selected&&isActive(g));
  if(!destination)return;
  const author=membership(destination.id).find(m=>m.user_id!==state.uid&&m.status==='active');
  const thread=state.messages.get(destination.id)||[];
  thread.push({
    id:'sample-alert-'+Date.now(),group_id:destination.id,
    author_id:author?.user_id||'demo-a',
    body:'New team update: Wednesday coaching starts at 8 PM CT. Please bring your questions.',
    created_at:new Date().toISOString()
  });
  state.messages.set(destination.id,thread);
  const count=(state.unread.get(destination.id)||0)+1;
  state.unread.set(destination.id,count);
  renderGroups();
  if(!state.muted.has(destination.id))incomingNotice(destination,1);
  else status('Muted group received a sample message. Badge updated without sound.');
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
    state.posts.set(id,[]);
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
  nodes.chatTab.addEventListener('click',()=>switchGroupView('chat'));
  nodes.postsTab.addEventListener('click',async()=>{
    switchGroupView('posts');
    if(!state.preview&&selected()&&isActive(selected())){
      try{await loadPosts(selected().id);}catch{status('Could not load group posts.',true);}
    }
  });

  nodes.postAttachButton.addEventListener('click',()=>{
    if(!selected()||!isActive(selected()))return;
    nodes.postFile.click();
  });
  nodes.chatShareFlyer.addEventListener('click',()=>{
    if(!selected()||!isActive(selected()))return;
    switchGroupView('posts');
    nodes.postAttachButton.focus();
    nodes.postFile.click();
  });
  nodes.postFile.addEventListener('change',()=>{
    pickAttachment(nodes.postFile.files?.[0]);
  });
  nodes.removeAttachment.addEventListener('click',()=>resetAttachment());
  window.addEventListener('pagehide',()=>{
    for(const url of state.previewMediaUrls)URL.revokeObjectURL(url);
    state.previewMediaUrls.clear();
  },{once:true});
  nodes.postBody.addEventListener('input',()=>{
    nodes.postCount.textContent=nodes.postBody.value.length+' / 3000';
  });
  nodes.postForm.addEventListener('submit',async event=>{
    event.preventDefault();
    if(state.busy)return;
    const body=nodes.postBody.value.trim();
    if((!body&&!state.attachment)||body.length>3000)return;
    state.busy=true;
    nodes.postSubmit.disabled=true;
    try{
      await publishGroupPost(nodes.postKind.value,body);
      nodes.postBody.value='';
      nodes.postCount.textContent='0 / 3000';
      status(state.preview?'Example post shared in this browser only.':'Posted privately to your group.');
    }catch(err){status(err?.message||'Unable to publish group post.',true);}
    finally{state.busy=false;nodes.postSubmit.disabled=!selected()||!isActive(selected());}
  });
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
  nodes.refresh.addEventListener('click',()=>refreshUpdates({manual:true}));
  nodes.sound.addEventListener('click',()=>{
    state.soundEnabled=!state.soundEnabled;
    nodes.sound.textContent=state.soundEnabled?'Sound on':'Sound off';
    nodes.sound.setAttribute('aria-pressed',String(state.soundEnabled));
  });
  nodes.simulate.addEventListener('click',simulateIncoming);
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
    {id:'demo-training',name:'New Agent Training',topic:'Licensing, development & coaching',owner_id:'demo-a',created_at:'2026-11-09T00:00:00Z'},
    {id:'demo-pending',name:'Regional Growth Circle',topic:'A pending invitation to regional mentoring',owner_id:'demo-c',created_at:'2026-11-08T00:00:00Z'}
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
  state.memberships.set('demo-pending',[
    {user_id:state.uid,role:'member',status:'invited'},
    {user_id:'demo-c',role:'owner',status:'active'},
    {user_id:'demo-a',role:'member',status:'active'}
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
  state.messages.set('demo-pending',[
    {author_id:'demo-c',body:'Welcome to our regional mentorship circle. We share group coaching and leadership resources here.',created_at:'2026-11-13T09:00:00Z'}
  ]);
  state.posts.set('demo-leadership',[
    {id:'demo-recognition-1',group_id:'demo-leadership',author_id:'demo-a',
      kind:'milestone',
      body:'Congratulations to Alex Morgan on completing the state producer licensing exam! 🎉\\n\\nYour consistency and hard work deserve recognition. The entire DominionStar team is celebrating this milestone with you. #TeamDominionStar #Licensing',
      created_at:'2026-11-13T14:30:00Z'},
    {id:'demo-announcement-1',group_id:'demo-leadership',author_id:state.uid,
      kind:'announcement',
      body:'Weekly team development reminder: bring your training questions to our next leadership session.\\nJoin https://zoom.us/j/7443001370',
      created_at:'2026-11-12T19:00:00Z'}
  ]);
  state.posts.set('demo-training',[
    {id:'demo-training-1',group_id:'demo-training',author_id:'demo-a',
      kind:'update',body:'Study plan for this week: finish two practice exams, review missed questions, and join our coaching call. Consistent preparation builds confidence.',
      created_at:'2026-11-12T11:00:00Z'}
  ]);
  state.posts.set('demo-pending',[
    {id:'demo-pending-1',group_id:'demo-pending',author_id:'demo-c',
      kind:'milestone',body:'Private mentorship milestone — visible only after joining the group.',
      created_at:'2026-11-12T09:00:00Z'}
  ]);
  state.postReactions.set('demo-recognition-1',[
    {post_id:'demo-recognition-1',user_id:'demo-b',reaction:'celebrate'},
    {post_id:'demo-recognition-1',user_id:'demo-c',reaction:'like'}
  ]);
  state.postComments.set('demo-recognition-1',[
    {id:'sample-reply-a',post_id:'demo-recognition-1',author_id:'demo-c',
      body:'Congratulations, Alex! Hard work pays off. 🎉',
      created_at:'2026-11-13T14:36:00Z'},
    {id:'sample-reply-b',post_id:'demo-recognition-1',author_id:'demo-b',
      body:'Thanks for the encouragement, team. Ready for the next milestone!',
      created_at:'2026-11-13T14:39:00Z'},
    {id:'sample-reply-c',post_id:'demo-recognition-1',author_id:'demo-a',
      body:'We are proud of you. Keep growing and serving! #DominionStar',
      created_at:'2026-11-13T14:42:00Z'}
  ]);
  state.postComments.set('demo-announcement-1',[]);
  state.postComments.set('demo-training-1',[]);
  state.postComments.set('demo-pending-1',[
    {id:'sample-pending-private',post_id:'demo-pending-1',author_id:'demo-c',
      body:'Only joined members can read this private reply.',
      created_at:'2026-11-12T09:01:00Z'}
  ]);
  state.unread.set('demo-training',2);
  nodes.simulate.hidden=false;
  nodes.hint.textContent='Sample updates · Use Simulate message to test unread alerts.';
  nodes.mode.textContent='INTERACTIVE VISUAL PREVIEW · These groups, invitations, posts and attached files exist only in this browser session. Nothing is sent or saved.';
  setMediaNotice('Try Add Photo / Flyer / PDF. The file is shown locally and never uploaded.');
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
  setMediaNotice('Flyer preview is available, but real file posting requires secure storage and is not yet enabled.');
  show();bindEvents();
  try{
    await loadGroups();
    await refreshUnread({notify:false});
    startRefresh();
    nodes.hint.textContent='Foreground refresh every 20 seconds · No push/email delivery.';
  }catch(err){
    nodes.mode.textContent='Groups unavailable. Please try again after the secure service is restored.';
    status('Could not load private groups.',true);
  }
}
const start=()=>{if(previewEnabled())localDemo();else authenticated().catch(()=>
  disabled('Secure group verification could not be completed.'));};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();
