namespace Jaarplanner.Application.Curriculum;

/// <summary>
/// Read access to the minimumdoelen register behind the "Bekijk minimumdoelen" toggle on the Doelen
/// screen (FR-2.4). It groups minimumdoelen by the (discipline, domein, subdomein) of their concorded
/// leerplandoelen, since a minimumdoel has no discipline of its own (Art. VII.0 / IX.1).
/// <para>
/// <b>Read-only, structurally.</b> Minimumdoelen are decreed reference data (Art. III.1); this interface
/// has no write method. The port belongs in Application; the EF Core implementation lives in Infrastructure
/// (Art. VIII layering).
/// </para>
/// </summary>
public interface IMinimumdoelenQuery
{
    /// <summary>
    /// One page of minimumdoelen matching <paramref name="filter"/>, ordered
    /// (discipline, domein, subdomein, leeftijd, nr), together with the total the filter matches.
    /// </summary>
    Task<MinimumdoelenPagina> ZoekAsync(
        MinimumdoelFilter filter,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The filter vocabulary, derived from the loaded rows. Counts are scoped per dimension
    /// (i.e. each count is computed without that dimension), option sets come from all data.
    /// <see cref="MinimumdoelFacettenWeergave.TotaalAantalMinimumdoelen"/> is always unfiltered.
    /// </summary>
    Task<MinimumdoelFacettenWeergave> HaalFacettenAsync(
        MinimumdoelFilter filter,
        CancellationToken cancellationToken = default);
}
