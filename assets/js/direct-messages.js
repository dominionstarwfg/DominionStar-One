(async () => {
  const gate = document.getElementById('dmGate');
  const app = document.getElementById('dmApp');
  const select = document.getElementById('dmMemberSelect');
  const list = document.getElementById('dmConversationList');
  const search = document.getElementById('dmMemberSearch');
  const thread = document.getElementById('dmThread');
  const form = document.getElementById('dmForm');
  const textarea = form?.querySelector('textarea');
  const sendButton = document.getElementById('dmSendButton');
  const sendStatus = document.getElementById('dmSendStatus');
  const soundToggle = document.getElementById('dmSoundToggle');
  const alertsButton = document.getElementById('dmAlertsButton');
  const connectionStatus = document.getElementById('dmConnectionStatus');
  const activeName = document.getElementById('dmActiveName');
  const activeStatus = document.getElementById('dmActiveStatus');
  const activeAvatar = document.getElementById('dmActiveAvatar');
  const mobileBack = document.getElementById('dmMobileBack');
  const micButton = document.getElementById('dmMicButton');
  const voicePreview = document.getElementById('dmVoicePreview');
  const voicePreviewAudio = document.getElementById('dmVoicePreviewAudio');
  const cancelVoice = document.getElementById('dmCancelVoice');
  const sendVoice = document.getElementById('dmSendVoice');
  const audioCallButton = document.getElementById('dmAudioCallButton');
  const videoCallButton = document.getElementById('dmVideoCallButton');
  const shareScreenButton = document.getElementById('dmShareScreenButton');
  const callBack = document.getElementById('dmCallBack');
  const callHeaderAvatar = document.getElementById('dmCallHeaderAvatar');
  const callHeaderName = document.getElementById('dmCallHeaderName');
  const callHeaderStatus = document.getElementById('dmCallHeaderStatus');
  const callVideoShortcut = document.getElementById('dmCallVideoShortcut');
  const callAudioShortcut = document.getElementById('dmCallAudioShortcut');
  const callShareScreen = document.getElementById('dmCallShareScreen');
  const screenShareNotice = document.getElementById('dmScreenShareNotice');
  const stopShare = document.getElementById('dmStopShare');
  const callOverlay = document.getElementById('dmCallOverlay');
  const incomingCall = document.getElementById('dmIncomingCall');
  const remoteVideo = document.getElementById('dmRemoteVideo');
  const localVideo = document.getElementById('dmLocalVideo');
  const audioCallIdentity = document.getElementById('dmAudioCallIdentity');
  const callAvatar = document.getElementById('dmCallAvatar');
  const callName = document.getElementById('dmCallName');
  const callStatus = document.getElementById('dmCallStatus');
  const incomingAvatar = document.getElementById('dmIncomingAvatar');
  const incomingName = document.getElementById('dmIncomingName');
  const incomingType = document.getElementById('dmIncomingType');
  const acceptCall = document.getElementById('dmAcceptCall');
  const declineCall = document.getElementById('dmDeclineCall');
  const endCall = document.getElementById('dmEndCall');
  const toggleMute = document.getElementById('dmToggleMute');
  const toggleCamera = document.getElementById('dmToggleCamera');
  const typingIndicator = document.getElementById('dmTypingIndicator');
  const emojiButton = document.getElementById('dmEmojiButton');
  const emojiPicker = document.getElementById('dmEmojiPicker');
  const attachmentButton = document.getElementById('dmAttachmentButton');
  const attachmentInput = document.getElementById('dmAttachmentInput');
  const replyPreview = document.getElementById('dmReplyPreview');
  const replyText = document.getElementById('dmReplyText');
  const cancelReply = document.getElementById('dmCancelReply');
  const reactionPicker = document.getElementById('dmReactionPicker');
  const menuViewProfile = document.getElementById('dmMenuViewProfile');
  const menuScheduleMeeting = document.getElementById('dmMenuScheduleMeeting');
  const menuAudioCall = document.getElementById('dmMenuAudioCall');
  const menuVideoCall = document.getElementById('dmMenuVideoCall');
  const menuShareScreen = document.getElementById('dmMenuShareScreen');
  const menuSearch = document.getElementById('dmMenuSearch');
  const callToastRegion = document.getElementById('dmCallToastRegion');
  const activeCallBar = document.getElementById('dmActiveCallBar');
  const restoreCall = document.getElementById('dmRestoreCall');
  const activeCallEnd = document.getElementById('dmActiveCallEnd');
  const activeCallAvatar = document.getElementById('dmActiveCallAvatar');
  const activeCallName = document.getElementById('dmActiveCallName');
  const activeCallStatus = document.getElementById('dmActiveCallStatus');

  const conversationSearch = document.getElementById('dmConversationSearch');
  const conversationSearchInput = document.getElementById('dmConversationSearchInput');
  const searchConversationButton = document.getElementById('dmSearchConversationButton');
  const closeConversationSearch = document.getElementById('dmCloseConversationSearch');

  const memberAvatarLarge = document.getElementById('dmMemberAvatarLarge');
  const memberNameLarge = document.getElementById('dmMemberNameLarge');
  const memberRole = document.getElementById('dmMemberRole');
  const memberContract = document.getElementById('dmMemberContract');
  const memberAgentCode = document.getElementById('dmMemberAgentCode');
  const memberSmd = document.getElementById('dmMemberSmd');
  const memberStatus = document.getElementById('dmMemberStatus');
  const viewProfileLink = document.getElementById('dmViewProfileLink');
  const scheduleMeetingLink = document.getElementById('dmScheduleMeetingLink');
  const recognitionLink = document.getElementById('dmRecognitionLink');
  const messageCount = document.getElementById('dmMessageCount');
  const linkCount = document.getElementById('dmLinkCount');
  const unreadCountEl = document.getElementById('dmUnreadCount');

  const actionMenu = document.getElementById('dmActionMenu');
  const forwardModal = document.getElementById('dmForwardModal');
  const forwardMember = document.getElementById('dmForwardMember');
  const closeForward = document.getElementById('dmCloseForward');
  const confirmForward = document.getElementById('dmConfirmForward');
  const conversationMenuButton = document.getElementById('dmConversationMenuButton');
  const conversationMenu = document.getElementById('dmConversationMenu');
  const closeConversationMenu = document.getElementById('dmCloseConversationMenu');
  const copyConversationButton = document.getElementById('dmCopyConversation');
  const exportConversationButton = document.getElementById('dmExportConversation');

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[char]));

  const linkify = value => escapeHtml(value).replace(
    /(https?:\/\/[^\s<]+)/gi,
    url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
  );

  const initials = name => String(name || 'DS')
    .split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();

  const resolveAvatar = async member => {
    if (!member?.avatar_path) return '';
    if (avatarUrls.has(member.id)) return avatarUrls.get(member.id);
    const result = await client.storage
      .from('member-avatars')
      .createSignedUrl(member.avatar_path, 3600);
    const url = result.data?.signedUrl || '';
    avatarUrls.set(member.id, url);
    return url;
  };

  const avatarMarkup = member => {
    const url = avatarUrls.get(member?.id);
    return url
      ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(member.display_name)}">`
      : `<span>${escapeHtml(initials(member?.display_name))}</span>`;
  };

  const setAvatarElement = (element, member) => {
    if (!element) return;
    element.innerHTML = avatarMarkup(member);
  };

  let soundEnabled = localStorage.getItem('dominionstar_message_sound') !== 'off';
  let activeMemberId = '';
  let members = [];
  let summaries = new Map();
  let activeMessages = [];
  let selectedMessage = null;
  let replyTarget = null;
  let reactionMap = new Map();
  let pinnedIds = new Set();
  let audioContext = null;
  let browserUnreadCount = 0;
  let typingChannel=null, typingTimer=null;
  const typingMembers=new Set();
  let mediaRecorder = null;
  let voiceChunks = [];
  let pendingVoiceBlob = null;
  let pendingVoiceUrl = '';
  let peerConnection = null;
  let localStream = null;
  let callChannel = null;
  let globalOutgoingCallChannel = null;
  let pendingOffer = null;
  let activeCallType = 'audio';
  let screenStream = null;
  let originalVideoTrack = null;
  let callPartnerId = '';
  let callStartedAt = 0;
  let incomingCallTimer = null;
  let activeCallAnswered = false;
  let callDurationTimer = null;
  let callMinimized = false;
  const avatarUrls = new Map();

  const playTone = kind => {
    if (!soundEnabled || !window.AudioContext) return;
    try {
      audioContext ||= new AudioContext();
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.type = 'sine';
      osc.frequency.value = kind === 'received' ? 760 : 520;
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.065, audioContext.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.16);
      osc.start();
      osc.stop(audioContext.currentTime + 0.18);
    } catch {}
  };


  const showCallToast = (title, detail) => {
    if (!callToastRegion) return;
    const toast = document.createElement('article');
    toast.className = 'dm-call-toast';
    toast.innerHTML = `<span>☎</span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div>`;
    callToastRegion.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 250);
    }, 5200);
  };

  const publishCallEvent = async (eventType, memberId, callType, title, description) => {
    if (!window.ExecutiveCore) return;
    try {
      await window.ExecutiveCore.publish(eventType, {
        member_id:session.user.id,
        title,
        description,
        payload:{member_id:memberId, call_type:callType}
      });
    } catch (error) {
      console.warn('Call event publish failed:', error);
    }
  };

  const recordMissedCall = async (memberId, callType, direction = 'incoming') => {
    const member = members.find(item => item.id === memberId);
    const name = member?.display_name || 'DominionStar member';
    const label = callType === 'video' ? 'video call' : 'audio call';
    const body = direction === 'incoming'
      ? `Missed ${label} from ${name}`
      : `${name} did not answer your ${label}`;

    try {
      await client.from('direct_messages').insert({
        sender_id:direction === 'incoming' ? memberId : session.user.id,
        recipient_id:direction === 'incoming' ? session.user.id : memberId,
        body:`[call-event]missed|${callType}|${body}`
      });
    } catch (error) {
      console.warn('Missed call message could not be stored:', error);
    }

    await publishCallEvent('call.missed', memberId, callType, 'Missed call', body);
    showCallToast('Missed call', body);

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Missed DominionStar call', {
        body,
        icon:'/assets/logo.jpeg'
      });
    }
  };

  const setSendStatus = (message, type = 'success') => {
    if (!sendStatus) return;
    sendStatus.textContent = message;
    sendStatus.dataset.type = type;
    sendStatus.classList.add('visible');
    clearTimeout(setSendStatus.timer);
    setSendStatus.timer = setTimeout(() => sendStatus.classList.remove('visible'), 2400);
  };

  const setUnreadTitle = delta => {
    browserUnreadCount = Math.max(0, browserUnreadCount + delta);
    document.title = browserUnreadCount
      ? `(${browserUnreadCount}) Direct Messages | DominionStar`
      : 'Direct Messages | DominionStar';
  };

  const copyText = async text => {
    try {
      await navigator.clipboard.writeText(text);
      setSendStatus('Copied to clipboard ✓');
    } catch {
      setSendStatus('Copy was blocked by the browser.', 'error');
    }
  };

  const closeMenus = () => {
    actionMenu.classList.add('member-hidden');
    forwardModal.classList.add('member-hidden');
    forwardModal.setAttribute('aria-hidden','true');
    conversationMenu.classList.add('member-hidden');
    conversationMenu.setAttribute('aria-hidden','true');
  };


  const presenceLabel=status=>({online:'Online',away:'Away',busy:'Busy',do_not_disturb:'Do Not Disturb',offline:'Offline'}[status]||'Offline');
  const updatePresenceDisplays=()=>{document.querySelectorAll('[data-member-id]').forEach(button=>{const p=window.DominionStarPresence?.get(button.dataset.memberId);const dot=button.querySelector('.dm-presence-dot');if(dot)dot.className=`dm-presence-dot ${p?.status||'offline'}`;});if(activeMemberId){const p=window.DominionStarPresence?.get(activeMemberId);activeStatus.textContent=typingMembers.has(activeMemberId)?`${activeName.textContent} is typing…`:presenceLabel(p?.status||'offline'); if(typingIndicator) typingIndicator.classList.toggle('member-hidden',!typingMembers.has(activeMemberId));}};
  const ensureTypingChannel=async otherId=>{if(typingChannel)await client.removeChannel(typingChannel);typingChannel=client.channel(['dominionstar-typing',session.user.id,otherId].sort().join('-'),{config:{broadcast:{self:false}}});typingChannel.on('broadcast',{event:'typing'},({payload})=>{if(!payload||payload.from!==otherId)return;payload.isTyping?typingMembers.add(otherId):typingMembers.delete(otherId);updatePresenceDisplays();});await typingChannel.subscribe();};
  const broadcastTyping=async isTyping=>{if(!typingChannel||!activeMemberId)return;await typingChannel.send({type:'broadcast',event:'typing',payload:{from:session.user.id,to:activeMemberId,isTyping}});};

  const updateSoundButton = () => {
    soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
    soundToggle.setAttribute('aria-pressed', String(soundEnabled));
  };

  soundToggle?.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem('dominionstar_message_sound', soundEnabled ? 'on' : 'off');
    updateSoundButton();
    if (soundEnabled) window.CommunicationEngine?.play('message_sent');
  });
  updateSoundButton();

  alertsButton?.addEventListener('click', async () => {
    if (!('Notification' in window)) {
      setSendStatus('Browser alerts are unavailable.', 'error');
      return;
    }
    const permission = await Notification.requestPermission();
    alertsButton.textContent = permission === 'granted' ? 'Alerts enabled' : 'Alerts blocked';
    alertsButton.disabled = permission === 'granted';
  });

  if ('Notification' in window && Notification.permission === 'granted') {
    alertsButton.textContent = 'Alerts enabled';
    alertsButton.disabled = true;
  }

  if (!window.DSAuth?.ready) {
    gate.innerHTML = '<h1>Authentication configuration is missing.</h1>';
    return;
  }

  const client = await window.DSAuth.init();
  const session = (await client.auth.getSession()).data.session;
  if (!session) {
    location.href = '/member-login/';
    return;
  }
  await window.CommunicationEngine?.init({client,session});

  gate.classList.add('member-hidden');
  app.classList.remove('member-hidden');

  const membersResult = await client
    .from('member_profiles')
    .select('id,full_name,preferred_name,rank,agent_code,smd_name,verification_status,avatar_path')
    .eq('verification_status','approved')
    .neq('id',session.user.id)
    .order('full_name');

  members = (membersResult.data || []).map(member => ({
    ...member,
    display_name: member.preferred_name || member.full_name || 'Member'
  }));

  await Promise.all(members.map(member => resolveAvatar(member)));

  if(window.DominionStarPresence){try{await window.DominionStarPresence.init();await window.DominionStarPresence.refresh(members.map(m=>m.id));window.DominionStarPresence.onChange(async()=>{await window.DominionStarPresence.refresh(members.map(m=>m.id));updatePresenceDisplays();});}catch(error){console.warn('Presence engine unavailable:',error);}}

  forwardMember.innerHTML = '<option value="">Choose a member</option>' +
    members.map(member => `<option value="${member.id}">${escapeHtml(member.display_name)}</option>`).join('');

  const loadConversationSummaries = async () => {
    const result = await client
      .from('direct_messages')
      .select('id,sender_id,recipient_id,body,created_at,read_at,is_deleted')
      .or(`sender_id.eq.${session.user.id},recipient_id.eq.${session.user.id}`)
      .eq('is_deleted',false)
      .order('created_at',{ascending:false});

    summaries = new Map();
    (result.data || []).forEach(message => {
      const otherId = message.sender_id === session.user.id ? message.recipient_id : message.sender_id;
      const existing = summaries.get(otherId) || {last:null, unread:0, total:0};
      existing.total += 1;
      if (!existing.last) existing.last = message;
      if (message.recipient_id === session.user.id && !message.read_at) existing.unread += 1;
      summaries.set(otherId, existing);
    });
  };

  const sortedMembers = () => [...members].sort((a,b) => {
    const aTime = summaries.get(a.id)?.last?.created_at || '';
    const bTime = summaries.get(b.id)?.last?.created_at || '';
    if (aTime === bTime) return a.display_name.localeCompare(b.display_name);
    return bTime.localeCompare(aTime);
  });

  const renderMembers = query => {
    const normalized = String(query || '').trim().toLowerCase();
    const filtered = sortedMembers().filter(member =>
      !normalized || member.display_name.toLowerCase().includes(normalized)
    );

    list.innerHTML = filtered.length ? filtered.map(member => {
      const summary = summaries.get(member.id);
      const last = summary?.last;
      const preview = last?.body || 'Start a private conversation';
      const time = last ? new Date(last.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
      return `
        <button class="dm-conversation ${member.id === activeMemberId ? 'active' : ''}"
                type="button" data-member-id="${member.id}">
          <span class="dm-avatar">${avatarMarkup(member)}<i class="dm-presence-dot offline"></i></span>
          <span class="dm-conversation-copy">
            <strong>${escapeHtml(member.display_name)}</strong>
            <small>${escapeHtml(preview)}</small>
          </span>
          <span class="dm-conversation-meta">
            <time>${escapeHtml(time)}</time>
            ${summary?.unread ? `<b>${summary.unread}</b>` : ''}
          </span>
        </button>`;
    }).join('') : '<p class="dm-empty-copy">No conversation found.</p>';

    list.querySelectorAll('[data-member-id]').forEach(button => {
      button.addEventListener('click', () => openConversation(button.dataset.memberId));
    });
  };

  search?.addEventListener('input', () => renderMembers(search.value));

  const updateMemberPanel = member => {
    const summary = summaries.get(member?.id);
    setAvatarElement(memberAvatarLarge, member);
    memberNameLarge.textContent = member?.display_name || 'Member details';
    memberRole.textContent = member ? 'Approved DominionStar member' : 'Select a conversation';
    memberContract.textContent = member?.rank || '—';
    memberAgentCode.textContent = member?.agent_code || '—';
    memberSmd.textContent = member?.smd_name || '—';
    memberStatus.textContent = member?.verification_status || '—';
    messageCount.textContent = summary?.total || 0;
    unreadCountEl.textContent = summary?.unread || 0;

    const profileUrl = member ? `/professional-profile/?member=${encodeURIComponent(member.id)}` : '/member-directory/';
    const meetingUrl = member ? `/appointments/?member=${encodeURIComponent(member.id)}` : '/appointments/';
    const journeyUrl = member ? `/journey/?member=${encodeURIComponent(member.id)}` : '/journey/';
    viewProfileLink.href = profileUrl;
    if(menuViewProfile)menuViewProfile.href=profileUrl;
    if(menuScheduleMeeting)menuScheduleMeeting.href=meetingUrl;
    scheduleMeetingLink.href = meetingUrl;
    recognitionLink.href = journeyUrl;
  };

  const updateActiveHeader = member => {
    activeName.textContent = member?.display_name || 'Select a conversation';
    activeStatus.textContent = member ? presenceLabel(window.DominionStarPresence?.get(member.id)?.status || 'offline') : 'Choose an approved member to begin.';
    setAvatarElement(activeAvatar, member);
    updateMemberPanel(member);
  };


  const messageStatusMarkup = message => {
    if (message.sender_id !== session.user.id) return '';
    const read = Boolean(message.read_at);
    return `<span class="dm-receipt ${read ? 'read' : 'delivered'}" title="${read ? 'Read' : 'Delivered'}">✓✓</span>`;
  };

  const parseAttachment = body => {
    if (!String(body || '').startsWith('[attachment]')) return null;
    try { return JSON.parse(String(body).slice(12)); } catch { return null; }
  };

  const attachmentMarkup = attachment => {
    if (!attachment) return '';
    const safeUrl = escapeHtml(attachment.url || '#');
    const safeName = escapeHtml(attachment.name || 'Attachment');
    if (String(attachment.type || '').startsWith('image/')) return `<a class="dm-image-attachment" href="${safeUrl}" target="_blank" rel="noopener"><img src="${safeUrl}" alt="${safeName}"><span>${safeName}</span></a>`;
    if (String(attachment.type || '').startsWith('video/')) return `<video class="dm-video-attachment" controls src="${safeUrl}"></video>`;
    return `<a class="dm-file-attachment" href="${safeUrl}" target="_blank" rel="noopener"><span>↧</span><div><strong>${safeName}</strong><small>${escapeHtml(attachment.type || 'File')}</small></div></a>`;
  };

  const loadMessageExtras = async ids => {
    reactionMap = new Map(); pinnedIds = new Set();
    if (!ids.length) return;
    const [reactions,pins] = await Promise.all([
      client.from('direct_message_reactions').select('message_id,member_id,reaction').in('message_id',ids),
      client.from('direct_message_pins').select('message_id').eq('member_id',session.user.id).in('message_id',ids)
    ]);
    if (!reactions.error) (reactions.data||[]).forEach(r=>{const a=reactionMap.get(r.message_id)||[];a.push(r);reactionMap.set(r.message_id,a);});
    if (!pins.error) (pins.data||[]).forEach(p=>pinnedIds.add(p.message_id));
  };

  const renderReactions = id => {
    const items=reactionMap.get(id)||[]; if(!items.length)return '';
    const groups={};items.forEach(x=>groups[x.reaction]=(groups[x.reaction]||0)+1);
    return `<div class="dm-message-reactions">${Object.entries(groups).map(([r,c])=>`<button type="button" data-react-message="${id}" data-reaction="${escapeHtml(r)}">${escapeHtml(r)}${c>1?` <b>${c}</b>`:''}</button>`).join('')}</div>`;
  };

  const setReplyTarget = message => {
    replyTarget=message; replyText.textContent=String(message.body||'').replace(/^\[[^\]]+\]/,'').slice(0,120); replyPreview.classList.remove('member-hidden'); textarea.focus();
  };
  const clearReplyTarget = () => {replyTarget=null;replyPreview.classList.add('member-hidden');replyText.textContent='';};
  const openMessageMenu = (event,message) => {
    selectedMessage = message;
    const mine = message.sender_id === session.user.id;
    actionMenu.querySelector('[data-action="edit"]').hidden = !mine;
    actionMenu.querySelector('[data-action="delete"]').hidden = !mine;
    actionMenu.classList.remove('member-hidden');
    actionMenu.style.left = `${Math.max(12,Math.min(event.clientX,window.innerWidth-220))}px`;
    actionMenu.style.top = `${Math.max(12,Math.min(event.clientY,window.innerHeight-290))}px`;
  };

  const renderMessages = messages => {
    activeMessages = messages;
    const filter=String(conversationSearchInput?.value||'').trim().toLowerCase();
    const visible=filter?messages.filter(m=>String(m.body||'').toLowerCase().includes(filter)):messages;
    linkCount.textContent=messages.filter(m=>/https?:\/\//i.test(m.body||'')).length;
    let lastDate='';
    thread.innerHTML=visible.length?visible.map(message=>{
      const mine=message.sender_id===session.user.id;
      const day=new Date(message.created_at).toLocaleDateString([], {weekday:'long',month:'short',day:'numeric'});
      const dateSep=day!==lastDate?`<div class="dm-date-separator"><span>${day}</span></div>`:''; lastDate=day;
      const attachment=parseAttachment(message.body);
      const raw=String(message.body||'');
      const reply=raw.startsWith('[reply]')?raw.slice(7).split('\n---\n'):null;
      const content=attachment?attachmentMarkup(attachment):raw.startsWith('[voice-note]')?`<div class="dm-voice-shell"><audio class="dm-voice-message" controls src="${escapeHtml(raw.slice(12))}"></audio><button class="dm-speed" type="button">1×</button></div>`:raw.startsWith('[call-event]')?(()=>{const p=raw.slice(12).split('|');return `<div class="dm-call-event ${escapeHtml(p[0]||'missed')}"><span>${p[1]==='video'?'▣':'☎'}</span><div><strong>${escapeHtml(p.slice(2).join('|')||'Call event')}</strong><small>${p[1]==='video'?'Video call':'Audio call'}</small></div></div>`;})():reply?`<div class="dm-inline-reply"><small>Reply</small><span>${escapeHtml(reply[0])}</span></div><p>${linkify(reply.slice(1).join('\n---\n'))}</p>`:`<p>${linkify(raw)}</p>`;
      return `${dateSep}<article id="message-${message.id}" class="dm-message-row ${mine?'mine':'theirs'} ${pinnedIds.has(message.id)?'pinned':''}" data-message-id="${message.id}"><div class="dm-message-bubble"><div class="dm-hover-actions"><button data-quick-action="react">♡</button><button data-quick-action="reply">↩</button><button data-quick-action="menu">•••</button></div>${pinnedIds.has(message.id)?'<span class="dm-pin-mark">📌</span>':''}${content}<small class="dm-message-meta">${new Date(message.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}${message.updated_at&&message.updated_at!==message.created_at?' · edited':''}${messageStatusMarkup(message)}</small>${renderReactions(message.id)}</div></article>`;
    }).join(''):`<div class="dm-welcome"><span>✦</span><h2>${filter?'No matching messages':'No messages yet'}</h2><p>${filter?'Try another search term.':'Send the first private message in this conversation.'}</p></div>`;
    thread.querySelectorAll('[data-message-id]').forEach(row=>{const message=visible.find(x=>String(x.id)===row.dataset.messageId);row.querySelector('[data-quick-action="menu"]')?.addEventListener('click',e=>{e.stopPropagation();openMessageMenu(e,message)});row.querySelector('[data-quick-action="reply"]')?.addEventListener('click',()=>setReplyTarget(message));row.querySelector('[data-quick-action="react"]')?.addEventListener('click',e=>{selectedMessage=message;reactionPicker.classList.remove('member-hidden');reactionPicker.style.left=`${Math.min(e.clientX,window.innerWidth-260)}px`;reactionPicker.style.top=`${Math.min(e.clientY,window.innerHeight-80)}px`;});row.addEventListener('contextmenu',e=>{e.preventDefault();openMessageMenu(e,message)});});
    thread.querySelectorAll('.dm-speed').forEach(btn=>btn.addEventListener('click',()=>{const audio=btn.previousElementSibling;const speeds=[1,1.5,2];const next=speeds[(speeds.indexOf(audio.playbackRate)+1)%speeds.length];audio.playbackRate=next;btn.textContent=`${next}×`;}));
    thread.querySelectorAll('[data-react-message]').forEach(btn=>btn.addEventListener('click',()=>toggleReaction(btn.dataset.reactMessage,btn.dataset.reaction)));
    if(!filter)thread.scrollTop=thread.scrollHeight;
  };

  async function loadConversation() {
    if (!activeMemberId) return;
    const result = await client
      .from('direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${session.user.id},recipient_id.eq.${activeMemberId}),and(sender_id.eq.${activeMemberId},recipient_id.eq.${session.user.id})`)
      .eq('is_deleted',false)
      .order('created_at');

    if (result.error) {
      thread.innerHTML = `<div class="dm-welcome"><h2>Conversation could not load</h2><p>${escapeHtml(result.error.message)}</p></div>`;
      return;
    }

    await loadMessageExtras((result.data || []).map(message => message.id));
    renderMessages(result.data || []);
    await client
      .from('direct_messages')
      .update({read_at:new Date().toISOString()})
      .eq('sender_id',activeMemberId)
      .eq('recipient_id',session.user.id)
      .is('read_at',null);

    await loadConversationSummaries();
    renderMembers(search?.value);
    updateMemberPanel(members.find(item => item.id === activeMemberId));
    setUnreadTitle(-999);
  }

  async function openConversation(memberId) {
    activeMemberId = memberId;
    window.CommunicationEngine?.setActiveConversation(memberId);
    select.value = memberId;
    const member = members.find(item => item.id === memberId);
    updateActiveHeader(member);
    renderMembers(search?.value);
    app.classList.add('conversation-open');
    await loadConversation();
    textarea?.focus();
    history.replaceState({},'',`?member=${encodeURIComponent(memberId)}`);
    await ensureCallChannel(memberId);
    await ensureTypingChannel(memberId);
    updatePresenceDisplays();
  }

  select.addEventListener('change',() => {
    if (select.value) openConversation(select.value);
  });

  mobileBack?.addEventListener('click',() => app.classList.remove('conversation-open'));

  textarea?.addEventListener('input',()=>{textarea.style.height='auto';textarea.style.height=`${Math.min(textarea.scrollHeight,130)}px`;clearTimeout(typingTimer);broadcastTyping(Boolean(textarea.value.trim()));typingTimer=setTimeout(()=>broadcastTyping(false),1400);});

  searchConversationButton?.addEventListener('click',() => {
    conversationSearch.classList.toggle('member-hidden');
    if (!conversationSearch.classList.contains('member-hidden')) conversationSearchInput.focus();
  });

  closeConversationSearch?.addEventListener('click',() => {
    conversationSearch.classList.add('member-hidden');
    conversationSearchInput.value = '';
    renderMessages(activeMessages);
  });

  conversationSearchInput?.addEventListener('input',() => renderMessages(activeMessages));

  actionMenu?.addEventListener('click',async event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action || !selectedMessage) return;

    if (action === 'copy') await copyText(selectedMessage.body);
    if (action === 'copy-link') {
      await copyText(`${location.origin}${location.pathname}?member=${encodeURIComponent(activeMemberId)}#message-${selectedMessage.id}`);
    }
    if (action === 'reply') {
      setReplyTarget(selectedMessage);
    }
    if (action === 'react') {
      reactionPicker.classList.remove('member-hidden');
      reactionPicker.style.left=actionMenu.style.left; reactionPicker.style.top=actionMenu.style.top;
    }
    if (action === 'pin') {
      const pinned=pinnedIds.has(selectedMessage.id);
      const query=client.from('direct_message_pins');
      const result=pinned?await query.delete().eq('message_id',selectedMessage.id).eq('member_id',session.user.id):await query.insert({message_id:selectedMessage.id,member_id:session.user.id});
      if(result.error)setSendStatus(result.error.message,'error');else await loadConversation();
    }
    if (action === 'edit') {
      const updatedBody = prompt('Edit your message:',selectedMessage.body);
      if (updatedBody && updatedBody.trim() && updatedBody.trim() !== selectedMessage.body) {
        const result = await client.from('direct_messages')
          .update({body:updatedBody.trim()})
          .eq('id',selectedMessage.id)
          .eq('sender_id',session.user.id);
        if (result.error) setSendStatus(result.error.message,'error');
        else {
          setSendStatus('Message updated ✓');
          await loadConversation();
        }
      }
    }
    if (action === 'delete') {
      if (confirm('Delete this message for everyone?')) {
        const result = await client.from('direct_messages')
          .update({is_deleted:true})
          .eq('id',selectedMessage.id)
          .eq('sender_id',session.user.id);
        if (result.error) setSendStatus(result.error.message,'error');
        else {
          setSendStatus('Message deleted');
          await loadConversation();
        }
      }
    }
    if (action === 'forward') {
      forwardModal.classList.remove('member-hidden');
      forwardModal.setAttribute('aria-hidden','false');
      forwardMember.focus();
    }
    actionMenu.classList.add('member-hidden');
  });

  const toggleReaction = async (messageId,reaction) => {
    const existing=(reactionMap.get(messageId)||[]).find(r=>r.member_id===session.user.id&&r.reaction===reaction);
    const result=existing?await client.from('direct_message_reactions').delete().eq('message_id',messageId).eq('member_id',session.user.id).eq('reaction',reaction):await client.from('direct_message_reactions').insert({message_id:messageId,member_id:session.user.id,reaction});
    if(result.error)setSendStatus(result.error.message,'error');else await loadConversation();
    reactionPicker.classList.add('member-hidden');
  };
  reactionPicker?.addEventListener('click',e=>{const r=e.target.textContent.trim();if(r&&selectedMessage)toggleReaction(selectedMessage.id,r);});
  cancelReply?.addEventListener('click',clearReplyTarget);

  closeForward?.addEventListener('click',closeMenus);
  confirmForward?.addEventListener('click',async () => {
    if (!selectedMessage || !forwardMember.value) {
      setSendStatus('Choose a member to forward to.','error');
      return;
    }
    const result = await client.from('direct_messages').insert({
      sender_id:session.user.id,
      recipient_id:forwardMember.value,
      body:`Forwarded message:\n${selectedMessage.body}`
    });
    if (result.error) setSendStatus(result.error.message,'error');
    else {
      window.CommunicationEngine?.play('message_sent');
      setSendStatus('Message forwarded ✓');
      closeMenus();
      await loadConversationSummaries();
      renderMembers(search?.value);
    }
  });

  conversationMenuButton?.addEventListener('click',() => {
    conversationMenu.classList.remove('member-hidden');
    conversationMenu.setAttribute('aria-hidden','false');
  });
  closeConversationMenu?.addEventListener('click',closeMenus);

  const conversationText = () => {
    const member = members.find(item => item.id === activeMemberId);
    const otherName = member?.display_name || 'Member';
    return activeMessages.map(message => {
      const sender = message.sender_id === session.user.id ? 'You' : otherName;
      return `[${new Date(message.created_at).toLocaleString()}] ${sender}: ${message.body}`;
    }).join('\n\n');
  };

  copyConversationButton?.addEventListener('click',async () => {
    await copyText(conversationText());
    closeMenus();
  });

  exportConversationButton?.addEventListener('click',() => {
    const member = members.find(item => item.id === activeMemberId);
    const blob = new Blob([conversationText()],{type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DominionStar-conversation-${(member?.display_name || 'member').replace(/[^a-z0-9]+/gi,'-')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    closeMenus();
  });

  document.addEventListener('click',event => {
    if (!event.target.closest('#dmActionMenu') && !event.target.closest('.dm-message-menu-trigger')) {
      actionMenu.classList.add('member-hidden');
      reactionPicker?.classList.add('member-hidden');
    }
  });


  const uploadVoiceNote = async blob => {
    const extension = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
    const path = `${session.user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const result = await client.storage
      .from('direct-message-media')
      .upload(path, blob, {contentType:blob.type || 'audio/webm', upsert:false});
    if (result.error) throw result.error;
    const signed = await client.storage
      .from('direct-message-media')
      .createSignedUrl(path, 60 * 60 * 24 * 30);
    if (signed.error || !signed.data?.signedUrl) throw signed.error || new Error('Voice note URL unavailable');
    return signed.data.signedUrl;
  };

  const resetVoiceRecording = () => {
    if (pendingVoiceUrl) URL.revokeObjectURL(pendingVoiceUrl);
    pendingVoiceBlob = null;
    pendingVoiceUrl = '';
    voicePreview.classList.add('member-hidden');
    voicePreviewAudio.removeAttribute('src');
    micButton.classList.remove('recording');
    micButton.textContent = '🎙️';
  };

  micButton?.addEventListener('click', async () => {
    if (!activeMemberId) {
      setSendStatus('Select a conversation first.', 'error');
      return;
    }

    if (mediaRecorder?.state === 'recording') {
      mediaRecorder.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      voiceChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.addEventListener('dataavailable', event => {
        if (event.data.size) voiceChunks.push(event.data);
      });
      mediaRecorder.addEventListener('stop', () => {
        pendingVoiceBlob = new Blob(voiceChunks, {type:mediaRecorder.mimeType || 'audio/webm'});
        pendingVoiceUrl = URL.createObjectURL(pendingVoiceBlob);
        voicePreviewAudio.src = pendingVoiceUrl;
        voicePreview.classList.remove('member-hidden');
        micButton.classList.remove('recording');
        micButton.textContent = '🎙️';
        stream.getTracks().forEach(track => track.stop());
      });
      mediaRecorder.start();
      micButton.classList.add('recording');
      micButton.textContent = '■';
      setSendStatus('Recording voice note…', 'pending');
    } catch (error) {
      setSendStatus(error.message || 'Microphone permission is required.', 'error');
    }
  });

  cancelVoice?.addEventListener('click', resetVoiceRecording);

  sendVoice?.addEventListener('click', async () => {
    if (!pendingVoiceBlob || !activeMemberId) return;
    sendVoice.disabled = true;
    setSendStatus('Uploading voice note…', 'pending');
    try {
      const url = await uploadVoiceNote(pendingVoiceBlob);
      const result = await client.from('direct_messages').insert({
        sender_id:session.user.id,
        recipient_id:activeMemberId,
        body:`[voice-note]${url}`
      });
      if (result.error) throw result.error;
      resetVoiceRecording();
      window.CommunicationEngine?.play('message_sent');
      setSendStatus('Voice note sent ✓');
      await loadConversation();
    } catch (error) {
      setSendStatus(error.message || 'Voice note could not be sent.', 'error');
    } finally {
      sendVoice.disabled = false;
    }
  });

  const callChannelName = otherId => ['dominionstar-call', session.user.id, otherId].sort().join('-');

  const ensureCallChannel = async otherId => {
    if (callChannel && callPartnerId === otherId) return callChannel;
    if (callChannel) await client.removeChannel(callChannel);
    callPartnerId = otherId;
    callChannel = client.channel(callChannelName(otherId), {config:{broadcast:{self:false}}});

    callChannel.on('broadcast', {event:'call-signal'}, async ({payload}) => {
      if (!payload || payload.to !== session.user.id) return;

      if (payload.type === 'offer') {
        pendingOffer = payload;
        const caller = members.find(member => member.id === payload.from);
        setAvatarElement(incomingAvatar, caller);
        incomingName.textContent = caller?.display_name || 'DominionStar member';
        incomingType.textContent = payload.callType === 'video' ? 'Video call' : 'Audio call';
        window.CommunicationEngine?.startLoop('incoming_ring');
        incomingCall.classList.remove('member-hidden');
        incomingCall.setAttribute('aria-hidden','false');
        activeCallAnswered = false;
        clearTimeout(incomingCallTimer);
        incomingCallTimer = setTimeout(async () => {
          if (!activeCallAnswered && pendingOffer) {
            const missed = pendingOffer;
            incomingCall.classList.add('member-hidden');
            pendingOffer = null;
    clearTimeout(incomingCallTimer);
    activeCallAnswered = false;
      activeCallAnswered = true;
      clearTimeout(incomingCallTimer);
            window.CommunicationEngine?.play('missed_call');
      await recordMissedCall(missed.from, missed.callType || 'audio', 'incoming');
          }
        }, 30000);
      }

      if (payload.type === 'answer' && peerConnection) {
        await peerConnection.setRemoteDescription(payload.description);
        window.CommunicationEngine?.stopAll();
        window.CommunicationEngine?.play('call_connected');
        activeCallAnswered = true;
        clearTimeout(incomingCallTimer);
        callStartedAt = Date.now();
        updateCallStatus('Connected');
        startCallDuration();
      }

      if (payload.type === 'ice' && peerConnection && payload.candidate) {
        try { await peerConnection.addIceCandidate(payload.candidate); } catch {}
      }

      if (payload.type === 'hangup') {
        if (!activeCallAnswered && callPartnerId) await recordMissedCall(callPartnerId, activeCallType, 'outgoing');
        endActiveCall(false);
      }
      if (payload.type === 'decline') {
        window.CommunicationEngine?.stopAll();
        window.CommunicationEngine?.play('call_declined');
        updateCallStatus('Call declined');
        if (callPartnerId) await recordMissedCall(callPartnerId, activeCallType, 'outgoing');
        setTimeout(() => endActiveCall(false), 900);
      }
    });

    await callChannel.subscribe();
    return callChannel;
  };

  const sendCallSignal = async payload => {
    if (!callChannel || !callPartnerId) return;
    const signal = {...payload, from:session.user.id, to:callPartnerId};
    await callChannel.send({
      type:'broadcast',
      event:'call-signal',
      payload:signal
    });

    if (payload.type === 'offer') {
      if (globalOutgoingCallChannel) await client.removeChannel(globalOutgoingCallChannel);
      globalOutgoingCallChannel = client.channel(`dominionstar-user-call-${callPartnerId}`, {config:{broadcast:{self:false}}});
      await globalOutgoingCallChannel.subscribe();
      await globalOutgoingCallChannel.send({
        type:'broadcast',
        event:'incoming-call',
        payload:signal
      });
    }

    if (payload.type === 'hangup' && globalOutgoingCallChannel) {
      await globalOutgoingCallChannel.send({
        type:'broadcast',
        event:'call-cancelled',
        payload:signal
      });
    }
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers:[{urls:'stun:stun.l.google.com:19302'}]
    });
    pc.addEventListener('icecandidate', event => {
      if (event.candidate) sendCallSignal({type:'ice', candidate:event.candidate});
    });
    pc.addEventListener('track', event => {
      remoteVideo.srcObject = event.streams[0];
      if (!activeCallAnswered) { activeCallAnswered = true; callStartedAt = Date.now(); startCallDuration(); }
      updateCallStatus('Connected');
    });
    pc.addEventListener('connectionstatechange', () => {
      if (['failed','disconnected','closed'].includes(pc.connectionState)) {
        updateCallStatus(pc.connectionState === 'failed' ? 'Connection failed' : 'Call ended');
      }
    });
    return pc;
  };

  const formatCallDuration = milliseconds => {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const updateCallStatus = text => {
    callStatus.textContent = text;
    callHeaderStatus.textContent = text;
    if (activeCallStatus) activeCallStatus.textContent = text;
  };

  const startCallDuration = () => {
    clearInterval(callDurationTimer);
    callStartedAt = callStartedAt || Date.now();
    callDurationTimer = setInterval(() => {
      if (!activeCallAnswered) return;
      updateCallStatus(formatCallDuration(Date.now() - callStartedAt));
    }, 1000);
  };

  const minimizeActiveCall = () => {
    if (!peerConnection) return;
    callMinimized = true;
    callOverlay.classList.add('member-hidden');
    callOverlay.setAttribute('aria-hidden','true');
    activeCallBar?.classList.remove('member-hidden');
    activeCallBar?.setAttribute('aria-hidden','false');
  };

  const restoreActiveCall = () => {
    if (!peerConnection) return;
    callMinimized = false;
    activeCallBar?.classList.add('member-hidden');
    activeCallBar?.setAttribute('aria-hidden','true');
    callOverlay.classList.remove('member-hidden');
    callOverlay.setAttribute('aria-hidden','false');
  };

  const showCallOverlay = (member, callType) => {
    activeCallType = callType;
    setAvatarElement(callAvatar, member);
    setAvatarElement(callHeaderAvatar, member);
    callName.textContent = member?.display_name || 'DominionStar member';
    callHeaderName.textContent = member?.display_name || 'DominionStar member';
    updateCallStatus('Calling…');
    if (activeCallAvatar) setAvatarElement(activeCallAvatar, member);
    if (activeCallName) activeCallName.textContent = member?.display_name || 'DominionStar member';
    audioCallIdentity.classList.toggle('member-hidden', callType === 'video');
    remoteVideo.classList.toggle('member-hidden', callType !== 'video');
    localVideo.classList.toggle('member-hidden', callType !== 'video');
    toggleCamera.classList.toggle('member-hidden', callType !== 'video');
    callOverlay.classList.remove('member-hidden');
    callOverlay.setAttribute('aria-hidden','false');
  };

  const startCall = async callType => {
    if (!activeMemberId) {
      setSendStatus('Select a conversation first.', 'error');
      return;
    }
    const member = members.find(item => item.id === activeMemberId);
    try {
      await ensureCallChannel(activeMemberId);
      localStream = await navigator.mediaDevices.getUserMedia({
        audio:true,
        video:callType === 'video'
      });
      peerConnection = createPeerConnection();
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
      localVideo.srcObject = localStream;
      showCallOverlay(member, callType);
      window.CommunicationEngine?.startLoop('ringback');
      callStartedAt = Date.now();
      activeCallAnswered = false;
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      await sendCallSignal({type:'offer', description:offer, callType});
      setTimeout(async () => {
        if (peerConnection && !activeCallAnswered && callPartnerId === activeMemberId) {
          await recordMissedCall(activeMemberId, callType, 'outgoing');
          await sendCallSignal({type:'hangup'});
          await endActiveCall(false);
        }
      }, 30000);
    } catch (error) {
      setSendStatus(error.message || 'Call could not start.', 'error');
      endActiveCall(false);
    }
  };

  const acceptIncomingCall = async () => {
    if (!pendingOffer) return;
    const caller = members.find(member => member.id === pendingOffer.from);
    activeMemberId = pendingOffer.from;
    await ensureCallChannel(activeMemberId);
    activeCallType = pendingOffer.callType || 'audio';

    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio:true,
        video:activeCallType === 'video'
      });
      peerConnection = createPeerConnection();
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
      localVideo.srcObject = localStream;
      await peerConnection.setRemoteDescription(pendingOffer.description);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      showCallOverlay(caller, activeCallType);
      updateCallStatus('Connecting…');
      await sendCallSignal({type:'answer', description:answer});
      incomingCall.classList.add('member-hidden');
      pendingOffer = null;
    } catch (error) {
      setSendStatus(error.message || 'Call could not be accepted.', 'error');
      await sendCallSignal({type:'decline'});
      endActiveCall(false);
    }
  };

  const endActiveCall = async notify => {
    window.CommunicationEngine?.stopAll();
    if (activeCallAnswered) window.CommunicationEngine?.play('call_ended');
    if (notify && callChannel) await sendCallSignal({type:'hangup'});
    await stopScreenShare();
    peerConnection?.close();
    peerConnection = null;
    localStream?.getTracks().forEach(track => track.stop());
    localStream = null;
    remoteVideo.srcObject = null;
    localVideo.srcObject = null;
    callOverlay.classList.add('member-hidden');
    callOverlay.setAttribute('aria-hidden','true');
    incomingCall.classList.add('member-hidden');
    incomingCall.setAttribute('aria-hidden','true');
    pendingOffer = null;
    clearInterval(callDurationTimer);
    callDurationTimer = null;
    callStartedAt = 0;
    activeCallAnswered = false;
    callMinimized = false;
    activeCallBar?.classList.add('member-hidden');
    activeCallBar?.setAttribute('aria-hidden','true');
    toggleMute?.classList.remove('is-off');
    toggleCamera?.classList.remove('is-off');
  };


  const startScreenShare = async () => {
    if (!peerConnection) {
      setSendStatus('Start a call before sharing your screen.', 'error');
      return;
    }
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({video:true, audio:false});
      const screenTrack = screenStream.getVideoTracks()[0];
      const sender = peerConnection.getSenders().find(item => item.track?.kind === 'video');

      if (sender) {
        originalVideoTrack = sender.track;
        await sender.replaceTrack(screenTrack);
      } else {
        peerConnection.addTrack(screenTrack, screenStream);
      }

      localVideo.srcObject = screenStream;
      screenShareNotice.classList.remove('member-hidden');
      callHeaderStatus.textContent = 'Sharing screen';

      screenTrack.addEventListener('ended', stopScreenShare, {once:true});
    } catch (error) {
      setSendStatus(error.message || 'Screen sharing could not start.', 'error');
    }
  };

  const stopScreenShare = async () => {
    if (!screenStream) return;
    const sender = peerConnection?.getSenders().find(item => item.track?.kind === 'video');
    if (sender && originalVideoTrack) await sender.replaceTrack(originalVideoTrack);
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
    localVideo.srcObject = localStream;
    screenShareNotice.classList.add('member-hidden');
    callHeaderStatus.textContent = activeCallType === 'video' ? 'Video call' : 'Audio call';
  };

  audioCallButton?.addEventListener('click', () => startCall('audio'));
  videoCallButton?.addEventListener('click', () => startCall('video'));
  shareScreenButton?.addEventListener('click', startScreenShare);
  callShareScreen?.addEventListener('click', startScreenShare);
  stopShare?.addEventListener('click', stopScreenShare);
  callBack?.addEventListener('click', minimizeActiveCall);
  restoreCall?.addEventListener('click', restoreActiveCall);
  activeCallEnd?.addEventListener('click', () => endActiveCall(true));
  callVideoShortcut?.addEventListener('click', () => {
    if (!peerConnection) startCall('video');
    else toggleCamera?.click();
  });
  callAudioShortcut?.addEventListener('click', () => {
    if (!peerConnection) startCall('audio');
    else toggleMute?.click();
  });
  acceptCall?.addEventListener('click', acceptIncomingCall);
  declineCall?.addEventListener('click', async () => {
    if (pendingOffer) {
      callPartnerId = pendingOffer.from;
      await ensureCallChannel(callPartnerId);
      await sendCallSignal({type:'decline'});
    }
    if (pendingOffer) await recordMissedCall(pendingOffer.from, pendingOffer.callType || 'audio', 'incoming');
    incomingCall.classList.add('member-hidden');
    pendingOffer = null;
    clearTimeout(incomingCallTimer);
  });
  endCall?.addEventListener('click', () => endActiveCall(true));

  toggleMute?.addEventListener('click', () => {
    const track = localStream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    toggleMute.classList.toggle('is-off', !track.enabled);
    toggleMute.setAttribute('aria-label', track.enabled ? 'Mute microphone' : 'Unmute microphone');
  });

  toggleCamera?.addEventListener('click', () => {
    const track = localStream?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    toggleCamera.classList.toggle('is-off', !track.enabled);
    toggleCamera.setAttribute('aria-label', track.enabled ? 'Turn camera off' : 'Turn camera on');
  });

  emojiButton?.addEventListener('click',()=>emojiPicker.classList.toggle('member-hidden'));
  emojiPicker?.addEventListener('click',event=>{const emoji=event.target.textContent.trim().split(/\s+/)[0];if(emoji){textarea.value+=emoji;textarea.focus();emojiPicker.classList.add('member-hidden');}});
  attachmentButton?.addEventListener('click',()=>attachmentInput.click());
  const uploadAttachment=async file=>{const path=`${session.user.id}/${Date.now()}-${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9._-]/gi,'-')}`;const up=await client.storage.from('direct-message-attachments').upload(path,file,{contentType:file.type||'application/octet-stream'});if(up.error)throw up.error;const signed=await client.storage.from('direct-message-attachments').createSignedUrl(path,60*60*24*30);if(signed.error)throw signed.error;return {name:file.name,type:file.type,size:file.size,url:signed.data.signedUrl,path};};
  const sendAttachment=async file=>{if(!activeMemberId)return;setSendStatus(`Uploading ${file.name}…`,'pending');try{const payload=await uploadAttachment(file);const result=await client.from('direct_messages').insert({sender_id:session.user.id,recipient_id:activeMemberId,body:`[attachment]${JSON.stringify(payload)}`});if(result.error)throw result.error;setSendStatus('Attachment sent ✓');await loadConversation();}catch(error){setSendStatus(error.message||'Attachment failed.','error');}};
  attachmentInput?.addEventListener('change',async()=>{for(const file of attachmentInput.files||[])await sendAttachment(file);attachmentInput.value='';});
  thread?.addEventListener('dragover',e=>{e.preventDefault();thread.classList.add('dragging')});
  thread?.addEventListener('dragleave',()=>thread.classList.remove('dragging'));
  thread?.addEventListener('drop',async e=>{e.preventDefault();thread.classList.remove('dragging');for(const file of e.dataTransfer.files||[])await sendAttachment(file);});
  textarea?.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();form.requestSubmit();}});
  menuAudioCall?.addEventListener('click',()=>{closeMenus();startCall('audio')});
  menuVideoCall?.addEventListener('click',()=>{closeMenus();startCall('video')});
  menuShareScreen?.addEventListener('click',()=>{closeMenus();startScreenShare()});
  menuSearch?.addEventListener('click',()=>{closeMenus();conversationSearch.classList.remove('member-hidden');conversationSearchInput.focus()});
  form.addEventListener('submit',async event => {
    event.preventDefault();
    if (!activeMemberId) {
      setSendStatus('Select a member first.','error');
      return;
    }

    let body = textarea.value.trim();
    if (replyTarget) body = `[reply]${String(replyTarget.body||'').slice(0,180)}\n---\n${body}`;
    if (!body) return;

    sendButton.disabled = true;
    setSendStatus('Sending…','pending');

    const result = await client.from('direct_messages').insert({
      sender_id:session.user.id,
      recipient_id:activeMemberId,
      body
    });

    sendButton.disabled = false;
    if (result.error) {
      setSendStatus(result.error.message || 'Message could not be sent.','error');
      return;
    }

    textarea.value = '';
    textarea.style.height = 'auto';
    clearReplyTarget();
    await broadcastTyping(false);
    window.CommunicationEngine?.play('message_sent');
    setSendStatus('Message sent ✓');

    if (window.ExecutiveCore) {
      try {
        const recipient = members.find(member => member.id === activeMemberId);
        const senderName = session.user.user_metadata?.display_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'a DominionStar member';
        await window.ExecutiveCore.publish('message.received', {
          member_id:activeMemberId,
          actor_id:session.user.id,
          title:`New message from ${senderName}`,
          description:String(body).replace(/^\[reply\][\s\S]*?\n---\n/, '').slice(0, 180),
          payload:{
            sender_id:session.user.id,
            conversation_member_id:session.user.id,
            action_url:`/direct-messages/?member=${encodeURIComponent(session.user.id)}`
          }
        });
      } catch (error) {
        console.warn('Executive event publish failed:', error);
      }
    }

    await loadConversation();
  });

  await loadConversationSummaries();
  renderMembers('');

  const pendingGlobalCallRaw = sessionStorage.getItem('ds_pending_global_call');
  if (pendingGlobalCallRaw) {
    try {
      const pendingGlobalCall = JSON.parse(pendingGlobalCallRaw);
      if (pendingGlobalCall?.to === session.user.id && pendingGlobalCall?.from) {
        sessionStorage.removeItem('ds_pending_global_call');
        await openConversation(pendingGlobalCall.from);
        pendingOffer = pendingGlobalCall;
        incomingCall.classList.add('member-hidden');
        incomingCall.setAttribute('aria-hidden','true');
        await acceptIncomingCall();
      }
    } catch (error) {
      console.warn('Pending global call could not be restored:', error);
      sessionStorage.removeItem('ds_pending_global_call');
    }
  }

  const initial = new URLSearchParams(location.search).get('member');
  if (!peerConnection && initial && members.some(member => member.id === initial)) {
    await openConversation(initial);
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView({behavior:'smooth',block:'center'});
  }

  const channel = client
    .channel('dominionstar-direct-messages-build18')
    .on('postgres_changes',{
      event:'INSERT',
      schema:'public',
      table:'direct_messages',
      filter:`recipient_id=eq.${session.user.id}`
    },async payload => {
      const incoming = payload.new;
      const sender = members.find(member => member.id === incoming.sender_id);
      const conversationIsOpen = incoming.sender_id === activeMemberId && document.visibilityState === 'visible';
      if (!conversationIsOpen) setUnreadTitle(1);

      await loadConversationSummaries();
      renderMembers(search?.value);
      if (incoming.sender_id === activeMemberId) await loadConversation();
    })
    .on('postgres_changes',{
      event:'UPDATE',
      schema:'public',
      table:'direct_messages'
    },async payload => {
      const changed = payload.new;
      await loadConversationSummaries();
      renderMembers(search?.value);
      if ([changed.sender_id,changed.recipient_id].includes(activeMemberId)) await loadConversation();
    })
    .subscribe(status => {
      connectionStatus.textContent = status === 'SUBSCRIBED' ? 'Live' : 'Connecting…';
      connectionStatus.classList.toggle('live',status === 'SUBSCRIBED');
    });

  window.addEventListener('focus',() => setUnreadTitle(-999));
  window.addEventListener('beforeunload',() => {
    window.CommunicationEngine?.setActiveConversation('');
    client.removeChannel(channel);
    if (callChannel) client.removeChannel(callChannel);
    if (globalOutgoingCallChannel) client.removeChannel(globalOutgoingCallChannel);
    if (typingChannel) client.removeChannel(typingChannel);
    peerConnection?.close();
    localStream?.getTracks().forEach(track => track.stop());
  });
})();
