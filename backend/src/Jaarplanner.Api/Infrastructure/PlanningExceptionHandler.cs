using Jaarplanner.Application.Planning.Generatie;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Infrastructure;

/// <summary>
/// Maps the planning application exceptions to RFC 7807 ProblemDetails so the (thin) controllers never write
/// status-code plumbing (Art. VIII). Both faults become 400:
/// <list type="bullet">
/// <item><see cref="OngeldigePlaatsingsstatusFout"/> (E3-01) — a teacher asking to set a jaarplan placement back to
/// <c>voorgesteld</c>, which only the AI produces (Art. IV.1/IV.2);</item>
/// <item><see cref="OngeldigeVerplaatsingFout"/> (E3-07) — a move whose target is not a period boundary, or a thema
/// moved onto a period it already occupies;</item>
/// <item><see cref="OngeldigePlaatsingFout"/> (E4-03) — a hand-placement into a period that no longer exists, or of a
/// thema that is already in it.</item>
/// </list>
/// <para>
/// Planning not-found deliberately reuses <c>SchoolcontentNietGevondenFout</c>, which
/// <c>SchoolcontentExceptionHandler</c> already maps to 404, as <c>KlasBeheerService</c> has done since E1. Other
/// exceptions are left to the next handler / default pipeline.
/// </para>
/// </summary>
public sealed class PlanningExceptionHandler : IExceptionHandler
{
    private readonly IProblemDetailsService _problemDetailsService;

    public PlanningExceptionHandler(IProblemDetailsService problemDetailsService) =>
        _problemDetailsService = problemDetailsService;

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not (OngeldigePlaatsingsstatusFout or OngeldigeVerplaatsingFout or OngeldigePlaatsingFout))
        {
            return false; // Not ours — let the next handler deal with it.
        }

        httpContext.Response.StatusCode = StatusCodes.Status400BadRequest;

        return await _problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = Probleemtitels.OngeldigeAanvraag,
                Detail = exception.Message,
            },
        });
    }
}
