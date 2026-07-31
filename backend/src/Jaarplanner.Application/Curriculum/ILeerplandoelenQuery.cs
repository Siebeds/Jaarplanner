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
    /// One leerplandoel in full — every imported field, its discipline name, its concordance and the
    /// school-content links <paramref name="zichtbaarheid"/> permits, each with its status and, when the link
    /// is class-scoped, its klas. Returns null when no leerplandoel carries <paramref name="code"/>, so the
    /// caller can answer a deep link to an unknown code honestly rather than showing an empty detail. Matching
    /// is case-insensitive: the code arrives from a URL a teacher may have typed or copied.
    /// </summary>
    /// <param name="zichtbaarheid">
    /// Which link layers may be surfaced. <b>Required rather than defaulted on purpose:</b> Art. IX.2 scopes
    /// subdoelen and activiteit links per klas and FR-10.2 is an open Art. XIV decision, so a caller must
    /// state its choice instead of inheriting one silently. See <see cref="Koppelingzichtbaarheid"/>.
    /// </param>
    Task<LeerplandoelDetailWeergave?> HaalDetailAsync(
        string code,
        Koppelingzichtbaarheid zichtbaarheid,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The filter vocabulary, derived from the loaded rows rather than from any compiled-in list — see
    /// <see cref="LeerplandoelFacettenWeergave"/> for why that is a constraint and not a preference.
    /// <para>
    /// <paramref name="filter"/> scopes the <b>counts</b>, never the option sets: each dimension is counted
    /// under the rest of the filter, so a number states what picking that option would actually yield, while
    /// the list of options stays put. Pass a default filter for the unscoped vocabulary. The paging fields of
    /// <paramref name="filter"/> are ignored; facets are aggregates.
    /// </para>
    /// <para>
    /// <see cref="LeerplandoelFacettenWeergave.TotaalAantalDoelen"/> stays unfiltered regardless, because it
    /// is what distinguishes "nothing imported" from "filtered to nothing".
    /// </para>
    /// </summary>
    Task<LeerplandoelFacettenWeergave> HaalFacettenAsync(
        LeerplandoelFilter filter,
        CancellationToken cancellationToken = default);
}
