/**
 * BarcodeScanner tests
 *
 * Covers:
 *  1. UI state (scan button ↔ video + stop button)
 *  2. Native BarcodeDetector path (Chrome/Android)
 *  3. @zxing/browser fallback path (iOS/Safari/Firefox)
 *  4. Camera permission denied
 *  5. NDC lookup + drug name resolution
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import BarcodeScanner from '../components/BarcodeScanner'

// ─── Hoist mocks so they're available inside vi.mock factories ────────────────

const { mockDecodeFromStream, mockReleaseAllStreams } = vi.hoisted(() => ({
  mockDecodeFromStream: vi.fn(),
  mockReleaseAllStreams: vi.fn(),
}))

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: class {
    decodeFromStream = mockDecodeFromStream
  },
  BrowserCodeReader: class {
    static releaseAllStreams = mockReleaseAllStreams
  },
}))

vi.mock('../services/drugApi', () => ({
  getDrugByNDC: vi.fn(),
}))

import { getDrugByNDC } from '../services/drugApi'
const mockGetDrugByNDC = getDrugByNDC as ReturnType<typeof vi.fn>

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockStopTrack = vi.fn()
const mockStream = { getTracks: () => [{ stop: mockStopTrack }] } as unknown as MediaStream

function withNativeDetector(detect = vi.fn().mockResolvedValue([])) {
  const _detect = detect
  const ctor = vi.fn().mockImplementation(class { detect = _detect })
  Object.defineProperty(window, 'BarcodeDetector', { value: ctor, writable: true, configurable: true })
  return { ctor, detect }
}

function withoutNativeDetector() {
  // Must delete rather than set to undefined — `'BarcodeDetector' in window` returns true
  // even when the value is undefined, which would still trigger the native code path.
  delete (window as unknown as Record<string, unknown>).BarcodeDetector
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
    writable: true,
    configurable: true,
  })
  mockGetDrugByNDC.mockResolvedValue({ name: 'Ibuprofen' })
  // Resolves immediately — scanning=true stays set, component renders stop button
  mockDecodeFromStream.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── UI state ─────────────────────────────────────────────────────────────────

describe('BarcodeScanner — UI', () => {
  it('renders the scan button initially', () => {
    withoutNativeDetector()
    render(<BarcodeScanner onDrug={vi.fn()} />)
    expect(screen.getByRole('button', { name: /scan medication barcode/i })).toBeInTheDocument()
  })

  it('disables scan button when disabled prop is set', () => {
    withoutNativeDetector()
    render(<BarcodeScanner onDrug={vi.fn()} disabled />)
    expect(screen.getByRole('button', { name: /scan medication barcode/i })).toBeDisabled()
  })

  it('shows video and stop button after clicking scan', async () => {
    withoutNativeDetector()
    render(<BarcodeScanner onDrug={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /scan medication barcode/i }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /stop scanning/i })).toBeInTheDocument()
    )
    // video element is present
    expect(document.querySelector('video')).toBeInTheDocument()
  })

  it('returns to scan button after clicking stop', async () => {
    withoutNativeDetector()
    render(<BarcodeScanner onDrug={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /scan medication barcode/i }))
    await waitFor(() => screen.getByRole('button', { name: /stop scanning/i }))

    fireEvent.click(screen.getByRole('button', { name: /stop scanning/i }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /scan medication barcode/i })).toBeInTheDocument()
    )
    expect(screen.queryByRole('button', { name: /stop scanning/i })).not.toBeInTheDocument()
  })
})

// ─── Native BarcodeDetector path ─────────────────────────────────────────────

describe('BarcodeScanner — native BarcodeDetector', () => {
  it('calls getUserMedia with back camera when BarcodeDetector is available', async () => {
    withNativeDetector()  // eslint-disable-line @typescript-eslint/no-unused-vars
    render(<BarcodeScanner onDrug={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /scan medication barcode/i }))
    await waitFor(() =>
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: { facingMode: 'environment' },
      })
    )
  })

  it('constructs BarcodeDetector with the expected formats', async () => {
    const { ctor } = withNativeDetector()
    render(<BarcodeScanner onDrug={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /scan medication barcode/i }))
    await waitFor(() => expect(ctor).toHaveBeenCalled())
    const [opts] = ctor.mock.calls[0]
    expect(opts.formats).toContain('upc_a')
    expect(opts.formats).toContain('ean_13')
  })

  it('stops stream tracks when stop is clicked', async () => {
    withNativeDetector()
    render(<BarcodeScanner onDrug={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /scan medication barcode/i }))
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled())
    await waitFor(() => screen.getByRole('button', { name: /stop scanning/i }))
    fireEvent.click(screen.getByRole('button', { name: /stop scanning/i }))
    await waitFor(() => expect(mockStopTrack).toHaveBeenCalled())
  })
})

// ─── zxing fallback path (iOS / Safari / Firefox) ────────────────────────────

describe('BarcodeScanner — zxing fallback (iOS/Safari)', () => {
  beforeEach(() => withoutNativeDetector())

  it('calls getUserMedia in click handler (iOS gesture context requirement)', async () => {
    render(<BarcodeScanner onDrug={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /scan medication barcode/i }))
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: 'environment' },
    }))
  })

  it('calls decodeFromStream with the pre-acquired stream', async () => {
    render(<BarcodeScanner onDrug={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /scan medication barcode/i }))
    await waitFor(() => expect(mockDecodeFromStream).toHaveBeenCalled())
    expect(mockDecodeFromStream.mock.calls[0][0]).toBe(mockStream)
  })

  it('calls onDrug when zxing fires a barcode result', async () => {
    const onDrug = vi.fn()
    let zxingCb!: (r: { getText(): string } | null, e: unknown) => void

    mockDecodeFromStream.mockImplementation(
      async (_s: unknown, _v: unknown, cb: typeof zxingCb) => {
        zxingCb = cb
      }
    )
    mockGetDrugByNDC.mockResolvedValue({ name: 'Ibuprofen' })

    render(<BarcodeScanner onDrug={onDrug} />)
    fireEvent.click(screen.getByRole('button', { name: /scan medication barcode/i }))

    await waitFor(() => expect(mockDecodeFromStream).toHaveBeenCalled())

    // Simulate zxing finding a barcode
    await zxingCb({ getText: () => '00071015523' }, null)

    await waitFor(() => expect(onDrug).toHaveBeenCalledWith('Ibuprofen'))
    expect(mockGetDrugByNDC).toHaveBeenCalledWith('00071015523')
  })

  it('ignores null results (no barcode visible yet)', async () => {
    const onDrug = vi.fn()
    let zxingCb!: (r: null, e: Error) => void

    mockDecodeFromStream.mockImplementation(
      async (_s: unknown, _v: unknown, cb: typeof zxingCb) => {
        zxingCb = cb
      }
    )

    render(<BarcodeScanner onDrug={onDrug} />)
    fireEvent.click(screen.getByRole('button', { name: /scan medication barcode/i }))
    await waitFor(() => expect(mockDecodeFromStream).toHaveBeenCalled())

    zxingCb(null, new Error('No barcode'))
    await new Promise(r => setTimeout(r, 50))

    expect(onDrug).not.toHaveBeenCalled()
  })

  it('calls releaseAllStreams when stop is clicked', async () => {
    render(<BarcodeScanner onDrug={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /scan medication barcode/i }))
    await waitFor(() => screen.getByRole('button', { name: /stop scanning/i }))

    fireEvent.click(screen.getByRole('button', { name: /stop scanning/i }))
    await waitFor(() => expect(mockReleaseAllStreams).toHaveBeenCalled())
  })
})

// ─── NDC normalization + scan status feedback ─────────────────────────────────

describe('BarcodeScanner — NDC normalization', () => {
  beforeEach(() => withoutNativeDetector())

  // Helper: render, click scan, wait for zxing to register, then fire barcode
  const setupAndFire = async (barcode: string, onDrug = vi.fn()) => {
    let zxingCb!: (r: { getText(): string } | null, e: unknown) => void
    mockDecodeFromStream.mockImplementation(
      async (_s: unknown, _v: unknown, cb: typeof zxingCb) => { zxingCb = cb }
    )
    render(<BarcodeScanner onDrug={onDrug} />)
    fireEvent.click(screen.getByRole('button', { name: /scan medication barcode/i }))
    await waitFor(() => expect(mockDecodeFromStream).toHaveBeenCalled())
    await zxingCb({ getText: () => barcode }, null)
    return onDrug
  }

  it('tries the raw value first (11-digit NDC resolves immediately)', async () => {
    mockGetDrugByNDC.mockResolvedValue({ name: 'Aspirin' })
    const onDrug = await setupAndFire('00071015523')
    await waitFor(() => expect(onDrug).toHaveBeenCalledWith('Aspirin'))
    // First candidate '00071015523' succeeds — no second call needed
    expect(mockGetDrugByNDC).toHaveBeenCalledWith('00071015523')
  })

  it('strips leading zero from 12-digit EAN barcode to find NDC', async () => {
    // EAN-13 style: first digit is country/system prefix, rest is NDC
    // Raw: 000712345678 (12 digits) → also tries 00712345678 (11 digits)
    mockGetDrugByNDC
      .mockRejectedValueOnce(new Error('not found'))   // raw 12-digit fails
      .mockResolvedValueOnce({ name: 'Lisinopril' })   // 11-digit succeeds
    const onDrug = await setupAndFire('000712345678')
    await waitFor(() => expect(onDrug).toHaveBeenCalledWith('Lisinopril'))
    expect(mockGetDrugByNDC).toHaveBeenCalledWith('000712345678')
    expect(mockGetDrugByNDC).toHaveBeenCalledWith('00712345678')
  })

  it('strips two leading digits from 13-digit EAN-13 barcode', async () => {
    // EAN-13: 0300450449108 → also try 300450449108 (12) and 00450449108 (11)
    mockGetDrugByNDC
      .mockRejectedValueOnce(new Error('not found'))   // 13-digit fails
      .mockRejectedValueOnce(new Error('not found'))   // 12-digit fails
      .mockResolvedValueOnce({ name: 'Metformin' })    // 11-digit succeeds
    const onDrug = await setupAndFire('0300450449108')
    await waitFor(() => expect(onDrug).toHaveBeenCalledWith('Metformin'))
    expect(mockGetDrugByNDC).toHaveBeenCalledTimes(3)
  })

  it('shows "not found" status when no NDC candidate matches', async () => {
    mockGetDrugByNDC.mockRejectedValue(new Error('not found'))
    await setupAndFire('00071015523')
    await waitFor(() =>
      expect(screen.getByText(/not found in drug database/i)).toBeInTheDocument()
    )
  })

  it('shows "looking up" status immediately after barcode detected', async () => {
    // getDrugByNDC never resolves — lets us assert the intermediate "looking up" state
    mockGetDrugByNDC.mockReturnValue(new Promise(() => {}))
    let zxingCb!: (r: { getText(): string } | null, e: unknown) => void
    mockDecodeFromStream.mockImplementation(
      async (_s: unknown, _v: unknown, cb: typeof zxingCb) => { zxingCb = cb }
    )
    render(<BarcodeScanner onDrug={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /scan medication barcode/i }))
    await waitFor(() => expect(mockDecodeFromStream).toHaveBeenCalled())

    // Don't await — getDrugByNDC never resolves, so handleNDC never finishes.
    // setScanStatus fires synchronously before the first await inside handleNDC.
    void zxingCb({ getText: () => '00071015523' }, null)

    await waitFor(() =>
      expect(screen.getByText(/looking up drug/i)).toBeInTheDocument()
    )
  })

  it('deduplicates — concurrent callbacks for same barcode only trigger one lookup', async () => {
    mockGetDrugByNDC.mockReturnValue(new Promise(() => {})) // never resolves → ref stays set
    let zxingCb!: (r: { getText(): string } | null, e: unknown) => void
    mockDecodeFromStream.mockImplementation(
      async (_s: unknown, _v: unknown, cb: typeof zxingCb) => { zxingCb = cb }
    )
    render(<BarcodeScanner onDrug={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /scan medication barcode/i }))
    await waitFor(() => expect(mockDecodeFromStream).toHaveBeenCalled())

    // Fire both without awaiting — simulates same barcode seen on two consecutive frames.
    // The second fires while the first is still awaiting getDrugByNDC, so lastTriedRef
    // is still set → second is a no-op.
    void zxingCb({ getText: () => '12345678901' }, null)
    void zxingCb({ getText: () => '12345678901' }, null)
    await new Promise(r => setTimeout(r, 50))

    // Only the first callback triggered a lookup; the second was deduplicated.
    // normalizeNDC('12345678901') → 2 candidates but getDrugByNDC never resolves
    // so it fires at most once (first candidate).
    expect(mockGetDrugByNDC).toHaveBeenCalledTimes(1)
  })
})

// ─── Camera permission denied ─────────────────────────────────────────────────

describe('BarcodeScanner — camera denied', () => {
  it('shows error when camera is denied (native path)', async () => {
    withNativeDetector()
    ;(navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'))

    render(<BarcodeScanner onDrug={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /scan medication barcode/i }))

    await waitFor(() =>
      expect(screen.getByText(/camera access denied/i)).toBeInTheDocument()
    )
  })

  it('shows error when camera is denied (zxing path)', async () => {
    withoutNativeDetector()
    ;(navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'))

    render(<BarcodeScanner onDrug={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /scan medication barcode/i }))

    await waitFor(() =>
      expect(screen.getByText(/camera access denied/i)).toBeInTheDocument()
    )
  })

  it('shows no-camera error when device has no camera', async () => {
    withoutNativeDetector()
    ;(navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new DOMException('Not found', 'NotFoundError'))

    render(<BarcodeScanner onDrug={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /scan medication barcode/i }))

    await waitFor(() =>
      expect(screen.getByText(/no camera found/i)).toBeInTheDocument()
    )
  })
})
