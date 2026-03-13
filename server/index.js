import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import Anthropic from '@anthropic-ai/sdk'
import rateLimit from 'express-rate-limit'
import NodeCache from 'node-cache'

dotenv.config()

// WHY: Fail fast if required env vars are missing — unless DEMO_MODE is on (no live calls needed).
if (!process.env.ANTHROPIC_API_KEY && process.env.DEMO_MODE !== 'true') {
  console.error('ERROR: ANTHROPIC_API_KEY is not set. Add it to .env, or set DEMO_MODE=true to test.')
  process.exit(1)
}

if (process.env.DEMO_MODE === 'true') {
  console.warn('[MedPharmChex] DEMO_MODE active — all API calls are mocked with pre-validated data')
}

const app = express()
const PORT = process.env.PORT || 3001

// WHY: CORS restricted to known frontend origin in production.
// Allowing all origins (*) is a security risk — any website could call our API.
// In development we allow localhost; in production we lock to the Vercel frontend URL.
// WHY fallback: if FRONTEND_URL is missing in production, fail with clear message not silent block.
const allowedOrigin = process.env.NODE_ENV === 'production'
  ? (process.env.FRONTEND_URL || (() => { throw new Error('FRONTEND_URL must be set in production') })())
  : 'http://localhost:5173'

app.use(cors({ origin: allowedOrigin }))

app.use(express.json())

// WHY: Rate limiting prevents abuse of our API endpoints.
// Without it, a bad actor (or a bug in the frontend) could spam OpenFDA/RxNorm
// causing us to get blocked mid-demo. 100 requests per 15 min is generous for real users.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests — please wait a moment and try again.' }
})
app.use('/api/', limiter)

// WHY: Caching API responses reduces latency and protects against upstream API downtime.
// OpenFDA can take 5-10 seconds. Caching means the second request for "warfarin" is instant.
// TTL = 1 hour — drug interaction data doesn't change minute-to-minute.
const cache = new NodeCache({ stdTTL: 3600 })

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Maps RxCUI codes → drug names for DEMO_MODE interaction lookups
const DEMO_RXCUI_MAP = {
  '11289': 'warfarin',
  '5640':  'ibuprofen',
  '1191':  'aspirin',
  '29046': 'lisinopril',
}

// Raw interaction data in RxNorm fullInteractionTypeGroup format — used by /api/interactions in DEMO_MODE
const DEMO_INTERACTION_RAW = {
  'ibuprofen,warfarin': {
    fullInteractionTypeGroup: [{
      fullInteractionType: [{
        interactionPair: [{
          description: 'Ibuprofen may increase the anticoagulant effect of warfarin, raising the risk of serious or fatal bleeding.',
          severity: 'high',
          drug1: 'Warfarin',
          drug2: 'Ibuprofen',
        }]
      }]
    }]
  },
  'aspirin,warfarin': {
    fullInteractionTypeGroup: [{
      fullInteractionType: [{
        interactionPair: [{
          description: 'Concurrent use significantly increases bleeding risk. Contraindicated in most patients.',
          severity: 'high',
          drug1: 'Warfarin',
          drug2: 'Aspirin',
        }]
      }]
    }]
  },
  'ibuprofen,lisinopril': {
    fullInteractionTypeGroup: [{
      fullInteractionType: [{
        interactionPair: [{
          description: 'NSAIDs like ibuprofen may reduce the antihypertensive effect of lisinopril and increase risk of kidney injury.',
          severity: 'moderate',
          drug1: 'Lisinopril',
          drug2: 'Ibuprofen',
        }]
      }]
    }]
  },
}

// WHY: DEMO_MODE pre-returns cached real data for our Demo Day drug pairs.
// Live API calls during a presentation are a single point of failure.
// If OpenFDA is slow or down on March 18, DEMO_MODE keeps the demo running perfectly.
const DEMO_INTERACTIONS = {
  'warfarin,ibuprofen': {
    scored: [{
      drug1: 'Warfarin', drug2: 'Ibuprofen',
      description: 'Ibuprofen may increase the anticoagulant effect of warfarin, raising the risk of serious or fatal bleeding.',
      severity: 'DANGEROUS'
    }]
  },
  'warfarin,aspirin': {
    scored: [{
      drug1: 'Warfarin', drug2: 'Aspirin',
      description: 'Concurrent use significantly increases bleeding risk. Contraindicated in most patients.',
      severity: 'DANGEROUS'
    }]
  },
  'lisinopril,ibuprofen': {
    scored: [{
      drug1: 'Lisinopril', drug2: 'Ibuprofen',
      description: 'NSAIDs like ibuprofen may reduce the antihypertensive effect of lisinopril and increase risk of kidney injury.',
      severity: 'CAUTION'
    }]
  }
}

// WHY: DEMO_FAERS pre-returns real adverse event counts for demo drugs.
// Prevents live API calls to FAERS during the presentation.
const DEMO_FAERS = {
  'warfarin': 42000,
  'ibuprofen': 28000,
  'lisinopril': 15000,
  'aspirin': 35000,
}

// Pre-written explanations for demo drug pairs — avoids live Anthropic call during presentation
const DEMO_EXPLANATIONS = {
  'warfarin,ibuprofen': `Warfarin is a blood thinner, and ibuprofen is a common anti-inflammatory painkiller. When taken together, ibuprofen can increase the blood-thinning effect of warfarin significantly, raising your risk of serious or life-threatening bleeding — including internal bleeding you might not notice.

This combination is considered dangerous. The risk is real even with a single dose of ibuprofen.

Do not take these medications together without speaking to your doctor or pharmacist first. If you need pain relief, ask about safer alternatives like acetaminophen (Tylenol). If you experience unusual bruising, prolonged bleeding, or blood in your urine or stool, seek medical attention immediately.`,
  'warfarin,aspirin': `Warfarin and aspirin both affect how your blood clots, but in different ways. Taking them together significantly increases your risk of serious bleeding — including in your stomach, brain, or other internal organs.

This combination is generally contraindicated, meaning most patients should not take them together unless specifically directed by a physician for a particular medical condition.

Contact your doctor before combining these medications. Do not stop either medication on your own without medical guidance.`,
  'lisinopril,ibuprofen': `Lisinopril is a blood pressure medication, and ibuprofen is a common anti-inflammatory pain reliever. Ibuprofen can reduce how well lisinopril controls your blood pressure, and the combination can also put extra stress on your kidneys.

This is a moderate interaction worth discussing with your doctor or pharmacist, especially if you take ibuprofen regularly.

For occasional pain, acetaminophen (Tylenol) is generally a safer choice with lisinopril. If you need to use ibuprofen, monitor your blood pressure and let your doctor know.`,
}

// --- DATA SOURCE 0: RxNorm — NDC barcode → drug name ---
// WHY: Medication bottles have NDC barcodes. Non-readers can scan instead of type.
// RxNorm accepts NDC codes and returns the RxCUI, which we then resolve to a name.
// TODO: implement full scan loop in BarcodeScanner.tsx (deferred — needs @zxing for iOS)
app.get('/api/drug/ndc', async (req, res) => {
  const { code } = req.query
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'NDC code is required.' })
  }

  const cacheKey = `ndc:${code}`
  const cached = cache.get(cacheKey)
  if (cached) return res.json(cached)

  try {
    // Step 1: NDC → RxCUI
    const rxUrl = `https://rxnav.nlm.nih.gov/REST/rxcui.json?idtype=NDC&id=${encodeURIComponent(code)}`
    const rxData = await fetch(rxUrl).then(r => r.json())
    const rxcui = rxData?.idGroup?.rxnormId?.[0]
    if (!rxcui) return res.status(404).json({ error: 'Drug not found for this barcode.' })

    // Step 2: RxCUI → drug name
    const nameUrl = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/property.json?propName=RxNorm%20Name`
    const nameData = await fetch(nameUrl).then(r => r.json())
    const name = nameData?.propConceptGroup?.propConcept?.[0]?.propValue

    if (!name) return res.status(404).json({ error: 'Could not resolve drug name.' })

    const result = { name, rxcui }
    cache.set(cacheKey, result)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Could not reach RxNorm API. Please try again.' })
  }
})

// --- DATA SOURCE 1: RxNorm — drug name → RxCUI normalization ---
// WHY: RxCUI is the standard drug ID used by all NIH/FDA systems.
// We can't query the interaction API with plain text — we need the numeric RxCUI.
// Docs: https://rxnav.nlm.nih.gov/RxNormAPIs.html
app.get('/api/drug/rxcui', async (req, res) => {
  const { name } = req.query

  // WHY: Input validation prevents empty or malformed queries from hitting the API.
  // An empty string sent to RxNorm returns garbage data. Catch it early.
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ error: 'Drug name must be at least 2 characters.' })
  }

  const cacheKey = `rxcui:${name.toLowerCase().trim()}`
  const cached = cache.get(cacheKey)
  if (cached) return res.json(cached)

  try {
    const url = `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name.trim())}&search=1`
    const data = await fetch(url).then(r => r.json())
    cache.set(cacheKey, data)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Could not reach RxNorm API. Please try again.' })
  }
})

// --- DATA SOURCE 2: RxNorm — interaction check by RxCUI list ---
// WHY: RxNorm is the gold standard for drug interaction detection.
// It's maintained by the NIH, free, no API key needed, and used in clinical systems.
// Docs: https://rxnav.nlm.nih.gov/InteractionAPIs.html
app.get('/api/interactions', async (req, res) => {
  const { rxcuis } = req.query

  // WHY: RxCUI codes must be numeric. Anything else will return bad data from RxNorm.
  if (!rxcuis || typeof rxcuis !== 'string') {
    return res.status(400).json({ error: 'rxcuis parameter is required.' })
  }
  const cuiList = rxcuis.split(',').map(s => s.trim())
  if (!cuiList.every(cui => /^\d+$/.test(cui))) {
    return res.status(400).json({ error: 'All RxCUI values must be numeric.' })
  }

  // DEMO_MODE: map RxCUI codes → drug names, look up pre-built interaction data
  if (process.env.DEMO_MODE === 'true') {
    const drugNames = cuiList.map(cui => DEMO_RXCUI_MAP[cui]).filter(Boolean)
    const demoKey = drugNames.sort().join(',')
    const demoResult = DEMO_INTERACTION_RAW[demoKey]
    if (demoResult) return res.json(demoResult)
  }

  const cacheKey = `interactions:${cuiList.sort().join(',')}`
  const cached = cache.get(cacheKey)
  if (cached) return res.json(cached)

  try {
    const url = `https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${cuiList.join(',')}`
    const data = await fetch(url).then(r => r.json())
    cache.set(cacheKey, data)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Could not reach RxNorm API. Please try again.' })
  }
})

// --- DATA SOURCE 3: OpenFDA FAERS — adverse event reports ---
// WHY: FAERS has 15M+ real adverse drug event reports from the FDA.
// This gives us real-world frequency data — how often has this combination hurt people?
// Used to enrich the results card, not as the primary detection source.
// Docs: https://open.fda.gov/apis/drug/event/
app.get('/api/faers', async (req, res) => {
  const { drug } = req.query

  if (!drug || typeof drug !== 'string' || drug.trim().length < 2) {
    return res.status(400).json({ error: 'Drug name must be at least 2 characters.' })
  }

  const cacheKey = `faers:${drug.toLowerCase().trim()}`
  const cached = cache.get(cacheKey)
  if (cached) return res.json(cached)

  // Check DEMO_MODE first
  if (process.env.DEMO_MODE === 'true') {
    const drugLower = drug.toLowerCase().trim()
    if (drugLower in DEMO_FAERS) {
      const result = { total: DEMO_FAERS[drugLower] }
      cache.set(cacheKey, result)
      return res.json(result)
    }
  }

  try {
    const url = `https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:"${encodeURIComponent(drug.trim())}"&limit=5`
    const data = await fetch(url).then(r => r.json())
    cache.set(cacheKey, data)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Could not reach OpenFDA API. Please try again.' })
  }
})

// --- Severity scoring engine ---
// WHY: Severity classification must be based on FDA/RxNorm data — never AI.
// AI can hallucinate severity levels. This is a safety-critical classification.
// We parse RxNorm's own severity language to produce SAFE/CAUTION/DANGEROUS.
// This keeps Claude in its lane: plain-English explanation only.
app.post('/api/score', async (req, res) => {
  const { interactionPairs } = req.body

  if (!Array.isArray(interactionPairs)) {
    return res.status(400).json({ error: 'interactionPairs must be an array.' })
  }

  // WHY: Check DEMO_MODE — if flagged, return pre-validated data for common demo pairs.
  // Normalize to lowercase so "Warfarin,Ibuprofen" matches "warfarin,ibuprofen" in the table.
  if (process.env.DEMO_MODE === 'true') {
    const demoKey = interactionPairs.map(p => p.drug1?.toLowerCase()).sort().join(',')
    const demoResult = DEMO_INTERACTIONS[demoKey]
    if (demoResult) return res.json(demoResult)
  }

  try {
    const scored = interactionPairs.map(pair => {
      const desc = (pair.description || '').toLowerCase()
      let severity = 'SAFE'
      if (desc.includes('contraindicated') || desc.includes('serious') || desc.includes('fatal') || desc.includes('death')) {
        severity = 'DANGEROUS'
      } else if (desc.includes('moderate') || desc.includes('caution') || desc.includes('monitor') || desc.includes('may increase')) {
        severity = 'CAUTION'
      }
      return { ...pair, severity }
    })
    res.json({ scored })
  } catch (err) {
    res.status(500).json({ error: 'Scoring failed. Please try again.' })
  }
})

// --- AI: Claude — plain English explanation of interactions ---
// WHY: Claude translates clinical FDA data into plain English for non-medical users.
// IMPORTANT: Claude does NOT determine if a drug interaction exists or how serious it is.
// That logic stays in /api/score using real FDA data. Claude only explains what it means.
// This prevents AI hallucination from affecting safety-critical information.
// Language code → full language name for the Claude prompt
const LANG_NAMES = {
  en: 'English', es: 'Spanish', zh: 'Simplified Chinese', hi: 'Hindi',
  ar: 'Arabic', bn: 'Bengali', pt: 'Portuguese', ru: 'Russian',
  fr: 'French', ur: 'Urdu', yi: 'Yiddish', nah: 'Nahuatl',
  ja: 'Japanese', de: 'German'
}

app.post('/api/explain', async (req, res) => {
  const { interactions, drugs, severity, lang = 'en' } = req.body

  if (!Array.isArray(drugs) || drugs.length === 0) {
    return res.status(400).json({ error: 'drugs array is required.' })
  }

  const languageName = LANG_NAMES[lang] || 'English'

  // DEMO_MODE: return pre-written explanation for known demo pairs — no Anthropic call needed
  if (process.env.DEMO_MODE === 'true') {
    const demoKey = drugs.map(d => d.toLowerCase()).sort().join(',')
    const demoExplanation = DEMO_EXPLANATIONS[demoKey]
    if (demoExplanation) return res.json({ explanation: demoExplanation })
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `You are a pharmacist explaining drug interactions to a patient (not a doctor).
Respond entirely in ${languageName}. Use plain language appropriate for that language's speakers.

Medications entered: ${drugs.join(', ')}
Severity level determined by FDA data: ${severity}
Interactions found (from FDA/RxNorm data): ${JSON.stringify(interactions)}

In 2-3 short paragraphs:
1. What the interaction is and what body systems are affected
2. How serious it is and what could happen
3. What the patient should do (call pharmacist, avoid combination, monitor symptoms, etc.)

Use plain language. No medical jargon. Be direct and caring. Respond in ${languageName}.`
      }]
    })

    res.json({ explanation: message.content[0].text })
  } catch (err) {
    res.status(500).json({ error: 'AI explanation unavailable. Please try again.' })
  }
})

// Global error handler — catches anything that escapes route try/catch blocks
// Logs to console so Vercel function logs show the actual error
app.use((err, req, res, _next) => {
  console.error('[MedPharmChex] Unhandled error:', err.message, err.stack)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

// Local dev: listen on PORT
// Vercel serverless: export the app — Vercel routes requests directly, no listen() needed
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`MedPharmChex backend running on :${PORT}`))
}

export default app
