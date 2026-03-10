/**
 * BarcodeScanner — scan medication bottle barcode to fill a drug input
 *
 * For non-readers: instead of typing a drug name, they can scan the barcode
 * on the pill bottle. Zero literacy required.
 *
 * Strategy:
 *   1. Try native BarcodeDetector API (Chrome 83+, Android Chrome, Edge)
 *   2. If unavailable, show friendly message to use Chrome
 *   3. TODO: add @zxing/library fallback for Safari/iOS (post-Demo Day)
 *
 * The NDC (National Drug Code) is a barcode format on US medication bottles.
 * We send the code to /api/drug/ndc which returns the drug name.
 */

import { useRef, useState } from 'react'

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

const isSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window

export default function BarcodeScanner({ onDrug, disabled }: BarcodeScannerProps) {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(true)

  const startScan = async () => {
    if (!isSupported) {
      setError('Barcode scanning requires Chrome on Android. Type the drug name instead.')
      return
    }

    setError(null)
    setScanning(true)
    scanningRef.current = true

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }  // back camera
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream

      // Initialize barcode detector
      const detector = new window.BarcodeDetector!({ formats: ['upc_a', 'upc_e', 'ean_13', 'ean_8', 'code_128'] })

      // Decode loop on each animation frame
      const scanLoop = async () => {
        if (!scanningRef.current || !videoRef.current) return

        try {
          const barcodes = await detector.detect(videoRef.current)
          
          if (barcodes.length > 0) {
            const ndc = barcodes[0].rawValue
            
            // Query /api/drug/ndc with the barcode code
            const response = await fetch(`/api/drug/ndc?code=${encodeURIComponent(ndc)}`)
            const data = await response.json()
            
            if (data.name) {
              // Drug found — call onDrug and stop scanning
              onDrug(data.name)
              stopScan()
              return
            }
          }
        } catch (err) {
          // Silently continue scanning on detect error
        }

        // Continue scanning
        if (scanningRef.current) {
          requestAnimationFrame(scanLoop)
        }
      }

      scanLoop()

    } catch (err) {
      setError('Camera access denied. Please allow camera permission and try again.')
      setScanning(false)
      scanningRef.current = false
    }
  }

  const stopScan = () => {
    scanningRef.current = false
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
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
