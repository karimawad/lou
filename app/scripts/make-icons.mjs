// Draws Lou's app icons (the favicon mark: black tile, sun-yellow "L") as PNGs for the web app manifest.
// Usage: node scripts/make-icons.mjs  (writes public/icons/)
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';

const SPRUCE = '#14161a'; // form ink
const PAPER = '#f4b82e'; // sun
mkdirSync('public/icons', { recursive: true });

/** maskable: full-bleed tile with the mark inside the 80% safe zone (platforms crop to a circle or squircle). */
function icon(size, { maskable = false, rounded = true } = {}) {
  const c = createCanvas(size, size);
  const g = c.getContext('2d');
  const s = size / 32;
  g.fillStyle = SPRUCE;
  if (maskable || !rounded) g.fillRect(0, 0, size, size);
  else { g.fillRect(0, 0, size, size); }
  // The favicon's path is M10 8 v16 h12 in a 32-unit box; shrink it toward the centre for the safe zone.
  const k = maskable ? 0.72 : 1;
  const t = (v) => (16 + (v - 16) * k) * s;
  g.strokeStyle = PAPER;
  g.lineWidth = 3.2 * s * k;
  g.lineCap = 'square';
  g.lineJoin = 'miter';
  g.beginPath(); g.moveTo(t(10), t(8)); g.lineTo(t(10), t(24)); g.lineTo(t(22), t(24)); g.stroke();
  return c.toBuffer('image/png');
}

writeFileSync('public/icons/icon-192.png', icon(192));
writeFileSync('public/icons/icon-512.png', icon(512));
writeFileSync('public/icons/maskable-512.png', icon(512, { maskable: true }));
// Apple applies its own rounding: give it a square tile.
writeFileSync('public/icons/apple-touch-icon.png', icon(180, { rounded: false }));
console.log('icons written');
