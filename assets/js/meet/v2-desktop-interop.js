(()=>{
  'use strict';
  if(window.DominionBrowserV2Transport)return;

  let current={roomId:'',roomCode:'',passcode:'',participantId:'',joinToken:'',state:''};
  let turnCache={roomId:'',iceServers:[],expiresAtMs:0,provider:'',ttl:0,qaDirectOnly:false};
  const normalizeDigits=value=>String(value||'').replace(/\D/g,'');
  const normalizeName=value=>String(value||'').trim().slice(0,100);
  const directIce=Object.freeze([{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}]);
  const hasRelay=servers=>(servers||[]).some(server=>{
    const urls=Array.isArray(server?.urls)?server.urls:[server?.urls];
    return urls.some(url=>/^turns?:/i.test(String(url||'')))&&Boolean(server?.username)&&Boolean(server?.credential);
  });

  async function client(){
    const instance=await window.DSAuth?.init?.();
    if(!instance?.rpc)throw new Error('browser_v2_transport_unavailable');
    return instance;
  }
  async function rpc(name,args={}){
    const instance=await client(),result=await instance.rpc(name,args);
    if(result.error)throw new Error(result.error.message||name);
    return result.data;
  }
  async function invokeFunction(name,body={}){
    const instance=await client(),result=await instance.functions.invoke(name,{body});
    if(result.error)throw new Error(result.error.message||name);
    if(result.data?.error)throw new Error(String(result.data.error));
    return result.data;
  }
  function remember(value={}){
    if(value?.roomId)current={...current,...value,
      roomId:String(value.roomId||current.roomId||''),
      roomCode:String(value.roomCode||current.roomCode||''),
      passcode:String(value.passcode||current.passcode||''),
      participantId:String(value.participantId||current.participantId||''),
      joinToken:String(value.joinToken||current.joinToken||''),
      state:String(value.state||current.state||'')
    };
    return value;
  }
  async function requestJoin({roomCode,passcode,displayName}={}){
    const normalizedRoom=normalizeDigits(roomCode);
    if(!/^\d{10,11}$/.test(normalizedRoom))throw new Error('browser_v2_room_code_unsupported');
    const data=await rpc('meet_v2_request_join',{
      p_room_code:normalizedRoom,
      p_passcode:normalizeDigits(passcode),
      p_display_name:normalizeName(displayName)
    });
    return remember({...data,roomCode:normalizedRoom,passcode:normalizeDigits(passcode)});
  }
  const joinStatus=async(participantId=current.participantId,joinToken=current.joinToken)=>remember(await rpc('meet_v2_join_status',{p_participant_id:participantId,p_join_token:joinToken}));
  const markJoined=async(participantId=current.participantId,joinToken=current.joinToken)=>remember(await rpc('meet_v2_mark_joined',{p_participant_id:participantId,p_join_token:joinToken}));
  const touchPresence=(participantId=current.participantId,joinToken=current.joinToken)=>rpc('meet_v2_touch_presence',{p_participant_id:participantId,p_join_token:joinToken});
  const snapshot=(roomId=current.roomId)=>rpc('meet_v2_room_snapshot',{p_room_id:roomId});
  const sendSignal=(toParticipantId,type,payload={})=>rpc('meet_v2_send_signal',{
    p_from_participant_id:current.participantId,
    p_to_participant_id:toParticipantId,
    p_signal_type:String(type||''),
    p_payload:payload||{}
  });
  const pullSignals=(afterId=0,limit=100)=>rpc('meet_v2_pull_signals',{
    p_participant_id:current.participantId,
    p_after_id:Number(afterId)||0,
    p_limit:Number(limit)||100
  });
  const leave=async()=>{if(!current.participantId||!current.joinToken)return {ok:true};const result=await rpc('meet_v2_leave_room',{p_participant_id:current.participantId,p_join_token:current.joinToken});current={roomId:'',roomCode:'',passcode:'',participantId:'',joinToken:'',state:''};return result;};
  async function iceConfig(force=false,ttl=7200){
    const now=Date.now();
    if(!current.roomId||current.state!=='joined')throw new Error('meeting_context_missing');
    if(!force&&turnCache.roomId===current.roomId&&turnCache.expiresAtMs>now+5*60*1000)return {...turnCache,iceServers:turnCache.iceServers.map(server=>({...server}))};
    try{
      const data=await invokeFunction('meet-v2-turn-credentials',{roomId:current.roomId,ttl:Math.max(900,Math.min(Number(ttl)||7200,43200))});
      const servers=Array.isArray(data?.iceServers)?data.iceServers.filter(server=>server&&server.urls):[];
      const expiresAtMs=Date.parse(String(data?.expiresAt||''));
      if(!hasRelay(servers)||!Number.isFinite(expiresAtMs))throw new Error('turn_relay_unavailable');
      turnCache={roomId:current.roomId,iceServers:servers,expiresAtMs,provider:String(data?.provider||'relay'),ttl:Number(data?.ttl)||0,qaDirectOnly:false};
    }catch{
      turnCache={roomId:current.roomId,iceServers:directIce.map(server=>({...server,urls:[...server.urls]})),expiresAtMs:now+30*60*1000,provider:'direct-fallback',ttl:1800,qaDirectOnly:true};
    }
    return {...turnCache,iceServers:turnCache.iceServers.map(server=>({...server}))};
  }

  window.DominionBrowserV2Transport=Object.freeze({
    version:'1.0.0-desktop-interop',
    requestJoin,joinStatus,markJoined,touchPresence,snapshot,sendSignal,pullSignals,iceConfig,leave,
    context:()=>Object.freeze({...current})
  });
})();