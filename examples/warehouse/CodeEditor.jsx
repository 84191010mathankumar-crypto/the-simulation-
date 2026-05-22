import React, { useCallback, useRef } from 'react'

/* Minimal tokenizer for the warehouse build-plan DSL.
 *
 *   # comments
 *   numbers      (3, 1.5, -0.18, …)
 *   names        (identifier at column 0 — start of a block)
 *   keys         (identifier followed by `:`)
 *   ,            (tuple separator)
 *
 * Anything else renders in the default text colour. */
function escape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function highlightLine(line) {
  // Comment runs to end-of-line.
  const hashAt = line.indexOf('#')
  let head = line, comment = ''
  if (hashAt >= 0) {
    head    = line.slice(0, hashAt)
    comment = `<span class="t-cmt">${escape(line.slice(hashAt))}</span>`
  }

  // Block-name line: starts in column 0 with an identifier and no ':'.
  if (/^[A-Za-z0-9_\-]+\s*$/.test(head)) {
    return `<span class="t-kw">${escape(head)}</span>${comment}`
  }

  // Field line: leading whitespace, then "key:" then value.
  const fieldMatch = head.match(/^(\s+)([A-Za-z][A-Za-z\-]*)(\s*:\s*)(.*)$/)
  if (fieldMatch) {
    const [, ws, key, sep, val] = fieldMatch
    return escape(ws)
         + `<span class="t-builtin">${escape(key)}</span>`
         + `<span class="t-pn">${escape(sep)}</span>`
         + highlightValue(val)
         + comment
  }

  // Anything else — just numbers/commas in the value.
  return highlightValue(head) + comment
}

function highlightValue(text) {
  let out = ''
  // Match numbers and commas; leave the rest as text.
  const re = /(-?\d+\.?\d*|-?\.\d+)|(,)/g
  let last = 0, m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out += escape(text.slice(last, m.index))
    if      (m[1]) out += `<span class="t-num">${escape(m[1])}</span>`
    else if (m[2]) out += `<span class="t-pn">${escape(m[2])}</span>`
    last = m.index + m[0].length
  }
  if (last < text.length) out += escape(text.slice(last))
  return out
}

function highlight(code) {
  return code.split('\n').map(highlightLine).join('\n') + '\n'
}

export default function CodeEditor({ value, onChange, error, disabled }) {
  const preRef = useRef(null)
  const taRef  = useRef(null)

  const onScroll = useCallback(() => {
    const pre = preRef.current, ta = taRef.current
    if (!pre || !ta) return
    pre.scrollTop  = ta.scrollTop
    pre.scrollLeft = ta.scrollLeft
  }, [])

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart, end = ta.selectionEnd
      const v = ta.value
      const next = v.slice(0, start) + '  ' + v.slice(end)
      onChange(next)
      // Restore caret after React re-renders.
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      })
    }
  }, [onChange])

  return (
    <div className={`code-editor ${error ? 'has-error' : ''}`}>
      <pre
        ref={preRef}
        className="code-hl"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: highlight(value) }}
      />
      <textarea
        ref={taRef}
        className="code-input"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        wrap="off"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
      />
      <div className={`code-status ${error ? 'err' : 'ok'}`}>
        {error
          ? <><span className="dot">●</span><span className="msg">{error}</span></>
          : <><span className="dot">●</span><span className="msg">live · scene synced</span></>}
      </div>
    </div>
  )
}
