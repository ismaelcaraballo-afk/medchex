# MedPharmChex — Medication Interaction Checker

**Does it mix?** MedPharmChex checks drug combinations for dangerous interactions, scores severity using real FDA adverse event data, and explains the risks in plain English using AI.

Built as a Pursuit L2 capstone project by Ismael Caraballo and Paula Maiguru.

---

## What It Does

1. **Look up drugs** — Resolves drug names to RxCUI codes via NIH RxNorm
2. **Check interactions** — Queries NIH RxNorm interaction database
3. **Score severity** — Analyzes FDA FAERS adverse event reports for real-world outcomes
4. **Explain in plain English** — Claude AI summarizes the risks in clear, non-clinical language

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite + TailwindCSS |
| Backend | Node.js + Express |
| AI | Anthropic Claude (claude-sonnet-4-6) |
| Drug Data | NIH RxNorm API |
| Safety Data | FDA FAERS (OpenFDA) |
| Animations | Framer Motion |
| Charts | Recharts |

---

## Quick Start

```bash
# Install dependencies
npm install
cd server && npm install && cd ..

# Configure environment
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local

# Run dev servers
npm run dev        # frontend on http://localhost:5173
cd server && node index.js  # backend on http://localhost:3000
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/drug/rxcui` | GET | Resolve drug name → RxCUI |
| `/api/interactions` | GET | Check interactions by RxCUI list |
| `/api/faers` | GET | FDA adverse event data |
| `/api/score` | POST | Severity scoring (SAFE / CAUTION / DANGEROUS) |
| `/api/explain` | POST | Claude AI plain-English explanation |

---

## Why These Data Sources?

- **RxNorm** — NIH's official drug vocabulary. Industry standard for medication interoperability.
- **FDA FAERS** — Real-world adverse event reports submitted by doctors and patients. Severity is derived from actual outcomes, not AI guesses.
- **Claude AI** — Explains findings in plain language. The AI does *not* determine severity — that comes from FDA data.

---

## Team

- **Ismael Caraballo** ([@ismaelcaraballo-afk](https://github.com/ismaelcaraballo-afk)) — Backend, API integration, architecture
- **Paula Maiguru** ([@PMAIGURU2026](https://github.com/PMAIGURU2026)) — Frontend, UI/UX, product vision

---

## Documentation

- [Mobile & Tablet Support](docs/MOBILE-TABLET-SUPPORT.md) — What devices MedPharmChex works on and why

---

## Status

Active development — Pursuit L2 Capstone. Demo Day: March 18, 2026.
