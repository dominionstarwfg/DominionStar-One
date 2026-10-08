(() => {
  'use strict';

  const ROOM_KEY='ds_meet_personal_room_v2';
  const LEGACY_ROOM_KEY='ds_meet_personal_room_v1';
  const PREF_KEY='ds_meet_identity_preferences_v1';
  const readJson=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch(_){return fallback;}};
  const randomDigits=length=>Array.from({length},()=>Math.floor(Math.random()*10)).join('');

  const readRoom=()=>{
    let room=readJson(ROOM_KEY)||readJson(LEGACY_ROOM_KEY)||null;
    if(room?.personalRoomId)return room;
    room={personalRoomId:randomDigits(10),personalLinkName:`member-${randomDigits(5)}`,passcode:randomDigits(6),waitingRoomEnabled:false};
    try{localStorage.setItem(ROOM_KEY,JSON.stringify(room));localStorage.setItem(LEGACY_ROOM_KEY,JSON.stringify(room));}catch(_){}
    return room;
  };
  const usePersonalForInstant=()=>readJson(PREF_KEY,{})?.usePersonalForInstant!==false;

  const installBridge=()=>{
    const current=window.DominionStarEnterHostPrejoin;
    if(typeof current!=='function'||current.__dsIdentityBridge)return false;
    const wrapped=options=>{
      const incoming={...(options||{})};
      if(!incoming.room&&usePersonalForInstant()){
        const room=readRoom();
        incoming.room=room.personalRoomId;
        incoming.passcode=room.passcode||'';
        incoming.waitingRoom=Boolean(room.waitingRoomEnabled);
        window.__DS_START_AS_HOST=true;
        window.__DS_WAITING_ROOM=Boolean(room.waitingRoomEnabled);
        window.__DS_MEETING_PASSCODE=String(room.passcode||'');
      }
      return current(incoming);
    };
    wrapped.__dsIdentityBridge=true;
    wrapped.__dsIdentityOriginal=current;
    window.DominionStarEnterHostPrejoin=wrapped;
    return true;
  };

  if(!installBridge()){
    let attempts=0;
    const timer=setInterval(()=>{attempts+=1;if(installBridge()||attempts>=40)clearInterval(timer);},50);
  }

  if(!document.querySelector('script[data-ds-meeting-identity-settings]')){
    const script=document.createElement('script');
    script.src='/assets/js/meet/meeting-identity-settings.js?v=2-operation-2030-wired';
    script.dataset.dsMeetingIdentitySettings='1';
    document.head.append(script);
  }

  window.DominionMeetingIdentityBridge=Object.freeze({version:'1.0.0',install:installBridge});
})();
