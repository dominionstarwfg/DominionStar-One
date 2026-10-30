# DominionStar — Required `main` Branch Release Protection

This repository must not perform the Agent/Founder OS production cutover while `main` is unprotected.

Current verified state during review:
- `main.protected = false`
- required status-check enforcement = off
- repository rulesets = none
- PR #183 is mergeable because no branch-level rule currently blocks a merge

## Required GitHub configuration

Configure protection for branch pattern:

`main`

Enable these controls:

1. **Require a pull request before merging**
   - Require at least 1 approval.
   - Dismiss stale approvals when new commits are pushed.
   - Require conversation resolution before merging.

2. **Require status checks to pass before merging**
   Require these exact check/job names:
   - `Verify authenticated Agent and Founder OS`
   - `Verify Agent OS notification and readability review`
   - `Build & validate review package — never deploy`
   - Recommended: `Verify main release controls`

3. **Require branches to be up to date before merging**
   - Prevent merging a stale review branch over a newer `main`.

4. **Block direct pushes to `main`**
   - Production changes should arrive through a reviewed PR only.
   - Do not permit routine bypass of the required checks.

5. **Do not allow force pushes**
   - Preserve release history and rollback traceability.

6. **Do not allow deletion of `main`**

## Verification after configuration

The workflow:

`.github/workflows/production-release-control-review.yml`

must turn green.

It verifies that:
- `main` is protected,
- the three core release checks are configured as required status checks.

Do not mark PR #183 ready for merge and do not begin the production database cutover until that workflow passes.

## Why this is a production blocker

The Agent/Founder OS cutover changes both frontend behavior and database privileges. With an unprotected `main`, a direct push or unchecked merge could trigger the Netlify production pipeline without the required database/rollback sequence. Branch protection is therefore part of the release control, not an optional repository preference.

## One-command setup

For a repository administrator with a GitHub token that has repository-administration permission:

```bash
GH_TOKEN='<admin-capable token>' bash scripts/github/apply-main-release-protection.sh
```

The script applies the required `main` protection and immediately verifies it.

To verify later without changing settings:

```bash
GH_TOKEN='<admin-capable token>' bash scripts/github/verify-main-release-protection.sh
```

Do not commit the token, store it in source files, or place it in public logs.
