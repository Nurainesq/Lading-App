import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'

/**
 * Document storage.
 *
 * Trade documents are evidence: a bill of lading is what releases the money,
 * so bytes are content-addressed by SHA-256 and never overwritten in place.
 * Postgres holds the metadata and the digest; the bytes live here.
 */

export interface StoredObject {
  key: string
  sizeBytes: number
  sha256: string
  mimeType: string
}

export interface Storage {
  readonly kind: 'disk' | 's3'
  put(input: {
    /** Namespacing prefix, e.g. `deals/<id>`. */
    prefix: string
    filename: string
    mimeType: string
    body: Buffer
  }): Promise<StoredObject>
  get(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
}

/** What a trader may present. Anything else is refused before it is stored. */
export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
])

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024

export class UnsupportedDocumentError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'UnsupportedDocumentError'
    this.code = code
  }
}

/** Strips anything that could escape the prefix or confuse a filesystem. */
export function safeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? 'document'
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '')
  return cleaned.slice(0, 120) || 'document'
}

export function digestOf(body: Buffer): string {
  return createHash('sha256').update(body).digest('hex')
}

/**
 * Validates a candidate document. Both the declared type and the leading
 * bytes have to agree — a PDF header on something labelled an image, or the
 * reverse, is refused rather than stored and puzzled over later.
 */
export function assertStorable(mimeType: string, body: Buffer): void {
  if (body.byteLength === 0) {
    throw new UnsupportedDocumentError('EMPTY_FILE', 'That file is empty')
  }
  if (body.byteLength > MAX_DOCUMENT_BYTES) {
    throw new UnsupportedDocumentError(
      'FILE_TOO_LARGE',
      `Documents must be under ${MAX_DOCUMENT_BYTES / (1024 * 1024)} MB`,
    )
  }
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new UnsupportedDocumentError(
      'UNSUPPORTED_TYPE',
      'Present a PDF or a photo of the document',
    )
  }

  const looksPdf = body.subarray(0, 5).toString('latin1') === '%PDF-'
  if (mimeType === 'application/pdf' && !looksPdf) {
    throw new UnsupportedDocumentError('NOT_A_PDF', 'That file is not a PDF')
  }
  if (mimeType !== 'application/pdf' && looksPdf) {
    throw new UnsupportedDocumentError(
      'TYPE_MISMATCH',
      'That file is a PDF but was sent as an image',
    )
  }
}

/** Local disk. Used in development and tests. */
export class DiskStorage implements Storage {
  readonly kind = 'disk' as const
  readonly #root: string

  constructor(root: string) {
    this.#root = resolve(root)
  }

  #resolve(key: string): string {
    const full = resolve(join(this.#root, key))
    // Refuse anything that resolves outside the root, whatever the key says.
    if (full !== this.#root && !full.startsWith(this.#root + sep)) {
      throw new UnsupportedDocumentError('BAD_KEY', 'Invalid storage key')
    }
    return full
  }

  async put({
    prefix,
    filename,
    mimeType,
    body,
  }: {
    prefix: string
    filename: string
    mimeType: string
    body: Buffer
  }): Promise<StoredObject> {
    assertStorable(mimeType, body)
    const sha256 = digestOf(body)
    const key = `${prefix}/${randomUUID()}-${safeFilename(filename)}`
    const path = this.#resolve(key)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, body)
    return { key, sizeBytes: body.byteLength, sha256, mimeType }
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.#resolve(key))
  }

  async delete(key: string): Promise<void> {
    await unlink(this.#resolve(key)).catch(() => undefined)
  }
}
