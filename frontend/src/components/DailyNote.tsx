import React, { useEffect, useRef, useState } from 'react'
import { getNoteItems, createNoteItem, updateNoteItem, deleteNoteItem } from '../api'

type Kind = 'TODO' | 'SIDE_QUEST'
type NoteItem = { id: string; date: string; original_date: string; text: string; kind: Kind; done: boolean }

const SECTIONS: { kind: Kind; label: string; empty: string }[] = [
  { kind: 'TODO', label: '✅ To-do', empty: 'Nothing to do yet.' },
  { kind: 'SIDE_QUEST', label: '⚔️ Side quests', empty: 'No side quests yet.' },
]

function toYMD(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parseYMD(s: string) {
  const [y, m, d] = s.split('-').map(n => parseInt(n, 10))
  return new Date(y, m - 1, d)
}

function shortDate(s: string) {
  return parseYMD(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Pop-up checklist for one day. Unticked items from earlier days show up on
// today automatically (the backend moves them when the list is fetched).
export default function DailyNote({ date, onClose, onChanged }: { date: string; onClose: () => void; onChanged?: () => void }) {
  const [items, setItems] = useState<NoteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [kind, setKind] = useState<Kind>('TODO')
  const inputRef = useRef<HTMLInputElement>(null)

  async function load() {
    try {
      const data = await getNoteItems(date, date, toYMD(new Date()))
      setItems(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { setLoading(true); load() }, [date])

  // keep the latest onClose without re-running the effect below on every render
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    try {
      const created = await createNoteItem({ date, text: value, kind })
      setItems(prev => [...prev, created])
      setText('')
      onChanged && onChanged()
    } catch (err: any) {
      alert(err?.message || 'Adding note item failed')
    }
  }

  async function toggle(item: NoteItem) {
    // update the screen right away, then save
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, done: !i.done } : i))
    try {
      await updateNoteItem(item.id, { done: !item.done })
      onChanged && onChanged()
    } catch (err: any) {
      setItems(prev => prev.map(i => i.id === item.id ? item : i))
      alert(err?.message || 'Updating note item failed')
    }
  }

  async function remove(item: NoteItem) {
    try {
      await deleteNoteItem(item.id)
      setItems(prev => prev.filter(i => i.id !== item.id))
      onChanged && onChanged()
    } catch (err: any) {
      alert(err?.message || 'Deleting note item failed')
    }
  }

  const title = parseYMD(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
  const doneCount = items.filter(i => i.done).length

  return (
    <div className="note-overlay" onClick={onClose}>
      <div className="note-card" role="dialog" aria-modal="true" aria-label={`Daily note for ${title}`} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>📝 Daily note</h3>
            <div className="small">{title}{items.length > 0 && ` · ${doneCount}/${items.length} done`}</div>
          </div>
          <button className="btn" type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {loading ? (
          <div className="small">Loading…</div>
        ) : (
          SECTIONS.map(section => {
            const sectionItems = items.filter(i => i.kind === section.kind)
            return (
              <div key={section.kind} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{section.label}</div>
                {sectionItems.length === 0 ? (
                  <div className="small">{section.empty}</div>
                ) : (
                  sectionItems.map(item => (
                    <label key={item.id} className="note-item">
                      <input type="checkbox" checked={item.done} onChange={() => toggle(item)} />
                      <span style={{ flex: 1, textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.6 : 1 }}>{item.text}</span>
                      {item.original_date !== item.date && (
                        <span className="note-carried" title="Not ticked on its day, so it moved forward">↪ from {shortDate(item.original_date)}</span>
                      )}
                      <button className="note-delete" type="button" aria-label={`Delete ${item.text}`} onClick={e => { e.preventDefault(); remove(item) }}>✕</button>
                    </label>
                  ))
                )}
              </div>
            )
          })
        )}

        <form onSubmit={addItem} style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <select className="priority-select" style={{ minWidth: 0 }} value={kind} onChange={e => setKind(e.target.value as Kind)} aria-label="Item type">
            <option value="TODO">To-do</option>
            <option value="SIDE_QUEST">Side quest</option>
          </select>
          <input ref={inputRef} className="login-input" style={{ flex: 1, margin: 0 }} placeholder="Add something quick…" value={text} onChange={e => setText(e.target.value)} />
          <button className="btn primary" type="submit">Add</button>
        </form>
        <div className="small" style={{ marginTop: 10 }}>Anything not ticked moves on to the next day automatically.</div>
      </div>
    </div>
  )
}

export type NoteCounts = Record<string, { open: number; total: number }>

// The little 📝 button shown on each day; shows how many items are still open.
export function NoteButton({ date, counts, onOpen, label }: { date: string; counts?: NoteCounts; onOpen?: (date: string) => void; label?: string }) {
  const c = counts?.[date]
  const open = c?.open ?? 0
  const tip = c && c.total > 0 ? `Daily note: ${open} open of ${c.total}` : 'Daily note'
  return (
    <button
      type="button"
      className={`note-btn ${open > 0 ? 'has-open' : ''}`}
      title={tip}
      aria-label={tip}
      onClick={e => { e.stopPropagation(); onOpen && onOpen(date) }}
    >
      📝{label ? ` ${label}` : ''}{open > 0 ? ` ${open}` : ''}
    </button>
  )
}
