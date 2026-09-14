using Jaarplanner.Application.Schoolcontent.Wizard;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Infrastructure;

/// <summary>
/// Maps a <see cref="WizardrunWeigering"/> to a 403 (E6-02 slice 3, ADR-0030 I23–I25): the wizard run has ended, the
/// content is not under its thema, or the item is not one it created. A 403 rather than a 409, because what is refused
/// is the wizard's right to do it, not the request's timing: directie, who may do the same on the ordinary routes, is
/// answered the same way here. The detail is the Dutch sentence the service wrote (Art. II.3).
/// </summary>
public sealed class WizardrunExceptionHandler : IExceptionHandler
{
    private readonly IProblemDetailsService _problemDetailsService;

    public WizardrunExceptionHandler(IProblemDetailsService problemDetailsService) =>
        _problemDetailsService = problemDetailsService;

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not WizardrunWeigering)
        {
            return false;
        }

        httpContext.Response.StatusCode = StatusCodes.Status403Forbidden;

        return await _problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status403Forbidden,
                Title = Probleemtitels.GeenToegang,
                Detail = exception.Message,
            },
        });
    }
}
