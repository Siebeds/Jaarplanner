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
        // the whole loaded curriculum is the honest answer, and it is a TRUSTWORTHY 0 — nothing is unresolved.
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
    public async Task Een_onbekende_klas_geeft_404_en_geen_lege_dekking()
    {
        // A coverage report for a class that does not exist would be a figure about nothing. The service raises
        // SchoolcontentNietGevondenFout and the shared handler maps it, which is what this asserts reaches the wire.
        var response = await _factory.CreateClient().GetAsync($"/api/klassen/{Guid.NewGuid()}/dekking");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private async Task<DekkingDto> HaalDekkingAsync(Guid klasId)
    {
        var response = await _factory.CreateClient().GetAsync($"/api/klassen/{klasId}/dekking");
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

    /// <summary>
    /// A school year with one class and two leerplandoelen, inserted straight through the DbContext because the point
    /// of this file is the read path rather than the write endpoints (which have their own tests).
    /// </summary>
    private async Task<Guid> ZetKlasOpAsync()
    {
        await using var context = _db.MaakContext();

        foreach (var code in new[] { "DEK-01", "DEK-02" })
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
        var klas = schooljaar.VoegKlasToe($"K3-{Guid.NewGuid():N}", leerjaar: 0);
        context.Schooljaren.Add(schooljaar);

        await context.SaveChangesAsync();

        return klas.Id;
    }

    private sealed record DekkingDto(
        Guid KlasId,
        string KlasNaam,
        bool IsBetrouwbaar,
        int AantalOnopgelosteVervallenPlaatsingen,
        int? AantalGedekt,
        int AantalLeerplandoelen,
        List<DoelDto> Doelen);

    private sealed record DoelDto(string Code, bool IsGedekt, List<string> DekkendeThemas);
}
