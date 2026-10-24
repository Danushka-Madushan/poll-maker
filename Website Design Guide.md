# Halloween Poll — Website Design Guide

A refined requirement and design specification for a live, QR-joined poll website with a sharp, flat Halloween look.

---

## 1. Product summary

**What it is:** A live voting tool for Halloween events (costume contests, pumpkin carving, best-decoration awards, party games). A host builds a poll out of image options, projects a QR code, the audience scans and votes on their phones, and the host reveals a winner on the big screen.

**Core promise:** Create in under 2 minutes. Join in under 10 seconds. No audience sign-up.

**Design personality:** Sharp, flat, loud. No gradients, no shadows, no rounded corners. Hard black borders, offset blocks, bone-white and pumpkin-orange on near-black. Spooky through shape and colour, not through cheesy cobwebs.

### Who uses it

| Role | Device | What they do |
| --- | --- | --- |
| **Host** | Laptop (control) + projector/TV (display) | Creates the poll, starts and stops it, reveals the result |
| **Audience** | Phone (scan QR) | Joins, sees options, casts one vote, sees a confirmation |
| **Big screen** | Projector / TV | Shows QR, then live status, then the result |

> **Key refinement:** The host needs two views at once: a *control* view (private, on the laptop) and a *display* view (public, on the projector). Your raw idea blends them. This guide separates them so the host never accidentally shows the control buttons to the room.

---

## 2. Poll lifecycle (the state machine)

Everything in the site hangs off one poll status. The host moves it forward; the screens react.

| # | Status | Big screen shows | Audience phone shows | Host control |
| --- | --- | --- | --- | --- |
| 1 | **Draft** | nothing public | not joinable | Poll Maker (editing) |
| 2 | **Lobby** | QR + join code + joined count | “You’re in. Waiting for host…” | **Start Poll** |
| 3 | **Live** | Options + vote progress (count only, not who is ahead) | Voting cards | **Stop Poll** |
| 4 | **Closed** | “Voting closed” holding screen | “Voting closed. Result soon.” | **Show Result** / **Reopen** |
| 5 | **Revealed** | Winner + full ranking | Winner + your pick | **New Poll** / **Replay reveal** |

**Rules**

- Only forward moves, plus one safety valve: *Closed → Live* (“Reopen”) in case the host stops by mistake.
- Stop and Show Result are deliberately two separate actions. This gives the host time to build suspense before the reveal.
- Result is never visible to anyone, including the audience, until the host triggers it.

---

## 3. Site map and screens

```
/                      Home (host entry)
/create                Poll Maker
/host/:pollId          Host Control Dashboard (private)
/display/:pollId       Big Screen (QR → Live → Result), public-safe
/join/:code            Audience entry (the page the QR opens)
/vote/:pollId          Audience voting screen
/results/:pollId       Result screen (mirrors the big screen)
```

Your original four pages map like this:

| Your idea | Refined into |
| --- | --- |
| QR / Audience login page | **Big Screen (QR state)** + **Join page** on the phone |
| Poll maker page | **Poll Maker** |
| Host control dashboard | **Host Dashboard** + **Voting screen** (audience side) |
| Result screen | **Result screen** (big screen and phone) |

---

## 4. Screen-by-screen specification

### 4.1 Home (`/`)

**Purpose:** Get the host into the Poll Maker immediately.

**Content**

- Wordmark + one-line pitch: “Let the room decide who’s scariest.”
- Primary button: **Create a poll**
- Secondary field: **Have a host link? Resume** (paste or pick from recent polls stored on this device)
- Small “How it works” strip: 1 Create → 2 Scan → 3 Vote → 4 Reveal

Keep it to a single screen. No marketing sections.

---

### 4.2 Poll Maker (`/create`)

**Purpose:** Build the options. Each image + title becomes one votable option.

**Layout (desktop):** Two columns.

- **Left (60%) — Builder:** poll title, settings, option grid.
- **Right (40%) — Live preview:** exactly what a phone will show, framed in a flat phone outline.

**Fields**

| Field | Rules |
| --- | --- |
| Poll title | Required, max 80 chars. Example: “Best Costume 2026” |
| Poll subtitle | Optional, max 120 chars |
| Options | Min 2, max 12 |
| Option image | Required. JPG/PNG/WebP, max 5 MB. Auto-cropped to 1:1 (square) with a crop tool |
| Option title | Required, max 40 chars |
| Option label (auto) | A, B, C… assigned by order, shown on the card corner |

**Option card behaviour**

- Empty state: a dashed-border square with “+ Drop image or click to upload”.
- Upload by click, drag-and-drop, or phone camera.
- Drag handles to reorder. Delete with a confirm-free **×** (with undo toast for 5 seconds).
- Duplicate button to copy a card’s title pattern quickly.
- Validation is inline and on the card itself (red border + “Needs a title”), not in a popup.

**Settings (collapsed by default, sensible defaults)**

| Setting | Default | Notes |
| --- | --- | --- |
| Votes per person | 1 | Option: allow up to N picks |
| Allow changing vote until poll stops | On |  |
| Show live vote counts on host screen | On | Never shown to audience |
| Show live counts on big screen | Off | Off keeps the reveal exciting |
| Require a nickname | Off | If on, audience types a name before voting |
| Shuffle option order per voter | On | Reduces first-option bias |
| Tie rule | Show co-winners | Alternatives: host picks / sudden-death revote |

**Primary action:** **Create Poll** → generates the poll and join code, moves status to *Lobby*, redirects to Host Dashboard.

**Autosave:** Draft saved locally every few seconds so a refresh never loses work.

---

### 4.3 Big Screen, QR state (`/display/:pollId`, status = Lobby)

**Purpose:** The page the audience sees projected. Must be readable from the back of a room.

**Layout**

- Left 55%: giant QR code on a bone-white square with a thick black border (high contrast, quiet zone preserved).
- Right 45%: poll title (huge), instruction “SCAN TO VOTE”, the short join code in monospace (e.g. `BOO-482`), and the URL as fallback text.
- Bottom strip: **“37 joined”** live counter with a flat blinking square indicator.

**Rules**

- QR must be at least 40% of screen height.
- The join code is 6 characters, uppercase, no ambiguous letters (no O/0, I/1).
- The host’s control buttons never appear on this screen.
- When the host presses Start, this screen switches to the Live state automatically (no refresh).

---

### 4.4 Audience Join page (`/join/:code`)

**Purpose:** What the audience lands on after scanning. Replaces your “audience login”.

- No account, no password. Identity is an anonymous device token stored in the browser.
- If *Require a nickname* is on: a single field + **Join** button.
- If off: auto-join and show the waiting state immediately.
- Shows poll title and a **waiting** card: “You’re in. Host will start shortly.”
- If the poll is already Live, skip straight to voting.
- If the poll is Closed/Revealed, show a polite “This poll has ended” + result when revealed.

---

### 4.5 Host Control Dashboard (`/host/:pollId`)

**Purpose:** The host’s private cockpit. Calm, large buttons, impossible to misclick.

**Layout (desktop)**

```
┌──────────────────────────────────────────────────────────┐
│ POLL TITLE                         STATUS: ■ LOBBY       │
├───────────────┬──────────────────────────────────────────┤
│  JOIN INFO    │   OPTIONS (read-only grid)               │
│  mini QR      │   [A] [B] [C] [D]                        │
│  code, link   │   live count per option (host only)      │
│  37 joined    │                                          │
├───────────────┴──────────────────────────────────────────┤
│  [ OPEN BIG SCREEN ↗ ]        [ ► START POLL ]           │
└──────────────────────────────────────────────────────────┘
```

**Primary button changes with status** (only one primary at a time):

| Status | Primary button | Secondary |
| --- | --- | --- |
| Lobby | **Start Poll** | Edit options, Open big screen |
| Live | **Stop Poll** | Pause, Open big screen |
| Closed | **Show Result** | Reopen voting |
| Revealed | **New Poll** | Replay reveal, Export CSV |

**Dashboard panels**

- **Join panel:** small QR, code, copy link, joined count.
- **Options panel:** the created options as cards. Once Live, each shows its live vote count and percentage bar (host only).
- **Activity strip:** “Votes in: 28 / 37 joined” with a progress bar.
- **Big-screen button:** opens `/display/:pollId` in a new window to drag onto the projector.

**Safety**

- **Stop Poll** and **Show Result** use a *press-and-hold for 1 second* confirmation (the button fills with orange as you hold). No modal dialogs.
- **Start Poll** locks the options. Editing after start is disabled.
- Host can remove a suspicious vote or kick a participant from a small participants drawer (optional).

---

### 4.6 Audience Voting screen (`/vote/:pollId`)

**Purpose:** Fast, thumb-friendly voting on a phone.

**Layout**

- Sticky top bar: poll title + small “1 vote left” chip.
- Options in a 2-column grid of square image cards. Each shows image, the A/B/C label, and the title beneath.
- Tap a card to select it: thick orange border + a flat check block in the corner.
- Sticky bottom bar: a full-width **CAST VOTE** button, disabled until a choice is made.
- Tapping an image opens a full-screen preview (tap again to close) so people can see costume detail before committing.

**After voting**

- Card grid replaced by a “VOTE LOCKED IN” confirmation showing the chosen option.
- If *Allow changing vote* is on: a **Change vote** link remains until the host stops the poll.
- The phone updates itself to “Voting closed” and later to the result, with no manual refresh.

---

### 4.7 Result screen (`/results/:pollId` and the Big Screen reveal)

**Purpose:** The payoff. Treat this as a moment.

**Reveal sequence** (triggered by **Show Result**, about 6 seconds):

1. Screen cuts to black with a flat “AND THE WINNER IS…” line.
2. Options are listed from last place upward, one per second, each bar sliding in.
3. The winner’s card slams in last, enlarged, with an orange full-width banner reading **WINNER**.

**Final layout**

- Top: winner block — large image, title, vote count, percentage.
- Below: ranked list of every option as horizontal flat bars (winner orange, others bone-white on dark).
- Footer: total votes cast, total participants, turnout percentage.
- Host-only actions (control view): **Replay reveal**, **Export CSV**, **New Poll**.

**Edge cases**

- **Tie:** show co-winners side by side with a “TIE” tag (default). Host may trigger a quick revote between tied options.
- **Zero votes:** “No votes cast” message with a Reopen button for the host.
- **Reduced motion:** the reveal skips animation and shows the final state.

---

## 5. Visual design system

### 5.1 Principles

1. **Flat:** zero gradients, zero blur, zero drop shadows.
2. **Sharp:** `border-radius: 0` everywhere. Corners are cut, never rounded. Optional diagonal clipped corner on hero blocks.
3. **Hard edges:** 3–4px solid borders in near-black or bone.
4. **Offset blocks instead of shadows:** emphasis comes from a solid colour block offset 6–8px behind an element.
5. **One loud accent at a time:** orange leads. Green and purple are accents for status, not decoration.

### 5.2 Colour palette

| Token | Hex | Use |
| --- | --- | --- |
| `--void` | `#0D0B10` | Page background |
| `--ink` | `#1A1620` | Panels, cards |
| `--bone` | `#F4EEDF` | Primary text, QR background |
| `--pumpkin` | `#FF6B00` | Primary buttons, selection, winner |
| `--toxic` | `#B6FF2E` | Live / success status |
| `--blood` | `#E0283C` | Stop, errors, danger |
| `--witch` | `#7A3BE0` | Secondary accent, info, lobby status |
| `--ash` | `#8A8394` | Muted text, disabled |

**Contrast notes:** bone on void and pumpkin on void both exceed 4.5:1. Put **void text on pumpkin and toxic**, never bone on pumpkin.

### 5.3 Typography

| Role | Font | Style |
| --- | --- | --- |
| Display / headings | **Archivo Black** (fallback: Impact, sans-serif) | UPPERCASE, tight tracking, line-height 0.95 |
| Body / UI | **Space Grotesk** | 500 weight, sentence case |
| Labels, codes, counts | **Space Mono** | UPPERCASE, wide tracking |

**Scale (desktop / mobile)**

| Style | Desktop | Mobile |
| --- | --- | --- |
| Display XL (winner, QR title) | 96px | 44px |
| H1 | 56px | 32px |
| H2 | 32px | 24px |
| Body | 18px | 16px |
| Label | 13px | 12px |

Big-screen mode (`/display`) scales everything up about 1.5× and enforces a minimum 28px for any text.

### 5.4 Shape, spacing, borders

- Spacing scale: 4, 8, 16, 24, 32, 48, 64.
- Standard border: 3px solid `--bone` on dark panels; 4px solid `--void` on bone panels.
- Offset block: `box-shadow: 8px 8px 0 var(--pumpkin)` (a hard, zero-blur shadow acts as the offset block; this is the one permitted use).
- Grid: 12 columns desktop, 4 columns mobile, 16px gutter.

### 5.5 Halloween texture without clutter

Use **geometric** motifs only, built from flat shapes:

- Diagonal hazard stripes (pumpkin and void) as section dividers and on the “Live” banner.
- Sharp zig-zag edge (a row of triangles) like jagged teeth along panel tops.
- Flat geometric icons: pumpkin (octagon + notch face), ghost (rectangle + zig-zag base), bat (angular wing silhouette), skull, candle. All drawn as straight-line SVG, single colour.
- Subtle halftone dot pattern at 5% opacity on the page background.
- Occasional flat floating shapes (bats crossing the screen) on the Home and Result screens only, never during voting.

### 5.6 Components

| Component | Spec |
| --- | --- |
| **Primary button** | Pumpkin fill, void text, 3px void border, 8px offset block in bone. Hover: shifts 4px toward the offset (offset shrinks). Active: offset gone. |
| **Danger button** | Same, blood fill, bone text |
| **Hold-to-confirm button** | Fill sweeps left to right over 1s, label becomes “KEEP HOLDING” |
| **Option card** | Square image, 3px border, mono label chip (A, B…) top-left in a solid block, title in bar below. Selected: pumpkin border + corner check block |
| **Status chip** | Mono text in a rectangle: Lobby (witch), Live (toxic, blinking square), Closed (ash), Revealed (pumpkin) |
| **Input** | Void fill, 3px bone border, no radius, focus = pumpkin border (no glow) |
| **Toast** | Bottom-left rectangle, bone fill, void text, slides in with a step animation |
| **Progress bar** | Flat track in ink, fill in pumpkin, segmented into square ticks |
| **Result bar** | Full-width horizontal block, height 56px, label inside left, percentage inside right |

### 5.7 Motion

- Use **stepped / linear** easing (`steps()` or `linear`) to keep the mechanical, flat feel. No bouncy springs.
- Durations: UI 120ms, screen transitions 240ms, reveal sequence about 6s.
- Screen transitions: a hard wipe (a pumpkin block slides across, then off).
- Respect `prefers-reduced-motion`: replace wipes and reveals with instant cuts.
- Optional sound (off by default, one toggle for the host): a creak on reveal, a sting on the winner.

---

## 6. Functional requirements

### 6.1 Must have (MVP)

1. Create a poll with 2–12 image + title options.
2. Generate a unique short join code and a QR code pointing to the join URL.
3. Big Screen page that shows the QR and live joined count.
4. Host dashboard with Start, Stop, Show Result and Reopen.
5. Audience join with no sign-up; one vote per device per poll.
6. Voting screen with image cards, cast vote, confirmation.
7. Real-time sync: status changes reach all phones and the big screen within about 1 second.
8. Result screen with winner, ranking, percentages, total votes.
9. Tie handling (co-winners).
10. Responsive: phone (audience), laptop (host), 16:9 TV (display).

### 6.2 Should have

- Image crop and compress on upload.
- Optional nickname.
- Change vote until stop.
- Shuffle option order per voter.
- Press-and-hold confirmation on destructive actions.
- Export results as CSV and as a shareable PNG of the result.
- Poll auto-saved as draft.

### 6.4 Out of scope for v1

Audience accounts, payments, free-text answers, moderation tooling for uploaded images beyond basic file checks.

---

## 7. Vote integrity and edge cases

| Situation | Behaviour |
| --- | --- |
| Same person votes twice | Blocked by device token; with *Allow change* on, the second vote replaces the first |
| Cleared cookies / second browser | Can create a second token; accepted risk for a party tool. Optional: IP rate limit per poll |
| Late joiner after Start | Goes straight to the voting screen |
| Joins after Stop | Sees “Voting closed” |
| Host refreshes or loses connection | Dashboard restores from server state; polls persist |
| Phone loses connection mid-vote | Retries with a small “Reconnecting…” bar; vote is idempotent |
| Host closes the big screen window | Reopen from dashboard; state is identical |
| Oversized or non-image upload | Rejected inline with a clear message |
| Only one option added | **Create Poll** stays disabled with a hint “Add at least 2 options” |
| Poll left idle | Auto-expires after 24 hours; host can extend |

---

## 8. Suggested technical approach

| Concern | Suggestion |
| --- | --- |
| Front end | React + Vite (or Next.js), CSS variables for the design tokens |
| Real-time | Firebase |
| Backend / data | Firebase |
| Image storage | imgbb |
| QR code | Client-side generation (e.g. `qrcode` library), error-correction level M or higher |
| Auth | None for audience; host identified by a secret host token in the host URL (and later optional accounts) |
| Hosting | github pages |

### Data model (simplified)

```
Poll        id, hostToken, title, subtitle, status, joinCode,
            settings{...}, createdAt, startedAt, closedAt
Option      id, pollId, order, label, title, imageUrl
Participant id, pollId, deviceToken, nickname?, joinedAt
Vote        id, pollId, participantId, optionId, createdAt
```

Results are computed as the count of `Vote` rows per `Option`, ranked descending, with ties flagged.

---

## 9. Copy and tone

Playful, short, a little menacing. Never obscure the action.

| Moment | Copy |
| --- | --- |
| Home pitch | “Let the room decide who’s scariest.” |
| QR screen | “SCAN TO VOTE. IF YOU DARE.” |
| Waiting | “You’re in. The host is summoning the poll…” |
| Vote CTA | “CAST YOUR VOTE” |
| Vote locked | “VOTE LOCKED IN. NO TAKE-BACKS.” (adjust if change is allowed) |
| Closed | “VOTING IS CLOSED. THE SPIRITS ARE COUNTING.” |
| Reveal lead-in | “AND THE WINNER IS…” |
| Tie | “A TIE. THE DEAD CANNOT DECIDE.” |
| No votes | “NOBODY VOTED. SPOOKY.” |

---

## 10. Accessibility and legibility

- Minimum 4.5:1 text contrast; verify pumpkin, toxic and blood against their text colours.
- Never rely on colour alone: status chips always carry text; selected options carry a check block.
- All images need alt text, taken from the option title.
- Tap targets at least 48×48px on phones.
- Visible focus state: 3px pumpkin outline with 2px offset.
- Big-screen text readable from about 10 metres: QR at least 40% of the height, body at least 28px.
- Flashing limit: no element flashes more than 3 times per second (the live-status blink is slow, about 1Hz).
- Reduced-motion and sound toggles respected.

---

## 11. Responsive behaviour

| Surface | Width | Notes |
| --- | --- | --- |
| Audience phone | 360–430px | Single column header, 2-column option grid, sticky bottom CTA |
| Host laptop | 1280px+ | Two-column dashboard with live preview or options panel |
| Host tablet | 768–1024px | Panels stack; primary button pinned at the bottom |
| Big screen | 1920×1080 (16:9) | Fixed layout, scaled by viewport units; no scrolling ever |

---

## 12. Suggested build order

1. Design tokens (colours, type, border, offset block) and the component kit.
2. Poll Maker with image upload and validation.
3. Data model and realtime status sync.
4. Join flow and QR Big Screen.
5. Host Dashboard and state transitions.
6. Audience voting and vote counting.
7. Result calculation and the reveal sequence.
8. Edge cases, accessibility pass, then polish (patterns, motion, sound).

---

## 13. Open decisions for you

These change the build, so decide early:

1. **One vote or multiple picks per person?** Recommended: one vote.
2. **Should the audience see live counts?** Recommended: no, keeps the reveal exciting.
3. **Are host accounts needed**, or is a secret host link enough? Recommended: secret link for v1.
4. **Single poll per event, or a multi-round event** (several categories)? Recommended: single poll first, rounds later.
5. **Do you want nicknames shown** anywhere (e.g. a “who voted” wall)? Recommended: no, keep it anonymous.
