# APPROVED ACCEPTANCE STANDARD — DominionStar Meet multi-participant and sharing UX

**Approved reference date:** October 14, 2026
**Authority:** Three user-supplied screenshots of a seven-person desktop meeting, shared screen, floating Participants window and floating participant-video strip.
**Status:** Hard **release gate**, not an aspirational illustration. Any failing condition below means **FAIL — do not release, merge, distribute or call production-ready.**
**Scope:** Host, co-host, ordinary guest; Mac desktop and browser; small and large displays.
**Product terminology:** Use `DominionStar Meet`, `Participants`, `Meeting controls`, and `Video panel`; the competitor's interface is a reference, **not** a component or product name.

## A. Screenshot-grounded UI facts

1. Participants list is an independent compact floating window. Header has traffic-light controls placed in a horizontal row at the upper-left, separate from the centered `Participants (7)` title. A search input follows beneath the header. Participant rows have unobstructed avatar/profile picture, full readable or gracefully ellipsized name, distinct `(Host, me)` and `(Co-host)` metadata, independent mute/video status icons, and a discoverable per-participant actions menu. The lower row `Invite`, `Mute all`, `More` remains visible without participating in list scroll. Do not reproduce the reference's literal names or images in code.
2. Long lists scroll **inside the participant roster** without scrolling the title/search/footer. At least approximately five rows are visible when the window has space; additional rows remain discoverable. No duplicate row, blinking, disappearing or oscillating search/toolbar state. Menu actions must be real permission-checked host/co-host/participant actions, not inert decoration.
3. The visible participant-video panel is separate from the main stage, aligned to the right on a sufficiently wide/tall meeting window. It shows video or avatar tiles with high contrast name labels, single clean slash only for muted mic, and speaking highlight when speech is observed. The approved examples show approximately six tiles on a tall desktop (video on the first, muted avatars for others), plus an internal scroll affordance for overflow.
4. During screen sharing, the actual moving slide/video or app content takes the primary stage. The video panel and sharing controls stay available without covering important shared content. The top status strip correctly says the screen is being shared, offers `Stop share`, and the floating presenter toolbar stays independent. The green share outline must fit the captured/shared bounds without a cropped lower edge. `Pause`, `Resume`, `Stop`, `Chat`, `Participants`, `Annotate`, and camera/mic controls must function.
5. The meeting toolbar displays the **live participant count** without needing to open the Participants window. In the example, the count is seven. Host/co-host/guest views receive the same roster count and share state.

## B. Intelligent geometry — approved behavior, not hard-coded screenshots

- **Wide/tall view:** dock video panel on the **right**, in a stable vertical strip. Determine available-height capacity using the *actual visible bounds after sharing toolbar, OS menu, and margins*, not a fixed participant count. Render five or six tiles when space permits, with internal scroll for overflow and no outer-page scroll.
- **Narrow/short view:** if the right strip would steal critical stage space, collide with controls, or crop tiles, automatically move it **to the top as a horizontal strip**. Recalculate when resizing, restoring/minimizing, changing display, entering/exiting full screen, starting/stopping share or reopening window. Preserve each tile's aspect ratio. On a small screen the strip scrolls horizontally instead of exceeding the viewport.
- **Size specification:** 176×99px is the existing desktop tile baseline, **not a reason to overflow a small display**. Preserve aspect ratio and minimum legibility, adapt visible count, and keep stable approved proportions. The existing 318×390 Participants panel and 42px row baseline must be responsive rather than enforced where the actual viewport makes that infeasible.
- No oscillation between top/right during small pointer movements or incremental resize; hysteresis around breakpoint changes and a single layout authority per surface. No collapsed/duplicated titlebar, no vertical traffic lights, no clipped names/icons.
- The video panel scroll container owns scrolling, **not** the meeting stage, top toolbar or entire overlay. Do not silently hide overflow participants.

## C. Media behavior — must prove functioning, not merely visually plausible

- In a normal meeting, the main stage follows an actually speaking participant (or an explicit host spotlight); an unmuted silent participant does not steal the stage. Local and remote active-speaker indications must follow the correct participant without flashing.
- When screen share is active, **real shared content** has primary visual priority. The sender and receiver independently confirm actual frame progress; a green outline or `You are screen sharing` banner is insufficient.
- Both host and guest see the host's camera and guest camera when actually enabled, at the same time as screen sharing. Camera off means profile photo when present, otherwise initials. Distinct people never show another participant's image.
- Video tiles do not blink, disappear, go black, jump around, or materialize only after touching the camera toggle; speaking, mute, join/leave, screen-share and window movements must not remount unchanged video elements.
- All presenters and participants can view moving screen-share **video**, not just a static first frame. Audio/video controls reflect real mic/camera track state. Noise isolation may be mild but must not distort speech.
- Screen share stop, peer leave/rejoin, host leave/end for all and app restart release capture devices and floating windows. No stranded green outline, camera indicator, extra toolbar, or ghost meeting.

## D. Required acceptance matrix

| Trial | Demonstrated outcome required |
| --- | --- |
| Solo host, camera on/off, stored profile photo and no photo | Correct centered photo/initials; stable stage and prejoin |
| 2-person desktop↔desktop | Each sees other's live video and hears audio without rejoin loops, flashing or blackout |
| Desktop host↔browser guest | Both receive live camera; browser guest receives and decodes native presenter screen-share frames |
| 7-person host + co-host + five guests | Accurate `Participants (7)` title and toolbar count; clearly visible Host/Co-host labels; correct independent mic/video actions |
| Participant panel 7+ | Rows scroll internally while title/search/footer stay fixed; usable menu actions |
| Right-dock tall display | At least ~5 and up to ~6 visible tiles when space permits; overflow internal vertical scroll |
| Narrow or short meeting window | Automatic horizontal top filmstrip; scroll internal horizontally; no obscured share or geometry collision |
| Resize, maximize, move between displays, start/stop sharing | Deterministic responsive orientation; no jitter, duplicate controls or tile remount |
| Host shares high-motion video and slides; guest watches | Receiver's `framesDecoded`, video dimensions and `currentTime` progress; moving shared content visible end-to-end |
| Speaker changes during normal call; share begins during speech | Actual active speaker stage; share stage takes priority when sharing; no panel flicker |
| Annotation and presenter controls | Approved compact toolbar, responsive pen, laser, Pause/Resume/Stop, Participants/Chat functional |
| Leave, end-for-all and restart | Devices released, windows gone, clean next launch, no lingering toolbar |

## E. Pass/fail evidence discipline

Each claim of passing requires **real** screens of BOTH ends, synchronized test steps, applicable decoded/sent RTP counters, a record of display resolution and macOS/browser version, plus the absence of observed blinking/freezes after sustained use.

Passing source text checks, unit mocks, GitHub Actions, or a successful installer build is **not** visual/media acceptance. If **any** referenced layout/functional standard fails on either computer, mark the whole candidate **REJECTED**. Freeze known-good modules and repair the specific subsystem with regression tests; do not re-skin previously approved portions as a workaround.

**No new general release, no production installer, and no declaration of final acceptance until this matrix passes.**
