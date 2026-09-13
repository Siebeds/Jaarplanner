using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Curriculum;

/// <summary>
/// One minimumdoel as shown in the Doelen register's "Bekijk minimumdoelen" view: the decreed
/// fields plus the (discipline, domein, subdomein) bucket it appears in (derived from its concorded
/// leerplandoelen, since a minimumdoel has no discipline of its own — Art. VII.0 / IX.1).
/// <para>
/// A minimumdoel may appear in more than one bucket when its concorded leerplandoelen span more than
/// one (discipline, domein, subdomein) — that is correct and not forced into a single bucket.
/// </para>
/// <para>
/// <b>A minimumdoel no loaded leerplandoel concords is listed too, once, without a bucket</b> (E1-22): its
/// <see cref="DisciplineNummer"/>, <see cref="Domein"/> and <see cref="Subdomein"/> are null and
/// <see cref="LeerplandoelCodes"/> is empty. Before E1-22 the register inner-joined the concordance, so such a
/// minimumdoel was invisible: all 998 right after the minimumdoelen import, and six after the G goals (ADR-0032
/// decision 5). That null says only that no loaded goal refers to it; it is never a gap the teachers left.
/// </para>
/// </summary>
/// <param name="Ref">The concordance key (stable identity).</param>
/// <param name="Leeftijd">The minimumdoel leeftijd code: "K-", "4-", or "6-".</param>
/// <param name="Nr">The decreed minimumdoel number.</param>
/// <param name="Omschrijving">The decreed description of the eindterm.</param>
/// <param name="DisciplineNummer">The discipline number this bucket belongs to; null when no loaded goal concords it.</param>
/// <param name="DisciplineNaam">The discipline name; null without a bucket, or on a defensive lookup miss the FK prevents.</param>
/// <param name="Domein">The domein of this bucket; null when no loaded goal concords it.</param>
/// <param name="Subdomein">The subdomein of this bucket; null when no loaded goal concords it.</param>
/// <param name="LeerplandoelCodes">Codes of the concorded leerplandoelen in this bucket, for cross-reference.</param>
/// <param name="ZonderLeerplandoelReden">
/// On a row without a bucket only: why no loaded leerplandoel concords it, as the last applied leerplandoelen import
/// derived it (owner ruling 2026-09-13); null when that is not known. Always null on a row with a bucket.
/// </param>
/// <param name="ZonderLeerplandoelDoelsets">With a reason that names goal sets: KOV's marks, sorted. Empty otherwise.</param>
public sealed record MinimumdoelRegelWeergave(
    string Ref,
    string Leeftijd,
    string Nr,
    string Omschrijving,
    string? DisciplineNummer,
    string? DisciplineNaam,
    string? Domein,
    string? Subdomein,
    IReadOnlyList<string> LeerplandoelCodes,
    ZonderLeerplandoelReden? ZonderLeerplandoelReden,
    IReadOnlyList<string> ZonderLeerplandoelDoelsets);

/// <summary>One page of minimumdoelen plus the total the filter matches.</summary>
/// <param name="Regels">The rows of this page, ordered (discipline, domein, subdomein, leeftijd, nr).</param>
/// <param name="Totaal">How many rows the filter matches in total, ignoring paging.</param>
/// <param name="Overslaan">The offset this page starts at.</param>
/// <param name="Aantal">The page size that was applied.</param>
public sealed record MinimumdoelenPagina(
    IReadOnlyList<MinimumdoelRegelWeergave> Regels,
    int Totaal,
    int Overslaan,
    int Aantal);

/// <summary>
/// The browse/search criteria for the minimumdoelen register. Every dimension is optional.
/// <para>
/// <see cref="Domein"/> and <see cref="Subdomein"/> are one composite dimension (Art. VII.0): a bare
/// <see cref="Subdomein"/> without a <see cref="Domein"/> is refused at the edge, exactly as on the
/// leerplandoel register.
/// </para>
/// </summary>
public sealed record MinimumdoelFilter(
    string? Zoekterm = null,
    string? Discipline = null,
    string? Domein = null,
    string? Subdomein = null,
    string? JaarFase = null,
    int Overslaan = 0,
    int Aantal = MinimumdoelFilter.StandaardPaginaGrootte)
{
    /// <summary>Default page size.</summary>
    public const int StandaardPaginaGrootte = 50;

    /// <summary>Hard ceiling on a page.</summary>
    public const int MaxPaginaGrootte = 200;
}

/// <summary>
/// The filter vocabulary for the minimumdoelen register. Structurally identical to
/// <see cref="LeerplandoelFacettenWeergave"/> except that there is no doelsoort dimension (minimumdoelen
/// do not have one). The counts are scoped per dimension ("the rest of the filter"), the option sets
/// come from the whole loaded data, and <see cref="TotaalAantalMinimumdoelen"/> is always unfiltered.
/// <para>
/// The per-dimension counts are <b>rows</b> (one per minimumdoel and bucket), which is what the register lists under
/// each heading. How many <b>minimumdoelen</b> the filter matches is <see cref="AantalTreffers"/>: summing the domein
/// counts double-counts a minimumdoel taught in two subdomeinen and misses one no loaded goal concords (E1-22).
/// </para>
/// </summary>
/// <param name="TotaalAantalMinimumdoelen">Every stored minimumdoel, whatever the filter.</param>
/// <param name="AantalTreffers">Distinct minimumdoelen the whole filter matches, concorded or not.</param>
/// <param name="AantalZonderLeerplandoel">
/// Of those, the ones no loaded leerplandoel concords. Always zero under a discipline, domein or jaar/fase filter, since
/// those dimensions come from the concorded goals.
/// </param>
/// <param name="Disciplines">Per discipline, rows under the rest of the filter.</param>
/// <param name="Domeinen">Per domein and subdomein, rows under the rest of the filter.</param>
/// <param name="JaarFasen">Per jaar/fase of the concorded goals, minimumdoelen under the rest of the filter.</param>
public sealed record MinimumdoelFacettenWeergave(
    int TotaalAantalMinimumdoelen,
    int AantalTreffers,
    int AantalZonderLeerplandoel,
    IReadOnlyList<DisciplineFacet> Disciplines,
    IReadOnlyList<DomeinFacet> Domeinen,
    IReadOnlyList<JaarFaseFacet> JaarFasen);
