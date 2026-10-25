import React, { useState, useEffect } from 'react'
import { createTask, updateTask, deleteTask, updateTaskInstance, deleteTaskOccurrence } from '../api'
import ConfirmationDialog from './ConfirmationDialog'
import RepeatPicker, { DEFAULT_RULE } from './RepeatPicker'

function isoToLocalInput(iso?: string | null) {
  if (!iso) return ''
  // support plain YYYY-MM-DD and full ISO datetimes
  const ymdMatch = typeof iso === 'string' && iso.match(/^\d{4}-\d{2}-\d{2}$/)
  let d: Date
  if (ymdMatch) {
    const [y, m, day] = iso.split('-').map(n => parseInt(n, 10))
    d = new Date(y, m - 1, day)
  } else {
    d = new Date(iso)
  }
  const pad = (n:number) => String(n).padStart(2,'0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

function localYmdToIso(s?: string | null) {
  if (!s) return null
  const [y, m, d] = s.split('-').map((n:string)=>parseInt(n,10))
  return new Date(y, m - 1, d).toISOString()
}

// whole calendar days from one YYYY-MM-DD to another
function daysBetween(fromYmd: string, toYmd: string) {
  const [fy, fm, fd] = fromYmd.split('-').map(n => parseInt(n, 10))
  const [ty, tm, td] = toYmd.split('-').map(n => parseInt(n, 10))
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000)
}

export default function TaskModal({ open, onClose, onSaved, initialDate, task, occurrenceDate, initialDurationMinutes }: any) {
  const [title, setTitle] = useState(task?.title || '')
  const [date, setDate] = useState(task?.date ? isoToLocalInput(task.date) : (initialDate ? isoToLocalInput(initialDate) : ''))
  const [priority, setPriority] = useState(task?.priority || 'ROUTINE')
  const [isRecurring, setIsRecurring] = useState(task?.is_recurring || false)
  const [recurrenceRule, setRecurrenceRule] = useState(task?.recurrence_rule || '')
  const [durationMinutes, setDurationMinutes] = useState<number | null>(task?.duration_minutes ?? (initialDurationMinutes ?? null))
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmType, setConfirmType] = useState<'delete_day'|'delete_task'|null>(null)

  // true when the user clicked one day of a repeating task on the calendar
  const editingOneDay = Boolean(task?.id && task?.is_recurring && occurrenceDate)

  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      const effectiveDate = occurrenceDate ?? task.date
      setDate(effectiveDate ? isoToLocalInput(effectiveDate) : (initialDate ? isoToLocalInput(initialDate) : ''))
      setPriority(task.priority || 'ROUTINE')
      setIsRecurring(!!task.is_recurring)
      setRecurrenceRule(task.recurrence_rule || '')
      setDurationMinutes(task.duration_minutes ?? initialDurationMinutes ?? null)
    }
  }, [task, initialDate, occurrenceDate])

  useEffect(() => {
    if (!task) {
      if (occurrenceDate) setDate(isoToLocalInput(occurrenceDate))
      else if (initialDate) setDate(isoToLocalInput(initialDate))
      if (initialDurationMinutes) setDurationMinutes(initialDurationMinutes)
    }
  }, [initialDate, initialDurationMinutes, task, occurrenceDate])

  if (!open) return null

  function taskPayload(startIso: string | null) {
    const payload: any = {
      title,
      date: startIso,
      priority,
      is_recurring: isRecurring,
      recurrence_rule: isRecurring ? (recurrenceRule || DEFAULT_RULE) : null,
    }
    if (durationMinutes) payload.duration_minutes = durationMinutes
    return payload
  }

  async function runSave(action: () => Promise<any>) {
    setSaving(true)
    try {
      const res = await action()
      onSaved && onSaved(res)
      onClose()
    } catch (err) {
      alert('Save failed')
    } finally { setSaving(false) }
  }

  // New task, or a task opened without a specific day: save the task itself
  function save(e: React.FormEvent) {
    e.preventDefault()
    if (editingOneDay) return saveThisDay()
    const payload = taskPayload(localYmdToIso(date))
    return runSave(() => task && task.id ? updateTask(task.id, payload) : createTask(payload))
  }

  // Change only the clicked day (title, date, priority, duration); repeat settings are ignored
  function saveThisDay() {
    const override: any = { title, date: localYmdToIso(date), priority }
    if (durationMinutes) override.duration_minutes = durationMinutes
    return runSave(() => updateTaskInstance(task.id, occurrenceDate, { override_data: override }))
  }

  // Change the whole series. The date box shows the clicked day, so moving it by N days
  // moves the series start by N days; leaving it alone keeps the original start date.
  function saveAllDays() {
    const start = new Date(task.date)
    start.setDate(start.getDate() + daysBetween(isoToLocalInput(occurrenceDate), date))
    return runSave(() => updateTask(task.id, taskPayload(start.toISOString())))
  }

  function askToDelete(type: 'delete_day'|'delete_task') {
    setConfirmType(type)
    setConfirmOpen(true)
  }

  async function runConfirmedAction() {
    if (!task || !task.id || !confirmType) { setConfirmOpen(false); return }
    try {
      if (confirmType === 'delete_day') {
        await deleteTaskOccurrence(task.id, occurrenceDate)
      } else {
        await deleteTask(task.id)
      }
      onSaved && onSaved(null)
      onClose()
    } catch (err: any) {
      console.error(err)
      alert(err?.message || 'Delete failed')
    } finally {
      setConfirmOpen(false)
      setConfirmType(null)
    }
  }

  const dayLabel = editingOneDay
    ? new Date(occurrenceDate).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
    : ''
  const deleteAllLabel = task?.is_recurring ? 'Delete all days' : 'Delete task'

  return (
    <div style={{position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(2,6,23,0.6)'}}>
      <div style={{width:540, background:'#071027', padding:18, borderRadius:12}}>
        <h3 style={{marginTop:0}}>{task ? 'Edit Task' : 'New Task'}</h3>
        {editingOneDay ? <div style={{background:'rgba(255,255,255,0.03)', padding:6, borderRadius:6, marginBottom:8}}>📅 You opened <strong>{dayLabel}</strong> of a repeating task.</div> : null}
        <form onSubmit={save}>
          <div style={{display:'flex', gap:8, marginBottom:8}}>
            <input className="login-input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
            <input className="login-input" type="date" value={date} onChange={e=>setDate(e.target.value)} />
          </div>
          <div style={{display:'flex', gap:8, marginBottom:8}}>
            <select className={`priority-select prio-border prio-${priority}`} value={priority} onChange={e=>setPriority(e.target.value)}>
              <option value="CRITICAL">CRITICAL</option>
              <option value="IMPORTANT">IMPORTANT</option>
              <option value="ROUTINE">ROUTINE</option>
            </select>
            <input className="login-input" type="number" placeholder="Duration (min)" value={durationMinutes ?? ''} onChange={e=>setDurationMinutes(e.target.value ? parseInt(e.target.value) : null)} />
          </div>
          <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:8, flexWrap:'wrap'}}>
            <label className="small"><input type="checkbox" checked={isRecurring} onChange={e=>{ setIsRecurring(e.target.checked); if (e.target.checked && !recurrenceRule) setRecurrenceRule(DEFAULT_RULE) }} /> Recurring</label>
            {isRecurring && (
              <div style={{flex:'1 1 100%'}}>
                <RepeatPicker value={recurrenceRule} onChange={setRecurrenceRule} startDate={date} />
                {editingOneDay && (
                  <div className="small" style={{marginTop:4, color:'#fbbf24'}}>Repeat changes only apply when you click “Save all days”.</div>
                )}
              </div>
            )}
          </div>
          <div style={{display:'flex', gap:8, justifyContent:'flex-end', flexWrap:'wrap'}}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            {editingOneDay && (
              <button type="button" className="btn danger" onClick={() => askToDelete('delete_day')}>Delete this day</button>
            )}
            {task && task.id ? (
              <button type="button" className="btn danger" onClick={() => askToDelete('delete_task')}>{deleteAllLabel}</button>
            ) : null}
          </div>
          <div style={{display:'flex', gap:8, justifyContent:'flex-end', flexWrap:'wrap', marginTop:8}}>
            {editingOneDay ? (
              <>
                <button type="button" className="btn primary" onClick={saveThisDay} disabled={saving}>
                  {saving ? 'Saving...' : 'Save this day only'}
                </button>
                <button type="button" className="btn" onClick={saveAllDays} disabled={saving}>
                  Save all days
                </button>
              </>
            ) : (
              <button className="btn primary" type="submit" disabled={saving}>
                <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                {saving? 'Saving...':'Save'}
              </button>
            )}
          </div>
        </form>
      </div>
      {confirmOpen && (
        <ConfirmationDialog
          open={confirmOpen}
          title={confirmType === 'delete_day' ? 'Delete this day' : deleteAllLabel}
          message={confirmType === 'delete_day'
            ? `Only ${dayLabel} will be removed. The other days stay. Continue?`
            : (task?.is_recurring ? 'This will permanently delete every day of this repeating task. Continue?' : 'This will permanently delete the task. Continue?')}
          onConfirm={runConfirmedAction}
          onCancel={() => setConfirmOpen(false)}
          confirmLabel={confirmType === 'delete_day' ? 'Delete this day' : deleteAllLabel}
        />
      )}
    </div>
  )
}
