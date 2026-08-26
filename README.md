# JanSetu Gov — Installation Guide

## Prerequisites
- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Expo CLI (`npm install -g expo`)
- Expo Go app on your phone (for testing), OR Android Studio / Xcode

---

## 1. Install Dependencies

```bash
pnpm install
```

---

## 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://fpxcuzqpabplygjogwyg.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

> Get your anon key from: https://supabase.com/dashboard/project/fpxcuzqpabplygjogwyg/settings/api

---

## 3. Run the App

```bash
# Start Expo dev server
pnpm start

# Run on Android
pnpm android

# Run on iOS
pnpm ios

# Run on Web
pnpm web
```

---

## 4. Demo Accounts

Use the app's Register screen to create accounts.  
Select your role (Citizen / Government Officer / Public Viewer) during registration.

**Quick demo flow:**
1. Select **Citizen** → Register → Search "kheti" (Agriculture)
2. Select **Government Officer** → Login → Filter: Assam → Kamrup → See HIGH anomaly flag
3. Select **Public Viewer** → No login needed → Browse transparency dashboard

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 55 + React Native 0.83 |
| Navigation | Expo Router (file-based) |
| Styling | NativeWind v4 (Tailwind CSS) |
| Backend | Supabase (Postgres + Auth + Edge Functions) |
| Language | TypeScript |
| Icons | Lucide React Native |
| Charts | Native View-based (no external chart lib) |

---

## Project Structure

```
src/
  app/
    index.tsx              # Role selection landing
    (auth)/sign-in.tsx     # Login / Register
    (app)/
      (citizen)/           # Citizen module tabs
      (officer)/           # Officer dashboard tabs
      (public)/            # Public transparency tabs
      scheme/[id].tsx      # Scheme detail screen
      eligibility.tsx      # Eligibility questionnaire
  lib/
    constants.ts           # Colors, translations, formatters
    appContext.tsx          # Language / role state
    anomalies.ts           # Deterministic anomaly detection rules
  db/
    api.ts                 # All Supabase DB calls
supabase/
  functions/
    register-user/         # Edge Function: username+password signup
```
