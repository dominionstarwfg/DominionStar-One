import { chromium } from 'playwright';

const baseURL = process.env.DOMINIONSTAR_PREVIEW_URL || 'http://127.0.0.1:4173';
const routes = [
  '/',
  '/member-login/',
  '/member-dashboard/',
  '/founder-control/',
  '/founder-dashboard/',
  '/community/',
  '/workspace/',
  '/meet-home/',
  '/meet-login/',
  '/meet/',
  '/release-check/',
  '/system-check/'
];

function isStaticResource(resourceType) {
  return ['document', 'script', 'stylesheet', 'image', 'font'].includes(resourceType);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  serviceWorkers: 'block',
  permissions: [],
  ignoreHTTPSErrors: false
});

let failed = false;

try {
  for (const route of routes) {
    const page = await context.newPage();
    const pageErrors = [];
    const sameOriginStaticFailures = [];
    const consoleErrors = [];
    const base = new URL(baseURL);

    page.on('pageerror', error => pageErrors.push(String(error?.stack || error?.message || error)));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('requestfailed', request => {
      try {
        const url = new URL(request.url());
        const errorText = request.failure()?.errorText || 'request failed';
        if (errorText === 'net::ERR_ABORTED') return;
        if (url.origin === base.origin && isStaticResource(request.resourceType())) {
          sameOriginStaticFailures.push(`${request.resourceType()} ${url.pathname}: ${errorText}`);
        }
      } catch {}
    });
    page.on('response', response => {
      try {
        const request = response.request();
        const url = new URL(response.url());
        if (url.origin === base.origin && isStaticResource(request.resourceType()) && response.status() >= 400) {
          sameOriginStaticFailures.push(`${request.resourceType()} ${url.pathname}: HTTP ${response.status()}`);
        }
      } catch {}
    });

    const response = await page.goto(`${baseURL}${route}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    if (!response || response.status() >= 400) {
      throw new Error(`${route}: document response ${response?.status() ?? 'missing'}`);
    }

    await page.waitForTimeout(1500);

    const state = await page.evaluate(() => ({
      href: location.href,
      title: document.title,
      bodyText: document.body?.innerText || '',
      readyState: document.readyState,
      scripts: [...document.scripts].filter(s => s.src).length,
      stylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')].length
    }));

    if (!state.bodyText.trim()) throw new Error(`${route}: rendered body is empty`);
    if (!/DominionStar|Meet/i.test(`${state.title}\n${state.bodyText}`)) {
      throw new Error(`${route}: DominionStar/Meet identity missing from rendered page`);
    }
    if (route === '/meet/' && /Desktop update required|installed app does not match the certified meeting release/i.test(state.bodyText)) {
      throw new Error('/meet/: stale desktop certification blocker rendered in browser preview');
    }
    if (pageErrors.length) {
      throw new Error(`${route}: uncaught browser exceptions:\n${pageErrors.join('\n---\n')}`);
    }
    if (sameOriginStaticFailures.length) {
      throw new Error(`${route}: same-origin static resource failures:\n${[...new Set(sameOriginStaticFailures)].join('\n')}`);
    }

    const severeConsole = consoleErrors.filter(text => !/favicon|Failed to load resource|net::ERR_/i.test(text));
    if (severeConsole.length) {
      console.log(`BROWSER_CONSOLE_ERRORS ${route} ${JSON.stringify(severeConsole)}`);
    }

    console.log(`BROWSER_ROUTE_OK ${route} -> ${state.href} ready=${state.readyState} scripts=${state.scripts} styles=${state.stylesheets}`);
    await page.close();
  }
} catch (error) {
  failed = true;
  console.error(error?.stack || error);
} finally {
  await context.close();
  await browser.close();
}

if (failed) process.exit(1);
console.log('DOMINIONSTAR_BROWSER_RUNTIME_ACCEPTANCE_OK');
