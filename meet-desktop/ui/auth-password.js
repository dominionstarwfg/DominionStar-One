(()=>{
  if(!document.querySelector('link[data-ds-av-settings]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./av-settings.css';link.dataset.dsAvSettings='1';document.head.append(link);}
  if(!document.querySelector('link[data-ds-zoom-production-polish]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./zoom-production-polish.css';link.dataset.dsZoomProductionPolish='1';document.head.append(link);}
  if(!document.querySelector('link[data-ds-zoom-physical-acceptance]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./zoom-physical-acceptance.css';link.dataset.dsZoomPhysicalAcceptance='1';document.head.append(link);}

  let physicalStyle=document.querySelector('link[data-ds-physical-mac-repair]');
  if(!physicalStyle){physicalStyle=document.createElement('link');physicalStyle.rel='stylesheet';physicalStyle.href='./physical-mac-repair.css';physicalStyle.dataset.dsPhysicalMacRepair='1';document.head.append(physicalStyle);}
  const loadPhysicalRepair=()=>{
    if(document.querySelector('script[data-ds-physical-mac-repair]'))return;
    const script=document.createElement('script');script.src='./physical-mac-repair.js';script.dataset.dsPhysicalMacRepair='1';document.head.append(script);
  };

  if(!document.querySelector('script[data-ds-video-effects]')){const script=document.createElement('script');script.src='./video-effects.js';script.dataset.dsVideoEffects='1';document.head.append(script);}
  if(!document.querySelector('script[data-ds-av-settings]')){const script=document.createElement('script');script.src='./av-settings.js';script.dataset.dsAvSettings='1';document.head.append(script);}
  if(!document.querySelector('script[data-ds-zoom-production-polish]')){const script=document.createElement('script');script.src='./zoom-production-polish.js';script.dataset.dsZoomProductionPolish='1';document.head.append(script);}
  if(!document.querySelector('script[data-ds-zoom-physical-acceptance]')){const script=document.createElement('script');script.src='./zoom-physical-acceptance.js';script.dataset.dsZoomPhysicalAcceptance='1';document.head.append(script);}
  if(!document.querySelector('script[data-ds-zoom-reaction-parity]')){const script=document.createElement('script');script.src='./zoom-reaction-parity.js';script.dataset.dsZoomReactionParity='1';document.head.append(script);}
  if(!document.querySelector('script[data-ds-zoom-contract-bridge]')){const script=document.createElement('script');script.src='./zoom-contract-bridge.js';script.dataset.dsZoomContractBridge='1';document.head.append(script);}

  // The physical-Mac controller must never become ready before its last-authority
  // stylesheet is active. This removes first-frame races where legacy reaction or
  // settings rules can win briefly in the packaged renderer.
  if(physicalStyle.sheet)loadPhysicalRepair();
  else{
    physicalStyle.addEventListener('load',loadPhysicalRepair,{once:true});
    physicalStyle.addEventListener('error',()=>console.error('[DominionStar Meet] Physical-Mac acceptance stylesheet failed to load.'),{once:true});
  }

  const form=document.querySelector('#emailSignInForm');
  const email=document.querySelector('#emailSignInEmail');
  const password=document.querySelector('#emailSignInPassword');
  const submit=document.querySelector('#emailSignInButton');
  const google=document.querySelector('#googleSignIn');
  const status=document.querySelector('#authStatus');
  const auth=window.dominionDesktop?.auth;
  if(!form||!email||!password||!submit||!auth?.signInPassword)return;

  const setBusy=busy=>{submit.disabled=Boolean(busy);if(google)google.disabled=Boolean(busy);};
  const show=(message,kind='')=>{if(!status)return;status.textContent=String(message||'');status.classList.toggle('error',kind==='error');status.classList.toggle('success',kind==='success');};
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    setBusy(true);show('Signing in securely…');
    try{
      await auth.signInPassword(email.value,password.value);
      password.value='';show('Signed in. Opening DominionStar Meet…','success');
    }catch(error){
      setBusy(false);show(String(error?.message||error||'Email sign-in failed.'),'error');password.focus();
    }
  });
  auth.onChanged?.(state=>{if(!state?.signedIn)setBusy(false);});
})();
