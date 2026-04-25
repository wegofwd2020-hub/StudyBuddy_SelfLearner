# mobile/

React Native + Expo app for **StudyBuddy Q** (Android-first, iOS later).

## Layout (target — empty until first MVP PR)

```
mobile/
  app/
    screens/         Query · Library · Settings · Lesson view
    components/      Markdown renderer (KaTeX + Mermaid + tables)
    hooks/           useGenerateJob · useLibrary · useAuth (v1.1+)
    api/             Backend HTTP client · FCM handler (v1.1+)
    secure/          expo-secure-store wrapper for the BYOK API key
  app.json           Expo config
  package.json
  babel.config.js
```

## Key constraints

- **API key lives in `expo-secure-store` only.** Never `AsyncStorage`,
  never component state beyond a single request, never `console.log()`.
  See `../docs/adr/ADR-001-byok-security-model.md`.
- **Settings screen displays the key as last-4 only** (e.g. `sk-ant-...XYZ8`).
- **Markdown rendering** must support KaTeX (math), Mermaid (diagrams via
  WebView), GFM tables, attributed blockquotes. See `CLAUDE.md` §"Pipeline rules".

## Bootstrap (when ready)

```bash
cd mobile
npx create-expo-app .
npx expo install expo-secure-store react-native-katex
npx expo start --android
```

## Status

⏳ Empty. To be populated in the first MVP PR alongside the backend skeleton.
