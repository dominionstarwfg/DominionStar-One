/* DominionStar Google identity linking — disabled until the Founder approves
 * OAuth provider, allowed redirects and member RLS. Separate from Google login.
 * A confirmed Google identity can be attached ONLY to a signed-in existing account.
 */
(async () => {
  'use strict';
  // This is a release-switch, NOT a security boundary: DB policies are authoritative.
  if(window.DOMINIONSTAR_AUTH_FEATURES?.googleIdentityLinking !== true) return;
  const section=document.getElementById('googleIdentitySettings');
  const button=document.getElementById('googleLinkAccount');
  const status=document.getElementById('googleLinkStatus');
  if(!section||!button||!status||!window.DSAuth?.ready)return;
  const setStatus=(message,kind='info')=>{
    status.textContent=message;
    status.dataset.state=kind;
  };
  try{
    const client=await window.DSAuth.init();
    if(!client)throw new Error('Member authentication is unavailable.');
    const requireApprovedMember=async()=>{
      // Read a fresh authenticated user rather than trusting cached form fields.
      const auth=await client.auth.getUser();
      const user=auth.data?.user;
      if(auth.error||!user?.id)throw new Error('Sign in to your DominionStar account first.');
      const result=await client.from('member_profiles')
        .select('agent_code,verification_status')
        .eq('id',user.id).single();
      if(result.error||result.data?.verification_status!=='approved'||
        !String(result.data?.agent_code||'').trim()){
        throw new Error('Your Founder-approved membership and Agent Code must be verified before connecting Google.');
      }
      return {client,user};
    };
    const {user}=await requireApprovedMember();
    section.classList.remove('member-hidden');
    const linked=(user.identities||[]).some(identity=>identity.provider==='google');
    if(linked){
      button.hidden=true;
      setStatus('Google is connected to your existing DominionStar membership.','success');
    }else{
      setStatus('Optional: link a Google account while signed in with your existing member credentials.');
    }
    button.addEventListener('click',async()=>{
      if(button.disabled)return;
      button.disabled=true;
      setStatus('Verifying member approval before opening Google…');
      try{
        const fresh=await requireApprovedMember();
        if((fresh.user.identities||[]).some(identity=>identity.provider==='google')){
          button.hidden=true;
          setStatus('Google is already connected to your account.','success');
          return;
        }
        // Manual identity linking must also be enabled in Supabase Auth settings.
        const redirectTo=new URL('/account-settings/?google_link=complete#privacy-security',location.origin).href;
        const response=await fresh.client.auth.linkIdentity({
          provider:'google',
          options:{redirectTo}
        });
        if(response.error)throw response.error;
        // The provider generally redirects away; never claim successful linking here.
        setStatus('Complete the Google verification screen to connect your account.');
      }catch(error){
        setStatus(error?.message||'Google account linking could not start.','error');
      }finally{
        button.disabled=false;
      }
    });
    if(new URLSearchParams(location.search).get('google_link')==='complete'){
      // Only the fresh Supabase identity list can confirm whether linking worked.
      setStatus(linked
        ? 'Google account connection confirmed.'
        : 'Google linking was not confirmed. Check that you approved the Google request.',
        linked?'success':'error');
      history.replaceState(null,'','/account-settings/#privacy-security');
    }
  }catch(error){
    // Existing Settings remains usable. No unapproved member sees connect controls.
    if(section)section.classList.add('member-hidden');
  }
})();