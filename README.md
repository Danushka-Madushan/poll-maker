# 🎃 Halloween Poll Maker

[![React 19](https://img.shields.io/badge/React-19.3-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4.3-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-13.1-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)
[![Deployment](https://img.shields.io/badge/Deploy-Firebase%20Hosting-FF5416?style=flat-square&logo=firebase&logoColor=white)](https://poll-maker-nibm.web.app)

> **A real-time, zero-friction live voting engine built for Halloween costume contests, pumpkin carvings, and party games.**  
> Built strictly to a high-contrast **Neo-Brutalist Halloween Design System** — zero rounded corners, tactile offset shadows, instant QR join, dual-screen synchronization, and an optional weighted Jury Ballot system.

🌐 **Live Production Application:** [vote.danushka.me](https://vote.danushka.me) (or [poll-maker-nibm.web.app](https://poll-maker-nibm.web.app))

---

## ⚡ Core Value Proposition

| Promise | How It's Achieved |
| :--- | :--- |
| **Create in under 2 minutes** | In-browser 1:1 image cropping and rotation, drag-and-drop / mobile gallery photo upload, automatic alphabetical contestant tagging (`A`, `B`, `C`...), and a real-time mobile simulator preview. |
| **Join in under 10 seconds** | Audience members scan a high-density QR code or punch in a 6-character code (e.g., `BOO482`). Zero app downloads, zero account creation, and zero social sign-ins. |
| **100% Real-time & Dual-Screen** | Host operates a private, confidential cockpit on laptop or phone while projecting a public-safe TV display on big screens or projectors via Firebase Firestore real-time snapshot sync. |
| **Jury Ballot Weighted Scoring** | Host-activated Special Votes phase allowing physical Jury ballots (5 pts each) to be combined with audience QR votes (1 pt each), while strictly preserving 100% Jury privacy. |
| **Theatrical Suspense Reveal** | Step-by-step unmasking with a 6-second blackout reveal sequence, Web Audio synthesized victory sound effects, and a 3-tier towering 3D monolith podium. |

---

## 🏛️ Real-Time Dual-Screen Architecture

Halloween Poll Maker decouples the **Host Control Room** from the **Audience Big Screen Display** to prevent accidental spoilers or awkward UI controls on event projectors:

```
                          ┌──────────────────────────┐
                          │   Firebase Cloud Store   │
                          │   Real-Time Data Engine  │
                          └─────────────┬────────────┘
                                        │ (Sub-100ms sync)
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
┌──────────────────┐           ┌──────────────────┐           ┌──────────────────┐
│  Host Cockpit    │           │ Big Screen TV    │           │  Audience Phones │
│  /host/:pollId   │           │ /display/:code   │           │  /vote/:pollId   │
├──────────────────┤           ├──────────────────┤           ├──────────────────┤
│ • Start/Stop/End │           │ • 10-meter QR    │           │ • 2-Col Card Grid│
│ • Private Leader │           │ • Live Contenders│           │ • Single Ballot  │
│ • Jury Console   │           │ • Jury Veil      │           │ • Vote Lock-in   │
│ • Tie-Breaker UI │           │ • Suspense Veil  │           │ • Auto-Reconnect │
│ • Hold Buttons   │           │ • Tower Podium   │           │ • Jury Suspense  │
└──────────────────┘           └──────────────────┘           └──────────────────┘
```

---

## 🎯 Key Features & Capabilities

### 1. ⚡ Fast Contestant Builder (`/create`)
- **Native Canvas Cropper**: Upload square or vertical images; rotate 90° or zoom directly in-browser using an interactive canvas modal with 3x3 rule-of-thirds gridlines.
- **Mobile Gallery Picker**: Direct support for mobile camera roll and photo library without forcing live camera snapping.
- **Client-Side Compression**: Transparently scales and recompresses heavy mobile photos to under 800KB WebP/JPEG, ensuring instant loads even on crowded event Wi-Fi.
- **Interactive Sticky Simulator**: Live smartphone preview reflects title changes, option titles, and photos in real time as you build.

### 2. 📺 Dedicated TV Portal & Alias Routing (`/display`)
- **6-Character Code Alias**: Big screens can navigate directly to `/display` and enter the 6-character poll code (e.g. `BOO482`), or visit `/display/BOO482` directly without typing cumbersome 32-character Firestore UUIDs.
- **10-Meter Legibility**: Auto-scaling typography (`clamp`), high-contrast bone-on-void styling, and no page scrolling required.
- **Theatrical Crypt Monolith Podium**:
  - Gold-gilded 1st Place Central Towering Monolith.
  - Symmetrically aligned Silver (#2) and Bronze (#3) Altars.
  - Interactive runner-up ticker strip for contests with 4+ entries.
  - Canvas confetti and soaring bat particle physics.

### 3. 🛡️ Private Host Cockpit (`/host/:pollId`)
- **Safety Hold-to-Confirm**: Destructive transitions (Start Haunt, Freeze Votes, Reveal Winner) require holding the button for 1 second (`HoldButton`), preventing accidental taps in high-energy party settings.
- **Confidential Preview**: The host sees who is leading while voting is frozen in the `Closed` or `Special Votes` state, without exposing results on the big screen.
- **Tie-Breaker Control**: When contests result in a dead heat, hosts can either crown a singular champion or preserve co-winners.
- **Audience Management**: Real-time counter of connected devices with a collapsible audience roll call.

### 4. ⚖️ Special Votes (Jury Ballot System)
- **Host-Configurable**: Toggle in Poll Maker under Step 3 to activate the Jury Ballot ritual.
- **Weighted Scoring Model**:
  - **Audience QR Votes**: 1 point each.
  - **Physical Jury Votes**: 5 points each.
  - **Total Score**: $(\text{Audience Votes} \times 1) + (\text{Jury Votes} \times 5)$.
- **Dedicated `special_voting` Phase**: When normal voting concludes, the poll transitions into the Special Votes phase.
- **100% Jury Privacy**: Big Screen and audience phones display *"SPECIAL VOTES COUNTING… THE JURY IS CASTING THEIR BALLOTS."* without leaking vote origins or contestant numbers. Final results display total points (`X PTS (Y%)`) with zero public breakdown.
- **Host Jury Console**: Tactile contestant cards with `[ - ]` and `[ + ]` steppers, quick `+1 JURY (5 PTS)` and `+5 (25 PTS)` buttons, points pool metrics, and safety reset modal.
- **Safety Reopen Valve**: `↺ REOPEN QR VOTING` allows the host to resume audience voting if stopped prematurely without losing any entered jury ballots.

### 5. 📱 Frictionless Voter Client (`/vote/:pollId`)
- **Anonymous Device Fingerprinting**: Combines browser storage and hardware entropy tokens (`getDeviceToken()`) to enforce **one-vote-per-person** without requiring Google, email, or phone authentication.
- **Thumb-Friendly 2-Column Grid**: Large tap targets with tactile orange selection borders.
- **Ballot Lock-In**: Full-screen confirmation modal with haptic feedback to prevent accidental misclicks.
- **Offline Resilience**: Automatically detects connectivity drops (`navigator.onLine`) and presents an offline reconnection status bar without dropping ballot state.

### 6. 🔊 Pure Synthesized Web Audio Engine
- **Zero MP3/WAV Dependencies**: All sound effects are procedurally generated in real time using the native browser `AudioContext` and oscillator nodes:
  - 🔘 **Card Tap**: Crisp 800Hz transient click.
  - 🔔 **Lobby Gong**: Heavy 120Hz sub-bass gong resonance.
  - ⚡ **Suspense Drone**: Eerie 55Hz pitch-swept saw-tooth wave.
  - 🎺 **Victory Fanfare**: Ascending arpeggio chord progression (`C4` → `E4` → `G4` → `C5`).
- **Global Mute Cockpit**: Host can instantly mute or unmute audio effects with state preserved in localStorage.

### 7. 📊 Analytics, CSV & Social Export
- **1-Click CSV Export**: Download complete poll tallies, voter turnout percentages, and contestant breakdowns with standardized timestamps.
- **Social Card Canvas Generator**: Client-side generation of branded 1200x630px result banners for direct sharing on Instagram, Discord, or X.

---

## 🎨 The Neo-Brutalist Halloween Design System

Strictly adhering to [`Website Design Guide.md`](./Website%20Design%20Guide.md), the user interface rejects generic gradients and rounded corners in favor of a raw, physical, high-impact aesthetic:

### Design Principles
1. **Zero Rounded Corners**: Globally enforced `border-radius: 0 !important` across all buttons, inputs, modal dialogs, and cards.
2. **Hard Block Shadows**: High-contrast, zero-blur offset drop shadows (`4px 4px 0` or `8px 8px 0`).
3. **Physical Depth**: Heavy 2px to 4px solid borders with tactile hover compression (`transform: translate(2px, 2px)`).
4. **Geometric Spooky**: Procedural SVG jagged teeth edges, 45-degree yellow/black hazard stripes, and custom Halloween SVGs (`Ghost`, `Skull`, `Candle`, `Pumpkin`, `Bat`, `Cauldron`).

### Color Palette

| Token | Hex | Role | Contrast Rule |
| :--- | :--- | :--- | :--- |
| `--void` | `#0D0B10` | Primary deepest background | Base canvas |
| `--ink` | `#1A1620` | Surface cards & panels | Secondary elevation |
| `--crypt` | `#1E1E22` | Podium monoliths & borders | Tertiary elevation |
| `--bone` | `#F4EEDF` | High-contrast body text & QR code | Primary foreground |
| `--ash` | `#8A8394` | Monospace subtext & metadata | Muted elements |
| `--pumpkin` | `#FF6B00` | Primary buttons, selections & Winner | **Always pair with `--void` text** |
| `--toxic` | `#B6FF2E` | Live haunt status & checkmarks | **Always pair with `--void` text** |
| `--blood` | `#E0283C` | Destructive actions, reset & stop | Danger foreground |
| `--witch` | `#7A3BE0` | Lobby state & Jury Ballot phase | Paired with `--void` text |

---

## 🔄 Finite State Machine (Poll Lifecycle)

Every screen automatically transitions based on the active state in Firestore:

```
┌─────────┐      Host Starts      ┌─────────┐      Host Stops      ┌────────────────┐
│  LOBBY  │ ────────────────────> │  LIVE   │ ───────────────────> │ SPECIAL VOTES  │
└────┬────┘                       └─────────┘    (or CLOSED)       │   (or CLOSED)  │
     │                                 ▲                           └───────┬────────┘
     │                                 │ Host Reopens (Safety)             │ Host Reveals
     │                                 └───────────────────────────────────┤
     ▼                                                                     ▼
[ Big Screen: QR Code ]          [ Audience: Vote Cards ]            ┌──────────┐
[ Audience: "Waiting" ]          [ Big Screen: Contenders]           │ REVEALED │
                                                                     └──────────┘
                                                                 [ Podium & Winner ]
```

| State | Big Screen Display | Audience Mobile | Host Control Actions |
| :--- | :--- | :--- | :--- |
| **`lobby`** | Giant QR + 6-Char Code + Live Join Counter | "You're in. Waiting for host…" | `PUSH & HOLD TO START` |
| **`live`** | Live contestant gallery + Turnout progress bar | Interactive 2-column voting cards | `PUSH & HOLD TO STOP` |
| **`special_voting`** | "SPECIAL VOTES COUNTING. THE JURY IS CASTING BALLOTS." | "Special votes counting… Awaiting reveal" | `PUSH & HOLD TO REVEAL` or `REOPEN QR VOTING` |
| **`closed`** | Suspense veil ("RESULTS ARE BEING SEALED") | "Voting closed. Awaiting reveal…" | `REOPEN VOTING` or `REVEAL WINNER` |
| **`revealed`** | 3-Tier Podium + Confetti + Monoliths | Winner banner + "Your Pick" badge | `REPLAY REVEAL` or `CREATE NEW` |

---

## 🗺️ Application Routes

| Path | Component | Purpose |
| :--- | :--- | :--- |
| `/` | [`Home.tsx`](./src/pages/Home.tsx) | Host entry, recent polls cache resume, feature breakdown |
| `/create` | [`PollMaker.tsx`](./src/pages/PollMaker.tsx) | 2-column builder with real-time phone preview & crop modal |
| `/host/:pollId` | [`HostDashboard.tsx`](./src/pages/HostDashboard.tsx) | Private host cockpit with safety buttons, leader preview & Jury console |
| `/display` | [`BigScreen.tsx`](./src/pages/BigScreen.tsx) | TV quick launcher (enter 6-character poll code) |
| `/display/:pollId` | [`BigScreen.tsx`](./src/pages/BigScreen.tsx) | Projector/TV view (QR code → Live gallery → Crypt podium) |
| `/join/:code` | [`JoinPage.tsx`](./src/pages/JoinPage.tsx) | Audience QR bridge; assigns anonymous device fingerprint |
| `/vote/:pollId` | [`VoteScreen.tsx`](./src/pages/VoteScreen.tsx) | Thumb-friendly mobile voting cards with lock-in modal |
| `/results/:pollId` | [`ResultsScreen.tsx`](./src/pages/ResultsScreen.tsx) | Full ranked results list, CSV export, and social share card |

---

## 📂 Project Structure

```
poll-maker/
├── .github/workflows/
│   └── deploy.yml              # Automated GitHub Actions CI/CD to Firebase
├── firestore.rules             # Granular database security rules
├── firebase.json               # Firebase Hosting & SPA rewrites configuration
├── Website Design Guide.md     # The master Brutalist design specification
├── src/
│   ├── App.tsx                 # Route declarations with React Suspense & lazy loading
│   ├── main.tsx                # React DOM entry point
│   ├── index.css               # Design tokens, keyframe animations, Brutalist primitives
│   ├── components/ui/
│   │   ├── BatsAnimation.tsx   # Canvas-based bat particle physics
│   │   ├── ConfirmModal.tsx    # Brutalist confirmation dialog
│   │   ├── HalloweenIcons.tsx  # Sharp pure-SVG custom icons (Ghost, Skull, etc.)
│   │   ├── HoldButton.tsx      # Press-and-hold safety button with radial filling
│   │   ├── ImageCropModal.tsx  # Canvas 1:1 image cropper and 90° rotator
│   │   ├── ImageUploader.tsx   # Mobile-friendly gallery picker with compression
│   │   ├── OptionCard.tsx      # Tactile voting option card with image & badge
│   │   ├── StatusChip.tsx      # Blinking status pill (LOBBY, LIVE, CLOSED, SPECIAL)
│   │   └── Toast.tsx           # Monospace notification snackbar
│   ├── firebase/
│   │   ├── config.ts           # Firebase app & Firestore initialization
│   │   └── pollService.ts      # Real-time subscriptions, weighted scoring & queries
│   ├── pages/
│   │   ├── Home.tsx            # Landing cockpit & stored device history
│   │   ├── PollMaker.tsx       # Live contest builder with live preview
│   │   ├── HostDashboard.tsx   # Private host command center with Jury Ballot Console
│   │   ├── BigScreen.tsx       # TV / Projector public display
│   │   ├── JoinPage.tsx        # QR code & nickname bridge
│   │   ├── VoteScreen.tsx      # Mobile voting ballot
│   │   └── ResultsScreen.tsx   # Final standings & export hub
│   ├── types/
│   │   └── poll.ts             # TypeScript definitions for Polls, Options, Votes & Jury
│   └── utils/
│       ├── audio.ts            # Web Audio API procedural synthesizer
│       ├── canvasExport.ts     # Social share certificate generator
│       ├── code.ts             # Unambiguous 6-character poll code utilities
│       ├── device.ts           # Persistent anonymous device fingerprinting
│       └── image.ts            # Client-side image validation & WebP compression
```

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- A [Firebase Project](https://console.firebase.google.com/) with Cloud Firestore enabled

### 1. Clone & Install
```bash
git clone https://github.com/Danushka-Madushan/poll-maker.git
cd poll-maker
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the project root:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 3. Deploy Firestore Security Rules
Ensure your Firestore instance allows voting transitions using the included rules:
```bash
npx firebase-tools deploy --only firestore:rules
```

### 4. Run Locally
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Quality, Linting & Build

```bash
# Run ESLint validation (0 errors, 0 warnings enforced)
npm run lint

# Compile TypeScript and build for production
npm run build

# Preview production build locally
npm run preview
```

---

## 🚀 Continuous Deployment (CI/CD)

The repository includes a GitHub Actions workflow in `.github/workflows/deploy.yml` that builds and deploys directly to **Firebase Hosting** on every push to `main`.

### Setting Up GitHub Actions:
1. In the Firebase Console, generate a Service Account Key with Firebase Hosting Admin permissions.
2. In your GitHub repository, navigate to **Settings > Secrets and variables > Actions**.
3. Add the following secrets:
   - `FIREBASE_SERVICE_ACCOUNT_POLL_MAKER_NIBM`
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
Built with 🎃 by Danushka Madushan.
