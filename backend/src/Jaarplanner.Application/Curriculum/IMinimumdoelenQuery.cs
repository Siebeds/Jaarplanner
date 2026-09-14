namespace Jaarplanner.Application.Curriculum;

/// <summary>
/// Read access to the minimumdoelen register behind the Minimumdoelen view of the Doelen screen (FR-2.4), in the decree's
/// own ordering, leergebied › rubriek › subrubriek (TB-010). A minimumdoel whose ordering is not known is listed after
/// the others.
/// <para>
/// <b>Read-only, structurally.</b> Minimumdoelen are decreed reference data (Art. III.1); this interface
/// has no write method. The port belongs in Application; the EF Core implementation lives in Infrastructure
/// (Art. VIII layering).
/// </para>
/// </summary>
public interface IMinimumdoelenQuery
{
    /// <summary>
    /// One page of minimumdoelen matching <paramref name="filter"/>, in the tree's order (leergebied, rubriek, subrubriek,
    /// then leeftijd and number), together with how many the filter matches.
    /// </summary>
    Task<MinimumdoelenPagina> ZoekAsync(
        MinimumdoelFilter filter,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The tree under <paramref name="filter"/> (its branch parameters ignored) with a count per branch, plus a count per
    /// leeftijd under the rest of the filter. <see cref="MinimumdoelFacettenWeergave.TotaalAantalMinimumdoelen"/> is
    /// always unfiltered.
    /// </summary>
    Task<MinimumdoelFacettenWeergave> HaalFacettenAsync(
        MinimumdoelFilter filter,
        CancellationToken cancellationToken = default);

    /// <summary>One minimumdoel with its concorded leerplandoelen per jaar/fase, or null when no minimumdoel has that ref.</summary>
    Task<MinimumdoelDetailWeergave?> HaalDetailAsync(
        string minimumdoelRef,
        CancellationToken cancellationToken = default);
}
