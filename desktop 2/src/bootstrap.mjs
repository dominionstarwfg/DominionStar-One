import { app, BrowserWindow, Menu, MenuItem } from 'electron';

let quitting=false;
function destroyDesktopWindows(){for(const win of BrowserWindow.getAllWindows()){if(!win.isDestroyed()){try{win.destroy();}catch{}}}}
function ensureMacQuitCommand(){
  if(process.platform!=='darwin')return;const menu=Menu.getApplicationMenu();const appMenu=menu?.items?.[0]?.submenu;if(!appMenu||appMenu.items.some(item=>item.role==='quit'))return;
  appMenu.append(new MenuItem({type:'separator'}));appMenu.append(new MenuItem({role:'quit',label:`Quit ${app.name||'DominionStar Meet'}`,accelerator:'Command+Q'}));
}
app.on('before-quit',()=>{if(quitting)return;quitting=true;destroyDesktopWindows();});

// Single-owner desktop foundation:
// - main-v2 owns display-media request routing;
// - meet-home/desktop.html + desktop-home-controller.js own Home and Settings;
// - no post-load Home injector or second macOS display-media handler may
//   overwrite those authorities.
await import('./screen-permission-lifecycle.mjs');
await import('./desktop-navigation-authority.mjs');
await import('./main-v2.mjs');
await import('./macos-native-capture-authority.mjs');
await import('./presenter-dock.mjs');
await import('./presenter-command-parity.mjs');
await import('./share-lifecycle.mjs');
await import('./remote-control-dialog.mjs');
await import('./slide-control-native.mjs');

app.whenReady().then(()=>setImmediate(ensureMacQuitCommand)).catch(()=>{});