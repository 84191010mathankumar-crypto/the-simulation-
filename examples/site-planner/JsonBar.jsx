import React, { useState } from 'react'

export default function JsonBar({ config }) {
  const [copied, setCopied] = useState(false)
  const json = JSON.stringify(config, null, 2)

  function handleCopy() {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="json-bar">
      <div className="json-bar-head">
        <span className="json-bar-title">Config JSON</span>
        <span className="json-bar-hint">copy this into your config file to load the layout later</span>
        <button className="btn-secondary" onClick={handleCopy}>{copied ? 'Copied!' : 'Copy JSON'}</button>
      </div>
      <textarea className="json-bar-text" readOnly value={json} spellCheck={false} />
    </div>
  )
}
