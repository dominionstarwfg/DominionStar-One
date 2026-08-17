import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const EMAIL_ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'DOMINIONSTAR_EMAIL_FROM',
  'DOMINIONSTAR_EMAIL_FROM_NAME',
  'DOMINIONSTAR_EMAIL_REPLY_TO',
  'EMAIL_PROCESSOR_SECRET'
];

const savedEnv = Object.fromEntries(EMAIL_ENV_KEYS.map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

const clearEmailEnv = () => {
  for (const key of EMAIL_ENV_KEYS) delete process.env[key];
};

const setCompleteEnv = () => {
  clearEmailEnv();
  process.env.SUPABASE_URL = 'https://preview-supabase.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'preview-service-role-key';
  process.env.RESEND_API_KEY = 'preview-resend-key';
  process.env.DOMINIONSTAR_EMAIL_FROM = 'notifications@preview.invalid';
  process.env.DOMINIONSTAR_EMAIL_FROM_NAME = 'DominionStar Preview';
  process.env.DOMINIONSTAR_EMAIL_REPLY_TO = 'reply@preview.invalid';
  process.env.EMAIL_PROCESSOR_SECRET = 'preview-email-secret';
};

const makeState = overrides => ({
  authUser: null,
  authError: null,
  profile: { role: 'member', is_founder: false },
  profileError: null,
  settings: {
    id: true,
    is_enabled: true,
    from_name: 'DominionStar Preview',
    from_email: 'notifications@preview.invalid',
    reply_to_email: 'reply@preview.invalid'
  },
  settingsError: null,
  claimData: [],
  claimError: null,
  meetingQueueData: { queued: true, reason: null },
  meetingQueueError: null,
  sendResult: { data: { id: 'stub-message-id' }, error: null },
  outboxUpdateError: null,
  createClientCalls: [],
  rpcCalls: [],
  sendCalls: [],
  resendKeys: [],
  outboxUpdates: [],
  ...overrides
});

const makeClient = state => ({
  auth: {
    getUser: async token => ({
      data: { user: state.authUser },
      error: state.authError
    })
  },
  from(table) {
    if (table === 'member_profiles') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: state.profile, error: state.profileError })
          })
        })
      };
    }
    if (table === 'email_delivery_settings') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: state.settings, error: state.settingsError })
          })
        })
      };
    }
    if (table === 'email_notification_outbox') {
      return {
        update: payload => ({
          eq: async (column, id) => {
            state.outboxUpdates.push({ payload, column, id });
            return { error: state.outboxUpdateError };
          }
        })
      };
    }
    throw new Error(`Unexpected Supabase table in isolated function test: ${table}`);
  },
  rpc: async (name, args) => {
    state.rpcCalls.push({ name, args });
    if (name === 'claim_email_notification_batch') {
      return { data: state.claimData, error: state.claimError };
    }
    if (name === 'queue_meeting_host_absent_notification') {
      return { data: state.meetingQueueData, error: state.meetingQueueError };
    }
    throw new Error(`Unexpected Supabase RPC in isolated function test: ${name}`);
  }
});

const activateState = state => {
  state.client = makeClient(state);
  globalThis.__DS_FUNCTION_TEST_STATE__ = state;
  return state;
};

const readJson = async response => ({
  status: response.status,
  ok: response.ok,
  body: await response.json()
});

const postRequest = headers => ({
  method: 'POST',
  httpMethod: 'POST',
  headers: new Headers(headers || {})
});

const makeTempModuleTree = async () => {
  const root = await mkdtemp(join(tmpdir(), 'dominionstar-function-acceptance-'));
  const supabaseDir = join(root, 'node_modules', '@supabase', 'supabase-js');
  const resendDir = join(root, 'node_modules', 'resend');
  await mkdir(supabaseDir, { recursive: true });
  await mkdir(resendDir, { recursive: true });

  await writeFile(join(supabaseDir, 'package.json'), JSON.stringify({
    name: '@supabase/supabase-js',
    type: 'module',
    exports: './index.js'
  }));
  await writeFile(join(supabaseDir, 'index.js'), `
export function createClient(...args) {
  const state = globalThis.__DS_FUNCTION_TEST_STATE__;
  if (!state) throw new Error('Missing isolated Supabase test state');
  state.createClientCalls.push(args);
  return state.client;
}
`);

  await writeFile(join(resendDir, 'package.json'), JSON.stringify({
    name: 'resend',
    type: 'module',
    exports: './index.js'
  }));
  await writeFile(join(resendDir, 'index.js'), `
export class Resend {
  constructor(key) {
    const state = globalThis.__DS_FUNCTION_TEST_STATE__;
    if (!state) throw new Error('Missing isolated Resend test state');
    state.resendKeys.push(key);
    this.emails = {
      send: async payload => {
        state.sendCalls.push(payload);
        return state.sendResult;
      }
    };
  }
}
`);

  for (const file of [
    'process-email-outbox.mjs',
    'scheduled-email-outbox.mjs',
    'meeting-host-alert.mjs'
  ]) {
    const source = await readFile(join('netlify', 'functions', file), 'utf8');
    await writeFile(join(root, file), source);
  }

  return root;
};

let tempRoot;
let failed = false;

try {
  globalThis.fetch = async () => {
    throw new Error('NETWORK_FORBIDDEN_IN_FUNCTION_ACCEPTANCE');
  };

  tempRoot = await makeTempModuleTree();
  const processOutbox = (await import(`${pathToFileURL(join(tempRoot, 'process-email-outbox.mjs')).href}?v=1`)).default;
  const scheduledModule = await import(`${pathToFileURL(join(tempRoot, 'scheduled-email-outbox.mjs')).href}?v=1`);
  const meetingHostAlert = (await import(`${pathToFileURL(join(tempRoot, 'meeting-host-alert.mjs')).href}?v=1`)).default;

  clearEmailEnv();
  activateState(makeState());
  let result = await readJson(await processOutbox({ method: 'GET', headers: new Headers() }));
  assert(result.status === 405, `GET must be rejected, got ${result.status}`);
  assert(globalThis.__DS_FUNCTION_TEST_STATE__.createClientCalls.length === 0, 'GET unexpectedly initialized Supabase');
  console.log('FUNCTION_OUTBOX_OK method boundary');

  clearEmailEnv();
  activateState(makeState());
  result = await readJson(await processOutbox(postRequest()));
  assert(result.status === 500, `incomplete environment must fail closed, got ${result.status}`);
  assert(globalThis.__DS_FUNCTION_TEST_STATE__.sendCalls.length === 0, 'incomplete environment attempted delivery');
  console.log('FUNCTION_OUTBOX_OK environment boundary');

  setCompleteEnv();
  activateState(makeState());
  result = await readJson(await processOutbox(postRequest()));
  assert(result.status === 401, `missing founder authentication must be 401, got ${result.status}`);
  assert(globalThis.__DS_FUNCTION_TEST_STATE__.sendCalls.length === 0, 'unauthenticated request attempted delivery');
  console.log('FUNCTION_OUTBOX_OK authentication required');

  setCompleteEnv();
  activateState(makeState({
    authUser: { id: 'preview-member-id', email: 'member@preview.invalid' },
    profile: { role: 'member', is_founder: false }
  }));
  result = await readJson(await processOutbox(postRequest({ authorization: 'Bearer preview-member-token' })));
  assert(result.status === 403, `non-founder must be denied, got ${result.status}`);
  assert(globalThis.__DS_FUNCTION_TEST_STATE__.sendCalls.length === 0, 'non-founder request attempted delivery');
  console.log('FUNCTION_OUTBOX_OK founder authorization boundary');

  setCompleteEnv();
  activateState(makeState({
    authUser: { id: 'preview-founder-id', email: 'founder@preview.invalid' },
    profile: { role: 'founder', is_founder: true },
    settings: { id: true, is_enabled: false }
  }));
  result = await readJson(await processOutbox(postRequest({ authorization: 'Bearer preview-founder-token' })));
  assert(result.status === 409, `disabled delivery must stay disabled for founder requests, got ${result.status}`);
  assert(globalThis.__DS_FUNCTION_TEST_STATE__.sendCalls.length === 0, 'disabled delivery attempted send');
  console.log('FUNCTION_OUTBOX_OK delivery disable switch');

  setCompleteEnv();
  activateState(makeState({ settings: { id: true, is_enabled: false } }));
  result = await readJson(await processOutbox(postRequest({ 'x-dominionstar-secret': process.env.EMAIL_PROCESSOR_SECRET })));
  assert(result.status === 409, `disabled delivery must stay disabled for worker requests, got ${result.status}`);
  assert(globalThis.__DS_FUNCTION_TEST_STATE__.sendCalls.length === 0, 'disabled worker attempted send');
  console.log('FUNCTION_OUTBOX_OK worker secret respects disable switch');

  setCompleteEnv();
  activateState(makeState({ claimData: [] }));
  result = await readJson(await processOutbox(postRequest({ 'x-dominionstar-secret': process.env.EMAIL_PROCESSOR_SECRET })));
  assert(result.status === 200 && result.body.sent === 0 && result.body.failed === 0, 'empty queue response mismatch');
  assert(globalThis.__DS_FUNCTION_TEST_STATE__.sendCalls.length === 0, 'empty queue attempted send');
  console.log('FUNCTION_OUTBOX_OK empty queue');

  setCompleteEnv();
  const successState = activateState(makeState({
    claimData: [{
      id: 'preview-email-1',
      recipient_email: 'recipient@preview.invalid',
      subject: 'Preview "quoted" subject',
      body: 'Preview <body> & safe text',
      action_url: '/member-dashboard/',
      attempts: 1
    }]
  }));
  result = await readJson(await processOutbox(postRequest({ 'x-dominionstar-secret': process.env.EMAIL_PROCESSOR_SECRET })));
  assert(result.status === 200 && result.body.sent === 1 && result.body.failed === 0, 'successful stub delivery response mismatch');
  assert(successState.sendCalls.length === 1, `expected one stub send, got ${successState.sendCalls.length}`);
  assert(successState.sendCalls[0].to?.[0] === 'recipient@preview.invalid', 'stub delivery recipient mismatch');
  assert(successState.sendCalls[0].html.includes('https://dominionstarld.com/member-dashboard/'), 'relative action URL did not resolve to canonical DominionStar domain');
  assert(successState.sendCalls[0].html.includes('&quot;quoted&quot;'), 'email subject quote escaping regressed');
  assert(!successState.sendCalls[0].html.includes('https://dominionstar.com/'), 'legacy DominionStar host remained in email action link');
  assert(successState.outboxUpdates.length === 1, 'successful delivery did not persist exactly one outbox update');
  assert(successState.outboxUpdates[0].payload.status === 'sent', 'successful delivery did not mark outbox sent');
  assert(successState.outboxUpdates[0].payload.provider_message_id === 'stub-message-id', 'provider message id was not persisted');
  console.log('FUNCTION_OUTBOX_OK isolated successful delivery and canonical action link');

  setCompleteEnv();
  const retryState = activateState(makeState({
    claimData: [{
      id: 'preview-email-retry',
      recipient_email: 'retry@preview.invalid',
      subject: 'Retry preview',
      body: 'No external delivery',
      action_url: null,
      attempts: 2
    }],
    sendResult: { data: null, error: { message: 'stub delivery failure' } }
  }));
  result = await readJson(await processOutbox(postRequest({ 'x-dominionstar-secret': process.env.EMAIL_PROCESSOR_SECRET })));
  assert(result.status === 207 && result.body.failed === 1, 'stub delivery failure must return partial-failure status');
  assert(retryState.outboxUpdates.length === 1, 'failed delivery did not persist retry state');
  assert(retryState.outboxUpdates[0].payload.status === 'pending', 'retryable delivery failure was not returned to pending');
  assert(/stub delivery failure/.test(retryState.outboxUpdates[0].payload.last_error || ''), 'retry reason was not persisted');
  console.log('FUNCTION_OUTBOX_OK retry persistence');

  setCompleteEnv();
  const terminalState = activateState(makeState({
    claimData: [{
      id: 'preview-email-terminal',
      recipient_email: 'terminal@preview.invalid',
      subject: 'Terminal preview',
      body: 'No external delivery',
      action_url: null,
      attempts: 5
    }],
    sendResult: { data: null, error: { message: 'stub terminal failure' } }
  }));
  result = await readJson(await processOutbox(postRequest({ 'x-dominionstar-secret': process.env.EMAIL_PROCESSOR_SECRET })));
  assert(result.status === 207 && result.body.failed === 1, 'terminal delivery failure must return partial-failure status');
  assert(terminalState.outboxUpdates[0].payload.status === 'failed', 'fifth-attempt failure was not terminal');
  console.log('FUNCTION_OUTBOX_OK terminal failure persistence');

  setCompleteEnv();
  const scheduledState = activateState(makeState({ claimData: [] }));
  assert(scheduledModule.config?.schedule === '* * * * *', `scheduled worker cadence changed: ${scheduledModule.config?.schedule}`);
  result = await readJson(await scheduledModule.default());
  assert(result.status === 200, `scheduled worker did not authenticate through its isolated secret, got ${result.status}`);
  assert(scheduledState.rpcCalls.some(call => call.name === 'claim_email_notification_batch'), 'scheduled worker did not reach queue claim');
  assert(scheduledState.sendCalls.length === 0, 'scheduled empty queue attempted delivery');
  console.log('FUNCTION_OUTBOX_OK scheduled worker path');

  setCompleteEnv();
  delete process.env.EMAIL_PROCESSOR_SECRET;
  const missingSecretState = activateState(makeState({ claimData: [] }));
  result = await readJson(await scheduledModule.default());
  assert(result.status === 401, `scheduled worker without secret must fail closed, got ${result.status}`);
  assert(missingSecretState.sendCalls.length === 0, 'scheduled worker without secret attempted delivery');
  console.log('FUNCTION_OUTBOX_OK scheduled worker secret boundary');

  setCompleteEnv();
  delete process.env.EMAIL_PROCESSOR_SECRET;
  const deferredAlertState = activateState(makeState({
    meetingQueueData: { queued: true, reason: null }
  }));
  result = await readJson(await meetingHostAlert({
    method: 'POST',
    headers: new Headers(),
    json: async () => ({ room: '744 300 1370', visitorName: 'Preview Guest' })
  }));
  assert(result.status === 202 && result.body.queued === true, 'meeting host alert did not preserve durable queue success');
  assert(result.body.delivery?.deferred === true, 'meeting host alert without processor secret was not deferred');
  assert(deferredAlertState.sendCalls.length === 0, 'deferred meeting host alert attempted email delivery');
  console.log('FUNCTION_OUTBOX_OK meeting host alert durable queue boundary');

  setCompleteEnv();
  const immediateAlertState = activateState(makeState({
    meetingQueueData: { queued: true, reason: null },
    claimData: []
  }));
  result = await readJson(await meetingHostAlert({
    method: 'POST',
    headers: new Headers(),
    json: async () => ({ room: '744 300 1370', visitorName: 'Preview Guest' })
  }));
  assert(result.status === 202 && result.body.delivery?.immediate === true, 'meeting host alert immediate processor path failed');
  assert(immediateAlertState.sendCalls.length === 0, 'empty immediate host-alert queue attempted delivery');
  console.log('FUNCTION_OUTBOX_OK meeting host alert immediate processor path');

  console.log('DOMINIONSTAR_FUNCTION_EMAIL_OUTBOX_ACCEPTANCE_OK');
} catch (error) {
  failed = true;
  console.error(error?.stack || error);
} finally {
  if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
  delete globalThis.__DS_FUNCTION_TEST_STATE__;
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

if (failed) process.exit(1);
