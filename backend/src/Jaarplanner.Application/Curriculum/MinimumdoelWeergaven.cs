namespace Jaarplanner.Application.Curriculum;

/// <summary>
/// One minimumdoel as shown in the Doelen register's "Bekijk minimumdoelen" view: the decreed
/// fields plus the (discipline, domein, subdomein) bucket it appears in (derived from its concorded
/// leerplandoelen, since a minimumdoel has no discipline of its own — Art. VII.0 / IX.1).
/// <para>
/// A minimumdoel may appear in more than one bucket when its concorded leerplandoelen span more than
/// one (discipline, domein, subdomein) — that is correct and not forced into a single bucket.
/// </para>
/// </summary>
/// <param name="Ref">The concordance key (stable identity).</param>
/// <param name="Leeftijd">The minimumdoel leeftijd code: "K-", "4-", or "6-".</param>
/// <param name="Nr">The decreed minimumdoel number.</param>
/// <param name="Omschrijving">The decreed description of the eindterm.</param>
/// <param name="DisciplineNummer">The discipline number this bucket belongs to.</param>
/// <param name="DisciplineNaam">The discipline name (null only on a defensive left-join miss, which the FK prevents).</param>
/// <param name="Domein">The domein of this bucket.</param>
/// <param name="Subdomein">The subdomein of this bucket.</param>
/// <param name="LeerplandoelCodes">Codes of the concorded leerplandoelen in this bucket, for cross-reference.</param>
public sealed record MinimumdoelRegelWeergave(
    string Ref,
    string Leeftijd,
    string Nr,
    string Omschrijving,
    string DisciplineNummer,
    string? DisciplineNaam,
    string Domein,
    string Subdomein,
    IReadOnlyList<string> LeerplandoelCodes);

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
/// </summary>
public sealed record MinimumdoelFacettenWeergave(
    int TotaalAantalMinimumdoelen,
    IReadOnlyList<DisciplineFacet> Disciplines,
    IReadOnlyList<DomeinFacet> Domeinen,
    IReadOnlyList<JaarFaseFacet> JaarFasen);
