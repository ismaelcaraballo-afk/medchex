# Lesson: Internationalization (i18n) — How MedPharmChex Speaks 14 Languages

**Project:** MedPharmChex
**Concept:** Internationalization (i18n) + Localization (l10n) + Accessibility for low-literacy users
**Stack used:** React 19 + TypeScript + react-i18next + i18next-browser-languagedetector + Web Speech API

---

## What is i18n?

**Internationalization (i18n)** = making your app *capable* of supporting multiple languages.
**Localization (l10n)** = actually *providing* the translations for each language.

The "18" in i18n = the 18 letters between the "i" and the "n" in "internationalization." Same joke for l10n.

You do i18n once. You do l10n for each language you support.

---

## The Problem We Were Solving

Before this update, every piece of text in MedPharmChex was hardcoded in English:

```tsx
// DrugSearch.tsx — BEFORE
<p className="drug-search-hint">Enter 2–5 medications to check for interactions</p>
<button>Check Interactions</button>
```

If a Spanish speaker opened the app, they'd see English. If an Arabic speaker opened it, they'd see English — and the layout would be wrong because Arabic reads right to left. And if a Nahuatl speaker in the Bronx opened it, they might not be able to read *any* language at all.

We needed a system where:
1. Every piece of text lives in a translation file, not in the component
2. The app detects or lets the user pick a language
3. Components ask "what does this say in the current language?" instead of having the text hardcoded
4. RTL languages (Arabic, Urdu, Yiddish) flip the whole layout direction
5. Users who can't read get a visual + audio experience instead of text

---

## Language Strategy — NYC First

This isn't a random list of popular world languages. The language set was chosen specifically for **New York City communities** who need medication safety information and are underserved by English-only apps:

| Language | Script | Direction | NYC Community |
|----------|--------|-----------|---------------|
| English | Latin | LTR | Base language |
| Spanish | Latin | LTR | Puerto Rican, Dominican, Mexican communities |
| Chinese | Hanzi | LTR | Flushing, Chinatown, Sunset Park |
| Russian | Cyrillic | LTR | Brighton Beach, Sheepshead Bay |
| Bengali | Bengali | LTR | Jackson Heights, Kensington |
| Hindi | Devanagari | LTR | Jackson Heights, Floral Park |
| Arabic | Arabic | **RTL** | Bay Ridge, Astoria |
| Urdu | Nastaliq | **RTL** | Brooklyn, Queens Pakistani community |
| Yiddish | Hebrew | **RTL** | Borough Park, Williamsburg, Crown Heights |
| French | Latin | LTR | Haitian Creole community, West African community |
| Portuguese | Latin | LTR | Brazilian community, Ironbound NJ commuters |
| Nahuatl (Mexicano) | Latin | LTR | Puebloan community in the Bronx, Brooklyn |

**Coming soon (placeholder — translated, not in MVP selector):**
| Japanese | Kanji/Kana | LTR | Manhattan, Ridgewood |
| German | Latin | LTR | Ridgewood, Astoria |

---

## How react-i18next Works

`react-i18next` is the standard i18n library for React. It has two main parts:

### 1. The `i18n` instance (the brain)
Lives in `src/i18n/index.ts`. You configure it once:
- Load all translation files
- Tell it where to detect the language (browser settings or localStorage)
- Set a fallback language (English) for missing translations

### 2. The `useTranslation` hook (how components talk to it)
Every component that needs translated text calls:

```tsx
const { t } = useTranslation()
```

Then instead of writing text directly, you write a **key**:

```tsx
// BEFORE (hardcoded)
<p>Enter 2–5 medications to check for interactions</p>

// AFTER (translated via key)
<p>{t('search.hint')}</p>
```

`t('search.hint')` looks up the key in the current language's translation file and returns the right string.

---

## Translation Files — The Architecture

All translations live in `src/i18n/locales/`. One file per language:

```
src/i18n/locales/
  en.json    ← English (base)
  es.json    ← Spanish
  zh.json    ← Mandarin Chinese
  hi.json    ← Hindi
  ar.json    ← Arabic (RTL)
  bn.json    ← Bengali
  pt.json    ← Portuguese
  ru.json    ← Russian
  fr.json    ← French
  ur.json    ← Urdu (RTL)
  yi.json    ← Yiddish (RTL)
  nah.json   ← Nahuatl / Mexicano
  ja.json    ← Japanese (placeholder — coming soon)
  de.json    ← German (placeholder — coming soon)
```

Each file is a JSON object with the same structure. The **keys are always English**, the **values change per language**:

```json
// en.json
{
  "search": {
    "hint": "Enter 2–5 medications to check for interactions",
    "check_btn": "Check Interactions"
  }
}

// es.json
{
  "search": {
    "hint": "Ingresa de 2 a 5 medicamentos para verificar interacciones",
    "check_btn": "Verificar interacciones"
  }
}

// ur.json (Urdu — RTL)
{
  "search": {
    "hint": "تعاملات جانچنے کے لیے 2 سے 5 دوائیں درج کریں",
    "check_btn": "تعاملات جانچیں"
  }
}
```

**Rule:** The key structure must be identical across all language files. Only the values change.

---

## Interpolation — Variables Inside Translations

Sometimes a translation needs a dynamic value inserted. For example: "Known Interactions (3)".

The number changes based on data. We can't hardcode it. Solution: **interpolation** with `{{variable}}`:

```json
// en.json
"known_interactions": "Known Interactions ({{count}})"

// es.json
"known_interactions": "Interacciones conocidas ({{count}})"
```

In the component:
```tsx
t('result.known_interactions', { count: interactions.length })
// → "Known Interactions (3)" in English
// → "Interacciones conocidas (3)" in Spanish
```

The `{{count}}` placeholder gets replaced with the actual value at runtime.

---

## Language Detection — How the App Knows What Language to Use

We installed `i18next-browser-languagedetector`. It checks in this order:
1. `localStorage` — did the user pick a language before? Use that.
2. `navigator.language` — what language is the browser set to?
3. Fall back to English if neither works.

```ts
detection: {
  order: ['localStorage', 'navigator'],
  caches: ['localStorage'],  // ← save the user's choice for next visit
}
```

This means: if your iPhone is set to Spanish, MedPharmChex opens in Spanish automatically.

---

## The Language Switcher — Including Placeholder Languages

`src/components/LanguageSwitcher.tsx` renders the dropdown. Each language in the list has a `placeholder` flag — if true, the option shows as disabled with "(coming soon)":

```tsx
{LANGUAGES.map(({ code, label, placeholder }) => (
  <option key={code} value={code} disabled={placeholder}>
    {placeholder ? `${label} (coming soon)` : label}
  </option>
))}
```

The `Language` interface in `src/i18n/index.ts` defines the shape:

```ts
export interface Language {
  code: string
  label: string
  rtl?: boolean        // true = Hebrew/Arabic/Urdu script
  placeholder?: boolean // true = coming soon, disabled in selector
}
```

This pattern lets you ship translated files before they're exposed in the UI — useful for staged rollouts.

---

## RTL (Right-to-Left) — Arabic, Urdu, Yiddish

Arabic, Urdu, and Yiddish all use right-to-left scripts. This isn't just about text — the whole layout mirrors.

We define which languages are RTL in one place in `src/i18n/index.ts`:

```ts
export const RTL_LANGS = new Set(
  LANGUAGES.filter(l => l.rtl).map(l => l.code)
)
// → Set { 'ar', 'ur', 'yi' }
```

In `App.tsx`, we check the set — not a hardcoded language name:

```tsx
// FRAGILE (old way — only handled Arabic):
const dir = i18n.language === 'ar' ? 'rtl' : 'ltr'

// SCALABLE (new way — handles all RTL languages from the config):
const dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr'

return <div className="app" dir={dir}>
```

**Why this matters:** If we add Hebrew or Persian later, we just add `rtl: true` to the language config. `App.tsx` doesn't need to change.

In CSS, `[dir="rtl"]` writes mirror-image rules:

```css
[dir="rtl"] .app-header-top   { justify-content: flex-start; }
[dir="rtl"] .drug-input-row   { flex-direction: row-reverse; }
[dir="rtl"] .drug-search-actions { flex-direction: row-reverse; }
```

---

## Visual-First Mode — Designing for Non-Readers

This is the most important accessibility decision in the project.

**The problem:** Someone in the Puebloan community in the Bronx who speaks only Nahuatl may have never gone to school — not in Mexico, not in the US. They can't read Nahuatl text, Latin script, or any other writing system. A translated app is still useless to them.

**The solution:** When Nahuatl is selected, MedPharmChex switches from `ResultCard` (text-heavy) to `VisualResult` (reading-not-required).

```tsx
// App.tsx
const VISUAL_FIRST_LANGS = new Set(['nah'])
const visualFirst = VISUAL_FIRST_LANGS.has(lang)

{result && visualFirst && <VisualResult ... />}
{result && !visualFirst && <ResultCard ... />}
```

### What VisualResult shows instead of text:

| Element | What it communicates | How |
|---------|---------------------|-----|
| Giant 👍 / ✋ / 🚫 | Safe / Caution / Dangerous | Universal symbols, no reading needed |
| Color (green / yellow / red) | Severity level | Color is pre-literate communication |
| Drug name pills | Which medicines were checked | Helps a pharmacist identify even if patient can't read |
| 🔊 Read-aloud button | Full spoken explanation | Web Speech API — no reading at all |

### The Read-Aloud Button — Web Speech API

The browser has a built-in text-to-speech engine. Zero dependencies, works offline, free:

```tsx
const speak = () => {
  const utterance = new SpeechSynthesisUtterance(explanation)
  utterance.lang = i18n.language   // speaks in the app's current language
  utterance.rate = 0.85            // slightly slower — clearer for non-native speakers
  window.speechSynthesis.speak(utterance)
}

<button onClick={speak}>🔊</button>
```

This works for **all languages**, not just Nahuatl. A Russian grandmother who navigates to Russian but has trouble reading small text on a phone can press 🔊 and hear the explanation.

---

## Making Claude Respond in the Right Language

The AI explanation is generated by Claude on the backend. We pass the language code so Claude responds in it.

**Frontend** — `src/services/drugApi.ts`:
```ts
export async function explainInteractions(
  drugs: string[],
  interactions: unknown,
  severity: string,
  lang = 'en'        // ← passes the UI language
) {
  return apiFetch(`${BASE}/explain`, {
    method: 'POST',
    body: JSON.stringify({ drugs, interactions, severity, lang })
  })
}
```

**Backend** — `server/index.js`:
```js
const LANG_NAMES = {
  en: 'English', es: 'Spanish', zh: 'Simplified Chinese', hi: 'Hindi',
  ar: 'Arabic', bn: 'Bengali', pt: 'Portuguese', ru: 'Russian',
  fr: 'French', ur: 'Urdu', yi: 'Yiddish', nah: 'Nahuatl',
  ja: 'Japanese', de: 'German'
}

const languageName = LANG_NAMES[lang] || 'English'

// Claude prompt includes:
`Respond entirely in ${languageName}. Use plain language appropriate for that language's speakers.`
```

For Nahuatl + VisualResult: the AI explanation is spoken aloud by the browser, so Claude's Nahuatl text goes into audio even though the user never reads it.

---

## What We Didn't Translate (Intentionally)

- **Drug names** — "Warfarin", "Ibuprofen" — international medical terms, same in every language. Translating them would confuse pharmacists.
- **Data source names** — "NIH RxNorm · FDA FAERS" — proper nouns, institution names.
- **Severity key names** in code — `SAFE`, `CAUTION`, `DANGEROUS` stay as English keys internally. Only the displayed label is translated.

---

## Key Concepts Learned

| Concept | What it means | Where in MedPharmChex |
|---------|--------------|------------------|
| `t('key')` | Look up translated string by key | Every component |
| Interpolation `{{var}}` | Dynamic values in translations | `known_interactions`, `adverse_events` |
| Language detection | Auto-detect from browser | `i18next-browser-languagedetector` |
| `RTL_LANGS` Set | Which languages need mirrored layout | `src/i18n/index.ts` |
| `dir="rtl"` | Right-to-left layout | `App.tsx` + CSS `[dir="rtl"]` |
| `placeholder: true` | Language in code but not in MVP selector | `LanguageSwitcher.tsx` |
| Fallback language | What to show if translation missing | `fallbackLng: 'en'` in i18n config |
| `i18n.changeLanguage()` | Switch language at runtime | `LanguageSwitcher.tsx` |
| `VISUAL_FIRST_LANGS` | Languages that trigger visual mode | `App.tsx` |
| `VisualResult` | Reading-independent result display | `VisualResult.tsx` |
| Web Speech API | Browser read-aloud, zero dependencies | `VisualResult.tsx` |
| Lang → Claude prompt | AI responds in selected language | `server/index.js` `/api/explain` |

---

## Files Changed in This Feature

```
src/
  main.tsx                         ← imports i18n to initialize it
  App.tsx                          ← RTL_LANGS, VISUAL_FIRST_LANGS, VisualResult routing
  i18n/
    index.ts                       ← LANGUAGES list, RTL_LANGS set, Language interface
    locales/
      en.json, es.json, zh.json,   ← active MVP languages
      hi.json, ar.json, bn.json,
      pt.json, ru.json, fr.json,
      ur.json, yi.json, nah.json   ← NYC additions
      ja.json, de.json             ← placeholder languages (translated, not in selector)
  components/
    DrugSearch.tsx                 ← useTranslation for all search strings
    ResultCard.tsx                 ← useTranslation for result strings
    LanguageSwitcher.tsx           ← dropdown with placeholder support
    VisualResult.tsx               ← NEW: reading-independent result + audio
  services/
    drugApi.ts                     ← explainInteractions() accepts lang param

server/
  index.js                         ← /api/explain uses lang in Claude prompt
                                     LANG_NAMES includes Urdu, Yiddish, Nahuatl
```

---

## Try It Yourself

1. `npm run dev` in the medpharmchex folder
2. Open http://localhost:5173
3. Switch to Spanish — whole UI changes instantly
4. Switch to Arabic — layout mirrors right-to-left
5. Switch to Urdu — also mirrors (same RTL logic, different script)
6. Switch to Yiddish — Hebrew script, RTL
7. Switch to Nahuatl — VisualResult appears instead of ResultCard
8. Check a drug interaction in Nahuatl — press 🔊 to hear it read aloud
9. Try Japanese or German in the dropdown — they appear but are disabled (coming soon)

---

## Code Review Improvements (Multi-LLM Review — GPT-4o + DeepSeek)

After building the initial i18n system, we ran a code review using two external AI models (GPT-4o and DeepSeek). Both flagged four issues we fixed immediately. This is the same multi-LLM review process used on StorageScout's carbon model.

---

### Fix 1: Lazy Load Placeholder Languages

**Problem:** Japanese and German translation files were being imported upfront with all other languages, even though they're disabled in the MVP selector. This adds to the initial bundle size for every user, even users who will never select those languages.

**Before:**
```ts
// Both loaded at startup — wasted bytes for MVP users
import ja from './locales/ja.json'
import de from './locales/de.json'

resources: { en, es, ..., ja, de }
```

**After — lazy loaded on `window.load`:**
```ts
// NOT in the initial resources bundle
const loadPlaceholder = async (code: string) => {
  const mod = await import(`./locales/${code}.json`)
  i18n.addResourceBundle(code, 'translation', mod.default, true, true)
}

// Load in the background after the page is ready — doesn't block anything
window.addEventListener('load', () => {
  loadPlaceholder('ja')
  loadPlaceholder('de')
})
```

**Why it matters:** Vite's dynamic `import()` creates a separate chunk for each language file. Japanese and German only download after the page is fully loaded, and only once. Every other user's first load is lighter.

**Concept:** This is called **code splitting** — breaking your bundle into smaller pieces that load on demand instead of all at once.

---

### Fix 2: `aria-live` for Screen Readers

**Problem:** When results or errors appeared, screen reader users (blind users, or users relying on assistive technology) had no way to know new content appeared. They'd have to manually tab around to find it.

**Before:**
```tsx
{error && <div className="error-banner">{error}</div>}
{result && <ResultCard ... />}
```

**After:**
```tsx
{/* aria-live="polite": announces content changes to screen readers without interrupting */}
<div aria-live="polite" aria-atomic="true">
  {error && <div className="error-banner" role="alert">{error}</div>}
</div>

<div aria-live="polite" aria-atomic="false">
  {result && <ResultCard ... />}
</div>
```

**`aria-live` values:**
- `"polite"` — waits for the user to finish what they're doing, then announces
- `"assertive"` — interrupts immediately (used for urgent alerts — we use `role="alert"` on errors instead)
- `aria-atomic="true"` — reads the whole region when anything changes
- `aria-atomic="false"` — only reads the part that changed

**Why it matters:** A blind user using VoiceOver or NVDA now hears "DANGEROUS. Warfarin + Ibuprofen" as soon as results load, without touching the screen. This is WCAG 2.1 compliance — required for any app serving healthcare information.

---

### Fix 3: Nahuatl Falls Back to Spanish, Not English

**Problem:** When a Nahuatl translation key is missing, the original config fell back to English. But a Nahuatl speaker in the Bronx is almost certainly more likely to have a Spanish-speaking family member than an English-speaking one.

**Before:**
```ts
fallbackLng: 'en',  // all languages fall back to English
```

**After:**
```ts
fallbackLng: {
  nah: ['es', 'en'],   // Nahuatl → try Spanish first, then English
  default: ['en'],     // all other languages → English
},
```

**Why it matters:** This is a cultural design decision, not just a technical one. A missing translation in Nahuatl should degrade gracefully toward the language most likely to be understood by someone in that community. It treats the user with respect.

**Concept:** i18next supports **per-language fallback chains** — each language can have its own fallback path instead of a one-size-fits-all default.

---

### Fix 4: `i18next-scanner` — Catch Missing Translations Before They Ship

**Problem:** With 14 language files, it's easy to add a new `t('key')` in a component and forget to add the matching key to one of the language files. That language silently shows nothing (or the key itself) instead of translated text.

**Solution:** `i18next-scanner` scans your source code for every `t('key')` call and compares it against all your language files. It reports any gaps.

**Run it:**
```bash
npm run i18n:scan
```

**Config** (`i18next-scanner.config.js` at project root):
```js
module.exports = {
  input: ['src/**/*.{ts,tsx}'],   // scan all components
  options: {
    lngs: ['en', 'es', 'zh', 'hi', 'ar', 'bn', 'pt', 'ru', 'fr', 'ur', 'yi', 'nah'],
    resource: {
      loadPath: 'src/i18n/locales/{{lng}}.json',
    },
  },
}
```

**When to run it:**
- Before every commit that touches components
- As part of CI (add `npm run i18n:scan` to your GitHub Actions workflow)

**Why it matters:** A DANGEROUS warning that shows blank text because a key is missing in Yiddish is a real patient safety issue, not just a cosmetic bug.

---

### Summary of What the Code Review Added

| Fix | What changed | Why |
|-----|-------------|-----|
| Lazy load JP/DE | Dynamic `import()` after page load | Smaller initial bundle |
| `aria-live` regions | Wrap errors + results in live regions | Screen reader users hear updates |
| Nahuatl → Spanish fallback | Per-language `fallbackLng` chain | Culturally appropriate degradation |
| `i18next-scanner` | New `npm run i18n:scan` command | Catch missing keys before deploy |

---

## Design Principle: Meet People Where They Are

> "We built this for the person who is standing at the pharmacy counter who doesn't speak English and doesn't read in any language. The app has to work for that person too."

The VisualResult + audio combination means MedPharmChex can be used by someone who:
- Has never been to school
- Can't read in any language
- Hands their phone to a family member to navigate to Nahuatl
- Presses the big 🔊 button and hears whether their medications are safe

That's the point of the whole feature.

---

*Built: March 2026 — MedPharmChex Capstone, Pursuit Cycle 4*
*Stack: React 19 + TypeScript + react-i18next + i18next-browser-languagedetector + Web Speech API*
