import fs from 'node:fs';

const engine=fs.readFileSync(new URL('../assets/js/meeting-engine.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../assets/js/meet-next/executive6.js',import.meta.url),'utf8');

const admissionLine=engine.match(/const ADMISSION_REQUIRED_EVENTS=new Set\(\[([^\]]*)\]\)/)?.[1]||'';
for(const event of ['meet-offer','meet-answer','meet-ice','meet-speaking-state','meet-media-state','meet-media-resync-request','meet-screen-state','meet-ended']){
  if(admissionLine.includes(event))throw new Error(`${event} was put back behind stale remote-admission state.`);
}

for(const branch of ['meet-offer','meet-answer','meet-ice','meet-media-resync-request']){
  const start=engine.indexOf(`event === '${branch}'`);
  const end=engine.indexOf("event === '",start+12);
  const body=engine.slice(start,end>start?end:start+1400);
  if(/remoteMeta\.get\(payload\.from\)\?\.admitted/.test(body))throw new Error(`${branch} still rejects a live peer using stale remote presence.`);
}

const endedStart=engine.indexOf("event === 'meet-ended'");
const endedBody=engine.slice(endedStart,endedStart+320);
if(/senderHost|senderPrivileged/.test(endedBody))throw new Error('End-for-everyone is still rejected by local host-role inference.');

if(!ui.includes("if(active) electActiveSpeaker(!wasActive,!wasActive?canonicalId:'')"))throw new Error('S35 equal active-speaker election was not restored.');
if(ui.includes('if(active&&state.isHost)'))throw new Error('Active-speaker election is still host-only.');

console.log('PASS S35 live speaker/media/end paths are restored outside stale remote-presence gates.');
