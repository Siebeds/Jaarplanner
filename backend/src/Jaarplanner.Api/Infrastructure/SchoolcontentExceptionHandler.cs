using Jaarplanner.Application.Schoolcontent.Beheer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Infrastructure;

/// <summary>
/// Maps the school-content CRUD application exceptions (E1-10) to RFC 7807 ProblemDetails so the (thin)
/// controllers never write status-code plumbing (Art. VIII): a <see cref="SchoolcontentNietGevondenFout"/>
/// becomes 404 and a <see cref="SchoolcontentValidatieFout"/> — a structural/scoping/goal-link breach
/// (Art. IX.2 / III / IV.2) — becomes 400. Other exceptions are left to the default pipeline.
/// </summary>
public sealed class SchoolcontentExceptionHandler : IExceptionHandler
{
    private readonly IProblemDetailsService _problemDetailsService;

    public SchoolcontentExceptionHandler(IProblemDetailsService problemDetailsService) =>
        _problemDetailsService = problemDetailsService;

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var status = exception switch
        {
            SchoolcontentNietGevondenFout => StatusCodes.Status404NotFound,
            SchoolcontentValidatieFout => StatusCodes.Status400BadRequest,
            _ => (int?)null,
        };

        if (status is null)
        {
            return false; // Not ours — let the default handler deal with it.
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
