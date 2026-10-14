import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../ui/webrtc-controller.js',import.meta.url),'utf8');
const extract=(start,end)=>{
  const a=src.indexOf(start),b=src.indexOf(end,a);
  assert.ok(a>=0&&b>a,'Expected WebRTC function is missing: '+start);
  return src.slice(a,b);
};

async function testNegotiationDeduplication(){
  const part=extract('  async function initiate(record,iceRestart=false){','  async function flushIce(record){');
  const state={running:true,peers:new Map()};
  const events={send:0,offer:0,sync:0,reconnect:0};
  let release;const pending=new Promise(resolve=>{release=resolve});
  const pc={signalingState:'stable',localDescription:null,
    async createOffer(){events.offer++;return {type:'offer',sdp:'synthetic'}},
    async setLocalDescription(description){this.localDescription=description;this.signalingState='have-local-offer'}};
  const record={id:'guest',pc,makingOffer:false,negotiationStarted:false,offerPending:false,offersSent:0,answersApplied:0};
  state.peers.set(record.id,record);
  const initiate=new Function('state','prepareOfferer','syncLocalTracks','meeting','scheduleReconnect','RECONNECT_MS',
    part+'\nreturn initiate')(state,()=>{},async()=>{events.sync++;await pending},
    {sendSignal:async()=>{events.send++;return {ok:true}}},()=>events.reconnect++,1800);
  const first=initiate(record),overlap=initiate(record);
  assert.equal(record.makingOffer,true,'guard must engage before awaited track work');
  release();
  assert.deepEqual(await Promise.all([first,overlap]),[true,false],'concurrent offers must deduplicate');
  assert.equal(events.send,1,'one offer only for initial peer connection');
  assert.equal(events.offer,1);
  pc.signalingState='stable';record.offerPending=false;
  assert.equal(await initiate(record),false,'connected or connecting peer must not auto-offer on refresh');
  assert.equal(events.send,1);
  assert.equal(await initiate(record,true),true,'explicit ICE restart must be supported');
  assert.equal(events.send,2);
  assert.equal(events.reconnect,0);
}
async function testSingleMeetingStartup(){
  const part=extract('  async function start(){','  async function stop(){');
  const harness=()=>{
    let release,contexts=0,timers=0,listeners=0;
    const gate=new Promise(resolve=>release=resolve);
    const state={running:false,starting:false,startAttempt:0,nextStartAttemptAt:0,generation:0,timers:{}};
    const meeting={context:async()=>{contexts++;await gate;return {roomId:'r',participantId:'p',state:'joined'}}};
    const off=()=>{listeners++;return ()=>{}};
    const window={DominionMediaController:{onChange:off},DominionShareController:{onChange:off},DominionVideoEffects:{onChange:off}};
    const desktop={power:{onChanged:off}};
    const start=new Function('state','meeting','q','ensureUi','setTransportStatus','loadIceConfig','window','desktop','navigator',
      'touchPresence','reconcileParticipants','pullSignals','setInterval','syncAllSenders','handlePowerEvent','sampleSpeakers',
      'sampleTransports','POLL_MS','SNAPSHOT_MS','SPEAKER_MS','ICE_RETRY_MS',part+'\nreturn start')
      (state,meeting,()=>({hidden:false}),()=>{},()=>{},async()=>{},window,desktop,{onLine:true},
        async()=>{},async()=>{},async()=>{},()=>++timers,()=>{},()=>{},()=>{},()=>{},350,900,350,30000);
    return {state,start,release,measure:()=>({contexts,timers,listeners})};
  };
  const a=harness();const p1=a.start(),p2=a.start();assert.equal(a.measure().contexts,1);
  a.release();await Promise.all([p1,p2]);
  assert.equal(a.measure().timers,4,'must install one set of timers');
  assert.equal(a.measure().listeners,4,'must install one set of listeners');
  assert.equal(a.state.running,true);
  const b=harness(),pending=b.start();
  b.state.startAttempt++;b.release();await pending;
  assert.equal(b.state.running,false,'room exit cancels delayed initialization');
  assert.equal(b.measure().timers,0,'cancelled startup must not install timers');
  assert.equal(b.measure().listeners,0,'cancelled startup must not install listeners');
}
function testSafeRecovery(){
  assert.ok(src.includes("if(status==='failed'){showRecovery();"),'intentional peer close must not schedule reconnect');
  assert.ok(src.includes("record.pc.onconnectionstatechange=null;record.pc.close()"),'closing peer must release connection callbacks');
  assert.ok(src.includes("if(needsRecovery)void recoverNetwork();"),'window focus alone cannot restart healthy ICE');
  assert.ok(src.includes('outbound:await laneStats(lane.sender'), 'diagnostic must isolate screen sender lane');
  assert.ok(src.includes('inbound:await laneStats(lane.receiver'), 'diagnostic must isolate screen receiver lane');
}
await testNegotiationDeduplication();
await testSingleMeetingStartup();
testSafeRecovery();
console.log('PASS peer negotiation deduplication, startup lifecycle, recovery and RTP-lane diagnostics (mock only)');
