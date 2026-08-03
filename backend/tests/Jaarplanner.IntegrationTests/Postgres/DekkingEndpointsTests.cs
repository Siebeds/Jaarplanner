using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

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
    public async Task Een_onbekende_klas_geeft_404_en_geen_lege_dekking()
    {
        // A coverage report for a class that does not exist would be a figure about nothing. The service raises
        // SchoolcontentNietGevondenFout and the shared handler maps it, which is what this asserts reaches the wire.
        var response = await _factory.CreateClient().GetAsync($"/api/klassen/{Guid.NewGuid()}/dekking");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
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
        int AantalVervallenPlaatsingen,
        int? AantalGedekt,
        int AantalLeerplandoelen,
        List<DoelDto> Doelen);

    private sealed record DoelDto(string Code, bool IsGedekt, List<string> DekkendeThemas);
}
