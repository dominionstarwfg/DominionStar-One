# DominionStar Public V10 — Release Verification

## Confirm the correct website is published
Latest intended site build: `V10-quality-gate-2026-10-17`.
The code is published from GitHub branch `main`, with `netlify.toml` expecting:
- Build command: `bash scripts/build-public-netlify.sh`
- Publish directory: `public-dist`
- Functions directory: `netlify/functions`

In the Netlify dashboard, verify that **the project serving dominionstarld.com** is connected to `dominionstarwfg/DominionStar-One`, production branch `main`, and its latest successful production deploy includes the current GitHub release commit. Do not infer success from a GitHub branch push alone.

After publishing, open:
- `https://dominionstarld.com/public-release.json` — its `release` must equal `V10-quality-gate-2026-10-17`.
- `https://dominionstarld.com/` — new header: Home, Mentorship Programs, Financial Services, Careers, About.
- `https://dominionstarld.com/financial-services/learning-lab/` — **Explore the guide** scrolls to the first chart; no dead anchor.
- `https://dominionstarld.com/academy/` — redirects to `/mentorship/`.
- `https://dominionstarld.com/journey/` and `/platform/` — redirect to `/opportunity/`.
- `https://dominionstarld.com/financial-services/indexed-universal-life/` — wording clearly distinguishes index-crediting floor from deductions and net cash value.

If the release marker is missing and the homepage still contains Academy, check which Netlify site owns the domain, the branch being deployed, build logs, and any CDN/cache layer. Clearing the cache is appropriate only after identifying the right deployment. Avoid silently overwriting a different site.

## Source-level QA
The public build script rejects:
- Missing assets, release identifier and browser Meet isolation
- Broken financial-product URLs
- Incorrect social-sharing metadata on the seven affected educational pages
- Missing `#learn` destination on Financial Learning Lab
- Missing index floor clarification on IUL page

## Legacy public routes
The historic `/academy/`, `/journey/`, and `/platform/` **landing routes** have forced Netlify redirects so legacy static HTML no longer shadows modern public paths. The old Academy articles route to corresponding modern educational guides. This does not change the member login or Meet.

## Separate security gate — NOT YET VERIFIED
The existing build copies a broad set of files into the public distribution. Member- and founder-facing HTML may load publicly and rely on client-side authentication. `robots.txt`, `noindex` and `X-Robots-Tag` do not restrict HTTP access or protect private data. Confirm independently that every backend read/write endpoint enforces the authenticated user's permissions and server-side Supabase row-level security, including attempts by unauthenticated requests. Do not delete existing member pages without verifying required workflows.

## Release acceptance
**Code readiness does not mean Netlify deployment completion.** A passing live-site browser and authenticated permission test is required before rating the website 100%.
