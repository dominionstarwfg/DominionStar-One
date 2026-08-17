(() => {
  let client=null, session=null, timer=null, channel=null, currentStatus='online';
  const listeners=new Set(), cache=new Map();
  const emit=payload=>listeners.forEach(fn=>{try{fn(payload)}catch(e){console.error(e)}});
  const recent=t=>t && Date.now()-new Date(t).getTime()<120000;
  const normalize=row=>!row||!recent(row.last_seen_at)?'offline':(row.status||(row.is_online?'online':'offline'));
  const updateOwn=async(status=currentStatus)=>{if(!client||!session)return;currentStatus=status;await client.from('community_presence').upsert({user_id:session.user.id,is_online:status!=='offline',status,last_seen_at:new Date().toISOString()},{onConflict:'user_id'});};
  const refresh=async ids=>{let q=client.from('community_presence').select('user_id,is_online,status,last_seen_at,updated_at');if(ids?.length)q=q.in('user_id',ids);const r=await q;if(r.error)throw r.error;(r.data||[]).forEach(row=>cache.set(row.user_id,row));emit({type:'snapshot',rows:r.data||[]});return r.data||[];};
  const init=async()=>{if(client&&session)return{client,session};if(!window.DSAuth?.ready)throw new Error('DominionStar authentication is unavailable.');client=await window.DSAuth.init();session=(await client.auth.getSession()).data.session;if(!session)throw new Error('Authenticated session required.');await updateOwn('online');timer||=setInterval(()=>updateOwn(currentStatus),45000);channel||=client.channel('dominionstar-presence-engine').on('postgres_changes',{event:'*',schema:'public',table:'community_presence'},payload=>{const row=payload.new||payload.old;if(row?.user_id)cache.set(row.user_id,row);emit({type:'change',row,eventType:payload.eventType});}).subscribe();document.addEventListener('visibilitychange',()=>updateOwn(document.hidden?'away':'online'));window.addEventListener('beforeunload',()=>updateOwn('offline'));return{client,session};};
  const setStatus=async status=>{if(!['online','away','busy','do_not_disturb','offline'].includes(status))throw new Error('Unsupported presence status.');await init();await updateOwn(status);return status;};
  const get=id=>{const row=cache.get(id);const status=normalize(row);return{...row,status,online:status!=='offline'};};
  const onChange=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
  window.DominionStarPresence={init,refresh,get,setStatus,onChange};
})();
