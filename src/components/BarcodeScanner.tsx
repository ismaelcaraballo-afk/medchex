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
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null)

  const handleNDC = async (ndc: string) => {
    try {
      const data = await getDrugByNDC(ndc)
      if (data.name) {
        onDrug(data.name)
        stopScan()
      }
    } catch {
      // NDC not found — keep scanning
    }
  }

  const startScanNative = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    })
    streamRef.current = stream
    if (videoRef.current) videoRef.current.srcObject = stream

    const detector = new window.BarcodeDetector!({ formats: ['upc_a', 'upc_e', 'ean_13', 'ean_8', 'code_128'] })

    let detecting = false
    const scanLoop = async () => {
      if (!scanningRef.current) return
      // Video element may not be in DOM yet if React hasn't re-rendered — retry next frame
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

  const startScanZxing = async () => {
    const reader = new BrowserMultiFormatReader()
    zxingReaderRef.current = reader

    // zxing manages the stream internally — pass the video element
    await reader.decodeFromConstraints(
      { video: { facingMode: 'environment' } },
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

  // Kick off camera after React has rendered <video> and videoRef.current is set.
  // If startScan called the scan path directly, videoRef.current would be null
  // because React hasn't re-rendered yet — this breaks iOS/Safari (zxing gets null).
  useEffect(() => {
    if (!scanning) return
    let active = true

    const run = async () => {
      try {
        if (hasNativeDetector()) {
          await startScanNative()
        } else {
          await startScanZxing()
        }
      } catch (err) {
        if (!active) return
        if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
          setError('Camera access denied. Please allow camera permission and try again.')
        } else if (err instanceof DOMException && err.name === 'NotFoundError') {
          setError('No camera found on this device.')
        } else {
          setError('Could not start camera. Please try again.')
        }
        setScanning(false)
        scanningRef.current = false
      }
    }

    run()
    return () => { active = false }
  }, [scanning]) // eslint-disable-line react-hooks/exhaustive-deps

  const startScan = () => {
    setError(null)
    scanningRef.current = true
    setScanning(true) // triggers re-render → <video> mounts → useEffect starts camera
  }

  const stopScan = () => {
    scanningRef.current = false
    // Stop native stream tracks
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    // Stop zxing reader — releases all tracked streams
    BrowserCodeReader.releaseAllStreams()
    zxingReaderRef.current = null
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
          <p className="scan-hint">Point camera at pill bottle barcode</p>
        </div>
      )}
      {error && <p className="scan-error">{error}</p>}
    </div>
  )
}
