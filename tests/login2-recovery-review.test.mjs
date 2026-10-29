import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const recoveryCode = read('assets/js/member-recovery.js');
const loginHtml = read('member-login/index.html');
const recoveryHtml = read('member-update-password/index.html');
const loginJs = read('assets/js/member-login.js');
const css = read('assets/css/member-login-executive-v1.css');

test('Login Concept 2 preserves existing authentication form hooks', () => {
  for (const id of ['memberLoginForm', 'memberRegisterForm', 'memberResetForm', 'memberMessage']) {
    assert.match(loginHtml, new RegExp('id="' + id + '"'));
  }
  for (const action of ['login', 'register', 'reset']) {
    assert.match(loginHtml, new RegExp('data-member-tab="' + action + '"'));
  }
  assert.match(loginHtml, /name="agent_code"/);
  assert.match(loginHtml, /name="smd_name"/);
  assert.match(loginHtml, /member-auth\.js/);
  assert.match(loginHtml, /member-login\.js/);
  assert.match(loginHtml, /noindex,nofollow/);
});

test('Reset links target the recovery route with neutral response', () => {
  assert.match(loginJs, /redirectTo:[^\n]+member-update-password/);
  assert.match(loginJs, /If an account exists for this email/);
  assert.match(loginJs, /parsedNext\.origin === window\.location\.origin/);
  assert.match(loginJs, /!requestedNext\.includes/);
});

test('Recovery page hides its form before verification', () => {
  assert.match(recoveryHtml, /noindex,nofollow/);
  assert.match(recoveryHtml, /id="recoveryPasswordForm"[^>]*hidden/);
  assert.match(recoveryHtml, /autocomplete="new-password"/);
  assert.match(recoveryHtml, /member-recovery\.js/);
  assert.match(css, /\.login2-form\[hidden\]\s*\{\s*display:none!important/);
});

const flush = () => new Promise(resolve => setImmediate(resolve));

async function launch({ recoveryEvent = false, updateError = null, mismatch = false } = {}) {
  const message = { textContent: '', className: '' };
  const submit = { disabled: false };
  const inputs = {
    password: { value: 'a-realistic-new-password-123' },
    confirm_password: { value: mismatch ? 'different-password-123' : 'a-realistic-new-password-123' }
  };
  const calls = { update: [], signOut: 0, reset: 0 };
  const form = {
    hidden: true,
    elements: { namedItem: name => inputs[name] },
    reset() { calls.reset++; },
    addEventListener(event, fn) { if (event === 'submit') this.handleSubmit = fn; }
  };
  const nodes = { recoveryPasswordForm: form, recoveryMessage: message, recoverySubmit: submit };
  const client = {
    auth: {
      onAuthStateChange(cb) {
        this.cb = cb;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async getSession() {
        if (recoveryEvent) this.cb('PASSWORD_RECOVERY', { user: { id: 'synthetic-user' } });
        return { data: { session: null } };
      },
      async updateUser(args) { calls.update.push(args); return { error: updateError }; },
      async signOut() { calls.signOut++; return { error: null }; }
    }
  };
  const context = {
    window: { DSAuth: { ready: true, init: async () => client } },
    document: { getElementById: id => nodes[id] }
  };
  vm.runInNewContext(recoveryCode, context, { timeout: 2000 });
  await flush();
  return {
    form, message, submit, calls,
    async send() { await form.handleSubmit({ preventDefault() {} }); }
  };
}

test('Ordinary session cannot reveal update form', async () => {
  const h = await launch();
  assert.equal(h.form.hidden, true);
  assert.match(h.message.textContent, /not verified/);
  await h.send();
  assert.equal(h.calls.update.length, 0);
});

test('Recovery event enables update then signs out', async () => {
  const h = await launch({ recoveryEvent: true });
  assert.equal(h.form.hidden, false);
  await h.send();
  assert.equal(h.calls.update.length, 1);
  assert.equal(h.calls.update[0].password, 'a-realistic-new-password-123');
  assert.equal(h.calls.signOut, 1);
  assert.equal(h.form.hidden, true);
  assert.match(h.message.textContent, /Password updated/);
});

test('Mismatched confirmation prevents update', async () => {
  const h = await launch({ recoveryEvent: true, mismatch: true });
  await h.send();
  assert.equal(h.calls.update.length, 0);
  assert.match(h.message.textContent, /do not match/);
});

test('Service rejection preserves form and allows retry', async () => {
  const h = await launch({ recoveryEvent: true, updateError: { message: 'Rejected' } });
  await h.send();
  assert.equal(h.calls.update.length, 1);
  assert.equal(h.calls.signOut, 0);
  assert.equal(h.form.hidden, false);
  assert.equal(h.submit.disabled, false);
  assert.match(h.message.textContent, /Rejected/);
});
