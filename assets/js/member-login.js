
(async () => {
  const message = document.getElementById('memberMessage');
  const loginForm = document.getElementById('memberLoginForm');
  const registerForm = document.getElementById('memberRegisterForm');
  const resetForm = document.getElementById('memberResetForm');
  const googleSection = document.getElementById('memberGoogleSignIn');
  const googleButton = document.getElementById('memberGoogleSignInButton');
  // Safety-by-default: Google auth cannot be activated through a form field or URL.
  const googleEnabled = window.DOMINIONSTAR_AUTH_FEATURES?.googleSignIn === true;
  const tabs = [...document.querySelectorAll('[data-member-tab]')];

  // Forms submit exclusively through their guarded event handlers.
  // Never install a javascript: URL into a form action.
  [loginForm, registerForm, resetForm].forEach(form => {
    if (form) form.method = 'post';
  });

  const pendingForms = new WeakSet();
  async function submitOnce(form, work) {
    if (pendingForms.has(form)) return;
    pendingForms.add(form);
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      await work();
    } catch (_error) {
      showMessage('Unable to reach the sign-in service. Check your connection and try again.', 'error');
    } finally {
      pendingForms.delete(form);
      if (submit) submit.disabled = false;
    }
  }

  function showMessage(text, type='info') {
    message.textContent = text;
    message.className = `member-message show ${type}`;
  }

  function activate(tabName) {
    tabs.forEach(btn => {
      const active = btn.dataset.memberTab === tabName;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    [loginForm, registerForm, resetForm].forEach(form => form.classList.add('member-hidden'));
    document.getElementById(`member${tabName[0].toUpperCase()+tabName.slice(1)}Form`).classList.remove('member-hidden');
    if (googleSection) googleSection.classList.toggle('member-hidden', !googleEnabled || tabName !== 'login');
    const title=document.getElementById('login2Title');
    if(title) title.textContent = ({login:'Sign in to DominionStar.',register:'Request member access.',reset:'Recover your account.'})[tabName] || 'Member access';
    const lede=document.querySelector('.login2-auth-lede');
    if(lede) lede.textContent = ({
      login:'Access your professional community securely.',
      register:'Register with your Agent Code. Founder approval is required.',
      reset:'Request a secure password reset link.'
    })[tabName] || '';
    message.className = 'member-message';
  }

  tabs.forEach(btn => btn.addEventListener('click', () => activate(btn.dataset.memberTab)));

  if (!window.DSAuth?.ready) {
    showMessage('Authentication configuration is missing from this deployment.', 'error');
    return;
  }

  const supabase = await window.DSAuth.init();
  if (!supabase) {
    showMessage('Authentication could not load. Check the internet connection, then refresh the page.', 'error');
    return;
  }

  // Optional Google login is ONLY for an existing, approved DominionStar member.
  // The client-side check is defense-in-depth; database RLS remains authoritative.
  if(googleEnabled && googleButton){
    googleSection?.classList.remove('member-hidden');
    googleButton.addEventListener('click',async()=>{
      googleButton.disabled=true;
      showMessage('Opening secure Google sign-in…','info');
      try{
        const redirectTo=new URL('/member-login/?oauth=google',window.location.origin).href;
        const {error}=await supabase.auth.signInWithOAuth({
          provider:'google',
          options:{redirectTo}
        });
        if(error)throw error;
      }catch(error){
        showMessage(error?.message||'Google sign-in could not start. Use your password instead.','error');
      }finally{
        googleButton.disabled=false;
      }
    });
  }
  // OAuth redirects return here. Never infer membership from Google email or metadata.
  if(googleEnabled && new URLSearchParams(window.location.search).get('oauth')==='google'){
    showMessage('Verifying your DominionStar membership…','info');
    try{
      const auth=await supabase.auth.getUser();
      if(auth.error||!auth.data?.user?.id)throw new Error('Google authentication did not complete.');
      const verified=await supabase.from('member_profiles')
        .select('id,agent_code,verification_status')
        .eq('id',auth.data.user.id).maybeSingle();
      if(verified.error||verified.data?.verification_status!=='approved'||!String(verified.data?.agent_code||'').trim()){
        await supabase.auth.signOut();
        showMessage('Google verification succeeded, but DominionStar membership is not approved or linked to an Agent Code. Please register with your Agent Code or contact your team leader.','error');
      }else{
        window.location.replace('/member-dashboard/');
        return;
      }
    }catch(error){
      showMessage(error?.message||'Google sign-in verification failed. Please use email and password.','error');
    }finally{
      // Remove the callback indicator, without preserving untrusted query strings.
      window.history.replaceState(null,'','/member-login/');
    }
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    await submitOnce(loginForm, async () => {
      showMessage('Signing in…', 'info');
      const email = loginForm.email.value.trim().toLowerCase();
      const password = loginForm.password.value;
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        showMessage(
          error.message === 'Invalid login credentials'
            ? 'Email or password is incorrect. Use Reset Password if needed.'
            : error.message,
          'error'
        );
        return;
      }

      const requestedNext = new URLSearchParams(window.location.search).get('next') || '';
      let safeNext = '/member-dashboard/';
      if (requestedNext.startsWith('/') && !requestedNext.startsWith('//') &&
          !requestedNext.includes('\\')) {
        try {
          const parsedNext = new URL(requestedNext, window.location.origin);
          if (parsedNext.origin === window.location.origin &&
              !['/member-login/', '/member-update-password/'].includes(parsedNext.pathname)) {
            safeNext = parsedNext.pathname + parsedNext.search + parsedNext.hash;
          }
        } catch (_error) {
          // Unparseable or unsafe redirect: keep the standard member dashboard.
        }
      }
      window.location.href = safeNext;
    });
  });

  registerForm.addEventListener('submit', async event => {
    event.preventDefault();
    await submitOnce(registerForm, async () => {

    const fullName = registerForm.full_name.value.trim();
    const email = registerForm.email.value.trim().toLowerCase();
    const password = registerForm.password.value;
    const agentCode = registerForm.agent_code.value.trim().toUpperCase();
    const smdName = registerForm.smd_name.value.trim();
    // Browser validation is for clarity, never an authorization decision.
    if(!agentCode || agentCode.length>50) {
      showMessage('Enter the Agent Code assigned to you before requesting access.','error');
      registerForm.agent_code.focus();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          agent_code: agentCode,
          smd_name: smdName,
          verification_status: 'pending',
          rank: 'TA'
        }
      }
    });

    if (error) return showMessage(error.message, 'error');

    showMessage(
      data.session
        ? 'Account created. Access is pending Founder approval.'
        : 'Check your email to confirm the account. Founder approval is still required.',
      'success'
    );
    registerForm.reset();
    });
  });

  resetForm.addEventListener('submit', async event => {
    event.preventDefault();
    await submitOnce(resetForm, async () => {
    const email = resetForm.email.value.trim().toLowerCase();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/member-update-password/`
    });
    if (error) return showMessage(error.message, 'error');
    showMessage('If an account exists for this email, recovery instructions will arrive shortly.', 'success');
    resetForm.reset();
    });
  });
})();
