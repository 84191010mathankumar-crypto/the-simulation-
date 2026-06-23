import React, { useState } from 'react'

const STATUS_HINT = {
  loading: 'loading saved layout from public/site-config.json…',
  loaded: 'loaded from public/site-config.json — paste new JSON in there to update what auto-loads',
  empty: 'public/site-config.json is empty — paste the JSON below into that file so it auto-loads next time',
  error: "couldn't read public/site-config.json — paste the JSON below into that file so it auto-loads next time",
}

export default function JsonBar({ config, loadStatus, onReload }) {
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
        <span className="json-bar-hint">{STATUS_HINT[loadStatus] || STATUS_HINT.empty}</span>
        <button className="btn-secondary" onClick={onReload}>Reload from file</button>
        <button className="btn-secondary" onClick={handleCopy}>{copied ? 'Copied!' : 'Copy JSON'}</button>
      </div>
      <textarea className="json-bar-text" readOnly value={json} spellCheck={false} />
    </div>
  )
}
