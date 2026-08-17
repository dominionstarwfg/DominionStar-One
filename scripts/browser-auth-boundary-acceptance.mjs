import { chromium } from 'playwright';

const baseURL = process.env.DOMINIONSTAR_PREVIEW_URL || 'http://127.0.0.1:4173';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fakeClientBootstrap(mode) {
  const safeMode = JSON.stringify(mode);
  return `(() => {
    const mode = ${safeMode};
    const user = mode === 'guest' ? null : {
      id: mode === 'founder' ? 'preview-founder-id' : 'preview-member-id',
      email: mode === 'founder' ? 'preview-founder@example.invalid' : 'preview-member@example.invalid'
    };
    const session = user ? { access_token: 'preview-token', user } : null;
    const profile = mode === 'founder'
      ? {
          id: user.id,
          full_name: 'Preview Founder',
          preferred_name: 'Preview Founder',
          email: user.email,
          agent_code: 'PREVIEWF',
          smd_name: '',
          verification_status: 'approved',
          rank: 'SMD',
          founding_member: false,
          exclusive_member_number: null,
          is_founder: true,
          role: 'founder',
          avatar_path: null
        }
      : {
          id: user?.id,
          full_name: 'Preview Member',
          preferred_name: 'Preview Member',
          email: user?.email,
          agent_code: 'PREVIEWM',
          smd_name: 'Preview SMD',
          verification_status: 'approved',
          rank: 'TA',
          founding_member: false,
          exclusive_member_number: null,
          is_founder: false,
          role: 'member',
          avatar_path: null
        };

    const tableResult = table => {
      if (table === 'member_milestones') {
        return {
          data: [
            { milestone_key: 'profile', milestone_label: 'Complete profile', completed: true },
            { milestone_key: 'academy', milestone_label: 'Begin Academy', completed: false }
          ],
          error: null,
          count: 2
        };
      }
      return { data: [], error: null, count: 0 };
    };

    const singleResult = table => {
      if (table === 'member_profiles') return { data: profile, error: null };
      return { data: null, error: null };
    };

    const makeQuery = table => {
      let proxy;
      proxy = new Proxy({}, {
        get(_target, prop) {
          if (prop === 'then') {
            return (resolve, reject) => Promise.resolve(tableResult(table)).then(resolve, reject);
          }
          if (prop === 'single' || prop === 'maybeSingle') {
            return async () => singleResult(table);
          }
          if (prop === Symbol.toStringTag) return 'DominionStarPreviewQuery';
          return () => proxy;
        }
      });
      return proxy;
    };

    const makeChannel = () => {
      const channel = {
        on() { return channel; },
        subscribe(callback) { if (typeof callback === 'function') callback('SUBSCRIBED'); return channel; },
        send: async () => ({ status: 'ok' }),
        track: async () => ({ status: 'ok' }),
        untrack: async () => ({ status: 'ok' }),
        unsubscribe: async () => ({ status: 'ok' })
      };
      return channel;
    };

    const client = {
      auth: {
        getSession: async () => ({ data: { session }, error: null }),
        getUser: async () => ({ data: { user }, error: null }),
        signOut: async () => ({ error: null }),
        onAuthStateChange(callback) {
          if (typeof callback === 'function') queueMicrotask(() => callback('INITIAL_SESSION', session));
          return { data: { subscription: { unsubscribe() {} } } };
        }
      },
      from: table => makeQuery(table),
      rpc: async name => {
        if (name === 'founder_member_summary') {
          return {
            data: [{
              total_members: 1,
              pending_members: 0,
              approved_members: 1,
              ta_count: mode === 'founder' ? 0 : 1,
              associate_count: 0,
              sa_count: 0,
              md_count: 0,
              smd_count: mode === 'founder' ? 1 : 0
            }],
            error: null
          };
        }
        if (name === 'list_community_feed') return { data: [], error: null };
        return { data: [], error: null };
      },
      storage: {
        from: () => ({
          createSignedUrl: async () => ({ data: { signedUrl: null }, error: null }),
          getPublicUrl: () => ({ data: { publicUrl: '' } }),
          upload: async () => ({ data: null, error: null })
        })
      },
      functions: { invoke: async () => ({ data: {}, error: null }) },
      channel: () => makeChannel(),
      removeChannel: async () => 'ok',
      removeAllChannels: async () => [],
      getChannels: () => []
    };

    window.__DS_TEST_CLIENT__ = client;
    window.supabase = { createClient: () => client };
  })();`;
}

async function createPage(browser, mode) {
  const context = await browser.newContext({
    serviceWorkers: 'block',
    permissions: [],
    ignoreHTTPSErrors: false
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error?.stack || error?.message || error)));

  await page.addInitScript({ content: fakeClientBootstrap(mode) });
  await page.route('**/assets/js/supabase-config.js*', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: "window.DOMINIONSTAR_SUPABASE={url:'https://preview.invalid',anonKey:'preview-test-key'};"
  }));
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/**', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: 'window.supabase={createClient:()=>window.__DS_TEST_CLIENT__};'
  }));
  await page.route('https://unpkg.com/@supabase/**', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: 'window.supabase={createClient:()=>window.__DS_TEST_CLIENT__};'
  }));

  return { context, page, errors };
}

async function closeCase(testCase) {
  await testCase.context.close();
}

const browser = await chromium.launch({ headless: true });
let failed = false;

try {
  {
    const testCase = await createPage(browser, 'guest');
    try {
      await testCase.page.goto(`${baseURL}/member-dashboard/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await testCase.page.waitForURL(/\/member-login\/?(?:\?.*)?$/, { timeout: 10000 });
      assert(testCase.errors.length === 0, `guest member boundary page errors: ${testCase.errors.join('\n')}`);
      console.log('AUTH_BOUNDARY_OK guest member-dashboard -> member-login');
    } finally {
      await closeCase(testCase);
    }
  }

  {
    const testCase = await createPage(browser, 'guest');
    try {
      await testCase.page.goto(`${baseURL}/founder-control/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await testCase.page.waitForURL(/\/member-login\/?(?:\?.*)?$/, { timeout: 10000 });
      assert(testCase.errors.length === 0, `guest founder boundary page errors: ${testCase.errors.join('\n')}`);
      console.log('AUTH_BOUNDARY_OK guest founder-control -> member-login');
    } finally {
      await closeCase(testCase);
    }
  }

  {
    const testCase = await createPage(browser, 'member');
    try {
      await testCase.page.goto(`${baseURL}/member-dashboard/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await testCase.page.waitForFunction(() => document.getElementById('dashboardIdentityName')?.textContent?.trim() === 'Preview Member', null, { timeout: 10000 });
      const state = await testCase.page.evaluate(() => ({
        identity: document.getElementById('dashboardIdentityName')?.textContent?.trim(),
        status: document.getElementById('memberStatus')?.textContent?.trim(),
        founderLinkHidden: document.getElementById('founderControlLink')?.classList.contains('member-hidden') ?? true,
        approvedHidden: document.getElementById('approvedMemberContent')?.classList.contains('member-hidden') ?? true
      }));
      assert(state.identity === 'Preview Member', 'authenticated member identity did not render');
      assert(state.status === 'approved', `authenticated member status mismatch: ${state.status}`);
      assert(state.founderLinkHidden, 'ordinary member received founder-control navigation');
      assert(!state.approvedHidden, 'approved member content remained hidden');
      await testCase.page.waitForTimeout(750);
      assert(testCase.errors.length === 0, `authenticated member page errors: ${testCase.errors.join('\n---\n')}`);
      console.log('AUTH_BOUNDARY_OK authenticated member dashboard');
    } finally {
      await closeCase(testCase);
    }
  }

  {
    const testCase = await createPage(browser, 'member');
    try {
      await testCase.page.goto(`${baseURL}/founder-control/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await testCase.page.waitForFunction(() => /restricted to the DominionStar Founder account/i.test(document.getElementById('founderGate')?.textContent || ''), null, { timeout: 10000 });
      const appHidden = await testCase.page.locator('#founderApp').evaluate(el => el.classList.contains('member-hidden'));
      assert(appHidden, 'non-founder session exposed founder application');
      assert(testCase.errors.length === 0, `non-founder founder-control page errors: ${testCase.errors.join('\n')}`);
      console.log('AUTH_BOUNDARY_OK non-founder denied founder-control');
    } finally {
      await closeCase(testCase);
    }
  }

  {
    const testCase = await createPage(browser, 'founder');
    try {
      await testCase.page.goto(`${baseURL}/founder-control/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await testCase.page.waitForFunction(() => {
        const app = document.getElementById('founderApp');
        const name = document.getElementById('founderName');
        return app && !app.classList.contains('member-hidden') && name?.textContent?.trim() === 'Preview Founder';
      }, null, { timeout: 10000 });
      await testCase.page.waitForTimeout(500);
      const state = await testCase.page.evaluate(() => ({
        founderName: document.getElementById('founderName')?.textContent?.trim(),
        gateHidden: document.getElementById('founderGate')?.classList.contains('member-hidden') ?? false,
        appHidden: document.getElementById('founderApp')?.classList.contains('member-hidden') ?? true
      }));
      assert(state.founderName === 'Preview Founder', 'founder identity did not render');
      assert(state.gateHidden, 'founder gate remained visible for founder session');
      assert(!state.appHidden, 'founder application remained hidden for founder session');
      assert(testCase.errors.length === 0, `founder-control page errors: ${testCase.errors.join('\n---\n')}`);
      console.log('AUTH_BOUNDARY_OK founder admitted to founder-control');
    } finally {
      await closeCase(testCase);
    }
  }
} catch (error) {
  failed = true;
  console.error(error?.stack || error);
} finally {
  await browser.close();
}

if (failed) process.exit(1);
console.log('DOMINIONSTAR_AUTHORIZATION_BOUNDARY_ACCEPTANCE_OK');
