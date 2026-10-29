const safeActionUrl=value=>{const candidate=String(value||'');if(!candidate.startsWith('/')||candidate.startsWith('//')||candidate.includes('\\\\'))return '/notifications/';return candidate;};
self.addEventListener('push',event=>{
  let data={}; try{data=event.data?.json()||{}}catch{data={body:event.data?.text()||''}}
  const priority=String(data.priority||'normal').toLowerCase();
  event.waitUntil(self.registration.showNotification(data.title||'DominionStar',{
    body:data.body||'',
    icon:'/assets/logo.jpeg',
    badge:'/assets/logo.jpeg',
    tag:data.tag||'dominionstar',
    renotify:['high','critical'].includes(priority),
    requireInteraction:priority==='critical',
    data:{actionUrl:safeActionUrl(data.action_url||'/notifications/')}
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=safeActionUrl(event.notification.data?.actionUrl||'/notifications/');
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){if('focus'in c){c.navigate(url);return c.focus()}}
    return clients.openWindow(url);
  }));
});
