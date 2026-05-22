import React from 'react'

/**
 * Page navigation — two tabs that link to the two example pages.
 * Used by both the main demo's ControlPanel and the warehouse Panel.
 *
 * Active page is detected from `window.location.pathname` so the same
 * component drops into both entry points unchanged.
 */
export default function Nav() {
  const base = import.meta.env.BASE_URL || '/'
  const path = typeof window !== 'undefined' ? window.location.pathname : '/'
  const current = path.includes('/examples/warehouse') ? 'warehouse' : 'arm'

  return (
    <nav className="page-nav" aria-label="Demos">
      <a
        href={base}
        className={`pn-tab ${current === 'arm' ? 'active' : ''}`}
        aria-current={current === 'arm' ? 'page' : undefined}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square">
          <circle cx="6" cy="18" r="2" />
          <path d="M6 16 L6 12 L14 6" />
          <path d="M14 6 L18 9" />
          <rect x="16" y="9" width="4" height="3" />
        </svg>
        <span>Single arm</span>
      </a>
      <a
        href={`${base}examples/warehouse/`}
        className={`pn-tab ${current === 'warehouse' ? 'active' : ''}`}
        aria-current={current === 'warehouse' ? 'page' : undefined}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square">
          <rect x="3"  y="13" width="6" height="6" />
          <rect x="9"  y="13" width="6" height="6" />
          <rect x="15" y="13" width="6" height="6" />
          <rect x="6"  y="7"  width="6" height="6" />
          <rect x="12" y="7"  width="6" height="6" />
          <rect x="9"  y="1"  width="6" height="6" />
        </svg>
        <span>Warehouse</span>
      </a>
    </nav>
  )
}
