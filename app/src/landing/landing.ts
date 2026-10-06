// Landing page behaviour: the form assembles on load, the demo shows an uploaded file filling in the numbers,
// and a "Continue your return" shortcut appears for people who already started. No framework, no network.
import '../fonts/fonts.css';
import './landing.css';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Example figures for the demo only. Lou uses the official yearly average rate for the chosen tax year.
const RATE = 1.4;
const TAX = 14200;
const WAGES = 84500;

/** Someone who already started a return gets a shortcut back into it. */
try {
  const saved = JSON.parse(localStorage.getItem('lou:v1') ?? 'null') as { year?: number | null } | null;
  if (saved?.year) $('continue').hidden = false;
} catch { /* storage blocked or unreadable: no shortcut */ }

/** Assembly: golden-angle directions so every piece arrives from a different side and angle. */
const pieces = [...document.querySelectorAll<HTMLElement>('.pc')];
const vw = Math.min(innerWidth, 1100);
pieces.forEach((el, i) => {
  const a = (i * 137.508 * Math.PI) / 180;
  const dist = (0.55 + ((i * 37) % 50) / 60) * Math.max(vw, 420);
  el.style.setProperty('--x', `${Math.round(Math.cos(a) * dist)}px`);
  el.style.setProperty('--y', `${Math.round(Math.sin(a) * dist * 0.85)}px`);
  el.style.setProperty('--r', `${((i * 53) % 46) - 23}deg`);
  el.style.setProperty('--d', `${Math.round(Math.min(i * 22, 1300))}ms`);
});
document.body.classList.add('go');

/** Live demo: a file flies in, gets read, and its numbers fly out into the lines. */
const sheet = $('sheet');
const file = $('file');
const E_OUT = 'cubic-bezier(.16,1,.3,1)';
const E_IO = 'cubic-bezier(.65,0,.35,1)';
let tok = 0;
let started = false;
let filePos = { x: 0, y: 0 };

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, RM ? 0 : ms));

function typeInto(el: HTMLElement, text: string, t: number, speed = 26): Promise<void> {
  return new Promise((res) => {
    if (RM) { el.textContent = text; return res(); }
    el.textContent = '';
    el.classList.add('caret');
    let i = 0;
    const step = () => {
      if (t !== tok) { el.classList.remove('caret'); return res(); }
      if (i < text.length) { el.textContent += text[i++]; setTimeout(step, speed + Math.random() * 22); }
      else { el.classList.remove('caret'); res(); }
    };
    step();
  });
}

function recompute() {
  const cad = parseFloat(($<HTMLInputElement>('cad').value || '0').replace(/,/g, '')) || 0;
  $('v4').textContent = fmt(cad / RATE);
}

function rel(el: HTMLElement) {
  const s = sheet.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
}

function anim(el: HTMLElement, frames: Keyframe[], ms: number, easing: string): Promise<unknown> {
  if (RM) return Promise.resolve();
  return el.animate(frames, { duration: ms, easing, fill: 'forwards' }).finished.catch(() => undefined);
}

async function flyFile() {
  const z = rel($('v1'));
  const to = { x: z.x + 12, y: z.y + (z.h - 44) / 2 };
  filePos = to;
  file.getAnimations().forEach((a) => a.cancel());
  const fx = to.x + Math.min(innerWidth * 0.6, 520);
  const fy = to.y - 360;
  if (RM) {
    file.style.opacity = '1';
    file.style.transform = `translate(${to.x}px,${to.y}px) scale(.8)`;
    return;
  }
  await anim(file, [
    { transform: `translate(${fx}px,${fy}px) rotate(26deg) scale(1.2)`, opacity: 0 },
    { opacity: 1, offset: 0.22 },
    { transform: `translate(${to.x}px,${to.y}px) rotate(0deg) scale(.8)`, opacity: 1 },
  ], 950, E_OUT);
  file.style.opacity = '1';
  file.style.transform = `translate(${to.x}px,${to.y}px) scale(.8)`;
}

async function scan() {
  if (RM) return;
  const sc = $('scan');
  await anim(sc, [{ transform: 'translateY(2px)', opacity: 1 }, { transform: 'translateY(38px)', opacity: 1 }], 520, 'linear');
  await anim(sc, [{ transform: 'translateY(38px)', opacity: 1 }, { transform: 'translateY(2px)', opacity: 1 }], 520, 'linear');
  sc.getAnimations().forEach((a) => a.cancel());
}

async function sendChip(label: string, target: HTMLElement) {
  if (RM) return;
  const chip = document.createElement('div');
  chip.className = 'chip';
  chip.textContent = label;
  sheet.appendChild(chip);
  const c0 = { x: filePos.x + 10, y: filePos.y + 14 };
  const r = rel(target);
  const c1 = { x: r.x + 14, y: r.y + r.h / 2 - 11 };
  await anim(chip, [
    { transform: `translate(${c0.x}px,${c0.y}px) scale(.8)`, opacity: 0 },
    { opacity: 1, offset: 0.15 },
    { transform: `translate(${c1.x}px,${c1.y}px) scale(1)`, opacity: 1, offset: 0.85 },
    { transform: `translate(${c1.x}px,${c1.y}px) scale(.9)`, opacity: 0 },
  ], 720, E_IO);
  chip.remove();
  target.classList.add('hit');
  setTimeout(() => target.classList.remove('hit'), 320);
}

async function runDemo(first: boolean) {
  const t = ++tok;
  for (const id of ['v3', 'v4', 'v5', 'v6']) { $(id).textContent = ''; $(id).classList.remove('caret', 'hit'); }
  $('v1').textContent = 'Drop your return here';
  $('v1').classList.add('await');
  $('stamp').classList.remove('on');
  $<HTMLInputElement>('cad').value = '';
  file.style.opacity = '0';
  file.getAnimations().forEach((a) => a.cancel());
  document.querySelectorAll('.chip').forEach((c) => c.remove());

  await wait(first ? Math.max(0, 1900 - performance.now()) : 350);
  if (t !== tok) return;
  await flyFile();
  if (t !== tok) return;
  $('v1').classList.remove('await');
  $('v1').classList.add('hit');
  setTimeout(() => $('v1').classList.remove('hit'), 320);
  await typeInto($('v1'), 'T1_2025.pdf, reading', t, 16);
  if (t !== tok) return;
  await scan();
  if (t !== tok) return;
  $('v1').textContent = 'T1_2025.pdf read on this device';
  await wait(250);
  if (t !== tok) return;

  await sendChip('T4 box 14', $('cad').parentElement as HTMLElement);
  if (t !== tok) return;
  const s = fmt(WAGES);
  for (let i = 1; i <= s.length; i++) {
    if (t !== tok) return;
    $<HTMLInputElement>('cad').value = s.slice(0, i);
    await wait(45);
  }
  await wait(200);
  await typeInto($('v3'), RATE.toFixed(4), t);
  if (t !== tok) return;
  await wait(180);
  await typeInto($('v4'), fmt(WAGES / RATE), t, 28);
  if (t !== tok) return;
  await wait(220);
  await sendChip('T1 tax owed', $('v5'));
  if (t !== tok) return;
  await typeInto($('v5'), fmt(TAX / RATE), t, 28);
  if (t !== tok) return;
  await wait(220);
  await sendChip('CPP box 16', $('v6'));
  if (t !== tok) return;
  await typeInto($('v6'), 'FLAGGED', t, 38);
  if (t !== tok) return;
  await wait(450);
  $('stamp').classList.add('on');
}

$('cad').addEventListener('input', recompute);
$('again').addEventListener('click', () => { started = true; void runDemo(false); });
// Start when step 1 scrolls into view (and the form has finished assembling).
const stepOne = document.querySelector('.step.s1');
if (stepOne) {
  new IntersectionObserver((entries, o) => {
    for (const e of entries) {
      if (e.isIntersecting && !started) { started = true; o.disconnect(); void runDemo(true); }
    }
  }, { threshold: 0.9 }).observe(stepOne);
}

/** Tick the "Why Lou" boxes as they arrive. */
const checks = [...document.querySelectorAll<HTMLElement>('.chk')];
const tick = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    tick.unobserve(e.target);
    const i = checks.indexOf(e.target as HTMLElement);
    setTimeout(() => e.target.classList.add('on'), RM ? 0 : i * 170);
  }
}, { threshold: 0.6 });
checks.forEach((c) => tick.observe(c));
