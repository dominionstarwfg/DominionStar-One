const json=(statusCode,body)=>({statusCode,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify(body)});
export async function handler(){
  const iceServers=[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}];
  const urls=String(process.env.MEET_TURN_URLS||'').split(',').map(value=>value.trim()).filter(value=>/^turns?:/i.test(value));
  const username=String(process.env.MEET_TURN_USERNAME||'').trim();
  const credential=String(process.env.MEET_TURN_CREDENTIAL||'').trim();
  const relayConfigured=Boolean(urls.length&&username&&credential);
  if(relayConfigured)iceServers.push({urls,username,credential});
  return json(200,{iceServers,relayConfigured});
}
