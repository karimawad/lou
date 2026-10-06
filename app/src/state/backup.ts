// Backup and restore: everything Lou keeps (all years, answers, and the page images of uploaded
// documents) in one file the user saves on their own computer. Optionally encrypted with a password
// (PBKDF2-SHA-256, 600,000 iterations -> AES-256-GCM, Web Crypto). Nothing leaves the device.

import { sanitizeState, type AppState } from './store';

export const BACKUP_FORMAT = 'lou-backup';
const ITERATIONS = 600_000;

interface Payload { state: AppState; blobs: Record<string, { type: string; data: string }> }
interface PlainFile { format: typeof BACKUP_FORMAT; version: 1; createdAt: string; encrypted: false; payload: Payload }
interface SealedFile { format: typeof BACKUP_FORMAT; version: 1; createdAt: string; encrypted: true; salt: string; iv: string; iterations: number; data: string }
type BackupFile = PlainFile | SealedFile;

export class BackupError extends Error {}

const toB64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** Every page-image key the state refers to, in every year. */
export function blobKeys(state: AppState): string[] {
  const docs = [...state.docs, ...Object.values(state.years).flatMap((y) => y?.docs ?? [])];
  return [...new Set(docs.flatMap((d) => d.previewKeys))];
}

async function keyFrom(password: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Builds the backup file's text. `getBlob` reads a page image (IndexedDB in the browser). */
export async function createBackup(state: AppState, getBlob: (key: string) => Promise<Blob | undefined>, password?: string): Promise<string> {
  const blobs: Payload['blobs'] = {};
  for (const key of blobKeys(state)) {
    const b = await getBlob(key);
    if (b) blobs[key] = { type: b.type, data: toB64(new Uint8Array(await b.arrayBuffer())) };
  }
  const payload: Payload = { state: { ...state, savedAt: Date.now() }, blobs };
  const createdAt = new Date().toISOString();
  if (!password) return JSON.stringify({ format: BACKUP_FORMAT, version: 1, createdAt, encrypted: false, payload } satisfies PlainFile);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(password, salt, ITERATIONS);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(payload))));
  return JSON.stringify({ format: BACKUP_FORMAT, version: 1, createdAt, encrypted: true, salt: toB64(salt), iv: toB64(iv), iterations: ITERATIONS, data: toB64(data) } satisfies SealedFile);
}

/** Reads a backup file's header without the password (to know whether to ask for one). */
export function inspectBackup(text: string): { encrypted: boolean; createdAt: string } {
  const f = parse(text);
  return { encrypted: f.encrypted, createdAt: f.createdAt };
}

function parse(text: string): BackupFile {
  let f: BackupFile;
  try { f = JSON.parse(text); } catch { throw new BackupError("This isn't a Lou backup file."); }
  if (!f || f.format !== BACKUP_FORMAT) throw new BackupError("This isn't a Lou backup file.");
  if (f.version !== 1) throw new BackupError('This backup was made by a newer version of Lou. Update Lou, then try again.');
  return f;
}

/** Opens a backup file. Throws BackupError with a plain message on a wrong password or a damaged file. */
export async function openBackup(text: string, password?: string): Promise<{ state: AppState; blobs: { key: string; blob: Blob }[] }> {
  const f = parse(text);
  let payload: Payload;
  if (f.encrypted) {
    if (!password) throw new BackupError('This backup has a password. Enter it to restore.');
    try {
      const key = await keyFrom(password, fromB64(f.salt), f.iterations);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(f.iv) as BufferSource }, key, fromB64(f.data) as BufferSource);
      payload = JSON.parse(new TextDecoder().decode(plain));
    } catch { throw new BackupError("That password doesn't open this backup."); }
  } else payload = f.payload;
  if (!payload?.state || payload.state.version !== 1) throw new BackupError('This backup file is damaged.');
  return {
    state: sanitizeState(payload.state),
    blobs: Object.entries(payload.blobs ?? {}).map(([key, b]) => ({ key, blob: new Blob([fromB64(b.data) as BlobPart], { type: b.type }) })),
  };
}

export const backupFileName = (d = new Date()) => `Lou-backup-${d.toISOString().slice(0, 10)}.lou`;
