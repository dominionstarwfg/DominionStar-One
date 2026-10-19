# Gate 0 — Profile-Consumer Integration Inventory

**Status:** Review branch only, not deployed. No Supabase staging environment exists.
**Examined:** GitHub review branch source and read-only production policy/function
metadata on 2026-10-18. This is a *targeted inventory*, not proof of all consumers.

## Access-path mapping

| Consumer | Current source data access | Migration or release decision |
|---|---|---|
| `assets/js/member-directory.js` | Own status, other approved names/ranks/agent codes/location/avatar, community presence | **Staged:** `list_directory_members()` minimal fields. Remove broad directory SELECT only after other consumers migrate |
| `assets/js/community-hub.js` | Own approved profile; post author projection from `list_community_feed`; direct comment-author profile lookup | **Staged:** `list_community_comment_authors(uuid[])` for real visible comments, including authors opting out of directory |
| `assets/js/direct-messages.js` | Own approval, all approved members' name/rank/agent_code/SMD/avatar; DMs and voice storage | **Still blocked:** replace roster with scoped messageable identities; decide privacy semantics for opt-out, established DM participants, and whether SMD name is shared. Never expose agent_code |
| `assets/js/member-dashboard.js` | Own profile fields; `list_community_feed` | Retain verified own-profile read; Founder shortcut is a UI hint, not permission |
| `assets/js/professional-profile.js` | Own entire profile; calls `update_own_contact_profile` | Retain own-row access. Narrow unnecessary `SELECT *` later; verify update RPC authorization |
| `assets/js/platform-core.js` | Own entire profile, maintenance platform settings | Retain own-row access; refactor future minimal projection without breaking bootstrap |
| `assets/js/founder-admin.js` | Founder-owned profile and all profiles with administrative fields | Retain only explicit verified Founder access; Founder role must migrate from email-based checks to immutable auth identity before RLS cutover |
| `workspace/workspace.js` | Own limited profile read and formerly direct avatar UPDATE | **Staged:** `set_own_avatar_path(text)` that changes only own avatar after verifying uploaded object exists; no general UPDATE grant |
| `assets/js/presence-engine.js` | Community presence, not direct member_profiles | Presence read RLS remains too broad; remove permissive authenticated read after tests |
| `assets/js/community-2.js`, `assets/js/communication-engine.js`, `assets/js/dominionstar-os.js`, `assets/js/executive-core.js`, `assets/js/aurora-ui.js` | No direct member_profiles token found in inspected source | Check indirect functions and broader code import graph before declaring fully safe |
| `meet-desktop/ui/app.js` | No direct member_profiles token found in inspected UI file | Meet operates through other services/RPCs; do NOT infer Meet access control from this source scan |
| `netlify/functions/founder-data.mjs` | No direct member_profiles token found in inspected source | Evaluate service credentials and downstream dependencies independently |

## Database function boundaries observed

- `list_community_feed(result_limit)`: SECURITY DEFINER returns limited
  public-author profile columns for visible posts; requires approved
  viewer via EXISTS on their own member profile; useful and should be
  regression-tested before the old policy is changed.
- `community_set_presence(area,online)`: SECURITY DEFINER performs presence
  upsert by auth.uid(), not by arbitrary client-provided user ID.
- `update_own_contact_profile(...)` and
  `update_own_professional_profile(...)`: SECURITY DEFINER update fields
  where id=auth.uid(); calling privileges still need review; return full
  own row, so users must not be able to spoof caller identity.
- `member_profiles` current RLS: public-to-approved-directory rule does NOT
  require approved requester and does NOT mask columns. This is an
  **unresolved production exposure** until policy cutover.

## Pending decisions — avoid silently changing member expectations

1. A private directory profile might still appear as a Community post/comment
   author; posting inherently publishes that name to approved agents.
2. Should a private-directory member appear in Messages only to previous
   correspondents or accepted connections, or to all approved agents?
   Existing Messages currently lists all approved members regardless of
   `profile_visibility`. This is a product privacy decision.
3. Should the member's supervising SMD name appear to other members?
   Agent codes, emails, phone, addresses and private administrative notes
   should **not** be revealed through the discovery APIs.
4. Does Founder have any ability to read private DMs or their media? Current
   RLS permits this for some message rows. Define it explicitly rather than
   expanding access during UI integration.

## Release dependency map

```
Approved caller
  -> own profile SELECT: preserve
  -> directory -> list_directory_members(): staged RPC + UI
  -> community comment authors -> list_community_comment_authors(): staged RPC + UI
  -> community post authors -> list_community_feed(): existing gated RPC
  -> messaging roster -> scoped safe identity RPC: NOT YET MIGRATED
  -> Workspace avatar -> set_own_avatar_path(): staged RPC + UI
  -> founder operations -> explicit Founder authorization: NOT YET HARDENED

ONLY WHEN ALL USER-FACING CALLERS WORK:
  remove 'profile approved directory read' base-table RLS policy,
  inspect table/column grants and all SECURITY DEFINER RPCs,
  execute anonymous/pending/suspended/approved-A/B/Founder JWT tests,
  and verify two-user Community, messaging, Academy, Workspace and Meet.
```

## Evidence and testing limitations

The branch-only source changes parse and source-level contracts were checked.
No Node test runner or real multi-account functional tests have been executed.
No database migration has been applied and no Netlify site has been deployed.
All new candidate SQL lives outside automatic migration paths, so merging
without explicit SQL activation would break staged client code. **Do not merge.**

Before production release: establish an isolated, explicitly authorized
staging environment, synthetic account matrix, backup/recovery procedure,
and a reviewed single atomic integration plan.
