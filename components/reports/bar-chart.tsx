export type BarRow = { label: string; value: number; max: number; caption?: string }

// Hand-drawn horizontal bars — no chart library. `value/max` sets the fill
// width; `caption` is the right-aligned figure (e.g. "3 (60%)").
export function BarChart({ rows }: { rows: BarRow[] }) {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => {
        const pct = row.max > 0 ? Math.round((row.value / row.max) * 100) : 0
        return (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="tabular-nums text-muted-foreground">{row.caption ?? row.value}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
