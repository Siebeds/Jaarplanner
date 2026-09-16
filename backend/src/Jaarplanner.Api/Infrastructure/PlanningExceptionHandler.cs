using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Application.Planning.Weekplanning;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Infrastructure;

/// <summary>
/// Maps the planning application exceptions to RFC 7807 ProblemDetails so the (thin) controllers never write
/// status-code plumbing (Art. VIII). Three faults become 400:
/// <list type="bullet">
/// <item><see cref="OngeldigePlaatsingsstatusFout"/> — a status the teacher cannot set on a placement (Art. IV.1/IV.2);</item>
/// <item><see cref="OngeldigePlaatsingFout"/> — a thema placed, re-dated or dragged onto days that are no schooldagen,
/// lie outside the year or already belong to another thema (ADR-0053);</item>
/// <item><see cref="OngeldigeDagplanningFout"/> (E9-03) — scheduling an activiteit onto a day the school is closed on
/// or outside the school year, onto a day it already sits on, or from another class.</item>
/// </list>
/// <para>
/// And one becomes <b>409</b>: <see cref="GeneratieUitgeschakeldFout"/> — a generation asked for while it is switched
/// off (ADR-0053 decision 9). The request is well-formed; the feature is what is unavailable.
/// </para>
/// <para>
/// Planning not-found deliberately reuses <c>SchoolcontentNietGevondenFout</c>, which
/// <c>SchoolcontentExceptionHandler</c> already maps to 404. Other exceptions are left to the next handler.
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
            OngeldigePlaatsingsstatusFout or OngeldigePlaatsingFout or OngeldigeDagplanningFout =>
                StatusCodes.Status400BadRequest,
            GeneratieUitgeschakeldFout => StatusCodes.Status409Conflict,
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
                    ? Probleemtitels.GeneratieUitgeschakeld
                    : Probleemtitels.OngeldigeAanvraag,
                Detail = exception.Message,
            },
        });
    }
}
