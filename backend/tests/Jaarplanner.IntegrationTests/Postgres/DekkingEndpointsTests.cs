using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Application.Planning;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The dekking endpoint through the real HTTP pipeline against real PostgreSQL (E5-01, FR-9.1).
/// <para>
/// <b>Why this file exists at all, given that the computation is already unit-tested and the query is already
/// Postgres-tested.</b> This project has withdrawn a milestone and reopened three stories over exactly one failure
/// mode: logic that passed its own tests while being reachable from nothing (E2-08, E1-15, E0-10, E4-06). A unit test
/// proves the rules; a query test proves the SQL; only this proves that the DI container resolves the whole chain and
/// that an HTTP caller gets an answer. It is deliberately thin — the rules are asserted where they live.
/// </para>
/// <para>
/// It is <b>not</b> a claim that FR-9 is satisfied: no teacher can see this until the dekkingsoverzicht screen ships
/// (E5-02/E5-03/E5-05). What it establishes is that the figure is verifiable today by anyone, including a gate.
/// </para>
/// </summary>
public sealed class DekkingEndpointsTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("dekkingapi");
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

    [PostgresFact]
    public async Task Een_klas_zonder_jaarplan_krijgt_een_betrouwbare_nul_en_geen_404()
    {
        // Art. IX.3: a klas HAS a jaarplan, so a class that has never generated is not a not-found. 0 covered out of
        // the goals IN SCOPE for this kleutergroep is the honest answer, and it is a TRUSTWORTHY 0 — nothing is
        // unresolved. (The scope is the ruling of 2026-08-04; before it, this line read "the whole loaded
        // curriculum", which the same three seeded rows no longer make true.)
        var klasId = await ZetKlasOpAsync();

        var response = await _factory.CreateClient().GetAsync($"/api/klassen/{klasId}/dekking");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var dekking = await response.Content.ReadFromJsonAsync<DekkingDto>();
        Assert.NotNull(dekking);
        Assert.True(dekking.IsBetrouwbaar);
        Assert.Equal(0, dekking.AantalGedekt);
        Assert.Equal(2, dekking.AantalLeerplandoelen);
        Assert.All(dekking.Doelen, d => Assert.False(d.IsGedekt));
    }

    [PostgresFact]
    public async Task De_noemer_is_standaard_de_eigen_jaar_fase_van_de_klas()
    {
        // The owner ruling of 2026-08-04 over the wire, and specifically that the DEFAULT does the scoping: an
        // omitted parameter must give the ruled answer, not E5-01's unscoped one. Asserted here rather than only in
        // the unit tests because the thing that can silently be wrong is the model binding of the default.
        var klasId = await ZetKlasOpAsync(leerjaar: 0);

        var dekking = await HaalDekkingAsync(klasId);

        Assert.Equal("EigenJaarFase", dekking.Bereik);
        Assert.Equal(["JK", "K2", "K3"], dekking.GemetenJaarFasen);
        Assert.False(dekking.IsTerugvalNaarHeelCurriculum);

        // The two kleuterdoelen are measured, the L6 one is not, and the response says how many it left out. Proven
        // by the ROWS as well as by the count, so a denominator that was right by coincidence would still fail.
        Assert.Equal(2, dekking.AantalLeerplandoelen);
        Assert.Equal(1, dekking.AantalBuitenBereik);
        Assert.DoesNotContain("DEK-L6", dekking.Doelen.Select(d => d.Code));
    }

    [PostgresFact]
    public async Task Het_hele_curriculum_is_over_HTTP_een_expliciete_keuze()
    {
        // The escape hatch a directie needs: what the SCHOOL loaded, not what this class is measured against.
        var klasId = await ZetKlasOpAsync(leerjaar: 0);

        var response = await _factory.CreateClient()
            .GetAsync($"/api/klassen/{klasId}/dekking?bereik=HeelCurriculum");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var dekking = await response.Content.ReadFromJsonAsync<DekkingDto>();
        Assert.NotNull(dekking);
        Assert.Equal("HeelCurriculum", dekking.Bereik);
        Assert.Empty(dekking.GemetenJaarFasen);
        Assert.Equal(3, dekking.AantalLeerplandoelen);
        Assert.Equal(0, dekking.AantalBuitenBereik);
        Assert.Contains("DEK-L6", dekking.Doelen.Select(d => d.Code));
    }

    [PostgresFact]
    public async Task Een_klas_met_een_niet_afleidbaar_leerjaar_valt_terug_op_alles_en_zegt_dat()
    {
        // The unresolved half of the Art. XIV decision, against a real class row: leerjaar 7 exists in the database
        // (Klas takes any int) and maps to no jaar/fase. The scope must WIDEN, and the payload must admit that the
        // caller did not choose it.
        var klasId = await ZetKlasOpAsync(leerjaar: 7);

        var dekking = await HaalDekkingAsync(klasId);

        Assert.Equal("HeelCurriculum", dekking.Bereik);
        Assert.True(dekking.IsTerugvalNaarHeelCurriculum);
        Assert.Empty(dekking.GemetenJaarFasen);
        Assert.Equal(3, dekking.AantalLeerplandoelen);
    }

    [PostgresFact]
    public async Task Een_klas_zonder_doelen_in_haar_bereik_meldt_nul_van_nul_en_niet_alles_gedekt()
    {
        // An L3 class in a school that has loaded only kleuterdoelen plus one L6 goal. 0 of 0 is truthful and it is
        // the state a screen could most easily misread as success, so what distinguishes it from an empty database is
        // asserted at the boundary a screen actually reads.
        var klasId = await ZetKlasOpAsync(leerjaar: 3);

        var dekking = await HaalDekkingAsync(klasId);

        Assert.Equal(["L3"], dekking.GemetenJaarFasen);
        Assert.Empty(dekking.Doelen);
        Assert.Equal(0, dekking.AantalLeerplandoelen);
        Assert.Equal(0, dekking.AantalGedekt);
        Assert.Equal(3, dekking.AantalBuitenBereik);
        Assert.False(dekking.IsTerugvalNaarHeelCurriculum);
    }

    [PostgresFact]
    public async Task Een_geplaatst_thema_dekt_zijn_doel_en_noemt_zichzelf_als_bewijs()
    {
        // THE SENTENCE THIS STORY EXISTS TO DELIVER, asserted end to end for the first time: "a leerplandoel is
        // gedekt when a thema carrying it is placed in a real period of the class's plan". Everything else verifies a
        // half — the unit tests fake the database, the layer tests never touch a jaarplan — so without this the two
        // halves were only ever checked against each other's fakes. For a coverage feature that is the difference
        // between a green suite and a screen reporting 0% for a fully planned class.
        var (klasId, _) = await ZetGeplaatstThemaOpAsync(KoppelingStatus.Aanvaard, vervallen: false);

        var dekking = await HaalDekkingAsync(klasId);

        Assert.True(dekking.IsBetrouwbaar);
        Assert.Equal(1, dekking.AantalGedekt);

        var gedekt = dekking.Doelen.Single(d => d.Code == "DEK-01");
        Assert.True(gedekt.IsGedekt);
        Assert.Equal(["Herfstthema"], gedekt.DekkendeThemas);

        // The other loaded goal is untouched by this plan, so the gap list has something in it.
        Assert.False(dekking.Doelen.Single(d => d.Code == "DEK-02").IsGedekt);
    }

    [PostgresFact]
    public async Task Een_vervallen_plaatsing_houdt_het_cijfer_tegen_tot_aan_de_HTTP_grens()
    {
        // E3-07's clause 4, end to end. Its own test report recorded this as "not verifiable" rather than as a pass,
        // because nothing computed dekking yet. A caller now literally receives no number: aantalGedekt is absent
        // from the JSON, so it cannot render a total it does not have.
        var (klasId, _) = await ZetGeplaatstThemaOpAsync(KoppelingStatus.Aanvaard, vervallen: true);

        var dekking = await HaalDekkingAsync(klasId);

        Assert.False(dekking.IsBetrouwbaar);
        Assert.Equal(1, dekking.AantalOnopgelosteVervallenPlaatsingen);
        Assert.Null(dekking.AantalGedekt);

        // And the stale placement covers nothing: it sits in no period at all.
        Assert.False(dekking.Doelen.Single(d => d.Code == "DEK-01").IsGedekt);

        // The denominator survives, because it is a property of the curriculum rather than of this plan.
        Assert.Equal(2, dekking.AantalLeerplandoelen);
    }

    [PostgresFact]
    public async Task Een_voorgestelde_plaatsing_dekt_ook_over_HTTP_niets()
    {
        // Art. IV.1 at the outermost boundary: the AI's own proposal, persisted exactly as generation persists it,
        // grants no dekking. Asserted here as well as in the unit tests because this is the layer an inspectie-facing
        // export would read.
        var (klasId, _) = await ZetGeplaatstThemaOpAsync(KoppelingStatus.Voorgesteld, vervallen: false);

        var dekking = await HaalDekkingAsync(klasId);

        Assert.True(dekking.IsBetrouwbaar);
        Assert.Equal(0, dekking.AantalGedekt);
        Assert.False(dekking.Doelen.Single(d => d.Code == "DEK-01").IsGedekt);
    }

    [PostgresFact]
    public async Task Een_kleutergroep_kan_over_HTTP_versmald_worden_tot_een_kleuterjaar()
    {
        // The owner ruling of 2026-08-04 over the wire. The seeded class is a kleutergroep (leerjaar 0), so its scope is
        // JK+K2+K3; DEK-01/DEK-02 are K3 and DEK-L6 is out of scope either way. Narrowing to JK must therefore measure
        // against NOTHING of the two K3 doelen, which is a stronger assertion than narrowing to K3 would be: it proves
        // the parameter reached the query rather than that the answer happened to look right.
        var klasId = await ZetKlasOpAsync(leerjaar: 0);

        var response = await _factory.CreateClient()
            .GetAsync($"/api/klassen/{klasId}/dekking?bereik=EigenJaarFase&jaarFase=JK");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var dekking = await response.Content.ReadFromJsonAsync<DekkingDto>();
        Assert.NotNull(dekking);
        Assert.Equal(["JK"], dekking.GemetenJaarFasen);
        Assert.Equal(["JK", "K2", "K3"], dekking.BeschikbareJaarFasen);
        Assert.Equal(0, dekking.AantalLeerplandoelen);
        Assert.Equal(3, dekking.AantalBuitenBereik);

        // Narrowing to K3 instead puts the two K3 doelen back, so the parameter is doing the work either way.
        var k3 = await _factory.CreateClient()
            .GetAsync($"/api/klassen/{klasId}/dekking?bereik=EigenJaarFase&jaarFase=K3");
        var k3Dekking = await k3.Content.ReadFromJsonAsync<DekkingDto>();
        Assert.NotNull(k3Dekking);
        Assert.Equal(["K3"], k3Dekking.GemetenJaarFasen);
        Assert.Equal(2, k3Dekking.AantalLeerplandoelen);
    }

    [PostgresFact]
    public async Task Een_jaar_fase_buiten_de_klas_wordt_over_HTTP_genegeerd_en_niet_geweigerd()
    {
        // A stale or hand-edited link: ignored rather than refused, so the teacher stays on a working screen, and the
        // response says what it actually measured so nothing can claim a narrowing that did not happen.
        var klasId = await ZetKlasOpAsync(leerjaar: 0);

        var dekking = await HaalDekkingAsync($"{klasId}/dekking?bereik=EigenJaarFase&jaarFase=L6");

        Assert.Equal(["JK", "K2", "K3"], dekking.GemetenJaarFasen);
        Assert.Equal(2, dekking.AantalLeerplandoelen);
    }

    [PostgresTheory]
    [InlineData("5")]
    [InlineData("-1")]
    [InlineData("onzin")]
    public async Task Een_bereik_dat_niet_bestaat_geeft_400_en_geen_cijfer(string bereik)
    {
        // Model binding rejects "onzin" by itself, but it accepts an enum's UNDERLYING NUMERIC form without
        // range-checking it: `?bereik=5` bound to (Dekkingsbereik)5, fell through the "not EigenJaarFase" branch and
        // returned whole-curriculum figures labelled with a `bereik` value no consumer's contract knows. A figure whose
        // scope label is meaningless is exactly what this response exists to prevent.
        //
        // All three are asserted together rather than only the numeric one, because the fix (Enum.IsDefined) and the
        // framework's own parsing now answer the same status for different reasons, and a later refactor that dropped
        // one of the two paths should fail here.
        var klasId = await ZetKlasOpAsync();

        var response = await _factory.CreateClient()
            .GetAsync($"/api/klassen/{klasId}/dekking?bereik={bereik}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        // And no figure leaked into the error body.
        var lichaam = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("aantalGedekt", lichaam);
    }

    [PostgresFact]
    public async Task Een_onbekende_klas_geeft_404_en_geen_lege_dekking()
    {
        // A coverage report for a class that does not exist would be a figure about nothing. The service raises
        // SchoolcontentNietGevondenFout and the shared handler maps it, which is what this asserts reaches the wire.
        var response = await _factory.CreateClient().GetAsync($"/api/klassen/{Guid.NewGuid()}/dekking");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private Task<DekkingDto> HaalDekkingAsync(Guid klasId) => HaalDekkingAsync($"{klasId}/dekking");

    /// <summary>The same read, with the path tail spelled out so a test can add a query string.</summary>
    private async Task<DekkingDto> HaalDekkingAsync(string staart)
    {
        var response = await _factory.CreateClient().GetAsync($"/api/klassen/{staart}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var dekking = await response.Content.ReadFromJsonAsync<DekkingDto>();
        Assert.NotNull(dekking);

        return dekking;
    }

    /// <summary>
    /// A class with a thema placed in its jaarplan, the thema carrying <c>DEK-01</c> as a themadoel.
    /// <para>
    /// <b>The block start is asked of the real <see cref="IPlanningsblokIndeling"/> seam rather than assumed.</b> A
    /// hard-coded date would make the non-stale case depend on the grid happening to start where the test guessed,
    /// and a test that silently drifts into asserting the stale path while claiming the healthy one is worse than no
    /// test. For the stale case the placement is deliberately keyed on a date <i>outside</i> the school year, which no
    /// derived block can ever start on.
    /// </para>
    /// </summary>
    private async Task<(Guid KlasId, Guid ThemaId)> ZetGeplaatstThemaOpAsync(
        KoppelingStatus plaatsingsstatus,
        bool vervallen)
    {
        var klasId = await ZetKlasOpAsync();

        using var scope = _factory.Services.CreateScope();
        var indeling = scope.ServiceProvider.GetRequiredService<IPlanningsblokIndeling>();
        await using var context = _db.MaakContext();

        var klas = await context.Klassen.SingleAsync(k => k.Id == klasId);
        var schooljaar = await context.Schooljaren.SingleAsync(s => s.Id == klas.SchooljaarId);

        var blokStart = vervallen
            ? schooljaar.Start.AddMonths(-1)
            : indeling.Blokken(schooljaar, JaarplanGeneratieService.GeneratieNiveau)[0].Start;

        var thema = new Thema("Herfstthema", duurWeken: 5);
        thema.VoegThemadoelToe(new DoelKoppeling("DEK-01", KoppelingStatus.Aanvaard, "anchor"));
        context.Themas.Add(thema);

        var jaarplan = new Jaarplan(klasId);
        jaarplan.VoegPlaatsingToe(
            thema.Id,
            JaarplanGeneratieService.GeneratieNiveau,
            blokStart,
            plaatsingsstatus,
            plaatsingsstatus == KoppelingStatus.Voorgesteld ? "past bij de herfst" : null);
        context.Jaarplannen.Add(jaarplan);

        await context.SaveChangesAsync();

        return (klasId, thema.Id);
    }

    [PostgresFact]
    public async Task Dekking_totalen_komen_overeen_met_de_rijen_die_ze_beschrijven()
    {
        // THE INVARIANT E5-03'S BROWSER NOW DEPENDS ON, and nothing asserted it anywhere until this test.
        //
        // E5-03 puts a doelsoort filter on the dekkingsoverzicht. Under a narrowing there is no server figure to read,
        // so the screen counts `doelen` itself; and because switching source on whether a filter is active is how two
        // implementations of one number start to drift, it counts them unfiltered too. That is only honest while the
        // payload's own totals agree with the payload's own rows.
        //
        // They do, by construction: `DekkingService` builds `AantalGedekt` as `doelen.Count(d => d.IsGedekt)` over the
        // very list it serialises. But "by construction" is exactly the kind of guarantee this repo has watched decay
        // (the te-vol threshold, the four DoelKoppeling layers), and every other assertion in this file pins an
        // ABSOLUTE value, so a change that broke the relationship while keeping each figure individually plausible
        // would pass all of them.
        //
        // A frontend test cannot stand in for this: its fixture derives the totals from the same array it asserts
        // against, so it compares a count with itself. This is the layer where the two can actually disagree.
        var (klasId, _) = await ZetGeplaatstThemaOpAsync(KoppelingStatus.Aanvaard, vervallen: false);

        var dekking = await HaalDekkingAsync(klasId);

        // A mixed pattern, not all-covered or all-uncovered: 1 of 2. Either extreme would let a broken count coincide
        // with the right answer.
        Assert.Equal(1, dekking.Doelen.Count(d => d.IsGedekt));
        Assert.Equal(2, dekking.Doelen.Count);

        Assert.Equal(dekking.Doelen.Count(d => d.IsGedekt), dekking.AantalGedekt);
        Assert.Equal(dekking.Doelen.Count, dekking.AantalLeerplandoelen);

        // And the evidence half travels with it: a doel is covered exactly when it names a thema, so a client counting
        // either field reaches the same total.
        Assert.All(dekking.Doelen, doel => Assert.Equal(doel.IsGedekt, doel.DekkendeThemas.Count > 0));
    }

    /// <summary>
    /// A school year with one class and two leerplandoelen, inserted straight through the DbContext because the point
    /// of this file is the read path rather than the write endpoints (which have their own tests).
    /// </summary>
    private async Task<Guid> ZetKlasOpAsync(int leerjaar = 0)
    {
        await using var context = _db.MaakContext();

        // Two kleuterdoelen and ONE L6 doel. The third exists so the scoped denominator is observable over HTTP: a
        // kleutergroep must not be measured against it (owner ruling 2026-08-04), and `?bereik=HeelCurriculum` must.
        // Seeded unconditionally rather than per test, because these rows are shared by every test in this class and
        // xUnit guarantees no order: a test that inserted a counted row would make its neighbours order-dependent.
        foreach (var (code, jaarFase) in new[] { ("DEK-01", "K3"), ("DEK-02", "K3"), ("DEK-L6", "L6") })
        {
            if (!await context.Leerplandoelen.AnyAsync(l => l.Code == code))
            {
                context.Leerplandoelen.Add(new Leerplandoel(
                    code,
                    Doelsoort.Gemeenschappelijk,
                    jaarFase,
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
        var klas = schooljaar.VoegKlasToe($"K3-{Guid.NewGuid():N}", leerjaar);
        context.Schooljaren.Add(schooljaar);

        await context.SaveChangesAsync();

        return klas.Id;
    }

    private sealed record DekkingDto(
        Guid KlasId,
        string KlasNaam,
        string Bereik,
        List<string> GemetenJaarFasen,
        List<string> BeschikbareJaarFasen,
        bool IsTerugvalNaarHeelCurriculum,
        int AantalBuitenBereik,
        bool IsBetrouwbaar,
        int AantalOnopgelosteVervallenPlaatsingen,
        int? AantalGedekt,
        int AantalLeerplandoelen,
        List<DoelDto> Doelen);

    private sealed record DoelDto(string Code, bool IsGedekt, List<string> DekkendeThemas);
}
