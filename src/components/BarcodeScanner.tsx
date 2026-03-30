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

import { useRef, useState, useEffect, useCallback } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
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
  const zxingControlsRef = useRef<IScannerControls | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const lastTriedRef = useRef<string | null>(null)

  // Normalize NDC barcode to formats RxNorm accepts.
  // Pill bottles use EAN-13/UPC which may encode NDC with a leading zero or
  // country prefix. We strip to digits and try multiple candidate forms.
  const normalizeNDC = (raw: string): string[] => {
    const digits = raw.replace(/\D/g, '')
    const candidates: string[] = [digits]
    // 10-digit NDC: pad to 11 digits with leading zero (RxNorm prefers 11)
    if (digits.length === 10) candidates.push('0' + digits)
    // 12-digit UPC-A: strip leading zero → 11-digit NDC
    if (digits.length === 12) candidates.push(digits.slice(1))
    // EAN-13: leading country digit + 10-digit NDC + check digit
    // Extract the 11-digit and 10-digit NDC from the middle
    if (digits.length === 13) {
      candidates.push(digits.slice(1, 12))  // 11 digits (country stripped)
      candidates.push(digits.slice(2, 12))  // 10 digits (NDC proper)
    }
    return [...new Set(candidates)]
  }

  const handleNDC = useCallback(async (raw: string) => {
    // Validate — NDC barcodes are digits only, max 13 chars (EAN-13)
    if (!raw || raw.length > 20 || !/^[\d\-\s]+$/.test(raw)) return

    // Deduplicate — zxing fires the callback on every frame
    if (lastTriedRef.current === raw) return
    lastTriedRef.current = raw

    setScanStatus('Found barcode — looking up drug…')

    const candidates = normalizeNDC(raw)
    for (const code of candidates) {
      // Bail if scanning was stopped while API call was in flight
      if (!scanningRef.current) return
      try {
        const data = await getDrugByNDC(code)
        if (data.name) {
          if (scanningRef.current) onDrug(data.name)  // guard before firing callback
          stopScan()
          return
        }
      } catch {
        // try next candidate
      }
    }

    // No candidate matched — show truncated sanitized barcode so user can type manually
    const display = raw.replace(/[<>&"']/g, '').slice(0, 20)
    setScanStatus(`Barcode "${display}" not found in drug database. Try typing the drug name.`)
    lastTriedRef.current = null  // reset so user can retry the same barcode
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDrug])

  // Called from useEffect after <video> is mounted. Stream already acquired.
  const startScanNative = useCallback((stream: MediaStream) => {
    if (!scanningRef.current) return
    if (!videoRef.current) {
      setError('Could not start camera. Please try again.')
      setScanning(false)
      scanningRef.current = false
      return
    }

    streamRef.current = stream
    videoRef.current.srcObject = stream
    videoRef.current.play().catch(() => {})

    const detector = new window.BarcodeDetector!({ formats: ['upc_a', 'upc_e', 'ean_13', 'ean_8', 'code_128'] })

    let detecting = false
    const scanLoop = async () => {
      if (!scanningRef.current) return
      if (!videoRef.current) return
      if (detecting) { animFrameRef.current = requestAnimationFrame(scanLoop); return }
      detecting = true
      try {
        const barcodes = await detector.detect(videoRef.current)
        if (barcodes.length > 0 && scanningRef.current) {
          await handleNDC(barcodes[0].rawValue)
          return
        }
      } catch { /* continue */ }
      detecting = false
      if (scanningRef.current) animFrameRef.current = requestAnimationFrame(scanLoop)
    }
    animFrameRef.current = requestAnimationFrame(scanLoop)
  }, [handleNDC])

  // Called from useEffect after <video> is mounted. Uses pre-acquired stream
  // via decodeFromStream so getUserMedia is never called outside gesture context.
  const startScanZxing = useCallback(async (stream: MediaStream) => {
    if (!scanningRef.current) return
    if (!videoRef.current) {
      setError('Could not start camera. Please try again.')
      setScanning(false)
      scanningRef.current = false
      return
    }

    const reader = new BrowserMultiFormatReader()
    streamRef.current = stream

    try {
      // decodeFromStream returns controls — must call controls.stop() to kill the decode loop.
      const controls = await reader.decodeFromStream(
        stream,
        videoRef.current,
        async (result, _err) => {
          if (!scanningRef.current) return
          if (result) {
            await handleNDC(result.getText())
          }
          // _err here is normal "no barcode yet" — not a real error
        }
      )
      zxingControlsRef.current = controls
    } catch {
      if (scanningRef.current) {
        setError('Could not start camera. Please try again.')
        setScanning(false)
        scanningRef.current = false
      }
    }
  }, [handleNDC])

  // After React mounts <video>, attach the pre-acquired stream and start scanning.
  // videoRef.current is guaranteed non-null here (useEffect runs post-commit).
  useEffect(() => {
    if (!scanning || !streamRef.current) return
    const stream = streamRef.current

    if (hasNativeDetector()) {
      startScanNative(stream)
    } else {
      startScanZxing(stream)
    }

    // Cleanup: stop everything if component unmounts or scanning state changes
    return () => {
      stopScan()
    }
  }, [scanning, startScanNative, startScanZxing])

  // Acquire camera stream NOW in user gesture context — iOS Safari requires
  // getUserMedia to be called synchronously from a tap/click event.
  const startScan = async () => {
    // Guard against double-tap starting two streams
    if (scanningRef.current || streamRef.current) return

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
    // Cancel native scan loop first
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    // Stop zxing decode loop before releasing the stream
    zxingControlsRef.current?.stop()
    zxingControlsRef.current = null
    // Then release the camera stream
    streamRef.current?.getTracks().forEach(t => {
      if (t.readyState === 'live') t.stop()
    })
    streamRef.current = null
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
