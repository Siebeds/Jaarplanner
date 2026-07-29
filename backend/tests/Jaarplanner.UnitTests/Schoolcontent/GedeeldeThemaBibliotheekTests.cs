using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.SchoolcontentBeheer;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// E1-11 — Gedeelde thema-bibliotheek (FR-3.3 resolved per-level, Art. IX.2, Gap A.5). Proves the shared
/// thema-bibliotheek (school-wide thema + themadoelen + woordenschat) and the per-class derivation of
/// subthema's are two coherent but isolated views: the bibliotheek view never leaks a class's subthema's,
/// two classes derive the same thema independently (no cross-class bleed), and editing/adding/deleting one
/// class's subthema/subdoel/activiteit leaves the shared thema AND every other class's derivation unchanged.
/// The shared layer can only be edited via the school-level thema operations, never as a side effect of
/// class-level work. Uses the EF Core in-memory provider (no Docker), matching the E1-10 test pattern.
/// </summary>
public sealed class GedeeldeThemaBibliotheekTests : IDisposable
{
    private readonly DbContextOptions<AppDbContext> _options;
    private readonly Klas _klasA;
    private readonly Klas _klasB;

    public GedeeldeThemaBibliotheekTests()
    {
        _options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"gedeelde_bibliotheek_{Guid.NewGuid():N}")
            .Options;

        using var seed = new AppDbContext(_options);

        // Both classes live in the same school year — the Art. IX.3 containment E3-01 made required.
        var schooljaar = TestSchooljaar.Maak();
        _klasA = schooljaar.VoegKlasToe("L1 — eerste leerjaar", leerjaar: 1);
        _klasB = schooljaar.VoegKlasToe("L2 — tweede leerjaar", leerjaar: 2);
        seed.Schooljaren.Add(schooljaar);

        seed.Leerplandoelen.AddRange(
            Leerdoel("NL-001"),
            Leerdoel("NL-002"),
            Leerdoel("WIS-001"));
        seed.SaveChanges();
    }

    private SchoolcontentBeheerService NieuweService() => new(new AppDbContext(_options));

    private AppDbContext NieuwContext() => new(_options);

    private static Leerplandoel Leerdoel(string code) =>
        new(code, Doelsoort.Minimumdoel, "K3", "Domein", "Subdomein", "1", tekst: "doeltekst");

    public void Dispose()
    {
        using var ctx = new AppDbContext(_options);
        ctx.Database.EnsureDeleted();
    }

    // --- 1. The bibliotheek view returns the school-wide layer and NOT the class subthema's. ---

    [Fact]
    public async Task Bibliotheek_returns_school_wide_themadoelen_and_woordenschat()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie(
            "Water", DuurWeken: 5, Invalshoeken: "natuur", Kernwoordenschat: ["plas"], RijkeWoordenschat: ["waterkringloop"]));
        await NieuweService().VoegThemadoelToeAsync(thema.Id, "NL-001");
        await NieuweService().VoegThemadoelToeAsync(thema.Id, "NL-002");

        var bibliotheek = await NieuweService().HaalThemaBibliotheekOpAsync();

        var item = Assert.Single(bibliotheek);
        Assert.Equal("Water", item.Naam);
        Assert.Equal(5, item.DuurWeken);
        Assert.Equal("natuur", item.Invalshoeken);
        Assert.Equal(["plas"], item.Kernwoordenschat);
        Assert.Equal(["waterkringloop"], item.RijkeWoordenschat);
        Assert.Equal(2, item.Themadoelen.Count);
        Assert.True(item.HeeftVoldoendeThemadoelen);
    }

    [Fact]
    public async Task Bibliotheek_item_carries_no_subthema_field_and_counts_deriving_classes()
    {
        // The ThemaBibliotheekItem type structurally cannot carry subthema's (compile-time guarantee of
        // no class content in the shared-library view). Here we also assert the derived class-count.
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 5));
        await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen", 2, _klasA.Id, "K3"));
        await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Sneeuw", 2, _klasA.Id, "K2"));
        await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Stormen", 2, _klasB.Id, "L1"));

        var item = Assert.Single(await NieuweService().HaalThemaBibliotheekOpAsync());

        // Two distinct classes derived this thema (klas A twice, klas B once) → count is 2, not 3.
        Assert.Equal(2, item.AantalAfgeleideKlassen);
    }

    [Fact]
    public async Task Bibliotheek_is_ordered_and_lists_every_school_wide_thema()
    {
        await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 5));
        await NieuweService().MaakThemaAsync(new ThemaCreatie("Aarde", DuurWeken: 4));

        var bibliotheek = await NieuweService().HaalThemaBibliotheekOpAsync();

        Assert.Equal(["Aarde", "Water"], bibliotheek.Select(b => b.Naam));
    }

    // --- 2. Two classes derive the same shared thema independently — no cross-class bleed. ---

    [Fact]
    public async Task Two_classes_derive_the_same_thema_with_independent_subthemas()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 5));
        var subA = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen (A)", 2, _klasA.Id, "K3"));
        var subB = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen (B)", 2, _klasB.Id, "L1"));

        var voorA = await NieuweService().HaalThemaVoorKlasAsync(thema.Id, _klasA.Id);
        var voorB = await NieuweService().HaalThemaVoorKlasAsync(thema.Id, _klasB.Id);

        // Same shared thema (school-wide layer is identical across the two derivations).
        Assert.Equal(thema.Id, voorA.Id);
        Assert.Equal(thema.Id, voorB.Id);
        Assert.Equal("Water", voorA.Naam);
        Assert.Equal("Water", voorB.Naam);

        // Each class sees ONLY its own subthema; class A's never appears under class B and vice versa.
        Assert.Equal(subA.Id, Assert.Single(voorA.Subthemas).Id);
        Assert.Equal(subB.Id, Assert.Single(voorB.Subthemas).Id);
        Assert.All(voorA.Subthemas, s => Assert.Equal(_klasA.Id, s.KlasId));
        Assert.All(voorB.Subthemas, s => Assert.Equal(_klasB.Id, s.KlasId));
        Assert.DoesNotContain(voorA.Subthemas, s => s.Id == subB.Id);
        Assert.DoesNotContain(voorB.Subthemas, s => s.Id == subA.Id);
    }

    [Fact]
    public async Task Thema_voor_klas_shows_only_that_class_subdoelen_and_activiteiten()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 5));
        var subA = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen (A)", 2, _klasA.Id, "K3"));
        await NieuweService().KoppelSubthemaAanDoelAsync(subA.Id, "NL-001");
        var actA = await NieuweService().MaakActiviteitAsync(subA.Id, new ActiviteitCreatie("Meten (A)", ActiviteitType.Onderzoek));
        await NieuweService().KoppelActiviteitAanDoelAsync(actA.Id, "WIS-001");

        var subB = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen (B)", 2, _klasB.Id, "L1"));
        await NieuweService().KoppelSubthemaAanDoelAsync(subB.Id, "NL-002");

        var voorA = await NieuweService().HaalThemaVoorKlasAsync(thema.Id, _klasA.Id);

        var subthemaA = Assert.Single(voorA.Subthemas);
        Assert.Equal("NL-001", Assert.Single(subthemaA.Subdoelen).Koppeling.LeerplandoelCode);
        Assert.Equal("WIS-001", Assert.Single(Assert.Single(subthemaA.Activiteiten).Doelkoppelingen).LeerplandoelCode);
        // Class B's NL-002 subdoel is nowhere in class A's derivation.
        Assert.DoesNotContain(voorA.Subthemas.SelectMany(s => s.Subdoelen), sd => sd.Koppeling.LeerplandoelCode == "NL-002");
    }

    [Fact]
    public async Task Thema_voor_klas_with_no_derivation_yields_the_shared_thema_and_no_subthemas()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 5, Kernwoordenschat: ["plas"]));
        // Only klas A derives; klas B has not derived anything from this shared thema.
        await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen", 2, _klasA.Id, "K3"));

        var voorB = await NieuweService().HaalThemaVoorKlasAsync(thema.Id, _klasB.Id);

        Assert.Equal("Water", voorB.Naam);
        Assert.Equal(["plas"], voorB.Kernwoordenschat);
        Assert.Empty(voorB.Subthemas);
    }

    [Fact]
    public async Task Thema_voor_klas_rejects_an_unknown_klas()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 5));
        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => NieuweService().HaalThemaVoorKlasAsync(thema.Id, Guid.NewGuid()));
    }

    [Fact]
    public async Task Thema_voor_klas_throws_when_thema_absent()
    {
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => NieuweService().HaalThemaVoorKlasAsync(Guid.NewGuid(), _klasA.Id));
    }

    // --- 3. The headline Done-when: class-level edits never mutate the shared thema NOR another class. ---

    [Fact]
    public async Task Editing_class_A_subthema_leaves_shared_thema_and_class_B_unchanged()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie(
            "Water", DuurWeken: 5, Invalshoeken: "natuur", Kernwoordenschat: ["plas"], RijkeWoordenschat: ["waterkringloop"]));
        await NieuweService().VoegThemadoelToeAsync(thema.Id, "NL-001");
        var subA = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen (A)", 2, _klasA.Id, "K3"));
        var subB = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen (B)", 2, _klasB.Id, "L1"));

        // Edit class A's subthema heavily: rename, re-scope age, change duur + driving questions.
        await NieuweService().WijzigSubthemaAsync(subA.Id, new SubthemaWijzigingInvoer(
            "Stortbui (A)", DuurWeken: 3, _klasA.Id, "K2", Probleemstelling: "Waarom regent het?"));

        // The shared (school-wide) thema is byte-for-byte unchanged.
        var biblioItem = Assert.Single(await NieuweService().HaalThemaBibliotheekOpAsync());
        Assert.Equal("Water", biblioItem.Naam);
        Assert.Equal(5, biblioItem.DuurWeken);
        Assert.Equal("natuur", biblioItem.Invalshoeken);
        Assert.Equal(["plas"], biblioItem.Kernwoordenschat);
        Assert.Equal(["waterkringloop"], biblioItem.RijkeWoordenschat);
        Assert.Equal("NL-001", Assert.Single(biblioItem.Themadoelen).Koppeling.LeerplandoelCode);

        // Class B's derivation is untouched.
        var voorB = await NieuweService().HaalThemaVoorKlasAsync(thema.Id, _klasB.Id);
        var subBNa = Assert.Single(voorB.Subthemas);
        Assert.Equal(subB.Id, subBNa.Id);
        Assert.Equal("Regen (B)", subBNa.Naam);
        Assert.Equal("L1", subBNa.Leeftijd);
        Assert.Equal(2, subBNa.DuurWeken);

        // Class A's own derivation did change (sanity: the edit took effect).
        var voorA = await NieuweService().HaalThemaVoorKlasAsync(thema.Id, _klasA.Id);
        Assert.Equal("Stortbui (A)", Assert.Single(voorA.Subthemas).Naam);
    }

    [Fact]
    public async Task Adding_class_A_subthema_does_not_appear_under_class_B()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 5));
        await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen (B)", 2, _klasB.Id, "L1"));

        // Add a brand-new subthema for class A.
        await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Sneeuw (A)", 2, _klasA.Id, "K3"));

        var voorB = await NieuweService().HaalThemaVoorKlasAsync(thema.Id, _klasB.Id);
        // Class B still sees only its own single subthema; class A's addition did not bleed in.
        Assert.Equal("Regen (B)", Assert.Single(voorB.Subthemas).Naam);

        // And the shared thema is unaffected by either class adding a subthema.
        var biblioItem = Assert.Single(await NieuweService().HaalThemaBibliotheekOpAsync());
        Assert.Equal("Water", biblioItem.Naam);
        Assert.Equal(5, biblioItem.DuurWeken);
        Assert.Equal(2, biblioItem.AantalAfgeleideKlassen);
    }

    [Fact]
    public async Task Deleting_class_A_subthema_leaves_shared_thema_and_class_B_intact()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 5, Kernwoordenschat: ["plas"]));
        await NieuweService().VoegThemadoelToeAsync(thema.Id, "NL-001");
        var subA = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen (A)", 2, _klasA.Id, "K3"));
        var actA = await NieuweService().MaakActiviteitAsync(subA.Id, new ActiviteitCreatie("Meten (A)", ActiviteitType.Onderzoek));
        await NieuweService().KoppelActiviteitAanDoelAsync(actA.Id, "WIS-001");
        var subB = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen (B)", 2, _klasB.Id, "L1"));

        await NieuweService().VerwijderSubthemaAsync(subA.Id);

        // Shared thema survives, with its school-wide attributes + themadoel intact.
        var biblioItem = Assert.Single(await NieuweService().HaalThemaBibliotheekOpAsync());
        Assert.Equal("Water", biblioItem.Naam);
        Assert.Equal(["plas"], biblioItem.Kernwoordenschat);
        Assert.Equal("NL-001", Assert.Single(biblioItem.Themadoelen).Koppeling.LeerplandoelCode);
        // Only one class derives now (klas B).
        Assert.Equal(1, biblioItem.AantalAfgeleideKlassen);

        // Class B's derivation is fully intact.
        var voorB = await NieuweService().HaalThemaVoorKlasAsync(thema.Id, _klasB.Id);
        Assert.Equal(subB.Id, Assert.Single(voorB.Subthemas).Id);
    }

    [Fact]
    public async Task Editing_class_A_subdoel_or_activiteit_does_not_touch_class_B_derivation()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 5));
        var subA = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen (A)", 2, _klasA.Id, "K3"));
        var subB = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen (B)", 2, _klasB.Id, "L1"));
        var subdoelB = await NieuweService().KoppelSubthemaAanDoelAsync(subB.Id, "NL-002");
        var actB = await NieuweService().MaakActiviteitAsync(subB.Id, new ActiviteitCreatie("Meten (B)", ActiviteitType.Onderzoek));

        // Mutate class A's subdoel + activiteit set.
        var subdoelA = await NieuweService().KoppelSubthemaAanDoelAsync(subA.Id, "NL-001");
        var actA = await NieuweService().MaakActiviteitAsync(subA.Id, new ActiviteitCreatie("Meten (A)", ActiviteitType.Onderzoek));
        await NieuweService().KoppelActiviteitAanDoelAsync(actA.Id, "WIS-001");
        await NieuweService().OntkoppelSubdoelAsync(subA.Id, subdoelA.Id);

        // Class B's subdoel + activiteit are exactly as created.
        var voorB = await NieuweService().HaalThemaVoorKlasAsync(thema.Id, _klasB.Id);
        var subthemaB = Assert.Single(voorB.Subthemas);
        Assert.Equal(subdoelB.Id, Assert.Single(subthemaB.Subdoelen).Id);
        Assert.Equal("NL-002", Assert.Single(subthemaB.Subdoelen).Koppeling.LeerplandoelCode);
        Assert.Equal(actB.Id, Assert.Single(subthemaB.Activiteiten).Id);
        Assert.Empty(Assert.Single(subthemaB.Activiteiten).Doelkoppelingen);
    }

    // --- 4. The shared layer is edited ONLY via school-level ops; the views stay coherent. ---

    [Fact]
    public async Task Shared_themadoelen_and_woordenschat_change_only_via_school_level_ops()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 5, Kernwoordenschat: ["plas"]));
        await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen", 2, _klasA.Id, "K3"));

        // School-level edit: rename + re-vocab + add themadoel. This is the ONLY path that touches the shared layer.
        await NieuweService().WijzigThemaAsync(thema.Id, new ThemaWijziging(
            "Waterwereld", DuurWeken: 6, Invalshoeken: "techniek", Kernwoordenschat: ["plas", "druppel"], RijkeWoordenschat: ["waterkringloop"]));
        await NieuweService().VoegThemadoelToeAsync(thema.Id, "NL-001");

        var item = Assert.Single(await NieuweService().HaalThemaBibliotheekOpAsync());
        Assert.Equal("Waterwereld", item.Naam);
        Assert.Equal(6, item.DuurWeken);
        Assert.Equal("techniek", item.Invalshoeken);
        Assert.Equal(["plas", "druppel"], item.Kernwoordenschat);
        Assert.Equal(["waterkringloop"], item.RijkeWoordenschat);
        Assert.Equal("NL-001", Assert.Single(item.Themadoelen).Koppeling.LeerplandoelCode);

        // The per-klas derivation reflects the same (single) shared school-wide layer — the two views are coherent.
        var voorA = await NieuweService().HaalThemaVoorKlasAsync(thema.Id, _klasA.Id);
        Assert.Equal("Waterwereld", voorA.Naam);
        Assert.Equal(["plas", "druppel"], voorA.Kernwoordenschat);
        Assert.Equal("NL-001", Assert.Single(voorA.Themadoelen).Koppeling.LeerplandoelCode);
    }
}
