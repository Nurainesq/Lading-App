import { useId, useRef, useState } from 'react'
import { ALLOWED_UPLOAD_TYPES } from '@/api/upload'

/**
 * A document slot that actually takes a file.
 *
 * Keeps the dashed "not here yet" treatment from the design and swaps it for
 * the supplied treatment once the bytes are stored — the affordance is the
 * same, it just does something now.
 */
export function UploadRow({
  name,
  hint,
  onFile,
  busy,
}: {
  name: string
  hint: string
  onFile: (file: File) => void | Promise<void>
  busy?: boolean
}) {
  const inputId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const take = (files: FileList | null) => {
    const file = files?.[0]
    if (file) void onFile(file)
  }

  return (
    <div
      className="doc"
      data-state="empty"
      data-pad="roomy"
      style={dragging ? { borderColor: 'var(--oxide)' } : undefined}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        take(e.dataTransfer.files)
      }}
    >
      <span className="doc__text">
        <label className="doc__name" htmlFor={inputId} style={{ cursor: 'pointer' }}>
          {name}
        </label>
        <span className="doc__meta">{busy ? 'UPLOADING…' : hint}</span>
      </span>

      <input
        id={inputId}
        ref={input}
        type="file"
        accept={ALLOWED_UPLOAD_TYPES.join(',')}
        onChange={(e) => {
          take(e.target.files)
          // Reset so choosing the same file twice still fires a change.
          e.target.value = ''
        }}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      <button
        type="button"
        className="doc__action"
        onClick={() => input.current?.click()}
        disabled={busy}
        style={{ minHeight: 'var(--tap)' }}
      >
        {busy ? '…' : 'ADD'}
      </button>
    </div>
  )
}
