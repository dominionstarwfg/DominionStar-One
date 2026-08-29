(()=>{
  if(!document.querySelector('link[data-ds-av-settings]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./av-settings.css';link.dataset.dsAvSettings='1';document.head.append(link);}
  if(!document.querySelector('script[data-ds-video-effects]')){const script=document.createElement('script');script.src='./video-effects.js';script.dataset.dsVideoEffects='1';document.head.append(script);}
  if(!document.querySelector('script[data-ds-av-settings]')){const script=document.createElement('script');script.src='./av-settings.js';script.dataset.dsAvSettings='1';document.head.append(script);}
  if(!document.querySelector('link[data-ds-physical-zoom]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./physical-zoom-parity.css';link.dataset.dsPhysicalZoom='1';document.head.append(link);}
  if(!document.querySelector('script[data-ds-physical-zoom]')){const script=document.createElement('script');script.src='./physical-zoom-parity.js';script.defer=true;script.dataset.dsPhysicalZoom='1';document.head.append(script);}
  if(!document.querySelector('link[data-ds-physical-acceptance]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./physical-acceptance-polish.css';link.dataset.dsPhysicalAcceptance='1';document.head.append(link);}
  if(!document.querySelector('script[data-ds-physical-acceptance]')){const script=document.createElement('script');script.src='./physical-acceptance-polish.js';script.defer=true;script.dataset.dsPhysicalAcceptance='1';document.head.append(script);}

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
