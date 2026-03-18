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

const { mockDecodeFromConstraints, mockReleaseAllStreams } = vi.hoisted(() => ({
  mockDecodeFromConstraints: vi.fn(),
  mockReleaseAllStreams: vi.fn(),
}))

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: class {
    decodeFromConstraints = mockDecodeFromConstraints
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
  mockDecodeFromConstraints.mockResolvedValue(undefined)
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
// Note: the scan loop uses requestAnimationFrame + videoRef, which is tightly
// coupled to React render timing in jsdom. We test the setup behavior (getUserMedia
// called with correct constraints, stream cleanup) and leave decode loop coverage
// to the zxing path tests which use a callback-based mock instead.

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
    // Wait for scan to begin (getUserMedia called)
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled())
    // Stop button appears because scanning=true
    await waitFor(() => screen.getByRole('button', { name: /stop scanning/i }))
    fireEvent.click(screen.getByRole('button', { name: /stop scanning/i }))
    await waitFor(() => expect(mockStopTrack).toHaveBeenCalled())
  })
})

// ─── zxing fallback path (iOS / Safari / Firefox) ────────────────────────────

describe('BarcodeScanner — zxing fallback (iOS/Safari)', () => {
  beforeEach(() => withoutNativeDetector())

  it('calls decodeFromConstraints when BarcodeDetector is unavailable', async () => {
    render(<BarcodeScanner onDrug={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /scan medication barcode/i }))
    await waitFor(() => expect(mockDecodeFromConstraints).toHaveBeenCalled())
  })

  it('requests back camera via environment facing mode', async () => {
    render(<BarcodeScanner onDrug={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /scan medication barcode/i }))
    await waitFor(() => expect(mockDecodeFromConstraints).toHaveBeenCalled())
    expect(mockDecodeFromConstraints.mock.calls[0][0]).toEqual({ video: { facingMode: 'environment' } })
  })

  it('calls onDrug when zxing fires a barcode result', async () => {
    const onDrug = vi.fn()
    let zxingCb!: (r: { getText(): string } | null, e: unknown) => void

    mockDecodeFromConstraints.mockImplementation(
      async (_c: unknown, _v: unknown, cb: typeof zxingCb) => {
        zxingCb = cb
      }
    )
    mockGetDrugByNDC.mockResolvedValue({ name: 'Ibuprofen' })

    render(<BarcodeScanner onDrug={onDrug} />)
    fireEvent.click(screen.getByRole('button', { name: /scan medication barcode/i }))

    await waitFor(() => expect(mockDecodeFromConstraints).toHaveBeenCalled())

    // Simulate zxing finding a barcode
    await zxingCb({ getText: () => '00071015523' }, null)

    await waitFor(() => expect(onDrug).toHaveBeenCalledWith('Ibuprofen'))
    expect(mockGetDrugByNDC).toHaveBeenCalledWith('00071015523')
  })

  it('ignores null results (no barcode visible yet)', async () => {
    const onDrug = vi.fn()
    let zxingCb!: (r: null, e: Error) => void

    mockDecodeFromConstraints.mockImplementation(
      async (_c: unknown, _v: unknown, cb: typeof zxingCb) => {
        zxingCb = cb
      }
    )

    render(<BarcodeScanner onDrug={onDrug} />)
    fireEvent.click(screen.getByRole('button', { name: /scan medication barcode/i }))
    await waitFor(() => expect(mockDecodeFromConstraints).toHaveBeenCalled())

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

// ─── Camera permission denied ─────────────────────────────────────────────────

describe('BarcodeScanner — camera denied', () => {
  it('shows error when native path camera is denied', async () => {
    withNativeDetector()
    ;(navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'))

    render(<BarcodeScanner onDrug={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /scan medication barcode/i }))

    await waitFor(() =>
      expect(screen.getByText(/camera access denied/i)).toBeInTheDocument()
    )
  })

  it('shows error when zxing path camera is denied', async () => {
    withoutNativeDetector()
    mockDecodeFromConstraints.mockRejectedValue(
      new DOMException('Permission denied', 'NotAllowedError')
    )

    render(<BarcodeScanner onDrug={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /scan medication barcode/i }))

    await waitFor(() =>
      expect(screen.getByText(/camera access denied/i)).toBeInTheDocument()
    )
  })
})
