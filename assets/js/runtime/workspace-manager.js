(()=>{
'use strict';
class DominionWorkspaceManager{
  constructor(){this.items=new Map();this.z=300;}
  register(id,element,options={}){if(!element)return;const record={id,element,options};this.items.set(id,record);element.addEventListener('pointerdown',()=>this.focus(id),{passive:true});return record;}
  focus(id){const item=this.items.get(id);if(!item)return;item.element.style.zIndex=String(++this.z);window.DominionRuntime?.events?.emit('workspace.window.focused',{id});}
  open(id){const item=this.items.get(id);if(!item)return;item.element.classList.remove('member-hidden');this.focus(id);window.DominionRuntime?.events?.emit('workspace.window.opened',{id});}
  close(id){const item=this.items.get(id);if(!item)return;item.element.classList.add('member-hidden');window.DominionRuntime?.events?.emit('workspace.window.closed',{id});}
  persist(id,data){localStorage.setItem(`ds-workspace-${id}`,JSON.stringify(data));}
  restore(id){try{return JSON.parse(localStorage.getItem(`ds-workspace-${id}`)||'null')}catch(_){return null}}
}
window.DominionRuntime=window.DominionRuntime||{};
window.DominionRuntime.workspace=window.DominionRuntime.workspace||new DominionWorkspaceManager();
})();
