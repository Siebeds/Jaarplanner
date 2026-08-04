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
/// While any stale placement is unresolved (<see cref="AantalOnopgelosteVervallenPlaatsingen"/> &gt; 0) the plan cannot report
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
/// <param name="Bereik">
/// Which leerplandoelen the figures below are over: the class's own jaar/fase, or the whole loaded curriculum
/// (owner ruling 2026-08-04). It reports what was <b>applied</b>, which is not always what was asked for — see
/// <see cref="IsTerugvalNaarHeelCurriculum"/>. Every consumer that prints a total or a percentage has to render this
/// beside it, because the same class has two legitimate denominators.
/// </param>
/// <param name="GemetenJaarFasen">
/// The jaar/fase codes actually measured against, or empty for the whole curriculum. Present so a screen can name
/// the scope in the school's own vocabulary ("gemeten tegen L3") rather than describing it in the abstract, and so
/// an export can state it as evidence. A kleutergroep yields all three kleuter codes: <c>Klas.Leerjaar</c> cannot say
/// which kleuterjaar a group is, so the widest honest set is used (see <c>Jaarfasen.VoorLeerjaar</c>).
/// </param>
/// <param name="IsTerugvalNaarHeelCurriculum">
/// <c>true</c> when the class's own jaar/fase was requested but could not be derived, so the whole curriculum was
/// measured instead.
/// <para>
/// <b>This is the unresolved half of the Art. XIV decision, surfaced rather than hidden.</b> A graadklas / menggroep
/// spans several leerjaren and <c>Klas.Leerjaar</c> is one ordinal, so no set can be derived for it. The computation
/// widens the scope rather than narrowing it — a narrower-than-intended scope would overstate coverage — and says so
/// here, so the overview can explain why it is showing more goals than the teacher asked for instead of silently
/// contradicting its own control.
/// </para>
/// </param>
/// <param name="AantalBuitenBereik">
/// How many loaded leerplandoelen fall <b>outside</b> <see cref="Bereik"/>; 0 when the whole curriculum is measured.
/// <para>
/// Present so the narrowing cannot be silent. Scoping to one jaar/fase also drops the illustrative <c>P</c>/<c>S</c>
/// doelsoorten, whose Art. VII.1 column F holds a fase code rather than a jaar/fase code, so the excluded set is not
/// only "other years". A smaller denominator flatters the figure, which is the one direction coverage must never move
/// by itself, so the screen states this number beside the whole-curriculum switch.
/// </para>
/// </param>
/// <param name="IsBetrouwbaar">
/// <c>false</c> when at least one stale placement is still <b>unresolved</b> — i.e. its stored block start is no
/// longer the start of any derived period <i>and</i> the teacher has not rejected it. Coverage may then not be
/// reported as a figure (directie 2026-07-28; see the type remarks).
/// <para>
/// <b>"Unresolved" is narrower than "stale", and the difference is a deliberate judgement call.</b> A placement the
/// teacher has <c>geweigerd</c> contributes nothing to dekking whether or not its period still exists, so its
/// staleness cannot change the figure and it does not withhold it. A stale <c>voorgesteld</c> placement <i>does</i>
/// count as unresolved, because accepting it would raise the figure. The directie ruling says "while any placement
/// is unresolved" and did not contemplate a rejected one. See <see cref="AantalOnopgelosteVervallenPlaatsingen"/>
/// for the consequence a caller has to handle.
/// </para>
/// </param>
/// <param name="AantalOnopgelosteVervallenPlaatsingen">
/// How many stale placements are <b>unresolved</b> — not how many are stale. Present so a caller can name the scale
/// of what needs resolving rather than only that something does; the placements themselves are listed by the
/// jaarplan view (E3-07/E3-09), which is where the inline re-placement action lives.
/// <para>
/// <b>This number is deliberately NOT the same as the kalender's stale-placement count, and a screen showing both
/// must reconcile them.</b> The kalender's non-dismissible notice (E3-07/E3-09) counts every stale placement,
/// including rejected ones, because a rejected card still needs its own explanation. So a plan with one stale
/// rejected placement legitimately reports <c>0</c> here while that notice is up. Left as a divergence rather than
/// aligned, because the two numbers answer different questions: "what must a human still fix before this figure
/// means anything" versus "what on this calendar is pointing at a period that no longer exists". <b>E5-02 owns the
/// copy that makes that legible</b>; presenting "1 plaatsing moet herbekeken worden" beside a bare "dekking is
/// betrouwbaar" would be the E4-06 contradiction in a new place.
/// </para>
/// </param>
/// <param name="AantalGedekt">
/// How many leerplandoelen are covered, or <c>null</c> when <paramref name="IsBetrouwbaar"/> is <c>false</c>.
/// </param>
/// <param name="AantalLeerplandoelen">
/// The denominator: how many leerplandoelen are in scope. Always present, because it is a property of the loaded
/// curriculum rather than of this plan, so no stale placement can make it dishonest.
/// <para>
/// <b>Which goals are in scope was ruled on 2026-08-04 (owner), and this number now follows
/// <see cref="Bereik"/>.</b> E5-01 shipped it as the whole loaded curriculum and recorded that as the only
/// available answer rather than a considered one. The ruling: a class is measured against its own jaar/fase,
/// derived from <c>Klas.Leerjaar</c>, with <see cref="Dekkingsbereik.HeelCurriculum"/> as an explicit switch.
/// <b>E5-03 and E5-05 therefore inherit a scoped denominator</b>, and both must read <see cref="Bereik"/> before
/// putting a percentage or a gap list on screen: the same class yields two legitimate denominators, and a figure
/// that does not say which one it used is not evidence.
/// </para>
/// <para>
/// <b>It can legitimately be 0 while the school has a full curriculum loaded</b> — a class scoped to L3 when only
/// kleuterdoelen are imported. A caller must not render that as "alles gedekt": 0 of 0 is "we cannot measure this
/// class yet", and <see cref="AantalBuitenBereik"/> is what distinguishes it from an empty database.
/// </para>
/// <para>
/// <b>What the ruling did not settle</b> is the graadklas / menggroep, which has no single leerjaar to derive from.
/// See <see cref="IsTerugvalNaarHeelCurriculum"/>.
/// </para>
/// </param>
/// <param name="Doelen">
/// Every in-scope leerplandoel with its coverage state, ordered <b>ordinally</b> by (domein, subdomein, code).
/// The gap-analyse (E5-05) is the subset with <see cref="LeerplandoelDekking.IsGedekt"/> <c>false</c>; the doelsoort
/// filter (E5-03) filters this list. Both are presentation over this one computation rather than second queries that
/// could drift.
/// <para>
/// <b>Ordinal, and deliberately not culture-aware.</b> The gap list and the register order the same fields in
/// <i>PostgreSQL</i> under the database collation, so no .NET comparer reproduces them exactly for punctuation, case
/// or diacritics; and <c>CurrentCulture</c> would additionally make the server's output depend on the host's culture.
/// Ordinal is therefore stable and host-independent, which is the property that matters here. It is <b>not</b> a
/// claim that this list is byte-for-byte in the gap list's order: an earlier revision of this comment asserted that,
/// and it was not true.
/// </para>
/// </param>
public sealed record DekkingWeergave(
    Guid KlasId,
    string KlasNaam,
    Guid SchooljaarId,
    string SchooljaarNaam,
    Dekkingsbereik Bereik,
    IReadOnlyList<string> GemetenJaarFasen,
    bool IsTerugvalNaarHeelCurriculum,
    int AantalBuitenBereik,
    bool IsBetrouwbaar,
    int AantalOnopgelosteVervallenPlaatsingen,
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
/// Whether a thema carrying this goal is placed in a real period of this plan (Art. V.1). Three exclusions are
/// folded into that sentence, each with its own authority:
/// <list type="bullet">
/// <item>the <b>link</b> must be <c>aanvaard</c> or <c>manueel</c> — a <c>voorgesteld</c> one would let the AI grant
/// dekking (Art. IV.1), a <c>geweigerd</c> one never counted;</item>
/// <item>the <b>placement</b> must likewise be <c>aanvaard</c> or <c>manueel</c>, for the same reason;</item>
/// <item>the placement must <b>not be stale</b> — a stored block start that is no longer any period's start puts the
/// thema in no period at all, so nothing is demonstrably taught on its account (directie 2026-07-28).</item>
/// </list>
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
