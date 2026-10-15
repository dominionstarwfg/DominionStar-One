(()=>{
  'use strict';
  if(window.DominionCompanionRTC)return;
  // Local in-app WebRTC transport between main meeting and macOS video companion.
  // The Electron main process forwards only SDP and ICE signaling. Camera and
  // remote participant tracks remain MediaStreamTracks, never JPEG IPC snapshots.
  const create=(bridge,{role,onTrack=()=>{},onClose=()=>{},onReady=()=>{},onError=()=>{}}={})=>{
    const peers=new Map(),earlyIce=new Map();
    let closed=false,serial=0,epoch=0;
    const send=payload=>{if(closed)return;try{bridge?.videoSignal?.(payload);}catch(error){onError(error);}};
    const remove=(id,notify=false)=>{
      const key=String(id||''),record=peers.get(key);if(!record)return;
      peers.delete(key);
      if(role==='receiver')onClose(key);
      try{record.pc.onicecandidate=null;record.pc.onconnectionstatechange=null;record.pc.ontrack=null;record.pc.close();}catch{}
      if(notify)send({type:'close',participantId:key});
    };
    const reset=(notify=false)=>{
      epoch++;
      earlyIce.clear();
      for(const id of [...peers.keys()])remove(id);
      if(notify)send({type:'reset'});
    };
    const makePeer=id=>{
      const pc=new RTCPeerConnection({iceServers:[]}),generation=++serial;
      const record={id,pc,generation,sender:null,track:null,ready:false,candidates:[],makingOffer:false};
      peers.set(id,record);
      const early=earlyIce.get(id)||[];earlyIce.delete(id);
      record.candidates.push(...early);
      pc.onicecandidate=event=>{if(peers.get(id)!==record||!event.candidate)return;
        send({type:'ice',participantId:id,candidate:event.candidate.toJSON?.()||event.candidate});
      };
      pc.onconnectionstatechange=()=>{
        if(peers.get(id)!==record)return;
        if(pc.connectionState==='failed'){remove(id,true);onError(new Error('companion_video_ice_failed'));}
      };
      return record;
    };
    const addCandidate=async(record,candidate)=>{
      if(!record.pc.remoteDescription){record.candidates.push(candidate);return;}
      try{await record.pc.addIceCandidate(candidate);}catch(error){onError(error);}
    };
    const flush=async record=>{
      const pending=record.candidates.splice(0);
      for(const candidate of pending)await addCandidate(record,candidate);
    };
    const handle=async message=>{
      if(closed||!message||typeof message!=='object')return;
      const type=String(message.type||''),id=String(message.participantId||'');
      if(type==='hello'&&role==='sender'){reset(false);onReady();return;}
      if(type==='reset'){reset(false);return;}
      if(!id||id.length>128)return;
      if(type==='close'){remove(id);return;}
      if(type==='ice'){
        const record=peers.get(id);
        if(record&&message.candidate)await addCandidate(record,message.candidate);
        else if(message.candidate){
          const pending=earlyIce.get(id)||[];
          if(pending.length<32)pending.push(message.candidate);
          earlyIce.set(id,pending);
        }
        return;
      }
      if(type==='offer'&&role==='receiver'){
        remove(id);
        const record=makePeer(id);
        record.pc.ontrack=event=>{
          if(peers.get(id)!==record||event.track.kind!=='video')return;
          const stream=event.streams?.[0]||new MediaStream([event.track]);
          onTrack(id,stream,event.track);
        };
        try{
          await record.pc.setRemoteDescription(message.description);
          await flush(record);
          const answer=await record.pc.createAnswer();
          await record.pc.setLocalDescription(answer);
          if(peers.get(id)!==record||closed)return;
          send({type:'answer',participantId:id,description:record.pc.localDescription});
        }catch(error){remove(id,true);onError(error);}
        return;
      }
      if(type==='answer'&&role==='sender'){
        const record=peers.get(id);
        if(!record||!record.makingOffer||record.pc.signalingState!=='have-local-offer')return;
        try{await record.pc.setRemoteDescription(message.description);if(peers.get(id)!==record||closed)return;record.ready=true;record.makingOffer=false;await flush(record);}
        catch(error){remove(id,true);onError(error);}
      }
    };
    const unsubscribe=bridge?.onVideoSignal?.(message=>void handle(message).catch(onError))||(()=>{});
    let syncFlight=Promise.resolve();
    const sync=entries=>{
      if(closed||role!=='sender')return syncFlight;
      // Serialize observation and transceiver mutations across rapid roster updates.
      const requestedEpoch=epoch;
      const next=syncFlight.catch(()=>{}).then(async()=>{
        if(closed||requestedEpoch!==epoch)return;
      const current=new Map((Array.isArray(entries)?entries:[])
        .filter(entry=>entry?.id&&entry.track?.kind==='video'&&entry.track.readyState==='live'&&entry.track.enabled!==false)
        .map(entry=>[String(entry.id),entry.track]));
      for(const id of [...peers.keys()])if(!current.has(id))remove(id,true);
      for(const [id,track] of current){
        if(closed||requestedEpoch!==epoch)return;
        let record=peers.get(id);
        if(!record){
          record=makePeer(id);
          try{
            const transceiver=record.pc.addTransceiver(track,{direction:'sendonly',streams:[new MediaStream([track])]});
            record.sender=transceiver.sender;record.track=track;record.makingOffer=true;
            const offer=await record.pc.createOffer();
            if(peers.get(id)!==record||closed||requestedEpoch!==epoch)continue;
            await record.pc.setLocalDescription(offer);
            if(peers.get(id)!==record||closed||requestedEpoch!==epoch)continue;
            send({type:'offer',participantId:id,description:record.pc.localDescription});
          }catch(error){remove(id,true);onError(error);}
        }else if(record.track!==track&&record.sender){
          try{await record.sender.replaceTrack(track);record.track=track;}
          catch(error){remove(id,true);onError(error);}
        }
      }
      });
      syncFlight=next;return next;
    };
    if(role==='receiver')send({type:'hello'});
    return Object.freeze({sync,clear:()=>reset(role==='sender'),stop:()=>{if(closed)return;reset(role==='sender');closed=true;unsubscribe();},
      snapshot:()=>({role,peerCount:peers.size,peerStates:[...peers.values()].map(record=>({id:record.id,connectionState:record.pc.connectionState,ready:record.ready}))})});
  };
  window.DominionCompanionRTC=Object.freeze({createSender:(bridge,options)=>create(bridge,{...options,role:'sender'}),
    createReceiver:(bridge,options)=>create(bridge,{...options,role:'receiver'})});
})();
