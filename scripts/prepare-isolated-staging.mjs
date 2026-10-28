// Build-time staging isolation: static files only, NO deployment action.
// Never call this against the production site or with production Supabase URLs.
import {readFileSync,writeFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const PRODUCTION_SUPABASE_REF='ckmurvhjumzlhsegncba';
const PRODUCTION_HOST='dominionstarld.com';
const SUPABASE_HOST='supabase.co';
const isText=file=>/\.(html|js|json|css|xml|txt|webmanifest|svg)$/i.test(file)||/_redirects$|_headers$/.test(file);
function allTextFiles(dir){
 const out=[];
 const visit=folder=>{
   for(const file of readdirSync(folder,{withFileTypes:true})){
     const absolute=join(folder,file.name);
     if(file.isDirectory())visit(absolute);
     else if(file.isFile()&&isText(file.name))out.push(absolute);
   }
 };
 visit(dir);return out;
}
const ensure=(condition,message)=>{if(!condition)throw new Error('STAGING BLOCKED: '+message)};
const onlyText=value=>String(value||'').trim();

export function stageReviewPackage({env=process.env,dist=resolve('public-dist'),rehearsal=false}={}){
 const stagingId=onlyText(env.DOMINIONSTAR_STAGING_NETLIFY_SITE_ID);
 const productionId=onlyText(env.DOMINIONSTAR_PRODUCTION_NETLIFY_SITE_ID);
 const siteUrl=onlyText(env.DOMINIONSTAR_STAGING_SITE_URL);
 const apiUrl=onlyText(env.DOMINIONSTAR_STAGING_SUPABASE_URL);
 const key=onlyText(env.DOMINIONSTAR_STAGING_SUPABASE_PUBLISHABLE_KEY);
 ensure(stagingId&&productionId&&stagingId!==productionId,'A distinct production and staging Netlify site ID are required');
 if(!rehearsal){
   ensure(env.DOMINIONSTAR_STAGING_ISOLATION_APPROVED==='STAGING_ONLY','Explicit staging-only build approval variable not present');
   ensure((env.NETLIFY_SITE_ID||env.SITE_ID)===stagingId,'Current Netlify site ID must equal isolated staging site');
 }
 let site,api;
 try{site=new URL(siteUrl);api=new URL(apiUrl)}catch{throw new Error('STAGING BLOCKED: Valid staging URLs are required')}
 ensure(site.protocol==='https:' && !site.username&&!site.password,'Staging website must use HTTPS');
 ensure(site.hostname!==PRODUCTION_HOST&&!site.hostname.endsWith('.'+PRODUCTION_HOST),'Refusing a production-domain site');
 ensure(site.hostname.endsWith('.netlify.app')||site.hostname.endsWith('.netlify.com'),'Use a separate Netlify staging hostname');
 ensure(api.protocol==='https:'&&!api.username&&!api.password,'Staging Supabase must use HTTPS');
 ensure(api.hostname.endsWith('.'+SUPABASE_HOST),'Expected a Supabase project hostname');
 const ref=api.hostname.slice(0,-('.'+SUPABASE_HOST).length);
 ensure(/^[a-z0-9]{20}$/.test(ref),'Supabase project reference format is invalid');
 ensure(ref!==PRODUCTION_SUPABASE_REF,'Staging cannot point at the production Supabase project');
 ensure(/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(key),'Supply a separate publishable Supabase key (never a service-role key)');
 ensure(existsSync(dist)&&statSync(dist).isDirectory(),'Staging static package missing');
 const configPath=join(dist,'assets/js/supabase-config.js');
 const browserPath=join(dist,'meet/browser-bridge.js');
 ensure(existsSync(configPath)&&existsSync(browserPath),'Both Agent and browser Meet client configs are required');
 const old=readFileSync(configPath,'utf8');
 const productionKey=old.match(/anonKey:\s*["']([^"']+)["']/)?.[1];
 ensure(old.includes('https://'+PRODUCTION_SUPABASE_REF+'.supabase.co')&&productionKey,'Unexpected source Supabase configuration');
 const browser=readFileSync(browserPath,'utf8');
 ensure(browser.includes('https://'+PRODUCTION_SUPABASE_REF+'.supabase.co')&&browser.includes(productionKey),'Browser Meet uses an unexpected backend; review it before staging');
 // First prepare all replacements in memory; do not write if any other file retains
 // a production project ID or publishable key.
 const replacements=new Map();
 replacements.set(configPath,'window.DOMINIONSTAR_SUPABASE = '+JSON.stringify({url:api.origin,anonKey:key})+';\n');
 replacements.set(browserPath,browser
   .replace('https://'+PRODUCTION_SUPABASE_REF+'.supabase.co',api.origin)
   .replace(productionKey,key));
 const files=allTextFiles(dist);
 for(const file of files){
   const content=replacements.get(file)??readFileSync(file,'utf8');
   ensure(!content.includes(PRODUCTION_SUPABASE_REF),'Production Supabase project reference remains in '+file.slice(dist.length+1));
   ensure(!content.includes(productionKey),'Production client key remains in '+file.slice(dist.length+1));
 }
 // Prevent search indexing of preview routes, including sensitive member UI.
 const headersPath=join(dist,'_headers');
 const currentHeaders=readFileSync(headersPath,'utf8');
 replacements.set(headersPath,'/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n  Cache-Control: no-store\n\n'+currentHeaders);
 replacements.set(join(dist,'robots.txt'),'User-agent: *\nDisallow: /\n');
 for(const [file,contents] of replacements)writeFileSync(file,contents,'utf8');
 const revised=allTextFiles(dist);
 for(const file of revised){
   const content=readFileSync(file,'utf8');
   ensure(!content.includes(PRODUCTION_SUPABASE_REF),'Production Supabase reference survived staging rewrite');
 }
 return {isolated:true,site:site.origin,backend:api.origin,filesChecked:revised.length,mode:rehearsal?'rehearsal':'staging'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=stageReviewPackage();
 // Never log any API credentials.
 console.log('DOMINIONSTAR_ISOLATED_STAGING_PACKAGE_OK');
 console.log('Staging host: '+result.site+'; backend: '+result.backend);
 console.log('Verified static files: '+result.filesChecked);
}
