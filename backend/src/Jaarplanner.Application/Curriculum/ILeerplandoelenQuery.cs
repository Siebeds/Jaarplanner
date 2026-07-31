namespace Jaarplanner.Application.Curriculum;

/// <summary>
/// Read access to the Op.stap leerplandoel register behind the Doelen screen (E1-16, FR-2.4): browse and
/// search the imported curriculum, and open one doel in full. It is the queryable seam the frontend reads
/// through; the Application/Api layers depend on this abstraction and the EF Core implementation lives in
/// Infrastructure (Art. VIII layering — the port belongs here, never next to its adapter).
/// <para>
/// <b>Read-only, structurally.</b> There is no write method, no mutating overload and no counterpart
/// service: the curriculum is decreed reference data (Art. III.1) and the only sanctioned writer is the
/// Op.stap import path. In particular nothing here can set <c>NietMeerInOpstap</c>, which the re-import
/// owns.
/// </para>
/// <para>
/// <b>Volume is a server concern.</b> After a full import this is thousands of rows, so filtering,
/// searching, counting and paging all happen in the database (see <see cref="LeerplandoelFilter"/>). No
/// method returns the whole table.
/// </para>
/// </summary>
public interface ILeerplandoelenQuery
{
    /// <summary>
    /// One page of leerplandoelen matching <paramref name="filter"/>, ordered
    /// <c>(domein, subdomein, code)</c> for a stable browse order that is identical across pages, together
    /// with the total the filter matches. An empty page with a positive total means the caller paged past
    /// the end; an empty page with a zero total means the filter excludes everything.
    /// </summary>
    Task<LeerplandoelenPagina> ZoekAsync(
        LeerplandoelFilter filter,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// One leerplandoel in full — every imported field, its discipline name, its concordance (and the
    /// decreed minimumdoel when E1-12 has loaded one) and every school-content link with its status.
    /// Returns null when no leerplandoel carries <paramref name="code"/>, so the caller can answer a
    /// deep link to an unknown code honestly rather than showing an empty detail. Matching is
    /// case-insensitive: the code arrives from a URL a teacher may have typed or copied.
    /// </summary>
    Task<LeerplandoelDetailWeergave?> HaalDetailAsync(
        string code,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The filter vocabulary, derived from the loaded rows rather than from any compiled-in list — see
    /// <see cref="LeerplandoelFacettenWeergave"/> for why that is a constraint and not a preference.
    /// Also carries the unfiltered total, which is what distinguishes "nothing imported" from "filtered
    /// to nothing".
    /// </summary>
    Task<LeerplandoelFacettenWeergave> HaalFacettenAsync(
        CancellationToken cancellationToken = default);
}
