using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.SchoolcontentBeheer;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// TB-040: the thema tree loads as split queries, one per collection, because a single joined query multiplied the
/// sibling collections into a cartesian product that a full schooljaar turned into millions of rows. A split query
/// stitches its parts together by the root's order, so these tests seed a thema whose every collection has several
/// items at once and check that each item arrives exactly once, and that the list keeps its order by name.
/// <para>
/// Against real PostgreSQL, because the stitching is the provider's work and the in-memory provider does none.
/// </para>
/// </summary>
public sealed class ThemaboomLadenPostgresTests : IAsyncLifetime
{
    private const string Leeftijd = "K3";
    private const string AndereLeeftijd = "L1";

    private PostgresTestDatabase _db = null!;

    public async Task InitializeAsync()
    {
        if (PostgresTestDatabase.IsBeschikbaar)
        {
            _db = await PostgresTestDatabase.MaakAsync("themaboom");
        }
    }

    public async Task DisposeAsync()
    {
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    [PostgresFact]
    public async Task De_themalijst_bevat_elk_item_precies_een_keer_en_blijft_op_naam_gesorteerd()
    {
        var seed = await SeedAsync();

        await using var context = _db.MaakContext();
        var themas = await new SchoolcontentBeheerService(context).HaalThemasOpAsync();

        // Two thema's share a name, so the name alone does not make the order total and the Id tiebreak is needed.
        Assert.Equal(["Bos", "Bos", "Herfst", "Zee"], themas.Select(t => t.Naam));

        var herfst = Assert.Single(themas, t => t.Id == seed.ThemaId);
        AssertVolledigeBoom(herfst, verwachteSubthemas: 3);

        foreach (var ander in themas.Where(t => t.Id != seed.ThemaId))
        {
            var subthema = Assert.Single(ander.Subthemas);
            Assert.Equal(2, subthema.Subdoelen.Count);
            Assert.Equal(2, subthema.Activiteiten.Count);
            Assert.Single(ander.Themadoelen);
        }
    }

    [PostgresFact]
    public async Task Een_thema_openen_bevat_elk_item_precies_een_keer()
    {
        var seed = await SeedAsync();

        await using var context = _db.MaakContext();
        var thema = await new SchoolcontentBeheerService(context).HaalThemaOpAsync(seed.ThemaId);

        AssertVolledigeBoom(thema, verwachteSubthemas: 3);
    }

    [PostgresFact]
    public async Task Een_thema_openen_voor_een_klas_bevat_alleen_de_eigen_leeftijd_en_elk_item_een_keer()
    {
        var seed = await SeedAsync();

        await using var context = _db.MaakContext();
        var thema = await new SchoolcontentBeheerService(context).HaalThemaVoorKlasAsync(seed.ThemaId, seed.KlasId);

        Assert.Equal(2, thema.Subthemas.Count);
        Assert.All(thema.Subthemas, s => Assert.Equal(Leeftijd, s.Leeftijd));
        AssertGeenDubbels(thema);
        Assert.All(thema.Subthemas, s =>
        {
            Assert.Equal(3, s.Subdoelen.Count);
            Assert.Equal(3, s.Activiteiten.Count);
            Assert.All(s.Activiteiten, a => Assert.Equal(2, a.Doelkoppelingen.Count));
        });
    }

    [PostgresFact]
    public async Task Het_doelenoverzicht_van_een_volle_thema_boom_laadt()
    {
        var seed = await SeedAsync();

        await using var context = _db.MaakContext();
        var overzicht = await new ThemaDoelenoverzichtQuery(context).HaalOpAsync(seed.ThemaId);

        Assert.Equal(seed.ThemaId, overzicht.ThemaId);
        Assert.Contains(overzicht.Leeftijden, l => l.Leeftijd == Leeftijd);
    }

    [PostgresFact]
    public async Task Een_wijziging_aan_een_geladen_thema_slaagt_en_laat_de_boom_intact()
    {
        var seed = await SeedAsync();

        await using (var context = _db.MaakContext())
        {
            var service = new SchoolcontentBeheerService(context);
            var thema = await service.HaalThemaOpAsync(seed.ThemaId);
            await service.WijzigThemaAsync(
                seed.ThemaId,
                new ThemaWijziging(
                    "Herfst", thema.DuurWeken, "nieuwe invalshoek", thema.Kernwoordenschat, thema.RijkeWoordenschat));
        }

        await using (var context = _db.MaakContext())
        {
            var thema = await new SchoolcontentBeheerService(context).HaalThemaOpAsync(seed.ThemaId);
            Assert.Equal("nieuwe invalshoek", thema.Invalshoeken);
            AssertVolledigeBoom(thema, verwachteSubthemas: 3);
        }
    }

    private static void AssertVolledigeBoom(ThemaWeergave thema, int verwachteSubthemas)
    {
        AssertGeenDubbels(thema);
        Assert.Equal(3, thema.Themadoelen.Count);
        Assert.Equal(2, thema.Minimumdoelen.Count);
        Assert.Equal(verwachteSubthemas, thema.Subthemas.Count);
        Assert.All(thema.Subthemas, s =>
        {
            Assert.Equal(3, s.Subdoelen.Count);
            Assert.Equal(3, s.Activiteiten.Count);
            Assert.Equal(2, s.Onderzoeksvragen.Count);
            Assert.All(s.Activiteiten, a => Assert.Equal(2, a.Doelkoppelingen.Count));
        });
    }

    private static void AssertGeenDubbels(ThemaWeergave thema)
    {
        AssertUniek(thema.Themadoelen.Select(td => td.Id));
        AssertUniek(thema.Minimumdoelen.Select(m => m.MinimumdoelRef));
        AssertUniek(thema.Subthemas.Select(s => s.Id));
        AssertUniek(thema.Subthemas.SelectMany(s => s.Subdoelen).Select(d => d.Id));
        AssertUniek(thema.Subthemas.SelectMany(s => s.Activiteiten).Select(a => a.Id));
        AssertUniek(thema.Subthemas.SelectMany(s => s.Onderzoeksvragen).Select(v => v.Id));
        AssertUniek(thema.Subthemas.SelectMany(s => s.Activiteiten).SelectMany(a => a.Doelkoppelingen).Select(k => k.Id));
    }

    private static void AssertUniek<T>(IEnumerable<T> waarden)
    {
        var lijst = waarden.ToList();
        Assert.Equal(lijst.Count, lijst.Distinct().Count());
    }

    /// <summary>
    /// One rich thema (three subthema's, two at the klas's age, each with three subdoelen, three activiteiten of two
    /// doelkoppelingen, and two onderzoeksvragen) and three plain ones, two sharing a name.
    /// </summary>
    private async Task<Seed> SeedAsync()
    {
        await using var context = _db.MaakContext();

        var schooljaar = TestSchooljaar.MetVakanties(TestSchooljaar.UniekeNaam("themaboom"));
        var klas = schooljaar.VoegKlasToe($"K3-{Guid.NewGuid():N}"[..12], Leeftijd);
        context.Schooljaren.Add(schooljaar);

        var codes = Enumerable.Range(1, 4).Select(i => $"TB40-{i}").ToArray();
        foreach (var code in codes)
        {
            context.Leerplandoelen.Add(new Leerplandoel(
                code, Doelsoort.Minimumdoel, Leeftijd, "Natuur", "Levende natuur", "3", tekst: "herkent bomen."));
        }

        foreach (var minimumdoelRef in new[] { "TB40-MD-1", "TB40-MD-2" })
        {
            context.Minimumdoelen.Add(new Minimumdoel(minimumdoelRef, "K-", "1", $"Tekst van {minimumdoelRef}"));
        }

        var herfst = new Thema("Herfst", duurWeken: 6);
        foreach (var code in codes.Take(3))
        {
            herfst.VoegThemadoelToe(new DoelKoppeling(code, KoppelingStatus.Manueel));
        }

        foreach (var (naam, leeftijd) in new[] { ("Bladeren", Leeftijd), ("Paddenstoelen", Leeftijd), ("Noten", AndereLeeftijd) })
        {
            var subthema = herfst.VoegSubthemaToe(naam, duurWeken: 2, leeftijd);
            foreach (var code in codes.Take(3))
            {
                subthema.VoegSubdoelToe(leeftijd, new DoelKoppeling(code, KoppelingStatus.Manueel));
            }

            subthema.VoegOnderzoeksvraagToe($"Waarom {naam}?");
            subthema.VoegOnderzoeksvraagToe($"Waar {naam}?");
            for (var i = 1; i <= 3; i++)
            {
                var activiteit = subthema.VoegActiviteitToe($"{naam} {i}", ActiviteitType.Waarneming);
                activiteit.VoegDoelkoppelingToe(new DoelKoppeling(codes[0], KoppelingStatus.Manueel));
                activiteit.VoegDoelkoppelingToe(new DoelKoppeling(codes[3], KoppelingStatus.Manueel));
            }
        }

        context.Themas.Add(herfst);
        context.ThemaMinimumdoelen.AddRange(herfst.KoppelMinimumdoel("TB40-MD-1"), herfst.KoppelMinimumdoel("TB40-MD-2"));

        foreach (var naam in new[] { "Zee", "Bos", "Bos" })
        {
            var thema = new Thema(naam, duurWeken: 4);
            thema.VoegThemadoelToe(new DoelKoppeling(codes[0], KoppelingStatus.Manueel));
            var subthema = thema.VoegSubthemaToe("Eerste", duurWeken: 2, Leeftijd);
            subthema.VoegSubdoelToe(Leeftijd, new DoelKoppeling(codes[1], KoppelingStatus.Manueel));
            subthema.VoegSubdoelToe(Leeftijd, new DoelKoppeling(codes[2], KoppelingStatus.Manueel));
            subthema.VoegActiviteitToe("Een", ActiviteitType.Waarneming);
            subthema.VoegActiviteitToe("Twee", ActiviteitType.Waarneming);
            context.Themas.Add(thema);
        }

        await context.SaveChangesAsync();
        return new Seed(herfst.Id, klas.Id);
    }

    private sealed record Seed(Guid ThemaId, Guid KlasId);
}
