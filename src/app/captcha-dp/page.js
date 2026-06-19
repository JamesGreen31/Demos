'use client';

import { useEffect, useRef } from 'react';

const WIDTH = 500;
const HEIGHT = 300;

function drawCaptcha(canvas) {
  if (!canvas) return;

  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const UPPER = 'ABCDEFGHJKMNPQRTUVWXY';
  const LOWER = 'abcdefghjkmnpqrtuvwxy';
  const DIGIT = '2346789';
  const SYMBOL = '=&#@$!';

  const CHARS = UPPER + LOWER + DIGIT + SYMBOL;

  function securePassword(length = 16) {
    const bytes = new Uint32Array(length);
    crypto.getRandomValues(bytes);

    return [...bytes]
      .map((v) => CHARS[v % CHARS.length])
      .join('');
  }

  const password = securePassword(16);

  console.log('Password:', password);

  const left = password.slice(0, 8);
  const right = password.slice(8);

  ctx.fillStyle = '#f3f3f3';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = 'rgba(0,0,0,.20)';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(WIDTH / 2, 0);
  ctx.lineTo(WIDTH / 2, HEIGHT);
  ctx.stroke();

  const fonts = [
    'Arial',
    'Verdana',
    'Georgia',
    'Courier New',
    'Trebuchet MS',
    'Tahoma',
    'Times New Roman',
  ];

  for (let i = 0; i < 700; i += 1) {
    const bleed = Math.random() < 0.08;
    const minX = bleed ? 0 : 0;
    const maxX = bleed ? WIDTH * 0.65 : WIDTH / 2;

    ctx.strokeStyle = `rgba(${Math.random() * 255 | 0}, ${Math.random() * 255 | 0}, ${Math.random() * 255 | 0}, ${0.03 + Math.random() * 0.07})`;
    ctx.lineWidth = 0.5 + Math.random() * 2;

    ctx.beginPath();
    ctx.moveTo(minX + Math.random() * (maxX - minX), Math.random() * HEIGHT);
    ctx.lineTo(minX + Math.random() * (maxX - minX), Math.random() * HEIGHT);
    ctx.stroke();
  }

  let x = 25;
  const baselineL = HEIGHT / 2;
  const freqL = 1.5;
  const ampL = 15;
  const phaseL = 0;
  const baseAngleL = (Math.random() * 10 - 5) * Math.PI / 180;

  [...left].forEach((ch, i) => {
    const size = 22 + Math.random() * 10;
    const progress = i / left.length;
    const y = baselineL + Math.sin(progress * freqL * Math.PI + phaseL) * ampL;
    const localVariation = (Math.random() * 10 - 5) * Math.PI / 180;
    const rot = baseAngleL + localVariation;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    const font = fonts[Math.random() * fonts.length | 0];
    ctx.font = `${size}px ${font}`;

    const metrics = ctx.measureText(ch);
    const r = 40 + Math.random() * 170 | 0;
    const g = 40 + Math.random() * 170 | 0;
    const b = 40 + Math.random() * 170 | 0;

    if (/[A-Z]/.test(ch)) {
      ctx.fillStyle = 'rgba(255,255,180,.88)';
      ctx.fillRect(-4, -size + 5, metrics.width + 8, size + 8);
      ctx.strokeStyle = 'rgba(0,0,0,.40)';
      ctx.strokeRect(-4, -size + 5, metrics.width + 8, size + 8);
    }

    ctx.fillStyle = `rgb(${r},${g},${b})`;
    const glowing = Math.random() < 0.18;

    if (glowing) {
      ctx.shadowColor = `rgba(${r},${g},${b},0.8)`;
      ctx.shadowBlur = 10 + Math.random() * 12;
    }
    ctx.fillText(ch, 0, 0);
    ctx.fillText(ch, 0, 0);

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.restore();

    x += Math.max(metrics.width, size * 0.55) + 6 + Math.random() * 8;
  });

  for (let i = 0; i < 120; i += 1) {
    ctx.strokeStyle = `rgba(${Math.random() * 255 | 0}, ${Math.random() * 255 | 0}, ${Math.random() * 255 | 0}, .10)`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(Math.random() * (WIDTH / 2), Math.random() * HEIGHT);
    ctx.lineTo(Math.random() * (WIDTH / 2), Math.random() * HEIGHT);
    ctx.stroke();
  }

  const clutter = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz346789@$!';

  for (let i = 0; i < 350; i += 1) {
    ctx.fillStyle = `rgba(0,0,0,${0.01 + Math.random() * 0.05})`;
    ctx.font = `${10 + Math.random() * 22}px Arial`;
    ctx.fillText(
      clutter[Math.random() * clutter.length | 0],
      WIDTH / 2 + Math.random() * WIDTH / 2,
      Math.random() * HEIGHT,
    );
  }

  ctx.save();
  ctx.font = '28px Arial';

  let totalWidth = 0;

  for (const ch of right) {
    const metrics = ctx.measureText(ch);
    totalWidth += metrics.width + 10;
  }

  ctx.restore();

  let rx = WIDTH * 0.75 - totalWidth / 2 + (Math.random() * 16 - 8);
  const baselineR = HEIGHT / 2;
  const freqR = 1.75;
  const ampR = 15;
  const phaseR = Math.random() * Math.PI;
  const baseAngleR = (Math.random() * 12 - 6) * Math.PI / 180;

  [...right].forEach((ch, i) => {
    const size = 22 + Math.random() * 10;
    const progress = i / Math.max(1, right.length - 1);
    const y = baselineR + Math.sin(progress * freqR * Math.PI + phaseR) * ampR;
    const localVariation = (Math.random() * 10 - 5) * Math.PI / 180;
    const rot = baseAngleR + localVariation;

    ctx.save();
    ctx.translate(rx, y);
    ctx.rotate(rot);

    const font = fonts[Math.random() * fonts.length | 0];
    ctx.font = `${size}px ${font}`;

    const metrics = ctx.measureText(ch);

    if (/[A-Z]/.test(ch)) {
      ctx.fillStyle = 'rgba(200,255,200,.88)';
      ctx.fillRect(-4, -size, metrics.width + 8, size + 8);
      ctx.strokeStyle = 'rgba(0,0,0,.40)';
      ctx.strokeRect(-4, -size, metrics.width + 8, size + 8);
    }

    const rr = 50 + Math.random() * 170 | 0;
    const gg = 50 + Math.random() * 170 | 0;
    const bb = 50 + Math.random() * 170 | 0;
    const glowing = Math.random() < 0.18;

    if (glowing) {
      ctx.shadowColor = `rgba(${rr},${gg},${bb},0.8)`;
      ctx.shadowBlur = 10 + Math.random() * 12;
    }

    ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
    ctx.fillText(ch, 0, 0);

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.restore();

    rx += metrics.width + 6 + Math.random() * 8;
  });

  for (let i = 0; i < 5; i += 1) {
    ctx.strokeStyle = `rgba(${Math.random() * 255 | 0}, ${Math.random() * 255 | 0}, ${Math.random() * 255 | 0}, .18)`;
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2 - 20, Math.random() * HEIGHT);
    ctx.bezierCurveTo(
      WIDTH * 0.65,
      Math.random() * HEIGHT,
      WIDTH * 0.85,
      Math.random() * HEIGHT,
      WIDTH,
      Math.random() * HEIGHT,
    );
    ctx.stroke();
  }

  for (let i = 0; i < 20; i += 1) {
    ctx.strokeStyle = `rgba(${Math.random() * 255 | 0}, ${Math.random() * 255 | 0}, ${Math.random() * 255 | 0}, .05)`;
    ctx.beginPath();
    ctx.moveTo(Math.random() * WIDTH, Math.random() * HEIGHT);
    ctx.lineTo(Math.random() * WIDTH, Math.random() * HEIGHT);
    ctx.stroke();
  }
}

export default function CaptchaDemo() {
  const demosHref = process.env.NODE_ENV === 'production' ? '/Demos' : '/';
  const canvasRef = useRef(null);

  useEffect(() => {
    drawCaptcha(canvasRef.current);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center p-8 gap-6">
      <div className="w-full max-w-3xl flex items-center justify-between">
        <button
          type="button"
          onClick={() => window.location.assign(demosHref)}
          className="px-3 py-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-800"
        >
          ← Back
        </button>
      </div>

      <section className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xl">
        <div className="mb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-700">Demo Package</p>
          <h1 className="text-4xl font-bold mt-2">Captcha Generator</h1>
          <p className="mt-3 text-slate-600">
            Generate a split-panel captcha from a cryptographically random 16-character password with layered noise,
            rotated glyphs, clutter, highlights, and scratches.
          </p>
        </div>

        <div className="flex flex-col items-center gap-5">
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            className="w-full max-w-[500px] rounded-xl border border-slate-300 bg-slate-100 shadow-inner"
            aria-label="Generated captcha image"
          />
          <button
            type="button"
            onClick={() => drawCaptcha(canvasRef.current)}
            className="rounded-lg bg-cyan-700 px-5 py-3 font-bold text-white shadow-lg transition hover:bg-cyan-800 focus:outline-none focus:ring-4 focus:ring-cyan-200"
          >
            Generate new captcha
          </button>
        </div>
      </section>
    </main>
  );
}
