using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Domain.Curriculum;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// E6-02's sweep (ADR-0030 §3, Art. VI.1): <b>every</b> write route the app maps refuses a signed-in gebruiker who holds
/// no right at all <b>with the authorisation's own 403</b>, unless it is on <see cref="OpenVoorIedereen"/> with the §3 row
/// that opens it.
/// <para>
/// <b>Enumerated from the endpoint data source, like <c>ElkeRouteVraagtEenSessieTests</c></b>, not from a list of
/// controllers or a route prefix, so a route added next month (the agenda routes of another branch, say) fails here the
/// day it merges until someone decides its row. The failure message says how.
/// </para>
/// <para>
/// <b>Resource routes are sent real resources.</b> A resource row answers 404 for an id that names nothing (lookup
/// before authorisation), so the sweep seeds one of everything a route id can name and fills each id with the real one.
/// The wizard's item routes get items <b>the seeded run created</b>, so without their guard the run would let the
/// request through rather than refuse it for its own reasons.
/// </para>
/// <para>
/// <b>Why the detail, not just the status</b> (test-runner D1, antagonist D, slice 3 round 1). Other things answer 403: the
/// anti-forgery check, and a wizard run's state (<c>WizardrunWeigering</c>). Either could hide a route that asks no right.
/// Only the authorisation's refusal carries <see cref="RechtenTestOpzet.GeenToegang"/>, and the tests' stand-in scheme
/// writes it exactly as the cookie does (<c>Aanmelding.SchrijfGeenToegangAsync</c>).
/// </para>
/// </summary>
public sealed class ElkeWijzigendeRouteVraagtEenRechtTests : IAsyncLifetime
{
    private const string Doelcode = "SWEEP-01";

    private static readonly string[] WijzigendeMethoden = ["POST", "PUT", "PATCH", "DELETE"];

    /// <summary>
    /// Write routes deliberately open to every signed-in gebruiker, keyed "METHOD route", each with the ADR-0030 §3 row
    /// that opens it. <b>Empty, and that is the finding:</b> §3 opens no write to every gebruiker today. The one row that
    /// grants "Ander" a write is personal content (R6), and nothing of it is built (E6-10). Signing out is anonymous and
    /// pinned by <c>ElkeRouteVraagtEenSessieTests</c>.
    /// </summary>
    private static readonly Dictionary<string, string> OpenVoorIedereen = new(StringComparer.Ordinal);

    /// <summary>
    /// Routes whose rights resource is read from the body, so the check runs after binding and the sweep must send a
    /// body that binds. Everything else is refused before its body is read.
    /// </summary>
    private static readonly Dictionary<string, object> Lichamen = new(StringComparer.Ordinal)
    {
        // The subthema row at the body's leeftijd (ThemasController.MaakSubthema).
        ["POST api/themas/{themaId:guid}/subthemas"] = new { naam = "Regen", duurWeken = 2, leeftijd = "K3" },
    };

    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("sweep");
        _factory = new PostgresApiFactory(_db.ConnectionString);
        await RechtenTestOpzet.ZaaiDoelAsync(_db, Doelcode);
    }

    public async Task DisposeAsync()
    {
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }

        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    [PostgresFact]
    public async Task Elke_wijzigende_route_weigert_een_gebruiker_zonder_enig_recht()
    {
        var zaad = await ZaaiAsync();
        var opzet = new RechtenTestOpzet(_db, _factory);
        using var client = opzet.Als(await opzet.GebruikerAsync());

        var fouten = new List<string>();
        var bestaand = new HashSet<string>(StringComparer.Ordinal);
        var verzonden = 0;
        foreach (var endpoint in Eindpunten())
        {
            var route = endpoint.RoutePattern.RawText!.TrimStart('/');
            foreach (var methode in Methoden(endpoint).Where(WijzigendeMethoden.Contains))
            {
                var sleutel = $"{methode} {route}";
                bestaand.Add(sleutel);
                if (OpenVoorIedereen.ContainsKey(sleutel))
                {
                    continue;
                }

                using var verzoek = new HttpRequestMessage(new HttpMethod(methode), "/" + VulIn(endpoint.RoutePattern, route, zaad))
                {
                    Content = JsonContent.Create(Lichamen.TryGetValue(sleutel, out var lichaam) ? lichaam : new { }),
                };
                using var antwoord = await client.SendAsync(verzoek);
                verzonden++;

                var detail = await RechtenTestOpzet.DetailAsync(antwoord);
                if (antwoord.StatusCode != HttpStatusCode.Forbidden || detail != RechtenTestOpzet.GeenToegang)
                {
                    fouten.Add(Melding(sleutel, antwoord.StatusCode, detail));
                }
            }
        }

        Assert.True(fouten.Count == 0, string.Join(Environment.NewLine + Environment.NewLine, fouten));

        // The lists above must not outlive their routes: a stale entry would silently open nothing, or hide a rename.
        Assert.All(OpenVoorIedereen.Keys.Concat(Lichamen.Keys), sleutel => Assert.Contains(sleutel, bestaand));

        // A guard on the guard: an enumeration that silently found nothing would pass everything above.
        Assert.True(verzonden >= 70, $"Expected the whole write surface, sent only {verzonden} requests.");
    }

    private static string Melding(string sleutel, HttpStatusCode status, string? detail) =>
        $"{sleutel} answered {(int)status} \"{detail}\" to a gebruiker who holds no right at all; every write route must answer"
        + $" 403 \"{RechtenTestOpzet.GeenToegang}\" here." + Environment.NewLine
        + "Decide its row in ADR-0030 §3 (docs/adr/0030-rollen-en-rechten-in-de-app.md) and declare it on the action:" + Environment.NewLine
        + "  - a row that needs no resource (directie, themabeheer): [Authorize(Policy = Rechtenmatrix.Beleid.<Row>)];" + Environment.NewLine
        + "  - a row about a resource: [RechtOp(Rechtenmatrix.Beleid.<Row>, Rechtbron.<Kind>, \"<route id>\")]." + Environment.NewLine
        + "  A write on one klas's planning (jaarplan, agenda, weekplanning, hoeken, algemene fiches and their placements) is the row"
        + " 'Jaarplan bewerken, (her)genereren, agenda, hoeken, algemene fiches': KlasplanningBewerken on Rechtbron.Klas, or on the"
        + " kind the route id names (a new kind needs a resolver in IRechtenbronnen and a Rechtbron member)." + Environment.NewLine
        + (status == HttpStatusCode.NotFound
            ? "  A 404 means a lookup found nothing for one of the route's ids. Either the route checks no right before its service"
              + " looks the id up (the usual cause: declare its row as above), or this sweep seeded nothing for that id (seed it in"
              + " ZaaiAsync and fill it in Waarde)." + Environment.NewLine
            : string.Empty)
        + (status == HttpStatusCode.Forbidden
            ? "  A 403 with another detail came from something other than the rights check (a wizard run's state, the anti-forgery"
              + " check), which can hide a route that asks no right: declare its row as above." + Environment.NewLine
            : string.Empty)
        + "  If the route is deliberately open to every signed-in gebruiker, add it to OpenVoorIedereen with the §3 row that says so.";

    private IEnumerable<RouteEndpoint> Eindpunten() =>
        _factory.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .Where(e => e.Metadata.GetMetadata<IAllowAnonymous>() is null);

    private static IEnumerable<string> Methoden(RouteEndpoint endpoint) =>
        endpoint.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? [];

    private static string VulIn(RoutePattern patroon, string route, Zaad zaad) =>
        string.Join('/', patroon.PathSegments.Select(segment => string.Concat(segment.Parts.Select(deel => deel switch
        {
            RoutePatternLiteralPart letterlijk => letterlijk.Content,
            RoutePatternSeparatorPart scheiding => scheiding.Content,
            RoutePatternParameterPart parameter => Waarde(parameter, route, zaad),
            _ => "x",
        }))));

    private static bool IsWizardroute(string route) => route.StartsWith("api/thema-opbouw/wizardruns/", StringComparison.Ordinal);

    /// <summary>The seeded resource for each route id, by name; a plaatsing id by the route it is under; a wizard item by its run.</summary>
    private static string Waarde(RoutePatternParameterPart parameter, string route, Zaad zaad) => parameter.Name switch
    {
        "subthemaId" when IsWizardroute(route) => zaad.RunSubthemaId.ToString(),
        "subdoelId" when IsWizardroute(route) => zaad.RunSubdoelId.ToString(),
        "activiteitId" when IsWizardroute(route) => zaad.RunActiviteitId.ToString(),
        "schooljaarId" => zaad.SchooljaarId.ToString(),
        "klasId" => zaad.KlasId.ToString(),
        "themaId" => zaad.ThemaId.ToString(),
        "subthemaId" => zaad.SubthemaId.ToString(),
        "activiteitId" => zaad.ActiviteitId.ToString(),
        "hoekId" => zaad.HoekId.ToString(),
        "ficheId" => zaad.FicheId.ToString(),
        "leerlingId" => zaad.LeerlingId.ToString(),
        "runId" => zaad.RunId.ToString(),
        "plaatsingId" when route.StartsWith("api/hoekplaatsingen/", StringComparison.Ordinal) => zaad.HoekplaatsingId.ToString(),
        "plaatsingId" when route.StartsWith("api/algemene-ficheplaatsingen/", StringComparison.Ordinal) => zaad.FicheplaatsingId.ToString(),
        "blokStart" => "2026-09-07",
        _ when parameter.ParameterPolicies.Any(p => p.Content == "guid") => Guid.NewGuid().ToString(),
        _ when parameter.ParameterPolicies.Any(p => p.Content is "int" or "long") => "1",
        _ => "x",
    };

    /// <summary>One of everything a write route's id can name, made as the default directie identity.</summary>
    private async Task<Zaad> ZaaiAsync()
    {
        var schooljaar = TestSchooljaar.Maak(TestSchooljaar.UniekeNaam("sweep"));
        var klas = schooljaar.VoegKlasToe($"K3-{Guid.NewGuid():N}", "K3");
        await using (var context = _db.MaakContext())
        {
            context.Schooljaren.Add(schooljaar);
            await context.SaveChangesAsync();
        }

        var opzet = new RechtenTestOpzet(_db, _factory);
        var themaId = await opzet.ThemaAsync();
        var subthemaId = await opzet.SubthemaAsync("K3", themaId);
        var activiteit = await opzet.ActiviteitAsync(subthemaId);

        using var client = opzet.Directie();
        var hoekId = await IdAsync(client.PostAsJsonAsync($"/api/klassen/{klas.Id}/hoeken", new { naam = "bouwhoek" }));
        var hoekplaatsingId = await IdAsync(client.PostAsJsonAsync($"/api/klassen/{klas.Id}/hoekplaatsingen", new
        {
            hoekId,
            van = "2026-09-14",
            tot = "2026-09-17",
            begin = "08:00:00",
            einde = "11:50:00",
        }));
        var ficheId = await IdAsync(client.PostAsJsonAsync($"/api/klassen/{klas.Id}/algemene-fiches", new { naam = "Turnen" }));
        var ficheplaatsingId = await IdAsync(client.PostAsJsonAsync($"/api/klassen/{klas.Id}/algemene-ficheplaatsingen", new
        {
            algemeneFicheId = ficheId,
            van = "2026-09-07",
            tot = "2026-09-25",
            weekdagen = new[] { 1 },
            begin = "10:30:00",
            einde = "11:20:00",
        }));

        // A child in the K3 klas (FB-001), so the leerling routes are sent one that exists. Made-up name (Art. VI.7).
        var leerlingId = await IdAsync(client.PostAsJsonAsync($"/api/klassen/{klas.Id}/leerlingen", new { voornaam = "Fien", achternaam = "Proefmans" }));

        // An open run with one item of each kind it creates, so its item routes are sent the run's own items.
        var run = await RechtenTestOpzet.StartWizardAsync(client);
        var wizard = $"{RechtenTestOpzet.Wizard}/{run.Id}";
        var runSubthemaId = await IdAsync(client.PostAsJsonAsync($"{wizard}/subthemas", new { naam = "Wind", duurWeken = 2, leeftijd = "K3" }));
        var runSubdoelId = await IdAsync(client.PostAsJsonAsync($"{wizard}/subthemas/{runSubthemaId}/subdoelen", new { leerplandoelCode = Doelcode }));
        var runActiviteitId = await IdAsync(client.PostAsJsonAsync(
            $"{wizard}/subthemas/{runSubthemaId}/activiteiten", new { naam = "Proef", activiteitType = "Experiment" }));

        return new Zaad(
            schooljaar.Id,
            klas.Id,
            themaId,
            subthemaId,
            activiteit.Id,
            hoekId,
            hoekplaatsingId,
            ficheId,
            ficheplaatsingId,
            leerlingId,
            run.Id,
            runSubthemaId,
            runSubdoelId,
            runActiviteitId);
    }

    private static async Task<Guid> IdAsync(Task<HttpResponseMessage> verzoek)
    {
        using var antwoord = await verzoek;
        Assert.True(antwoord.IsSuccessStatusCode, $"Seeding failed: {(int)antwoord.StatusCode} {await antwoord.Content.ReadAsStringAsync()}");
        return (await antwoord.Content.ReadFromJsonAsync<RechtenTestOpzet.IdDto>())!.Id;
    }

    private sealed record Zaad(
        Guid SchooljaarId,
        Guid KlasId,
        Guid ThemaId,
        Guid SubthemaId,
        Guid ActiviteitId,
        Guid HoekId,
        Guid HoekplaatsingId,
        Guid FicheId,
        Guid FicheplaatsingId,
        Guid LeerlingId,
        Guid RunId,
        Guid RunSubthemaId,
        Guid RunSubdoelId,
        Guid RunActiviteitId);
}
