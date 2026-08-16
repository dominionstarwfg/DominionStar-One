import crypto from 'node:crypto';

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  },
  body: JSON.stringify(body)
});

function secureEqual(a = '', b = '') {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

async function getGoogleAccessToken() {
  const email = process.env.GA_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GA_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !privateKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({alg:'RS256', typ:'JWT'}));
  const claim = base64url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${claim}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey).toString('base64url');
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'content-type':'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  if (!response.ok) throw new Error(`Google OAuth failed: ${response.status}`);
  return (await response.json()).access_token;
}

async function runRealtimeReport(accessToken, propertyId, dimensions, metrics) {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        dimensions: dimensions.map(name => ({name})),
        metrics: metrics.map(name => ({name})),
        limit: 20
      })
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GA realtime report failed: ${response.status} ${text.slice(0,200)}`);
  }
  return response.json();
}

function reportRows(report, dimensionName, metricName, outputLabel) {
  return (report.rows || []).map(row => ({
    [outputLabel]: row.dimensionValues?.[0]?.value || '(not set)',
    [metricName]: Number(row.metricValues?.[0]?.value || 0)
  }));
}

async function getAnalytics() {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const accessToken = await getGoogleAccessToken();
  if (!propertyId || !accessToken) return null;

  const [usersReport, pagesReport, eventsReport, countriesReport] = await Promise.all([
    runRealtimeReport(accessToken, propertyId, [], ['activeUsers']),
    runRealtimeReport(accessToken, propertyId, ['unifiedScreenName'], ['activeUsers']),
    runRealtimeReport(accessToken, propertyId, ['eventName'], ['eventCount']),
    runRealtimeReport(accessToken, propertyId, ['country'], ['activeUsers'])
  ]);

  const events = reportRows(eventsReport, 'eventName', 'eventCount', 'event');
  const eventCount = name => events.find(row => row.event === name)?.eventCount || 0;

  return {
    activeUsers: Number(usersReport.totals?.[0]?.metricValues?.[0]?.value || 0),
    topPages: reportRows(pagesReport, 'unifiedScreenName', 'activeUsers', 'page'),
    topEvents: events,
    topCountries: reportRows(countriesReport, 'country', 'activeUsers', 'country'),
    assessmentEvents: eventCount('career_assessment_started'),
    guideEvents: eventCount('guide_opened') + eventCount('guide_question_sent')
  };
}

async function getNetlifySubmissions() {
  const token = process.env.NETLIFY_API_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;
  if (!token || !siteId) return null;

  const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/submissions?per_page=100`, {
    headers: {authorization: `Bearer ${token}`}
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Netlify submissions failed: ${response.status} ${text.slice(0,200)}`);
  }
  return response.json();
}

export default async (request) => {
  if (request.method !== 'GET') return new Response(JSON.stringify({error:'Method not allowed'}), {status:405});

  const expectedKey = process.env.FOUNDER_DASHBOARD_KEY || '';
  const suppliedKey = request.headers.get('x-founder-key') || '';
  if (!expectedKey || !secureEqual(expectedKey, suppliedKey)) {
    return new Response(JSON.stringify({error:'Unauthorized'}), {
      status: 401,
      headers: {'content-type':'application/json','cache-control':'no-store'}
    });
  }

  try {
    const [analyticsResult, submissionsResult] = await Promise.allSettled([
      getAnalytics(),
      getNetlifySubmissions()
    ]);

    const analytics = analyticsResult.status === 'fulfilled' ? analyticsResult.value : null;
    const submissions = submissionsResult.status === 'fulfilled' ? submissionsResult.value : null;
    const safeSubmissions = Array.isArray(submissions) ? submissions : [];

    const formName = item => item.form_name || item.formName || '';
    const summary = {
      totalSubmissions: safeSubmissions.length,
      conversationRequests: safeSubmissions.filter(item => /appointment|conversation|schedule/i.test(formName(item))).length,
      eventRegistrations: safeSubmissions.filter(item => /event/i.test(formName(item))).length
    };

    return new Response(JSON.stringify({
      generatedAt: new Date().toISOString(),
      analytics: analytics || {
        activeUsers:0, topPages:[], topEvents:[], topCountries:[],
        assessmentEvents:0, guideEvents:0
      },
      submissions: safeSubmissions.slice(0, 100),
      summary,
      connections: {
        'Google Analytics Data API': Boolean(analytics),
        'Netlify Forms API': Array.isArray(submissions),
        'Founder access key': true
      },
      errors: {
        analytics: analyticsResult.status === 'rejected' ? analyticsResult.reason.message : null,
        submissions: submissionsResult.status === 'rejected' ? submissionsResult.reason.message : null
      }
    }), {
      status: 200,
      headers: {'content-type':'application/json','cache-control':'no-store'}
    });
  } catch (error) {
    return new Response(JSON.stringify({error:error.message}), {
      status:500,
      headers:{'content-type':'application/json','cache-control':'no-store'}
    });
  }
};
