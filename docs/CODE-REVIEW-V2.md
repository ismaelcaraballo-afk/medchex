# MedPharmChex Code Review — Round 2
**Reviewers:** GPT-4o + DeepSeek
**Scope:** Full stack — React frontend, Express backend, i18n system, VisualResult, drugApi

---

## Critical Fixes Before Demo Day

### 1. Speech Synthesis Language Validation (`VisualResult.tsx`)
**DeepSeek flagged:** `utterance.lang` is set directly from `i18n.language` without validation. If a bad value gets in, the browser's speech engine could misbehave.

**Fix:**
```tsx
// Before
utterance.lang = i18n.language

// After — validate against known-good codes only
const VALID_SPEECH_LANGS = new Set(['en','es','zh','hi','ar','bn','pt','ru','fr','ur','yi','nah'])
const speechLang = VALID_SPEECH_LANGS.has(i18n.language.split('-')[0])
  ? i18n.language
  : 'en'
utterance.lang = speechLang
```

### 2. Demo Mode Drug Name Casing Bug (`server/index.js`)
**DeepSeek flagged:** `DEMO_INTERACTIONS` keys are lowercase (e.g. `warfarin,ibuprofen`) but the frontend sends mixed-case names (e.g. `Warfarin,Ibuprofen`). Demo mode silently misses matches.

**Fix:** Normalize keys to lowercase before the lookup:
```js
// In the demo mode check
const demoKey = drugs.map(d => d.toLowerCase()).sort().join(',')
const demoResult = DEMO_INTERACTIONS[demoKey]
```

### 3. `loadPlaceholder` Has No Error Handling (`i18n/index.ts`)
**DeepSeek flagged:** If `ja.json` or `de.json` fail to load (network issue, bad build), the function throws silently and those languages never register.

**Fix:**
```ts
const loadPlaceholder = async (code: string) => {
  try {
    const mod = await import(`./locales/${code}.json`)
    i18n.addResourceBundle(code, 'translation', mod.default, true, true)
  } catch (err) {
    console.error(`[i18n] Failed to load placeholder language: ${code}`, err)
  }
}
```

### 4. `aria-pressed` on Audio Buttons (`VisualResult.tsx`)
**DeepSeek flagged:** The 🔊 and ⏹ buttons have `aria-label` but no `aria-pressed` state. Screen readers can't tell users whether audio is currently playing.

**Fix:** Track speaking state and reflect it:
```tsx
const [isSpeaking, setIsSpeaking] = useState(false)

const speak = () => {
  // ...
  utterance.onstart = () => setIsSpeaking(true)
  utterance.onend = () => setIsSpeaking(false)
}

<button
  aria-label={isSpeaking ? 'Reading aloud — tap to stop' : 'Read result aloud'}
  aria-pressed={isSpeaking}
  onClick={speak}
>
  {isSpeaking ? '🔊' : '🔈'}
</button>
```

---

## Medium Priority

### 5. `visualFirst` Should Be Memoized (`App.tsx`)
**DeepSeek flagged:** `VISUAL_FIRST_LANGS.has(lang)` is computed on every render. Not expensive now, but a good habit.

```tsx
const visualFirst = useMemo(
  () => VISUAL_FIRST_LANGS.has(lang),
  [lang]
)
```

### 6. Differentiated Error Messages
**Both reviewers flagged:** `t('error.generic')` gives the same message for network failures, API failures, and input errors. Users can't tell what went wrong.

Add to all language files:
```json
"error": {
  "not_found": "...",
  "generic": "...",
  "network": "Connection error. Check your internet and try again.",
  "api": "Data service unavailable. Try again in a moment."
}
```

In `App.tsx`:
```tsx
} catch (err) {
  const isNetwork = err instanceof TypeError && err.message.includes('fetch')
  setError(t(isNetwork ? 'error.network' : 'error.api'))
}
```

### 7. Log When Demo Mode is Active (`server/index.js`)
**DeepSeek flagged:** `DEMO_MODE` bypasses all API calls but leaves no trace in logs. In production debugging, you'd never know why real data isn't coming back.

```js
if (process.env.DEMO_MODE === 'true') {
  console.warn('[MedPharmChex] DEMO_MODE active — API calls are mocked')
}
```

### 8. `FRONTEND_URL` Validation (`server/index.js`)
**DeepSeek flagged:** CORS origin is read from `process.env.FRONTEND_URL` without format validation.

```js
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173'
].filter(Boolean)

// Already doing this correctly with the cors config — just make sure
// FRONTEND_URL is validated in your .env.example documentation
```

---

## Lower Priority (Post-Demo)

### 9. Add `useMemo` to `ResultCard` for Severity Config
Currently `severityConfig[severity]` is looked up on every render. Worth memoizing when interactions list is long.

### 10. Structured Logging
Both reviewers suggested adding `winston` or `pino` for structured server logs. Useful for production monitoring — not needed for Demo Day.

### 11. Offline / Service Worker
DeepSeek suggested caching language files + drug data via a service worker for offline use. Valuable for community health workers in low-signal areas. Post-Demo Day scope.

---

## Summary

| Priority | Issue | File | Fix |
|----------|-------|------|-----|
| 🔴 Critical | Speech lang not validated | `VisualResult.tsx` | Whitelist check |
| 🔴 Critical | Demo mode casing bug | `server/index.js` | `.toLowerCase()` |
| 🔴 Critical | `loadPlaceholder` no error handling | `i18n/index.ts` | try/catch |
| 🟡 Medium | `aria-pressed` on audio buttons | `VisualResult.tsx` | Track speaking state |
| 🟡 Medium | `visualFirst` not memoized | `App.tsx` | `useMemo` |
| 🟡 Medium | Generic error message | `App.tsx` + all locale files | Split error keys |
| 🟡 Medium | Demo mode not logged | `server/index.js` | `console.warn` |
| 🟢 Low | Structured logging | `server/index.js` | `pino`/`winston` |
| 🟢 Low | Service worker / offline | New file | Post-demo |

---

*Review conducted: March 2026*
*Models: GPT-4o (OpenAI) + DeepSeek v3*
