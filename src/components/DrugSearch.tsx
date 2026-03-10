import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import BarcodeScanner from './BarcodeScanner'

interface DrugSearchProps {
  onCheck: (drugs: string[]) => void
  loading: boolean
}

export default function DrugSearch({ onCheck, loading }: DrugSearchProps) {
  const { t } = useTranslation()
  const [drugs, setDrugs] = useState<string[]>(['', ''])

  const updateDrug = (index: number, value: string) => {
    const updated = [...drugs]
    updated[index] = value
    setDrugs(updated)
  }

  const addDrug = () => {
    if (drugs.length < 5) setDrugs([...drugs, ''])
  }

  const removeDrug = (index: number) => {
    if (drugs.length <= 2) return
    setDrugs(drugs.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const filled = drugs.map(d => d.trim()).filter(Boolean)
    if (filled.length < 2) return
    onCheck(filled)
  }

  const getPlaceholder = (i: number) => {
    if (i === 0) return t('search.placeholder_1')
    if (i === 1) return t('search.placeholder_2')
    return t('search.placeholder_n', { n: i + 1 })
  }

  const filled = drugs.filter(d => d.trim()).length
  const canSubmit = filled >= 2 && !loading

  return (
    <form onSubmit={handleSubmit} className="drug-search">
      <p className="drug-search-hint">{t('search.hint')}</p>

      <div className="drug-inputs">
        {drugs.map((drug, i) => (
          <div key={i} className="drug-input-row">
            <input
              type="text"
              value={drug}
              onChange={e => updateDrug(i, e.target.value)}
              placeholder={getPlaceholder(i)}
              className="drug-input"
              disabled={loading}
            />
            {/* Barcode scan fills this input — no typing required */}
            <BarcodeScanner
              onDrug={name => updateDrug(i, name)}
              disabled={loading}
            />
            {drugs.length > 2 && (
              <button
                type="button"
                onClick={() => removeDrug(i)}
                className="remove-btn"
                disabled={loading}
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
