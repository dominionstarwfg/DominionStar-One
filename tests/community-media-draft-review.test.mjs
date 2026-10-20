import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const script=read('assets/js/community-media-draft-review.js');
const html=read('community/index.html');
const css=read('assets/css/community-media-draft-review.css');
const fakeWindow={};
const fakeDocument={getElementById:()=>null};
vm.runInNewContext(script,{window:fakeWindow,document:fakeDocument,Uint8Array});
const api=fakeWindow.DSCommunityMediaDraft;
const make=(name,type,bytes,magic)=>({
 name,type,size:bytes,
 slice(){return {arrayBuffer:async()=>Uint8Array.from(magic).buffer};}
});
const jpg=[255,216,255,224,0,0,0,0];
const png=[137,80,78,71,13,10,26,10];
const pdf=[37,80,68,70,45,49,46,52];
const webp=[82,73,70,70,0,0,0,0,87,69,66,80,0,0,0,0];
const webm=[26,69,223,163,0,0,0,0];
const mp4=[0,0,0,20,102,116,121,112,105,115,111,109,0,0,0,0];

test('Valid photos and flyers pass local byte-signature validation',async()=>{
 for(const [name,type,data] of [
   ['portrait.jpg','image/jpeg',jpg],
   ['portrait.png','image/png',png],
   ['portrait.webp','image/webp',webp],
   ['campaign.pdf','application/pdf',pdf],
   ['update.webm','video/webm',webm],
   ['update.mp4','video/mp4',mp4]
 ]){
   const result=await api.validateSignature(make(name,type,4096,data));
   assert.equal(result.ok,true,'Expected supported '+name);
 }
});

test('Spoofed and unsafe inputs fail before any network operation',async()=>{
 for(const f of [
   make('fake.jpg','image/jpeg',4096,pdf),
   make('fake.png','image/jpeg',4096,jpg),
   make('vector.svg','image/svg+xml',4096,png),
   make('empty.jpg','image/jpeg',0,jpg),
   make('large.mp4','video/mp4',81*1024*1024,mp4),
   make('script.html','text/html',1024,jpg)
 ]){
   assert.equal((await api.validateSignature(f)).ok,false,f.name+' should be rejected');
 }
});

test('Local draft has strict caps and cannot publish attachments accidentally',()=>{
 assert.equal(api.MAX_ITEMS,4);
 assert.equal(api.MAX_TOTAL,100*1024*1024);
 assert.match(script,/publish\.disabled=blocked/);
 assert.match(script,/event\.stopImmediatePropagation\(\)/);
 assert.match(script,/URL\.revokeObjectURL/);
 assert.match(script,/window\.addEventListener\('pagehide'/);
 assert.doesNotMatch(script,/\.storage\.from\(|fetch\(|\.upload\(/);
 assert.match(script,/Draft only — attachments have NOT been uploaded/);
 assert.match(script,/if\(form && root\)mount/);
});

test('Review composer UI has accessible draft pickers, clear warning, and isolated CSS',()=>{
 for(const kind of ['photo','flyer','video']){
   assert.ok(html.includes('data-draft-picker="'+kind+'"'));
 }
 assert.match(html,/id="communityMediaDraft"/);
 assert.match(html,/data-draft-file-input/);
 assert.match(html,/data-draft-tray aria-live="polite"/);
 assert.match(html,/role="status" aria-live="polite"/);
 assert.match(html,/community-media-draft-review\.css/);
 assert.match(html,/community-media-draft-review\.js/);
 assert.match(css,/\.dsmedia-file-card/);
 assert.match(css,/@media\(max-width:640px\)/);
});


test('Async file inspection blocks publishing until validation completes',()=>{
 assert.match(script,/validationInProgress=true/);
 assert.match(script,/validationInProgress=false/);
 assert.match(script,/const blocked=hasFiles\|\|validationInProgress/);
 assert.match(script,/publish\.disabled=blocked/);
 assert.match(script,/if\(!entries\.length&&!validationInProgress\)return/);
 assert.match(script,/event\.stopImmediatePropagation\(\)/);
});

test('Concurrent media checks cannot interleave file picker selections',()=>{
 assert.match(script,/if\(validationInProgress\)return/);
 assert.match(script,/picker.disabled=validationInProgress/);
});
