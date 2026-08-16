const json=(statusCode,body)=>({statusCode,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify(body)});
export async function handler(event){
  if(event.httpMethod!=='POST')return json(405,{error:'method_not_allowed'});
  let input;try{input=JSON.parse(event.body||'{}');}catch{return json(400,{error:'invalid_json'});}
  const segments=Array.isArray(input.segments)?input.segments.slice(-250):[];
  if(!segments.length)return json(400,{error:'transcript_required'});
  const apiKey=process.env.OPENAI_API_KEY;if(!apiKey)return json(503,{error:'ai_not_configured'});
  const transcript=segments.map(x=>`[${new Date(Number(x.startedAt)||Date.now()).toISOString()}] ${String(x.displayName||'Speaker').slice(0,80)}: ${String(x.text||'').slice(0,1200)}`).join('\n').slice(-90000);
  const prompt=`Create a concise executive meeting catch-up. Use only the transcript. Return plain text with exactly these headings: EXECUTIVE SUMMARY, KEY DECISIONS, ACTION ITEMS, OPEN QUESTIONS. For action items include owner and deadline only when stated; otherwise say Unassigned or Not stated.\n\n${transcript}`;
  try{const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:process.env.MEET_INTELLIGENCE_MODEL||'gpt-5-mini',input:prompt,max_output_tokens:1200})});if(!response.ok)return json(502,{error:'ai_request_failed'});const data=await response.json();const summary=data.output_text||data.output?.flatMap(x=>x.content||[]).map(x=>x.text||'').join('')||'';return json(200,{summary,segmentCount:segments.length});}catch{return json(502,{error:'ai_unavailable'});}
}
