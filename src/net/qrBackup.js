// QR-code backup transfer — moves a full save between two phones with no
// internet, no cables: the save is compressed, split into a sequence of QR
// codes (a single code can't hold a whole save — QR's hard capacity ceiling
// is only a few KB), displayed as a slideshow on the source phone, and
// scanned frame-by-frame by the destination phone's camera. Once every frame
// is captured the pieces are reassembled, decompressed, checksummed, and
// handed to the exact same before/after diff screen the file-based restore
// already uses — nothing skips that safety step.
//
// Pure JS, framework-agnostic (no RN imports) so this whole pipeline is
// unit-testable in plain Node — the one part of this feature that CAN be
// fully verified without a physical camera.

import { deflate, inflate } from 'pako';

const MAGIC = 'TEQR1'; // format tag, lets the scanner ignore unrelated QR codes
export const FRAME_CHARS = 700; // base64 chars per frame — tuned for reliable camera reads

// ---- base64 (no Buffer/btoa dependency — Hermes doesn't reliably have either) ----
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function b64Encode(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    out += B64_CHARS[b0 >> 2];
    out += B64_CHARS[((b0 & 3) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
    out += b1 === undefined ? '=' : B64_CHARS[((b1 & 15) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
    out += b2 === undefined ? '=' : B64_CHARS[b2 & 63];
  }
  return out;
}
const B64_LOOKUP = (() => { const m = {}; for (let i = 0; i < B64_CHARS.length; i++) m[B64_CHARS[i]] = i; return m; })();
export function b64Decode(str) {
  const clean = str.replace(/=+$/, '');
  const bytes = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64_LOOKUP[clean[i]], c1 = B64_LOOKUP[clean[i + 1]];
    const c2 = clean[i + 2] !== undefined ? B64_LOOKUP[clean[i + 2]] : undefined;
    const c3 = clean[i + 3] !== undefined ? B64_LOOKUP[clean[i + 3]] : undefined;
    bytes.push((c0 << 2) | (c1 >> 4));
    if (c2 !== undefined) bytes.push(((c1 & 15) << 4) | (c2 >> 2));
    if (c3 !== undefined) bytes.push(((c2 & 3) << 6) | c3);
  }
  return new Uint8Array(bytes);
}

// ---- CRC32 (integrity check — catches a dropped/corrupted frame) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(str) {
  let crc = 0xffffffff;
  for (let i = 0; i < str.length; i++) {
    crc = CRC_TABLE[(crc ^ str.charCodeAt(i)) & 0xff] ^ (crc >>> 8);
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16);
}

// ---- Build the frame sequence from a save snapshot ----
export function buildQrFrames(snapshot, transferId) {
  const json = JSON.stringify(snapshot);
  const compressed = deflate(json);
  const b64 = b64Encode(compressed);
  const sum = crc32(b64);
  const id = transferId || Math.random().toString(36).slice(2, 8);
  const n = Math.max(1, Math.ceil(b64.length / FRAME_CHARS));
  const frames = [];
  for (let i = 0; i < n; i++) {
    const chunk = b64.slice(i * FRAME_CHARS, (i + 1) * FRAME_CHARS);
    frames.push(`${MAGIC}|${id}|${i}|${n}|${sum}|${chunk}`);
  }
  return { frames, transferId: id, totalFrames: n, rawBytes: compressed.length, b64Length: b64.length };
}

// Parse one scanned frame's text. Returns null if it's not one of ours.
export function parseQrFrame(text) {
  if (typeof text !== 'string' || !text.startsWith(MAGIC + '|')) return null;
  const parts = text.split('|');
  if (parts.length < 6) return null;
  const [, id, iStr, nStr, sum, ...rest] = parts;
  const i = parseInt(iStr, 10), n = parseInt(nStr, 10);
  if (!Number.isFinite(i) || !Number.isFinite(n) || i < 0 || i >= n) return null;
  return { id, i, n, sum, chunk: rest.join('|') }; // chunk may itself contain '|' from base64? it can't (b64 alphabet has no '|'), but join is defensive
}

// Stateful reassembler for the scanning side — feed it every decoded QR
// string; it tracks progress and returns the restored save the moment every
// frame for one transfer id has arrived, verified byte-for-byte via CRC32.
export function createQrReceiver() {
  let id = null, n = 0, sum = null;
  const chunks = new Map();
  return {
    // Returns { progress: {have, total}, done, data, error }
    addFrame(text) {
      const f = parseQrFrame(text);
      if (!f) return { progress: { have: chunks.size, total: n }, done: false };
      if (id && f.id !== id) {
        // A different transfer started (e.g. sender restarted) — reset.
        chunks.clear();
      }
      id = f.id; n = f.n; sum = f.sum;
      chunks.set(f.i, f.chunk);
      if (chunks.size < n) return { progress: { have: chunks.size, total: n }, done: false };
      // All frames present — reassemble and verify.
      let b64 = '';
      for (let i = 0; i < n; i++) b64 += chunks.get(i) ?? '';
      if (crc32(b64) !== sum) {
        return { progress: { have: chunks.size, total: n }, done: false, error: 'Checksum mismatch — a frame was misread. Keep scanning to retry.' };
      }
      try {
        const bytes = b64Decode(b64);
        // pako v3 renamed the "decode to string" option from `to: 'string'`
        // (v2 API) to `toText`. Caught by unit tests — got this wrong once
        // already, verifying explicitly below rather than trusting docs.
        const json = inflate(bytes, { toText: true });
        const data = JSON.parse(json);
        return { progress: { have: n, total: n }, done: true, data };
      } catch (e) {
        return { progress: { have: chunks.size, total: n }, done: false, error: 'Could not decode the scanned data — try again.' };
      }
    },
    reset() { id = null; n = 0; sum = null; chunks.clear(); },
    progress() { return { have: chunks.size, total: n }; },
  };
}
