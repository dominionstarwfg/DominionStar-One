# DominionStar Executive OS — Agent Settings / Meet Settings product boundary

Status: **review branch only**. No production deployment, Supabase schema changes, or desktop build generated.

## Product ownership (no duplicated settings controls)

| Product | Settings entry | UI and runtime owner | Settings included |
| --- | --- | --- | --- |
| Agent Dashboard | `/account-settings/` labeled **Agent Settings** | `account-settings/index.html`, `assets/js/account-settings.js` | Appearance, accessibility for agent OS, member messages, community and account email alerts, profile visibility, password, account sessions, optional Google account linking (Google flag remains off) |
| DominionStar Meet | Open **Meet** `/meet/` and select the built-in **Settings** control | `meet-desktop/ui/index.html`, `meet-desktop/ui/av-settings.js`, `meet-desktop/ui/preferences.js` | Audio input/output, microphone tests, video preview and effects, meeting join defaults, waiting room and participant sounds, screen-sharing preferences, meeting chat sounds, local recording, captions, shortcuts, Meet display preferences |

The public-site Netlify build packages `meet-desktop/ui/` to **`/meet/`** via `scripts/build-public-netlify.sh`. No parallel Meet Settings page was invented under Agent Settings.

## Changes staged

1. Removed Agent Settings **Audio & Video** and **Meeting Defaults** tabs and their panels.
2. Removed Agent Dashboard JavaScript which previously generated `mediaSwitches`/`meetingSwitches`, wrote `meetingMedia` into agent auth metadata and wrote `ds_meet_preferences:<user-id>` into browser local storage.
3. Removed the Agent Settings **Meeting-room alerts** checkbox. Meeting notifications remain in Meet's dedicated preferences.
4. Preserved existing authenticated account settings and their exact DOM IDs: theme, text size, general notifications, messages, privacy/security, password, sessions and dormant Google identity linking.
5. Labeled the agent navigation **Agent Settings** consistently in the member dashboard, agent page shell, and OS assistant/quick navigation.
6. Explicitly labeled the existing Meet Settings dialog and clarified it is independent from Agent Settings; did not change its media controller or Meet preference machinery.
7. The legacy `meeting_room_email_enabled` database preference is still passed through by existing Agent notification persistence for backward compatibility; it is not exposed as an Agent Settings control. Refactoring that legacy field requires a confirmed schema/policy audit before modification.

## Compatibility and QA gates

- Existing Meet preference keys `ds_pref_*` and Meet AV controller behavior stay untouched, avoiding a new settings owner or duplicate toolbar.
- No account-setting changes alter Meet media device state or the local Meet preferences namespace.
- Agent Google connection remains disabled until the previously defined Supabase OAuth/RLS gate is passed.
- New regression source test: `tests/agent-meet-settings-boundary-review.test.mjs`.
- Source verification: 28/28 checks passed including all Agent tab/panel IDs, Meet setting owners, new routing labels, and JavaScript syntax.
- Full Node test suite and real browser/desktop Meet integration were not executed in this tooling environment. GitHub repository checkout was blocked by DNS. A live deployment or native desktop test is still required before declaring production readiness.
- No user settings were migrated or reset; Meet retains its original locally stored choices.

## Separate release validation

Test with an approved agent account in the published browser Meet and the Mac desktop build:

1. Agent Settings has no microphone/camera/join settings, but account and notification controls save correctly.
2. Meet Settings has exactly one Audio, Video, Meetings, Sharing, Chat, Recording, Accessibility, Shortcuts pane and each opens with its existing behavior.
3. Changing an Agent notification setting never resets previously saved Meet preferences.
4. Changing a Meet join default persists after restarting the desktop app and does not alter Agent Settings.
5. Account security and Google identity controls remain on Agent Settings and do not appear in the Meet Settings dialog.


## Follow-up gate — Agent-only notification saves

- **Resolved hidden cross-product write:** Earlier Agent Settings code used `notification_preferences.upsert()` with `meeting_room_email_enabled` bundled into each update, even though Meet alerts had no visible Agent control.
- Agent Settings now selectively updates **only** `email_enabled`, `announcements_email_enabled`, `messages_email_enabled`, `community_email_enabled`, `appointments_email_enabled` and the audit timestamp. It never includes `meeting_room_email_enabled` in the UPDATE or INSERT payload.
- Existing rows: read-then-UPDATE with a verified updated row. Missing rows: INSERT agent fields only, permitting database defaults for Meet. If required database defaults or permissions are missing, the operation fails with a visible error. No silent false-save.
- Existing `user_metadata.dominionstar_settings.notifications` keys that the Agent page does not own (including any legacy `meetingRoom` key) are retained when the agent settings object is updated, and the separate `meetingMedia` metadata section is untouched.
- Agent Settings provides a contextual **Open DominionStar Meet** link and explicitly directs users to Meet's existing Settings dialog. It does not reproduce any Meet device or meeting configuration UI.
- A new functional regression test `tests/agent-notification-meet-isolation-runtime.test.mjs` covers existing-row update, first-row insert, failure behavior, preservation of hidden values and the left-aligned Meet handoff.
- A source-level functional simulation with a mocked authentication client and notification database verified existing-row and first-row writes, including Meet values remaining unchanged.
- **Remaining blocker:** production Supabase schema/RLS and live browser/Desktop Meet integration have not been verified; do not represent this as end-to-end complete. Tests in GitHub must still run against a checked-out branch before deployment.
