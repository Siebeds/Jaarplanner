using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Planning.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.Planning;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Jaarplanner.IntegrationTests;

/// <summary>
/// <b>The reachability test for E3-01.</b> It drives the jaarplan endpoints the way a caller actually reaches them —
/// HTTP → controller → <c>JaarplanGeneratieService</c> → <c>IPlanningsblokIndeling</c> → EF — through the <b>real
/// DI container</b> with only the AI client and the database provider swapped.
/// <para>
/// It exists because three consecutive audits on this project found "done" features nobody could reach, most
/// recently E2's <c>MatchThemaAsync</c>, which is called from nothing but its own unit tests. A service that only
/// unit tests call is not done, so this test asserts the whole route: create a schooljaar, create a klas in it,
/// create a thema, <c>POST …/jaarplan/generatie</c>, and read the proposal back with <c>GET …/jaarplan</c>.
/// </para>
/// <para>
/// The DbContext is the EF Core in-memory provider so no Postgres container is needed — it runs in CI/dev exactly as
/// written. Real-database guarantees (the unique one-plan-per-class index, the <c>date</c> mapping of the block key,
/// cascade/restrict behaviour) are covered by <c>Postgres/JaarplanPersistentieTests</c>.
/// </para>
/// </summary>
public sealed class JaarplanEndpointsTests : IClassFixture<JaarplanEndpointsTests.Factory>
{
    private readonly Factory _factory;

    public JaarplanEndpointsTests(Factory factory) => _factory = factory;

    /// <summary>
    /// The story's <i>Done when</i>, exercised end-to-end through HTTP: a class yields a reviewable generated plan
    /// via the faked AI client, keyed on the planningsblok's start date, persisted as a <c>voorgesteld</c> proposal.
    /// </summary>
    [Fact]
    public async Task Een_klas_levert_een_beoordeelbaar_gegenereerd_jaarplan_op()
    {
        var client = _factory.CreateClient();
        var (klasId, blokStart) = await _factory.SeedAsync();
        _factory.AiAntwoord =
            $"{{\"plaatsingen\":[{{\"blokStart\":\"{blokStart:yyyy-MM-dd}\",\"thema\":\"Herfst\"," +
            "\"motivatie\":\"seizoen past bij het begin van het schooljaar\"}]}";

        // Before generation the class already HAS a plan — an empty one (Art. IX.3), not a 404.
        var leeg = await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan");
        Assert.Empty(leeg!.Plaatsingen);

        var generatie = await client.PostAsync($"/api/klassen/{klasId}/jaarplan/generatie", content: null);
        Assert.Equal(HttpStatusCode.OK, generatie.StatusCode);

        var resultaat = await generatie.Content.ReadFromJsonAsync<GeneratieDto>();
        Assert.True(resultaat!.IsGeslaagd);
        Assert.Equal(1, resultaat.AantalNieuw);

        // Reload through a brand-new GET — proving it was persisted, not just returned.
        var plan = await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan");
        var plaatsing = Assert.Single(plan!.Plaatsingen);

        Assert.Equal("Herfst", plaatsing.ThemaNaam);
        Assert.Equal("Voorgesteld", plaatsing.Status);                            // advisory (Art. IV.1/IV.2)
        Assert.Equal("seizoen past bij het begin van het schooljaar", plaatsing.AiMotivatie); // motivation (Art. IV.3)
        Assert.False(plaatsing.Vergrendeld);
        Assert.Equal(blokStart, plaatsing.BlokStart);                             // keyed on the START DATE
        Assert.False(plaatsing.IsVervallen);
        Assert.NotNull(plaatsing.BlokEind);
        Assert.Equal("Themaperiode", plaatsing.BlokNiveau);
    }

    /// <summary>
    /// <b>The reachability test for E3-04.</b> The pre-generation parameters (FR-5.4) arrive over HTTP as a real JSON
    /// body and measurably change what is persisted: the AI proposes a thema in the first block, the teacher has
    /// blocked that period with a vast moment, and the placement is refused.
    /// <para>
    /// It exists for the same reason the test above it does. The unit tests call <c>GenereerAsync</c> directly, so they
    /// prove the logic and say nothing about whether the body binds — and adding a constructor overload to
    /// <c>VastMoment</c> would break the only enforced parameter with every other test still green. That is precisely
    /// the shape of the defect that got M2 withdrawn on this project.
    /// </para>
    /// </summary>
    [Fact]
    public async Task Een_vast_moment_uit_de_request_body_weigert_een_plaatsing()
    {
        var client = _factory.CreateClient();
        var (klasId, blokStart) = await _factory.SeedAsync();
        _factory.AiAntwoord =
            $"{{\"plaatsingen\":[{{\"blokStart\":\"{blokStart:yyyy-MM-dd}\",\"thema\":\"Herfst\"," +
            "\"motivatie\":\"seizoen past bij het begin van het schooljaar\"}]}";

        var generatie = await client.PostAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/generatie",
            new
            {
                vasteMomenten = new[]
                {
                    new { naam = "Schoolfeest", datum = blokStart.ToString("yyyy-MM-dd"), blokkeertPlaatsing = true },
                },
            });

        Assert.Equal(HttpStatusCode.OK, generatie.StatusCode);
        var resultaat = await generatie.Content.ReadFromJsonAsync<GeneratieDto>();

        // The run succeeds and the parameter changed the outcome: nothing was placed.
        Assert.True(resultaat!.IsGeslaagd);
        Assert.Equal(0, resultaat.AantalNieuw);

        var geweigerd = Assert.Single(resultaat.Parameters!.GeweigerdDoorVastMoment);
        Assert.Equal("Herfst", geweigerd.ThemaNaam);
        Assert.Equal("Schoolfeest", geweigerd.MomentNaam);
        Assert.Equal(blokStart, geweigerd.BlokStart);

        // The model's own motivation survives the refusal, so the teacher can still act on the proposal.
        Assert.Equal("seizoen past bij het begin van het schooljaar", geweigerd.AiMotivatie);
        Assert.True(resultaat.Parameters!.HeeftAandachtspunten);

        // And it really was not persisted — proven by a fresh GET, not by the response body.
        var plan = await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan");
        Assert.Empty(plan!.Plaatsingen);
    }

    /// <summary>
    /// <c>blokkeertPlaatsing</c> has no default and is <c>[JsonRequired]</c>, so omitting it is a 400 rather than a
    /// silent <c>false</c>. Without this, a UI form that forgot one checkbox would post a parameter with no effect on
    /// the result and no signal that it did nothing — the one thing CLAUDE.md's E3-06 rule forbids outright.
    /// </summary>
    [Fact]
    public async Task Een_vast_moment_zonder_blokkeertPlaatsing_is_een_400_geen_stille_false()
    {
        var client = _factory.CreateClient();
        var (klasId, blokStart) = await _factory.SeedAsync();

        var generatie = await client.PostAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/generatie",
            new
            {
                vasteMomenten = new[] { new { naam = "Schoolfeest", datum = blokStart.ToString("yyyy-MM-dd") } },
            });

        Assert.Equal(HttpStatusCode.BadRequest, generatie.StatusCode);
    }

    /// <summary>
    /// <b>The reachability test for E3-04's persistence half</b> (owner ruling 2026-07-30): the settings a teacher
    /// posts are kept, readable back over <c>GET …/jaarplan/parameters</c>, and honoured by a <i>later</i> run that
    /// posts nothing at all — which is how an FR-8/E4 regeneration inherits a blocked period.
    /// <para>
    /// Driven over HTTP rather than only through the service, because the story is a wire-contract change as well as a
    /// schema change: the startthema entry now carries its own <c>blokStart</c> instead of relying on array position.
    /// A service-level test would pass with a controller that never bound the new shape.
    /// </para>
    /// </summary>
    [Fact]
    public async Task Bewaarde_parameters_zijn_uitleesbaar_en_gelden_bij_een_volgende_run()
    {
        var client = _factory.CreateClient();
        var (klasId, blokStart) = await _factory.SeedAsync();
        _factory.AiAntwoord =
            $"{{\"plaatsingen\":[{{\"blokStart\":\"{blokStart:yyyy-MM-dd}\",\"thema\":\"Herfst\"," +
            "\"motivatie\":\"seizoen past bij het begin van het schooljaar\"}]}";

        // Nothing kept yet: 200 with empty lists, never a 404 — "no settings" is the normal state.
        var leeg = await client.GetFromJsonAsync<ParametersDto>($"/api/klassen/{klasId}/jaarplan/parameters");
        Assert.Empty(leeg!.GewensteStartthemas);
        Assert.Empty(leeg.VasteMomenten);

        var eerste = await client.PostAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/generatie",
            new
            {
                gewensteStartthemas = new[]
                {
                    new { blokStart = blokStart.ToString("yyyy-MM-dd"), themaNaam = "Herfst" },
                },
                vasteMomenten = new[]
                {
                    new { naam = "Schoolfeest", datum = blokStart.ToString("yyyy-MM-dd"), blokkeertPlaatsing = false },
                },
            });
        Assert.Equal(HttpStatusCode.OK, eerste.StatusCode);

        // The startthema was honoured, which is only true if the controller bound `blokStart` rather than a position.
        var eersteResultaat = await eerste.Content.ReadFromJsonAsync<GeneratieDto>();
        Assert.Equal(["Herfst"], eersteResultaat!.Parameters!.GehonoreerdeStartthemas);

        // Read back through a fresh GET: persisted, and keyed on the block's start date.
        var bewaard = await client.GetFromJsonAsync<ParametersDto>($"/api/klassen/{klasId}/jaarplan/parameters");
        var keuze = Assert.Single(bewaard!.GewensteStartthemas);
        Assert.Equal(blokStart, keuze.BlokStart);
        Assert.Equal("Herfst", keuze.ThemaNaam);
        var moment = Assert.Single(bewaard.VasteMomenten);
        Assert.Equal("Schoolfeest", moment.Naam);
        Assert.False(moment.BlokkeertPlaatsing);

        // Now block that period and regenerate WITHOUT a body: the stored constraint must still apply.
        //
        // The status of this POST is asserted, like every other one here. An earlier draft discarded it, and it was
        // returning 500 from a defect this test was written to catch: replacing an owned collection whose key EF
        // generated. The failure surfaced two requests later, and the unasserted call is the reason it looked mysterious.
        var blokkeer = await client.PostAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/generatie",
            new
            {
                vasteMomenten = new[]
                {
                    new { naam = "Schoolfeest", datum = blokStart.ToString("yyyy-MM-dd"), blokkeertPlaatsing = true },
                },
            });
        Assert.Equal(HttpStatusCode.OK, blokkeer.StatusCode);

        var hergeneratie = await client.PostAsync($"/api/klassen/{klasId}/jaarplan/generatie", content: null);
        Assert.Equal(HttpStatusCode.OK, hergeneratie.StatusCode);
        var resultaat = await hergeneratie.Content.ReadFromJsonAsync<GeneratieDto>();

        // The period the teacher marked as bezet stayed bezet, on a run that said nothing about it.
        Assert.Equal(0, resultaat!.AantalNieuw);
        var geweigerd = Assert.Single(resultaat.Parameters!.GeweigerdDoorVastMoment);
        Assert.Equal("Schoolfeest", geweigerd.MomentNaam);

        // Posting an explicitly empty body clears the settings, which is the only way to clear them.
        var gewist = await client.PostAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/generatie",
            new { gewensteStartthemas = Array.Empty<object>(), vasteMomenten = Array.Empty<object>() });
        Assert.Equal(HttpStatusCode.OK, gewist.StatusCode);

        var na = await client.GetFromJsonAsync<ParametersDto>($"/api/klassen/{klasId}/jaarplan/parameters");
        Assert.Empty(na!.GewensteStartthemas);
        Assert.Empty(na.VasteMomenten);
    }

    /// <summary>
    /// A kept start thema whose <c>blokStart</c> is no longer a period boundary is <b>reported</b> over the wire, not
    /// dropped and not moved to a neighbouring period — the ruling directie made for stale placements on 2026-07-28,
    /// applied to the parameter that now survives long enough to hit it.
    /// </summary>
    [Fact]
    public async Task Een_startthema_op_een_verdwenen_periodegrens_wordt_gerapporteerd()
    {
        var client = _factory.CreateClient();
        var (klasId, blokStart) = await _factory.SeedAsync();
        var geenBlokgrens = blokStart.AddDays(1);

        var generatie = await client.PostAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/generatie",
            new
            {
                gewensteStartthemas = new[]
                {
                    new { blokStart = geenBlokgrens.ToString("yyyy-MM-dd"), themaNaam = "Herfst" },
                },
            });

        Assert.Equal(HttpStatusCode.OK, generatie.StatusCode);
        var resultaat = await generatie.Content.ReadFromJsonAsync<GeneratieDto>();

        var vervallen = Assert.Single(resultaat!.Parameters!.VervallenStartthemas);
        Assert.Equal("Herfst", vervallen.ThemaNaam);
        Assert.Equal(geenBlokgrens, vervallen.BlokStart);
        Assert.True(resultaat.Parameters!.HeeftAandachtspunten);

        // Kept, so reverting the vakantie edit restores it.
        var bewaard = await client.GetFromJsonAsync<ParametersDto>($"/api/klassen/{klasId}/jaarplan/parameters");
        Assert.Equal(geenBlokgrens, Assert.Single(bewaard!.GewensteStartthemas).BlokStart);
    }

    /// <summary>
    /// An invalid AI response yields 422 with a diagnostic and leaves the plan untouched — no partial application
    /// (Art. IV.5). 422 rather than 500: nothing is broken, the model answered badly.
    /// </summary>
    [Fact]
    public async Task Een_ongeldig_AI_antwoord_geeft_422_en_wijzigt_het_plan_niet()
    {
        var client = _factory.CreateClient();
        var (klasId, _) = await _factory.SeedAsync();
        _factory.AiAntwoord = "dit is geen JSON {kapot";

        var generatie = await client.PostAsync($"/api/klassen/{klasId}/jaarplan/generatie", content: null);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, generatie.StatusCode);

        var plan = await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan");
        Assert.Empty(plan!.Plaatsingen);
    }

    /// <summary>The teacher's decision and lock both persist across a reload (Art. IV.2, Art. IX.3).</summary>
    [Fact]
    public async Task Beslissing_en_vergrendeling_overleven_een_herlaad()
    {
        var client = _factory.CreateClient();
        var (klasId, blokStart) = await _factory.SeedAsync();
        _factory.AiAntwoord =
            $"{{\"plaatsingen\":[{{\"blokStart\":\"{blokStart:yyyy-MM-dd}\",\"thema\":\"Herfst\",\"motivatie\":\"seizoen\"}}]}}";

        await client.PostAsync($"/api/klassen/{klasId}/jaarplan/generatie", content: null);
        var plan = await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan");
        var plaatsingId = Assert.Single(plan!.Plaatsingen).Id;

        var status = await client.PutAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}/status", new { status = "Aanvaard" });
        Assert.Equal(HttpStatusCode.OK, status.StatusCode);

        var slot = await client.PutAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}/vergrendeling", new { vergrendeld = true });
        Assert.Equal(HttpStatusCode.OK, slot.StatusCode);

        var na = await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan");
        var bijgewerkt = Assert.Single(na!.Plaatsingen);
        Assert.Equal("Aanvaard", bijgewerkt.Status);
        Assert.True(bijgewerkt.Vergrendeld);

        // And a regeneration leaves the locked, accepted placement exactly where it is (Art. IX.3, Art. IV.1).
        _factory.AiAntwoord = """{"plaatsingen":[]}""";
        await client.PostAsync($"/api/klassen/{klasId}/jaarplan/generatie", content: null);

        var naHergeneratie = await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan");
        var overlevend = Assert.Single(naHergeneratie!.Plaatsingen);
        Assert.Equal(plaatsingId, overlevend.Id);
        Assert.Equal(blokStart, overlevend.BlokStart);
    }

    /// <summary>
    /// <b>The escape hatch, over HTTP.</b> A placement can be deleted even when accepted and locked, and the response
    /// carries the updated plan. Without this route the <c>Klas</c> delete guard was a trap: one accepted placement
    /// made the class undeletable forever while the guard's message instructed an action the API did not offer.
    /// </summary>
    [Fact]
    public async Task Een_plaatsing_kan_verwijderd_worden_ook_als_ze_aanvaard_en_vergrendeld_is()
    {
        var client = _factory.CreateClient();
        var (klasId, blokStart) = await _factory.SeedAsync();
        _factory.AiAntwoord =
            $"{{\"plaatsingen\":[{{\"blokStart\":\"{blokStart:yyyy-MM-dd}\",\"thema\":\"Herfst\",\"motivatie\":\"seizoen\"}}]}}";

        await client.PostAsync($"/api/klassen/{klasId}/jaarplan/generatie", content: null);
        var plan = await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan");
        var plaatsingId = Assert.Single(plan!.Plaatsingen).Id;

        // Make it a human decision AND lock it — the state that blocks a klas delete. Both status codes are
        // asserted because this test's whole claim is "ook als ze aanvaard en vergrendeld is": if either PUT
        // regressed to 400/404 the placement would stay Voorgesteld and unlocked, the DELETE below would still
        // succeed, and the test would pass while proving nothing.
        var beslissing = await client.PutAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}/status", new { status = "Aanvaard" });
        Assert.Equal(HttpStatusCode.OK, beslissing.StatusCode);

        var vergrendeling = await client.PutAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}/vergrendeling", new { vergrendeld = true });
        Assert.Equal(HttpStatusCode.OK, vergrendeling.StatusCode);

        // Read the premise back rather than trusting the two 200s — this is the state under test.
        var voorVerwijderen = Assert.Single(
            (await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan"))!.Plaatsingen);
        Assert.Equal("Aanvaard", voorVerwijderen.Status);
        Assert.True(voorVerwijderen.Vergrendeld);

        var verwijder = await client.DeleteAsync($"/api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}");
        Assert.Equal(HttpStatusCode.OK, verwijder.StatusCode);

        // The response already carries the updated plan, so no re-fetch is needed to render the result.
        Assert.Empty((await verwijder.Content.ReadFromJsonAsync<JaarplanDto>())!.Plaatsingen);

        // And it is genuinely gone on a fresh GET.
        var na = await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan");
        Assert.Empty(na!.Plaatsingen);

        // Deleting it twice is a 404, not a silent success.
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await client.DeleteAsync($"/api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}")).StatusCode);
    }

    /// <summary>
    /// <b>The E3-07 move, over HTTP</b> (FR-6.2/FR-6.5): the placement lands on another period, is persisted at once,
    /// and comes back as <c>manueel</c> without the motivation that argued for the period it left.
    /// <para>
    /// The target period is read from <c>GET /api/schooljaren/{id}/rooster</c> — the same endpoint the kalender draws
    /// its columns from — rather than hard-coded or taken from the seam directly. That is deliberate: it proves the
    /// board a teacher drops onto and the endpoint that accepts the drop agree about where a period starts. A test
    /// that computed the boundary itself could pass while the two disagreed.
    /// </para>
    /// </summary>
    [Fact]
    public async Task Een_plaatsing_kan_naar_een_andere_periode_verplaatst_worden()
    {
        var client = _factory.CreateClient();
        var (klasId, blokStart) = await _factory.SeedAsync();
        _factory.AiAntwoord =
            $"{{\"plaatsingen\":[{{\"blokStart\":\"{blokStart:yyyy-MM-dd}\",\"thema\":\"Herfst\",\"motivatie\":\"seizoen\"}}]}}";

        await client.PostAsync($"/api/klassen/{klasId}/jaarplan/generatie", content: null);
        var plan = await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan");
        var voor = Assert.Single(plan!.Plaatsingen);
        Assert.Equal("Voorgesteld", voor.Status);
        Assert.Equal("seizoen", voor.AiMotivatie);

        // The board's own view of where the periods start.
        var rooster = await client.GetFromJsonAsync<RoosterDto>($"/api/schooljaren/{plan.SchooljaarId}/rooster");
        var doel = rooster!.Blokken.First(b => b.Start != voor.BlokStart);

        var verplaats = await client.PutAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/plaatsingen/{voor.Id}/blok", new { blokStart = doel.Start });
        Assert.Equal(HttpStatusCode.OK, verplaats.StatusCode);

        // The response carries the updated plan, so the UI never has to re-fetch to render the drop.
        var uitResponse = Assert.Single((await verplaats.Content.ReadFromJsonAsync<JaarplanDto>())!.Plaatsingen);
        Assert.Equal(doel.Start, uitResponse.BlokStart);
        Assert.Equal(doel.Ordinaal, uitResponse.BlokOrdinaal);

        // And it is genuinely persisted — the immediate-save half of FR-6.5, read back on a fresh request.
        var na = Assert.Single((await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan"))!.Plaatsingen);
        Assert.Equal(voor.Id, na.Id);
        Assert.Equal(doel.Start, na.BlokStart);
        Assert.False(na.IsVervallen);

        // The position is the teacher's now, and the plan no longer credits the model for it.
        Assert.Equal("Manueel", na.Status);
        Assert.Null(na.AiMotivatie);
    }

    /// <summary>
    /// A move to a date that starts no period is a <b>400</b> with the plan untouched: refused, never snapped to the
    /// nearest period (ADR-0020, directie 2026-07-28). An unknown placement is a 404.
    /// </summary>
    [Fact]
    public async Task Verplaatsen_naar_een_niet_bestaande_periodegrens_geeft_400_en_wijzigt_niets()
    {
        var client = _factory.CreateClient();
        var (klasId, blokStart) = await _factory.SeedAsync();
        _factory.AiAntwoord =
            $"{{\"plaatsingen\":[{{\"blokStart\":\"{blokStart:yyyy-MM-dd}\",\"thema\":\"Herfst\",\"motivatie\":\"seizoen\"}}]}}";

        await client.PostAsync($"/api/klassen/{klasId}/jaarplan/generatie", content: null);
        var plan = await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan");
        var plaatsingId = Assert.Single(plan!.Plaatsingen).Id;

        // One day past a real boundary — the nearest period is unambiguous, which is the point of refusing.
        var response = await client.PutAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}/blok",
            new { blokStart = blokStart.AddDays(1) });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var na = Assert.Single((await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan"))!.Plaatsingen);
        Assert.Equal(blokStart, na.BlokStart);
        Assert.Equal("Voorgesteld", na.Status);

        Assert.Equal(
            HttpStatusCode.NotFound,
            (await client.PutAsJsonAsync(
                $"/api/klassen/{klasId}/jaarplan/plaatsingen/{Guid.NewGuid()}/blok",
                new { blokStart })).StatusCode);
    }

    /// <summary>
    /// <b>A rejected placement is refused a move, over HTTP</b> — the one transition in this endpoint with a
    /// <i>dekking</i> consequence. Under the binding reading in <c>backlog/E5-dekking-export.md</c> only
    /// <c>aanvaard</c>/<c>manueel</c> count as placed (Art. V.1), so converting a rejection to <c>manueel</c> by
    /// dragging would move a thema from "not taught" to "taught" in an inspectie-facing figure with no teacher
    /// decision behind it. The way back stays the explicit status PUT.
    /// </summary>
    [Fact]
    public async Task Een_geweigerde_plaatsing_verplaatsen_geeft_400_en_de_weigering_blijft_staan()
    {
        var client = _factory.CreateClient();
        var (klasId, blokStart) = await _factory.SeedAsync();
        _factory.AiAntwoord =
            $"{{\"plaatsingen\":[{{\"blokStart\":\"{blokStart:yyyy-MM-dd}\",\"thema\":\"Herfst\",\"motivatie\":\"seizoen\"}}]}}";

        await client.PostAsync($"/api/klassen/{klasId}/jaarplan/generatie", content: null);
        var plan = await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan");
        var plaatsingId = Assert.Single(plan!.Plaatsingen).Id;

        var weiger = await client.PutAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}/status", new { status = "Geweigerd" });
        Assert.Equal(HttpStatusCode.OK, weiger.StatusCode);

        var rooster = await client.GetFromJsonAsync<RoosterDto>($"/api/schooljaren/{plan.SchooljaarId}/rooster");
        var doel = rooster!.Blokken.First(b => b.Start != blokStart);

        var verplaats = await client.PutAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}/blok", new { blokStart = doel.Start });
        Assert.Equal(HttpStatusCode.BadRequest, verplaats.StatusCode);

        // The rejection stands, in its original period.
        var na = Assert.Single((await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan"))!.Plaatsingen);
        Assert.Equal("Geweigerd", na.Status);
        Assert.Equal(blokStart, na.BlokStart);

        // And the explicit route out still works: reverse the rejection, then the move is allowed.
        await client.PutAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}/status", new { status = "Manueel" });
        var opnieuw = await client.PutAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}/blok", new { blokStart = doel.Start });
        Assert.Equal(HttpStatusCode.OK, opnieuw.StatusCode);
        Assert.Equal(doel.Start, Assert.Single((await opnieuw.Content.ReadFromJsonAsync<JaarplanDto>())!.Plaatsingen).BlokStart);
    }

    [Fact]
    public async Task Voorgesteld_terugzetten_geeft_400()
    {
        var client = _factory.CreateClient();
        var (klasId, blokStart) = await _factory.SeedAsync();
        _factory.AiAntwoord =
            $"{{\"plaatsingen\":[{{\"blokStart\":\"{blokStart:yyyy-MM-dd}\",\"thema\":\"Herfst\",\"motivatie\":\"seizoen\"}}]}}";

        await client.PostAsync($"/api/klassen/{klasId}/jaarplan/generatie", content: null);
        var plan = await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan");
        var plaatsingId = Assert.Single(plan!.Plaatsingen).Id;

        var response = await client.PutAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}/status", new { status = "Voorgesteld" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Onbekende_klas_geeft_404()
    {
        var client = _factory.CreateClient();

        Assert.Equal(
            HttpStatusCode.NotFound,
            (await client.GetAsync($"/api/klassen/{Guid.NewGuid()}/jaarplan")).StatusCode);
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await client.PostAsync($"/api/klassen/{Guid.NewGuid()}/jaarplan/generatie", content: null)).StatusCode);
    }

    /// <summary>
    /// The Art. IX.3 containment, over HTTP: a class is created <b>inside</b> a school year and the year reports the
    /// classes it contains. This is also the reachability check for the container itself — without it the required
    /// <c>SchooljaarId</c> would have made class creation impossible.
    /// </summary>
    [Fact]
    public async Task Een_schooljaar_bevat_zijn_klassen()
    {
        var client = _factory.CreateClient();

        var schooljaar = await (await client.PostAsJsonAsync("/api/schooljaren", new
        {
            naam = TestSchooljaar.UniekeNaam("beheer"),
            start = "2028-09-01",
            eind = "2029-06-30",
            sluitingen = new[]
            {
                new { naam = "Herfstvakantie", start = "2028-10-30", eind = "2028-11-05", soort = "Vakantie" },
                new { naam = "Pinkstermaandag", start = "2029-05-21", eind = "2029-05-21", soort = "VrijeDag" },
            },
        })).Content.ReadFromJsonAsync<SchooljaarWeergave>();

        Assert.NotNull(schooljaar);
        Assert.Equal(2, schooljaar!.Sluitingen.Count);
        Assert.Equal("VrijeDag", schooljaar.Sluitingen.Single(s => s.Naam == "Pinkstermaandag").Soort);
        Assert.Empty(schooljaar.Klassen);

        var klasNaam = $"K3-{Guid.NewGuid():N}";
        var klasResponse = await client.PostAsJsonAsync(
            $"/api/schooljaren/{schooljaar.Id}/klassen", new { naam = klasNaam, leerjaar = 0 });
        Assert.Equal(HttpStatusCode.Created, klasResponse.StatusCode);

        var klas = await klasResponse.Content.ReadFromJsonAsync<KlasWeergave>();
        Assert.Equal(schooljaar.Id, klas!.SchooljaarId);

        var opnieuw = await client.GetFromJsonAsync<SchooljaarWeergave>($"/api/schooljaren/{schooljaar.Id}");
        Assert.Contains(opnieuw!.Klassen, k => k.Id == klas.Id && k.Naam == klasNaam);
    }

    [Fact]
    public async Task Een_klas_in_een_onbekend_schooljaar_geeft_404()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/schooljaren/{Guid.NewGuid()}/klassen", new { naam = $"L9-{Guid.NewGuid():N}", leerjaar = 9 });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private sealed record JaarplanDto(
        Guid KlasId,
        string KlasNaam,
        Guid SchooljaarId,
        string SchooljaarNaam,
        string Blokindeling,
        List<PlaatsingDto> Plaatsingen);

    private sealed record PlaatsingDto(
        Guid Id,
        Guid ThemaId,
        string ThemaNaam,
        string BlokNiveau,
        DateOnly BlokStart,
        DateOnly? BlokEind,
        int? BlokOrdinaal,
        bool IsVervallen,
        string Status,
        string? AiMotivatie,
        bool Vergrendeld,
        List<string> Doelcodes);

    private sealed record GeneratieDto(bool IsGeslaagd, string? Fout, int AantalNieuw, int AantalBehouden)
    {
        /// <summary>E3-04's parameter report, present once the request carries parameters.</summary>
        public ParameterRapportDto? Parameters { get; init; }
    }

    private sealed record ParameterRapportDto(
        IReadOnlyList<GeweigerdePlaatsingDto> GeweigerdDoorVastMoment,
        IReadOnlyList<string> TegenstrijdigeStartthemas,
        bool HeeftAandachtspunten)
    {
        /// <summary>Start thema's the model placed where they were asked for.</summary>
        public IReadOnlyList<string> GehonoreerdeStartthemas { get; init; } = [];

        /// <summary>Kept start thema's whose period no longer exists (E3-04 persistence half).</summary>
        public IReadOnlyList<StartthemakeuzeDto> VervallenStartthemas { get; init; } = [];
    }

    /// <summary>The class's kept pre-generation settings, as <c>GET …/jaarplan/parameters</c> returns them.</summary>
    private sealed record ParametersDto(
        IReadOnlyList<StartthemakeuzeDto> GewensteStartthemas,
        IReadOnlyList<VastMomentDto> VasteMomenten);

    private sealed record StartthemakeuzeDto(DateOnly BlokStart, string ThemaNaam);

    private sealed record VastMomentDto(string Naam, DateOnly Datum, bool BlokkeertPlaatsing);

    private sealed record GeweigerdePlaatsingDto(
        string ThemaNaam,
        DateOnly BlokStart,
        string MomentNaam,
        string? AiMotivatie);

    /// <summary>Only the parts of the rooster payload the move tests read: where each period starts.</summary>
    private sealed record RoosterDto(List<RoosterBlokDto> Blokken);

    private sealed record RoosterBlokDto(int Ordinaal, DateOnly Start, DateOnly Eind);

    /// <summary>
    /// WebApplicationFactory on the in-memory EF provider with a <b>stub AI client</b>. The container is otherwise
    /// production wiring: the real controller, the real <c>JaarplanGeneratieService</c>, the real configured
    /// <c>IPlanningsblokIndeling</c>. Only the two things a test must not do for real — call Azure and touch
    /// Postgres — are replaced.
    /// </summary>
    public sealed class Factory : WebApplicationFactory<Program>
    {
        private readonly string _dbNaam = $"e3_01_endpoints_{Guid.NewGuid():N}";

        /// <summary>The canned completion the stub AI client returns; set per test before generating.</summary>
        public string AiAntwoord { get; set; } = """{"plaatsingen":[]}""";

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment(Environments.Development);

            builder.ConfigureServices(services =>
            {
                var toRemove = services
                    .Where(d =>
                        d.ServiceType == typeof(AppDbContext) ||
                        d.ServiceType == typeof(IAiClient) ||
                        (d.ServiceType.FullName?.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal) ?? false) ||
                        (d.ServiceType.Namespace?.StartsWith("Npgsql", StringComparison.Ordinal) ?? false))
                    .ToList();
                foreach (var descriptor in toRemove)
                {
                    services.Remove(descriptor);
                }

                services.AddDbContext<AppDbContext>(options => options.UseInMemoryDatabase(_dbNaam));

                // The only AI stand-in: no network, and it reads the canned answer at call time so a test can set
                // it after the host is built (Art. IV.6).
                services.AddSingleton<IAiClient>(new StubAiClient(() => AiAntwoord));
            });
        }

        /// <summary>
        /// Seeds a school year (with the standard Belgian vacations), a class inside it and one thema, and returns
        /// the class id plus the <b>first derived themaperiode's start date</b> — obtained from the same configured
        /// seam the service uses, so the test never hard-codes a period boundary.
        /// </summary>
        public async Task<(Guid KlasId, DateOnly BlokStart)> SeedAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Database.EnsureCreatedAsync();

            // Bounded to Schooljaar.Naam's varchar(32). This factory runs on the in-memory provider, which enforces no
            // max length, so an over-long name here would pass locally and only break if the fixture were ever pointed
            // at Postgres — the same blind spot that took out the [PostgresFact] suite in CI.
            var schooljaar = TestSchooljaar.MetVakanties(TestSchooljaar.UniekeNaam("jaarplan"));
            var klas = schooljaar.VoegKlasToe($"L3-{Guid.NewGuid():N}", leerjaar: 3);
            db.Schooljaren.Add(schooljaar);

            if (!await db.Themas.AnyAsync(t => t.Naam == "Herfst"))
            {
                db.Themas.Add(new Thema("Herfst", duurWeken: 5, invalshoeken: "natuur"));
            }

            await db.SaveChangesAsync();

            var indeling = scope.ServiceProvider.GetRequiredService<Application.Planning.IPlanningsblokIndeling>();
            var blokken = indeling.Blokken(schooljaar, Planningsblokniveau.Themaperiode);

            return (klas.Id, blokken[0].Start);
        }

        private sealed class StubAiClient : IAiClient
        {
            private readonly Func<string> _antwoord;

            public StubAiClient(Func<string> antwoord) => _antwoord = antwoord;

            public Task<AiCompletion> CompleteAsync(AiRequest request, CancellationToken cancellationToken = default) =>
                Task.FromResult(new AiCompletion { Content = _antwoord() });
        }
    }
}
