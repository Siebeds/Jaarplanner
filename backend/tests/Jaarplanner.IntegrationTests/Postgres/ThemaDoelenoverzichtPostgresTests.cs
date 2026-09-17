using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.SchoolcontentBeheer;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// TB-048: "Doelen per leeftijd" lists the leerplandoelen of the thema's minimumdoelen, so linking or unlinking a
/// minimumdoel changes it at once, and a decided link outside those minimumdoelen stays visible apart. Against real
/// PostgreSQL, because the list is a translated <c>IN</c> over the concordance ref.
/// </summary>
public sealed class ThemaDoelenoverzichtPostgresTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;

    public async Task InitializeAsync()
    {
        if (PostgresTestDatabase.IsBeschikbaar)
        {
            _db = await PostgresTestDatabase.MaakAsync("doelenoverzicht");
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
    public async Task Koppelen_en_ontkoppelen_van_een_minimumdoel_past_de_lijst_meteen_aan()
    {
        Guid themaId;
        await using (var context = _db.MaakContext())
        {
            context.Minimumdoelen.AddRange(
                new Minimumdoel("TB48-MD-1", "K-", "1", "eerste eindterm"),
                new Minimumdoel("TB48-MD-2", "K-", "2", "tweede eindterm"));
            context.Leerplandoelen.AddRange(
                Doel("TB48.K2.1", "K2", "TB48-MD-1"),
                Doel("TB48.K3.1", "K3", "TB48-MD-1"),
                Doel("TB48.K3.2", "K3", "TB48-MD-2"),
                Doel("TB48.K3.3", "K3", minimumdoelRef: null));

            var thema = new Thema("Winter", duurWeken: 4);
            var subthema = thema.VoegSubthemaToe("Sneeuw", duurWeken: 2, "K3");
            subthema.VoegSubdoelToe("K3", new DoelKoppeling("TB48.K3.2", KoppelingStatus.Manueel));
            subthema.VoegSubdoelToe("K3", new DoelKoppeling("TB48.K3.3", KoppelingStatus.Manueel));
            context.Themas.Add(thema);
            await context.SaveChangesAsync();
            themaId = thema.Id;
        }

        await using (var context = _db.MaakContext())
        {
            var leeg = await new ThemaDoelenoverzichtQuery(context).HaalOpAsync(themaId);
            var k3 = Assert.Single(leeg.Leeftijden);
            Assert.Empty(k3.Leerplandoelen);
            Assert.Equal(["TB48.K3.2", "TB48.K3.3"], k3.BuitenMinimumdoelen.Select(l => l.Code));
        }

        Guid koppelingId;
        await using (var context = _db.MaakContext())
        {
            await new SchoolcontentBeheerService(context).KoppelMinimumdoelAsync(themaId, "TB48-MD-1");
            koppelingId = (await new SchoolcontentBeheerService(context).KoppelMinimumdoelAsync(themaId, "TB48-MD-2")).Id;
        }

        await using (var context = _db.MaakContext())
        {
            var gekoppeld = await new ThemaDoelenoverzichtQuery(context).HaalOpAsync(themaId);
            Assert.Equal(["K2", "K3"], gekoppeld.Leeftijden.Select(l => l.Leeftijd));
            Assert.Equal(["TB48.K2.1"], gekoppeld.Leeftijden[0].Leerplandoelen.Select(l => l.Code));
            Assert.Equal(["TB48.K3.1", "TB48.K3.2"], gekoppeld.Leeftijden[1].Leerplandoelen.Select(l => l.Code));
            Assert.Equal(["TB48.K3.3"], gekoppeld.Leeftijden[1].BuitenMinimumdoelen.Select(l => l.Code));
        }

        await using (var context = _db.MaakContext())
        {
            await new SchoolcontentBeheerService(context).OntkoppelMinimumdoelAsync(themaId, koppelingId);
        }

        await using (var context = _db.MaakContext())
        {
            var ontkoppeld = await new ThemaDoelenoverzichtQuery(context).HaalOpAsync(themaId);
            Assert.Equal(["TB48.K3.1"], ontkoppeld.Leeftijden[1].Leerplandoelen.Select(l => l.Code));
            // Still linked as a subdoel, so it moves to the group beside the list rather than vanish.
            Assert.Equal(["TB48.K3.2", "TB48.K3.3"], ontkoppeld.Leeftijden[1].BuitenMinimumdoelen.Select(l => l.Code));
        }
    }

    private static Leerplandoel Doel(string code, string jaarFase, string? minimumdoelRef) =>
        new(code, Doelsoort.Gemeenschappelijk, jaarFase, "Natuur", "Levende natuur", "3", tekst: $"tekst {code}", minimumdoelRef: minimumdoelRef);
}
