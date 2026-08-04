using Jaarplanner.Application.Curriculum.Import;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Infrastructure;

/// <summary>
/// Maps the Op.stap import's typed fault (E1-15) to RFC 7807 ProblemDetails, so the controller stays free
/// of status-code plumbing and, more importantly, free of any EF Core or Npgsql type (Art. VIII). It
/// follows the three handlers registered before it in Program.cs and returns <c>false</c> for anything
/// that is not its own.
/// <para>
/// <b>The mapping, and why these statuses.</b> An unknown discipline number is a bad <i>request</i>
/// (400): the caller states the discipline, and a typo is theirs to fix. The other two are <b>409
/// Conflict</b>: the request is well-formed and the file may be flawless, but the state of the loaded
/// curriculum refuses it — the decreed minimumdoelen are not there yet (E1-12), or the codes already
/// belong to another discipline. Neither is a server fault, so neither may be a 500.
/// </para>
/// <para>
/// The <c>Detail</c> is the fault's own Dutch message, written where the offending discipline, code or
/// concordance key is known (Art. II.3 as amended 2026-07-30: a message the person running the import can
/// act on is Dutch).
/// </para>
/// <para>
/// <b>The <c>Type</c> discriminates the two 409s (E1-13 fix round 1).</b> They share a status and a title, and
/// a screen that cannot tell them apart has to frame both the same way — which made one of the two frames
/// contradict the <c>Detail</c> printed under it. See <see cref="Probleemsoorten"/> for why this is a
/// <c>type</c> URI rather than a new field or a second title.
/// </para>
/// </summary>
public sealed class OpstapImportExceptionHandler : IExceptionHandler
{
    private readonly IProblemDetailsService _problemDetailsService;

    public OpstapImportExceptionHandler(IProblemDetailsService problemDetailsService) =>
        _problemDetailsService = problemDetailsService;

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (exception is not OpstapImportFout fout)
        {
            return false; // Not ours — let the next handler deal with it.
        }

        var status = fout.Soort == OpstapImportFoutSoort.OnbekendeDiscipline
            ? StatusCodes.Status400BadRequest
            : StatusCodes.Status409Conflict;

        httpContext.Response.StatusCode = status;

        return await _problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = status,
                Title = status == StatusCodes.Status400BadRequest
                    ? Probleemtitels.OngeldigeAanvraag
                    : Probleemtitels.ImportNietDoorgevoerd,
                // Which refusal this is, machine-readably. Null is left unset so the framework's own
                // status-derived URI applies; a caller then falls back to copy that claims nothing.
                Type = Probleemsoorten.VoorOpstapImport(fout.Soort),
                Detail = fout.Message,
            },
        });
    }
}
