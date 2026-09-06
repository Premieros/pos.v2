type StatePanelProps = {
  kind?: 'loading' | 'error' | 'empty' | 'unauthorized' | 'info'
  title: string
  description?: string
  compact?: boolean
}

export function StatePanel({ kind = 'info', title, description, compact = false }: StatePanelProps) {
  const icon = kind === 'loading' ? '◌' : kind === 'error' ? '!' : kind === 'empty' ? '◇' : kind === 'unauthorized' ? '⊘' : 'i'
  return (
    <section className={`state-panel state-panel-${kind}${compact ? ' state-panel-compact' : ''}`} role={kind === 'error' ? 'alert' : 'status'} aria-live={kind === 'loading' ? 'polite' : 'off'}>
      <span className="state-panel-icon" aria-hidden="true">{icon}</span>
      <div><strong>{title}</strong>{description ? <p>{description}</p> : null}</div>
    </section>
  )
}
