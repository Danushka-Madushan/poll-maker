# 🎃 Halloween Poll Maker

A live voting web tool for Halloween events (costume contests, pumpkin carving, best-decoration awards, party games) with a sharp, flat Halloween aesthetic. A host builds a poll out of image options, projects a QR code, the audience scans and votes on their phones, and the host reveals the winner on the big screen.

Built strictly according to [`Website Design Guide.md`](./Website%20Design%20Guide.md).

---

## ⚡ Core Features

- **2-Minute Creation**: Fast Poll Maker with client-side 1:1 image cropping, drag & drop, and auto-labeling (A, B, C...).
- **10-Second Join**: Instant QR code join with short unambiguous 6-char codes (e.g. `BOO482`). No accounts or sign-ups required.
- **Dual Screen Architecture**:
  - **Host Cockpit (`/host/:pollId`)**: Private control room with mini QR, live voter tallies, progress bar, audio mute toggle, and safety hold-to-confirm buttons.
  - **Big Screen Display (`/display/:pollId`)**: High-contrast, no-scroll, 10-meter readable view for projectors and TVs. Shows giant QR code in Lobby, options in Live, suspense banner in Closed, and dramatic 6-second reveal in Revealed.
- **Audience Voting (`/vote/:pollId`)**: Mobile-first thumb-friendly 2-column square card grid with full-screen image previews, lock-in confirmation, and real-time status transitions.
- **Cinematic Reveal (`/results/:pollId`)**: 6-second reveal sequence (screen cuts to black → "AND THE WINNER IS..." → ranked bars slide in from bottom to top → winner slams in with orange WINNER banner) with Web Audio sound effects.
- **CSV & Export**: Instant download of results as CSV.

---

## 🎨 Visual Design System

- **Palette**:
  - `--void` (`#0D0B10`): Deep dark background with subtle 5% halftone dots.
  - `--ink` (`#1A1620`): Card and panel backgrounds.
  - `--bone` (`#F4EEDF`): Primary text and high-contrast QR background.
  - `--pumpkin` (`#FF6B00`): Primary buttons, selection, and winner accent.
  - `--toxic` (`#B6FF2E`): Live status indicator (with slow 1Hz blinking square).
  - `--blood` (`#E0283C`): Danger and stop actions.
  - `--witch` (`#7A3BE0`): Lobby status accent.
  - `--ash` (`#8A8394`): Secondary and muted text.
- **Sharp & Flat**: Zero rounded corners (`border-radius: 0`), zero gradients, zero soft drop shadows.
- **Offset Blocks**: 8px hard zero-blur offset blocks for tactile feedback (`box-shadow: 8px 8px 0 var(--bone)`).
- **Typography**: `Archivo Black` (display headings), `Space Grotesk` (UI body), `Space Mono` (codes and labels).

---

## 🗺️ Application Routes

| Path | Screen | Purpose |
| --- | --- | --- |
| `/` | Home | Host entry, resume recent polls, quick how-it-works |
| `/create` | Poll Maker | 2-column builder with real-time phone preview & settings |
| `/host/:pollId` | Host Dashboard | Private cockpit with Start, Hold-to-Stop, and Hold-to-Reveal |
| `/display/:pollId` | Big Screen | TV/projector view (Lobby QR → Live → Closed → Reveal) |
| `/join/:code` | Audience Join | Resolves QR code / join code with anonymous device token |
| `/vote/:pollId` | Voting Screen | Thumb-friendly 2-column voting on mobile |
| `/results/:pollId` | Results Screen | Winner banner, full ranking bars, and CSV export |

---

## 🛠️ Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev

# 3. Production build
npm run build
```

---

## 🚀 Deployment

### Firebase Hosting (Manual CLI)
```bash
npm run deploy
```

### GitHub Actions (Continuous Deployment)
The repository includes `.github/workflows/deploy.yml` configured to build and deploy to Firebase Hosting on every push to the `main` branch.
To enable automated deployments:
1. In Firebase Console, generate a service account key or run `firebase init hosting:github`.
2. Add the secret `FIREBASE_SERVICE_ACCOUNT_POLL_MAKER_NIBM` in your GitHub repository settings under **Settings > Secrets and variables > Actions**.
