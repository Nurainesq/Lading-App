import { randomUUID } from 'node:crypto'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import {
  assertStorable,
  digestOf,
  safeFilename,
  type Storage,
  type StoredObject,
} from './storage.ts'

/**
 * S3-compatible object storage for production.
 *
 * Works against AWS S3 or any compatible endpoint (R2, MinIO, Spaces) — the
 * bucket should have versioning on and public access blocked, since these are
 * the documents a release is decided against.
 */
export class S3Storage implements Storage {
  readonly kind = 's3' as const
  readonly #client: S3Client
  readonly #bucket: string

  constructor({
    bucket,
    region,
    endpoint,
    accessKeyId,
    secretAccessKey,
  }: {
    bucket: string
    region: string
    endpoint?: string
    accessKeyId?: string
    secretAccessKey?: string
  }) {
    this.#bucket = bucket
    this.#client = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      // Fall back to the ambient credential chain (instance role, env) when
      // explicit keys are not configured.
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    })
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

    await this.#client.send(
      new PutObjectCommand({
        Bucket: this.#bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
        // Lets S3 reject a corrupted upload rather than storing bad bytes.
        ChecksumSHA256: Buffer.from(sha256, 'hex').toString('base64'),
        ServerSideEncryption: 'AES256',
      }),
    )

    return { key, sizeBytes: body.byteLength, sha256, mimeType }
  }

  async get(key: string): Promise<Buffer> {
    const result = await this.#client.send(
      new GetObjectCommand({ Bucket: this.#bucket, Key: key }),
    )
    const bytes = await result.Body?.transformToByteArray()
    if (!bytes) throw new Error(`Empty object at ${key}`)
    return Buffer.from(bytes)
  }

  async delete(key: string): Promise<void> {
    await this.#client.send(new DeleteObjectCommand({ Bucket: this.#bucket, Key: key }))
  }
}
