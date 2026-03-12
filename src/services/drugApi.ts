// Dev: Vite proxy routes /api → localhost:3001 (no CORS needed). Prod: set VITE_API_URL.
const BASE = import.meta.env.VITE_API_URL || '/api'

// WHY: Central fetch helper — checks HTTP status before parsing JSON.
// Without this, a 500 from the backend returns silently as a malformed object,
// and the user sees a blank result instead of an error message.
async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Server error ${res.status}`)
  }
  return res.json()
}

// Resolve drug name → RxCUI code via RxNorm
export async function getRxCUI(name: string) {
  return apiFetch(`${BASE}/drug/rxcui?name=${encodeURIComponent(name)}`)
}

// Get interactions between drugs by RxCUI codes
// RxCUI = standard drug ID from NIH RxNorm
export async function getInteractions(rxcuis: string[]) {
  return apiFetch(`${BASE}/interactions?rxcuis=${rxcuis.join(',')}`)
}

// Score interaction severity (SAFE / CAUTION / DANGEROUS)
export async function scoreInteractions(interactionPairs: unknown[]) {
  return apiFetch(`${BASE}/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ interactionPairs })
  })
}

// Claude AI plain-English explanation (Claude only explains — FDA data detects)
// lang: BCP 47 language code — Claude will respond in that language
export async function explainInteractions(drugs: string[], interactions: unknown, severity: string, lang = 'en') {
  return apiFetch(`${BASE}/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drugs, interactions, severity, lang })
  })
}

// OpenFDA FAERS adverse event data for a drug
export async function getFAERS(drug: string) {
  return apiFetch(`${BASE}/faers?drug=${encodeURIComponent(drug)}`)
}

// Resolve NDC barcode → drug name via RxNorm
// TODO: called by BarcodeScanner when a barcode is successfully decoded
export async function getDrugByNDC(ndc: string) {
  return apiFetch(`${BASE}/drug/ndc?code=${encodeURIComponent(ndc)}`)
}
