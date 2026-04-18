# MedRxChex — Engineering Decisions Log

This document explains *why* each technical decision was made.
Written for the team (Ismael + Paula) and for Demo Day Q&A.

---

## 1. Claude AI for Explanations Only — Not for Detection

**Decision:** Claude generates plain-English summaries. It does NOT determine if a drug interaction exists or how serious it is.

**Why:** AI can hallucinate. If Claude incorrectly says "this combination is safe" when it isn't, that's a medical safety issue. All interaction detection and severity scoring comes from real FDA/RxNorm data. Claude only translates that data into plain English. This is how clinical AI tools are built in the real world.

---

## 2. Severity Scoring from FDA Language — Not AI

**Decision:** The `/api/score` endpoint parses RxNorm's own severity language (words like "contraindicated", "fatal", "monitor") to produce SAFE/CAUTION/DANGEROUS.

**Why:** Same reason as above — safety-critical classifications must be deterministic and traceable to a source. A human or a regulator can audit our scoring logic. They can't audit what an AI "felt" about a drug combination.

---

## 3. Rate Limiting (express-rate-limit)

**Decision:** 100 requests per 15 minutes per IP on all `/api/` routes.

**Why (GPT-4o + DeepSeek flagged this):** Without rate limiting, a bug in the frontend (infinite loop, rapid re-renders) or a bad actor could spam OpenFDA and RxNorm until we get blocked. Getting blocked from the FDA API mid-demo would end the presentation. 100 req/15min is generous for real users and protective for us.

---

## 4. Response Caching (node-cache, 1-hour TTL)

**Decision:** All API responses are cached in memory for 1 hour.

**Why:** OpenFDA can take 5–10 seconds on cold calls. Drug interaction data doesn't change hour-to-hour. Caching means the second lookup for "warfarin" is instant. Also protects us if an upstream API goes down mid-demo — cached responses still serve correctly.

---

## 5. DEMO_MODE Flag

**Decision:** `DEMO_MODE=true` in `.env` returns pre-validated cached interaction data for our Demo Day drug pairs (Warfarin+Ibuprofen, Warfarin+Aspirin, Lisinopril+Ibuprofen).

**Why (both reviewers flagged this):** Live API calls during a presentation are a single point of failure. If OpenFDA is slow or RxNorm is unreachable on March 18, the demo dies in front of the cohort, mentors, and guests. DEMO_MODE is our safety net. We validate the data beforehand so we know it's accurate — we're not faking anything, just pre-fetching.

**How to activate:** Set `DEMO_MODE=true` in Vercel environment variables the morning of Demo Day.

---

## 6. Restricted CORS

**Decision:** In production, CORS is locked to `FRONTEND_URL` only.

**Why:** `cors()` with no config allows any website to call our backend. That means any other website could use our API (and our Anthropic credits) without our knowledge. Locking to our Vercel frontend URL means only MedPharmChex can call MedPharmChex.

---

## 7. Input Validation on All Endpoints

**Decision:** Every endpoint validates its inputs before hitting any external API.

**Why (both reviewers flagged this):** Sending an empty string or garbage data to RxNorm returns confusing errors that are hard to debug. Validating early gives the frontend a clear, human-readable error message ("Drug name must be at least 2 characters") instead of a cryptic API failure. Also prevents malformed RxCUI codes from producing incorrect interaction results.

---

## 8. Data Source Stack — Why These Three

| Source | Role | Why |
|--------|------|-----|
| **RxNorm (NIH)** | Drug normalization + interaction detection | Gold standard, free, no API key, used in clinical EHR systems |
| **OpenFDA FAERS** | Adverse event frequency data | 15M+ real reports, adds real-world context to interaction results |
| **Claude Sonnet 4.6** | Plain-English explanation | Best-in-class for nuanced medical language translation |

**Why not DrugBank?** Requires a paid API key. OpenFDA + RxNorm cover our MVP needs at zero cost.

---

## 9. Combination Drug Handling (Known Limitation)

**Known issue:** RxNorm doesn't handle combination drugs well (e.g., "lisinopril/hydrochlorothiazide"). These need to be split into individual drug names before RxCUI lookup.

**Status:** Not blocking for MVP — our demo drugs are single-ingredient. Flagged for Week 2 if time allows.

---

*Last updated: 2026-03-07 | Multi-LLM reviewed: GPT-4o + DeepSeek*
