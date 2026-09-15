using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Infrastructure;

/// <summary>
/// Maps the gebruikerbeheer faults (E6-04) to RFC 7807 ProblemDetails, so <c>GebruikersController</c> writes no status
/// plumbing (Art. VIII):
/// <list type="bullet">
/// <item><see cref="GebruikerbeheerNietGevondenFout"/> → 404: no such gebruiker, klas or schooljaar;</item>
/// <item><see cref="GebruikerbeheerValidatieFout"/> → 400: no single sign-in name, a name too long, an unknown
/// jaarfase;</item>
/// <item><see cref="GebruikerbeheerConflictFout"/> → 409: a sign-in name that exists already, and the last directie
/// (ADR-0031 decision 7). Well-formed requests that the current state refuses, so not 400.</item>
/// </list>
/// The <c>Detail</c> is the fault's Dutch sentence, written for directie, who can act on it (Art. II.3 as amended
/// 2026-07-30). Anything else is left to the next handler.
/// </summary>
public sealed class GebruikerbeheerExceptionHandler : IExceptionHandler
{
    private readonly IProblemDetailsService _problemDetailsService;

    public GebruikerbeheerExceptionHandler(IProblemDetailsService problemDetailsService) =>
        _problemDetailsService = problemDetailsService;

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (status, titel) = exception switch
        {
            GebruikerbeheerNietGevondenFout => (StatusCodes.Status404NotFound, Probleemtitels.NietGevonden),
            GebruikerbeheerValidatieFout => (StatusCodes.Status400BadRequest, Probleemtitels.OngeldigeAanvraag),
            GebruikerbeheerConflictFout => (StatusCodes.Status409Conflict, Probleemtitels.NietDoorgevoerd),
            _ => ((int?)null, (string?)null),
        };

        if (status is null)
        {
            return false; // Not ours — let the next handler deal with it.
        }

        httpContext.Response.StatusCode = status.Value;

        return await _problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = status.Value,
                Title = titel,
                Detail = exception.Message,
            },
        });
    }
}
