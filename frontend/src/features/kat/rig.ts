/**
 * Chuck's rig: the one place the drawing's joints, bone lengths and rest angles are written down (FB-071, ADR-0065).
 * The drawing (`Katmand.tsx`) and the choreography that bakes his steps (`choreografie.ts`) both read it, so a leg
 * cannot be drawn in one place and planned in another.
 *
 * Coordinates are SVG user units, y pointing down. The cat is drawn in a 240 by 176 space; in the basket scene
 * (400 by 176) that drawing is shifted right by {@link KAT_X}. It must stay free of imports: the keyframe script runs
 * this file directly under Node.
 */

/** How far right the cat drawing sits in the basket scene. */
export const KAT_X = 160;

/** The scene's size. */
export const SCENE = { breedte: 400, hoogte: 176 } as const;

/** The standing cat's body centre in the scene: what he turns and tilts about. */
export const LIJF = { x: 290, y: 82 } as const;

export type Poot = "vn" | "vv" | "av" | "an";

export type Been = {
  /** The hip, in the 240 space. */
  heup: readonly [number, number];
  /** Hip to knee. */
  dij: number;
  /** Knee to the centre of the paw. */
  scheen: number;
  /** The thigh's angle at rest, from straight down; positive turns towards the tail. */
  rustDij: number;
  /** The shin's angle at rest, relative to the thigh. */
  rustScheen: number;
};

/**
 * The four legs: near fore, far fore, far hind, near hind. Every joint bends backward: a cat's front leg folds at the
 * elbow, never forward like a horse's knee.
 */
export const BENEN: Record<Poot, Been> = {
  vn: { heup: [92, 98], dij: 26, scheen: 24, rustDij: 0, rustScheen: 0 },
  vv: { heup: [104, 100], dij: 26, scheen: 23, rustDij: 0, rustScheen: 0 },
  av: { heup: [146, 100], dij: 26, scheen: 23, rustDij: -19, rustScheen: 28 },
  an: { heup: [158, 98], dij: 26, scheen: 24, rustDij: -19, rustScheen: 28 },
};

/**
 * The knee in the drawing's own coordinates: where the shin turns. Every leg is drawn hanging straight down and gets
 * its rest angle by rotation about the hip, so the knee is straight below the hip.
 */
export function knie(poot: Poot): [number, number] {
  const b = BENEN[poot];
  return [b.heup[0], b.heup[1] + b.dij];
}

/** Where a paw's centre stands, in the scene, on each surface. */
export const GROND = {
  /** The floor of the basket. */
  bodem: 148,
  /** The top of the basket's left rim. */
  rand: 124,
  /** The floor beside the basket. */
  vloer: 165,
} as const;

/** The left rim of the basket, in scene x: a paw between these two stands on it. */
export const RAND = { van: 172, tot: 194 } as const;

/** How low he walks on the floor: the floor height above the basket floor (17) plus a crouch of 4. */
export const LOOP_UY = GROND.vloer - GROND.bodem + 4;

/** How far one walk cycle takes him, in scene units. */
export const PAS = 36;

/** Where he stands after stepping out: this far left of where he stood in the basket. */
export const BUITEN_UX = -175;

/** The durations of each moment, in ms (design handoff, "Motion"). */
export const DUUR = {
  opstaan: 220,
  uitstappen: 2600,
  lopen: 900,
  omdraaien: 240,
  instappen: 2600,
  gaanLiggen: 200,
  vensterOpent: 300,
} as const;
