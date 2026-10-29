/* Password recovery requires a Supabase recovery event, not merely an existing session. */
(async () => {
  const form = document.getElementById('recoveryPasswordForm');
  const message = document.getElementById('recoveryMessage');
  const submit = document.getElementById('recoverySubmit');
  let client;
  let recoveryAuthorized = false;
  let completed = false;

  function report(text, type = 'info') {
    message.textContent = text;
    message.className = 'member-message show ' + type;
  }

  if (!window.DSAuth?.ready) {
    report('Account recovery is unavailable: authentication is not configured.', 'error');
    return;
  }

  try {
    client = await window.DSAuth.init();
    if (!client) throw new Error('Unable to initialize the authentication service.');

    // Register synchronously after client creation. No awaited work is done in the callback.
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session?.user && !completed) {
        recoveryAuthorized = true;
        form.hidden = false;
        report('Link verified. Enter your new password.');
      }
    });

    // Allow the auth library to complete URL processing before reporting a missing link.
    await client.auth.getSession();
    if (!recoveryAuthorized) {
      report('The recovery link was not verified. Open the latest reset email, or request a new link from Sign In.', 'error');
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!recoveryAuthorized || completed || submit.disabled) return;
      const password = form.elements.namedItem('password').value;
      const confirmation = form.elements.namedItem('confirm_password').value;
      if (password.length < 12 || password.length > 128) {
        report('Choose a password between 12 and 128 characters.', 'error');
        return;
      }
      if (password !== confirmation) {
        report('The passwords do not match.', 'error');
        return;
      }

      submit.disabled = true;
      report('Updating your password…');
      try {
        const { error } = await client.auth.updateUser({ password });
        if (error) {
          report(error.message || 'Could not update your password. Request a new link.', 'error');
          return;
        }

        completed = true;
        recoveryAuthorized = false;
        form.hidden = true;
        form.reset();
        // After a password change, require a fresh sign-in on this device.
        await client.auth.signOut();
        report('Password updated. Return to Sign In using your new password.', 'success');
        listener?.subscription?.unsubscribe();
      } catch (_error) {
        report('Password update could not be completed. Please try again.', 'error');
      } finally {
        submit.disabled = false;
      }
    });
  } catch (_error) {
    report('Unable to verify the recovery link. Please request a new one.', 'error');
  }
})();
