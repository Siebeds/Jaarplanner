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
/// The decreed minimumdoel a leerplandoel is concorded to (Art. IX.1), when the row exists.
/// <para>
/// <b>It usually does not yet.</b> The per-discipline goal Excel carries the concordance <i>key</i> but no
/// decreed omschrijving (Art. VII.1), so <c>minimumdoelen</c> stays empty until <b>E1-12</b> imports the
/// decreed source. The detail therefore shows the ref with an honest note rather than an empty section:
/// null here means "not loaded", never "not concorded" — that distinction is
/// <see cref="LeerplandoelDetailWeergave.MinimumdoelRef"/>'s job.
/// </para>
/// </summary>
public sealed record MinimumdoelWeergave(
    string Ref,
    string Leeftijd,
    string Nr,
    string Omschrijving);

/// <summary>Which layer of school content a link to a leerplandoel comes from (Art. IX.2).</summary>
public enum KoppelingHerkomst
{
    /// <summary>One of a thema's 2–3 school-wide overarching themadoelen.</summary>
    Themadoel = 0,

    /// <summary>A thema-level AI match suggestion awaiting or carrying a teacher decision (E2-04).</summary>
    Doelsuggestie = 1,

    /// <summary>A class/age-scoped subdoel, per (subthema × leeftijd).</summary>
    Subdoel = 2,

    /// <summary>A class/age-scoped activiteit's goal link.</summary>
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
/// </summary>
/// <param name="Herkomst">Which content layer the link lives in.</param>
/// <param name="ThemaNaam">The owning thema's name (every link resolves to exactly one thema).</param>
/// <param name="Onderdeel">The subthema or activiteit name for a class/age-scoped link; null at thema level.</param>
/// <param name="Status">The persisted link status (Art. IV.2).</param>
public sealed record DoelKoppelingWeergave(
    KoppelingHerkomst Herkomst,
    string ThemaNaam,
    string? Onderdeel,
    KoppelingStatus Status);

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
    IReadOnlyList<DoelKoppelingWeergave> Koppelingen);

/// <summary>One discipline that actually carries loaded leerplandoelen, with how many.</summary>
/// <param name="Nummer">The discipline number ("1", "9.2") — the stable key (Art. VII.0).</param>
/// <param name="Naam">The discipline name, or null when no <c>disciplines</c> row matches the goals' number.</param>
/// <param name="Aantal">How many loaded leerplandoelen belong to it.</param>
public sealed record DisciplineFacet(string Nummer, string? Naam, int Aantal);

/// <summary>One subdomein within a domein, with how many leerplandoelen it holds.</summary>
public sealed record SubdomeinFacet(string Subdomein, int Aantal);

/// <summary>
/// One domein with its subdomeinen nested inside it. The nesting <b>is</b> the Art. VII.0 grouping rule
/// made structural: a subdomein cannot be offered as a filter without the domein that disambiguates it.
/// </summary>
public sealed record DomeinFacet(string Domein, int Aantal, IReadOnlyList<SubdomeinFacet> Subdomeinen);

/// <summary>One doelsoort that occurs in the loaded data, with how many leerplandoelen carry it.</summary>
public sealed record DoelsoortFacet(Doelsoort Doelsoort, int Aantal);

/// <summary>One jaar/fase code that occurs in the loaded data, with how many leerplandoelen carry it.</summary>
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
/// <see cref="TotaalAantalDoelen"/> exists to tell two empty states apart, which the E1-07 audit found
/// collapsed one layer up: "nothing is imported yet" (the likely state today, and beheerderswerk) is a
/// different message from "your filters exclude everything" (offer to clear them). A filtered count of
/// zero cannot distinguish them on its own.
/// </para>
/// </summary>
public sealed record LeerplandoelFacettenWeergave(
    int TotaalAantalDoelen,
    IReadOnlyList<DisciplineFacet> Disciplines,
    IReadOnlyList<DomeinFacet> Domeinen,
    IReadOnlyList<DoelsoortFacet> Doelsoorten,
    IReadOnlyList<JaarFaseFacet> JaarFasen);
