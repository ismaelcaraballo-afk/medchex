import { useState } from 'react'

interface DrugSearchProps {
  onCheck: (drugs: string[]) => void
  loading: boolean
}

export default function DrugSearch({ onCheck, loading }: DrugSearchProps) {
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

  const filled = drugs.filter(d => d.trim()).length
  const canSubmit = filled >= 2 && !loading

  return (
    <form onSubmit={handleSubmit} className="drug-search">
      <p className="drug-search-hint">Enter 2–5 medications to check for interactions</p>

      <div className="drug-inputs">
        {drugs.map((drug, i) => (
          <div key={i} className="drug-input-row">
            <input
              type="text"
              value={drug}
              onChange={e => updateDrug(i, e.target.value)}
              placeholder={`Drug ${i + 1} (e.g. ${i === 0 ? 'Warfarin' : i === 1 ? 'Ibuprofen' : 'Aspirin'})`}
              className="drug-input"
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
            + Add Drug
          </button>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="check-btn"
        >
          {loading ? 'Checking...' : 'Check Interactions'}
        </button>
      </div>
    </form>
  )
}
