import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import BarcodeScanner from './BarcodeScanner'

interface DrugSearchProps {
  onCheck: (drugs: string[]) => void
  loading: boolean
}

interface DrugEntry {
  id: number
  value: string
}

let nextId = 1

export default function DrugSearch({ onCheck, loading }: DrugSearchProps) {
  const { t } = useTranslation()
  const idRef = useRef(nextId)
  const [drugs, setDrugs] = useState<DrugEntry[]>([
    { id: idRef.current++, value: '' },
    { id: idRef.current++, value: '' },
  ])

  const updateDrug = (id: number, value: string) => {
    setDrugs(prev => prev.map(d => d.id === id ? { ...d, value } : d))
  }

  const addDrug = () => {
    if (drugs.length < 5) setDrugs(prev => [...prev, { id: idRef.current++, value: '' }])
  }

  const removeDrug = (id: number) => {
    if (drugs.length <= 2) return
    setDrugs(prev => prev.filter(d => d.id !== id))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const filled = drugs.map(d => d.value.trim()).filter(Boolean)
    if (filled.length < 2) return
    onCheck(filled)
  }

  const getPlaceholder = (i: number) => {
    if (i === 0) return t('search.placeholder_1')
    if (i === 1) return t('search.placeholder_2')
    return t('search.placeholder_n', { n: i + 1 })
  }

  const filled = drugs.filter(d => d.value.trim()).length
  const canSubmit = filled >= 2 && !loading

  return (
    <form onSubmit={handleSubmit} className="drug-search">
      <p className="drug-search-hint">{t('search.hint')}</p>

      <div className="drug-inputs">
        {drugs.map((drug, i) => (
          <div key={drug.id} className="drug-input-row">
            <input
              type="text"
              value={drug.value}
              onChange={e => updateDrug(drug.id, e.target.value)}
              placeholder={getPlaceholder(i)}
              aria-label={getPlaceholder(i)}
              className="drug-input"
              disabled={loading}
            />
            {/* Barcode scan fills this input — no typing required */}
            <BarcodeScanner
              onDrug={name => updateDrug(drug.id, name)}
              disabled={loading}
            />
            {drugs.length > 2 && (
              <button
                type="button"
                onClick={() => removeDrug(drug.id)}
                className="remove-btn"
                disabled={loading}
                aria-label={`Remove drug ${i + 1}`}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="drug-search-actions">
        {drugs.length < 5 && (
          <button
            type="button"
            onClick={addDrug}
            className="add-btn"
            disabled={loading}
          >
            {t('search.add_drug')}
          </button>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="check-btn"
        >
          {loading ? t('search.checking') : t('search.check_btn')}
        </button>
      </div>
    </form>
  )
}
