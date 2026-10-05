import { describe, expect, it } from 'vitest';
import { BackupError, createBackup, inspectBackup, openBackup } from './backup';
import { initialState, type AppState } from './store';

const state = (): AppState => ({
  ...initialState(), year: 2025, filingStatus: 'single',
  taxpayer: { firstName: 'Sam', lastName: 'Lee', ssn: '123-45-6789', dateOfBirth: '1985-05-01' },
  docs: [{ id: 'd', name: 't4.pdf', kind: 'pdf', method: 'fields', addedAt: 1, previewKeys: ['p1'], previewScale: [2], errors: [] }],
  years: { 2024: { ...initialState(), step: 'you', docs: [{ id: 'e', name: 'old.pdf', kind: 'pdf', method: 'text', addedAt: 1, previewKeys: ['p2'], previewScale: [2], errors: [] }] } as never },
});
const blobs: Record<string, Blob> = { p1: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), p2: new Blob([new Uint8Array([9])], { type: 'image/png' }) };
const get = async (k: string) => blobs[k];

describe('backup and restore', () => {
  it('round-trips the state and every page image, in every year', async () => {
    const text = await createBackup(state(), get);
    expect(inspectBackup(text).encrypted).toBe(false);
    const back = await openBackup(text);
    expect(back.state.taxpayer.ssn).toBe('123-45-6789');
    expect(back.state.years[2024]?.docs[0].name).toBe('old.pdf');
    expect(Object.fromEntries(await Promise.all(back.blobs.map(async (b) => [b.key, [...new Uint8Array(await b.blob.arrayBuffer())]])))).toEqual({ p1: [1, 2, 3], p2: [9] });
  });

  it('with a password, the file holds no readable tax data and only the right password opens it', async () => {
    const text = await createBackup(state(), get, 'maple syrup');
    expect(inspectBackup(text).encrypted).toBe(true);
    expect(text).not.toContain('123-45-6789');
    expect(text).not.toContain('Lee');
    await expect(openBackup(text, 'wrong')).rejects.toThrow(BackupError);
    await expect(openBackup(text)).rejects.toThrow('has a password');
    expect((await openBackup(text, 'maple syrup')).state.taxpayer.lastName).toBe('Lee');
  }, 30000);

  it('refuses files that are not Lou backups', async () => {
    await expect(openBackup('{"hello":1}')).rejects.toThrow("isn't a Lou backup");
    await expect(openBackup('not json')).rejects.toThrow("isn't a Lou backup");
  });
});
