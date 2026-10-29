# DominionStar Executive OS — Member Identity Visibility Gate

**Review branch only · No production deployment**

## Account identity experience

On the dashboard, each authenticated member sees:
- **Welcome back, [preferred first name].**
- **Full name**, **contract level** (TA / Associate / SA / MD / SMD), and an actual profile photograph where authorized Storage returns a signed URL.
- Their initials in a circular avatar when their photo is absent, inaccessible, broken, or expired.
- A **Founding Member** badge only when the authoritative `member_profiles.founding_member` flag is true. Display the assigned #01–#20 number only when valid; otherwise show the flag without inventing a number.

Topbar and hero show the same identity. The community post composer also shows the same name/credentials/photo. Community feed post headers show each author's name, contract level, signed avatar and assigned founding number when applicable; other members do not receive honorary founder markers.

## Performance and permissions

1. Base member identity is shown immediately after the authenticated profile is loaded; optional Founder-authority and founding-number RPCs are non-blocking and bounded.
2. Founder tools only become visible after the existing server-side `is_dominionstar_founder` RPC grants access. Member profile claims must not bypass RLS.
3. Signed avatar failures cannot prevent rendering of the dashboard or community feed.
4. Existing `list_community_feed` PostgreSQL function was inspected via read-only SQL; it returns `author_full_name`, `author_preferred_name`, `author_rank`, `author_exclusive_number`, and `author_avatar_path`. **No database schema, RLS policy, or production record was changed**.
5. This implementation does not change membership approval or mint an artificial Founding Member status.
6. Source checks pass, including three JavaScript syntax checks. Real authenticated end-to-end, slow-network and avatar expiring-URL tests remain required.

## Visual preview

The illustrative profile pictures of **John Williams**, **Maria Chen** and **Alex Morgan**, as well as engagement counts, are entirely fictional demonstration content in a separate HTML file. The review-branch application retrieves actual approved-member profile data, not demo names or images.

Desktop/mobile screenshots and an interactive HTML preview are distributed separately for design approval. Primary actions remain on the left. No “2030” label is displayed.

