import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useOnchainFeed } from '../data/OnchainProvider';
import { formatUsdCompact } from '../lib/format';
import type { ChainLogEntry, HistoryPoint } from '../types/quote';

/**
 * Three.js hero background: the live price series drawn as a physical object,
 * a muted ink tube riding over its own fading depth trails, with a soft lime
 * fill underneath and a pulsing lime head marker at the live edge. Theme colors
 * are the CSS vars, hard-coded here so the shader-free materials match exactly.
 */

const PAGE = '#f5f3ea';
const INK = '#1d1d1d';
const MUTED = '#6e6e65';
const LINE = '#d2d1c9'; // --line rgba(29,29,29,0.16) composited over the ivory page
const LIME = '#c8ff3d';
const POS = '#17763c';
const NEG = '#b33d3d';

const MAX_POINTS = 240; // enough history for a smooth curve, cheap to rebuild
const GHOSTS = 6; // depth trail copies behind the front tube
const TX_URL = 'https://rh-scan.com/tx/';

export function HeroScene({ series, className }: { series: HistoryPoint[]; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<HistoryPoint[]>(series);
  const dirtyRef = useRef(true);

  // Chain cards feed: fresh swap/transfer events from the shared live log.
  // The first delivery is backfill, not news; it is absorbed silently.
  const { log } = useOnchainFeed();
  const seenIds = useRef<Set<string> | null>(null);
  const pending = useRef<ChainLogEntry[]>([]);
  useEffect(() => {
    if (!log.length) return;
    if (seenIds.current === null) {
      seenIds.current = new Set(log.map((e) => e.id));
      return;
    }
    const fresh = log.filter((e) => !seenIds.current!.has(e.id) && e.kind === 'swap');
    for (const e of fresh) seenIds.current!.add(e.id);
    if (fresh.length) pending.current.push(...fresh);
  }, [log]);

  // New data (SSE tick or symbol switch) just flags the render loop to rebuild.
  useEffect(() => {
    dataRef.current = series;
    dirtyRef.current = true;
  }, [series]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // no WebGL: hero still works, just without the 3D backdrop
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
    camera.position.set(0, 0.12, 3.2);
    camera.lookAt(0, 0, 0);

    const world = new THREE.Group();
    scene.add(world);

    const chart = new THREE.Group();
    world.add(chart);

    // Faint graph-paper grid behind everything, in the theme line color.
    const grid = (() => {
      const verts: number[] = [];
      for (let i = -2; i <= 2; i++) {
        const y = i * 0.2;
        verts.push(-2.4, y, -1.2, 2.4, y, -1.2); // horizontals
        const x = i * 0.75;
        verts.push(x, -0.58, -1.2, x, 0.58, -1.2); // verticals
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: LINE }));
      world.add(lines);
      return lines;
    })();

    // ponytail: shared materials, rebuilds only swap geometries
    const tubeMat = new THREE.MeshBasicMaterial({ color: INK });
    const fillMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const limeMat = new THREE.MeshBasicMaterial({ color: LIME });
    const pulseMat = new THREE.MeshBasicMaterial({
      color: LIME,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const ghostMats = Array.from(
      { length: GHOSTS },
      (_, i) => new THREE.LineBasicMaterial({ color: MUTED, transparent: true, opacity: 0.3 / (i + 1) }),
    );

    // Mouse effect: the cursor magnetically lifts the curve. Rebuilds swap
    // geometries, so the displacable meshes live in refs the loop can reach.
    let tube: THREE.Mesh | null = null;
    let tubeOrig: Float32Array | null = null;
    let fill: THREE.Mesh | null = null;
    let fillOrig: Float32Array | null = null;
    const ghosts: { line: THREE.Line; orig: Float32Array }[] = [];
    let headBaseY = 0;

    const pulse = new THREE.Mesh(new THREE.RingGeometry(0.026, 0.033, 40), pulseMat);
    const head = new THREE.Group();
    head.add(pulse);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.02, 20, 14), limeMat));
    head.visible = false;
    chart.add(head);

    // Dashed lime guide at the live price, redrawn to the newest level on rebuild.
    const priceMat = new THREE.LineDashedMaterial({
      color: LIME,
      transparent: true,
      opacity: 0.6,
      dashSize: 0.045,
      gapSize: 0.03,
    });

    // Price chip: canvas texture on a plane, so it lives in the scene and rides
    // the parallax with everything else. Redrawn per tick, geometry reused.
    const chipCanvas = document.createElement('canvas');
    const chipTex = new THREE.CanvasTexture(chipCanvas);
    chipTex.minFilter = THREE.LinearFilter;
    const chip = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: chipTex, transparent: true }),
    );
    const CHIP_H = 0.082;
    chip.visible = false;
    chart.add(chip);

    const drawChip = (text: string) => {
      const ctx = chipCanvas.getContext('2d')!;
      const h = 72;
      ctx.font = '600 42px "Geist Sans", system-ui, sans-serif';
      const w = Math.ceil(ctx.measureText(text).width) + 52;
      chipCanvas.width = w; // resizing resets the context, re-set everything
      chipCanvas.height = h;
      ctx.font = '600 42px "Geist Sans", system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fdfcf6';
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(1, 1, w - 2, h - 2, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.fillText(text, 24, h / 2 + 2);
      chipTex.needsUpdate = true;
      chip.scale.set((CHIP_H * w) / h, CHIP_H, 1);
    };

    let priceLine: THREE.Line | null = null;

    // Chain cards: canvas-textured sprites popping at random spots inside the
    // scene, phrased like the Activity feed ("Traded"/"Moved"). Short-lived,
    // disposed on death. Clicking one opens the receipt on rh-scan.
    type CardPart = { t: string; bold?: boolean; muted?: boolean; color?: string };
    type CardFields = { lines: CardPart[][]; dir: 'up' | 'down' | null; txHash?: string };
    // Last seen pool price per symbol: swaps are directionless onchain, but the
    // price move they cause is real, and that is what the arrows report.
    const lastPrice = new Map<string, number>();
    const cardObjs: { sprite: THREE.Sprite; born: number; w: number; h: number }[] = [];
    const CARD_H = 0.125;
    const CARD_LIFE = 4.5;

    /** Two quiet lines: lime dot, then "Action - SYMBOL" over the numbers. */
    function drawCard(c: CardFields): { canvas: HTMLCanvasElement; aspect: number } {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const h = 92;
      const pad = 20;
      const dotZone = 26;
      const font = (b?: boolean) => `${b ? 700 : 500} 32px "Geist Sans", system-ui, sans-serif`;
      ctx.font = font();
      const widths = c.lines.map((line) =>
        line.map((p) => {
          ctx.font = font(p.bold);
          return ctx.measureText(p.t).width;
        }),
      );
      const lineWidths = widths.map((line) => line.reduce((a, b) => a + b, 0));
      const w = Math.ceil(pad * 2 + dotZone + Math.max(...lineWidths));
      canvas.width = w;
      canvas.height = h;
      ctx.fillStyle = '#fdfcf6';
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(1.5, 1.5, w - 3, h - 3, 20);
      ctx.fill();
      ctx.stroke();
      // Direction chip: a soft tinted circle with an up/down arrow when the
      // pool price moved with this trade; unknown direction keeps the lime dot.
      if (c.dir) {
        ctx.fillStyle = c.dir === 'up' ? 'rgba(23, 118, 60, 0.13)' : 'rgba(179, 61, 61, 0.13)';
        ctx.beginPath();
        ctx.arc(pad + 12, h / 2, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c.dir === 'up' ? POS : NEG;
        ctx.beginPath();
        if (c.dir === 'up') {
          ctx.moveTo(pad + 12, h / 2 - 6);
          ctx.lineTo(pad + 5.5, h / 2 + 5);
          ctx.lineTo(pad + 18.5, h / 2 + 5);
        } else {
          ctx.moveTo(pad + 12, h / 2 + 6);
          ctx.lineTo(pad + 5.5, h / 2 - 5);
          ctx.lineTo(pad + 18.5, h / 2 - 5);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = LIME;
        ctx.beginPath();
        ctx.arc(pad + 8, h / 2, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.textBaseline = 'middle';
      const ys = [h / 2 - 17, h / 2 + 19];
      c.lines.forEach((line, li) => {
        let x = pad + dotZone;
        line.forEach((p, pi) => {
          ctx.font = font(p.bold);
          ctx.fillStyle = p.muted ? MUTED : (p.color ?? INK);
          ctx.fillText(p.t, x, ys[li]! + 2);
          x += widths[li]![pi]!;
        });
      });
      return { canvas, aspect: w / h };
    }

    function toFields(e: ChainLogEntry): CardFields | null {
      if (e.kind !== 'swap' || !e.symbol) return null;
      const prev = lastPrice.get(e.symbol);
      let dir: 'up' | 'down' | null = null;
      if (e.price != null) {
        if (prev != null && e.price > prev) dir = 'up';
        else if (prev != null && e.price < prev) dir = 'down';
        lastPrice.set(e.symbol, e.price);
      }
      const l2: CardPart[] = [];
      if (e.usdValue != null) {
        l2.push({
          t: formatUsdCompact(e.usdValue),
          bold: true,
          color: dir === 'up' ? POS : dir === 'down' ? NEG : undefined,
        });
      }
      if (e.price != null) l2.push({ t: `${l2.length ? ' · ' : ''}@${e.price.toFixed(2)}`, muted: true });
      return {
        lines: [[{ t: 'Traded · ' }, { t: e.symbol, bold: true }], l2],
        dir,
        txHash: e.txHash,
      };
    }

    const spawnCard = (e: ChainLogEntry) => {
      const f = toFields(e);
      if (!f) return;
      const { canvas, aspect } = drawCard(f);
      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 0,
        rotation: (Math.random() * 2 - 1) * 0.04, // a touch of organic tilt
      });
      const sprite = new THREE.Sprite(mat);
      const w = CARD_H * aspect;
      sprite.scale.set(w, CARD_H, 1);
      const xr = Math.max(0.3, chartW / 2 - 0.3);
      sprite.position.set(
        (Math.random() * 2 - 1) * xr,
        (Math.random() * 2 - 1) * 0.42,
        0.1 + Math.random() * 0.4,
      );
      sprite.userData.txHash = f.txHash;
      world.add(sprite);
      cardObjs.push({ sprite, born: performance.now() / 1000, w, h: CARD_H });
    };

    const disposeCard = (i: number) => {
      const cd = cardObjs[i]!;
      world.remove(cd.sprite);
      (cd.sprite.material as THREE.SpriteMaterial).map?.dispose();
      (cd.sprite.material as THREE.SpriteMaterial).dispose();
      cardObjs.splice(i, 1);
    };

    // Click a card: open its receipt on rh-scan.
    const onCanvasClick = (e: MouseEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          -((e.clientY - r.top) / r.height) * 2 + 1,
        ),
        camera,
      );
      const hit = raycaster
        .intersectObjects(cardObjs.map((c) => c.sprite), false)
        .find((h) => h.object.userData.txHash);
      if (hit) window.open(`${TX_URL}${hit.object.userData.txHash}`, '_blank', 'noopener');
    };
    renderer.domElement.addEventListener('click', onCanvasClick);

    const disposeChart = () => {
      for (const child of [...chart.children]) {
        if (child !== head && child !== chip) {
          chart.remove(child);
          (child as THREE.Mesh | THREE.Line).geometry?.dispose();
        }
      }
      tube = null;
      tubeOrig = null;
      fill = null;
      fillOrig = null;
      ghosts.length = 0;
    };

    const lime = new THREE.Color(LIME);
    const page = new THREE.Color(PAGE);

    function rebuild(pts: HistoryPoint[]) {
      disposeChart();
      priceLine = null;
      if (pts.length < 2) {
        head.visible = false;
        chip.visible = false;
        return;
      }
      const n = Math.min(pts.length, MAX_POINTS);
      const slice = pts.slice(-n);
      const ys = slice.map((p) => Number(p.p));
      let lo = Math.min(...ys);
      let hi = Math.max(...ys);
      if (hi - lo < 1e-6) {
        lo -= 1;
        hi += 1;
      }
      const W = chartW; // curve width, fitted to the viewport
      const H = 0.85; // curve height in world units
      const front = slice.map((p, i) => {
        const y = ((Number(p.p) - lo) / (hi - lo) - 0.5) * H;
        return new THREE.Vector3((i / (n - 1) - 0.5) * W, y, 0);
      });

      // One smooth curve drives everything: the tube, the ghosts and the fill
      // top edge all sample the same CatmullRom spline, so nothing looks jagged
      // next to the tube.
      const curve = new THREE.CatmullRomCurve3(front);
      const smooth = curve.getSpacedPoints(Math.min(600, Math.max(64, n * 4)));
      const m = smooth.length;

      // Front curve: a real tube, so the line has physical thickness.
      tube = new THREE.Mesh(new THREE.TubeGeometry(curve, m, 0.003, 6, false), tubeMat);
      tubeOrig = (tube.geometry.attributes.position as THREE.BufferAttribute).array.slice() as Float32Array;
      chart.add(tube);

      // Depth trails: hairline copies stepped back in z, fading out.
      for (let g = 1; g <= GHOSTS; g++) {
        const geo = new THREE.BufferGeometry().setFromPoints(
          smooth.map((v) => new THREE.Vector3(v.x, v.y - g * 0.012, -g * 0.15)),
        );
        const line = new THREE.Line(geo, ghostMats[g - 1]);
        ghosts.push({ line, orig: (geo.attributes.position as THREE.BufferAttribute).array.slice() as Float32Array });
        chart.add(line);
      }

      // Fill under the curve: lime blended toward the page color per vertex,
      // fakes a lime-to-transparent gradient without a shader.
      const base = -H / 2 - 0.06;
      const top = lime.clone().lerp(page, 0.5); // 50% lime over the page, brighter fill
      const pos: number[] = [];
      const col: number[] = [];
      const idx: number[] = [];
      for (let i = 0; i < m; i++) {
        pos.push(smooth[i]!.x, smooth[i]!.y, -0.012, smooth[i]!.x, base, -0.012);
        col.push(top.r, top.g, top.b, page.r, page.g, page.b);
      }
      for (let i = 0; i < m - 1; i++) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      const fillGeo = new THREE.BufferGeometry();
      fillGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      fillGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      fillGeo.setIndex(idx);
      fill = new THREE.Mesh(fillGeo, fillMat);
      fillOrig = (fillGeo.attributes.position as THREE.BufferAttribute).array.slice() as Float32Array;
      chart.add(fill);

      head.position.copy(front[n - 1]!);
      headBaseY = front[n - 1]!.y;
      head.visible = true;

      // Live price guide + chip, at the newest point's level.
      const lastY = headBaseY;
      priceLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-W / 2 - 0.06, lastY, -0.02),
          new THREE.Vector3(W / 2 + 0.06, lastY, -0.02),
        ]),
        priceMat,
      );
      priceLine.computeLineDistances();
      chart.add(priceLine);
      drawChip(`$${Number(slice[n - 1]!.p).toFixed(2)}`);
      // Left-anchored just past the chart's right edge, clamped to the viewport
      // so the chip can never hang off-screen.
      const chipRight = Math.min(W / 2 + 0.1 + chip.scale.x, viewHalf - 0.06);
      chip.position.set(chipRight - chip.scale.x / 2, lastY, 0.06);
      chip.visible = true;
    }

    // Responsive fit: the curve's width re-derives from the viewport so the
    // whole chart (and the price chip) stays in frame from phones to wide
    // desktops. Portrait screens pull the camera back instead of cropping the
    // live edge off the right side.
    let chartW = 3.0;
    let viewHalf = 1.5; // visible half-width in world units, for chip placement
    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      const t = Math.tan((camera.fov * Math.PI) / 360);
      const fitAtBase = 2 * (t * 3.2 * camera.aspect) - 0.5;
      if (fitAtBase >= 1.6) {
        camera.position.z = 3.2;
        chartW = Math.min(3.0, fitAtBase);
      } else {
        chartW = 1.6;
        camera.position.z = (chartW / 2 + 0.5) / (t * camera.aspect);
      }
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      viewHalf = t * camera.position.z * camera.aspect;
      dirtyRef.current = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // Gentle pointer parallax plus the magnetic lift; none under reduced motion.
    const target = { x: 0, y: 0 };
    const eased = { x: 0, y: 0 };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // chart plane, z = 0
    const ndc = new THREE.Vector2(2, 2); // offscreen until the first move
    let overHero = false;
    const magnet = { x: 0, y: 0 }; // pointer position in chart space, eased
    let influence = 0; // eased 0..1, fades the bump in and out
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return; // no parallax/magnet chasing a scroll finger
      target.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * 2;
      const r = host.getBoundingClientRect();
      overHero = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    if (!reduced) window.addEventListener('pointermove', onPointer, { passive: true });

    // Lift vertices under the cursor with a gaussian falloff, tube + ghosts +
    // fill top edge + head all share the same bump so the chart moves as one.
    const SIGMA2 = 2 * 0.42 * 0.42;
    const displace = (arr: Float32Array, orig: Float32Array, px: number, py: number, amp: number, stride: number) => {
      for (let i = 0; i < arr.length; i += stride) {
        const dx = orig[i]! - px;
        const dy = orig[i + 1]! - py;
        arr[i + 1] = orig[i + 1]! + amp * Math.exp(-(dx * dx + dy * dy) / SIGMA2);
      }
    };
    const applyMagnet = () => {
      const amp = 0.24 * influence;
      if (amp < 0.002) return;
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      const local = hit ? chart.worldToLocal(hit) : null;
      if (local) {
        magnet.x += (local.x - magnet.x) * 0.18;
        magnet.y += (local.y - magnet.y) * 0.18;
      }
      if (tube && tubeOrig) {
        const attr = tube.geometry.attributes.position as THREE.BufferAttribute;
        displace(attr.array as Float32Array, tubeOrig, magnet.x, magnet.y, amp, 3);
        attr.needsUpdate = true;
      }
      for (const g of ghosts) {
        const attr = g.line.geometry.attributes.position as THREE.BufferAttribute;
        displace(attr.array as Float32Array, g.orig, magnet.x, magnet.y, amp * 0.85, 3);
        attr.needsUpdate = true;
      }
      if (fill && fillOrig) {
        // Stride 6 hits only the top vertex of each top/bottom pair, so the baseline stays put.
        const attr = fill.geometry.attributes.position as THREE.BufferAttribute;
        displace(attr.array as Float32Array, fillOrig, magnet.x, magnet.y, amp, 6);
        attr.needsUpdate = true;
      }
      if (head.visible) {
        const dx = head.position.x - magnet.x;
        const dy = headBaseY - magnet.y;
        head.position.y = headBaseY + amp * Math.exp(-(dx * dx + dy * dy) / SIGMA2);
      }
    };

    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const t = (now - t0) / 1000;
      const wasDirty = dirtyRef.current;
      if (wasDirty) {
        rebuild(dataRef.current);
        dirtyRef.current = false;
      }
      if (reduced && !wasDirty) return;

      eased.x += (target.x - eased.x) * 0.04;
      eased.y += (target.y - eased.y) * 0.04;
      world.rotation.y = Math.sin(t * 0.1) * 0.07 + eased.x * 0.05;
      world.rotation.x = Math.sin(t * 0.13) * 0.02 + eased.y * 0.035;
      chart.position.y = Math.sin(t * 0.45) * 0.02;

      influence += ((overHero ? 1 : 0) - influence) * 0.08;
      applyMagnet();

      // Chain cards: drain fresh events, then age each card to death.
      while (pending.current.length) spawnCard(pending.current.shift()!);
      const nowS = now / 1000;
      for (let i = cardObjs.length - 1; i >= 0; i--) {
        const cd = cardObjs[i]!;
        const age = nowS - cd.born;
        const k = reduced ? 1 : Math.min(age / 0.35, 1);
        const mat = cd.sprite.material as THREE.SpriteMaterial;
        mat.opacity = k * (1 - Math.max(0, (age - 3.6) / 0.9));
        if (!reduced) {
          // ponytail: per-frame drift, frame-rate dependence is invisible here
          cd.sprite.position.y += 0.0007;
          const back = 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2; // ease-out-back
          const s = 0.85 + 0.15 * back;
          cd.sprite.scale.set(cd.w * s, cd.h * s, 1);
        }
        if (age > CARD_LIFE) disposeCard(i);
      }

      const k = (t % 2.4) / 2.4; // 0..1 pulse cycle
      pulse.scale.setScalar(1 + k * 1.6);
      pulseMat.opacity = 0.55 * (1 - k);

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
      renderer.domElement.removeEventListener('click', onCanvasClick);
      for (let i = cardObjs.length - 1; i >= 0; i--) disposeCard(i);
      disposeChart();
      head.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      chip.geometry.dispose();
      chip.material.dispose();
      chipTex.dispose();
      [tubeMat, fillMat, limeMat, pulseMat, priceMat, ...ghostMats].forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}
