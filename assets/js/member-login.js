
(async () => {
  const message = document.getElementById('memberMessage');
  const loginForm = document.getElementById('memberLoginForm');
  const registerForm = document.getElementById('memberRegisterForm');
  const resetForm = document.getElementById('memberResetForm');
  const tabs = [...document.querySelectorAll('[data-member-tab]')];

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

    const requestedNext = new URLSearchParams(window.location.search).get('next') || '';
    const safeNext = requestedNext.startsWith('/') && !requestedNext.startsWith('//')
      ? requestedNext
      : '/member-dashboard/';
    window.location.href = safeNext;
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
      redirectTo: `${window.location.origin}/member-login/`
    });
    if (error) return showMessage(error.message, 'error');
    showMessage('Password reset email sent.', 'success');
    resetForm.reset();
  });
})();
