using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Dekking;
using Jaarplanner.Application.Planning.Beheer;
using Jaarplanner.Domain.Curriculum;
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
    /// <b>The wiring test for E3-03:</b> a successful generation response really carries a <c>vooruitzicht</c> object
    /// (FR-5.3), and it names the scope it measured against.
    /// <para>
    /// It exists because the composition happens in the <i>controller</i> rather than in the generation service — the
    /// coverage rules have one owner and that owner reads the plan through <c>IJaarplanLezer</c>, which the generation
    /// service implements, so a generator depending on it would close the loop. A field attached one layer up is
    /// exactly the kind of thing that can be silently absent while every unit test stays green, which is the failure
    /// mode that cost this project a withdrawn milestone (E2-08) and three reopened stories.
    /// </para>
    /// <para>
    /// <b>It deliberately asserts no coverage figure.</b> This fixture's <c>IDekkingOpslag</c> is stubbed empty
    /// (the real query cannot run on the in-memory provider — see the factory), so every number here would be a
    /// number about nothing. The figures are asserted against real PostgreSQL in
    /// <c>Postgres/DekkingsvooruitzichtPostgresTests</c>, over a real generation run.
    /// </para>
    /// </summary>
    [Fact]
    public async Task Een_geslaagde_generatie_draagt_een_dekkingsvooruitzicht_mee()
    {
        var client = _factory.CreateClient();
        var (klasId, blokStart) = await _factory.SeedAsync();

        _factory.AiAntwoord =
            $"{{\"plaatsingen\":[{{\"blokStart\":\"{blokStart:yyyy-MM-dd}\",\"thema\":\"Herfst\"," +
            "\"motivatie\":\"seizoen\"}]}";

        var generatie = await client.PostAsync($"/api/klassen/{klasId}/jaarplan/generatie", content: null);
        Assert.Equal(HttpStatusCode.OK, generatie.StatusCode);

        var resultaat = await generatie.Content.ReadFromJsonAsync<GeneratieDto>();
        Assert.True(resultaat!.IsGeslaagd);

        var vooruitzicht = resultaat.Vooruitzicht;
        Assert.NotNull(vooruitzicht);

        // The scope has to travel with the figures, because the same class has two legitimate denominators (owner
        // ruling 2026-08-04). This much IS observable through the stub, which reports the seeded class's leerjaar.
        Assert.Equal("EigenJaarFase", vooruitzicht!.Bereik);
        Assert.Equal(["L3"], vooruitzicht.GemetenJaarFasen);
        Assert.False(vooruitzicht.IsTerugvalNaarHeelCurriculum);

        // And the empty fixture answers the honest empty state rather than a plausible-looking number: 0 of 0, which
        // a screen must never read as "alles gedekt".
        Assert.Equal(0, vooruitzicht.AantalLeerplandoelen);
        Assert.Equal(0, vooruitzicht.AantalGedekt);
        Assert.Equal(0, vooruitzicht.AantalMogelijkGedekt);
    }

    /// <summary>
    /// <b>The <c>?jaarFase=</c> query parameter binds and reaches the coverage calculation</b> (E3-03, antagonist
    /// round 3).
    /// <para>
    /// It pins the fix for round 1's MAJOR: without this narrowing the panel's figures and the live dekking line on
    /// the same screen were measured over two different denominators. That fix was verified at service level only —
    /// nothing asserted that the value survives the HTTP boundary — so a rename of the parameter, or a
    /// <c>[FromQuery(Name=…)]</c> slip, would have silently restored the two-denominator state with every test green.
    /// The frontend half of the same wire is pinned in <c>features/jaarplan/api.test.ts</c>.
    /// </para>
    /// <para>
    /// A <b>kleutergroep</b>, because narrowing needs more than one available code (<c>BepaalBereikAsync</c>): against
    /// an L3 class the scope is <c>["L3"]</c> whatever the query says, so the test would pass with the parameter
    /// unbound and prove nothing.
    /// </para>
    /// </summary>
    [Fact]
    public async Task De_gekozen_jaarfase_uit_de_querystring_versmalt_het_vooruitzicht()
    {
        var client = _factory.CreateClient();
        _factory.Leerjaar = 0;

        try
        {
            var (klasId, _) = await _factory.SeedAsync();

            // Without the query the class is measured against everything it could be measured against.
            var breed = await client.PostAsync($"/api/klassen/{klasId}/jaarplan/generatie", content: null);
            var breedResultaat = await breed.Content.ReadFromJsonAsync<GeneratieDto>();
            Assert.Equal(["JK", "K2", "K3"], breedResultaat!.Vooruitzicht!.GemetenJaarFasen);

            // With it, the teacher's own choice on the kalender narrows the denominator.
            var smal = await client.PostAsync(
                $"/api/klassen/{klasId}/jaarplan/generatie?jaarFase=K3", content: null);
            var smalResultaat = await smal.Content.ReadFromJsonAsync<GeneratieDto>();
            Assert.Equal(["K3"], smalResultaat!.Vooruitzicht!.GemetenJaarFasen);

            // And a code this class could never be measured against is ignored rather than honoured, exactly as
            // GET …/dekking ignores it, so a stale link cannot break a generation run.
            var vreemd = await client.PostAsync(
                $"/api/klassen/{klasId}/jaarplan/generatie?jaarFase=L6", content: null);
            Assert.Equal(HttpStatusCode.OK, vreemd.StatusCode);
            var vreemdResultaat = await vreemd.Content.ReadFromJsonAsync<GeneratieDto>();
            Assert.Equal(["JK", "K2", "K3"], vreemdResultaat!.Vooruitzicht!.GemetenJaarFasen);
        }
        finally
        {
            _factory.Leerjaar = 3;
        }
    }

    /// <summary>
    /// A failed run reports no outlook, for the same reason it reports no spreading: nothing was persisted, so there
    /// is no plan to look ahead over (Art. IV.5). A zero here would read as "this proposal covers nothing", which is a
    /// statement about a plan that does not exist.
    /// </summary>
    [Fact]
    public async Task Een_mislukte_generatie_draagt_geen_dekkingsvooruitzicht()
    {
        var client = _factory.CreateClient();
        var (klasId, _) = await _factory.SeedAsync();
        _factory.AiAntwoord = "dit is geen JSON {kapot";

        var generatie = await client.PostAsync($"/api/klassen/{klasId}/jaarplan/generatie", content: null);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, generatie.StatusCode);

        // Asserted on the raw body: the 422 is a ProblemDetails, so there is no vooruitzicht field to read at all.
        var lichaam = await generatie.Content.ReadAsStringAsync();
        Assert.DoesNotContain("vooruitzicht", lichaam, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("aantalMogelijkGedekt", lichaam, StringComparison.OrdinalIgnoreCase);
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
                // Both arrays are sent, because both are [JsonRequired]: omitting one would be a request to CLEAR it,
                // and the contract refuses to guess which of the two readings a caller meant.
                gewensteStartthemas = Array.Empty<object>(),
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
                // `gewensteStartthemas` is present, so the 400 is provably about the missing blocking answer and not
                // about the other required array.
                gewensteStartthemas = Array.Empty<object>(),
                vasteMomenten = new[] { new { naam = "Schoolfeest", datum = blokStart.ToString("yyyy-MM-dd") } },
            });

        Assert.Equal(HttpStatusCode.BadRequest, generatie.StatusCode);
    }

    /// <summary>
    /// <b>An omitted array is a 400 and wipes nothing.</b> A body <i>replaces</i> the kept settings, so omitting
    /// <c>gewensteStartthemas</c> is indistinguishable from sending <c>[]</c> — and under the loose contract it
    /// permanently deleted durable teacher input with no report entry. Both arrays are <c>[JsonRequired]</c> for exactly
    /// the reason <c>blokkeertPlaatsing</c> is: when two readings differ in what they destroy, the caller says which.
    /// <para>
    /// Posting <b>no body at all</b> stays a first-class case and still means "use what is stored"; the requirement is on
    /// the shape of a body that is sent. Both halves are asserted here.
    /// </para>
    /// </summary>
    [Fact]
    public async Task Een_body_zonder_gewensteStartthemas_is_een_400_en_wist_de_bewaarde_lijst_niet()
    {
        var client = _factory.CreateClient();
        var (klasId, blokStart) = await _factory.SeedAsync();

        var bewaren = await client.PostAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/generatie",
            new
            {
                gewensteStartthemas = new[]
                {
                    new { blokStart = blokStart.ToString("yyyy-MM-dd"), themaNaam = "Herfst" },
                },
                vasteMomenten = Array.Empty<object>(),
            });
        Assert.Equal(HttpStatusCode.OK, bewaren.StatusCode);

        // A body that mentions only the other list. Under the old contract this silently cleared the preference above.
        var partieel = await client.PostAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/generatie",
            new { vasteMomenten = Array.Empty<object>() });
        Assert.Equal(HttpStatusCode.BadRequest, partieel.StatusCode);

        var bewaard = await client.GetFromJsonAsync<ParametersDto>($"/api/klassen/{klasId}/jaarplan/parameters");
        Assert.Equal("Herfst", Assert.Single(bewaard!.GewensteStartthemas).ThemaNaam);

        // No body at all is still fine, and still uses the stored settings rather than clearing them.
        var zonderBody = await client.PostAsync($"/api/klassen/{klasId}/jaarplan/generatie", content: null);
        Assert.Equal(HttpStatusCode.OK, zonderBody.StatusCode);

        var na = await client.GetFromJsonAsync<ParametersDto>($"/api/klassen/{klasId}/jaarplan/parameters");
        Assert.Equal("Herfst", Assert.Single(na!.GewensteStartthemas).ThemaNaam);
    }

    /// <summary>
    /// <b>Two preferences for one period are a 400, not a silently thinned set.</b> The previous contract kept the first
    /// and dropped the second with nothing in the report to say so — and since a body replaces the kept settings, the
    /// dropped one was deleted for good. The form cannot produce this shape (its state is keyed on the period), so
    /// refusing costs a real user nothing.
    /// </summary>
    [Fact]
    public async Task Twee_startthemas_voor_dezelfde_periode_zijn_een_400_en_bewaren_niets()
    {
        var client = _factory.CreateClient();
        var (klasId, blokStart) = await _factory.SeedAsync();

        var generatie = await client.PostAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/generatie",
            new
            {
                gewensteStartthemas = new[]
                {
                    new { blokStart = blokStart.ToString("yyyy-MM-dd"), themaNaam = "Herfst" },
                    new { blokStart = blokStart.ToString("yyyy-MM-dd"), themaNaam = "Water" },
                },
                vasteMomenten = Array.Empty<object>(),
            });

        Assert.Equal(HttpStatusCode.BadRequest, generatie.StatusCode);

        // Refused before anything was written: no half-stored preference for the teacher to discover later.
        var bewaard = await client.GetFromJsonAsync<ParametersDto>($"/api/klassen/{klasId}/jaarplan/parameters");
        Assert.Empty(bewaard!.GewensteStartthemas);
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
                // The startthema is cleared EXPLICITLY. Under the loose contract omitting the array did the same thing
                // silently, which is the ambiguity [JsonRequired] removes: this body now says what it means.
                gewensteStartthemas = Array.Empty<object>(),
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
                vasteMomenten = Array.Empty<object>(),
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
    /// <b>E4-04 / FR-8.1 over the wire: the second press, and the two figures the teacher is shown afterwards.</b>
    /// <para>
    /// The behaviour itself is proven where a deletion can actually fail — <c>JaarplanPersistentieTests</c>, against
    /// real PostgreSQL, for both halves of <c>IsVervangbaar</c>. What only this level can prove is the <b>contract</b>:
    /// that a plain second POST to the same endpoint is a regeneration, and that its response carries
    /// <c>aantalVervangen</c> and <c>aantalBehouden</c> under those names. E4-04's new copy promises a teacher that
    /// their decisions survive and their untouched proposals do not, and <c>Spreidingsoverzicht</c> then reports the
    /// counts: until now the frontend read both fields from a hand-written fixture and nothing on the server side read
    /// them <b>over the wire</b>, so the JSON half of that seam was checked against nobody.
    /// </para>
    /// <para>
    /// <i>Corrected on the antagonist's finding:</i> an earlier version of this claimed no server test read
    /// <c>AantalVervangen</c> at all. It does — E4-06's lock test in <c>JaarplanPersistentieTests</c> asserts it forty
    /// lines above E4-04's own new test, and the unit suite reads <c>AantalBehouden</c> four times. So a rename of the
    /// C# property was never the unpinned risk; a change to the serialized name was.
    /// </para>
    /// <para>
    /// The second period comes from the public rooster endpoint rather than from a hard-coded date, for the reason
    /// Art. IX.3 gives: nothing may assume how long a period is or where a boundary falls.
    /// </para>
    /// </summary>
    [Fact]
    public async Task Een_tweede_run_vervangt_het_onaangeroerde_voorstel_en_laat_de_beslissing_staan()
    {
        var client = _factory.CreateClient();
        var (klasId, blokStart) = await _factory.SeedAsync();

        // The grid, read the way the app reads it. `[1]` is the period the second proposal goes into.
        var eerstePlan = await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan");
        var rooster = await client.GetFromJsonAsync<RoosterDto>(
            $"/api/schooljaren/{eerstePlan!.SchooljaarId}/rooster");
        Assert.True(rooster!.Blokken.Count >= 2, "this fixture needs at least two themaperiodes");
        var tweedeStart = rooster.Blokken[1].Start;

        // Run 1 fills two periods with proposals.
        _factory.AiAntwoord =
            $$"""
            {"plaatsingen":[
              {"blokStart":"{{blokStart:yyyy-MM-dd}}","thema":"Herfst","motivatie":"seizoen"},
              {"blokStart":"{{tweedeStart:yyyy-MM-dd}}","thema":"Herfst","motivatie":"nog eens"}]}
            """;
        var eerste = await client.PostAsync($"/api/klassen/{klasId}/jaarplan/generatie", content: null);
        Assert.Equal(HttpStatusCode.OK, eerste.StatusCode);
        Assert.Equal(2, (await eerste.Content.ReadFromJsonAsync<GeneratieDto>())!.AantalNieuw);

        // The teacher decides on exactly one of them and leaves the other alone. No lock anywhere in this test, so
        // the status is the only thing that can explain the outcome below.
        var naEerste = await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan");
        var beslist = naEerste!.Plaatsingen.Single(p => p.BlokStart == blokStart);
        var onaangeroerd = naEerste.Plaatsingen.Single(p => p.BlokStart == tweedeStart);
        var status = await client.PutAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/plaatsingen/{beslist.Id}/status", new { status = "Aanvaard" });
        Assert.Equal(HttpStatusCode.OK, status.StatusCode);

        // Run 2: the same endpoint, no body, nothing about it says "again". The model proposes nothing this time, so
        // every difference below is the regeneration's own doing rather than a new placement's.
        _factory.AiAntwoord = """{"plaatsingen":[]}""";
        var tweede = await client.PostAsync($"/api/klassen/{klasId}/jaarplan/generatie", content: null);
        Assert.Equal(HttpStatusCode.OK, tweede.StatusCode);

        var resultaat = await tweede.Content.ReadFromJsonAsync<GeneratieDto>();
        Assert.True(resultaat!.IsGeslaagd);
        Assert.Equal(0, resultaat.AantalNieuw);
        Assert.Equal(1, resultaat.AantalBehouden);
        Assert.Equal(1, resultaat.AantalVervangen);

        // And the plan itself agrees with the report, which is the half a count alone cannot promise.
        var naTweede = await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan");
        var overlevend = Assert.Single(naTweede!.Plaatsingen);
        Assert.Equal(beslist.Id, overlevend.Id);
        Assert.Equal("Aanvaard", overlevend.Status);
        Assert.DoesNotContain(naTweede.Plaatsingen, p => p.Id == onaangeroerd.Id);
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
            $"/api/schooljaren/{schooljaar.Id}/klassen", new { naam = klasNaam, jaarfase = "K3" });
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
            $"/api/schooljaren/{Guid.NewGuid()}/klassen", new { naam = $"L9-{Guid.NewGuid():N}", jaarfase = "L6" });

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

    private sealed record GeneratieDto(
        bool IsGeslaagd,
        string? Fout,
        int AantalNieuw,
        int AantalBehouden,
        // E4-04: the field the teacher's "X eerdere voorstellen zijn vervangen" is built from. It has been on the wire
        // since E3-01 and no test had ever read it **over HTTP**, i.e. under its serialized name — the C# property is
        // asserted by `JaarplanPersistentieTests` (E4-06's lock test) and by the unit suite, so a *property* rename
        // breaks the build, but a change to the JSON name was pinned by nothing except the frontend's own hand-written
        // fixture. (The first version of this comment said "no server test read either", which is simply false; the
        // narrow claim is the one worth making.)
        int AantalVervangen)
    {
        /// <summary>E3-04's parameter report, present once the request carries parameters.</summary>
        public ParameterRapportDto? Parameters { get; init; }

        /// <summary>E3-03's dekkingsvooruitzicht, attached by the controller on every successful run.</summary>
        public VooruitzichtDto? Vooruitzicht { get; init; }
    }

    /// <summary>
    /// The coverage outlook as the wire carries it (E3-03). <c>AantalGedekt</c> and <c>AantalMogelijkGedekt</c> are
    /// nullable here for the same reason they are on the server: while a stale placement is unresolved the figures are
    /// absent from the JSON entirely, so a client cannot render a total it never received.
    /// </summary>
    private sealed record VooruitzichtDto(
        string Bereik,
        IReadOnlyList<string> GemetenJaarFasen,
        bool IsTerugvalNaarHeelCurriculum,
        int AantalBuitenBereik,
        bool IsBetrouwbaar,
        int AantalOnopgelosteVervallenPlaatsingen,
        int? AantalGedekt,
        int? AantalMogelijkGedekt,
        int AantalLeerplandoelen,
        int? AantalOnbereikbaar);

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

        /// <summary>
        /// What the stubbed coverage port reports as the class's leerjaar. <c>3</c> matches <see cref="SeedAsync"/>;
        /// <c>0</c> makes it a kleutergroep, which is the only way the <c>?jaarFase=</c> narrowing becomes visible.
        /// Reset it in the test that changes it: this factory is a class fixture and is shared.
        /// </summary>
        public int? Leerjaar { get; set; } = 3;

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

                // THE COVERAGE PORT IS STUBBED HERE, AND IT IS NOT A CONVENIENCE (E3-03).
                //
                // Since E3-03 the generation endpoint attaches a dekkingsvooruitzicht, which reads the four link
                // layers through EfDekkingOpslag. That query throws `NotImplementedException` on the EF **in-memory**
                // provider — it projects inside a nested SelectMany over owned collections, which InMemory cannot
                // execute — while running perfectly against Npgsql. So without this stub every generation test in
                // this file answers 500, on a query production runs without complaint.
                //
                // Note the direction, because it is the mirror image of E7-16 and worth knowing before someone
                // "fixes" this: the usual failure is a path that passes in memory and breaks on Postgres. This one
                // passes on Postgres and breaks in memory. Either way the conclusion is the same — a database path is
                // only verified against a real database, which is why every figure this stub makes unobservable is
                // asserted in Postgres/DekkingsvooruitzichtPostgresTests instead.
                services.AddScoped<IDekkingOpslag>(_ => new LegeDekkingOpslag(() => Leerjaar));
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
            var klas = schooljaar.VoegKlasToe($"L3-{Guid.NewGuid():N}", "L3");
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

        /// <summary>
        /// A coverage port that knows nothing: no links, no curriculum, no leerjaar. It exists only so the generation
        /// endpoint can answer at all on the in-memory provider (see the registration above for why the real one
        /// cannot run there), and it deliberately reports the honest empty state rather than plausible-looking
        /// numbers: 0 leerplandoelen in scope, which is exactly what "this fixture has no curriculum" means.
        /// <para>
        /// A test in this file must therefore never assert a coverage <b>figure</b>. What it can assert is that the
        /// field is there, which is the wiring E3-03 could otherwise have shipped missing.
        /// </para>
        /// </summary>
        private sealed class LegeDekkingOpslag : IDekkingOpslag
        {
            private readonly Func<int?> _leerjaar;

            public LegeDekkingOpslag(Func<int?> leerjaar) => _leerjaar = leerjaar;

            public Task<IReadOnlyList<DekkendeKoppeling>> HaalDekkendeKoppelingenAsync(
                Guid klasId,
                IReadOnlyCollection<Guid> themaIds,
                CancellationToken cancellationToken = default) =>
                Task.FromResult<IReadOnlyList<DekkendeKoppeling>>([]);

            public Task<IReadOnlyList<KandidaatKoppeling>> HaalKandidaatKoppelingenAsync(
                Guid klasId,
                CancellationToken cancellationToken = default) =>
                Task.FromResult<IReadOnlyList<KandidaatKoppeling>>([]);

            public Task<IReadOnlyList<Leerplandoel>> HaalLeerplandoelenAsync(
                IReadOnlyCollection<string>? jaarFasen = null,
                CancellationToken cancellationToken = default) =>
                Task.FromResult<IReadOnlyList<Leerplandoel>>([]);

            public Task<int> TelAlleLeerplandoelenAsync(CancellationToken cancellationToken = default) =>
                Task.FromResult(0);

            /// <summary>
            /// The class's leerjaar, <c>3</c> by default to match <see cref="SeedAsync"/>'s class. Returning
            /// <c>null</c> would be simpler and would make every response report a fallback to the whole curriculum,
            /// i.e. the unresolved-graadklas state, which is a lie about this fixture's classes.
            /// <para>
            /// Read through a delegate so a test can set <see cref="Factory.Leerjaar"/> to <c>0</c> and get a
            /// kleutergroep, whose jaar/fase set has three codes. That is the only shape in which the
            /// <c>?jaarFase=</c> narrowing is observable at all: narrowing requires more than one available code, so
            /// against an L3 class every value of the query parameter, valid or not, yields the same answer.
            /// </para>
            /// </summary>
            public Task<Klasscope?> HaalKlasscopeAsync(Guid klasId, CancellationToken cancellationToken = default)
            {
                var leerjaar = _leerjaar();

                // A recorded jaar/fase is deliberately NOT faked here: these tests exercise the ordinal fallback,
                // which is the branch a kleutergroep without a recorded year still takes. The narrowing itself is
                // pinned where it belongs, on `Jaarfasen.VoorKlas` and on the endpoint tests that set it.
                return Task.FromResult(leerjaar is null ? null : (Klasscope?)new Klasscope(leerjaar.Value, null));
            }
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
