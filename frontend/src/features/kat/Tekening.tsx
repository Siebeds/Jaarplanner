import { forwardRef, useId, type CSSProperties } from "react";
import { cn } from "../../lib/cn";
import { BENEN, KAT_X, SCENE, knie, type Poot } from "./rig";
import "./chuck-keyframes.css";
import "./chuck.css";

/**
 * Chuck's two drawings, lying and standing, and the basket scene that holds both (FB-071, ADR-0065).
 *
 * **Inline, never `<symbol>` + `<use>`.** CSS cannot reach into a `<use>` shadow tree, so the leg rules would do
 * nothing and he would slide like a board. Every instance is a real copy of the drawing.
 *
 * Every piece is decorative (`aria-hidden`): what he means is always said in words beside him.
 */

const VACHT = "var(--color-vacht)";
const DIEP = "var(--color-vacht-diep)";
const LICHT = "var(--color-vacht-licht)";

/** A clip-path id per instance: `useId` gives colons, which `url(#...)` does not take. */
function useSvgId(naam: string) {
  return `${naam}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/** The curled-up cat, in its 240 by 176 space. */
function LiggendeVorm() {
  const lijf = useSvgId("chuck-lijf");
  return (
    <g>
      <defs>
        <clipPath id={lijf}>
          <ellipse cx="134" cy="100" rx="80" ry="46" />
        </clipPath>
      </defs>
      <g className="c-adem">
        <ellipse cx="134" cy="100" rx="80" ry="46" fill={VACHT} />
        <g clipPath={`url(#${lijf})`} opacity=".92">
          <path d="M112 54 q17 19 12 40" fill="none" stroke={DIEP} strokeWidth="9" strokeLinecap="round" />
          <path d="M146 52 q18 19 13 42" fill="none" stroke={DIEP} strokeWidth="9" strokeLinecap="round" />
          <path d="M180 58 q17 18 12 38" fill="none" stroke={DIEP} strokeWidth="9" strokeLinecap="round" />
        </g>

        {/* The tail lies over the flank, not round the body, so it stays inside the basket. A darker, wider strand
            under each strand is what makes a tail the colour of the body readable on the body. */}
        <g className="staart-liggend">
          <path d="M198 88 C222 98 220 122 196 130" fill="none" stroke={DIEP} strokeWidth="20" strokeLinecap="round" opacity=".32" />
          <path d="M198 88 C222 98 220 122 196 130" fill="none" stroke={VACHT} strokeWidth="16" strokeLinecap="round" />
          <g className="staart-liggend-punt">
            <path d="M196 130 C170 136 138 133 118 125" fill="none" stroke={DIEP} strokeWidth="18" strokeLinecap="round" opacity=".32" />
            <path d="M196 130 C170 136 138 133 118 125" fill="none" stroke={VACHT} strokeWidth="14" strokeLinecap="round" />
          </g>
        </g>

        <ellipse cx="96" cy="132" rx="24" ry="12" fill={LICHT} />

        <g>
          <path className="oor-l" d="M30 64 L26 22 L58 48 Z" fill={VACHT} stroke={VACHT} strokeWidth="7" strokeLinejoin="round" />
          <path className="oor-l" d="M35 58 L32 34 L51 47 Z" fill={LICHT} stroke={LICHT} strokeWidth="3" strokeLinejoin="round" />
          <path className="oor-r" d="M68 46 L100 26 L94 68 Z" fill={VACHT} stroke={VACHT} strokeWidth="7" strokeLinejoin="round" />
          <path className="oor-r" d="M73 50 L93 37 L89 61 Z" fill={LICHT} stroke={LICHT} strokeWidth="3" strokeLinejoin="round" />
          <circle cx="62" cy="84" r="36" fill={VACHT} />
          {/* The M of a tabby. */}
          <g stroke={DIEP} strokeWidth="3.6" strokeLinecap="round" opacity=".8">
            <path d="M47 55 l3 12" />
            <path d="M59 51 l1 13" />
            <path d="M71 54 l-2 12" />
          </g>
          <ellipse cx="54" cy="102" rx="26" ry="16" fill={LICHT} />
          <path d="M47 94 L61 94 L54 102 Z" fill={DIEP} stroke={DIEP} strokeWidth="2.5" strokeLinejoin="round" />
          <g fill="none" stroke={DIEP} strokeWidth="2.5" strokeLinecap="round">
            <path d="M54 102 q-6 8 -12 4" />
            <path d="M54 102 q6 8 12 4" />
          </g>
          <g fill="none" stroke={DIEP} strokeWidth="2" strokeLinecap="round" opacity=".5">
            <path d="M31 96 L5 89" />
            <path d="M30 102 L2 102" />
            <path d="M31 108 L6 117" />
          </g>
          <g className="oog-dicht" fill="none" stroke={DIEP} strokeWidth="3.6" strokeLinecap="round">
            <path d="M33 83 q10 9 20 0" />
            <path d="M71 80 q10 9 20 0" />
          </g>
          <g className="oog-open">
            <ellipse cx="43" cy="82" rx="8" ry="9.5" fill="var(--color-oogbol)" />
            <ellipse cx="44" cy="83" rx="3.4" ry="8" fill="var(--color-pupil)" />
            <ellipse cx="80" cy="80" rx="8" ry="9.5" fill="var(--color-oogbol)" />
            <ellipse cx="81" cy="81" rx="3.4" ry="8" fill="var(--color-pupil)" />
          </g>
        </g>
      </g>

      <g className="spin-golf" fill="none" stroke="var(--color-inkt-zwak)" strokeWidth="2.6" strokeLinecap="round">
        <path d="M124 26 q7 -8 0 -16" />
        <path d="M137 30 q11 -12 0 -25" />
      </g>
    </g>
  );
}

/** One leg: thigh, shin and paw, each turning about its own joint as `rig.ts` places it. The far legs are darker. */
function Been({ poot, ver }: { poot: Poot; ver: boolean }) {
  const b = BENEN[poot];
  const [hx, hy] = b.heup;
  const [kx, ky] = knie(poot);
  const kleur = ver ? DIEP : VACHT;
  const stijl = { "--rust-dij": `${b.rustDij}deg`, "--rust-scheen": `${b.rustScheen}deg` } as CSSProperties;
  return (
    <g className={`been been-${poot}`} style={stijl}>
      <g className="dij" style={{ transformOrigin: `${hx}px ${hy}px` }}>
        <path d={`M${hx} ${hy} L${kx} ${ky}`} fill="none" stroke={kleur} strokeWidth={ver ? 14 : 15} strokeLinecap="round" />
        <g className="scheen" style={{ transformOrigin: `${kx}px ${ky}px` }}>
          <path d={`M${kx} ${ky} L${kx} ${ky + b.scheen - 1}`} fill="none" stroke={kleur} strokeWidth={ver ? 13 : 14} strokeLinecap="round" />
          <ellipse cx={kx} cy={ky + b.scheen} rx={ver ? 8.5 : 9} ry={ver ? 5 : 5.4} fill={ver ? DIEP : LICHT} />
        </g>
      </g>
    </g>
  );
}

/** The standing cat's head: on the standing cat, and on its own beside what he says in the chat. */
function StaandeKop() {
  return (
    <g className="kop-staand">
      <path className="oor-l" d="M34 44 L29 6 L60 28 Z" fill={VACHT} stroke={VACHT} strokeWidth="7" strokeLinejoin="round" />
      <path className="oor-l" d="M38 38 L35 17 L53 29 Z" fill={LICHT} stroke={LICHT} strokeWidth="3" strokeLinejoin="round" />
      <path className="oor-r" d="M70 28 L99 8 L94 48 Z" fill={VACHT} stroke={VACHT} strokeWidth="7" strokeLinejoin="round" />
      <path className="oor-r" d="M74 32 L93 20 L90 42 Z" fill={LICHT} stroke={LICHT} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="62" cy="62" r="33" fill={VACHT} />
      <g stroke={DIEP} strokeWidth="3.2" strokeLinecap="round" opacity=".8">
        <path d="M49 35 l3 11" />
        <path d="M60 32 l1 12" />
        <path d="M71 35 l-2 11" />
      </g>
      <ellipse cx="54" cy="78" rx="23" ry="14" fill={LICHT} />
      <path d="M48 71 L60 71 L54 78 Z" fill={DIEP} stroke={DIEP} strokeWidth="2.3" strokeLinejoin="round" />
      <g fill="none" stroke={DIEP} strokeWidth="2.3" strokeLinecap="round">
        <path d="M54 78 q-5 7 -11 3" />
        <path d="M54 78 q5 7 11 3" />
      </g>
      <g fill="none" stroke={DIEP} strokeWidth="1.9" strokeLinecap="round" opacity=".5">
        <path d="M33 72 L9 66" />
        <path d="M32 79 L6 79" />
        <path d="M33 86 L10 94" />
      </g>
      <g className="oog-open">
        <ellipse cx="46" cy="59" rx="7.5" ry="9" fill="var(--color-oogbol)" />
        <ellipse cx="47" cy="60" rx="3.2" ry="7.5" fill="var(--color-pupil)" />
        <ellipse cx="78" cy="57" rx="7.5" ry="9" fill="var(--color-oogbol)" />
        <ellipse cx="79" cy="58" rx="3.2" ry="7.5" fill="var(--color-pupil)" />
      </g>
    </g>
  );
}

/** The standing cat, in the same 240 by 176 space as the lying one. */
function StaandeVorm() {
  const lijf = useSvgId("chuck-lijf-staand");
  return (
    <g className="c-loop-lijf">
      <defs>
        <clipPath id={lijf}>
          <ellipse cx="130" cy="82" rx="60" ry="36" />
        </clipPath>
      </defs>
      <Been poot="vv" ver />
      <Been poot="av" ver />

      {/* The tail in two parts, so the tip follows. */}
      <g className="staart-deel staart-basis">
        <path d="M184 62 C202 52 210 38 207 28" fill="none" stroke={VACHT} strokeWidth="14" strokeLinecap="round" />
        <g className="staart-deel staart-punt">
          <path d="M207 28 C204 17 197 11 190 10" fill="none" stroke={VACHT} strokeWidth="12" strokeLinecap="round" />
        </g>
      </g>

      <ellipse cx="130" cy="82" rx="60" ry="36" fill={VACHT} />
      <g clipPath={`url(#${lijf})`} opacity=".92">
        <path d="M114 44 q14 16 10 34" fill="none" stroke={DIEP} strokeWidth="8.5" strokeLinecap="round" />
        <path d="M142 42 q14 16 10 35" fill="none" stroke={DIEP} strokeWidth="8.5" strokeLinecap="round" />
        <path d="M168 48 q13 15 9 32" fill="none" stroke={DIEP} strokeWidth="8.5" strokeLinecap="round" />
      </g>

      <Been poot="vn" ver={false} />
      <Been poot="an" ver={false} />

      <StaandeKop />
    </g>
  );
}

/**
 * The basket with Chuck in it, as one drawing (400 by 176). The lying and the standing cat sit at exactly the same
 * place behind the same front rim, which is the whole reason the change between them reads as getting up. The lying
 * cat is clipped to everything above the front panel, so the tail can never show beside or under the basket.
 *
 * The component only draws. What he does (`uit`, `loopt`, `in`, ...) is set on the element by `useLoopje`.
 */
export const Mandscene = forwardRef<SVGSVGElement, { className?: string; style?: CSSProperties }>(function Mandscene(
  { className, style },
  ref,
) {
  const rand = useSvgId("chuck-mandrand");
  return (
    <svg
      ref={ref}
      className={cn("chuck", className)}
      style={style}
      viewBox={`0 0 ${SCENE.breedte} ${SCENE.hoogte}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={rand}>
          <path d="M100 -60 L460 -60 L460 128 L388 128 C 388 146, 172 146, 172 128 L100 128 Z" />
        </clipPath>
      </defs>
      <g transform={`translate(${KAT_X} 0)`}>
        <path d="M16 124 C16 104 224 104 224 124 L224 140 L16 140 Z" fill="var(--color-mand-diep)" />
      </g>
      <g className="kat-lig" clipPath={`url(#${rand})`}>
        <g transform={`translate(${KAT_X} 0)`}>
          <LiggendeVorm />
        </g>
      </g>
      <g className="kat-sta">
        <g className="kat-draai">
          <g className="kat-kantel">
            <g transform={`translate(${KAT_X} 0)`}>
              <StaandeVorm />
            </g>
          </g>
        </g>
      </g>
      <g transform={`translate(${KAT_X} 0)`}>
        <path d="M12 128 C12 146 228 146 228 128 L220 164 C218 172 22 172 20 164 Z" fill="var(--color-mand)" />
        <g stroke="var(--color-mand-diep)" strokeWidth="2.6" strokeLinecap="round" opacity=".5">
          <path d="M44 139 L45 167" />
          <path d="M70 142 L71 169" />
          <path d="M96 143 L96 170" />
          <path d="M120 144 L120 170" />
          <path d="M144 143 L144 170" />
          <path d="M170 142 L169 169" />
          <path d="M196 139 L195 167" />
        </g>
        <path d="M12 128 C12 146 228 146 228 128" fill="none" stroke="var(--color-mand-diep)" strokeWidth="3.6" />
      </g>
    </svg>
  );
});

/** Chuck lying on his own, without a basket: on the corner of the week strip. */
export const LiggendeKat = forwardRef<SVGSVGElement, { className?: string }>(function LiggendeKat({ className }, ref) {
  return (
    <svg ref={ref} className={cn("chuck", className)} viewBox="0 0 240 176" aria-hidden="true" focusable="false">
      <LiggendeVorm />
    </svg>
  );
});

/**
 * Chuck's head on its own, ears up and eyes open: beside each of his balloons in the chat and beside his name in the
 * window's heading (FB-031), so a balloon's tail points at somebody.
 */
export function Kopje({ className }: { className?: string }) {
  return (
    <svg className={cn("chuck", className)} viewBox="0 0 104 100" aria-hidden="true" focusable="false">
      <StaandeKop />
    </svg>
  );
}
