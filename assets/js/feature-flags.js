
(async()=>{const gate=document.getElementById('featureGate'),app=document.getElementById('featureApp'),list=document.getElementById('featureFlagList');
if(!window.DSAuth?.ready){gate.innerHTML='<h1>Authentication configuration is missing.</h1>';return;}
const supabase=await window.DSAuth.init();const {data:{session}}=await supabase.auth.getSession();if(!session){location.href='/member-login/';return;}
const permission=await supabase.rpc('is_dominionstar_founder');if(permission.error||!permission.data){gate.innerHTML='<h1>Founder access required.</h1>';return;}
gate.classList.add('member-hidden');app.classList.remove('member-hidden');
const {data,error}=await supabase.from('feature_flags').select('*').order('label');if(error){list.innerHTML=`<p>${error.message}</p>`;return;}
list.innerHTML=data.map(f=>`<article class="feature-flag-card"><div><strong>${f.label}</strong><span>${f.feature_key}</span>${f.founder_only?'<small>Founder-only preview</small>':''}</div><label class="feature-switch"><input type="checkbox" data-key="${f.feature_key}" ${f.is_enabled?'checked':''}><span></span></label></article>`).join('');
list.querySelectorAll('input').forEach(i=>i.addEventListener('change',async()=>{i.disabled=true;const {error}=await supabase.from('feature_flags').update({is_enabled:i.checked,updated_by:session.user.id,updated_at:new Date().toISOString()}).eq('feature_key',i.dataset.key);if(error){i.checked=!i.checked;alert(error.message);}i.disabled=false;}));})();
