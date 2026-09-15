using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Jaarplanner.Api.Infrastructure.Autorisatie;

/// <summary>Which resource a <see cref="RechtOpAttribute"/> builds from the route id it names.</summary>
public enum Rechtbron
{
    /// <summary>A subthema's leeftijd (<see cref="Leeftijdsinhoud"/>).</summary>
    Subthema,

    /// <summary>An activiteit with its leeftijd, maker and links (<see cref="Activiteitbron"/>).</summary>
    Activiteit,

    /// <summary>A thema, with whether it holds someone else's content (<see cref="Themabron"/>, I26).</summary>
    Thema,

    /// <summary>The planning of the klas in the route (<see cref="Klasplanning"/>).</summary>
    Klas,

    /// <summary>The planning of the klas a hoek belongs to.</summary>
    Hoek,

    /// <summary>The planning of the klas a hoekplaatsing is in.</summary>
    Hoekplaatsing,

    /// <summary>The planning of the klas an algemene fiche belongs to.</summary>
    AlgemeneFiche,

    /// <summary>The planning of the klas an algemene ficheplaatsing is in.</summary>
    AlgemeneFicheplaatsing,

    /// <summary>The ontwikkelingsrapport of the klas in the route (<see cref="Application.Toegang.Rapportklas"/>, FB-001).</summary>
    Rapportklas,

    /// <summary>The ontwikkelingsrapport of the klas a leerling is in (FB-001).</summary>
    Leerling,
}

/// <summary>
/// Applies a <b>resource-based</b> row of the ADR-0030 §3 matrix to one action (E6-02 slice 3): builds the resource from
/// the route id with <see cref="IRechtenbronnen"/>, answers 404 when there is none, and otherwise asks
/// <see cref="Rechtenbeleid.MagAsync"/> and answers 403 when it says no. A resource-free row stays an
/// <c>[Authorize(Policy = …)]</c>; this is the slice-1 pattern for the other kind, declared on the action.
/// <para>
/// <b>Why an authorisation filter and not a call inside the action.</b> MVC binds and validates the body before an
/// action runs, so a check in the action answers a caller without the right with a 400 for a malformed body, and the
/// validation result is what they learn. As a filter it runs before binding, like the <c>[Authorize]</c> rows: a caller
/// without the right gets 403 whatever they send. It also puts the route's row on the route, where the sweep test
/// (<c>ElkeWijzigendeRouteVraagtEenRechtTests</c>) and a reader can see it.
/// </para>
/// <para>
/// <b>404 before 403, for a resource row</b> (slice 1's "resource lookup first, then authorisation"). The answer of a
/// resource row depends on the resource, so it cannot be given for one that does not exist; the 404 says so in the
/// same shape and words as the service's own (it is thrown as a <see cref="SchoolcontentNietGevondenFout"/>). A
/// resource-free row answers 403 before any lookup, because its answer does not depend on the resource.
/// </para>
/// <para>
/// Anonymous callers never reach this: the fallback policy answers them 401 in the authorisation middleware first.
/// </para>
/// </summary>
[AttributeUsage(AttributeTargets.Method, AllowMultiple = false, Inherited = false)]
public sealed class RechtOpAttribute : Attribute, IAsyncAuthorizationFilter
{
    /// <param name="beleid">The matrix row, one of <see cref="Rechtenmatrix.Beleid"/>.</param>
    /// <param name="bron">Which resource the route id names.</param>
    /// <param name="routewaarde">The route parameter holding that id, for example <c>"subthemaId"</c>.</param>
    public RechtOpAttribute(string beleid, Rechtbron bron, string routewaarde)
    {
        Beleid = beleid;
        Bron = bron;
        Routewaarde = routewaarde;
    }

    /// <summary>The matrix row this action is.</summary>
    public string Beleid { get; }

    /// <summary>The resource kind the row is checked against.</summary>
    public Rechtbron Bron { get; }

    /// <summary>The route parameter that holds the resource's id.</summary>
    public string Routewaarde { get; }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        if (context.Result is not null)
        {
            return;
        }

        if (!context.RouteData.Values.TryGetValue(Routewaarde, out var waarde) || !Guid.TryParse(waarde?.ToString(), out var id))
        {
            // A misdeclared attribute: the route has no such id. Loud, because a rights check that cannot run must not
            // look like one that ran. The route constraint makes a malformed id impossible.
            throw new InvalidOperationException(
                $"[RechtOp] on {context.ActionDescriptor.DisplayName} names route value '{Routewaarde}', which its route does not carry.");
        }

        var diensten = context.HttpContext.RequestServices;
        var bron = await ZoekAsync(diensten.GetRequiredService<IRechtenbronnen>(), id, context.HttpContext.RequestAborted);
        var autorisatie = diensten.GetRequiredService<IAuthorizationService>();

        if (!await autorisatie.MagAsync(context.HttpContext.User, bron, Beleid))
        {
            context.Result = new ForbidResult();
        }
    }

    /// <summary>
    /// The resource, or the 404 its service would answer. The sentences are the services' own for the same fact, so a
    /// screen reads one wording whichever layer noticed.
    /// </summary>
    private async Task<object> ZoekAsync(IRechtenbronnen bronnen, Guid id, CancellationToken cancellationToken)
    {
        switch (Bron)
        {
            case Rechtbron.Subthema:
                return await bronnen.VoorSubthemaAsync(id, cancellationToken)
                    ?? throw new SchoolcontentNietGevondenFout("Dit subthema bestaat niet meer. Iemand anders heeft het verwijderd.");
            case Rechtbron.Activiteit:
                return await bronnen.VoorActiviteitAsync(id, cancellationToken)
                    ?? throw new SchoolcontentNietGevondenFout("Deze activiteit bestaat niet meer. Iemand anders heeft ze verwijderd.");
            case Rechtbron.Thema:
                return await bronnen.VoorThemaAsync(id, cancellationToken)
                    ?? throw new SchoolcontentNietGevondenFout("Dit thema bestaat niet meer. Iemand anders heeft het verwijderd.");
            case Rechtbron.Klas:
                return await bronnen.VoorKlasAsync(id, cancellationToken)
                    ?? throw new SchoolcontentNietGevondenFout($"Klas {id} is niet gevonden.");
            case Rechtbron.Hoek:
                return await bronnen.VoorHoekAsync(id, cancellationToken)
                    ?? throw new SchoolcontentNietGevondenFout($"Hoek {id} is niet gevonden.");
            case Rechtbron.Hoekplaatsing:
                return await bronnen.VoorHoekplaatsingAsync(id, cancellationToken)
                    ?? throw new SchoolcontentNietGevondenFout($"Hoekplaatsing {id} is niet gevonden.");
            case Rechtbron.AlgemeneFiche:
                return await bronnen.VoorAlgemeneFicheAsync(id, cancellationToken)
                    ?? throw new SchoolcontentNietGevondenFout($"Algemene fiche {id} is niet gevonden.");
            case Rechtbron.AlgemeneFicheplaatsing:
                return await bronnen.VoorAlgemeneFicheplaatsingAsync(id, cancellationToken)
                    ?? throw new SchoolcontentNietGevondenFout($"Plaatsing {id} is niet gevonden.");
            case Rechtbron.Rapportklas:
                return await bronnen.VoorRapportklasAsync(id, cancellationToken)
                    ?? throw new SchoolcontentNietGevondenFout($"Klas {id} is niet gevonden.");
            case Rechtbron.Leerling:
                // Names no child and no id: this sentence can reach a log (ADR-0035 §3.8), and it is the service's own.
                return await bronnen.VoorLeerlingAsync(id, cancellationToken)
                    ?? throw new SchoolcontentNietGevondenFout("Dit kind bestaat niet meer. Iemand anders heeft het verwijderd.");
            default:
                throw new InvalidOperationException($"No resource resolver for {Bron}.");
        }
    }
}
