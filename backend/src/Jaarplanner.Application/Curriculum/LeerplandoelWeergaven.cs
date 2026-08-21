using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Curriculum;

/// <summary>
/// One row of the Doelen register (E1-16 clause 1). Deliberately narrow: the register renders thousands of
/// these, so it carries only what a row shows — the code as its spine, the doelsoort (colour token +
/// abbreviation, Art. XII), the jaar/fase, the <c>(domein, subdomein)</c> browse context (Art. VII.0) and
/// the goal text. The full content lives on <see cref="LeerplandoelDetailWeergave"/>, one request away.
/// <para>
/// <see cref="NietMeerInOpstap"/> travels with the row because it is a review flag a teacher must see
/// while scanning, not something to discover only after opening the doel: it marks a goal that has
/// disappeared from Op.stap while teacher content still links to it (Art. III.4 / IV.2).
/// </para>
/// </summary>
/// <param name="Code">The unique, stable leerplandoel code (Art. III.5).</param>
/// <param name="Doelsoort">The goal type, serialised by name (MD/G/+/P/S/A via the enum).</param>
/// <param name="JaarFase">The jaar/fase code.</param>
/// <param name="Domein">The domein — part of the composite browse key.</param>
/// <param name="Subdomein">The subdomein — unique only together with the domein (Art. VII.0).</param>
/// <param name="Tekst">The official goal text (Excel J).</param>
/// <param name="MinimumdoelRef">The concordance key, or null when this doel is not concorded.</param>
/// <param name="NietMeerInOpstap">True when the re-import flagged this doel as gone from Op.stap but still in use.</param>
public sealed record LeerplandoelRegelWeergave(
    string Code,
    Doelsoort Doelsoort,
    string JaarFase,
    string Domein,
    string Subdomein,
    string Tekst,
    string? MinimumdoelRef,
    bool NietMeerInOpstap);

/// <summary>
/// One page of the register plus the <see cref="Totaal"/> the filter matches. The total is what lets the UI
/// say "50 van 2 480" and decide whether a "meer laden" action is honest; without it, a full page and the
/// last page look identical.
/// </summary>
/// <param name="Regels">The rows of this page, ordered <c>(domein, subdomein, code)</c>.</param>
/// <param name="Totaal">How many leerplandoelen the filter matches in total, ignoring paging.</param>
/// <param name="Overslaan">The offset this page starts at (echoed back so a client can page statelessly).</param>
/// <param name="Aantal">The page size that was applied (may be smaller than requested only by the max).</param>
public sealed record LeerplandoelenPagina(
    IReadOnlyList<LeerplandoelRegelWeergave> Regels,
    int Totaal,
    int Overslaan,
    int Aantal);

/// <summary>
/// The decreed minimumdoel a leerplandoel is concorded to (Art. IX.1).
/// <para>
/// <b>Today a non-null <see cref="LeerplandoelDetailWeergave.MinimumdoelRef"/> always brings this object with
/// it, and cannot fail to.</b> <c>leerplandoelen.MinimumdoelRef</c> is a <c>Restrict</c> FK to
/// <c>minimumdoelen.Ref</c>, so a goal naming a ref whose row does not exist cannot be committed at all
/// (SQLSTATE 23503) — which is exactly why <b>no</b> MD-concorded goal can be imported until <b>E1-12</b>
/// supplies the decreed source, and why the whole table is empty rather than partially populated.
/// </para>
/// <para>
/// The two fields stay separate anyway, and the frontend renders a third branch for "ref present, omschrijving
/// not loaded". That branch is <b>unreachable while the FK stands</b> and is pinned only by
/// <c>Doeldetail.test.tsx</c> ("keeps the ref and says the decreed text is not loaded"). It exists because
/// relaxing that FK is a plausible resolution of the E1-03/E1-12 blockage, and on that day this server code
/// would run in production for the first time. Do not read the branch as describing today's data.
/// </para>
/// <para>
/// <i>Corrected 2026-07-31 (antagonist finding 13).</i> This doc previously read as though the detail already
/// shows unloaded refs ("it usually does not yet ... the detail therefore shows the ref with an honest note"),
/// which describes a row the schema forbids.
/// </para>
/// </summary>
public sealed record MinimumdoelWeergave(
    string Ref,
    string Leeftijd,
    string Nr,
    string Omschrijving);

/// <summary>
/// Which layer of school content a link to a leerplandoel comes from (Art. IX.2).
/// <para>
/// The scope is <b>not</b> uniform across these four, and the difference is load-bearing:
/// <see cref="Themadoel"/> and <see cref="Doelsuggestie"/> are school-wide, while <see cref="Subdoel"/> and
/// <see cref="Activiteit"/> belong to <b>one klas and one leeftijd</b>. A reader who cannot tell them apart
/// would take another class's planning for a school-wide fact, which is why a class-scoped link always
/// carries <see cref="DoelKoppelingWeergave.KlasNaam"/> and why
/// <see cref="Koppelingzichtbaarheid"/> exists.
/// </para>
/// </summary>
public enum KoppelingHerkomst
{
    /// <summary>One of a thema's 2–3 school-wide overarching themadoelen. School-scoped.</summary>
    Themadoel = 0,

    /// <summary>A thema-level AI match suggestion awaiting or carrying a teacher decision (E2-04). School-scoped.</summary>
    Doelsuggestie = 1,

    /// <summary>A subdoel, per (subthema × leeftijd). <b>Class/age-scoped.</b></summary>
    Subdoel = 2,

    /// <summary>An activiteit's goal link. <b>Class/age-scoped</b> (it inherits its subthema's scope).</summary>
    Activiteit = 3,
}

/// <summary>
/// One link between this leerplandoel and a piece of school content (E1-16 clause 3): where it comes from,
/// which thema it belongs to, and the human-in-the-loop <see cref="Status"/> (Art. IV.2).
/// <para>
/// All four link layers are reported, including <c>voorgesteld</c> and <c>geweigerd</c> ones. That is
/// deliberately wider than the coverage definition of Art. V (which counts only <c>aanvaard</c>/
/// <c>manueel</c>): this screen answers "which thema's mention this doel, and what did the teacher decide?",
/// and hiding an open suggestion would answer a different question. The status is on every row so the
/// reader can tell the two apart.
/// </para>
/// <para>
/// <b><see cref="KlasNaam"/> is what keeps a class-scoped link from posing as a school-wide one.</b> A subdoel
/// or an activiteit belongs to one klas and one leeftijd (Art. IX.2); rendering it next to a themadoel with no
/// distinction would tell a teacher that "this doel is used in thema Herfst" when what is true is "L3 uses it
/// in Herfst". It is null exactly when the layer is school-scoped, so the two cannot be confused by omission
/// either.
/// </para>
/// </summary>
/// <param name="Herkomst">Which content layer the link lives in, and therefore its scope.</param>
/// <param name="ThemaNaam">The owning thema's name (every link resolves to exactly one thema).</param>
/// <param name="Onderdeel">The subthema or activiteit name for a class/age-scoped link; null at thema level.</param>
/// <param name="KlasNaam">
/// The klas a class/age-scoped link belongs to (Art. IX.2); null for the school-wide layers. Null is also
/// possible in principle for a class-scoped row whose klas row has gone, which the <c>Restrict</c> FK on
/// <c>subthemas.KlasId</c> prevents; the frontend still degrades to naming no klas rather than crashing.
/// </param>
/// <param name="Status">The persisted link status (Art. IV.2).</param>
public sealed record DoelKoppelingWeergave(
    KoppelingHerkomst Herkomst,
    string ThemaNaam,
    string? Onderdeel,
    string? KlasNaam,
    KoppelingStatus Status);

/// <summary>
/// Another leerplandoel concorded to the <b>same</b> minimumdoel as the one being viewed (mobile-frontend
/// comparison build, FR-2.4-adjacent): a teacher opening one doel can see at a glance which other goals a
/// government minimumdoel groups together, without leaving the detail screen. Deliberately narrow — the
/// same fields as a register row, since this is a browse pointer, not a second copy of the detail.
/// </summary>
/// <param name="Code">The related leerplandoel's code.</param>
/// <param name="Tekst">Its goal text.</param>
/// <param name="JaarFase">Its jaar/fase, since two goals sharing one minimumdoel often sit at different jaar/fases.</param>
/// <param name="Domein">Its domein.</param>
/// <param name="Subdomein">Its subdomein.</param>
public sealed record GerelateerdLeerplandoelWeergave(
    string Code,
    string Tekst,
    string JaarFase,
    string Domein,
    string Subdomein);

/// <summary>
/// Everything one leerplandoel holds (E1-16 clause 3): the official Op.stap content, its place in the
/// taxonomy, its concordance, and the school content that links to it. Read-only throughout (Art. III.1) —
/// there is no write counterpart to this record anywhere.
/// <para>
/// The optional text fields (<see cref="Cluster"/>, <see cref="Voorbeelden"/>, <see cref="Toelichting"/>,
/// <see cref="Woordenschat"/>) are null when Op.stap left the column empty, and the UI omits the section
/// rather than rendering a label with nothing under it.
/// </para>
/// </summary>
public sealed record LeerplandoelDetailWeergave(
    string Code,
    Doelsoort Doelsoort,
    string JaarFase,
    string DisciplineNummer,
    string? DisciplineNaam,
    string Domein,
    string Subdomein,
    string? Cluster,
    string Tekst,
    string? Voorbeelden,
    string? Toelichting,
    string? Woordenschat,
    string? MinimumdoelRef,
    MinimumdoelWeergave? Minimumdoel,
    bool NietMeerInOpstap,
    IReadOnlyList<DoelKoppelingWeergave> Koppelingen,
    IReadOnlyList<GerelateerdLeerplandoelWeergave> GerelateerdeDoelen);

/// <summary>
/// One discipline that carries loaded leerplandoelen, with how many the <b>rest of the active filter</b>
/// leaves in it (see <see cref="LeerplandoelFacettenWeergave"/> for what "the rest" means).
/// </summary>
/// <param name="Nummer">The discipline number ("1", "9.2") — the stable key (Art. VII.0).</param>
/// <param name="Naam">
/// The discipline name. <b>Not null in practice:</b> <c>leerplandoelen.DisciplineNummer</c> is required with a
/// <c>Restrict</c> FK to <c>disciplines.Nummer</c>, so a goal whose discipline has no row cannot be committed.
/// It stays nullable because the query resolves the name through a defensive left join rather than an inner
/// one, so a schema change can never silently drop goals from this list; a consumer must still handle null,
/// and falls back to the number, which is the stable key anyway.
/// </param>
/// <param name="Aantal">How many leerplandoelen this discipline would yield under the rest of the filter.</param>
public sealed record DisciplineFacet(string Nummer, string? Naam, int Aantal);

/// <summary>One subdomein within a domein, and how many goals it would yield under the rest of the filter.</summary>
public sealed record SubdomeinFacet(string Subdomein, int Aantal);

/// <summary>
/// One domein with its subdomeinen nested inside it. The nesting <b>is</b> the Art. VII.0 grouping rule
/// made structural: a subdomein cannot be offered as a filter without the domein that disambiguates it.
/// <see cref="Aantal"/> is always the sum of <see cref="Subdomeinen"/>'s counts, so the tree cannot drift
/// from its leaves.
/// </summary>
public sealed record DomeinFacet(string Domein, int Aantal, IReadOnlyList<SubdomeinFacet> Subdomeinen);

/// <summary>One doelsoort that occurs in the loaded data, and its count under the rest of the filter.</summary>
public sealed record DoelsoortFacet(Doelsoort Doelsoort, int Aantal);

/// <summary>One jaar/fase code that occurs in the loaded data, and its count under the rest of the filter.</summary>
public sealed record JaarFaseFacet(string JaarFase, int Aantal);

/// <summary>
/// The filter vocabulary of the Doelen register, <b>derived entirely from the loaded data</b> (E1-16).
/// <para>
/// This is not a convenience. Three Art. XIV decisions touch exactly these lists: which disciplines are in
/// scope, whether <c>leergebied</c>/Wereldoriëntatie is surfaced as a grouping, and whether Excel col F
/// uses 1K/2K/3K or JK/K2/K3. A hard-coded enum in the UI would answer all three silently, and would then
/// disagree with the database the day an import lands. So the register offers what is there, and nothing
/// else.
/// </para>
/// <para>
/// <b>The option sets are stable; the counts are scoped to the active filter.</b> Which options exist comes
/// from the whole curriculum, so a select never loses entries while a teacher is using it. Each count is
/// computed under <i>the rest of</i> the filter, meaning every dimension except the one being counted, so a
/// number answers "how many would I get if I picked this?" and a zero is reported as <c>0</c> rather than
/// hidden. Before this, picking Discipline = Wiskunde still offered <i>Natuur (3)</i>, a control stating a
/// positive number and delivering nothing (antagonist finding 12). Whether a zero-count option should
/// disappear entirely is a directie question and is deliberately <b>not</b> answered here.
/// </para>
/// <para>
/// <see cref="TotaalAantalDoelen"/> is the one figure that stays <b>unfiltered</b>, because its job is to tell
/// two empty states apart, which the E1-07 audit found collapsed one layer up: "nothing is imported yet" (the
/// likely state today, and beheerderswerk) is a different message from "your filters exclude everything"
/// (offer to clear them). A filtered count of zero cannot distinguish them on its own, so scoping this one to
/// the filter would break the distinction it exists to make.
/// </para>
/// </summary>
/// <param name="TotaalAantalDoelen">
/// How many leerplandoelen are loaded in total, <b>ignoring the filter</b>. Zero means nothing is imported.
/// </param>
public sealed record LeerplandoelFacettenWeergave(
    int TotaalAantalDoelen,
    IReadOnlyList<DisciplineFacet> Disciplines,
    IReadOnlyList<DomeinFacet> Domeinen,
    IReadOnlyList<DoelsoortFacet> Doelsoorten,
    IReadOnlyList<JaarFaseFacet> JaarFasen);
