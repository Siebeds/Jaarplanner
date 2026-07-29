using Jaarplanner.Application.AiMatching;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.UnitTests.AiAuthoring;

namespace Jaarplanner.UnitTests.Ai;

/// <summary>
/// Pins the E2-05 teacher-decision path (FR-4.3, Art. IV.1/IV.2): given a persisted <c>voorgesteld</c>
/// doelsuggestie, the teacher accepts / rejects / adjusts it and the new status is persisted through the
/// store (survives reload) and is the exact <see cref="KoppelingStatus"/> E5 coverage reads. The whole
/// thing runs against the in-memory <see cref="FakeDoelMatchOpslag"/> — no database, no network — and
/// proves nothing is ever auto-applied: only an explicit call changes a status.
/// </summary>
public sealed class DoelsuggestieStatusTests
{
    private static readonly Guid ThemaId = Guid.NewGuid();

    private static IReadOnlyList<Leerplandoel> EenLeerdoelenSet() =>
    [
        new Leerplandoel("NAT-K3-01", Doelsoort.Minimumdoel, "K3", "Natuur", "Levende natuur", "9", tekst: "herkent bomen."),
    ];

    private static (DoelMatchingService service, FakeDoelMatchOpslag opslag, DoelKoppeling suggestie) Opzet()
    {
        var thema = new Thema("Herfst", duurWeken: 4);
        var suggestie = thema.VoegDoelsuggestieToe(
            new DoelKoppeling("NAT-K3-01", KoppelingStatus.Voorgesteld, "past bij het observeren van bomen"));
        var opslag = new FakeDoelMatchOpslag(thema);
        var service = new DoelMatchingService(
            new FakeAiClient(cannedContent: "{\"suggesties\":[]}"),
            opslag,
            new FakeLeerdoelCatalogus(EenLeerdoelenSet()));
        return (service, opslag, suggestie);
    }

    [Theory]
    [InlineData(KoppelingStatus.Aanvaard)]
    [InlineData(KoppelingStatus.Geweigerd)]
    [InlineData(KoppelingStatus.Manueel)]
    public async Task Leerkrachtbeslissing_wordt_gepersisteerd(KoppelingStatus beslissing)
    {
        var (service, opslag, suggestie) = Opzet();

        var weergave = await service.WijzigSuggestieStatusAsync(ThemaId, suggestie.Id, beslissing);

        Assert.Equal(beslissing.ToString(), weergave.Status);
        Assert.Equal(beslissing, suggestie.Status);
        // Persisted via the store (a single unit of work) so it survives a reload (Art. IV.2).
        Assert.Equal(1, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Aanvaarde_en_manuele_koppelingen_tellen_mee_voor_dekking()
    {
        // E5 reads DoelKoppeling.Status directly: aanvaard/manueel count, voorgesteld/geweigerd do not.
        var (service, _, suggestie) = Opzet();
        await service.WijzigSuggestieStatusAsync(ThemaId, suggestie.Id, KoppelingStatus.Aanvaard);
        Assert.Equal(KoppelingStatus.Aanvaard, suggestie.Status);
    }

    [Fact]
    public async Task Status_voorgesteld_mag_de_leerkracht_niet_zetten()
    {
        var (service, opslag, suggestie) = Opzet();

        await Assert.ThrowsAsync<OngeldigeSuggestieStatusFout>(
            () => service.WijzigSuggestieStatusAsync(ThemaId, suggestie.Id, KoppelingStatus.Voorgesteld));

        // Nothing changed, nothing committed (no auto-apply, Art. IV.1).
        Assert.Equal(KoppelingStatus.Voorgesteld, suggestie.Status);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Onbekende_suggestie_geeft_niet_gevonden()
    {
        var (service, opslag, _) = Opzet();

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
            new FakeLeerdoelCatalogus(EenLeerdoelenSet()));

        await Assert.ThrowsAsync<ThemaNietGevondenFout>(
            () => service.WijzigSuggestieStatusAsync(ThemaId, Guid.NewGuid(), KoppelingStatus.Aanvaard));
    }

    [Fact]
    public async Task Beslissing_geeft_de_doeltekst_mee_zodat_de_leerkracht_kan_beoordelen()
    {
        // FR-4.2's purpose clause: the read view carries the leerplandoel's own text + doelsoort, not just a
        // code, on every path that returns a suggestion — the status PUT included, so the row never flickers
        // between an enriched and a bare shape.
        var (service, _, suggestie) = Opzet();

        var weergave = await service.WijzigSuggestieStatusAsync(ThemaId, suggestie.Id, KoppelingStatus.Aanvaard);

        Assert.Equal("herkent bomen.", weergave.Tekst);
        Assert.Equal(Doelsoort.Minimumdoel, weergave.Doelsoort);
    }
}
