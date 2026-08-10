const normalizedName=value=>String(value||'').trim().toLowerCase();

export function resolveCaptureSource(sources=[],selection={}) {
  const list=Array.isArray(sources)?sources:[];
  return list.find(item=>item.id===selection.sourceId)
    ||(selection.kind==='screen'&&selection.displayId
      ?list.find(item=>String(item.id||'').startsWith('screen:')&&String(item.display_id||'')===String(selection.displayId))
      :null)
    ||(selection.kind==='window'&&selection.sourceName
      ?list.find(item=>String(item.id||'').startsWith('window:')&&normalizedName(item.name)===normalizedName(selection.sourceName))
      :null)
    ||null;
}
