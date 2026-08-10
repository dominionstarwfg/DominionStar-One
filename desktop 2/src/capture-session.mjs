const DEFAULT_SELECTION_TTL_MS = 30_000;

export class CaptureSession {
  constructor({selectionTtlMs=DEFAULT_SELECTION_TTL_MS,now=()=>Date.now()}={}) {
    this.selectionTtlMs=selectionTtlMs;
    this.now=now;
    this.pending=new Map();
    this.active={displayId:'',kind:'',sourceId:''};
    this.lastFailure='';
  }

  select(contentsId,selection={}) {
    const sourceId=String(selection.sourceId||'');
    const kind=String(selection.kind||'');
    if(!Number.isInteger(contentsId)||contentsId<1)return false;
    if(!/^(screen|window):/.test(sourceId)||!['screen','window'].includes(kind))return false;
    this.pending.set(contentsId,{
      sourceId,
      sourceName:String(selection.sourceName||'').slice(0,240),
      displayId:String(selection.displayId||''),
      audio:Boolean(selection.audio),
      shareOwnWindow:Boolean(selection.shareOwnWindow),
      kind,
      selectedAt:this.now()
    });
    this.lastFailure='';
    return true;
  }

  consume(contentsId) {
    const selection=this.pending.get(contentsId);
    this.pending.delete(contentsId);
    if(!selection){this.lastFailure='selection-missing';return null;}
    if(this.now()-selection.selectedAt>this.selectionTtlMs){this.lastFailure='selection-expired';return null;}
    return selection;
  }

  activate(source,selection) {
    this.active={
      sourceId:String(source?.id||selection?.sourceId||''),
      displayId:String(source?.display_id||selection?.displayId||''),
      kind:selection?.kind==='screen'?'screen':'window'
    };
    this.lastFailure='';
    return {...this.active};
  }

  fail(reason) {
    this.lastFailure=String(reason||'capture-handler-failed').slice(0,180);
  }

  end() {
    this.active={displayId:'',kind:'',sourceId:''};
  }

  clear(contentsId) {
    if(Number.isInteger(contentsId))this.pending.delete(contentsId);
    else this.pending.clear();
  }
}
