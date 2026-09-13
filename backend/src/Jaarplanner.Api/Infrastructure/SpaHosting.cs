namespace Jaarplanner.Api.Infrastructure;

/// <summary>
/// How the API serves the built frontend (E7-04, ADR-0034). The route is a constant so the test that pins the
/// anonymous surface names the same pattern the app maps, rather than a copy that could drift from it.
/// </summary>
public static class SpaHosting
{
    /// <summary>
    /// Every path without a file extension, except <c>api</c> and <c>health</c> and anything below them, also behind
    /// extra leading slashes. Route regex constraints ignore case, so <c>API/x</c> is excluded too. An unknown API path
    /// therefore matches nothing and gets the API's own answer instead of <c>index.html</c>.
    /// </summary>
    public const string Route = "{*path:regex(^(?!/*(api|health)(/|$)).*$):nonfile}";
}
