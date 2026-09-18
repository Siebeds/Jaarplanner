using System.Security.Claims;
using Jaarplanner.Api.Infrastructure.Authenticatie;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Authorization;

namespace Jaarplanner.Api.Infrastructure.Autorisatie;

/// <summary>
/// Registers the ADR-0030 §3 matrix as named authorisation policies (E6-02, Art. VI.1, ADR-0011 §2). The rows
/// themselves are declared once, in <see cref="Rechtenmatrix"/>; this only makes each one a policy under its own name,
/// with one requirement type and one handler for all of them.
/// <para>
/// <b>Every policy requires a signed-in person as well.</b> ASP.NET Core applies the fallback policy only to an endpoint
/// that names no policy of its own, so a route that names one of these would otherwise be reachable anonymously
/// (the note in <see cref="Aanmelding"/>).
/// </para>
/// <para>
/// <b>How a controller applies a row.</b> Resource-free rows (admin, themabeheer):
/// <c>[Authorize(Policy = Rechtenmatrix.Beleid.ThemaBewerken)]</c>. Resource-based rows: build the resource with
/// <see cref="IRechtenbronnen"/> and call <see cref="MagAsync"/>, answering <c>Forbid()</c> when it says no.
/// </para>
/// </summary>
public static class Rechtenbeleid
{
    /// <summary>Registers one policy per <see cref="Rechtenmatrix.Rijen"/> entry, and the handler that decides them.</summary>
    public static IServiceCollection AddRechtenbeleid(this IServiceCollection services)
    {
        services.AddAuthorization(opties =>
        {
            foreach (var rij in Rechtenmatrix.Rijen)
            {
                opties.AddPolicy(
                    rij.Beleid,
                    beleid => beleid.RequireAuthenticatedUser().AddRequirements(new MatrixVereiste(rij)));
            }
        });

        // Scoped, because it reads the per-request rights service (which reads the request's DbContext).
        services.AddScoped<IAuthorizationHandler, MatrixHandler>();

        return services;
    }

    /// <summary>
    /// Whether the signed-in gebruiker may do the row named <paramref name="beleid"/> on <paramref name="bron"/>: the
    /// one call a controller makes for a resource-based row. The name must be one of <see cref="Rechtenmatrix.Beleid"/>.
    /// </summary>
    public static async Task<bool> MagAsync(
        this IAuthorizationService autorisatie,
        ClaimsPrincipal gebruiker,
        object bron,
        string beleid)
    {
        ArgumentNullException.ThrowIfNull(autorisatie);
        var uitkomst = await autorisatie.AuthorizeAsync(gebruiker, bron, beleid);
        return uitkomst.Succeeded;
    }
}

/// <summary>The requirement behind every matrix policy: the row it stands for.</summary>
public sealed class MatrixVereiste : IAuthorizationRequirement
{
    public MatrixVereiste(Matrixrij rij) => Rij = rij ?? throw new ArgumentNullException(nameof(rij));

    /// <summary>The §3 row this policy enforces.</summary>
    public Matrixrij Rij { get; }
}

/// <summary>
/// The one handler for every matrix row: it looks up the caller's rights and asks <see cref="Rechtenmatrix.StaatToe"/>,
/// passing the resource the caller authorised against (or, for an attribute, the <c>HttpContext</c>, which no
/// resource-based column matches). Admin passes every row there (R3) but <c>RapportsetBewerken</c>, the K3 set only
/// the K3 leerkrachten edit (ADR-0035 R31). A principal without a gebruiker id is never allowed.
/// </summary>
public sealed class MatrixHandler : AuthorizationHandler<MatrixVereiste>
{
    private readonly IRechtenService _rechten;

    public MatrixHandler(IRechtenService rechten) => _rechten = rechten;

    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, MatrixVereiste requirement)
    {
        if (Aanmelding.GebruikerId(context.User) is not { } gebruikerId)
        {
            return;
        }

        var geannuleerd = (context.Resource as HttpContext)?.RequestAborted ?? CancellationToken.None;
        var rechten = await _rechten.HaalRechtenOpAsync(gebruikerId, geannuleerd);

        if (Rechtenmatrix.StaatToe(rechten, requirement.Rij, context.Resource))
        {
            context.Succeed(requirement);
        }
    }
}
