import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  IN,
  POTEN,
  UIT,
  bakKeyframes,
  ik,
  loopVoet,
  staatNeerInLoop,
  voetOp,
  waarDeVoetStaat,
  zone,
  type Plan,
} from "./choreografie";
import { BUITEN_UX, LOOP_UY, PAS } from "./rig";

/** Samples per move: fine enough that a swing of 1/16 of the move holds dozens of them. */
const N = 2000;
const momenten = (n = N) => Array.from({ length: n + 1 }, (_, i) => i / n);

/** How far a leg may be stretched past its length before it reads as a rubber leg (design handoff). */
const MAX_OVERREIK = 3;

describe("stepping out and in, paw by paw", () => {
  const plannen: [string, Plan][] = [
    ["uit", UIT],
    ["in", IN],
  ];

  it.each(plannen)("%s: never more than one paw is in the air at a time", (_, plan) => {
    for (const t of momenten()) {
      const inDeLucht = POTEN.filter((p) => !voetOp(plan, p, t).neer);
      expect(inDeLucht.length, `t=${t}`).toBeLessThanOrEqual(1);
    }
  });

  it.each(plannen)("%s: every paw lands on the rim once before it crosses", (_, plan) => {
    for (const p of POTEN) {
      const landingen = plan.zwaaien[p].map((z) => zone(z.naar.x));
      const naRand = landingen.filter((z) => z === "rand");
      expect(naRand, `${p}: ${landingen.join(" → ")}`).toHaveLength(1);

      // And it never goes from the basket floor to the floor, or back, in one step.
      let van = zone(plan.start[p].x);
      for (const naar of landingen) {
        expect(new Set([van, naar]), `${p}: ${landingen.join(" → ")}`).not.toEqual(new Set(["bodem", "vloer"]));
        van = naar;
      }
    }
  });

  it.each(plannen)("%s: a planted paw is drawn where it stands, so it does not slide", (_, plan) => {
    // What the browser draws: the baked angles run forward through the rig. A leg that cannot fold or stretch far
    // enough would put the paw somewhere else than the plan says, and that is what a sliding foot is.
    for (const t of momenten()) {
      const pose = plan.lijf(t);
      for (const p of POTEN) {
        const { punt, neer } = voetOp(plan, p, t);
        if (!neer) continue;
        const getekend = waarDeVoetStaat(p, ik(p, punt, pose, plan.kijk), pose, plan.kijk);
        expect(Math.hypot(getekend.x - punt.x, getekend.y - punt.y), `${p} t=${t}`).toBeLessThan(MAX_OVERREIK);
      }
    }
  });

  it.each(plannen)("%s: no leg is stretched more than 3 units past its length", (_, plan) => {
    let slechtste = { teVer: -Infinity, p: "", t: 0 };
    for (const t of momenten()) {
      const pose = plan.lijf(t);
      for (const p of POTEN) {
        const { teVer } = ik(p, voetOp(plan, p, t).punt, pose, plan.kijk);
        if (teVer > slechtste.teVer) slechtste = { teVer, p, t };
      }
    }
    expect(slechtste.teVer, `${slechtste.p} at t=${slechtste.t.toFixed(4)}`).toBeLessThanOrEqual(MAX_OVERREIK);
  });

  it("stepping out ends where the walk begins, and stepping in starts there", () => {
    for (const p of POTEN) {
      expect(voetOp(UIT, p, 1).punt).toEqual(loopVoet(p, 0, BUITEN_UX, 1));
      expect(voetOp(IN, p, 0).punt).toEqual(loopVoet(p, 0, BUITEN_UX, -1));
    }
    // The body joins standing up, the walk and lying down without a jump.
    expect(UIT.lijf(0)).toEqual({ ux: 0, uy: 0, p: 0 });
    expect(UIT.lijf(1)).toEqual({ ux: BUITEN_UX, uy: LOOP_UY, p: 0 });
    expect(IN.lijf(0)).toEqual({ ux: BUITEN_UX, uy: LOOP_UY, p: 0 });
    expect(IN.lijf(1)).toEqual({ ux: 0, uy: 0, p: 0 });
  });
});

describe("the walk", () => {
  it("keeps three paws on the ground at every moment", () => {
    for (const fase of momenten(960)) {
      const neer = POTEN.filter((p) => staatNeerInLoop(p, fase));
      expect(neer.length, `fase=${fase}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("lets a planted paw stand still in the world while the body glides one pas per cycle", () => {
    // The body moves PAS to the left per cycle (--stap-x in CSS); a planted paw moves PAS to the right in the body's
    // frame over the same time, so in the world it does not move.
    const inDeWereld = (p: (typeof POTEN)[number], fase: number) => loopVoet(p, fase, 0, 1).x - PAS * fase;
    const stap = 1e-3;
    for (const p of POTEN) {
      for (const fase of momenten(480)) {
        if (!staatNeerInLoop(p, fase) || !staatNeerInLoop(p, fase + stap)) continue;
        expect(Math.abs(inDeWereld(p, fase + stap) - inDeWereld(p, fase)), `${p} fase=${fase}`).toBeLessThan(1e-9);
      }
    }
  });

  it("draws every paw where the cycle puts it", () => {
    const pose = { ux: 0, uy: LOOP_UY, p: 0 };
    for (const fase of momenten(480)) {
      for (const p of POTEN) {
        const doel = loopVoet(p, fase, 0, 1);
        const getekend = waarDeVoetStaat(p, ik(p, doel, pose, 1), pose, 1);
        expect(Math.hypot(getekend.x - doel.x, getekend.y - doel.y), `${p} fase=${fase}`).toBeLessThan(1e-6);
      }
    }
  });
});

describe("the generated keyframes", () => {
  it("are what the choreography bakes today (run `pnpm kat:keyframes` after a change)", () => {
    const pad = join(process.cwd(), "src/features/kat/chuck-keyframes.css");
    const opgeslagen = readFileSync(pad, "utf8").replace(/\r\n/g, "\n");
    expect(opgeslagen === bakKeyframes(), "chuck-keyframes.css is stale: run `pnpm kat:keyframes`").toBe(true);
  });
});
