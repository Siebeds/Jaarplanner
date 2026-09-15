using Jaarplanner.Application.Ai;
using Jaarplanner.Application.AiMatching;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Infrastructure;

/// <summary>
/// Maps the AI goal-matching application exceptions (E2-04/E2-05/E2-08) to RFC 7807 ProblemDetails so the
/// (thin) controllers never write status-code plumbing (Art. VIII): a <see cref="ThemaNietGevondenFout"/>
/// or <see cref="DoelsuggestieNietGevondenFout"/> becomes 404, and an
/// <see cref="OngeldigeSuggestieStatusFout"/> — a teacher asking for a status they may not set
/// (Art. IV.1/IV.2) — or an <see cref="OngeldigeDoelsubstitutieFout"/> — an "aanpassen" pointing at a code
/// Op.stap does not carry or one already linked (Art. III.5, Art. V) — becomes 400. So do the two refusals of
/// TB-007, from the matching and the thema-opbouw assist alike: a <see cref="JaarfaseKeuzeNodigFout"/> (no jaar/fase to
/// search in) and a <see cref="PromptTeGrootFout"/> (over the prompt ceiling). Each carries a Dutch sentence the person
/// who asked can act on, and in both the model was not called. Other exceptions are left to the next handler / default
/// pipeline.
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
            OngeldigeDoelsubstitutieFout => StatusCodes.Status400BadRequest,
            JaarfaseKeuzeNodigFout => StatusCodes.Status400BadRequest,
            PromptTeGrootFout => StatusCodes.Status400BadRequest,
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
                Title = status.Value == StatusCodes.Status404NotFound
                    ? Probleemtitels.NietGevonden
                    : Probleemtitels.OngeldigeAanvraag,
                Detail = exception.Message,
            },
        });
    }
}
