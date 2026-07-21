// Client-side draft store for in-progress reviews.
//
// Drafts live ONLY in the browser (localStorage) and are never sent to the
// server until the reviewer finalizes with "Nộp", which anonymizes them into
// `responses`. That is what lets a reviewer leave and come back to edit before
// submitting WITHOUT ever creating a reviewer→content link in the database —
// the structural anonymity guarantee stays intact (see CLAUDE.md). Because the
// draft is device-local, it does not follow the user to another browser.

export type DraftAnswers = Record<string, string | number | string[]>

function key(roundId: string, targetId: string) {
  return `candor:draft:${roundId}:${targetId}`
}

// Keep only answers that actually carry a value, so an all-blank form doesn't
// count as a draft. Shared by save (what to persist) and submit (what to send).
export function pruneAnswers(answers: DraftAnswers): DraftAnswers {
  return Object.fromEntries(
    Object.entries(answers).filter(
      ([, v]) => v !== '' && v !== undefined && !(Array.isArray(v) && v.length === 0)
    )
  )
}

export function loadDraft(roundId: string, targetId: string): DraftAnswers | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key(roundId, targetId))
    return raw ? (JSON.parse(raw) as DraftAnswers) : null
  } catch {
    return null
  }
}

export function saveDraft(roundId: string, targetId: string, answers: DraftAnswers) {
  if (typeof window === 'undefined') return
  try {
    const pruned = pruneAnswers(answers)
    // An empty draft is the same as no draft — don't leave a stray key behind.
    if (Object.keys(pruned).length === 0) {
      window.localStorage.removeItem(key(roundId, targetId))
    } else {
      window.localStorage.setItem(key(roundId, targetId), JSON.stringify(pruned))
    }
  } catch {
    // localStorage can throw (private mode / quota) — drafts are best-effort.
  }
}

export function clearDraft(roundId: string, targetId: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key(roundId, targetId))
  } catch {
    // ignore
  }
}

export function hasDraft(roundId: string, targetId: string): boolean {
  const draft = loadDraft(roundId, targetId)
  return draft !== null && Object.keys(draft).length > 0
}
