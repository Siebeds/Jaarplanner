using System.Security.Claims;
using Jaarplanner.Application.Planning.Beheer;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Authorization;

namespace Jaarplanner.Api.Infrastructure.Autorisatie;

/// <summary>
/// The klassen a gebruiker may read (FB-013, ADR-0040), for every list that names klassen: <c>GET /api/klassen</c> and
/// the klassen inside a schooljaar. Each klas is asked the row <c>KlasplanningBekijken</c> on its own
/// <see cref="Klasinzage"/>, the same question its planning routes ask, so no list offers a klas those routes refuse.
/// The rights are read once per request (<c>RechtenService</c>), so the loop costs no query per klas.
/// </summary>
public static class Klasinzagefilter
{
    public static async Task<IReadOnlyList<KlasWeergave>> LeesbaarAsync(
        this IAuthorizationService autorisatie,
        ClaimsPrincipal gebruiker,
        IEnumerable<KlasWeergave> klassen)
    {
        ArgumentNullException.ThrowIfNull(klassen);

        var leesbaar = new List<KlasWeergave>();
        foreach (var klas in klassen)
        {
            if (await autorisatie.MagAsync(gebruiker, Klasinzage.Voor(klas.Id, klas.Jaarfase), Rechtenmatrix.Beleid.KlasplanningBekijken))
            {
                leesbaar.Add(klas);
            }
        }

        return leesbaar;
    }
}
