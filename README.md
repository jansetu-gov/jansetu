# JanSetu Gov

**From Scheme Discovery to Government Accountability** — a multilingual, voice-first platform connecting citizens to government welfare schemes, and government officers to fund-utilization monitoring, built for a hackathon merging two problem statements:

- **SW-57 — VoiceGov Sahayak**: Multilingual voice-first interface for government scheme discovery
- **SW-56 — GrantTrack Gov**: Unified dashboard for tracking central scheme fund utilization at district level

Three roles, one platform: **Citizens** discover and apply for schemes, **Government Officers** monitor fund utilization and anomalies, and the **Public** can view transparency data without logging in.

---

## Features

### For Citizens
- 🔍 **Voice + text search** across 40+ real Indian government schemes, in **17 languages**
- 🧠 Speech/text query is translated to English and matched against scheme keywords (intent-based search)
- 🔊 **"Listen to this scheme"** — text-to-speech explanation of eligibility, benefits, and application steps, translated into the selected language
- 🌐 Whole scheme pages (not just labels) auto-translate into the selected language
- ✅ Eligibility checker
- 📌 Bookmark schemes, browse by category
- 🔗 **Apply Now** opens the real official government application portal
- 📍 **Find Nearest CSC** — uses device GPS to find the nearest Common Service Centre from a seeded CSC database (Postgres `nearest_csc()` RPC, Haversine-based)
- 📩 **Simulated SMS follow-up** — on Apply, a message with the real application link and real nearest CSC is generated and logged (`sms_log` table) — a free stand-in for a paid SMS gateway (Twilio/MSG91), which would need DLT registration in India
- 🌗 Dark mode toggle

### For Government Officers
- District/state fund utilization dashboards, charts, and anomaly detection
- Drill-down: District → Scheme → Funds → Utilization → Physical Progress → Anomalies

### For the Public
- Transparency dashboard (fund allocation/utilization, no login required)
- News & updates, RTI query submission

### Admin
- The **Supabase Table Editor** serves as the admin CMS — schemes, district data, CSC centres, and news can be added/edited directly there, no custom admin UI needed.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 55 + React Native |
| Routing | Expo Router |
| Styling | NativeWind (Tailwind for RN) |
| Backend | Supabase (Postgres, Auth, Edge Functions, RLS) |
| Voice | Web Speech API (web), `expo-speech-recognition` (native — requires a custom build, not Expo Go) |
| Text-to-Speech | `expo-speech` |
| Translation | MyMemory free translation API |
| Location | `expo-location` + Postgres RPC (`nearest_csc`, `csc_by_district`) |
| Charts | `react-native-gifted-charts` / native SVG-based charts |
| Animation | `react-native-reanimated` |

---

## Project Structure

```
src/
  app/
    index.tsx                 # Role-selection landing screen (public)
    (auth)/sign-in.tsx         # Login / Register (with phone number)
    (app)/
      _layout.tsx              # Protected group (requires login)
      index.tsx                # Role-based redirect after login
      (citizen)/                # Citizen tabs: home, search, my-schemes, profile
      (officer)/                 # Officer tabs: overview, district, schemes, anomalies, charts
      scheme/[id].tsx            # Scheme detail (apply, listen, CSC finder, translation)
      eligibility.tsx
    (public)/                   # Public routes, no login required
      transparency.tsx
      news.tsx
      rti.tsx
  ctx.tsx                       # Session + role (fetched from `profiles` table)
  lib/
    appContext.tsx              # Language, dark mode, accessibility state
    constants.ts                 # Design tokens, translations (17 languages), category/lifecycle labels
    csc.ts                       # GPS-based nearest-CSC lookup
    anomalies.ts
  db/api.ts                     # All Supabase queries
supabase/
  functions/register-user/       # Edge Function — signup with username+password+phone
  migrations/                     # Database schema
```

---

## Installation Guide

### Prerequisites
- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Expo CLI (`npm install -g expo`)
- A Supabase project (free tier works)

### 1. Install dependencies
```
pnpm install
```

### 2. Configure environment variables
Create a `.env` file in the project root:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```
Get these from your Supabase project's **Settings → API** page.

### 3. Set up the database
Run the migration SQL files in `supabase/migrations/` via the Supabase SQL Editor, in order. This creates all tables (`profiles`, `schemes`, `district_scheme_data`, `bookmarks`, `demo_applications`, `rti_queries`, `news_updates`, `sms_log`, `csc_centers`) with RLS policies and seed data.

### 4. Deploy the Edge Function
```
supabase login
supabase link --project-ref your-project-ref
supabase functions deploy register-user
```

### 5. Run the app
```
pnpm start
```
- Press `w` for web
- Scan the QR code with Expo Go for a quick native preview (voice recognition and location features require a custom build — see below)

### 6. Building an installable APK
Native voice recognition (`expo-speech-recognition`) and some other native modules do not work inside Expo Go — they require a custom EAS build:
```
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
```
**Important:** EAS cloud builds do not automatically pick up your local `.env` file. Add the same variables under the `preview` profile's `env` block in `eas.json` before building, otherwise Supabase calls will silently fail in the built APK.

---

## Known Limitations

- **IVR (phone-call based voice system)** from the original spec is out of scope — it requires real telephony infrastructure (Twilio/Exotel), which can't be built inside a React Native app. Presented as a future roadmap item.
- **SMS follow-up is simulated**, not sent via a real gateway — real delivery in India requires DLT template registration (1–3+ business days, business KYC), which wasn't feasible in the hackathon timeframe. The message content, trigger point, and logging are fully implemented; swapping in a real gateway (e.g. Twilio, MSG91) is a small, isolated change.
- Scheme content (name/description/benefits/etc.) is stored only in English in the database; non-English display uses **live translation** via the free MyMemory API at render time (works for 11 of the 17 supported languages — Assamese, Odia, Sanskrit, Konkani, and Maithili aren't in MyMemory's supported pair list used here, so they fall back to English for scheme content specifically, while UI labels remain fully translated for all 17).
- CSC centre data is a representative sample (one centre per already-seeded district), not an exhaustive real registry of all ~500,000+ CSCs in India.

---

## Demo Mode

All data (schemes, district fund figures, applications) is **synthetic/demo data** for hackathon demonstration purposes and is not affiliated with the Government of India.
