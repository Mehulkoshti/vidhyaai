# 📱 VidhyaAI Mobile (Expo)

The native mobile client for **VidhyaAI**, built with **Expo (SDK 57) + React Native**.
Same AI study companion as the web app — summaries, quizzes, flashcards, mind maps,
planners and explanations in 12 languages — powered by **Sarvam AI**.

## How it works

The app is a thin native client: it calls the **same deployed VidhyaAI backend**
(`/api/generate`) that the web app uses, so all Sarvam AI calls happen server-side
and **no API key ever ships in the app**. Set the backend URL in `App.tsx`:

```ts
const API_BASE = "https://vidhya-ai-01.netlify.app"; // your deployed web app
```

## Run it (Expo Go)

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app on your Android/iOS phone.
(For a LAN device use `npx expo start`; if the phone can't connect, try `--tunnel`.)

## Build an installable APK (for submission)

```bash
npm install -g eas-cli
eas login            # free Expo account
eas build -p android --profile preview
```

EAS returns a download link to an `.apk` — paste that into the hackathon form's
**"Any additional project links"** field so judges can install it directly.

## Tech

- Expo SDK 57 · React Native 0.86 · React 19 · TypeScript
- Zero native API keys — reuses the web app's Sarvam-powered API
