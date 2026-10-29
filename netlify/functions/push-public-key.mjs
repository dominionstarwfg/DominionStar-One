const reply=(status,body)=>new Response(JSON.stringify(body),{
  status,
  headers:{'content-type':'application/json','cache-control':'no-store'}
});

export default async()=>{
  const publicKey=String(process.env.VAPID_PUBLIC_KEY||'').trim();
  if(!publicKey)return reply(503,{error:'Push notifications are not configured.'});
  return reply(200,{publicKey});
};
