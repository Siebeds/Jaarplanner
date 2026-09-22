/**
 * Chuck's steps, baked into CSS keyframes (FB-071, ADR-0064): the walk, stepping out of the basket and stepping back
 * in. Per moment it says where the body is and where each paw is planted or swinging to; two-bone inverse kinematics
 * turns that into a thigh and a shin angle per leg.
 *
 * `pnpm kat:keyframes` writes the result to `chuck-keyframes.css`, and `choreografie.test.ts` fails when that file
 * is stale, so the CSS is never edited by hand. The rules a cat keeps are tested on the plan itself, not on the
 * picture: one paw in the air at a time, every paw on the rim before it crosses, no leg stretched past its length.
 *
 * Scene coordinates (400 by 176, y down); the cat drawing is offset {@link KAT_X}. Only erasable TypeScript and a
 * relative import with its extension, so Node runs it directly.
 */
import { BENEN, BUITEN_UX, GROND, KAT_X, LIJF, LOOP_UY, PAS, RAND, type Poot } from "./rig.ts";

export type Punt = { x: number; y: number };
export type Pose = { ux: number; uy: number; p: number };
/** 1: facing left, as he is drawn. -1: turned round, facing right. */
export type Kijk = 1 | -1;

/** A paw swinging from where it stands to `naar` between t0 and t1, along a curve through `ctrl`. */
export type Zwaai = { t0: number; t1: number; naar: Punt; ctrl: Punt };

export type Zone = "bodem" | "rand" | "vloer";

export type Plan = {
  kijk: Kijk;
  lijf: (t: number) => Pose;
  start: Record<Poot, Punt>;
  zwaaien: Record<Poot, Zwaai[]>;
};

export const POTEN: readonly Poot[] = ["an", "vn", "av", "vv"];

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const richting = (a: number): Punt => ({ x: -Math.sin(rad(a)), y: Math.cos(rad(a)) });
const zacht = (s: number) => s * s * (3 - 2 * s);
/** Mirrors a scene x about the body centre, for a cat turned round. */
const spiegel = (x: number) => 2 * LIJF.x - x;

/** Where a paw rests when every joint is at its rest angle, for a body pose. */
export function rustVoet(poot: Poot, ux: number, uy: number, kijk: Kijk): Punt {
  const b = BENEN[poot];
  const heup = { x: b.heup[0] + KAT_X, y: b.heup[1] };
  const knie = { x: heup.x + b.dij * richting(b.rustDij).x, y: heup.y + b.dij * richting(b.rustDij).y };
  const a = b.rustDij + b.rustScheen;
  const voet = { x: knie.x + b.scheen * richting(a).x, y: knie.y + b.scheen * richting(a).y };
  return { x: (kijk === 1 ? voet.x : spiegel(voet.x)) + ux, y: voet.y + uy };
}

export type Hoeken = {
  /** The thigh's animated angle, on top of its rest angle. */
  dij: number;
  /** The shin's animated angle, on top of its rest angle. */
  scheen: number;
  /** How far the paw is beyond what the leg can reach; negative while it reaches. */
  teVer: number;
};

/** Thigh and shin angles that put the paw of `poot` on `doel`, for a body in `pose`. */
export function ik(poot: Poot, doel: Punt, pose: Pose, kijk: Kijk): Hoeken {
  const b = BENEN[poot];
  const P = { x: kijk === 1 ? doel.x - pose.ux : spiegel(doel.x - pose.ux), y: doel.y - pose.uy };
  const hx = b.heup[0] + KAT_X - LIJF.x;
  const hy = b.heup[1] - LIJF.y;
  const c = Math.cos(rad(pose.p));
  const s = Math.sin(rad(pose.p));
  const heup = { x: hx * c - hy * s + LIJF.x, y: hx * s + hy * c + LIJF.y };
  const D = { x: P.x - heup.x, y: P.y - heup.y };
  const ruw = Math.hypot(D.x, D.y);
  const d = Math.min(Math.max(ruw, Math.abs(b.dij - b.scheen) + 0.5), b.dij + b.scheen - 0.01);
  const aD = deg(Math.atan2(-D.x, D.y));
  const alfa = deg(Math.acos((b.dij ** 2 + d ** 2 - b.scheen ** 2) / (2 * b.dij * d)));
  // Every joint bends backward (rig.ts), so the knee is on the minus side of the hip-to-paw line.
  const a1 = aD - alfa;
  const knie = { x: heup.x + b.dij * richting(a1).x, y: heup.y + b.dij * richting(a1).y };
  const a2 = deg(Math.atan2(-(P.x - knie.x), P.y - knie.y));
  const wikkel = (x: number) => ((((x + 180) % 360) + 360) % 360) - 180;
  return { dij: wikkel(a1 - pose.p - b.rustDij), scheen: wikkel(a2 - a1 - b.rustScheen), teVer: ruw - (b.dij + b.scheen) };
}

/** Where the paw of `poot` is drawn, in the scene, for these angles: the inverse of {@link ik}. */
export function waarDeVoetStaat(poot: Poot, hoeken: { dij: number; scheen: number }, pose: Pose, kijk: Kijk): Punt {
  const b = BENEN[poot];
  const hx = b.heup[0] + KAT_X - LIJF.x;
  const hy = b.heup[1] - LIJF.y;
  const c = Math.cos(rad(pose.p));
  const s = Math.sin(rad(pose.p));
  const heup = { x: hx * c - hy * s + LIJF.x, y: hx * s + hy * c + LIJF.y };
  const a1 = hoeken.dij + pose.p + b.rustDij;
  const a2 = a1 + hoeken.scheen + b.rustScheen;
  const x = heup.x + b.dij * richting(a1).x + b.scheen * richting(a2).x;
  const y = heup.y + b.dij * richting(a1).y + b.scheen * richting(a2).y;
  return { x: (kijk === 1 ? x : spiegel(x)) + pose.ux, y: y + pose.uy };
}

// ─── walking like a cat: one paw off the ground at a time ────────────────────
// Each paw is down 75% of the cycle and swings 25%, in the lateral sequence of a walking cat: left hind, left fore,
// right hind, right fore. So three paws are always down. The body walks lower than at rest, because a straight leg
// cannot move forward or back without sliding.

const A = PAS * 0.75;
const ZWAAI_START: Record<Poot, number> = { an: 0, vn: 0.25, av: 0.5, vv: 0.75 };
const ZWAAI_HOOGTE = 7;
/** How much of a cycle each paw spends in the air. */
export const IN_DE_LUCHT = 0.25;

/** Where a paw is at phase `fase` of the walk cycle, in the scene, for a body at `ux` that is not moving. */
export function loopVoet(poot: Poot, fase: number, ux: number, kijk: Kijk): Punt {
  const rust = rustVoet(poot, 0, 0, 1);
  const q = (((fase - ZWAAI_START[poot]) % 1) + 1) % 1;
  // A hind paw at rest stands a little higher than a fore paw; the walk keeps that difference.
  let y = GROND.vloer - LOOP_UY + (rust.y - GROND.bodem);
  let x: number;
  if (q < IN_DE_LUCHT) {
    const s = zacht(q / IN_DE_LUCHT);
    x = rust.x + A / 2 - A * s;
    y -= ZWAAI_HOOGTE * Math.sin(Math.PI * s);
  } else {
    x = rust.x - A / 2 + A * ((q - IN_DE_LUCHT) / (1 - IN_DE_LUCHT));
  }
  return { x: (kijk === 1 ? x : spiegel(x)) + ux, y: y + LOOP_UY };
}

/** Whether a paw is on the ground at phase `fase` of the walk cycle. */
export function staatNeerInLoop(poot: Poot, fase: number): boolean {
  const q = (((fase - ZWAAI_START[poot]) % 1) + 1) % 1;
  return q >= IN_DE_LUCHT;
}

// ─── stepping out of the basket and back in, paw by paw ─────────────────────
// A small step planner. It knows the ground (the basket floor, the rim, the floor beside it), moves one paw at a time
// in a walking cat's order, lands every paw on the rim before it crosses, and tilts the body with the height under
// the fore and hind paws. The basket is low, so no jump is needed.

export function zone(x: number): Zone {
  return x >= RAND.tot ? "bodem" : x >= RAND.van ? "rand" : "vloer";
}
const hoogteVan = (z: Zone) => GROND[z];
const STAPPEN = 16;
/** How far ahead of the hip a paw lands. */
const REIK = 18;
const verschil = (poot: Poot) => rustVoet(poot, 0, 0, 1).y - GROND.bodem;
const heupX = (poot: Poot, ux: number, kijk: Kijk) => ux + LIJF.x + kijk * (BENEN[poot].heup[0] + KAT_X - LIJF.x);
/** The window of the steps within the move: a moment to set off, and one to settle. */
const T0 = 0.06;
const T1 = 0.98;
/** How close above its highest paw the rear may sink when the hind legs fold deep. */
const HIND_GEPLOOID = 20;

type Opdracht = {
  kijk: Kijk;
  uxVan: number;
  uxTot: number;
  start: Record<Poot, Punt>;
  eind: Record<Poot, Punt>;
  crouch: (t: number) => number;
  /** The body height the move starts from and ends on, so it joins what comes before and after without a jump. */
  uyVan: number;
  uyTot: number;
};

/** When step `k` swings: the steps follow each other without overlap, so one paw is in the air at a time. */
export function stapvenster(k: number): [number, number] {
  const w = (T1 - T0) / STAPPEN;
  return [T0 + k * w, T0 + (k + 1) * w];
}

function plan({ kijk, uxVan, uxTot, start, eind, crouch, uyVan, uyTot }: Opdracht): Plan {
  const vooruit = kijk === 1 ? -1 : 1;
  // An even pace, speeding up only at the start and slowing only at the end.
  const vordering = (t: number) => {
    const a = 0.03;
    const b = 0.98;
    const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
    const f = 0.14 / (b - a);
    const v = 1 / (1 - f);
    if (u < f) return (0.5 * v * u * u) / f;
    if (u < 1 - f) return 0.5 * v * f + v * (u - f);
    return 1 - (0.5 * v * (1 - u) * (1 - u)) / f;
  };
  const ux = (t: number) => uxVan + (uxTot - uxVan) * vordering(t);
  const pos = Object.fromEntries(POTEN.map((p) => [p, { ...start[p] }])) as Record<Poot, Punt>;
  const zwaaien: Record<Poot, Zwaai[]> = { vn: [], vv: [], av: [], an: [] };
  const laatste = Object.fromEntries(POTEN.map((p, i) => [p, STAPPEN - 4 + i])) as Record<Poot, number>;

  for (let k = 0; k < STAPPEN; k++) {
    const poot = POTEN[k % 4];
    const [t0, t1] = stapvenster(k);
    const van = pos[poot];
    const nu = zone(van.x);
    let doel: Punt;
    if (k === laatste[poot]) {
      doel = { ...eind[poot] };
    } else {
      let x = heupX(poot, ux(t1), kijk) + vooruit * REIK;
      // The paw's next step is its last. If that would cross the rim in one go (basket floor to floor, or back),
      // this step puts it on the rim first: its last step then crosses from there.
      const voorLaatste = k + 4 === laatste[poot] && zone(eind[poot].x) !== nu && zone(eind[poot].x) !== "rand";
      if (kijk === 1) {
        // Out, to the left: first onto the rim, where he needs it, then over it.
        if (nu === "bodem" && (x < RAND.tot || voorLaatste)) x = Math.min(190, Math.max(174, x));
        else if (nu === "rand") x = Math.min(x, 164);
        else if (nu === "bodem") x = Math.max(x, 198);
      } else {
        // In, to the right: first onto the rim, then into the basket.
        if (nu === "vloer" && (x > RAND.van || voorLaatste)) x = Math.min(192, Math.max(176, x));
        else if (nu === "rand") x = Math.max(x, 200);
        else if (nu === "vloer") x = Math.min(x, 166);
      }
      doel = { x, y: hoogteVan(zone(x)) + verschil(poot) };
    }
    // Over or onto the rim: lift it high enough.
    const overRand = zone(van.x) !== zone(doel.x) || zone(doel.x) === "rand";
    const top = overRand ? Math.min(van.y, doel.y, GROND.rand) - 13 : Math.min(van.y, doel.y) - 7;
    const ctrl = { x: (van.x + doel.x) / 2, y: 2 * top - 0.5 * (van.y + doel.y) };
    zwaaien[poot].push({ t0, t1, naar: doel, ctrl });
    pos[poot] = doel;
  }

  // The body: height and tilt follow the ground under the fore and hind paws.
  const steun = (poot: Poot, t: number) => {
    let y = start[poot].y;
    for (const { t0, t1, naar } of zwaaien[poot]) {
      if (t < t0) break;
      const s = t >= t1 ? 1 : zacht((t - t0) / (t1 - t0));
      y = y + (naar.y - y) * s;
      if (t < t1) break;
    }
    return y - verschil(poot);
  };
  const ruwLijf = (t: number): Pose => {
    const c = crouch(t);
    // The body sinks until the lowest paw reaches the ground; the paw on the rim folds.
    const sv = [steun("vn", t), steun("vv", t)];
    const sa = [steun("av", t), steun("an", t)];
    const MAX = 14;
    const voorVrij = Math.max((sv[0] + sv[1]) / 2 - 49.5 + c, Math.max(...sv) - 43);
    let achter = Math.max((sa[0] + sa[1]) / 2 - 49 + c, Math.max(...sa) - 43);
    // With both hind paws on the rim and a fore paw going down to the floor, the rear would hold the body too high for
    // the fore leg to reach. A cat folds its hind legs then: the rear sinks towards the rim, as far as a folded hind
    // leg allows, so the tilt the fore paw needs stays small.
    const achterGeplooid = Math.min(...sa) - HIND_GEPLOOID;
    if (voorVrij - achter > 54 * Math.tan(rad(MAX))) {
      achter = Math.max(achter, Math.min(voorVrij - 54 * Math.tan(rad(MAX)), achterGeplooid));
    }
    // A cat does not rear to step onto a rim: it keeps its body level and folds the fore paw on the rim deep. So the
    // tilt stays within 14 degrees, unless the lowest fore paw would otherwise not reach the ground.
    let p = Math.max(-MAX, Math.min(MAX, deg(Math.atan2(achter - voorVrij, 54))));
    let voor = achter - 54 * Math.tan(rad(p));
    if (voor < Math.max(...sv) - 43) {
      voor = Math.max(...sv) - 43;
      p = deg(Math.atan2(achter - voor, 54));
    }
    const midden = (voor + achter) / 2;
    const uy = midden - LIJF.y - (Math.sin(rad(p)) * -5 + Math.cos(rad(p)) * 17);
    return { ux: ux(t), uy, p };
  };

  // The rules above put the body a few units off the pose before and after the move. It glides there over the first
  // and last stretch, while all four paws are still down, so standing up flows into stepping out and stepping out
  // into the walk, without a jump.
  const RAND_T = 0.08;
  const beginFout = uyVan - ruwLijf(0).uy;
  const eindFout = uyTot - ruwLijf(1).uy;
  const lijf = (t: number): Pose => {
    const pose = ruwLijf(t);
    const bij =
      (t < RAND_T ? beginFout * (1 - zacht(t / RAND_T)) : 0) +
      (t > 1 - RAND_T ? eindFout * zacht((t - (1 - RAND_T)) / RAND_T) : 0);
    return { ...pose, uy: pose.uy + bij };
  };

  return { kijk, lijf, start, zwaaien };
}

/** Where a paw is at moment `t` of a plan, and whether it is on the ground. */
export function voetOp(p: Plan, poot: Poot, t: number): { punt: Punt; neer: boolean } {
  let punt = p.start[poot];
  for (const { t0, t1, naar, ctrl } of p.zwaaien[poot]) {
    if (t < t0) return { punt, neer: true };
    if (t < t1) {
      const s = zacht((t - t0) / (t1 - t0));
      const u = 1 - s;
      return {
        punt: {
          x: u * u * punt.x + 2 * u * s * ctrl.x + s * s * naar.x,
          y: u * u * punt.y + 2 * u * s * ctrl.y + s * s * naar.y,
        },
        neer: false,
      };
    }
    punt = naar;
  }
  return { punt, neer: true };
}

const alle = (f: (p: Poot) => Punt) => Object.fromEntries(POTEN.map((p) => [p, f(p)])) as Record<Poot, Punt>;

/** Standing up in the basket, then out over the left rim, ending in the walk's first frame beside it. */
export const UIT: Plan = plan({
  kijk: 1,
  uxVan: 0,
  uxTot: BUITEN_UX,
  start: alle((p) => rustVoet(p, 0, 0, 1)),
  eind: alle((p) => loopVoet(p, 0, BUITEN_UX, 1)),
  uyVan: 0,
  uyTot: LOOP_UY,
  crouch: (t) => (t < 0.9 ? 6 * zacht(Math.min(1, t / 0.06)) : 4 + 2 * (1 - zacht((t - 0.9) / 0.1))),
});

/** Turned round beside the basket, back over the rim, ending at rest in the basket. */
export const IN: Plan = plan({
  kijk: -1,
  uxVan: BUITEN_UX,
  uxTot: 0,
  start: alle((p) => loopVoet(p, 0, BUITEN_UX, -1)),
  eind: alle((p) => rustVoet(p, 0, 0, -1)),
  uyVan: LOOP_UY,
  uyTot: 0,
  crouch: (t) => (t < 0.88 ? 4 + 2 * zacht(Math.min(1, t / 0.06)) : 6 * (1 - zacht((t - 0.88) / 0.12))),
});

// ─── baking ─────────────────────────────────────────────────────────────────

const pct = (t: number, cijfers: number) => `${+(t * 100).toFixed(cijfers)}%`;

function blokken(naam: string, sporen: Record<string, string[]>): string {
  return Object.entries(sporen)
    .map(([k, regels]) => `@keyframes ${naam}-${k} {\n  ${regels.join("\n  ")}\n}`)
    .join("\n");
}

function lege(metLijf: boolean): Record<string, string[]> {
  const sporen: Record<string, string[]> = metLijf ? { pad: [], kantel: [] } : {};
  for (const p of Object.keys(BENEN)) {
    sporen[`${p}-dij`] = [];
    sporen[`${p}-scheen`] = [];
  }
  return sporen;
}

function bakLoop(): string {
  const N = 48;
  const sporen = lege(false);
  const pose = { ux: 0, uy: LOOP_UY, p: 0 };
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    for (const p of Object.keys(BENEN) as Poot[]) {
      const h = ik(p, loopVoet(p, t, 0, 1), pose, 1);
      sporen[`${p}-dij`].push(`${pct(t, 2)} { --dij: ${h.dij.toFixed(2)}deg; }`);
      sporen[`${p}-scheen`].push(`${pct(t, 2)} { --scheen: ${h.scheen.toFixed(2)}deg; }`);
    }
  }
  return blokken("chuck-stap", sporen);
}

function bakPlan(naam: string, pl: Plan): string {
  const N = 96;
  const sporen = lege(true);
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const pose = pl.lijf(t);
    sporen.pad.push(`${pct(t, 3)} { --ux: ${pose.ux.toFixed(2)}px; --uy: ${pose.uy.toFixed(2)}px; }`);
    sporen.kantel.push(`${pct(t, 3)} { --pitch: ${pose.p.toFixed(2)}deg; }`);
    for (const p of Object.keys(BENEN) as Poot[]) {
      const h = ik(p, voetOp(pl, p, t).punt, pose, pl.kijk);
      sporen[`${p}-dij`].push(`${pct(t, 3)} { --dij: ${h.dij.toFixed(2)}deg; }`);
      sporen[`${p}-scheen`].push(`${pct(t, 3)} { --scheen: ${h.scheen.toFixed(2)}deg; }`);
    }
  }
  return blokken(naam, sporen);
}

/** The whole generated stylesheet: the walk cycle, stepping out and stepping in. */
export function bakKeyframes(): string {
  return [
    "/* Generated by src/features/kat/choreografie.ts (pnpm kat:keyframes). Do not edit by hand. */",
    bakLoop(),
    bakPlan("chuck-uit", UIT),
    bakPlan("chuck-in", IN),
    "",
  ].join("\n");
}
