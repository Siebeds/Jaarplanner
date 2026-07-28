namespace Jaarplanner.Application.Curriculum;

/// <summary>
/// Read access to the "ongekoppelde doelen" gap list (E2-06, FR-4.4): the Op.stap leerplandoelen that
/// are <b>(nog) niet aan een thema gekoppeld</b>. It is the queryable seam behind the frontend view; the
/// Application/Api layers depend on this abstraction, the EF Core implementation lives in Infrastructure
/// (Art. VIII layering).
/// <para>
/// A leerplandoel counts as <i>gekoppeld</i> when it carries a <c>DoelKoppeling</c> with status
/// <c>aanvaard</c> or <c>manueel</c> anywhere in the school content (a themadoel, an accepted/adjusted
/// thema-doelsuggestie, a subdoel or an activiteit link). <c>voorgesteld</c>/<c>geweigerd</c> links do
/// <b>not</b> count — this matches the coverage semantics of Art. V, so the gap list and dekking agree on
/// what "linked" means. The list is derived read-only reference data and is never mutated (Art. III.1);
/// because it is computed from the current link state, it changes as soon as a teacher accepts/rejects a
/// suggestion or adds a manual link (the "updates as links change" of FR-4.4).
/// </para>
/// </summary>
public interface IOngekoppeldeDoelenQuery
{
    /// <summary>
    /// The leerplandoelen not (yet) linked to any thema, ordered by (domein, subdomein, code) for a
    /// stable browse order. Empty when every leerplandoel carries a real link.
    /// </summary>
    Task<IReadOnlyList<OngekoppeldDoelWeergave>> HaalOngekoppeldeDoelenAsync(
        CancellationToken cancellationToken = default);
}
