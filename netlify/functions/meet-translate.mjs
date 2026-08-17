const json=(status,body)=>({statusCode:status,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify(body)});
const cleanLang=value=>{const v=String(value||'').toLowerCase();if(v.startsWith('fr'))return'fr';if(v.startsWith('es'))return'es';if(v.startsWith('zh'))return'zh';return'en';};

export async function handler(event){
  if(event.httpMethod==='GET'){
    const providers=[];
    if(process.env.DEEPL_API_KEY)providers.push('deepl');
    if(process.env.GOOGLE_TRANSLATE_API_KEY)providers.push('google');
    return json(200,{available:providers.length>0,providers});
  }
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  let body={};try{body=JSON.parse(event.body||'{}');}catch{return json(400,{error:'Invalid JSON'});}
  const text=String(body.text||'').trim().slice(0,5000);
  const source=cleanLang(body.source);
  const target=cleanLang(body.target);
  if(!text)return json(400,{error:'Text is required'});
  if(source===target)return json(200,{translation:text,provider:'identity'});

  const deeplKey=process.env.DEEPL_API_KEY||'';
  if(deeplKey){
    try{
      const endpoint=deeplKey.endsWith(':fx')?'https://api-free.deepl.com/v2/translate':'https://api.deepl.com/v2/translate';
      const params=new URLSearchParams({text,source_lang:source==='zh'?'ZH':source.toUpperCase(),target_lang:target==='en'?'EN-US':target==='zh'?'ZH':target.toUpperCase()});
      const response=await fetch(endpoint,{method:'POST',headers:{authorization:`DeepL-Auth-Key ${deeplKey}`,'content-type':'application/x-www-form-urlencoded'},body:params});
      if(response.ok){const data=await response.json();const translation=data?.translations?.[0]?.text;if(translation)return json(200,{translation,provider:'deepl'});}
    }catch(_){/* try next provider */}
  }

  const googleKey=process.env.GOOGLE_TRANSLATE_API_KEY||'';
  if(googleKey){
    try{
      const response=await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(googleKey)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({q:text,source,target,format:'text'})});
      if(response.ok){const data=await response.json();const translation=data?.data?.translations?.[0]?.translatedText;if(translation)return json(200,{translation,provider:'google'});}
    }catch(_){/* no configured provider succeeded */}
  }

  return json(503,{error:'Translation provider unavailable',hint:'Configure DEEPL_API_KEY or GOOGLE_TRANSLATE_API_KEY, or use a browser with the Translator API.'});
}
