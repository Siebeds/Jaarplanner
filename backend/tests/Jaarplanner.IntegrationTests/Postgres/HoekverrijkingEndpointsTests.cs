using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// Hoekverrijkingen per subthemaperiode over HTTP and in the migration, against real PostgreSQL (FB-020, ADR-0040).
/// <para>
/// The unit tests hold the service's rules on the in-memory provider, which enforces no foreign key and no cascade.
/// This is where the three things only PostgreSQL can show are proven: the unique (hoek, window) pair, the cascade when
/// a subthema is deleted, and the migration that carries the old dated verrijkingen over to the windows they overlap.
/// </para>
/// </summary>
public sealed class HoekverrijkingEndpointsTests : IAsyncLifetime
{
    /// <summary>The migration before this ticket's, the shape the old rows are written in.</summary>
    private const string VorigeMigratie = "20260915144921_AlgemeneFichemomentTekst";

    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("hoekverrijking");
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
    public async Task Bewaren_lezen_tellen_en_met_het_subthema_verwijderen()
    {
        var zet = await ZetOpAsync();
        var client = _factory.CreateClient();

        // No window stored yet: the save stores it as the agenda draws it (owner, 2026-09-15), then writes the texts.
        var bewaard = await client.PutAsJsonAsync($"/api/klassen/{zet.KlasId}/hoekverrijkingen", new
        {
            subthemaperiodeId = (Guid?)null,
            subthemaId = zet.Herfst,
            van = "2026-09-14",
            tot = "2026-09-25",
            verrijkingen = new[]
            {
                new { hoekId = zet.Boekenhoek, tekst = "prentenboeken over de herfst" },
                new { hoekId = zet.Bouwhoek, tekst = "kastanjes" },
            },
        });
        Assert.Equal(HttpStatusCode.OK, bewaard.StatusCode);
        var periode = (await bewaard.Content.ReadFromJsonAsync<PeriodeDto>())!;
        Assert.Equal(2, periode.Verrijkingen.Count);

        // The weekplanning names the stored window by the id the verrijkingen hang on.
        var week = await client.GetFromJsonAsync<WeekDto>(
            $"/api/klassen/{zet.KlasId}/jaarplan/weekplanning?van=2026-09-14&tot=2026-09-20");
        Assert.Equal(periode.SubthemaperiodeId, Assert.Single(week!.Subthemaperiodes).Id);

        // Saving again with the window's id rewrites one hoek and removes the other (a blank text).
        (await client.PutAsJsonAsync($"/api/klassen/{zet.KlasId}/hoekverrijkingen", new
        {
            subthemaperiodeId = periode.SubthemaperiodeId,
            verrijkingen = new object[]
            {
                new { hoekId = zet.Boekenhoek, tekst = "prentenboeken en bladeren" },
                new { hoekId = zet.Bouwhoek, tekst = "" },
            },
        })).EnsureSuccessStatusCode();

        var gelezen = await client.GetFromJsonAsync<List<PeriodeDto>>(
            $"/api/klassen/{zet.KlasId}/hoekverrijkingen?van=2026-09-21&tot=2026-09-27");
        var verrijking = Assert.Single(Assert.Single(gelezen!).Verrijkingen);
        Assert.Equal((zet.Boekenhoek, "prentenboeken en bladeren"), (verrijking.HoekId, verrijking.Tekst));

        var aantal = await client.GetFromJsonAsync<AantalDto>($"/api/subthemas/{zet.Herfst}/hoekverrijkingen/aantal");
        Assert.Equal(1, aantal!.Aantal);

        // Deleting the subthema takes its window and the verrijking on it along.
        (await client.DeleteAsync($"/api/subthemas/{zet.Herfst}")).EnsureSuccessStatusCode();

        await using var na = _db.MaakContext();
        Assert.Empty(await na.Hoekverrijkingen.ToListAsync());
        Assert.Equal(2, await na.Hoeken.CountAsync(h => h.KlasId == zet.KlasId));
    }

    [PostgresFact]
    public async Task Een_hoek_van_een_andere_klas_is_een_nederlandse_400_en_bewaart_niets()
    {
        var zet = await ZetOpAsync();
        var client = _factory.CreateClient();

        var geweigerd = await client.PutAsJsonAsync($"/api/klassen/{zet.KlasId}/hoekverrijkingen", new
        {
            subthemaId = zet.Herfst,
            van = "2026-09-14",
            tot = "2026-09-25",
            verrijkingen = new[] { new { hoekId = zet.HoekVanAndereKlas, tekst = "zand" } },
        });

        Assert.Equal(HttpStatusCode.BadRequest, geweigerd.StatusCode);
        Assert.Contains("Die hoek hoort bij een andere klas.", await geweigerd.Content.ReadAsStringAsync());

        await using var na = _db.MaakContext();
        Assert.Empty(await na.Subthemaplaatsingen.ToListAsync());
        Assert.Empty(await na.Hoekverrijkingen.ToListAsync());
    }

    /// <summary>
    /// The owner's ruling for the existing rows (2026-09-15): each old verrijking goes to every subthemaperiode of its
    /// klas it shares a day with, two landing on one pair are joined in date order, and one sharing a day with none is
    /// dropped. Proven by stepping the database back one migration, writing rows in the old shape, and migrating up.
    /// </summary>
    [PostgresFact]
    public async Task De_migratie_zet_oude_verrijkingen_om_naar_de_subthemaperiodes_waarmee_ze_overlappen()
    {
        var zet = await ZetOpAsync();
        Guid plaatsingId;
        Guid herfstVenster;
        Guid winterVenster;

        await using (var context = _db.MaakContext())
        {
            var jaarplan = new Jaarplan(zet.KlasId);
            context.Jaarplannen.Add(jaarplan);
            var herfst = new Subthemaplaatsing(jaarplan.Id, zet.Herfst, new DateOnly(2026, 9, 14), new DateOnly(2026, 9, 25));
            var winter = new Subthemaplaatsing(jaarplan.Id, zet.Winter, new DateOnly(2026, 9, 28), new DateOnly(2026, 10, 9));
            context.Subthemaplaatsingen.AddRange(herfst, winter);
            var plaatsing = new Hoekplaatsing(zet.KlasId, zet.Boekenhoek, new DateOnly(2026, 9, 1), new DateOnly(2026, 10, 30));
            context.Hoekplaatsingen.Add(plaatsing);
            await context.SaveChangesAsync();

            (plaatsingId, herfstVenster, winterVenster) = (plaatsing.Id, herfst.Id, winter.Id);

            await context.GetService<IMigrator>().MigrateAsync(VorigeMigratie);
        }

        await using (var context = _db.MaakContext())
        {
            // Written in the order the joined text must NOT come out in, so the date order is the migration's doing.
            await OudeVerrijkingAsync(context, plaatsingId, new DateOnly(2026, 9, 21), new DateOnly(2026, 10, 2), "kastanjes");
            await OudeVerrijkingAsync(context, plaatsingId, new DateOnly(2026, 9, 14), new DateOnly(2026, 9, 18), "herfstboeken");
            await OudeVerrijkingAsync(context, plaatsingId, new DateOnly(2026, 10, 19), new DateOnly(2026, 10, 23), "overlapt niets");

            await context.Database.MigrateAsync();
        }

        await using var na = _db.MaakContext();
        var rijen = await na.Hoekverrijkingen.ToListAsync();

        Assert.Equal(2, rijen.Count);
        Assert.All(rijen, r => Assert.Equal(zet.Boekenhoek, r.HoekId));
        Assert.Equal("herfstboeken\n\nkastanjes", rijen.Single(r => r.SubthemaplaatsingId == herfstVenster).Tekst);
        Assert.Equal("kastanjes", rijen.Single(r => r.SubthemaplaatsingId == winterVenster).Tekst);
    }

    private static Task<int> OudeVerrijkingAsync(
        AppDbContext context,
        Guid plaatsingId,
        DateOnly van,
        DateOnly tot,
        string tekst) =>
        context.Database.ExecuteSqlAsync(
            $"""INSERT INTO hoekverrijkingen ("Id", "HoekplaatsingId", "Van", "Tot", "Tekst") VALUES ({Guid.NewGuid()}, {plaatsingId}, {van}, {tot}, {tekst})""");

    /// <summary>A school year with two K3 classes, their corners, and a thema with two K3 subthema's, seeded directly.</summary>
    private async Task<Opzet> ZetOpAsync()
    {
        await using var context = _db.MaakContext();

        var schooljaar = new Schooljaar($"2026-2027-{Guid.NewGuid():N}"[..20], new DateOnly(2026, 9, 1), new DateOnly(2027, 6, 30));
        var klas = schooljaar.VoegKlasToe($"K3-{Guid.NewGuid():N}", "K3");
        var andere = schooljaar.VoegKlasToe($"K3-{Guid.NewGuid():N}", "K3");
        context.Schooljaren.Add(schooljaar);

        var boeken = new Hoek(klas.Id, "boekenhoek");
        var bouwen = new Hoek(klas.Id, "bouwhoek");
        var vreemd = new Hoek(andere.Id, "zandtafel");
        context.Hoeken.AddRange(boeken, bouwen, vreemd);

        var thema = new Thema($"Seizoenen-{Guid.NewGuid():N}", 6);
        var herfst = thema.VoegSubthemaToe("De herfst", 2, "K3");
        var winter = thema.VoegSubthemaToe("De winter", 2, "K3");
        context.Themas.Add(thema);

        await context.SaveChangesAsync();
        return new Opzet(klas.Id, boeken.Id, bouwen.Id, vreemd.Id, herfst.Id, winter.Id);
    }

    private sealed record Opzet(Guid KlasId, Guid Boekenhoek, Guid Bouwhoek, Guid HoekVanAndereKlas, Guid Herfst, Guid Winter);

    private sealed record PeriodeDto(Guid SubthemaperiodeId, string SubthemaNaam, List<VerrijkingDto> Verrijkingen);

    private sealed record VerrijkingDto(Guid Id, Guid HoekId, string Tekst);

    private sealed record WeekDto(List<VensterDto> Subthemaperiodes);

    private sealed record VensterDto(Guid Id, Guid SubthemaId);

    private sealed record AantalDto(int Aantal);
}
