#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/public-dist"
MEET_SOURCE="$ROOT/meet-desktop/ui"
MEET_DIST="$DIST/meet"

# Netlify Deploy Previews are useful for visual QA, but an unconfigured
# PR preview must never inherit DominionStar's production backend.
# Publish a static, backend-free visual review package: real HTML/CSS and
# approved layout proportions, with production-backed scripts/actions disabled.
if [[ "${CONTEXT:-}" == "deploy-preview" &&
      "${DOMINIONSTAR_STAGING_ISOLATION_APPROVED:-}" != "STAGING_ONLY" ]]; then
  rm -rf "$DIST"
  mkdir -p "$DIST"

  rsync -a "$ROOT/" "$DIST/" \
    --exclude '.git/' \
    --exclude '.github/' \
    --exclude '.env' \
    --exclude '.env.*' \
    --exclude 'tests/' \
    --exclude 'netlify.toml' \
    --exclude 'public-dist/' \
    --exclude 'rebuild-dist/' \
    --exclude 'meet-desktop/' \
    --exclude 'desktop/' \
    --exclude 'desktop 2/' \
    --exclude 'scripts/' \
    --exclude 'supabase/' \
    --exclude 'netlify/' \
    --exclude 'node_modules/' \
    --exclude '*.md' \
    --exclude '*.zip'

  mkdir -p "$DIST/assets/css"
  cat > "$DIST/assets/css/dominionstar-visual-review.css" <<'CSS'
html{background:#061225!important}
body:before{
  content:"VISUAL REVIEW ONLY · backend disabled";
  position:fixed;left:50%;top:7px;z-index:2147483647;
  transform:translateX(-50%);
  padding:5px 10px;border-radius:999px;
  background:#0b2343;color:#f5d47e;
  border:1px solid rgba(240,193,91,.45);
  box-shadow:0 7px 20px rgba(0,0,0,.28);
  font:800 10px/1.2 system-ui,sans-serif;letter-spacing:.08em;
  pointer-events:none
}
#feedGate,#communityGate,#dmGate,#notificationGate,#directoryGate,
#agentJourneyGate,#agentLearningGate,#appointmentGate,#profileGate,#settingsGate{display:none!important}
#feedApp,#communityApp,#dmApp,#notificationApp,#directoryApp,
#agentJourneyApp,#agentLearningApp,#appointmentApp,#profileApp,#settingsApp{display:block!important}
button,input,select,textarea,form{pointer-events:none!important}
a{cursor:pointer!important}
.member-hidden[data-preview-show="true"]{display:block!important}
CSS

  python3 - "$DIST" <<'PY'
from pathlib import Path
import re, sys

dist=Path(sys.argv[1])
workspace_pages=[
  'member-dashboard/index.html','feed/index.html','direct-messages/index.html',
  'notifications/index.html','community/index.html','member-directory/index.html',
  'agent-journey/index.html','agent-learning/index.html','appointments/index.html',
  'professional-profile/index.html','account-settings/index.html'
]
keep_scripts=('dominionstar-agent-nav-shell.js',)

for rel in workspace_pages:
    p=dist/rel
    if not p.exists():
        continue
    html=p.read_text(encoding='utf-8')

    # Keep only the local navigation shell. Remove auth, Supabase, realtime,
    # functions, and every other production-backed script from visual previews.
    def strip_script(match):
        tag=match.group(0)
        return tag if any(name in tag for name in keep_scripts) else ''
    html=re.sub(r'<script\b[^>]*>.*?</script>', strip_script, html, flags=re.I|re.S)

    # Force the authenticated page shell styling for visual review.
    html=re.sub(
        r'<body([^>]*)class="([^"]*)"',
        lambda m: '<body'+m.group(1)+'class="'+m.group(2)+' ds-auth-os-page ds-auth-os-shell-active"',
        html, count=1, flags=re.I
    )

    # Reveal real application markup without running authentication.
    html=re.sub(
        r'(id="(?:feedApp|communityApp|dmApp|notificationApp|directoryApp|agentJourneyApp|agentLearningApp|appointmentApp|profileApp|settingsApp)"[^>]*class=")([^"]*)"',
        lambda m:m.group(1)+re.sub(r'\bmember-hidden\b','',m.group(2)).strip()+'"',
        html
    )

    # Inject the preview-only safety/visibility stylesheet.
    if 'dominionstar-visual-review.css' not in html:
        html=html.replace('</head>','<link rel="stylesheet" href="/assets/css/dominionstar-visual-review.css?v=1"></head>',1)

    p.write_text(html,encoding='utf-8')

hub='''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive"><title>DominionStar Visual Review</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 75% 0,#123a68 0,transparent 28%),linear-gradient(145deg,#041020,#061225 42%,#0a1c36);color:#f5f8fc;font-family:Inter,system-ui,sans-serif}
main{width:min(1120px,calc(100% - 32px));margin:0 auto;padding:48px 0 64px}.eyebrow{color:#f0c15b;text-transform:uppercase;letter-spacing:.18em;font-size:11px;font-weight:900}
h1{font:700 clamp(34px,5vw,58px)/1.02 Georgia,serif;margin:10px 0 12px}p{color:#b7c6d9;line-height:1.6}.notice{padding:14px 16px;border:1px solid rgba(53,208,127,.3);background:rgba(53,208,127,.07);border-radius:14px;margin:22px 0}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:24px}.card{display:block;padding:18px;border:1px solid rgba(126,168,221,.2);border-radius:16px;background:linear-gradient(155deg,rgba(20,42,75,.94),rgba(9,25,49,.94));color:#f5f8fc;text-decoration:none;box-shadow:0 16px 36px rgba(0,0,0,.2)}
.card:hover{border-color:rgba(24,119,242,.55);transform:translateY(-1px)}.card strong{display:block;margin-bottom:5px}.card span{font-size:12px;color:#9eb2c9}@media(max-width:800px){.grid{grid-template-columns:1fr 1fr}}@media(max-width:520px){.grid{grid-template-columns:1fr}}
</style></head><body><main><p class="eyebrow">DominionStar Executive OS</p><h1>Visual review hub</h1>
<p>Review the real static Agent OS layouts below. Production authentication, Supabase, realtime, calls, uploads, and serverless actions are disabled in this preview.</p>
<div class="notice"><strong>Design review only.</strong> Use this build to inspect proportions, spacing, colors, cards, typography, sidebar density, and page composition.</div>
<div class="grid">
<a class="card" href="/member-dashboard/"><strong>Dashboard</strong><span>Approved illustration composition</span></a>
<a class="card" href="/feed/"><strong>Feed</strong><span>Social stream and composer</span></a>
<a class="card" href="/direct-messages/"><strong>Messages</strong><span>Three-column inbox</span></a>
<a class="card" href="/notifications/"><strong>Notifications</strong><span>Executive inbox</span></a>
<a class="card" href="/community/"><strong>Community</strong><span>Composer, feed and standards</span></a>
<a class="card" href="/member-directory/"><strong>Team Members</strong><span>Compact member directory</span></a>
<a class="card" href="/agent-journey/"><strong>My Journey</strong><span>Progress and milestones</span></a>
<a class="card" href="/agent-learning/"><strong>Learning</strong><span>Training and development</span></a>
<a class="card" href="/appointments/"><strong>Calendar</strong><span>Appointments and status</span></a>
<a class="card" href="/professional-profile/"><strong>My Profile</strong><span>Identity and professional record</span></a>
<a class="card" href="/account-settings/"><strong>Agent Settings</strong><span>Compact settings workspace</span></a>
</div></main></body></html>'''
(dist/'index.html').write_text(hub,encoding='utf-8')
PY

  cat > "$DIST/_headers" <<'HEADERS'
/*
  X-Robots-Tag: noindex, nofollow, noarchive
  Cache-Control: no-store
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Content-Security-Policy: default-src 'self' data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'
HEADERS

  cat > "$DIST/robots.txt" <<'ROBOTS'
User-agent: *
Disallow: /
ROBOTS

  # Netlify packages functions after the build command. Remove them so this
  # review package cannot expose production-backed serverless endpoints.
  if [[ "${NETLIFY:-}" == "true" && -d "$ROOT/netlify/functions" ]]; then
    find "$ROOT/netlify/functions" -type f -delete
  fi

  echo "DOMINIONSTAR_DEPLOY_PREVIEW_STATIC_VISUAL_OK"
  exit 0
fi

# Branch deploys and non-main Netlify builds remain hard-blocked unless a
# separately approved staging site and staging Supabase project are configured.
if [[ "${CONTEXT:-}" == "branch-deploy" ||
      ( -n "${BRANCH:-}" && "${BRANCH}" != "main" &&
        ( "${NETLIFY:-}" == "true" || "${CONTEXT:-}" == "production" ) ) ||
      ( -n "${DOMINIONSTAR_STAGING_NETLIFY_SITE_ID:-}" &&
        "${DOMINIONSTAR_STAGING_ISOLATION_APPROVED:-}" != "STAGING_ONLY" ) ]]; then
  if [[ "${DOMINIONSTAR_STAGING_ISOLATION_APPROVED:-}" != "STAGING_ONLY" ]]; then
    echo "ERROR: non-production deploy blocked until isolated Netlify/Supabase staging is configured." >&2
    exit 47
  fi
fi

# Production domain boundary:
# - The public DominionStar website owns `/`.
# - Browser Meet is published only at `/meet/`.
# - Desktop Meet source must never become the production homepage.
required_paths=(
  "index.html"
  "styles.css"
  "_headers"
  "_redirects"
  "financial-services/index.html"
  "opportunity/index.html"
  "institute/index.html"
  "academy/index.html"
  "member-login/index.html"
  "about/index.html"
  "mentorship/index.html"
  "assets/css/dominionstar-public-v5.css"
  "assets/js/dominionstar-public-v5.js"
  "assets/js/dominionstar-geography.js"
  "scripts/test-public-geography.mjs"
  "scripts/test-aurora-executive.mjs"
  "netlify/functions/aurora-chat.mjs"
  "assets/ds-public-hero.jpg"
  "assets/ds-public-founder.jpg"
  "join/index.html"
  "schedule/index.html"
  "consultation/index.html"
  "thank-you.html"
  "events/index.html"
  "knowledge/index.html"
  "mentorship/getting-started/index.html"
  "mentorship/professional-growth/index.html"
  "mentorship/leadership/index.html"
  "opportunity/licensing/index.html"
  "opportunity/first-90-days/index.html"
  "opportunity/business-building/index.html"
  "financial-services/long-term-care/index.html"
  "financial-services/annuities/index.html"
  "financial-services/living-trusts/index.html"
  "assets/js/dominionstar-protection-tools.js"
  "financial-services/life-insurance/index.html"
  "financial-services/learning-lab/index.html"
  "financial-services/probate-estate/index.html"
  "financial-services/term-life/index.html"
  "financial-services/whole-life/index.html"
  "financial-services/universal-life/index.html"
  "financial-services/indexed-universal-life/index.html"
  "assets/js/dominionstar-life-interactive.js"
  "assets/js/dominionstar-index-lab.js"
  "public-release.json"
  "opportunity/canada/index.html"
  "assets/js/dominionstar-financial-lab.js"
  "meet-desktop/ui/index.html"
)

for rel in "${required_paths[@]}"; do
  if [ ! -s "$ROOT/$rel" ]; then
    echo "ERROR: refusing public deploy; missing required file: $rel" >&2
    exit 41
  fi
done

# Review-only Aurora JS syntax + capability/UX safety contract.
node --check "$ROOT/assets/js/dominionstar-public-v5.js"
node "$ROOT/scripts/test-aurora-executive.mjs"
node "$ROOT/scripts/test-public-geography.mjs"

rm -rf "$DIST"
mkdir -p "$DIST"

# Build the public website first. Desktop source is explicitly excluded.
rsync -a "$ROOT/" "$DIST/" \
  --exclude '.git/' \
  --exclude '.github/' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'tests/' \
  --exclude 'netlify.toml' \
  --exclude 'public-dist/' \
  --exclude 'rebuild-dist/' \
  --exclude 'meet-desktop/' \
  --exclude 'desktop/' \
  --exclude 'desktop 2/' \
  --exclude 'scripts/' \
  --exclude 'supabase/' \
  --exclude 'netlify/' \
  --exclude 'node_modules/' \
  --exclude '*.md' \
  --exclude '*.zip'

# Browser Meet is an isolated route, never the public root.
rm -rf "$MEET_DIST"
mkdir -p "$MEET_DIST"
rsync -a --delete "$MEET_SOURCE/" "$MEET_DIST/"

# The public homepage must be the public DominionStar site, never Meet.
grep -Fq 'Home — No Family Left Behind | DominionStar Leadership Development' "$DIST/index.html"
# Static release identifier helps distinguish a published Netlify deploy from stale hosting.
grep -Fq 'V10-quality-gate-2026-10-17' "$DIST/index.html"
grep -Fq '"release": "V10-quality-gate-2026-10-17"' "$DIST/public-release.json"
grep -Fq 'href="/mentorship/"' "$DIST/index.html"
grep -Fq 'href="/about/"' "$DIST/index.html"
grep -Fq 'Aurora' "$DIST/index.html"
grep -Fq 'aurora-v8-panel' "$ROOT/assets/css/dominionstar-public-v5.css"
grep -Fq 'aurora-executive-panel' "$ROOT/assets/css/dominionstar-public-v5.css"
grep -Fq 'aurora-executive-quick-grid' "$DIST/assets/js/dominionstar-public-v5.js"
grep -Fq 'aurora-v8-transcript' "$ROOT/assets/js/dominionstar-public-v5.js"
grep -Fq 'AURORA_AI_ENABLED' "$ROOT/netlify/functions/aurora-chat.mjs"
grep -Fq 'Speak to Aurora' "$ROOT/assets/js/dominionstar-public-v5.js"
grep -Fq 'href="/opportunity/canada/"' "$DIST/opportunity/index.html"
grep -Fq 'href="/financial-services/probate-estate/"' "$DIST/financial-services/index.html"
grep -Fq 'href="/financial-services/living-trusts/"' "$DIST/financial-services/index.html"
grep -Fq 'https://dominionstarld.com/financial-services/living-trusts/' "$DIST/sitemap.xml"
grep -Fq 'Aretha Franklin' "$DIST/financial-services/probate-estate/index.html"
grep -Fq 'Canada recruiting priority' "$DIST/opportunity/canada/index.html"
# No undefined links or placeholders in product education.
for rel in financial-services/life-insurance/index.html financial-services/long-term-care/index.html; do
  if grep -Eq 'href="undefined"|>undefined<' "$DIST/$rel"; then
    echo "ERROR: broken financial education card in $rel" >&2
    exit 42
  fi
done
for rel in financial-services/term-life/index.html financial-services/whole-life/index.html financial-services/universal-life/index.html financial-services/indexed-universal-life/index.html; do
  grep -Fq 'class="site-header"' "$DIST/$rel"
  grep -Fq 'class="aurora-trigger"' "$DIST/$rel"
  grep -Fq 'dominionstarwfg@gmail.com' "$DIST/$rel"
done
grep -Fq 'data-term-demo' "$DIST/financial-services/term-life/index.html"
grep -Fq 'dominionstar-life-interactive.js' "$DIST/financial-services/term-life/index.html"
grep -Fq 'data-event-output' "$DIST/financial-services/term-life/index.html"
grep -Fq 'data-index-svg' "$DIST/financial-services/indexed-universal-life/index.html"
grep -Fq 'dominionstar-index-lab.js' "$DIST/financial-services/indexed-universal-life/index.html"
grep -Fq 'data-index-svg' "$DIST/financial-services/universal-life/index.html"
grep -Fq 'AURORA_WEB_SEARCH_ENABLED' "$ROOT/netlify/functions/aurora-chat.mjs"
grep -Fq 'Search official sources' "$ROOT/assets/js/dominionstar-public-v5.js"
# Validate canonical social URLs for key consumer education pages.
for slug in life-insurance term-life whole-life universal-life indexed-universal-life long-term-care; do
  file="$DIST/financial-services/$slug/index.html"
  grep -Fq "<meta property=\"og:url\" content=\"https://dominionstarld.com/financial-services/$slug/\">" "$file"
  if grep -Fq 'href="undefined"' "$file"; then
    echo "ERROR: undefined link in $file" >&2
    exit 42
  fi
done


# LTC and annuity learning experiences must always have real pages and working interactive scripts.
for entry in financial-services/annuities/index.html financial-services/long-term-care/index.html; do
  grep -Fq 'class="site-header"' "$DIST/$entry"
  grep -Fq 'class="aurora-trigger"' "$DIST/$entry"
  grep -Fq 'dominionstarwfg@gmail.com' "$DIST/$entry"
done
grep -Fq 'href="/financial-services/annuities/#annuity-calculator"' "$DIST/financial-services/life-insurance/index.html"
grep -Fq 'href="/financial-services/long-term-care/#ltc-gap-tool"' "$DIST/financial-services/life-insurance/index.html"
grep -Fq 'data-financial-tool="annuity"' "$DIST/financial-services/annuities/index.html"
grep -Fq 'data-financial-tool="ltc"' "$DIST/financial-services/long-term-care/index.html"
grep -Fq 'dominionstar-protection-tools.js' "$DIST/financial-services/annuities/index.html"
grep -Fq 'dominionstar-protection-tools.js' "$DIST/financial-services/long-term-care/index.html"
grep -Fq '<meta property="og:url" content="https://dominionstarld.com/financial-services/annuities/">' "$DIST/financial-services/annuities/index.html"
grep -Fq 'https://www.investor.gov/introduction-investing/investing-basics/investment-products/annuities' "$DIST/financial-services/annuities/index.html"
if grep -Eq 'href="undefined"|>undefined<' "$DIST/financial-services/annuities/index.html"; then
  echo "ERROR: annuity education contains undefined links or placeholders." >&2
  exit 44
fi

# Ensure all educational routes have correct social-sharing metadata and working in-page navigation.
for rel in \
  mentorship/getting-started/index.html mentorship/professional-growth/index.html mentorship/leadership/index.html \
  opportunity/licensing/index.html opportunity/first-90-days/index.html opportunity/business-building/index.html \
  financial-services/learning-lab/index.html; do
  path="${rel%index.html}"
  grep -Fq "<meta property=\"og:url\" content=\"https://dominionstarld.com/$path\">" "$DIST/$rel"
  if grep -Fq 'href="undefined"' "$DIST/$rel"; then
    echo "ERROR: invalid internal link in $rel" >&2
    exit 43
  fi
done
grep -Fq '<section class="section section-light" id="learn">' "$DIST/financial-services/learning-lab/index.html"
grep -Fq 'negative index change generally does not create a negative interest credit' "$DIST/financial-services/indexed-universal-life/index.html"
for route in /academy/ /platform/; do
  grep -Fq "$route " "$DIST/_redirects"
done
# The Journey page is a real published route, not a redirect to Opportunity.
test -s "$DIST/journey/index.html"
if grep -Eq '^/journey/ +/opportunity/ ' "$DIST/_redirects"; then
  echo "ERROR: Journey page would be shadowed by a stale redirect." >&2
  exit 46
fi
grep -Fq '/journey /journey/ 301!' "$DIST/_redirects"
# Reject legacy conversion-page templates when building the production website.
grep -Fq 'name="dominionstar-join"' "$DIST/join/index.html"
grep -Fq 'name="dominionstar-qualified-appointment"' "$DIST/schedule/index.html"
grep -Fq 'name="dominionstar-client-consultation"' "$DIST/consultation/index.html"
for rel in join/index.html schedule/index.html consultation/index.html; do
  if grep -Eiq 'Project Genesis RC5' "$DIST/$rel"; then
    echo "ERROR: legacy conversion page detected: $rel" >&2
    exit 45
  fi
done

# Region and appointment-time-zone quality gate: enforce form and educational UI contract.
for rel in schedule/index.html consultation/index.html; do
  grep -Fq 'data-ds-country' "$DIST/$rel"
  grep -Fq 'data-ds-region' "$DIST/$rel"
  grep -Fq 'data-ds-timezone' "$DIST/$rel"
  grep -Fq 'name="time-zone"' "$DIST/$rel"
  grep -Fq 'dominionstar-geography.js' "$DIST/$rel"
done
grep -Fq 'data-ds-region' "$DIST/join/index.html"
grep -Fq 'data-ds-geography' "$DIST/financial-services/index.html"
for rel in financial-services/life-insurance/index.html financial-services/long-term-care/index.html; do
  grep -Fq 'data-ds-geography' "$DIST/$rel"
  grep -Fq 'data-ds-regulator-link' "$DIST/$rel"
  grep -Fq 'dominionstar-geography.js' "$DIST/$rel"
done
grep -Fq 'dominionstar-geography.js' "$DIST/financial-services/index.html"
grep -Fq 'America/New_York' "$DIST/assets/js/dominionstar-geography.js"

# Source-of-truth lead capture: three static Netlify forms must retain campaign fields.
for rel in join/index.html schedule/index.html consultation/index.html; do
  grep -Fq 'data-netlify="true"' "$DIST/$rel"
  grep -Fq 'name="campaign_source"' "$DIST/$rel"
  grep -Fq 'name="campaign_medium"' "$DIST/$rel"
  grep -Fq 'name="campaign_name"' "$DIST/$rel"
  grep -Fq 'name="campaign_entry_path"' "$DIST/$rel"
done
grep -Fq 'generate_lead' "$DIST/assets/js/dominionstar-public-v5.js"
grep -Fq 'dominionstar_lead_pending_v1' "$DIST/assets/js/dominionstar-public-v5.js"
test -s "$DIST/thank-you.html"

# The existing member and desktop source are preserved; public auth still requires a separate access-control review.

# Educational journeys must be built as independent pages, not booking-form redirects.
for rel in mentorship/getting-started/index.html mentorship/professional-growth/index.html mentorship/leadership/index.html opportunity/licensing/index.html opportunity/first-90-days/index.html opportunity/business-building/index.html financial-services/life-insurance/index.html financial-services/long-term-care/index.html financial-services/learning-lab/index.html; do
  grep -Fq 'class="site-header"' "$DIST/$rel"
  grep -Fq 'tel:+13462042641' "$DIST/$rel"
  grep -Fq 'mailto:dominionstarwfg@gmail.com' "$DIST/$rel"
done
# Public conversion routes must share the production design and form detection.
for rel in join/index.html schedule/index.html consultation/index.html events/index.html; do
  grep -Fq 'class="site-header"' "$DIST/$rel"
  grep -Fq 'data-netlify="true"' "$DIST/$rel"
done
for rel in mentorship/index.html financial-services/index.html opportunity/index.html about/index.html knowledge/index.html; do
  grep -Fq 'class="site-header"' "$DIST/$rel"
done
if grep -Fq 'DominionStar Meet' "$DIST/index.html"; then
  echo "ERROR: Meet content reached the public homepage." >&2
  exit 42
fi

# Browser Meet must exist only at its dedicated route.
grep -Fq 'DominionStar Meet' "$MEET_DIST/index.html"
test ! -e "$DIST/meet-desktop"
test ! -e "$DIST/rebuild-dist"

# Block accidental activation of gated web Agent Dashboard features before
# publishing any Netlify output, including isolated review/staging packages.
node "$ROOT/scripts/check-agent-release-gates.mjs" "$DIST"

# npm manifests are build inputs, not public website assets. The release gate
# has already verified them; do not publish dependency metadata in public-dist.
rm -f "$DIST/package.json" "$DIST/package-lock.json"

echo "DOMINIONSTAR_PUBLIC_ROOT_OK"
echo "DOMINIONSTAR_BROWSER_MEET_ROUTE_OK /meet/"

# This rewrites ONLY the packaged browser clients, never the shared source.
# It validates actual Netlify site identity and separate Supabase credentials.
if [[ "${DOMINIONSTAR_STAGING_ISOLATION_APPROVED:-}" == "STAGING_ONLY" ]]; then
  node "$ROOT/scripts/prepare-isolated-staging.mjs"
  echo "DOMINIONSTAR_STAGING_BACKEND_ISOLATED_OK"
fi
