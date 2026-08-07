using Jaarplanner.Application.Planning.Generatie;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Infrastructure;

/// <summary>
/// Maps the planning application exceptions to RFC 7807 ProblemDetails so the (thin) controllers never write
/// status-code plumbing (Art. VIII). Three faults become 400:
/// <list type="bullet">
/// <item><see cref="OngeldigePlaatsingsstatusFout"/> (E3-01) — a teacher asking to set a jaarplan placement back to
/// <c>voorgesteld</c>, which only the AI produces (Art. IV.1/IV.2);</item>
/// <item><see cref="OngeldigeVerplaatsingFout"/> (E3-07) — a move whose target is not a period boundary, or a thema
/// moved onto a period it already occupies;</item>
/// <item><see cref="OngeldigePlaatsingFout"/> (E4-03) — a hand-placement into a period that no longer exists, or of a
/// thema that is already in it.</item>
/// </list>
/// <para>
/// And one becomes <b>409</b>: <see cref="PeriodeIsBezetFout"/> (E4-05) — regenerating, hand-placing into or dragging
/// onto a period the teacher blocked with a vast moment. It is separated from the three above on purpose: that request
/// is well-formed and every id in it exists, so what it collides with is a stored setting of the teacher's own rather
/// than a malformed input. The client uses the distinction to tell "reload, the grid moved" from "that period is
/// blocked" without parsing the <c>Detail</c>.
/// </para>
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
        // Written as an explicit mapping rather than a bool + ternary, so adding a fault cannot land on the wrong
        // status by omission: a new type either appears here with its code or is not handled at all.
        var status = exception switch
        {
            OngeldigePlaatsingsstatusFout or OngeldigeVerplaatsingFout or OngeldigePlaatsingFout =>
                StatusCodes.Status400BadRequest,
            PeriodeIsBezetFout => StatusCodes.Status409Conflict,
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
                Title = status.Value == StatusCodes.Status409Conflict
                    ? Probleemtitels.PeriodeIsBezet
                    : Probleemtitels.OngeldigeAanvraag,
                Detail = exception.Message,
            },
        });
    }
}
