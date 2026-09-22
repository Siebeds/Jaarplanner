// FB-071 design reference, 2026-09-22. See design-handoff.md in this folder.
//
//   node chuck-ik.mjs          prints the keyframes (walk cycle, step out, step in)
//   node chuck-ik.mjs --log    also prints the step plan, paw by paw
//   node chuck-ik.mjs --diag   also prints per leg where a foot overreaches
//
// Bakes Chuck's walk and his steps out of (and into) his basket into CSS keyframes.
// Per moment we say where the body is and where each foot is planted or swinging to;
// two-bone inverse kinematics turns that into thigh and shin angles per leg.
//
// Coordinates are the scene of #chuck-mand (viewBox 400x176), y pointing down.
// The cat drawing is offset +160; its body centre is (290, 82).

const C = { x: 290, y: 82 };
const OFF = 160;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const dir = (a) => ({ x: -Math.sin(rad(a)), y: Math.cos(rad(a)) });

const LEGS = {
  vn: { hip: [92, 98], L1: 26, L2: 24, rustD: 0, rustS: 0, knie: 'achter' },
  vv: { hip: [104, 100], L1: 26, L2: 23, rustD: 0, rustS: 0, knie: 'achter' },
  av: { hip: [146, 100], L1: 26, L2: 23, rustD: -19, rustS: 28, knie: 'achter' },
  an: { hip: [158, 98], L1: 26, L2: 24, rustD: -19, rustS: 28, knie: 'achter' },
};

// Where a foot rests when every joint is at its rest angle, for a given body pose.
function rustVoet(leg, ux, uy, kijk) {
  const L = LEGS[leg];
  const hip = { x: L.hip[0] + OFF, y: L.hip[1] };
  const k = { x: hip.x + L.L1 * dir(L.rustD).x, y: hip.y + L.L1 * dir(L.rustD).y };
  const p = { x: k.x + L.L2 * dir(L.rustD + L.rustS).x, y: k.y + L.L2 * dir(L.rustD + L.rustS).y };
  return { x: (kijk === 1 ? p.x : 580 - p.x) + ux, y: p.y + uy };
}

// Cubic Hermite through keys [t, ux, uy, pitch], tangents from neighbours.
function lichaam(keys, t) {
  let i = keys.findIndex((k, j) => j < keys.length - 1 && t >= k[0] && t <= keys[j + 1][0]);
  if (i < 0) i = t <= keys[0][0] ? 0 : keys.length - 2;
  const a = keys[i], b = keys[i + 1];
  const h = b[0] - a[0];
  const s = h === 0 ? 0 : (t - a[0]) / h;
  const out = [];
  for (let c = 1; c <= 3; c++) {
    const raaklijn = (k) => {
      if (k === 0 || k === keys.length - 1) return 0;
      return (keys[k + 1][c] - keys[k - 1][c]) / (keys[k + 1][0] - keys[k - 1][0]);
    };
    const m0 = raaklijn(i) * h, m1 = raaklijn(i + 1) * h;
    const s2 = s * s, s3 = s2 * s;
    out.push((2 * s3 - 3 * s2 + 1) * a[c] + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b[c] + (s3 - s2) * m1);
  }
  return { ux: out[0], uy: out[1], p: out[2] };
}

const zacht = (s) => s * s * (3 - 2 * s);

// A foot: where it starts, then swings [t0, t1, to, ctrl?, lift?].
function voet(start, zwaaien, t) {
  let pos = start;
  for (const [t0, t1, naar, ctrl, lift = 9] of zwaaien) {
    if (t < t0) return pos;
    if (t <= t1) {
      const s = zacht((t - t0) / (t1 - t0));
      if (Array.isArray(ctrl)) {
        const u = 1 - s, [c1, c2] = ctrl;
        return {
          x: u * u * u * pos.x + 3 * u * u * s * c1.x + 3 * u * s * s * c2.x + s * s * s * naar.x,
          y: u * u * u * pos.y + 3 * u * u * s * c1.y + 3 * u * s * s * c2.y + s * s * s * naar.y,
        };
      }
      if (ctrl) {
        const u = 1 - s;
        return {
          x: u * u * pos.x + 2 * u * s * ctrl.x + s * s * naar.x,
          y: u * u * pos.y + 2 * u * s * ctrl.y + s * s * naar.y,
        };
      }
      return {
        x: pos.x + (naar.x - pos.x) * s,
        y: pos.y + (naar.y - pos.y) * s - lift * Math.sin(Math.PI * s),
      };
    }
    pos = naar;
  }
  return pos;
}

function ik(leg, doel, pose, kijk) {
  const L = LEGS[leg];
  const P = { x: kijk === 1 ? doel.x - pose.ux : 580 - (doel.x - pose.ux), y: doel.y - pose.uy };
  const hx = L.hip[0] + OFF - C.x, hy = L.hip[1] - C.y;
  const c = Math.cos(rad(pose.p)), s = Math.sin(rad(pose.p));
  const hip = { x: hx * c - hy * s + C.x, y: hx * s + hy * c + C.y };
  const D = { x: P.x - hip.x, y: P.y - hip.y };
  const dRuw = Math.hypot(D.x, D.y);
  const d = Math.min(Math.max(dRuw, Math.abs(L.L1 - L.L2) + 0.5), L.L1 + L.L2 - 0.01);
  const aD = deg(Math.atan2(-D.x, D.y));
  const alfa = deg(Math.acos((L.L1 ** 2 + d ** 2 - L.L2 ** 2) / (2 * L.L1 * d)));
  const a1 = L.knie === 'voor' ? aD + alfa : aD - alfa;
  const knie = { x: hip.x + L.L1 * dir(a1).x, y: hip.y + L.L1 * dir(a1).y };
  const a2 = deg(Math.atan2(-(P.x - knie.x), P.y - knie.y));
  const wrap = (x) => ((((x + 180) % 360) + 360) % 360) - 180;
  return { dij: wrap(a1 - pose.p - L.rustD), scheen: wrap(a2 - a1 - L.rustS), te_ver: dRuw - (L.L1 + L.L2) };
}

function bak(naam, kijk, keys, voeten) {
  const STAPPEN = 48;
  const sporen = { pad: [], kantel: [] };
  for (const l of Object.keys(LEGS)) { sporen[`${l}-dij`] = []; sporen[`${l}-scheen`] = []; }
  let slechtste = { leg: '', t: 0, te_ver: -99 };

  for (let i = 0; i <= STAPPEN; i++) {
    const t = i / STAPPEN;
    const pct = +(t * 100).toFixed(2);
    const pose = lichaam(keys, t);
    sporen.pad.push(`${pct}% { --ux: ${pose.ux.toFixed(2)}px; --uy: ${pose.uy.toFixed(2)}px; }`);
    sporen.kantel.push(`${pct}% { --pitch: ${pose.p.toFixed(2)}deg; }`);
    for (const [l, [start, zw]] of Object.entries(voeten)) {
      const r = ik(l, voet(start, zw, t), pose, kijk);
      if (r.te_ver > slechtste.te_ver) slechtste = { leg: l, t, te_ver: r.te_ver };
      sporen[`${l}-dij`].push(`${pct}% { --dij: ${r.dij.toFixed(2)}deg; }`);
      sporen[`${l}-scheen`].push(`${pct}% { --scheen: ${r.scheen.toFixed(2)}deg; }`);
    }
  }
  console.error(`${naam}: grootste overreik ${slechtste.te_ver.toFixed(2)} (${slechtste.leg} op t=${slechtste.t.toFixed(3)})`);
  return Object.entries(sporen)
    .map(([k, regels]) => `@keyframes ${naam}-${k} {\n  ${regels.join('\n  ')}\n}`)
    .join('\n');
}

// ─── lopen zoals een kat: één poot tegelijk van de grond ───
// Elke voet staat 75% van de cyclus op de grond en zwaait 25%, in de laterale
// volgorde van een stappende kat: linksachter, linksvoor, rechtsachter, rechtsvoor.
// Zo staan er altijd drie poten neer. Het lijf loopt 4 eenheden lager dan in rust:
// een gestrekte poot kan niet voor- of achteruit zonder te schuiven.
const GROND = 165;          // middelpunt van een voet die op de grond staat
const LOOP_UY = GROND - 148; // lijfhoogte waarbij een voet in rust de grond raakt (17)...
const LOOP_ZAK = 4;          // ...en zo veel lager sluipt hij
const UY_LOOP = LOOP_UY + LOOP_ZAK;
const PAS = 36;              // afstand per cyclus
const A = PAS * 0.75;        // hoe ver een voet in het lijfkader heen en weer gaat
const ZWAAI_START = { an: 0, vn: 0.25, av: 0.5, vv: 0.75 };
const ZWAAI_HOOGTE = 7;

function loopVoet(l, fase, ux, uy, kijk) {
  const rust = rustVoet(l, 0, 0, 1);
  const q = (((fase - ZWAAI_START[l]) % 1) + 1) % 1;
  let x, y = GROND - UY_LOOP + (rust.y - 148); // hoogteverschil van de achterpoot in rust behouden
  if (q < 0.25) {
    const s = zacht(q / 0.25);
    x = rust.x + A / 2 - A * s;          // naar voren = naar links
    y -= ZWAAI_HOOGTE * Math.sin(Math.PI * s);
  } else {
    x = rust.x - A / 2 + A * ((q - 0.25) / 0.75);
  }
  return { x: (kijk === 1 ? x : 580 - x) + ux, y: y + uy };
}

function bakLoop() {
  const STAPPEN = 48;
  const sporen = {};
  for (const l of Object.keys(LEGS)) { sporen[`${l}-dij`] = []; sporen[`${l}-scheen`] = []; }
  let slechtste = -99;
  for (let i = 0; i <= STAPPEN; i++) {
    const t = i / STAPPEN, pct = +(t * 100).toFixed(2);
    const pose = { ux: 0, uy: UY_LOOP, p: 0 };
    for (const l of Object.keys(LEGS)) {
      const rr = ik(l, loopVoet(l, t, 0, UY_LOOP, 1), pose, 1);
      slechtste = Math.max(slechtste, rr.te_ver);
      sporen[`${l}-dij`].push(`${pct}% { --dij: ${rr.dij.toFixed(2)}deg; }`);
      sporen[`${l}-scheen`].push(`${pct}% { --scheen: ${rr.scheen.toFixed(2)}deg; }`);
    }
  }
  console.error(`loop: grootste overreik ${slechtste.toFixed(2)}`);
  return Object.entries(sporen).map(([k, rg]) => `@keyframes stap-${k} {\n  ${rg.join('\n  ')}\n}`).join('\n');
}

// ─── uit en in de mand stappen, pootje per pootje ───────────────────────────
// Een kleine stappenplanner. Hij kent de grond (bodem van de mand, de rand, de vloer),
// zet één poot tegelijk in de volgorde van een stappende kat, laat elke poot eerst op
// de rand landen voor hij eroverheen gaat, en kantelt het lijf mee met de hoogte onder
// de voor- en de achterpoten. De mand is laag, dus er is geen sprong nodig.
const BODEM = 148, RAND_Y = 124, VLOER = 165;
const RAND_VAN = 172, RAND_TOT = 194;          // de linkerrand van de mand, in x
const zone = (x) => (x >= RAND_TOT ? 'bodem' : x >= RAND_VAN ? 'rand' : 'vloer');
const hoogteVan = (z) => (z === 'bodem' ? BODEM : z === 'rand' ? RAND_Y : VLOER);
const VOLGORDE = ['an', 'vn', 'av', 'vv'];     // linksachter, linksvoor, rechtsachter, rechtsvoor: als de loopcyclus
const STAPPEN_N = 16;
const REIK = 18;                                // hoe ver voor de heup een poot neerkomt
const offset = (l) => rustVoet(l, 0, 0, 1).y - 148;
const HEUP_X = { vn: 92, vv: 104, av: 146, an: 158 };
const heupX = (l, ux, kijk) => ux + 290 + kijk * (HEUP_X[l] + OFF - 290);

function plan({ kijk, uxVan, uxTot, start, eind, crouch }) {
  const vooruit = kijk === 1 ? -1 : 1;
  const T0 = 0.06, T1 = 0.98, w = (T1 - T0) / STAPPEN_N;
  // gelijkmatig tempo, alleen aan begin en eind op gang komen en uitlopen
  const vordering = (t) => {
    const a = 0.03, b = 0.98, u = Math.min(1, Math.max(0, (t - a) / (b - a))), f = 0.14 / (b - a), v = 1 / (1 - f);
    if (u < f) return 0.5 * v * u * u / f;
    if (u < 1 - f) return 0.5 * v * f + v * (u - f);
    return 1 - 0.5 * v * (1 - u) * (1 - u) / f;
  };
  const ux = (t) => uxVan + (uxTot - uxVan) * vordering(t);
  const pos = {}; for (const l of VOLGORDE) pos[l] = { ...start[l] };
  const zwaaien = { vn: [], vv: [], av: [], an: [] };
  const log = [];
  const laatste = {}; VOLGORDE.forEach((l, i) => { laatste[l] = STAPPEN_N - 4 + i; });

  for (let k = 0; k < STAPPEN_N; k++) {
    const l = VOLGORDE[k % 4];
    const t0 = T0 + k * w, t1 = t0 + w;
    const van = pos[l];
    let doel;
    if (k === laatste[l]) {
      doel = { ...eind[l] };
    } else {
      let x = heupX(l, ux(t1), kijk) + vooruit * REIK;
      const nu = zone(van.x);
      if (kijk === 1) {                          // naar buiten, naar links
        if (nu === 'bodem' && x < RAND_TOT) x = Math.min(190, Math.max(174, x)); // eerst op de rand, waar hij hem nodig heeft
        else if (nu === 'rand') x = Math.min(x, 164);             // dan eroverheen
        else if (nu === 'bodem') x = Math.max(x, 198);
      } else {                                   // naar binnen, naar rechts
        if (nu === 'vloer' && x > RAND_VAN) x = Math.min(192, Math.max(176, x)); // eerst op de rand, waar hij hem nodig heeft
        else if (nu === 'rand') x = Math.max(x, 200);             // dan de mand in
        else if (nu === 'vloer') x = Math.min(x, 166);
      }
      doel = { x, y: hoogteVan(zone(x)) + offset(l) };
    }
    // over of op de rand: hoog genoeg optillen
    const overRand = zone(van.x) !== zone(doel.x) || zone(doel.x) === 'rand';
    const top = overRand ? Math.min(van.y, doel.y, RAND_Y) - 13 : Math.min(van.y, doel.y) - 7;
    const ctrl = { x: (van.x + doel.x) / 2, y: 2 * top - 0.5 * (van.y + doel.y) };
    zwaaien[l].push([t0, t1, doel, ctrl]);
    log.push(`${k.toString().padStart(2)} ${l} ${zone(van.x).padEnd(5)} -> ${zone(doel.x).padEnd(5)} x ${van.x.toFixed(0)} -> ${doel.x.toFixed(0)}`);
    pos[l] = doel;
  }

  // lijf: hoogte en kanteling volgen de grond onder voor- en achterpoten
  const steun = (l, t) => {
    let y = start[l].y;
    for (const [t0, t1, doel] of zwaaien[l]) {
      if (t < t0) break;
      const s = t >= t1 ? 1 : zacht((t - t0) / (t1 - t0));
      y = y + (doel.y - y) * s;
      if (t < t1) break;
    }
    return y - offset(l);
  };
  const lijf = (t) => {
    const c = crouch(t);
    // het lijf zakt tot de laagste poot de grond haalt; de poot op de rand plooit
    const sv = [steun('vn', t), steun('vv', t)], sa = [steun('av', t), steun('an', t)];
    const achter = Math.max((sa[0] + sa[1]) / 2 - 49 + c, Math.max(...sa) - 43);
    const voorVrij = Math.max((sv[0] + sv[1]) / 2 - 49.5 + c, Math.max(...sv) - 43);
    // Een kat steigert niet om op een rand te stappen: hij houdt zijn lijf vlak en
    // plooit de voorpoot op de rand diep. De kanteling blijft dus binnen 14 graden,
    // tenzij de laagste voorpoot de grond anders niet haalt.
    const MAX = 14;
    let p = Math.max(-MAX, Math.min(MAX, deg(Math.atan2(achter - voorVrij, 54))));
    let voor = achter - 54 * Math.tan(rad(p));
    if (voor < Math.max(...sv) - 43) { voor = Math.max(...sv) - 43; p = deg(Math.atan2(achter - voor, 54)); }
    const midden = (voor + achter) / 2;
    const uy = midden - 82 - (Math.sin(rad(p)) * -5 + Math.cos(rad(p)) * 17);
    return { ux: ux(t), uy, p };
  };
  const voeten = {}; for (const l of VOLGORDE) voeten[l] = [start[l], zwaaien[l]];
  return { lijf, voeten, log };
}

function bakPlan(naam, kijk, pl) {
  const STAPPEN = 96;
  const sporen = { pad: [], kantel: [] };
  for (const l of Object.keys(LEGS)) { sporen[`${l}-dij`] = []; sporen[`${l}-scheen`] = []; }
  let slechtste = { leg: '', t: 0, te_ver: -99 };
  for (let i = 0; i <= STAPPEN; i++) {
    const t = i / STAPPEN, pct = +(t * 100).toFixed(3);
    const pose = pl.lijf(t);
    sporen.pad.push(`${pct}% { --ux: ${pose.ux.toFixed(2)}px; --uy: ${pose.uy.toFixed(2)}px; }`);
    sporen.kantel.push(`${pct}% { --pitch: ${pose.p.toFixed(2)}deg; }`);
    for (const [l, [st, zw]] of Object.entries(pl.voeten)) {
      const r = ik(l, voet(st, zw, t), pose, kijk);
      if (r.te_ver > slechtste.te_ver) slechtste = { leg: l, t, te_ver: r.te_ver };
      sporen[`${l}-dij`].push(`${pct}% { --dij: ${r.dij.toFixed(2)}deg; }`);
      sporen[`${l}-scheen`].push(`${pct}% { --scheen: ${r.scheen.toFixed(2)}deg; }`);
    }
  }
  console.error(`${naam}: grootste overreik ${slechtste.te_ver.toFixed(2)} (${slechtste.leg} op t=${slechtste.t.toFixed(3)})`);
  return Object.entries(sporen).map(([k, rg]) => `@keyframes ${naam}-${k} {\n  ${rg.join('\n  ')}\n}`).join('\n');
}

const alle = (f) => Object.fromEntries(VOLGORDE.map((l) => [l, f(l)]));
const UIT_PLAN = plan({
  kijk: 1, uxVan: 0, uxTot: -175,
  start: alle((l) => rustVoet(l, 0, 0, 1)),
  eind: alle((l) => loopVoet(l, 0, -175, 21, 1)),
  crouch: (t) => (t < 0.9 ? 6 * zacht(Math.min(1, t / 0.06)) : 4 + 2 * (1 - zacht((t - 0.9) / 0.1))),
});
const IN_PLAN = plan({
  kijk: -1, uxVan: -175, uxTot: 0,
  start: alle((l) => loopVoet(l, 0, -175, 21, -1)),
  eind: alle((l) => rustVoet(l, 0, 0, -1)),
  crouch: (t) => (t < 0.88 ? 4 + 2 * zacht(Math.min(1, t / 0.06)) : 6 * (1 - zacht((t - 0.88) / 0.12))),
});

if (process.argv.includes('--log')) {
  console.error('── uit ──\n' + UIT_PLAN.log.join('\n'));
  console.error('── in ──\n' + IN_PLAN.log.join('\n'));
}
console.log(bakLoop());
console.log(bakPlan('uit', 1, UIT_PLAN));
console.log(bakPlan('in', -1, IN_PLAN));

if (process.argv.includes('--diag')) {
  for (const [naam, kijk, pl] of [['uit', 1, UIT_PLAN], ['in', -1, IN_PLAN]]) {
    for (const [l, [st, zw]] of Object.entries(pl.voeten)) {
      const fout = [];
      for (let i = 0; i <= 200; i++) {
        const t = i / 200, r = ik(l, voet(st, zw, t), pl.lijf(t), kijk);
        if (r.te_ver > 1) fout.push(t.toFixed(3) + ':' + r.te_ver.toFixed(0));
      }
      console.error(naam, l, fout.length ? fout.join(' ') : 'ok');
    }
  }
}
