namespace Jaarplanner.Application.Dekking;

/// <summary>
/// What a jaarplan <b>would</b> cover if the teacher accepted every proposal standing in it, beside what it covers
/// today (E3-03, FR-5.3).
/// <para>
/// <b>Why this type has to exist at all, and it is the whole of E3-03's honesty problem.</b> FR-5.3 says generation
/// <i>streeft naar volledige dekking</i>, and the story's acceptance criterion asked for "a freshly generated plan
/// reports high coverage". A freshly generated plan reports <b>zero</b> covered, by design and permanently: every
/// placement a run creates is <c>voorgesteld</c> (Art. IV.2) and only <c>aanvaard</c>/<c>manueel</c> placements count
/// as taught (Art. V.1), precisely so the AI cannot grant coverage (Art. IV.1). Measuring the criterion literally
/// would therefore have required either weakening Art. V.1 or reporting a number that is always 0 and calling it a
/// failure of the model.
/// </para>
/// <para>
/// <b>So <see cref="AantalMinimumdoelenMogelijkGedekt"/> is explicitly a <i>vooruitzicht</i>, never a dekking;
/// the other figures are today's real ones.</b>
/// <see cref="AantalMinimumdoelenMogelijkGedekt"/> counts what acceptance would cover;
/// <see cref="AantalMinimumdoelenGedekt"/> is the real, decided figure, computed by exactly the same rules the
/// dekkingsoverzicht uses. The forecast is over minimumdoelen, since a thema placement covers nothing else
/// (ADR-0052). The two are reported side by side
/// so no caller can present the potential one as proof of anything: Art. V.2 forbids claiming coverage that cannot
/// be proven, and a proposal proves nothing until a human stands behind it.
/// </para>
/// <para>
/// <b>What it is <i>for</i>, since it proves nothing:</b> it tells a teacher whether the proposal they were just
/// handed is worth accepting, and it makes the model's aim measurable. A run that could at best reach a third of the
/// class's doelen is a run whose prompt or thema-bibliotheek is the problem, and until this figure existed nobody
/// could see that without accepting the whole plan first.
/// </para>
/// <para>
/// <b>Advisory, like every other generation report</b> (Art. IV.1). Nothing here vetoes a run, retries it or scores
/// it. There is no target percentage and no green tick: "volledige dekking" is the direction FR-5.3 names, and how
/// close is close enough for a given school year is the school's judgement, exactly as with
/// <c>Spreidingsrapport</c>. A percentage is deliberately absent for a second reason too: E5-03 owns the
/// dekkingspercentage, and a second one computed here could drift from it.
/// </para>
/// </summary>
/// <param name="Bereik">
/// Which goals the figures are over (owner ruling 2026-08-04): the class's own jaar/fase and its mijlpaal by default. It
/// reports what was <b>applied</b>, not what was asked for; see <paramref name="IsTerugvalNaarHeelCurriculum"/>.
/// Every consumer that prints a total has to render this beside it, because the same class has two legitimate
/// denominators.
/// </param>
/// <param name="GemetenJaarFasen">
/// The jaar/fase codes actually measured against, or empty for the whole curriculum, so a screen can name the scope
/// in the school's own vocabulary rather than in the abstract.
/// <para>
/// <b>A kleutergroep's narrowing is honoured</b> (owner ruling 2026-08-04): the caller passes the chosen code and
/// this reports what was applied. <i>An earlier revision refused to accept one and justified it by claiming the
/// chooser "lives on the dekkingsoverzicht". That was simply false — E3-09 put a <c>Jaarfasekiezer</c> on the
/// kalender, driving the live dekking line on the same screen as this panel — and the consequence was two figures
/// over two different denominators a few pixels apart. Kept as a note because the mistake was not in the code but
/// in a claim about where a control lives, which no test can contradict.</i>
/// </para>
/// </param>
/// <param name="IsTerugvalNaarHeelCurriculum">
/// <c>true</c> when the class's own jaar/fase was wanted but could not be derived (the unresolved graadklas /
/// menggroep half of Art. XIV), so the whole curriculum was measured instead. The scope is widened rather than
/// narrowed and declared rather than hidden, because a narrower-than-intended denominator would overstate the
/// outlook.
/// </param>
/// <param name="AantalBuitenBereik">
/// How many loaded leerplandoelen fall outside <paramref name="Bereik"/>; 0 when the whole curriculum is measured.
/// Present so the narrowing cannot be silent: a smaller denominator flatters the figure, which is the one direction
/// it must never move by itself.
/// </param>
/// <param name="IsBetrouwbaar">
/// <c>false</c> when at least one stale placement is unresolved, in which case <b>both</b> figures are withheld
/// (directie 2026-07-28). The outlook is held to the same standard as the real figure on purpose: a plan whose
/// placements point at periods that no longer exist cannot honestly say what accepting them would achieve either.
/// </param>
/// <param name="AantalOnopgelosteVervallenPlaatsingen">
/// How many stale placements are unresolved — stale <i>and</i> not rejected. The same narrowing
/// <c>DekkingService</c> applies to the real figure, for the same reason: a rejected placement contributes nothing
/// either way, so its staleness cannot change any of these numbers.
/// </param>
/// <param name="AantalGedekt">
/// How many in-scope leerplandoelen are covered <b>today</b>, by the same rules as the dekkingsoverzicht; <c>null</c>
/// when <paramref name="IsBetrouwbaar"/> is <c>false</c>. The agenda's dekkingsbalk prints it.
/// <para>
/// There is no leerplandoel figure "if the plan were accepted": no thema placement reaches a leerplandoel
/// (ADR-0052), so it would always equal this one.
/// </para>
/// </param>
/// <param name="AantalLeerplandoelen">
/// How many leerplandoelen are in scope. Always present, because it is a property of the loaded curriculum rather
/// than of this plan. <b>It can legitimately be 0</b>, and a caller must not render that as "alles gedekt".
/// </param>
/// <param name="AantalMinimumdoelenGedekt">
/// How many minimumdoelen of the klas's mijlpaal are covered <b>today</b>: a themadoel of a thema placed as
/// <c>aanvaard</c> or <c>manueel</c> (Art. V.1). <c>null</c> when <paramref name="IsBetrouwbaar"/> is <c>false</c>.
/// </param>
/// <param name="AantalMinimumdoelenMogelijkGedekt">
/// How many of them would be covered if the teacher accepted every thema placement <b>proposal</b> now standing in
/// the plan; <c>null</c> when <paramref name="IsBetrouwbaar"/> is <c>false</c>.
/// <para>
/// It is a ceiling, not coverage (Art. IV.1): rejected and stale placements are excluded, and it is never lower than
/// <paramref name="AantalMinimumdoelenGedekt"/>, because the placements it counts include those. A minimumdoel that
/// two thema's carry counts once.
/// </para>
/// </param>
/// <param name="AantalMinimumdoelen">How many minimumdoelen of the klas's mijlpaal are in scope.</param>
public sealed record Dekkingsvooruitzicht(
    Dekkingsbereik Bereik,
    IReadOnlyList<string> GemetenJaarFasen,
    bool IsTerugvalNaarHeelCurriculum,
    int AantalBuitenBereik,
    bool IsBetrouwbaar,
    int AantalOnopgelosteVervallenPlaatsingen,
    int? AantalGedekt,
    int AantalLeerplandoelen,
    int? AantalMinimumdoelenGedekt,
    int? AantalMinimumdoelenMogelijkGedekt,
    int AantalMinimumdoelen);
