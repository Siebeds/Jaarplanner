using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Dekking;

/// <summary>
/// The computed coverage of one class's jaarplan (E5-01, FR-9.1, Art. V.1).
/// <para>
/// <b>Nothing here is stored.</b> Art. V.1 says dekking is computed, never persisted, so this record is
/// produced on every read from the current placements and the current link state. Accepting a suggestion,
/// rejecting a placement or editing the school's vakanties changes the answer immediately, with no
/// recalculation step to forget to run.
/// </para>
/// <para>
/// <b>The summary figure is nullable, and that is the directie ruling of 2026-07-28 expressed in the type.</b>
/// While any placement is stale (<see cref="AantalVervallenPlaatsingen"/> &gt; 0) the plan cannot report
/// trustworthy dekking, because a thema whose period is unknown is not demonstrably taught in the school year.
/// The ruling says to mark the figure as <i>onbetrouwbaar / te herzien</i> rather than show a number that would
/// mislead an inspectie. Making <see cref="AantalGedekt"/> <c>null</c> in that state is deliberate: a boolean
/// beside a populated number would let any caller render the number anyway, and this repo has learned that a
/// flag which only *asks* to be honoured eventually is not. A caller physically cannot print a total it does
/// not have.
/// </para>
/// </summary>
/// <param name="KlasId">The class whose coverage this is. Dekking is per klas (FR-9.1).</param>
/// <param name="KlasNaam">The class name, so a caller need not fetch it separately.</param>
/// <param name="SchooljaarId">The school year containing the class (Art. IX.3).</param>
/// <param name="SchooljaarNaam">The school year label (e.g. "2026-2027").</param>
/// <param name="IsBetrouwbaar">
/// <c>false</c> when at least one placement is stale, i.e. its stored block start is no longer the start of any
/// derived period. Coverage may then not be reported as a figure (directie 2026-07-28; see the type remarks).
/// </param>
/// <param name="AantalVervallenPlaatsingen">
/// How many placements are stale. Present so a caller can name the scale of what needs resolving rather than
/// only that something does; the placements themselves are listed by the jaarplan view (E3-07/E3-09), which is
/// where the inline re-placement action lives.
/// </param>
/// <param name="AantalGedekt">
/// How many leerplandoelen are covered, or <c>null</c> when <paramref name="IsBetrouwbaar"/> is <c>false</c>.
/// </param>
/// <param name="AantalLeerplandoelen">
/// The denominator: how many leerplandoelen exist. Always present, because it is a property of the loaded
/// curriculum rather than of this plan, so no stale placement can make it dishonest.
/// </param>
/// <param name="Doelen">
/// Every leerplandoel with its coverage state, ordered by (domein, subdomein, code) — the same browse order the
/// gap list uses, so the two screens do not disagree about where a goal sits. The gap-analyse (E5-05) is the
/// subset with <see cref="LeerplandoelDekking.IsGedekt"/> <c>false</c>; the doelsoort filter (E5-03) filters
/// this list. Both are presentation over this one computation rather than second queries that could drift.
/// </param>
public sealed record DekkingWeergave(
    Guid KlasId,
    string KlasNaam,
    Guid SchooljaarId,
    string SchooljaarNaam,
    bool IsBetrouwbaar,
    int AantalVervallenPlaatsingen,
    int? AantalGedekt,
    int AantalLeerplandoelen,
    IReadOnlyList<LeerplandoelDekking> Doelen);

/// <summary>
/// One leerplandoel and whether this class's plan covers it.
/// </summary>
/// <param name="Code">The leerplandoel's unique, stable code (Art. III.5).</param>
/// <param name="Doelsoort">The goal type, for the badge/design token (Art. XII) and the E5-03 filter.</param>
/// <param name="JaarFase">The jaar/fase code (JK, K2, K3, L1–L6, or a fase for P/S).</param>
/// <param name="Domein">The domein — part of the composite browse key.</param>
/// <param name="Subdomein">The subdomein — unique only together with the domein (Art. VII.0).</param>
/// <param name="Tekst">The goal text (Excel J).</param>
/// <param name="MinimumdoelRef">
/// The concordance key to the decreed eindterm, or <c>null</c>. Carried so E5-04 can roll this up to
/// minimumdoel level without a second pass over the curriculum; <b>this story computes no minimumdoel
/// coverage</b>, which is blocked on E1-12 (no <c>Minimumdoel</c> row can exist yet).
/// </param>
/// <param name="NietMeerInOpstap">
/// <c>true</c> when a re-import found this goal gone from Op.stap while school content still referenced it, so it
/// was flagged rather than deleted (Art. III.4).
/// <para>
/// <b>Such a goal stays in the denominator, deliberately.</b> Dropping it would quietly shrink the total and raise
/// the percentage, which is the one direction a coverage figure must never move by itself; and a withdrawn goal
/// that teacher content still links to is precisely what someone needs to review. Whether the gap list should
/// visually separate or filter these is a presentation decision for E5-03/E5-05 — this flag is the input that
/// decision needs, so no screen has to render a withdrawn goal as an ordinary lacune.
/// </para>
/// </param>
/// <param name="IsGedekt">
/// Whether a thema carrying this goal (status aanvaard/manueel) is placed in a real period of this plan
/// (Art. V.1). See <see cref="DekkendeThemas"/> for what "placed" excludes.
/// </param>
/// <param name="DekkendeThemas">
/// The thema's that cover this goal, ordered by name; empty exactly when <paramref name="IsGedekt"/> is
/// <c>false</c>. This is the evidence half of Art. V: an export that claims coverage has to be able to say
/// <i>through what</i>, and a teacher looking at a gap wants to know which thema already nearly closes it.
/// </param>
public sealed record LeerplandoelDekking(
    string Code,
    Doelsoort Doelsoort,
    string JaarFase,
    string Domein,
    string Subdomein,
    string Tekst,
    string? MinimumdoelRef,
    bool NietMeerInOpstap,
    bool IsGedekt,
    IReadOnlyList<string> DekkendeThemas);
