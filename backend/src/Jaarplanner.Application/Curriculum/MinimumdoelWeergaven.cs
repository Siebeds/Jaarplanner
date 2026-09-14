using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Curriculum;

/// <summary>
/// One minimumdoel as a row of the Doelen register's minimumdoelen view (FR-2.4), in the decree's own ordering (TB-010).
/// <para>
/// <b>One row per minimumdoel.</b> Until TB-010 a row was a (minimumdoel, bucket) pair, the bucket borrowed from the
/// (discipline, domein, subdomein) of its concorded leerplandoelen, so a minimumdoel taught in two subdomeinen was listed
/// twice. The decree's ordering is the minimumdoel's own, so it has exactly one place.
/// </para>
/// </summary>
/// <param name="Ref">The concordance key (stable identity).</param>
/// <param name="Leeftijd">The minimumdoel leeftijd code: "K-", "4-", or "6-".</param>
/// <param name="Nr">The decreed minimumdoel number.</param>
/// <param name="Omschrijving">The decreed description of the eindterm.</param>
/// <param name="Leergebied">The decree's first level; null when the ordering is not known.</param>
/// <param name="Rubriek">The decree's second level; null exactly when <paramref name="Leergebied"/> is.</param>
/// <param name="Subrubriek">The decree's third level; null for a minimumdoel the decree gives none.</param>
/// <param name="AantalLeerplandoelen">How many stored leerplandoelen concord to it.</param>
/// <param name="JaarFasen">The distinct jaar/fasen of those leerplandoelen, kleuter before lager.</param>
/// <param name="ZonderLeerplandoelReden">
/// Only when no stored leerplandoel concords to it: why, as the last applied leerplandoelen import derived it (owner
/// ruling 2026-09-13); null when that is not known. A stale reason on a minimumdoel that does have a goal is not shown.
/// </param>
/// <param name="ZonderLeerplandoelDoelsets">With a reason that names goal sets: KOV's marks, sorted. Empty otherwise.</param>
public sealed record MinimumdoelRegelWeergave(
    string Ref,
    string Leeftijd,
    string Nr,
    string Omschrijving,
    string? Leergebied,
    string? Rubriek,
    string? Subrubriek,
    int AantalLeerplandoelen,
    IReadOnlyList<string> JaarFasen,
    ZonderLeerplandoelReden? ZonderLeerplandoelReden,
    IReadOnlyList<string> ZonderLeerplandoelDoelsets);

/// <summary>One page of minimumdoelen plus the total the filter matches.</summary>
/// <param name="Regels">The rows of this page, in the register's order.</param>
/// <param name="Totaal">How many minimumdoelen the filter matches in total, ignoring paging.</param>
/// <param name="Overslaan">The offset this page starts at.</param>
/// <param name="Aantal">The page size that was applied.</param>
public sealed record MinimumdoelenPagina(
    IReadOnlyList<MinimumdoelRegelWeergave> Regels,
    int Totaal,
    int Overslaan,
    int Aantal);

/// <summary>
/// The browse/search criteria for the minimumdoelen register. Every dimension is optional.
/// <list type="bullet">
/// <item><see cref="Zoekterm"/> and <see cref="Leeftijd"/> match the minimumdoel itself.</item>
/// <item><see cref="Discipline"/>, <see cref="Domein"/>, <see cref="Subdomein"/> and <see cref="JaarFase"/> match through
/// the concordance: a minimumdoel matches when at least one stored leerplandoel that concords to it matches them all.
/// They are the leerplandoelen register's filter, which the screen shares between its two views.</item>
/// <item><see cref="Leergebied"/>, <see cref="Rubriek"/>, <see cref="Subrubriek"/>, <see cref="ZonderSubrubriek"/> and
/// <see cref="ZonderOrdening"/> select one branch of the tree, for the list only: the facets describe the whole tree.</item>
/// </list>
/// <see cref="Domein"/> and <see cref="Subdomein"/> are one composite dimension (Art. VII.0), and a branch names its
/// levels from the top: both are refused at the edge when a level is missing.
/// </summary>
public sealed record MinimumdoelFilter(
    string? Zoekterm = null,
    string? Discipline = null,
    string? Domein = null,
    string? Subdomein = null,
    string? JaarFase = null,
    int Overslaan = 0,
    int Aantal = MinimumdoelFilter.StandaardPaginaGrootte,
    string? Leeftijd = null,
    string? Leergebied = null,
    string? Rubriek = null,
    string? Subrubriek = null,
    bool ZonderSubrubriek = false,
    bool ZonderOrdening = false)
{
    /// <summary>Default page size.</summary>
    public const int StandaardPaginaGrootte = 50;

    /// <summary>Hard ceiling on a page.</summary>
    public const int MaxPaginaGrootte = 200;

    /// <summary>The leeftijd codes a minimumdoel carries, in the decree's order: einde kleuter, 4e and 6e leerjaar.</summary>
    public static readonly IReadOnlyList<string> Leeftijden = ["K-", "4-", "6-"];

    /// <summary>The same filter without a branch: what the facets count.</summary>
    public MinimumdoelFilter ZonderTak() =>
        this with { Leergebied = null, Rubriek = null, Subrubriek = null, ZonderSubrubriek = false, ZonderOrdening = false };
}

/// <summary>
/// The shape of the minimumdoelen tree under the filter (TB-010): every leergebied, rubriek and subrubriek with how many
/// minimumdoelen it holds, in the decree's order. The counts are minimumdoelen, and since each minimumdoel sits in one
/// branch they add up: the leergebieden plus <see cref="AantalZonderOrdening"/> make <see cref="AantalTreffers"/>.
/// </summary>
/// <param name="TotaalAantalMinimumdoelen">Every stored minimumdoel, whatever the filter.</param>
/// <param name="AantalTreffers">The minimumdoelen the filter matches, branch parameters aside.</param>
/// <param name="AantalZonderOrdening">Of those, the ones whose ordering is not known.</param>
/// <param name="Leergebieden">The tree, in the decree's order.</param>
/// <param name="Leeftijden">Per leeftijd code, the minimumdoelen the rest of the filter matches.</param>
public sealed record MinimumdoelFacettenWeergave(
    int TotaalAantalMinimumdoelen,
    int AantalTreffers,
    int AantalZonderOrdening,
    IReadOnlyList<LeergebiedFacet> Leergebieden,
    IReadOnlyList<LeeftijdFacet> Leeftijden);

/// <summary>One leergebied of the tree and its rubrieken.</summary>
public sealed record LeergebiedFacet(string Naam, int Aantal, IReadOnlyList<RubriekFacet> Rubrieken);

/// <summary>
/// One rubriek, its subrubrieken, and <paramref name="AantalZonderSubrubriek"/>: the minimumdoelen that sit directly
/// under the rubriek because the decree gives them no third level.
/// </summary>
public sealed record RubriekFacet(string Naam, int Aantal, int AantalZonderSubrubriek, IReadOnlyList<SubrubriekFacet> Subrubrieken);

/// <summary>One subrubriek, a leaf branch of the tree.</summary>
public sealed record SubrubriekFacet(string Naam, int Aantal);

/// <summary>How many minimumdoelen one leeftijd code holds under the rest of the filter.</summary>
public sealed record LeeftijdFacet(string Leeftijd, int Aantal);

/// <summary>
/// One minimumdoel in full (TB-010): the decreed fields, its ordering and kind, and the stored leerplandoelen that
/// concord to it per jaar/fase, which is how a teacher sees where the eindterm is worked out year by year.
/// </summary>
/// <param name="JaarFasen">
/// Every jaar/fase of <see cref="Jaarfasen.Alle"/> in order, with the leerplandoelen of that year (possibly none), then
/// any other jaar/fase a concorded goal carries. Always the full row, so the screen needs no jaar/fase vocabulary of its
/// own.
/// </param>
public sealed record MinimumdoelDetailWeergave(
    string Ref,
    string Leeftijd,
    string Nr,
    string Omschrijving,
    string? Leergebied,
    string? Rubriek,
    string? Subrubriek,
    MinimumdoelSoort? Soort,
    bool NietMeerInOpstap,
    int AantalLeerplandoelen,
    IReadOnlyList<JaarFaseLeerplandoelen> JaarFasen,
    ZonderLeerplandoelReden? ZonderLeerplandoelReden,
    IReadOnlyList<string> ZonderLeerplandoelDoelsets);

/// <summary>The leerplandoelen of one jaar/fase that concord to a minimumdoel.</summary>
public sealed record JaarFaseLeerplandoelen(string JaarFase, IReadOnlyList<GeconcordeerdLeerplandoel> Leerplandoelen);

/// <summary>One leerplandoel as the minimumdoel detail lists it.</summary>
public sealed record GeconcordeerdLeerplandoel(
    string Code,
    string Tekst,
    string? DisciplineNaam,
    string Domein,
    string Subdomein,
    bool NietMeerInOpstap);
