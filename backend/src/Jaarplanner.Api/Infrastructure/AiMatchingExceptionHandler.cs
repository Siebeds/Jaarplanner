using Jaarplanner.Application.AiMatching;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Infrastructure;

/// <summary>
/// Maps the AI goal-matching application exceptions (E2-04/E2-05) to RFC 7807 ProblemDetails so the
/// (thin) controllers never write status-code plumbing (Art. VIII): a <see cref="ThemaNietGevondenFout"/>
/// or <see cref="DoelsuggestieNietGevondenFout"/> becomes 404, and an
/// <see cref="OngeldigeSuggestieStatusFout"/> — a teacher asking for a status they may not set
/// (Art. IV.1/IV.2) — becomes 400. Other exceptions are left to the next handler / default pipeline.
/// </summary>
public sealed class AiMatchingExceptionHandler : IExceptionHandler
{
    private readonly IProblemDetailsService _problemDetailsService;

    public AiMatchingExceptionHandler(IProblemDetailsService problemDetailsService) =>
        _problemDetailsService = problemDetailsService;

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var status = exception switch
        {
            ThemaNietGevondenFout => StatusCodes.Status404NotFound,
            DoelsuggestieNietGevondenFout => StatusCodes.Status404NotFound,
            OngeldigeSuggestieStatusFout => StatusCodes.Status400BadRequest,
            _ => (int?)null,
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
                Title = status.Value == StatusCodes.Status404NotFound ? "Niet gevonden" : "Ongeldige aanvraag",
                Detail = exception.Message,
            },
        });
    }
}
