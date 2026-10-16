// Simulated request-level regression for the exact TURN broker source.
// No network access, no secrets, and no production deployment.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../../supabase/functions/meet-v2-turn-credentials/index.ts',import.meta.url),'utf8');
assert.match(source,/Deno\.serve\(async\(req:Request\)=>/);
assert.match(source,/meeting_access_required/);
assert.match(source,/if\(!auth\.startsWith\("Bearer "\)\)/);
assert.match(source,/CLOUDFLARE_TURN_API_TOKEN/);
assert.match(source,/ALLOWED_ORIGINS/);
assert.ok(source.indexOf('if(req.method==="OPTIONS")')<source.indexOf('const auth=req.headers.get("authorization")'),'CORS preflight must precede auth');
const code=source
  .replace(/^import "jsr:[^\n]+\n/gm,'')
  .replaceAll('(req:Request)','(req)')
  .replaceAll('):Record<string,string>',')')
  .replaceAll('const headers:Record<string,string>','const headers')
  .replaceAll('(status:number,body:unknown)','(status,body)')
  .replaceAll('let body:any','let body')
  .replaceAll('(server:any)','(server)')
  .replaceAll('const clean:any','const clean')
  .replaceAll('(url:string)','(url)');
class FakeResponse {
  constructor(body,{status,headers}){this.status=status;this.body=body;this.headers=headers;}
}
let handler,networkCalls=0;
new Function('Deno','Response','fetch',code)(
  {serve:callback=>{handler=callback},env:{get:()=>''}},
  FakeResponse,
  async()=>{networkCalls++;throw Error('Unexpected network access');}
);
assert.equal(typeof handler,'function');
const req=(method,origin)=>({
  method,
  headers:{get:key=>key==='origin'?origin:null},
  json:async()=>({})
});
const allowed='https://dominionstarld.com';
const www='https://www.dominionstarld.com';
const preflight=await handler(req('OPTIONS',allowed));
assert.equal(preflight.status,204);
assert.equal(preflight.headers['access-control-allow-origin'],allowed);
assert.match(preflight.headers['access-control-allow-methods'],/POST/);
assert.match(preflight.headers['access-control-allow-headers'],/authorization/);
assert.equal((await handler(req('OPTIONS',www))).status,204);
const rejected=await handler(req('OPTIONS','https://untrusted.invalid'));
assert.equal(rejected.status,403);
assert.equal(rejected.headers['access-control-allow-origin'],undefined);
assert.equal((await handler(req('POST',allowed))).status,401);
assert.equal((await handler(req('GET',allowed))).status,405);
assert.equal(networkCalls,0);
console.log('PASS allowed/disallowed preflight and unchanged POST auth checks (isolated simulation)');
