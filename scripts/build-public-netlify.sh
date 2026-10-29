#!/usr/bin/env bash
set -euo pipefail

# Netlify deploy/branch previews must never inherit the production Supabase
# backend. A separate staging Netlify site's "production" context is also
# possible: inspect its Git branch, not just the Netlify deploy context.
# The verified public repository's production branch is "main".
# Never enable a non-main Netlify build without approved isolated staging.
if [[ "${CONTEXT:-}" == "deploy-preview" ||
      "${CONTEXT:-}" == "branch-deploy" ||
      ( -n "${BRANCH:-}" && "${BRANCH}" != "main" &&
        ( "${NETLIFY:-}" == "true" || "${CONTEXT:-}" == "production" ) ) ||
      ( -n "${DOMINIONSTAR_STAGING_NETLIFY_SITE_ID:-}" &&
        "${DOMINIONSTAR_STAGING_ISOLATION_APPROVED:-}" != "STAGING_ONLY" ) ]]; then
  if [[ "${DOMINIONSTAR_STAGING_ISOLATION_APPROVED:-}" != "STAGING_ONLY" ]]; then
    echo "ERROR: preview blocked until isolated Netlify/Supabase staging is configured." >&2
    exit 47
  fi
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/public-dist"
MEET_SOURCE="$ROOT/meet-desktop/ui"
MEET_DIST="$DIST/meet"

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

echo "DOMINIONSTAR_PUBLIC_ROOT_OK"
echo "DOMINIONSTAR_BROWSER_MEET_ROUTE_OK /meet/"

# This rewrites ONLY the packaged browser clients, never the shared source.
# It validates actual Netlify site identity and separate Supabase credentials.
if [[ "${DOMINIONSTAR_STAGING_ISOLATION_APPROVED:-}" == "STAGING_ONLY" ]]; then
  node "$ROOT/scripts/prepare-isolated-staging.mjs"
  echo "DOMINIONSTAR_STAGING_BACKEND_ISOLATED_OK"
fi
