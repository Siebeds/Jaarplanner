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
    /// Write routes deliberately open to every signed-in gebruiker, keyed "METHOD route", each with the ruling that opens
    /// it. <b>One:</b> adding words to one's own woordweb, the personal content of ADR-0043 (D2). That route takes the web
    /// from the caller's session and never from the body, so it reaches no one else's; every action on a web by its id is
    /// the <c>WoordwebBewerken</c> row, and the sweep sends those a web that is not the caller's. Signing out is anonymous
    /// and pinned by <c>ElkeRouteVraagtEenSessieTests</c>.
    /// </summary>
    private static readonly Dictionary<string, string> OpenVoorIedereen = new(StringComparer.Ordinal)
    {
        ["POST api/subthemas/{subthemaId:guid}/woordwebs/eigen/woorden"] =
            "one's own woordweb (ADR-0043 D2): created for the caller, from the session, never for an id in the body",
    };

    /// <summary>
    /// Routes whose rights resource is read from the body, so the check runs after binding and the sweep must send a
    /// body that binds. Everything else is refused before its body is read.
    /// </summary>
    private static readonly Dictionary<string, object> Lichamen = new(StringComparer.Ordinal)
    {
        // The subthema row at the body's leeftijd (ThemasController.MaakSubthema).
        ["POST api/themas/{themaId:guid}/subthemas"] = new { naam = "Regen", duurWeken = 2, leeftijd = "K3" },
        // The own or shared activiteit row, by the body's choice (SubthemasController.MaakActiviteit, ADR-0049 D1, D2).
        ["POST api/subthemas/{subthemaId:guid}/activiteiten"] = new { naam = "Plassen", gedeeld = false },
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

    /// <summary>
    /// With <paramref name="leerlingzorg"/>, the same sweep for a gebruiker whose only right is Leerlingzorg (ADR-0035 R18,
    /// FB-008): it reads every report and writes nothing, so every write route refuses it exactly as it refuses no right.
    /// </summary>
    [PostgresTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Elke_wijzigende_route_weigert_een_gebruiker_zonder_schrijfrecht(bool leerlingzorg)
    {
        var zaad = await ZaaiAsync();
        var opzet = new RechtenTestOpzet(_db, _factory);
        using var client = opzet.Als(await opzet.GebruikerAsync(leerlingzorg: leerlingzorg));

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

    /// <summary>
    /// Read routes on one klas deliberately open to every signed-in gebruiker, keyed "GET route", each with why. Both read
    /// shared content at the klas's leeftijden, which is school-wide and not the klas's planning (Art. IX.2, ADR-0040).
    /// </summary>
    private static readonly Dictionary<string, string> KlasleesroutesOpenVoorIedereen = new(StringComparer.Ordinal)
    {
        ["GET api/themas/{themaId:guid}/voor-klas/{klasId:guid}"] = "a shared thema, narrowed to the klas's leeftijden",
        ["GET api/subthemas/voor-klas/{klasId:guid}"] = "the shared subthema's at the klas's leeftijden (a move's destinations)",
    };

    /// <summary>
    /// Read routes on one klas that Leerlingzorg opens (ADR-0035 R18, FB-008), each with why: the report's own, on the
    /// report's read row. Every other read of a klas stays closed to it, since it reads no klas's planning.
    /// </summary>
    private static readonly Dictionary<string, string> KlasleesroutesVanLeerlingzorg = new(StringComparer.Ordinal)
    {
        ["GET api/klassen/{klasId:guid}/leerlingen"] = "the children of a K3 klas: OntwikkelingsrapportLezen, whose Leerlingzorg column this is",
    };

    /// <summary>
    /// FB-013's sweep (ADR-0040): <b>every</b> read route that names a klas refuses a gebruiker who holds no right at all
    /// with the authorisation's own 403, unless it is on <see cref="KlasleesroutesOpenVoorIedereen"/>; and the klassen
    /// list offers that gebruiker nothing. So a klas read added later fails here until someone decides its row.
    /// With <paramref name="leerlingzorg"/>, the same for a gebruiker whose only right is Leerlingzorg (FB-008), who reads
    /// the routes on <see cref="KlasleesroutesVanLeerlingzorg"/> and no klas's planning.
    /// </summary>
    [PostgresTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Elke_leesroute_op_een_klas_weigert_een_gebruiker_zonder_leesrecht_op_de_planning(bool leerlingzorg)
    {
        var zaad = await ZaaiAsync();
        var opzet = new RechtenTestOpzet(_db, _factory);
        using var client = opzet.Als(await opzet.GebruikerAsync(leerlingzorg: leerlingzorg));

        var fouten = new List<string>();
        var bestaand = new HashSet<string>(StringComparer.Ordinal);
        var verzonden = 0;
        foreach (var endpoint in Eindpunten().Where(e => Methoden(e).Contains("GET") && e.RoutePattern.GetParameter("klasId") is not null))
        {
            var route = endpoint.RoutePattern.RawText!.TrimStart('/');
            var sleutel = $"GET {route}";
            bestaand.Add(sleutel);
            if (KlasleesroutesOpenVoorIedereen.ContainsKey(sleutel))
            {
                continue;
            }

            if (leerlingzorg && KlasleesroutesVanLeerlingzorg.ContainsKey(sleutel))
            {
                var status = await RechtenTestOpzet.StatusAsync(client.GetAsync("/" + VulIn(endpoint.RoutePattern, route, zaad)));
                verzonden++;
                if (status != HttpStatusCode.OK)
                {
                    fouten.Add($"{sleutel} answered {(int)status} to Leerlingzorg, which reads every report (ADR-0035 R18).");
                }

                continue;
            }

            using var antwoord = await client.GetAsync("/" + VulIn(endpoint.RoutePattern, route, zaad));
            verzonden++;

            var detail = await RechtenTestOpzet.DetailAsync(antwoord);
            if (antwoord.StatusCode != HttpStatusCode.Forbidden || detail != RechtenTestOpzet.GeenToegang)
            {
                fouten.Add(
                    $"{sleutel} answered {(int)antwoord.StatusCode} \"{detail}\" to a gebruiker who holds no right at all. A read of one klas's"
                    + " planning must declare [RechtOp(Rechtenmatrix.Beleid.KlasplanningBekijken, Rechtbron.Klasinzage, \"klasId\")]"
                    + " (FB-013, ADR-0040); a route that reads no klas's planning goes on KlasleesroutesOpenVoorIedereen with why.");
            }
        }

        Assert.True(fouten.Count == 0, string.Join(Environment.NewLine + Environment.NewLine, fouten));
        Assert.All(KlasleesroutesOpenVoorIedereen.Keys.Concat(KlasleesroutesVanLeerlingzorg.Keys), sleutel => Assert.Contains(sleutel, bestaand));
        Assert.True(verzonden >= 12, $"Expected every read of a klas, sent only {verzonden} requests.");
        Assert.Empty(await RechtenTestOpzet.KlasIdsAsync(client));
    }

    private static string Melding(string sleutel, HttpStatusCode status, string? detail) =>
        $"{sleutel} answered {(int)status} \"{detail}\" to a gebruiker who holds no right at all; every write route must answer"
        + $" 403 \"{RechtenTestOpzet.GeenToegang}\" here." + Environment.NewLine
        + "Decide its row in ADR-0030 §3 (docs/adr/0030-rollen-en-rechten-in-de-app.md) and declare it on the action:" + Environment.NewLine
        + "  - a row that needs no resource (admin, themabeheer): [Authorize(Policy = Rechtenmatrix.Beleid.<Row>)];" + Environment.NewLine
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
        "woordwebId" => zaad.WoordwebId.ToString(),
        "subdoelvoorstelId" => zaad.SubdoelvoorstelId.ToString(),
        "subthemavoorstelId" => zaad.SubthemavoorstelId.ToString(),
        "activiteitvoorstelId" => zaad.ActiviteitvoorstelId.ToString(),
        // The subdoelplaatsing's leeftijd is a route value (FB-057): a real one, so the rights check runs, not the 400.
        "leeftijd" => "K3",
        "plaatsingId" when route.StartsWith("api/hoekplaatsingen/", StringComparison.Ordinal) => zaad.HoekplaatsingId.ToString(),
        "plaatsingId" when route.StartsWith("api/algemene-ficheplaatsingen/", StringComparison.Ordinal) => zaad.FicheplaatsingId.ToString(),
        "blokStart" => "2026-09-07",
        _ when parameter.ParameterPolicies.Any(p => p.Content == "guid") => Guid.NewGuid().ToString(),
        _ when parameter.ParameterPolicies.Any(p => p.Content is "int" or "long") => "1",
        _ => "x",
    };

    /// <summary>One of everything a write route's id can name, made as the default admin identity.</summary>
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

        using var client = opzet.Admin();
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

        // A seeded directeur's own woordweb (FB-036), so the woordweb routes are sent one that exists and is not the
        // caller's. A seeded one, because a woordweb's owner is a row in gebruikers.
        using var eigenaar = opzet.Als(await opzet.GebruikerAsync(admin: true));
        var woordwebId = await IdAsync(eigenaar.PostAsJsonAsync(
            $"/api/subthemas/{subthemaId}/woordwebs/eigen/woorden", new { woorden = new[] { "regen" } }));

        // One open proposal of each kind (FB-057, FB-025), written straight to the database: only the AI makes them. The
        // activiteitvoorstel is the seeded directeur's, so it is not the caller's either.
        var subthemavoorstel = new Jaarplanner.Domain.Schoolcontent.Subthemavoorstel(themaId, "K3", "Wind", "Waar komt wind vandaan?", 2, "Reden.");
        var subdoelvoorstel = Jaarplanner.Domain.Schoolcontent.Subdoelvoorstel.InSubthema(themaId, "K3", Doelcode, subthemaId, "Reden.");
        var eigenaarId = await opzet.GebruikerAsync(admin: true);
        var activiteitvoorstel = new Jaarplanner.Domain.Schoolcontent.Activiteitvoorstel(
            subthemaId, eigenaarId, "Plassen", null, "Stampen in plassen.", 1, null, [Doelcode], "Reden.");
        await using (var context = _db.MaakContext())
        {
            context.Subthemavoorstellen.Add(subthemavoorstel);
            context.Subdoelvoorstellen.Add(subdoelvoorstel);
            context.Activiteitvoorstellen.Add(activiteitvoorstel);
            context.Entry(activiteitvoorstel).Property<int>("Volgnummer").CurrentValue = 1;
            await context.SaveChangesAsync();
        }

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
            runActiviteitId,
            woordwebId,
            subdoelvoorstel.Id,
            subthemavoorstel.Id,
            activiteitvoorstel.Id);
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
        Guid RunActiviteitId,
        Guid WoordwebId,
        Guid SubdoelvoorstelId,
        Guid SubthemavoorstelId,
        Guid ActiviteitvoorstelId);
}
