using Jaarplanner.Application.Ai;
using Jaarplanner.Application.AiMatching;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.UnitTests.AiAuthoring;

namespace Jaarplanner.UnitTests.Ai;

/// <summary>
/// The decision on a thema's doelsuggestie (FB-053, FR-4.3, Art. IV.1/IV.2): accepting a proposal makes its minimumdoel
/// a themadoel, rejecting keeps it stored so it is not proposed again, and a proposal is decided once. Runs against the
/// in-memory <see cref="FakeDoelMatchOpslag"/>: no database, no network, and nothing changes without an explicit call.
/// </summary>
public sealed class DoelsuggestieStatusTests
{
    private static readonly Guid ThemaId = Guid.NewGuid();

    private static readonly Minimumdoel Rijm = new("K-1.1.1", "K-", "1.1.1", "De kleuters kunnen rijm herkennen.");

    private static (DoelMatchingService Service, FakeDoelMatchOpslag Opslag, Thema Thema, Minimumdoelsuggestie Suggestie) Opzet(
        bool metMinimumdoel = true)
    {
        var thema = new Thema("Herfst", duurWeken: 4);
        var suggestie = thema.VoegDoelsuggestieToe("K-1.1.1", "Het thema speelt met rijmpjes.");
        var opslag = new FakeDoelMatchOpslag(thema);
        var service = new DoelMatchingService(
            new FakeAiClient(cannedContent: "{\"suggesties\":[]}"),
            opslag,
            new FakeLeerdoelCatalogus([]) { Minimumdoelen = metMinimumdoel ? [Rijm] : [] },
            new Promptbegrenzing());
        return (service, opslag, thema, suggestie);
    }

    [Fact]
    public async Task Aanvaarden_maakt_het_minimumdoel_een_themadoel()
    {
        var (service, opslag, thema, suggestie) = Opzet();
        Assert.Empty(thema.Minimumdoelen);

        var weergave = await service.WijzigSuggestieStatusAsync(ThemaId, suggestie.Id, KoppelingStatus.Aanvaard);

        Assert.Equal("Aanvaard", weergave.Status);
        Assert.Equal(KoppelingStatus.Aanvaard, suggestie.Status);
        Assert.Equal("K-1.1.1", Assert.Single(thema.Minimumdoelen).MinimumdoelRef);
        // Persisted through the store in one unit of work, so it survives a reload (Art. IV.2).
        Assert.Equal(1, opslag.AantalKeerBewaard);
        // The read view carries the goal's own text, so the row can be judged (FR-4.2).
        Assert.Equal("De kleuters kunnen rijm herkennen.", weergave.Omschrijving);
        Assert.Equal("K-", weergave.Mijlpaal);
        Assert.Equal("Het thema speelt met rijmpjes.", weergave.AiMotivatie);
    }

    [Fact]
    public async Task Aanvaarden_van_een_minimumdoel_dat_al_themadoel_is_koppelt_het_niet_twee_keer()
    {
        var thema = new Thema("Herfst", duurWeken: 4);
        var suggestie = thema.VoegDoelsuggestieToe("K-1.1.1", "past");
        // A person linked the same minimumdoel by hand after the run (the domain refuses the reverse order).
        thema.KoppelMinimumdoel("K-1.1.1");
        var service = new DoelMatchingService(
            new FakeAiClient(cannedContent: "{\"suggesties\":[]}"),
            new FakeDoelMatchOpslag(thema),
            new FakeLeerdoelCatalogus([]) { Minimumdoelen = [Rijm] },
            new Promptbegrenzing());

        await service.WijzigSuggestieStatusAsync(ThemaId, suggestie.Id, KoppelingStatus.Aanvaard);

        Assert.Single(thema.Minimumdoelen);
        Assert.Equal(KoppelingStatus.Aanvaard, suggestie.Status);
    }

    [Fact]
    public async Task Weigeren_bewaart_het_voorstel_als_geweigerd_zonder_themadoel()
    {
        var (service, opslag, thema, suggestie) = Opzet();

        var weergave = await service.WijzigSuggestieStatusAsync(ThemaId, suggestie.Id, KoppelingStatus.Geweigerd);

        Assert.Equal("Geweigerd", weergave.Status);
        Assert.Same(suggestie, Assert.Single(thema.Doelsuggesties));
        Assert.Empty(thema.Minimumdoelen);
        Assert.True(thema.IsUitgeslotenVoorVoorstel("K-1.1.1"));
        Assert.Equal(1, opslag.AantalKeerBewaard);
    }

    [Theory]
    [InlineData(KoppelingStatus.Voorgesteld)]
    [InlineData(KoppelingStatus.Manueel)]
    public async Task Alleen_aanvaarden_of_weigeren_is_een_beslissing(KoppelingStatus status)
    {
        var (service, opslag, thema, suggestie) = Opzet();

        await Assert.ThrowsAsync<OngeldigeSuggestieStatusFout>(
            () => service.WijzigSuggestieStatusAsync(ThemaId, suggestie.Id, status));

        Assert.Equal(KoppelingStatus.Voorgesteld, suggestie.Status);
        Assert.Empty(thema.Minimumdoelen);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Een_voorstel_wordt_een_keer_beslist()
    {
        var (service, opslag, thema, suggestie) = Opzet();
        await service.WijzigSuggestieStatusAsync(ThemaId, suggestie.Id, KoppelingStatus.Geweigerd);

        await Assert.ThrowsAsync<OngeldigeSuggestieStatusFout>(
            () => service.WijzigSuggestieStatusAsync(ThemaId, suggestie.Id, KoppelingStatus.Aanvaard));

        Assert.Equal(KoppelingStatus.Geweigerd, suggestie.Status);
        Assert.Empty(thema.Minimumdoelen);
        Assert.Equal(1, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Onbekende_suggestie_geeft_niet_gevonden()
    {
        var (service, opslag, _, _) = Opzet();

        await Assert.ThrowsAsync<DoelsuggestieNietGevondenFout>(
            () => service.WijzigSuggestieStatusAsync(ThemaId, Guid.NewGuid(), KoppelingStatus.Aanvaard));

        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Onbekend_thema_geeft_niet_gevonden()
    {
        var service = new DoelMatchingService(
            new FakeAiClient(cannedContent: "{\"suggesties\":[]}"),
            new FakeDoelMatchOpslag(thema: null),
            new FakeLeerdoelCatalogus([]),
            new Promptbegrenzing());

        await Assert.ThrowsAsync<ThemaNietGevondenFout>(
            () => service.WijzigSuggestieStatusAsync(ThemaId, Guid.NewGuid(), KoppelingStatus.Aanvaard));
    }

    [Fact]
    public async Task Een_onoplosbare_ref_doet_de_beslissing_niet_mislukken()
    {
        // The decision is stored before the ref is resolved for the read view, so that read must not fail it: the
        // row then shows its ref without text.
        var (service, opslag, _, suggestie) = Opzet(metMinimumdoel: false);

        var weergave = await service.WijzigSuggestieStatusAsync(ThemaId, suggestie.Id, KoppelingStatus.Aanvaard);

        Assert.Equal("Aanvaard", weergave.Status);
        Assert.Equal("K-1.1.1", weergave.MinimumdoelRef);
        Assert.Null(weergave.Omschrijving);
        Assert.Null(weergave.Mijlpaal);
        Assert.Equal(1, opslag.AantalKeerBewaard);
    }
}
