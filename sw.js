self.addEventListener('push',event=>{
  let data={}; try{data=event.data?.json()||{}}catch{data={body:event.data?.text()||''}}
  event.waitUntil(self.registration.showNotification(data.title||'DominionStar',{body:data.body||'',icon:'/assets/logo.jpeg',badge:'/assets/logo.jpeg',tag:data.tag||'dominionstar',data:{actionUrl:data.action_url||'/notifications/'}}));
});
self.addEventListener('notificationclick',event=>{event.notification.close(); const url=event.notification.data?.actionUrl||'/notifications/'; event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if('focus'in c){c.navigate(url);return c.focus()}}return clients.openWindow(url)}));});
