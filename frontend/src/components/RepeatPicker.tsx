import React, { useState } from 'react'

// Friendly dropdowns that read and write an RRULE string such as
// "FREQ=WEEKLY;BYDAY=MO,WE;COUNT=12", so nobody has to type the code by hand.

type Mode = 'DAILY' | 'WEEKDAYS' | 'WEEKENDS' | 'DAYS' | 'ALTERNATE' | 'CUSTOM'

const WEEKDAYS = [
  { code: 'MO', short: 'Mon', long: 'Monday' },
  { code: 'TU', short: 'Tue', long: 'Tuesday' },
  { code: 'WE', short: 'Wed', long: 'Wednesday' },
  { code: 'TH', short: 'Thu', long: 'Thursday' },
  { code: 'FR', short: 'Fri', long: 'Friday' },
  { code: 'SA', short: 'Sat', long: 'Saturday' },
  { code: 'SU', short: 'Sun', long: 'Sunday' },
]
const MON_TO_FRI = 'MO,TU,WE,TH,FR'
const SAT_SUN = 'SA,SU'
const COUNT_CHOICES = [3, 5, 7, 10, 12, 14, 21, 30, 60, 90, 180, 365]
const MAX_COUNT = 999

export const DEFAULT_RULE = 'FREQ=DAILY'

function parseRule(rule: string): { mode: Mode; days: string[]; count: number | null } {
  const parts: Record<string, string> = {}
  rule.split(';').filter(Boolean).forEach(p => {
    const [k, v] = p.split('=')
    parts[(k || '').trim().toUpperCase()] = (v || '').trim().toUpperCase()
  })
  const count = parts.COUNT ? parseInt(parts.COUNT, 10) || null : null
  const days = parts.BYDAY ? parts.BYDAY.split(',') : []
  const known = Object.keys(parts).every(k => ['FREQ', 'BYDAY', 'COUNT', 'INTERVAL'].includes(k))
  const daysValid = days.every(d => WEEKDAYS.some(w => w.code === d))
  const interval = parts.INTERVAL ? parseInt(parts.INTERVAL, 10) : 1

  let mode: Mode = 'CUSTOM'
  if (known && daysValid) {
    if (parts.FREQ === 'DAILY' && !days.length && interval === 1) mode = 'DAILY'
    else if (parts.FREQ === 'DAILY' && !days.length && interval === 2) mode = 'ALTERNATE'
    else if (interval !== 1) mode = 'CUSTOM'
    else if (parts.FREQ === 'WEEKLY' && days.join(',') === MON_TO_FRI) mode = 'WEEKDAYS'
    else if (parts.FREQ === 'WEEKLY' && days.join(',') === SAT_SUN) mode = 'WEEKENDS'
    else if (parts.FREQ === 'WEEKLY' && days.length) mode = 'DAYS'
  }
  return { mode, days, count }
}

function buildRule(mode: Mode, days: string[], count: number | null) {
  let rule = ''
  if (mode === 'DAILY') rule = 'FREQ=DAILY'
  else if (mode === 'WEEKDAYS') rule = `FREQ=WEEKLY;BYDAY=${MON_TO_FRI}`
  else if (mode === 'WEEKENDS') rule = `FREQ=WEEKLY;BYDAY=${SAT_SUN}`
  else if (mode === 'DAYS') rule = `FREQ=WEEKLY;BYDAY=${days.join(',')}`
  else if (mode === 'ALTERNATE') rule = 'FREQ=DAILY;INTERVAL=2'
  return count ? `${rule};COUNT=${count}` : rule
}

function startDay(startDate?: string) {
  // startDate is YYYY-MM-DD; returns e.g. { weekday: { code: 'MO', ... } }
  const d = startDate ? new Date(`${startDate}T00:00:00`) : new Date()
  const valid = !isNaN(d.getTime()) ? d : new Date()
  return { weekday: WEEKDAYS[(valid.getDay() + 6) % 7] }
}

export default function RepeatPicker({ value, onChange, startDate }: { value: string; onChange: (rule: string) => void; startDate?: string }) {
  const { mode, days, count } = parseRule(value || DEFAULT_RULE)
  const start = startDay(startDate)
  // "Custom number…" picked: show a box to type any count (e.g. 35)
  const [typingCount, setTypingCount] = useState(false)
  const customCount = typingCount || (count !== null && !COUNT_CHOICES.includes(count))

  function setMode(next: Mode) {
    // "specific days" starts with the weekday of the task's start date ticked
    const nextDays = next === 'DAYS' ? (days.length ? days : [start.weekday.code]) : []
    onChange(buildRule(next, nextDays, count))
  }

  function toggleDay(code: string) {
    const next = days.includes(code) ? days.filter(d => d !== code) : [...days, code]
    if (next.length === 0) return // keep at least one day ticked
    const ordered = WEEKDAYS.map(w => w.code).filter(c => next.includes(c))
    onChange(buildRule('DAYS', ordered, count))
  }

  function setCount(raw: string) {
    if (mode === 'CUSTOM') return
    const n = parseInt(raw, 10)
    onChange(buildRule(mode, days, n > 0 ? Math.min(n, MAX_COUNT) : null))
  }

  function pickCount(raw: string) {
    if (raw === 'TYPE') { setTypingCount(true); return }
    setTypingCount(false)
    setCount(raw)
  }
  const names = days.map(d => WEEKDAYS.find(w => w.code === d)?.long).filter(Boolean)
  const dayNames = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names.join('')
  const summary =
    mode === 'DAILY' ? 'every day' :
    mode === 'WEEKDAYS' ? 'every weekday (Monday to Friday)' :
    mode === 'WEEKENDS' ? 'every weekend (Saturday and Sunday)' :
    mode === 'DAYS' ? `every ${dayNames}` :
    mode === 'ALTERNATE' ? 'every other day' :
    'using a custom rule'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Repeats
          <select className="priority-select" value={mode} onChange={e => setMode(e.target.value as Mode)}>
            <option value="DAILY">Every day</option>
            <option value="WEEKDAYS">Every weekday (Mon–Fri)</option>
            <option value="WEEKENDS">Weekends (Sat–Sun)</option>
            <option value="DAYS">On specific days…</option>
            <option value="ALTERNATE">Alternate days (every other day)</option>
            {mode === 'CUSTOM' && <option value="CUSTOM">Custom (keep current rule)</option>}
          </select>
        </label>
        <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          How many times
          <select className="priority-select" value={customCount ? 'TYPE' : (count ?? '')} onChange={e => pickCount(e.target.value)} disabled={mode === 'CUSTOM'}>
            <option value="">Forever</option>
            {COUNT_CHOICES.map(n => <option key={n} value={n}>{n} times</option>)}
            <option value="TYPE">Custom number…</option>
          </select>
        </label>
        {customCount && mode !== 'CUSTOM' && (
          <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              className="login-input"
              type="number"
              min={1}
              max={MAX_COUNT}
              placeholder="e.g. 35"
              aria-label="Number of times"
              style={{ width: 80, margin: 0 }}
              value={count ?? ''}
              onChange={e => setCount(e.target.value)}
              autoFocus
            />
            times
          </label>
        )}
      </div>

      {mode === 'DAYS' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Repeat on these days">
          {WEEKDAYS.map(w => (
            <button
              key={w.code}
              type="button"
              className={`btn ${days.includes(w.code) ? 'active' : ''}`}
              style={{ padding: '4px 10px' }}
              aria-pressed={days.includes(w.code)}
              onClick={() => toggleDay(w.code)}
            >
              {w.short}
            </button>
          ))}
        </div>
      )}

      <div className="small">
        🔁 Repeats {summary}{count ? `, ${count} times in total` : ', with no end date'}, starting from the date above.
      </div>
    </div>
  )
}
