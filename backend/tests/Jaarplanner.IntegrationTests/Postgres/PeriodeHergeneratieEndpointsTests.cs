using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Application.Planning;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// E4-05 (FR-8.2) at the HTTP boundary, against real PostgreSQL: regenerating <b>one</b> themaperiode changes that
/// period and nothing else, and a period the teacher blocked with a vast moment accepts nothing new from anybody
/// (owner rulings 2026-08-06).
/// <para>
/// <b>Why these cases are here and not only in the unit tests.</b> The service-level tests run against
/// <c>FakeJaarplanOpslag</c>, an in-memory dictionary, and every claim below is about a <i>database</i> path: the
/// scoped discard issues a delete over a child collection of a loaded aggregate, and E7-16 records what happens to
/// exactly that kind of path when it is verified only in memory (the aggregate-growth defect that made every import
/// after the first answer 500 while thirteen in-memory tests stayed green). The status codes are the second half:
/// <b>409 versus 400</b> is a mapping in the API layer that a service test cannot see at all.
/// </para>
/// <para>
/// <b>The AI is stubbed and everything else is real</b> (Art. IV.6): <see cref="PostgresApiFactory.AiAntwoord"/>
/// supplies the completion, and the controller, the service, EF Core and PostgreSQL are the shipping ones. That is
/// the same residual M2 accepted — no live model round-trip on a machine with no <c>AzureAI:ApiKey</c>.
/// </para>
/// </summary>
public sealed class PeriodeHergeneratieEndpointsTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("e405periode");
        _factory = new PostgresApiFactory(_db.ConnectionString);
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
    /// The story's own criterion — <i>only the chosen period changes</i> — asserted over HTTP in the one shape that can
    /// fail: a plan that already holds something in another period, and a proposal in the target period that the run is
    /// entitled to replace.
    /// </summary>
    [PostgresFact]
    public async Task Een_periodehergeneratie_wijzigt_alleen_die_periode()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        // A standing proposal in the target period, and a hand-placed thema in another one.
        var teVervangen = await ZetPlaatsingOpAsync(
            opzet, opzet.WinterThemaId, KoppelingStatus.Voorgesteld, opzet.EersteBlok);
        var elders = await ZetPlaatsingOpAsync(
            opzet, opzet.HerfstThemaId, KoppelingStatus.Manueel, opzet.DerdeBlok);

        _factory.AiAntwoord = Antwoord(("Herfstthema", opzet.EersteBlok));

        var response = await client.PostAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/periodes/{opzet.EersteBlok:yyyy-MM-dd}/generatie",
            content: null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var rapport = await response.Content.ReadFromJsonAsync<RunDto>();
        Assert.NotNull(rapport);
        Assert.True(rapport.IsGeslaagd);
        Assert.Equal(opzet.EersteBlok, rapport.GeregenereerdePeriode);
        Assert.Equal(1, rapport.AantalNieuw);
        Assert.Equal(1, rapport.AantalVervangen);

        // The dekkingsvooruitzicht is attached, which is the obligation the backlog recorded against this story: a
        // second generation route that forgets to compose it returns a report with no coverage figures and nothing
        // fails to say so.
        Assert.NotNull(rapport.Vooruitzicht);

        var plaatsingen = rapport.Jaarplan!.Plaatsingen;

        // The replaceable proposal in the target period is gone, by identity and not merely by shape.
        Assert.DoesNotContain(plaatsingen, p => p.Id == teVervangen);

        // The hand-placement in the other period is untouched, and it kept its own row: a run that deleted and
        // re-created it would look identical by date and status while costing the teacher the placement they were
        // reviewing.
        var bewaard = Assert.Single(plaatsingen, p => p.Id == elders);
        Assert.Equal(opzet.DerdeBlok, bewaard.BlokStart);
        Assert.Equal("Manueel", bewaard.Status);

        // And the new proposal is in the target period, as a proposal.
        var nieuw = Assert.Single(plaatsingen, p => p.BlokStart == opzet.EersteBlok);
        Assert.Equal("Voorgesteld", nieuw.Status);
        Assert.Equal("Herfstthema", nieuw.ThemaNaam);
    }

    /// <summary>
    /// A decided or locked placement inside the regenerated period survives, exactly as in a whole-plan run. Pinned at
    /// the HTTP boundary because it is the promise E4-06's copy makes to teachers in words, and this story is the second
    /// path that could have broken it.
    /// </summary>
    [PostgresFact]
    public async Task Een_aanvaarde_plaatsing_in_de_periode_blijft_staan()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        var aanvaard = await ZetPlaatsingOpAsync(
            opzet, opzet.WinterThemaId, KoppelingStatus.Aanvaard, opzet.EersteBlok);

        _factory.AiAntwoord = Antwoord(("Herfstthema", opzet.EersteBlok));

        var response = await client.PostAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/periodes/{opzet.EersteBlok:yyyy-MM-dd}/generatie",
            content: null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var rapport = await response.Content.ReadFromJsonAsync<RunDto>();
        Assert.Equal(0, rapport!.AantalVervangen);
        Assert.Equal(1, rapport.AantalBehouden);

        var nog = Assert.Single(rapport.Jaarplan!.Plaatsingen, p => p.Id == aanvaard);
        Assert.Equal("Aanvaard", nog.Status);
        Assert.Equal(opzet.EersteBlok, nog.BlokStart);
    }

    /// <summary>
    /// <b>Owner ruling 2026-08-06, clause 1, at the boundary: 409 and nothing changed.</b> The status matters as much
    /// as the refusal — 409 rather than 400 is how the client tells "that period is blocked" from "reload, the grid
    /// moved" without reading Dutch prose out of a <c>detail</c> field.
    /// </summary>
    [PostgresFact]
    public async Task Een_bezette_periode_hergenereren_antwoordt_409_en_wijzigt_niets()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        // Blocked FIRST, and the standing proposal seeded after — deliberately, and the first version of this test had
        // it the other way round and destroyed its own premise. Registering a vast moment goes through
        // `POST …/generatie`, because the settings are saved as part of a run and there is no separate "Bewaren"
        // control; that run is a whole-plan regeneration, so it discards every replaceable proposal, which is exactly
        // what a `Voorgesteld` placement is. The test then asserted "nothing changed" against a plan that E4-04 had
        // legitimately emptied one call earlier.
        await BlokkeerEerstePeriodeAsync(client, opzet);
        var bestaande = await ZetPlaatsingOpAsync(
            opzet, opzet.WinterThemaId, KoppelingStatus.Voorgesteld, opzet.EersteBlok);

        // A canned answer is armed on purpose: if the refusal came after the model call, this run would place it.
        _factory.AiAntwoord = Antwoord(("Herfstthema", opzet.EersteBlok));

        var response = await client.PostAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/periodes/{opzet.EersteBlok:yyyy-MM-dd}/generatie",
            content: null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        // Nothing was placed and nothing was discarded: the standing proposal is exactly as it was.
        var plan = await HaalJaarplanAsync(client, opzet.KlasId);
        var nog = Assert.Single(plan.Plaatsingen);
        Assert.Equal(bestaande, nog.Id);
        Assert.Equal("Voorgesteld", nog.Status);
    }

    /// <summary>
    /// A date that starts no period is a 400, not a 409 — a malformed request rather than a conflict with a setting.
    /// The two codes are the client's only structural way to tell the two situations apart.
    /// </summary>
    [PostgresFact]
    public async Task Een_datum_die_geen_periodebegin_is_antwoordt_400()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();
        _factory.AiAntwoord = Antwoord(("Herfstthema", opzet.EersteBlok));

        var response = await client.PostAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/periodes/{opzet.EersteBlok.AddDays(3):yyyy-MM-dd}/generatie",
            content: null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty((await HaalJaarplanAsync(client, opzet.KlasId)).Plaatsingen);
    }

    /// <summary>
    /// <b>Owner ruling 2026-08-06, clause 2: the teacher is refused too, on both manual routes.</b> Hand-placing into a
    /// blocked period and dragging into one both answer 409, where before this story both succeeded silently.
    /// <para>
    /// The third assertion is the one that keeps the rule non-retroactive: a placement that was already inside the
    /// period can still be moved <b>out</b>. The rule governs the target, never the origin, so it can never trap a
    /// thema the teacher planned before registering the moment.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Een_bezette_periode_weigert_ook_de_leerkracht()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        // Placed BEFORE the moment is registered, which is the realistic order and the only one that produces a
        // placement inside a blocked period.
        var binnen = await ZetPlaatsingOpAsync(
            opzet, opzet.WinterThemaId, KoppelingStatus.Manueel, opzet.EersteBlok);
        await BlokkeerEerstePeriodeAsync(client, opzet);

        // 1. Hand-placing into it: 409.
        var plaatsen = await client.PostAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/plaatsingen",
            new { themaId = opzet.HerfstThemaId, blokStart = opzet.EersteBlok.ToString("yyyy-MM-dd") });
        Assert.Equal(HttpStatusCode.Conflict, plaatsen.StatusCode);

        // 2. Dragging into it: 409 as well. Same rule, same code, different route.
        var elders = await ZetPlaatsingOpAsync(
            opzet, opzet.HerfstThemaId, KoppelingStatus.Manueel, opzet.DerdeBlok);
        var slepen = await client.PutAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/plaatsingen/{elders}/blok",
            new { blokStart = opzet.EersteBlok.ToString("yyyy-MM-dd") });
        Assert.Equal(HttpStatusCode.Conflict, slepen.StatusCode);

        // 3. Moving OUT of it still works: nothing about this rule is retroactive.
        var eruit = await client.PutAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/plaatsingen/{binnen}/blok",
            new { blokStart = opzet.TweedeBlok.ToString("yyyy-MM-dd") });
        Assert.Equal(HttpStatusCode.OK, eruit.StatusCode);

        var plan = await HaalJaarplanAsync(client, opzet.KlasId);
        Assert.Equal(opzet.TweedeBlok, Assert.Single(plan.Plaatsingen, p => p.Id == binnen).BlokStart);
        Assert.Equal(opzet.DerdeBlok, Assert.Single(plan.Plaatsingen, p => p.Id == elders).BlokStart);
    }

    /// <summary>
    /// The read carries the blocked periods with the name of the moment blocking each, so the UI can disable a control
    /// and say why in visible text rather than provoking a 409 to find out (the E3-06 rule). A <b>non-blocking</b>
    /// moment is absent: it costs the period time, it does not close it.
    /// </summary>
    [PostgresFact]
    public async Task Het_jaarplan_meldt_de_bezette_periodes_met_de_naam_van_het_moment()
    {
        var opzet = await ZetOpAsync();
        var client = _factory.CreateClient();

        Assert.Empty((await HaalJaarplanAsync(client, opzet.KlasId)).GeblokkeerdePeriodes);

        _factory.AiAntwoord = Antwoord();
        var instellen = await client.PostAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/generatie",
            new
            {
                gewensteStartthemas = Array.Empty<object>(),
                vasteMomenten = new[]
                {
                    new
                    {
                        naam = "Oudercontact",
                        datum = opzet.EersteBlok.AddDays(2).ToString("yyyy-MM-dd"),
                        blokkeertPlaatsing = true,
                    },
                    new
                    {
                        naam = "Sportdag",
                        datum = opzet.TweedeBlok.AddDays(1).ToString("yyyy-MM-dd"),
                        blokkeertPlaatsing = false,
                    },
                },
            });
        Assert.Equal(HttpStatusCode.OK, instellen.StatusCode);

        var geblokkeerd = (await HaalJaarplanAsync(client, opzet.KlasId)).GeblokkeerdePeriodes;

        var enige = Assert.Single(geblokkeerd);
        Assert.Equal(opzet.EersteBlok, enige.BlokStart);
        Assert.Equal("Oudercontact", enige.MomentNaam);
    }

    private static string Antwoord(params (string Thema, DateOnly Blok)[] plaatsingen) =>
        "{\"plaatsingen\":[" +
        string.Join(",", plaatsingen.Select(p =>
            $"{{\"blokStart\":\"{p.Blok:yyyy-MM-dd}\",\"thema\":\"{p.Thema}\",\"motivatie\":\"past hier\"}}")) +
        "]}";

    /// <summary>
    /// Blocks the first period by saving a vast moment through the endpoint that owns the settings — the same route a
    /// teacher uses, because there deliberately is no separate "Bewaren" control. The canned answer is empty so the run
    /// that carries the settings places nothing of its own and cannot muddy the assertions that follow.
    /// </summary>
    private async Task BlokkeerEerstePeriodeAsync(HttpClient client, Opzet opzet)
    {
        _factory.AiAntwoord = Antwoord();

        var response = await client.PostAsJsonAsync(
            $"/api/klassen/{opzet.KlasId}/jaarplan/generatie",
            new
            {
                gewensteStartthemas = Array.Empty<object>(),
                vasteMomenten = new[]
                {
                    new
                    {
                        naam = "Oudercontact",
                        datum = opzet.EersteBlok.AddDays(2).ToString("yyyy-MM-dd"),
                        blokkeertPlaatsing = true,
                    },
                },
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task<PlanDto> HaalJaarplanAsync(HttpClient client, Guid klasId)
    {
        var response = await client.GetAsync($"/api/klassen/{klasId}/jaarplan");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var plan = await response.Content.ReadFromJsonAsync<PlanDto>();
        Assert.NotNull(plan);

        return plan;
    }

    /// <summary>
    /// A class with two thema's, each carrying one accepted themadoel, and the real block grid asked of the
    /// <see cref="IPlanningsblokIndeling"/> seam rather than assumed — a hard-coded date would make these tests pass or
    /// fail on the grid configuration instead of on the behaviour under test.
    /// </summary>
    private async Task<Opzet> ZetOpAsync()
    {
        await using var context = _db.MaakContext();

        foreach (var code in new[] { "PER-01", "PER-02" })
        {
            if (!await context.Leerplandoelen.AnyAsync(l => l.Code == code))
            {
                context.Leerplandoelen.Add(new Leerplandoel(
                    code,
                    Doelsoort.Gemeenschappelijk,
                    "K3",
                    "Natuur",
                    "Levende natuur",
                    "9.1",
                    tekst: $"Tekst van {code}"));
            }
        }

        // Truncated to fit Schooljaar.Naam's varchar(32).
        var schooljaar = new Schooljaar(
            $"2026-2027-{Guid.NewGuid():N}"[..20],
            new DateOnly(2026, 9, 1),
            new DateOnly(2027, 6, 30));
        var klas = schooljaar.VoegKlasToe($"K3-{Guid.NewGuid():N}", "K3");
        context.Schooljaren.Add(schooljaar);

        var herfst = new Thema("Herfstthema", duurWeken: 5);
        herfst.VoegThemadoelToe(new DoelKoppeling("PER-01", KoppelingStatus.Aanvaard, "anchor"));
        var winter = new Thema("Winterthema", duurWeken: 5);
        winter.VoegThemadoelToe(new DoelKoppeling("PER-02", KoppelingStatus.Aanvaard, "anchor"));
        context.Themas.AddRange(herfst, winter);

        await context.SaveChangesAsync();

        using var scope = _factory.Services.CreateScope();
        var indeling = scope.ServiceProvider.GetRequiredService<IPlanningsblokIndeling>();
        var blokken = indeling.Blokken(schooljaar, JaarplanGeneratieService.GeneratieNiveau);

        return new Opzet(klas.Id, herfst.Id, winter.Id, blokken[0].Start, blokken[1].Start, blokken[2].Start);
    }

    /// <summary>
    /// One placement written straight through the <c>DbContext</c>, standing for what a previous run or a previous edit
    /// left behind. Only the call under test goes over HTTP, so no test depends on a second endpoint for its premise.
    /// </summary>
    private async Task<Guid> ZetPlaatsingOpAsync(
        Opzet opzet,
        Guid themaId,
        KoppelingStatus status,
        DateOnly blokStart)
    {
        await using var context = _db.MaakContext();

        // No Include: the placements are an OWNED collection, so EF loads them with their owner — and `Plaatsingen` is
        // a read-only projection over the backing field rather than a navigation, so Include cannot address it at all.
        // This is exactly how the shipping repository loads the aggregate.
        var jaarplan = await context.Jaarplannen
            .FirstOrDefaultAsync(j => j.KlasId == opzet.KlasId);

        if (jaarplan is null)
        {
            jaarplan = new Jaarplan(opzet.KlasId);
            context.Jaarplannen.Add(jaarplan);
        }

        var plaatsing = jaarplan.VoegPlaatsingToe(
            themaId,
            JaarplanGeneratieService.GeneratieNiveau,
            blokStart,
            status,
            status == KoppelingStatus.Voorgesteld ? "past hier volgens de AI" : null);

        await context.SaveChangesAsync();

        return plaatsing.Id;
    }

    private sealed record Opzet(
        Guid KlasId,
        Guid HerfstThemaId,
        Guid WinterThemaId,
        DateOnly EersteBlok,
        DateOnly TweedeBlok,
        DateOnly DerdeBlok);

    private sealed record RunDto(
        bool IsGeslaagd,
        int AantalNieuw,
        int AantalBehouden,
        int AantalVervangen,
        List<string> BuitenPeriode,
        DateOnly? GeregenereerdePeriode,
        PlanDto? Jaarplan,
        object? Vooruitzicht);

    private sealed record PlanDto(
        List<PlaatsingDto> Plaatsingen,
        List<GeblokkeerdDto> GeblokkeerdePeriodes);

    private sealed record PlaatsingDto(Guid Id, string ThemaNaam, DateOnly BlokStart, string Status);

    private sealed record GeblokkeerdDto(DateOnly BlokStart, string MomentNaam);
}
