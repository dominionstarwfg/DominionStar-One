
(async () => {
  const message = document.getElementById('memberMessage');
  const loginForm = document.getElementById('memberLoginForm');
  const registerForm = document.getElementById('memberRegisterForm');
  const resetForm = document.getElementById('memberResetForm');
  const tabs = [...document.querySelectorAll('[data-member-tab]')];
  const params = new URLSearchParams(window.location.search);
  const isDesktop = params.get('desktop') === '1' && Boolean(window.dominionDesktop?.isDesktop);
  const DESKTOP_GOOGLE_START_URL = 'https://dominionstarld.com/meet-auth-start/?desktop=1';

  [loginForm, registerForm, resetForm].forEach(form => {
    if (form) {
      form.method = 'post';
      form.action = 'javascript:void(0)';
    }
  });

  function showMessage(text, type='info') {
    message.textContent = text;
    message.className = `member-message show ${type}`;
  }

  function activate(tabName) {
    tabs.forEach(btn => btn.classList.toggle('active', btn.dataset.memberTab === tabName));
    [loginForm, registerForm, resetForm].forEach(form => form.classList.add('member-hidden'));
    document.getElementById(`member${tabName[0].toUpperCase()+tabName.slice(1)}Form`).classList.remove('member-hidden');
    message.className = 'member-message';
  }

  function desktopHome() {
    if (isDesktop && window.dominionDesktop?.goHome) {
      window.dominionDesktop.goHome();
      return;
    }
    window.location.href = '/meet-home/?desktop=1';
  }

  function requestedDestination() {
    const requestedNext = params.get('next') || '';
    if (isDesktop) {
      const allowed = ['/meet/','/meet-home/','/member-login/','/meet-login/'];
      try {
        const target = new URL(requestedNext || '/meet-home/?desktop=1', window.location.origin);
        if (target.origin === window.location.origin && allowed.some(path => target.pathname === path || target.pathname === path.slice(0,-1))) {
          target.searchParams.set('desktop','1');
          return `${target.pathname}${target.search}${target.hash}`;
        }
      } catch {}
      return '/meet-home/?desktop=1';
    }
    return requestedNext.startsWith('/') && !requestedNext.startsWith('//')
      ? requestedNext
      : '/member-dashboard/';
  }

  tabs.forEach(btn => btn.addEventListener('click', () => activate(btn.dataset.memberTab)));

  if (isDesktop) {
    document.documentElement.dataset.dominionDesktop = '1';
    const returnLink = document.querySelector('a.text-link[href="/"]');
    if (returnLink) {
      returnLink.textContent = '← Back to DominionStar Meet';
      returnLink.href = '/meet-home/?desktop=1';
      returnLink.addEventListener('click', event => {
        event.preventDefault();
        desktopHome();
      });
    }
    const systemCheck = document.querySelector('a.member-back-link');
    if (systemCheck) systemCheck.hidden = true;
  }

  if (!window.DSAuth?.ready) {
    showMessage('Authentication configuration is missing from this deployment.', 'error');
    return;
  }

  const supabase = await window.DSAuth.init();
  if (!supabase) {
    showMessage('Authentication could not load. Check the internet connection, then refresh the page.', 'error');
    return;
  }

  if (isDesktop) {
    const googleButton = document.createElement('button');
    googleButton.id = 'desktopGoogleLogin';
    googleButton.type = 'button';
    googleButton.className = 'btn';
    googleButton.style.cssText = 'width:100%;margin:0 0 14px;border:1px solid #ffffff24;background:#fff;color:#111827;font-weight:800;display:flex;align-items:center;justify-content:center;gap:10px;';
    googleButton.innerHTML = '<span aria-hidden="true" style="font-size:18px;font-weight:900">G</span><span>Continue with Google</span>';
    loginForm.parentNode.insertBefore(googleButton, loginForm);

    const divider = document.createElement('div');
    divider.setAttribute('aria-hidden','true');
    divider.style.cssText = 'display:flex;align-items:center;gap:10px;margin:0 0 14px;color:#8f99aa;font-size:12px;';
    divider.innerHTML = '<span style="height:1px;background:#ffffff18;flex:1"></span><span>or sign in with email</span><span style="height:1px;background:#ffffff18;flex:1"></span>';
    loginForm.parentNode.insertBefore(divider, loginForm);

    googleButton.addEventListener('click', async () => {
      googleButton.disabled = true;
      showMessage('Opening secure Google sign-in…', 'info');
      try {
        // The system browser owns the OAuth round trip. It first visits a
        // DominionStar Meet launch page on the production Site URL so that the
        // same browser tab can mark itself as a desktop-auth session. Supabase's
        // configured Site URL may then receive the OAuth tokens safely: the root
        // relay immediately hands only that marked tab back to dominionstar://.
        const opened = await window.dominionDesktop?.openExternal?.(DESKTOP_GOOGLE_START_URL);
        if (!opened) throw new Error('DominionStar Meet could not open the secure Google sign-in window.');
        showMessage('Complete Google sign-in in your browser. The browser will return you to DominionStar Meet automatically.', 'info');
      } catch (error) {
        googleButton.disabled = false;
        showMessage(error?.message || 'Google sign-in could not start.', 'error');
      }
    });
  }

  if (isDesktop && params.get('oauth') === 'error') {
    const description = params.get('message') || 'Google sign-in did not complete. Please try again.';
    showMessage(description.slice(0,240), 'error');
  }

  if (isDesktop && params.get('oauth') === 'complete') {
    showMessage('Finishing secure Google sign-in…', 'info');
    try {
      const returned = new URLSearchParams(String(window.location.hash || '').replace(/^#/,''));
      const accessToken = returned.get('access_token') || '';
      const refreshToken = returned.get('refresh_token') || '';
      if (!accessToken || !refreshToken) {
        throw new Error('Google sign-in returned without a usable DominionStar desktop session.');
      }
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      if (error) throw error;

      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        throw new Error('Google sign-in returned without a usable DominionStar session.');
      }

      history.replaceState(history.state, '', `${window.location.pathname}?desktop=1&oauth=complete`);
      window.location.replace(requestedDestination());
      return;
    } catch (error) {
      showMessage(error?.message || 'Google sign-in could not be completed.', 'error');
    }
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
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

    window.location.href = requestedDestination();
  });

  registerForm.addEventListener('submit', async event => {
    event.preventDefault();

    const fullName = registerForm.full_name.value.trim();
    const email = registerForm.email.value.trim().toLowerCase();
    const password = registerForm.password.value;
    const agentCode = registerForm.agent_code.value.trim().toUpperCase();
    const smdName = registerForm.smd_name.value.trim();

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

  resetForm.addEventListener('submit', async event => {
    event.preventDefault();
    const email = resetForm.email.value.trim().toLowerCase();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/member-login/${isDesktop ? '?desktop=1' : ''}`
    });
    if (error) return showMessage(error.message, 'error');
    showMessage('Password reset email sent.', 'success');
    resetForm.reset();
  });
})();
