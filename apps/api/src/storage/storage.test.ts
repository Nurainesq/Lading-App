import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DiskStorage,
  MAX_DOCUMENT_BYTES,
  UnsupportedDocumentError,
  assertStorable,
  digestOf,
  safeFilename,
} from './storage.ts'

const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64, 0x20)])
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 1),
])

test('stores a PDF and reports its digest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lading-storage-'))
  const storage = new DiskStorage(root)

  const stored = await storage.put({
    prefix: 'deals/abc',
    filename: 'MSCU-2249173.pdf',
    mimeType: 'application/pdf',
    body: PDF,
  })

  assert.equal(stored.sizeBytes, PDF.byteLength)
  assert.equal(stored.sha256, digestOf(PDF))
  assert.match(stored.key, /^deals\/abc\/[0-9a-f-]{36}-MSCU-2249173\.pdf$/)

  // The bytes on disk are the bytes that came in.
  assert.deepEqual(await readFile(join(root, stored.key)), PDF)
  assert.deepEqual(await storage.get(stored.key), PDF)
})

test('the same document twice yields the same digest', async () => {
  // Which is what lets a re-upload be recognised rather than duplicated.
  const root = await mkdtemp(join(tmpdir(), 'lading-storage-'))
  const storage = new DiskStorage(root)
  const a = await storage.put({ prefix: 'p', filename: 'a.pdf', mimeType: 'application/pdf', body: PDF })
  const b = await storage.put({ prefix: 'p', filename: 'b.pdf', mimeType: 'application/pdf', body: PDF })
  assert.equal(a.sha256, b.sha256)
  assert.notEqual(a.key, b.key, 'but each write gets its own key')
})

test('refuses types a trade document could not be', () => {
  assert.throws(() => assertStorable('application/zip', PDF), UnsupportedDocumentError)
  assert.throws(() => assertStorable('text/html', Buffer.from('<script>')), UnsupportedDocumentError)
})

test('refuses a file whose bytes contradict its declared type', () => {
  // An executable renamed .pdf, or a PDF smuggled in as an image.
  assert.throws(
    () => assertStorable('application/pdf', PNG),
    /not a PDF/,
  )
  assert.throws(
    () => assertStorable('image/png', PDF),
    /sent as an image/,
  )
})

test('refuses empty and oversized files', () => {
  assert.throws(() => assertStorable('application/pdf', Buffer.alloc(0)), /empty/)
  const huge = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(MAX_DOCUMENT_BYTES + 1)])
  assert.throws(() => assertStorable('application/pdf', huge), /under 20 MB/)
})

test('a key cannot climb out of the storage root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lading-storage-'))
  const storage = new DiskStorage(root)
  await assert.rejects(() => storage.get('../../etc/passwd'), UnsupportedDocumentError)
  await assert.rejects(() => storage.get('deals/../../../etc/passwd'), UnsupportedDocumentError)
})

test('filenames are stripped of path and shell-hostile characters', () => {
  assert.equal(safeFilename('../../etc/passwd'), 'passwd')
  assert.equal(safeFilename('C:\\Users\\x\\bill of lading.pdf'), 'bill_of_lading.pdf')
  assert.equal(safeFilename('...'), 'document')
  assert.equal(safeFilename(''), 'document')
  assert.ok(safeFilename('a'.repeat(500)).length <= 120)
})
