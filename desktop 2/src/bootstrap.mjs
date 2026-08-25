import { app, BrowserWindow, Menu, MenuItem } from 'electron';

let quitting=false;
function destroyDesktopWindows(){for(const win of BrowserWindow.getAllWindows()){if(!win.isDestroyed()){try{win.destroy();}catch{}}}}
function ensureMacQuitCommand(){
  if(process.platform!=='darwin')return;const menu=Menu.getApplicationMenu();const appMenu=menu?.items?.[0]?.submenu;if(!appMenu||appMenu.items.some(item=>item.role==='quit'))return;
  appMenu.append(new MenuItem({type:'separator'}));appMenu.append(new MenuItem({role:'quit',label:`Quit ${app.name||'DominionStar Meet'}`,accelerator:'Command+Q'}));
}
app.on('before-quit',()=>{if(quitting)return;quitting=true;destroyDesktopWindows();});

// Native permission status is registered before the first BrowserWindow. Modern
// macOS capture is handed to the OS system picker after main-v2 installs the
// session policy; older platforms retain DominionStar's custom picker fallback.
await import('./screen-permission-lifecycle.mjs');
await import('./desktop-navigation-authority.mjs');
await import('./main-v2.mjs');
await import('./macos-native-capture-authority.mjs');
await import('./macos-system-picker-session.mjs');
await import('./desktop-home-injection.mjs');
await import('./presenter-dock.mjs');
await import('./presenter-command-parity.mjs');
await import('./share-lifecycle.mjs');
await import('./remote-control-dialog.mjs');
await import('./slide-control-native.mjs');

app.whenReady().then(()=>setImmediate(ensureMacQuitCommand)).catch(()=>{});