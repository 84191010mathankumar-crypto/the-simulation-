import React, { useCallback, useRef } from 'react'

/* Minimal regex-based JS tokenizer.  Order in the alternation matters:
 * comments and strings are matched first so their innards don't get
 * re-tokenized as keywords. */
const TOKEN_RE = new RegExp([
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/.source,                                      // 1: comment
  /('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)/.source,         // 2: string
  /\b(const|let|var|return|function|if|else|for|while|do|new|in|of|true|false|null|undefined|this|typeof|break|continue|switch|case|default)\b/.source, // 3: keyword
  /\b(Math|Array|Object|JSON|console)\b/.source,                                // 4: builtin
  /\b(\d+\.?\d*|\.\d+)\b/.source,                                               // 5: number
  /([+\-*/%=<>!&|?:^~]+)/.source,                                               // 6: operator
  /([{}()\[\];,.])/.source,                                                     // 7: punct
].join('|'), 'g')

function escape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function highlight(code) {
  let out = '', last = 0, m
  TOKEN_RE.lastIndex = 0
  while ((m = TOKEN_RE.exec(code)) !== null) {
    if (m.index > last) out += escape(code.slice(last, m.index))
    if      (m[1]) out += `<span class="t-cmt">${escape(m[1])}</span>`
    else if (m[2]) out += `<span class="t-str">${escape(m[2])}</span>`
    else if (m[3]) out += `<span class="t-kw">${escape(m[3])}</span>`
    else if (m[4]) out += `<span class="t-builtin">${escape(m[4])}</span>`
    else if (m[5]) out += `<span class="t-num">${escape(m[5])}</span>`
    else if (m[6]) out += `<span class="t-op">${escape(m[6])}</span>`
    else if (m[7]) out += `<span class="t-pn">${escape(m[7])}</span>`
    last = m.index + m[0].length
  }
  if (last < code.length) out += escape(code.slice(last))
  // Trailing newline guarantees the <pre> matches textarea height when the
  // user's last line ends with \n.
  return out + '\n'
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
