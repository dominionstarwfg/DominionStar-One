(()=>{
'use strict';
if(window.DominionHubs)return;
const q=s=>document.querySelector(s);
const DB_NAME='dominionstar-meet-local-assets',DB_VERSION=1,STORE='recordings';
let dbPromise=null,playerDialog=null,playerUrl='';
function db(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{const value=request.result;if(!value.objectStoreNames.contains(STORE)){const store=value.createObjectStore(STORE,{keyPath:'id',autoIncrement:true});store.createIndex('createdAt','createdAt');}};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('local_recording_store_unavailable'));
  });return dbPromise;
}
async function saveRecording(blob,{title='DominionStar Meeting',fileName='',createdAt=new Date().toISOString()}={}){
  if(!(blob instanceof Blob)||!blob.size)throw new Error('empty_recording');
  const value={title:String(title||'DominionStar Meeting'),fileName:String(fileName||'DominionStar-Meet.webm'),createdAt:String(createdAt||new Date().toISOString()),type:String(blob.type||'video/webm'),size:Number(blob.size)||0,blob};
  const database=await db();const id=await new Promise((resolve,reject)=>{const tx=database.transaction(STORE,'readwrite'),request=tx.objectStore(STORE).add(value);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  return {...value,id};
}
async function listRecordings(){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction(STORE,'readonly'),request=tx.objectStore(STORE).getAll();request.onsuccess=()=>resolve((request.result||[]).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))));request.onerror=()=>reject(request.error);});}
async function removeRecording(id){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction(STORE,'readwrite'),request=tx.objectStore(STORE).delete(Number(id));request.onsuccess=()=>resolve(true);request.onerror=()=>reject(request.error);});}
function bytes(value){const n=Number(value)||0;if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(1)+' MB'}
function when(value){try{return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}catch{return String(value||'')}}
function ensurePlayer(){
  if(playerDialog?.isConnected)return playerDialog;
  playerDialog=document.createElement('dialog');playerDialog.className='modal hubs-player-dialog';playerDialog.innerHTML='<form method="dialog"><header><div><p class="eyebrow">LOCAL RECORDING</p><h2 data-hubs-player-title>Recording</h2></div><button class="modal-close" value="cancel" aria-label="Close">×</button></header><video controls playsinline></video><div class="modal-actions"><button value="cancel" class="secondary-button">Close</button><a class="primary-button" data-hubs-download download>Download</a></div></form>';document.body.append(playerDialog);playerDialog.addEventListener('close',()=>{if(playerUrl)URL.revokeObjectURL(playerUrl);playerUrl='';const video=playerDialog.querySelector('video');video.pause();video.removeAttribute('src');});return playerDialog;
}
function play(item){const dialog=ensurePlayer(),video=dialog.querySelector('video'),link=dialog.querySelector('[data-hubs-download]');if(playerUrl)URL.revokeObjectURL(playerUrl);playerUrl=URL.createObjectURL(item.blob);dialog.querySelector('[data-hubs-player-title]').textContent=item.title||'Recording';video.src=playerUrl;link.href=playerUrl;link.download=item.fileName||'DominionStar-Meet.webm';if(!dialog.open)dialog.showModal();}
function download(item){const url=URL.createObjectURL(item.blob),a=document.createElement('a');a.href=url;a.download=item.fileName||'DominionStar-Meet.webm';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000)}
async function render(){
  const list=q('#hubsRecordingList'),count=q('#hubsRecordingCount');if(!list)return;
  let items=[];try{items=await listRecordings();}catch{list.innerHTML='<p class="hubs-empty">Local recording storage is unavailable.</p>';return}
  if(count)count.textContent=String(items.length);list.innerHTML='';
  if(!items.length){const empty=document.createElement('p');empty.className='hubs-empty';empty.textContent='No local recordings yet.';list.append(empty);return}
  for(const item of items){const row=document.createElement('article');row.className='hubs-recording-row';row.innerHTML='<span class="hubs-recording-icon">▶</span><div><strong></strong><small></small></div><div class="hubs-recording-actions"><button type="button" data-play>Play</button><button type="button" data-download>Download</button><button type="button" data-delete>Delete</button></div>';row.querySelector('strong').textContent=item.title||'DominionStar Meeting';row.querySelector('small').textContent=`${when(item.createdAt)} · ${bytes(item.size)}`;row.querySelector('[data-play]').onclick=()=>play(item);row.querySelector('[data-download]').onclick=()=>download(item);row.querySelector('[data-delete]').onclick=async()=>{if(!confirm('Delete this local recording?'))return;await removeRecording(item.id);void render();};list.append(row);}
}
function loadNotes(){const area=q('#hubsNotes');if(!area)return;try{area.value=localStorage.getItem('ds_my_notes')||'';}catch{}}
function saveNotes(){const area=q('#hubsNotes'),status=q('#hubsNotesStatus');if(!area)return;try{localStorage.setItem('ds_my_notes',area.value);if(status){status.textContent='Saved locally';setTimeout(()=>status.textContent='Local only',1600);}}catch{if(status)status.textContent='Could not save';}}
q('#hubsSaveNotes')?.addEventListener('click',saveNotes);
document.addEventListener('click',event=>{if(event.target?.closest?.('[data-section="hubs"]'))setTimeout(()=>{loadNotes();void render();},0);},true);
window.addEventListener('dominion:hubs-refresh',()=>void render());
loadNotes();void render();
window.DominionHubs=Object.freeze({version:'1.0.0-local-assets',saveRecording,listRecordings,deleteRecording:removeRecording,refresh:render});
})();