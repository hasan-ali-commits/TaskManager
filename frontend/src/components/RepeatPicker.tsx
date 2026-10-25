import React from 'react'

// Friendly dropdowns that read and write an RRULE string such as
// "FREQ=WEEKLY;BYDAY=MO,WE;COUNT=12", so nobody has to type the code by hand.

type Mode = 'DAILY' | 'WEEKDAYS' | 'WEEKLY' | 'DAYS' | 'MONTHLY' | 'CUSTOM'

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
const COUNT_CHOICES = [3, 5, 7, 10, 12, 14, 21, 30, 60, 90, 180, 365]

export const DEFAULT_RULE = 'FREQ=DAILY'

function parseRule(rule: string): { mode: Mode; days: string[]; count: number | null } {
  const parts: Record<string, string> = {}
  rule.split(';').filter(Boolean).forEach(p => {
    const [k, v] = p.split('=')
    parts[(k || '').trim().toUpperCase()] = (v || '').trim().toUpperCase()
  })
  const count = parts.COUNT ? parseInt(parts.COUNT, 10) || null : null
  const days = parts.BYDAY ? parts.BYDAY.split(',') : []
  const known = Object.keys(parts).every(k => ['FREQ', 'BYDAY', 'COUNT'].includes(k))
  const daysValid = days.every(d => WEEKDAYS.some(w => w.code === d))

  let mode: Mode = 'CUSTOM'
  if (known && daysValid) {
    if (parts.FREQ === 'DAILY' && !days.length) mode = 'DAILY'
    else if (parts.FREQ === 'WEEKLY' && days.join(',') === MON_TO_FRI) mode = 'WEEKDAYS'
    else if (parts.FREQ === 'WEEKLY' && !days.length) mode = 'WEEKLY'
    else if (parts.FREQ === 'WEEKLY') mode = 'DAYS'
    else if (parts.FREQ === 'MONTHLY' && !days.length) mode = 'MONTHLY'
  }
  return { mode, days, count }
}

function buildRule(mode: Mode, days: string[], count: number | null) {
  let rule = ''
  if (mode === 'DAILY') rule = 'FREQ=DAILY'
  else if (mode === 'WEEKDAYS') rule = `FREQ=WEEKLY;BYDAY=${MON_TO_FRI}`
  else if (mode === 'WEEKLY') rule = 'FREQ=WEEKLY'
  else if (mode === 'DAYS') rule = `FREQ=WEEKLY;BYDAY=${days.join(',')}`
  else if (mode === 'MONTHLY') rule = 'FREQ=MONTHLY'
  return count ? `${rule};COUNT=${count}` : rule
}

function startDay(startDate?: string) {
  // startDate is YYYY-MM-DD; returns e.g. { code: 'MO', dayOfMonth: 26 }
  const d = startDate ? new Date(`${startDate}T00:00:00`) : new Date()
  const valid = !isNaN(d.getTime()) ? d : new Date()
  return { weekday: WEEKDAYS[(valid.getDay() + 6) % 7], dayOfMonth: valid.getDate() }
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export default function RepeatPicker({ value, onChange, startDate }: { value: string; onChange: (rule: string) => void; startDate?: string }) {
  const { mode, days, count } = parseRule(value || DEFAULT_RULE)
  const start = startDay(startDate)

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
    onChange(buildRule(mode, days, raw ? parseInt(raw, 10) : null))
  }

  const countChoices = count && !COUNT_CHOICES.includes(count) ? [...COUNT_CHOICES, count].sort((a, b) => a - b) : COUNT_CHOICES
  const names = days.map(d => WEEKDAYS.find(w => w.code === d)?.long).filter(Boolean)
  const dayNames = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names.join('')
  const summary =
    mode === 'DAILY' ? 'every day' :
    mode === 'WEEKDAYS' ? 'every weekday (Monday to Friday)' :
    mode === 'WEEKLY' ? `every week on ${start.weekday.long}` :
    mode === 'DAYS' ? `every ${dayNames}` :
    mode === 'MONTHLY' ? `every month on the ${ordinal(start.dayOfMonth)}` :
    'using a custom rule'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Repeats
          <select className="priority-select" value={mode} onChange={e => setMode(e.target.value as Mode)}>
            <option value="DAILY">Every day</option>
            <option value="WEEKDAYS">Every weekday (Mon–Fri)</option>
            <option value="WEEKLY">Every week on {start.weekday.long}</option>
            <option value="DAYS">On specific days…</option>
            <option value="MONTHLY">Every month on the {ordinal(start.dayOfMonth)}</option>
            {mode === 'CUSTOM' && <option value="CUSTOM">Custom (keep current rule)</option>}
          </select>
        </label>
        <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          How many times
          <select className="priority-select" value={count ?? ''} onChange={e => setCount(e.target.value)} disabled={mode === 'CUSTOM'}>
            <option value="">Forever</option>
            {countChoices.map(n => <option key={n} value={n}>{n} times</option>)}
          </select>
        </label>
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
