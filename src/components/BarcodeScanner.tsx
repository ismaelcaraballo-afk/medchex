/**
 * BarcodeScanner — scan medication bottle barcode to fill a drug input
 *
 * For non-readers: instead of typing a drug name, they can scan the barcode
 * on the pill bottle. Zero literacy required.
 *
 * Strategy:
 *   1. Try native BarcodeDetector API (Chrome 83+, Android Chrome, Edge) — fast
 *   2. Fall back to @zxing/browser (Safari, iOS, Firefox, all other browsers)
 *
 * iOS Safari requires getUserMedia to be called directly from a tap event.
 * So we acquire the stream in the click handler (gesture context), then
 * attach it to the <video> element once React has rendered it (useEffect).
 *
 * The NDC (National Drug Code) is a barcode format on US medication bottles.
 * We send the code to /api/drug/ndc which returns the drug name.
 */

import { useRef, useState, useEffect } from 'react'
import { BrowserMultiFormatReader, BrowserCodeReader } from '@zxing/browser'
import { getDrugByNDC } from '../services/drugApi'

interface BarcodeScannerProps {
  onDrug: (name: string) => void   // called with resolved drug name
  disabled?: boolean
}

// BarcodeDetector is not in TypeScript's default lib — declare it
declare global {
  interface Window {
    BarcodeDetector?: {
      new(options: { formats: string[] }): {
        detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>>
      }
      getSupportedFormats(): Promise<string[]>
    }
  }
}

// Checked at call time (not module load time) so tests can set window.BarcodeDetector per-case
const hasNativeDetector = () => typeof window !== 'undefined' && 'BarcodeDetector' in window

export default function BarcodeScanner({ onDrug, disabled }: BarcodeScannerProps) {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanStatus, setScanStatus] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null)
  const lastTriedRef = useRef<string | null>(null)

  // Normalize NDC barcode to formats RxNorm accepts.
  // Pill bottles use EAN-13/UPC which may encode NDC with a leading zero or
  // country prefix. We strip to digits and try the 11-digit and 10-digit forms.
  const normalizeNDC = (raw: string): string[] => {
    const digits = raw.replace(/\D/g, '')
    const candidates: string[] = [digits]
    // EAN-13 often has a leading '0' before the 10-digit NDC
    if (digits.length === 12) candidates.push(digits.slice(1))   // 12 → 11
    if (digits.length === 13) candidates.push(digits.slice(1), digits.slice(2)) // 13 → 12 → 11
    if (digits.length === 11) candidates.push(digits.slice(1))   // 11 → 10
    return [...new Set(candidates)]
  }

  const handleNDC = async (raw: string) => {
    // Deduplicate — zxing fires the callback on every frame
    if (lastTriedRef.current === raw) return
    lastTriedRef.current = raw

    setScanStatus(`Found barcode — looking up drug…`)

    const candidates = normalizeNDC(raw)
    for (const code of candidates) {
      try {
        const data = await getDrugByNDC(code)
        if (data.name) {
          onDrug(data.name)
          stopScan()
          return
        }
      } catch {
        // try next candidate
      }
    }

    // No candidate matched — show what was scanned so user can type it manually
    setScanStatus(`Barcode "${raw}" not found in drug database. Try typing the drug name.`)
    lastTriedRef.current = null  // allow retry if they point at same barcode again
  }

  // Called from useEffect after <video> is mounted. Stream already acquired.
  const startScanNative = (stream: MediaStream) => {
    streamRef.current = stream
    if (videoRef.current) videoRef.current.srcObject = stream

    const detector = new window.BarcodeDetector!({ formats: ['upc_a', 'upc_e', 'ean_13', 'ean_8', 'code_128'] })

    let detecting = false
    const scanLoop = async () => {
      if (!scanningRef.current) return
      if (!videoRef.current) { requestAnimationFrame(scanLoop); return }
      if (detecting) { requestAnimationFrame(scanLoop); return }
      detecting = true
      try {
        const barcodes = await detector.detect(videoRef.current)
        if (barcodes.length > 0) {
          await handleNDC(barcodes[0].rawValue)
          return
        }
      } catch { /* continue */ }
      detecting = false
      if (scanningRef.current) requestAnimationFrame(scanLoop)
    }
    scanLoop()
  }

  // Called from useEffect after <video> is mounted. Uses pre-acquired stream
  // via decodeFromStream so getUserMedia is never called outside gesture context.
  const startScanZxing = async (stream: MediaStream) => {
    const reader = new BrowserMultiFormatReader()
    zxingReaderRef.current = reader
    streamRef.current = stream

    await reader.decodeFromStream(
      stream,
      videoRef.current!,
      async (result, _err) => {
        if (!scanningRef.current) return
        if (result) {
          await handleNDC(result.getText())
        }
        // _err here is normal "no barcode yet" — not a real error
      }
    )
  }

  // After React mounts <video>, attach the pre-acquired stream and start scanning.
  // videoRef.current is guaranteed non-null here (useEffect runs post-commit).
  useEffect(() => {
    if (!scanning || !streamRef.current) return
    const stream = streamRef.current
    let active = true

    const run = async () => {
      try {
        if (hasNativeDetector()) {
          startScanNative(stream)
        } else {
          await startScanZxing(stream)
        }
      } catch (err) {
        if (!active) return
        setError('Could not start camera. Please try again.')
        setScanning(false)
        scanningRef.current = false
      }
    }

    run()
    return () => { active = false }
  }, [scanning]) // eslint-disable-line react-hooks/exhaustive-deps

  // Acquire camera stream NOW in user gesture context — iOS Safari requires
  // getUserMedia to be called synchronously from a tap/click event.
  const startScan = async () => {
    setError(null)
    scanningRef.current = true

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      streamRef.current = stream
    } catch (err) {
      scanningRef.current = false
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        setError('Camera access denied. Please allow camera permission and try again.')
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        setError('No camera found on this device.')
      } else {
        setError('Could not start camera. Please try again.')
      }
      return
    }

    setScanning(true) // triggers re-render → <video> mounts → useEffect attaches stream
  }

  const stopScan = () => {
    scanningRef.current = false
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    BrowserCodeReader.releaseAllStreams()
    zxingReaderRef.current = null
    lastTriedRef.current = null
    setScanStatus(null)
    setScanning(false)
  }

  return (
    <div className="barcode-scanner">
      {!scanning ? (
        <button
          type="button"
          className="scan-btn"
          onClick={startScan}
          disabled={disabled}
          aria-label="Scan medication barcode"
          title="Scan pill bottle barcode"
        >
          📷
        </button>
      ) : (
        <div className="scan-active">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="scan-video"
            aria-label="Camera viewfinder"
          />
          <button
            type="button"
            className="scan-stop-btn"
            onClick={stopScan}
            aria-label="Stop scanning"
          >
            ✕ Stop
          </button>
          <p className="scan-hint">
            {scanStatus ?? 'Point camera at pill bottle barcode'}
          </p>
        </div>
      )}
      {error && <p className="scan-error">{error}</p>}
    </div>
  )
}
