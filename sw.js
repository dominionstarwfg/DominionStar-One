const safeActionUrl=value=>{try{const parsed=new URL(String(value||'/notifications/'),self.location.origin);if(parsed.origin!==self.location.origin)return '/notifications/';return `${parsed.pathname}${parsed.search}${parsed.hash}`||'/notifications/';}catch{return '/notifications/';}};
self.addEventListener('push',event=>{
  let data={}; try{data=event.data?.json()||{}}catch{data={body:event.data?.text()||''}}
  const priority=String(data.priority||'normal').toLowerCase();
  event.waitUntil((async()=>{
    const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
    if(windows.some(client=>client.focused))return;
    await self.registration.showNotification(data.title||'DominionStar',{
      body:data.body||'',
      icon:'/assets/logo.jpeg',
      badge:'/assets/logo.jpeg',
      tag:data.tag||'dominionstar',
      renotify:['high','critical'].includes(priority),
      requireInteraction:priority==='critical',
      data:{actionUrl:safeActionUrl(data.action_url||'/notifications/')}
    });
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=safeActionUrl(event.notification.data?.actionUrl||'/notifications/');
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){if('focus'in c){c.navigate(url);return c.focus()}}
    return clients.openWindow(url);
  }));
});
