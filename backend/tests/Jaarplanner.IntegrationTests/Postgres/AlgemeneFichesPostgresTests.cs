using Jaarplanner.Application.Curriculum;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Dekking;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The fifth link layer, algemene fiches, against <b>real PostgreSQL</b> (owner ruling, 2026-09-11; Art. V.1 as
/// amended). Every read here is a subquery over an owned collection, which is the shape the in-memory provider has
/// passed while Npgsql could not translate it, twice in this repo; and the migration's FKs (Restrict to the
/// leerplandoel, Restrict from placement to fiche) only exist in a real database.
/// <para>
/// <b>What each test proves is a rule:</b> a fiche counts only once it is planned, only for its own class, only
/// through a decided link; and the two other readers of the link layers (the ongekoppelde doelen and the register)
/// see the fifth one too, so no screen calls a doel "nergens gebruikt" that the turnles works on every week.
/// </para>
/// </summary>
public sealed class AlgemeneFichesPostgresTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("fiches");
    }

    public async Task DisposeAsync()
    {
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    [PostgresFact]
    public async Task Alleen_een_ingeplande_fiche_van_deze_klas_dekt()
    {
        var (klasId, andereKlasId) = await ZetOpAsync(async (context, klas, andere) =>
        {
            var turnen = new AlgemeneFiche(klas.Id, "Turnen");
            turnen.KoppelAanDoel("FICHE-GEPLAND");

            // Linked but never put in the agenda: a plan for a plan, and it proves nothing is taught.
            var zwemmen = new AlgemeneFiche(klas.Id, "Zwemmen");
            zwemmen.KoppelAanDoel("FICHE-NIET-GEPLAND");

            // Another class's planned fiche: it must not reach this class's figure.
            var vreemd = new AlgemeneFiche(andere.Id, "Onthaal");
            vreemd.KoppelAanDoel("FICHE-ANDERE-KLAS");

            context.AlgemeneFiches.AddRange(turnen, zwemmen, vreemd);

            var plaatsing = new AlgemeneFicheplaatsing(klas.Id, turnen.Id, new DateOnly(2026, 9, 7), new DateOnly(2026, 9, 25));
            plaatsing.PlanIn(new DateOnly(2026, 9, 7), new TimeOnly(10, 30), new TimeOnly(11, 20));
            var vreemdePlaatsing = new AlgemeneFicheplaatsing(andere.Id, vreemd.Id, new DateOnly(2026, 9, 7), new DateOnly(2026, 9, 25));
            vreemdePlaatsing.PlanIn(new DateOnly(2026, 9, 7), new TimeOnly(8, 30), new TimeOnly(9, 0));
            context.AlgemeneFicheplaatsingen.AddRange(plaatsing, vreemdePlaatsing);

            await context.SaveChangesAsync();
        });

        await using var leescontext = _db.MaakContext();
        var opslag = new EfDekkingOpslag(leescontext);

        var koppelingen = await opslag.HaalFichekoppelingenAsync(klasId);

        var koppeling = Assert.Single(koppelingen);
        Assert.Equal("FICHE-GEPLAND", koppeling.LeerplandoelCode);
        Assert.Equal("Turnen", koppeling.FicheNaam);

        // And the other class sees its own, and only its own.
        Assert.Equal(
            ["FICHE-ANDERE-KLAS"],
            (await opslag.HaalFichekoppelingenAsync(andereKlasId)).Select(k => k.LeerplandoelCode));
    }

    [PostgresFact]
    public async Task Een_ingeplande_fiche_kan_niet_weg_maar_een_klas_verwijderen_neemt_alles_mee()
    {
        Guid ficheId = Guid.Empty;
        var (klasId, _) = await ZetOpAsync(async (context, klas, _) =>
        {
            var turnen = new AlgemeneFiche(klas.Id, "Turnen");
            turnen.KoppelAanDoel("FICHE-GEPLAND");
            context.AlgemeneFiches.Add(turnen);

            var plaatsing = new AlgemeneFicheplaatsing(klas.Id, turnen.Id, new DateOnly(2026, 9, 7), new DateOnly(2026, 9, 25));
            plaatsing.PlanIn(new DateOnly(2026, 9, 7), new TimeOnly(10, 30), new TimeOnly(11, 20));
            context.AlgemeneFicheplaatsingen.Add(plaatsing);

            await context.SaveChangesAsync();
            ficheId = turnen.Id;
        });

        // The Restrict FK is what the service's Dutch refusal stands in front of. Proven here so that refusal is
        // known to be guarding something real rather than a comment.
        await using (var context = _db.MaakContext())
        {
            var fiche = await context.AlgemeneFiches.SingleAsync(f => f.Id == ficheId);
            context.AlgemeneFiches.Remove(fiche);
            await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
        }

        // The klas cascade reaches fiches, their links, their placements and their moments.
        await using (var context = _db.MaakContext())
        {
            await context.Klassen.Where(k => k.Id == klasId).ExecuteDeleteAsync();
        }

        await using (var context = _db.MaakContext())
        {
            Assert.False(await context.AlgemeneFiches.AnyAsync(f => f.Id == ficheId));
            Assert.False(await context.AlgemeneFicheplaatsingen.AnyAsync(p => p.KlasId == klasId));
            Assert.Equal(0, await context.AlgemeneFichemomenten.CountAsync());
        }
    }

    [PostgresFact]
    public async Task Een_doel_dat_alleen_een_fiche_draagt_is_niet_ongekoppeld_en_staat_in_het_register()
    {
        await ZetOpAsync(async (context, klas, _) =>
        {
            var turnen = new AlgemeneFiche(klas.Id, "Turnen");
            turnen.KoppelAanDoel("FICHE-GEPLAND");
            context.AlgemeneFiches.Add(turnen);
            await context.SaveChangesAsync();
        });

        await using var leescontext = _db.MaakContext();

        var ongekoppeld = await new OngekoppeldeDoelenQuery(leescontext).HaalOngekoppeldeDoelenAsync();
        Assert.DoesNotContain(ongekoppeld, d => d.Code == "FICHE-GEPLAND");
        Assert.Contains(ongekoppeld, d => d.Code == "FICHE-NIET-GEPLAND");

        var register = new LeerplandoelenQuery(leescontext);

        var detail = await register.HaalDetailAsync("FICHE-GEPLAND", Koppelingzichtbaarheid.Alles, _ => true);
        var regel = Assert.Single(detail!.Koppelingen);
        Assert.Equal(KoppelingHerkomst.AlgemeneFiche, regel.Herkomst);
        Assert.Equal("Turnen", regel.ThemaNaam);
        Assert.StartsWith("K3-", regel.Onderdeel);
        Assert.Equal(KoppelingStatus.Manueel, regel.Status);

        // Behind the same gate as the other class-scoped layers.
        var afgeschermd = await register.HaalDetailAsync("FICHE-GEPLAND", Koppelingzichtbaarheid.AlleenSchoolbreed, _ => true);
        Assert.Empty(afgeschermd!.Koppelingen);

        // FB-013 (ADR-0040): a fiche is its klas's planning, so a reader who may not read that klas does not see it.
        var nietLeesbaar = await register.HaalDetailAsync("FICHE-GEPLAND", Koppelingzichtbaarheid.Alles, _ => false);
        Assert.Empty(nietLeesbaar!.Koppelingen);
    }

    /// <summary>A school year with two K3 classes, and every code these tests link to.</summary>
    private async Task<(Guid KlasId, Guid AndereKlasId)> ZetOpAsync(Func<AppDbContext, Klas, Klas, Task> arrangeer)
    {
        await using var context = _db.MaakContext();

        foreach (var code in new[] { "FICHE-GEPLAND", "FICHE-NIET-GEPLAND", "FICHE-ANDERE-KLAS" })
        {
            if (!await context.Leerplandoelen.AnyAsync(l => l.Code == code))
            {
                context.Leerplandoelen.Add(new Leerplandoel(
                    code, Doelsoort.Gemeenschappelijk, "K3", "Motoriek", "Grove motoriek", "9.1", tekst: $"doel {code}"));
            }
        }

        // Truncated to fit Schooljaar.Naam's varchar(32), like the other arrangements in this folder.
        var schooljaar = new Schooljaar($"2026-2027-{Guid.NewGuid():N}"[..20], new DateOnly(2026, 9, 1), new DateOnly(2027, 6, 30));
        var klas = schooljaar.VoegKlasToe($"K3-{Guid.NewGuid():N}", "K3");
        var andere = schooljaar.VoegKlasToe($"K3b-{Guid.NewGuid():N}", "K3");
        context.Schooljaren.Add(schooljaar);
        await context.SaveChangesAsync();

        await arrangeer(context, klas, andere);

        return (klas.Id, andere.Id);
    }
}
