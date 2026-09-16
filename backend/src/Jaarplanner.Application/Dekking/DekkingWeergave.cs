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
/// an export can state it as evidence.
/// </param>
/// <param name="BeschikbareJaarFasen">
/// The codes this class *could* be measured against: its whole derived set, before any narrowing. Empty for
/// <see cref="Dekkingsbereik.HeelCurriculum"/>.
/// <para>
/// <b>Distinct from <paramref name="GemetenJaarFasen"/> for one reason: a kleutergroep has to be able to narrow, and
/// after narrowing it must still know what it narrowed from.</b> <c>Klas.Leerjaar</c> is <c>0</c> for a kleutergroep
/// and cannot say which kleuterjaar, so the derived set is all three kleuter codes; measured against all three, a
/// derde kleuterklas carries roughly three times the doelen it teaches and its figure reads about a third of what it
/// is (owner ruling 2026-08-04: let the teacher choose). Once they choose <c>K3</c>, <c>GemetenJaarFasen</c> is
/// <c>["K3"]</c> — and a screen that only had that could no longer offer <c>JK</c> and <c>K2</c> as the alternatives
/// it narrowed from. So the payload carries both: what was applied, and what was available.
/// </para>
/// <para>
/// For a single-leerjaar class the two are equal and the caller offers no choice, which is why the chooser keys on
/// this list having more than one member rather than on "is this a kleutergroep" — a question the data model cannot
/// answer and a future graadklas ruling would answer differently.
/// </para>
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
/// <param name="AantalInPrognose">
/// How many leerplandoelen are in the dekkingsprognose and not yet gedekt (ADR-0047), or <c>null</c> when
/// <paramref name="IsBetrouwbaar"/> is <c>false</c>. Disjoint from <paramref name="AantalGedekt"/>, so the two add up
/// to what the school aims at or covers.
/// </param>
/// <param name="AantalMinimumdoelenGedekt">
/// How many minimumdoelen are gedekt, or <c>null</c> when <paramref name="IsBetrouwbaar"/> is <c>false</c>.
/// </param>
/// <param name="AantalMinimumdoelenInPrognose">
/// How many minimumdoelen are in the prognose and not yet gedekt, or <c>null</c> when the figures are withheld.
/// </param>
/// <param name="AantalMinimumdoelen">
/// The minimumdoel denominator: the minimumdoelen of the class's mijlpaal, or every minimumdoel for the whole
/// curriculum or a class without a derivable jaar/fase (ADR-0047 S4).
/// </param>
/// <param name="Minimumdoelen">
/// Every in-scope minimumdoel with its step, ordered by the decree's ordering (leergebied, rubriek, subrubriek) and
/// then by ref, ordinally.
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
    IReadOnlyList<string> BeschikbareJaarFasen,
    bool IsTerugvalNaarHeelCurriculum,
    int AantalBuitenBereik,
    bool IsBetrouwbaar,
    int AantalOnopgelosteVervallenPlaatsingen,
    int? AantalGedekt,
    int AantalLeerplandoelen,
    IReadOnlyList<LeerplandoelDekking> Doelen,
    int? AantalInPrognose,
    int? AantalMinimumdoelenGedekt,
    int? AantalMinimumdoelenInPrognose,
    int AantalMinimumdoelen,
    IReadOnlyList<MinimumdoelDekking> Minimumdoelen);

/// <summary>
/// One leerplandoel and whether this class's plan covers it.
/// </summary>
/// <param name="Code">The leerplandoel's unique, stable code (Art. III.5).</param>
/// <param name="Doelsoort">The goal type, for the badge/design token (Art. XII) and the E5-03 filter.</param>
/// <param name="JaarFase">The jaar/fase code (JK, K2, K3, L1–L6, or a fase for P/S).</param>
/// <param name="DisciplineNummer">
/// The discipline number ("2", "9.1"), the stable key of the overview's top level (owner ruling 2026-09-15, TB-022, in
/// the owner's words "per leergebied"; leergebied itself names a grouping over disciplines, Art. XII). The export does
/// not read it.
/// </param>
/// <param name="DisciplineNaam">
/// The discipline's name, or <c>null</c> when its number has no row in <c>disciplines</c>, which the FK forbids; the
/// screen then shows the number, as the register does.
/// </param>
/// <param name="Domein">The domein — part of the composite browse key.</param>
/// <param name="Subdomein">The subdomein — unique only together with the domein (Art. VII.0).</param>
/// <param name="Tekst">The goal text (Excel J).</param>
/// <param name="MinimumdoelRef">
/// The concordance key to the decreed eindterm, or <c>null</c>. Shown beside the goal; it plays no part in the
/// minimumdoel's own dekking, which runs through a thema (Art. V.1).
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
/// Whether this goal is gedekt (Art. V.1, ADR-0047): <paramref name="Stap"/> is <see cref="Dekkingsstap.Gedekt"/>. A
/// subdoel or activiteit link of a subthema placed in the klas's agenda, an accepted doelsuggestie of a thema placed in
/// a real period of this plan, or a planned algemene fiche of this class. For a thema, the placement must be
/// <c>aanvaard</c> or <c>manueel</c> and not stale (directie 2026-07-28); for every link, <c>aanvaard</c> or
/// <c>manueel</c>.
/// </param>
/// <param name="DekkendeThemas">
/// What covers this goal through the school's content, ordered by name: a thema for a doelsuggestie, and
/// "subthema (thema)" for a subdoel or activiteit link. This is the evidence half of Art. V: an export that claims
/// coverage has to be able to say <i>through what</i>.
/// <para>
/// <b>It is no longer empty exactly when <paramref name="IsGedekt"/> is false</b>, and a caller that relied on that
/// has to read <paramref name="DekkendeFiches"/> as well: since 2026-09-11 a goal can be covered by a fiche alone.
/// What still holds, and what the tests pin, is that <paramref name="IsGedekt"/> is true exactly when at least one of
/// the two lists is non-empty.
/// </para>
/// </param>
/// <param name="DekkendeFiches">
/// The planned algemene fiches of this class that cover this goal, ordered by name (owner ruling, 2026-09-11; Art. V.1
/// as amended). A separate list rather than names mixed into <paramref name="DekkendeThemas"/>, because a thema and a
/// turnles are different kinds of evidence and a directie reading "gedekt door Turnen" has to be able to tell which
/// one it is looking at.
/// </param>
/// <param name="Oorzaak">
/// Why this goal is not covered, and therefore where closing it happens (E5-05); <c>null</c> exactly when
/// <paramref name="IsGedekt"/> is <c>true</c>.
/// <para>
/// <b>Deliberately a separate field from <paramref name="DekkendeThemas"/> rather than a widening of it.</b> The
/// two answer opposite questions — what proves this goal is taught, versus what would have to happen for it to be —
/// and the first is read by the export as evidence (Art. V.4). Folding a gap's candidate thema's into a list named
/// "dekkende thema's" would put names into a proof-of-coverage document that prove nothing.
/// </para>
/// </param>
/// <param name="KandidaatThemas">
/// The thema's that justify <paramref name="Oorzaak"/>, ordered by name: the ones a teacher would act on to close
/// this gap. Empty when the goal is covered, and empty for <see cref="Lacuneoorzaak.GeenThema"/>, which is the one
/// cause with nothing to name.
/// <para>
/// <b>Only the thema's belonging to the reported cause are listed, not every thema with some link to the goal.</b> A
/// doel can be one accept away through thema A and unplanned through thema B; naming both would present two routes
/// where the classification has already picked the cheaper one, and a teacher would have no way to tell which name
/// went with which action.
/// </para>
/// </param>
public sealed record LeerplandoelDekking(
    string Code,
    Doelsoort Doelsoort,
    string JaarFase,
    string DisciplineNummer,
    string? DisciplineNaam,
    string Domein,
    string Subdomein,
    string Tekst,
    string? MinimumdoelRef,
    bool NietMeerInOpstap,
    bool IsGedekt,
    IReadOnlyList<string> DekkendeThemas,
    IReadOnlyList<string> DekkendeFiches,
    Lacuneoorzaak? Oorzaak,
    IReadOnlyList<string> KandidaatThemas,
    Dekkingsstap Stap,
    IReadOnlyList<string> PrognoseBronnen);

/// <summary>
/// Where a goal stands for a klas (Art. V.1, ADR-0047): nowhere yet, in the dekkingsprognose, or gedekt.
/// </summary>
public enum Dekkingsstap
{
    /// <summary>No thema or subthema aims at it, and nothing in the agenda covers it.</summary>
    Geen = 0,

    /// <summary>A thema or subthema aims at it, and the klas's agenda does not hold that yet.</summary>
    Prognose = 1,

    /// <summary>The klas's agenda holds what carries it.</summary>
    Gedekt = 2,
}

/// <summary>
/// One minimumdoel and where it stands for this class (Art. V.1, ADR-0047 D2): it counts only through a thema it is a
/// themadoel of.
/// </summary>
/// <param name="Ref">The minimumdoel's stable ref.</param>
/// <param name="Leeftijd">Its mijlpaal (<c>K-</c>, <c>4-</c>, <c>6-</c>).</param>
/// <param name="Nr">Its number in the decree.</param>
/// <param name="Omschrijving">The decreed text.</param>
/// <param name="Leergebied">The decree's first ordering level, or null when unknown.</param>
/// <param name="Rubriek">The second level, or null.</param>
/// <param name="Subrubriek">The third level, or null.</param>
/// <param name="NietMeerInOpstap">Whether a re-import found it gone; it stays in the denominator.</param>
/// <param name="Stap">Where it stands.</param>
/// <param name="IsGedekt">Whether <paramref name="Stap"/> is <see cref="Dekkingsstap.Gedekt"/>.</param>
/// <param name="PrognoseThemas">Every thema it is a themadoel of, ordered by name.</param>
/// <param name="DekkendeThemas">Those of them placed in this plan, ordered by name: the evidence.</param>
/// <param name="Oorzaak">
/// Why it is not gedekt, or <c>null</c> when it is: <see cref="Lacuneoorzaak.WachtOpBeslissing"/>,
/// <see cref="Lacuneoorzaak.PlaatsingGeweigerd"/> or <see cref="Lacuneoorzaak.NietIngepland"/> for one in the prognose,
/// <see cref="Lacuneoorzaak.GeenThema"/> for one on no thema.
/// </param>
/// <param name="KandidaatThemas">The thema's that justify <paramref name="Oorzaak"/>, ordered by name.</param>
public sealed record MinimumdoelDekking(
    string Ref,
    string Leeftijd,
    string Nr,
    string Omschrijving,
    string? Leergebied,
    string? Rubriek,
    string? Subrubriek,
    bool NietMeerInOpstap,
    Dekkingsstap Stap,
    bool IsGedekt,
    IReadOnlyList<string> PrognoseThemas,
    IReadOnlyList<string> DekkendeThemas,
    Lacuneoorzaak? Oorzaak,
    IReadOnlyList<string> KandidaatThemas);
