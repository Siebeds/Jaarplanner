using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.SchoolcontentBeheer;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// Exercises the E1-10 school-content CRUD use cases (FR-3.1/3.2): add/edit/delete at each level, the
/// 2–3 themadoel rule, manual goal links that persist with status <c>manueel</c> (Art. IV.2), and — the
/// core acceptance criterion — that level scoping is enforced (Art. IX.2): a subthema cannot exist
/// without a real klas + leeftijd, deleting a subthema never touches the school-wide thema, and a link
/// to an unknown leerplandoel is rejected without mutating curriculum (Art. III). Uses the EF Core
/// in-memory provider (no Docker), matching the proven import-service test pattern.
/// </summary>
public sealed class SchoolcontentBeheerServiceTests : IDisposable
{
    private readonly DbContextOptions<AppDbContext> _options;
    private readonly Klas _klas;

    public SchoolcontentBeheerServiceTests()
    {
        _options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"schoolcontent_beheer_{Guid.NewGuid():N}")
            .Options;

        using var seed = new AppDbContext(_options);

        // A Klas lives in a Schooljaar (Art. IX.3 containment, E3-01).
        var schooljaar = TestSchooljaar.Maak();
        _klas = schooljaar.VoegKlasToe("L1 — eerste leerjaar", leerjaar: 1);
        seed.Schooljaren.Add(schooljaar);

        // Seed read-only curriculum codes the goal links can reference (Art. III.5). The in-memory
        // provider does not enforce the Discipline FK, so no discipline row is needed here.
        seed.Leerplandoelen.AddRange(
            Leerdoel("NL-001"),
            Leerdoel("NL-002"),
            Leerdoel("WIS-001"));
        seed.SaveChanges();
    }

    // A fresh service over a fresh context per operation — mirrors the production scoped-per-request
    // lifetime and keeps the in-memory change tracker from carrying stale state across calls.
    private SchoolcontentBeheerService NieuweService() => new(new AppDbContext(_options));

    private AppDbContext NieuwContext() => new(_options);

    private static Leerplandoel Leerdoel(string code) =>
        new(code, Doelsoort.Minimumdoel, "K3", "Domein", "Subdomein", "1", tekst: "doeltekst");

    public void Dispose()
    {
        using var ctx = new AppDbContext(_options);
        ctx.Database.EnsureDeleted();
    }

    // --- Thema CRUD (school-scoped). ---

    [Fact]
    public async Task Maak_thema_persists_school_wide_attributes()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie(
            "Water", DuurWeken: 5, Invalshoeken: "natuur", Kernwoordenschat: ["plas"], RijkeWoordenschat: ["waterkringloop"]));

        var opgehaald = await NieuweService().HaalThemaOpAsync(thema.Id);
        Assert.Equal("Water", opgehaald.Naam);
        Assert.Equal(5, opgehaald.DuurWeken);
        Assert.Equal(["plas"], opgehaald.Kernwoordenschat);
        Assert.Equal(["waterkringloop"], opgehaald.RijkeWoordenschat);
    }

    [Fact]
    public async Task Maak_thema_rejects_a_blank_naam()
    {
        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => NieuweService().MaakThemaAsync(new ThemaCreatie("  ", DuurWeken: 4)));
        Assert.NotNull(fout.Message);
    }

    [Fact]
    public async Task Wijzig_thema_updates_naam_and_attributes()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));

        var gewijzigd = await NieuweService().WijzigThemaAsync(thema.Id, new ThemaWijziging("Lucht", DuurWeken: 6, Invalshoeken: "techniek"));

        Assert.Equal("Lucht", gewijzigd.Naam);
        Assert.Equal(6, gewijzigd.DuurWeken);
        Assert.Equal("techniek", gewijzigd.Invalshoeken);
    }

    [Fact]
    public async Task Verwijder_thema_cascades_its_whole_subtree()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));
        await NieuweService().VoegThemadoelToeAsync(thema.Id, "NL-001");
        var subthema = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen", 2, _klas.Id, "K3"));
        var activiteit = await NieuweService().MaakActiviteitAsync(subthema.Id, new ActiviteitCreatie("Plassen meten", ActiviteitType.Waarneming));
        await NieuweService().KoppelActiviteitAanDoelAsync(activiteit.Id, "WIS-001");

        await NieuweService().VerwijderThemaAsync(thema.Id);

        Assert.Empty(await NieuwContext().Themas.ToListAsync());
        Assert.Empty(await NieuwContext().Themadoelen.ToListAsync());
        Assert.Empty(await NieuwContext().Subthemas.ToListAsync());
        Assert.Empty(await NieuwContext().Activiteiten.ToListAsync());
    }

    /// <summary>
    /// A thema placed in a jaarplan cannot be deleted, and the refusal is a friendly 400 with a count rather than the
    /// RESTRICT FK on <c>themaplaatsingen.ThemaId</c> surfacing as an unhandled 500 (ADR-0006 §4).
    /// <para>
    /// <b>Why it matters that this is reported and not just prevented.</b> Thema's are school-<i>wide</i> (Art. IX.2)
    /// while a jaarplan is per class, so the blocking placement may live in a class the deleting teacher never opens.
    /// Before this guard the FK prevented the dangling row but the "clear diagnostics" its comment claimed did not
    /// exist — the call threw <c>23503</c> and no handler mapped it.
    /// </para>
    /// </summary>
    [Fact]
    public async Task Verwijder_thema_wordt_geweigerd_zolang_het_in_een_jaarplan_staat()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));

        await using (var context = NieuwContext())
        {
            var jaarplan = new Jaarplan(_klas.Id);
            jaarplan.VoegPlaatsingToe(
                thema.Id,
                Planningsblokniveau.Themaperiode,
                new DateOnly(2026, 9, 1),
                KoppelingStatus.Voorgesteld,
                "voorstel");
            context.Jaarplannen.Add(jaarplan);
            await context.SaveChangesAsync();
        }

        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => NieuweService().VerwijderThemaAsync(thema.Id));

        Assert.Contains("Water", fout.Message);
        Assert.Contains("1", fout.Message);
        Assert.Contains("jaarplan", fout.Message);

        // Nothing was destroyed.
        Assert.Single(await NieuwContext().Themas.ToListAsync());
    }

    /// <summary>
    /// The other half: once the placement is gone the thema deletes normally. Without this the guard could have been
    /// written as "refuse whenever any jaarplan exists", which would make every placed thema permanently undeletable.
    /// </summary>
    [Fact]
    public async Task Verwijder_thema_lukt_weer_nadat_de_plaatsing_verdwenen_is()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));

        await using (var context = NieuwContext())
        {
            var jaarplan = new Jaarplan(_klas.Id);
            jaarplan.VoegPlaatsingToe(
                thema.Id, Planningsblokniveau.Themaperiode, new DateOnly(2026, 9, 1), KoppelingStatus.Aanvaard, "ja");
            context.Jaarplannen.Add(jaarplan);
            await context.SaveChangesAsync();
        }

        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => NieuweService().VerwijderThemaAsync(thema.Id));

        await using (var context = NieuwContext())
        {
            var jaarplan = await context.Jaarplannen.FirstAsync();
            jaarplan.VerwijderPlaatsing(jaarplan.Plaatsingen[0]);
            await context.SaveChangesAsync();
        }

        await NieuweService().VerwijderThemaAsync(thema.Id);

        Assert.Empty(await NieuwContext().Themas.ToListAsync());
    }

    [Fact]
    public async Task Haal_thema_op_throws_when_absent()
    {
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() => NieuweService().HaalThemaOpAsync(Guid.NewGuid()));
    }

    // --- Themadoel 2–3 rule (Art. IX.2). ---

    [Fact]
    public async Task Themadoel_link_persists_with_manueel_status()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));

        var themadoel = await NieuweService().VoegThemadoelToeAsync(thema.Id, "NL-001");

        Assert.Equal("NL-001", themadoel.Koppeling.LeerplandoelCode);
        Assert.Equal(KoppelingStatus.Manueel, themadoel.Koppeling.Status);
        Assert.Null(themadoel.Koppeling.AiMotivatie);
    }

    [Fact]
    public async Task Thema_with_two_themadoelen_reports_voldoende_a_single_one_does_not()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));

        await NieuweService().VoegThemadoelToeAsync(thema.Id, "NL-001");
        Assert.False((await NieuweService().HaalThemaOpAsync(thema.Id)).HeeftVoldoendeThemadoelen);

        await NieuweService().VoegThemadoelToeAsync(thema.Id, "NL-002");
        Assert.True((await NieuweService().HaalThemaOpAsync(thema.Id)).HeeftVoldoendeThemadoelen);
    }

    [Fact]
    public async Task Adding_a_fourth_themadoel_is_rejected()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));
        await NieuweService().VoegThemadoelToeAsync(thema.Id, "NL-001");
        await NieuweService().VoegThemadoelToeAsync(thema.Id, "NL-002");
        await NieuweService().VoegThemadoelToeAsync(thema.Id, "WIS-001");

        // A 4th distinct code would breach the 2–3 upper bound (Art. IX.2).
        await using (var ctx = NieuwContext())
        {
            ctx.Leerplandoelen.Add(Leerdoel("NL-003"));
            await ctx.SaveChangesAsync();
        }

        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => NieuweService().VoegThemadoelToeAsync(thema.Id, "NL-003"));
    }

    [Fact]
    public async Task Themadoel_link_to_unknown_code_is_rejected()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));
        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => NieuweService().VoegThemadoelToeAsync(thema.Id, "BESTAAT-NIET"));
    }

    [Fact]
    public async Task Verwijder_themadoel_removes_only_that_link()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));
        var td1 = await NieuweService().VoegThemadoelToeAsync(thema.Id, "NL-001");
        await NieuweService().VoegThemadoelToeAsync(thema.Id, "NL-002");

        await NieuweService().VerwijderThemadoelAsync(thema.Id, td1.Id);

        var na = await NieuweService().HaalThemaOpAsync(thema.Id);
        Assert.Single(na.Themadoelen);
        Assert.Equal("NL-002", na.Themadoelen[0].Koppeling.LeerplandoelCode);
    }

    // --- Subthema CRUD + level scoping (Art. IX.2). ---

    [Fact]
    public async Task Maak_subthema_requires_a_klas_and_leeftijd()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));

        // Empty klas → a subthema cannot exist school-wide.
        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen", 2, Guid.Empty, "K3")));

        // Blank leeftijd → age scoping is structural.
        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen", 2, _klas.Id, "  ")));
    }

    [Fact]
    public async Task Maak_subthema_rejects_an_unknown_klas()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));
        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen", 2, Guid.NewGuid(), "K3")));
    }

    [Fact]
    public async Task Maak_subthema_persists_class_and_age_scope()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));

        var subthema = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie(
            "Regen", DuurWeken: 2, _klas.Id, "K3", Probleemstelling: "Waarom regent het?", Onderzoeksvraag: "Waar komt regen vandaan?"));

        Assert.Equal(_klas.Id, subthema.KlasId);
        Assert.Equal("K3", subthema.Leeftijd);
        Assert.Equal("Waarom regent het?", subthema.Probleemstelling);
        Assert.Equal(thema.Id, subthema.ThemaId);
    }

    [Fact]
    public async Task Editing_a_subthema_does_not_affect_school_wide_thema()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 5, Kernwoordenschat: ["plas"]));
        var subthema = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen", 2, _klas.Id, "K3"));

        await NieuweService().WijzigSubthemaAsync(subthema.Id, new SubthemaWijzigingInvoer("Stortbui", DuurWeken: 3, _klas.Id, "K2"));

        var themaNa = await NieuweService().HaalThemaOpAsync(thema.Id);
        // School-wide thema attributes are untouched (level scoping, Art. IX.2).
        Assert.Equal("Water", themaNa.Naam);
        Assert.Equal(5, themaNa.DuurWeken);
        Assert.Equal(["plas"], themaNa.Kernwoordenschat);
        // The subthema's own (class/age-scoped) attributes did change.
        var subNa = themaNa.Subthemas.Single();
        Assert.Equal("Stortbui", subNa.Naam);
        Assert.Equal("K2", subNa.Leeftijd);
    }

    [Fact]
    public async Task Wijzig_subthema_cannot_clear_the_scope()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));
        var subthema = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen", 2, _klas.Id, "K3"));

        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => NieuweService().WijzigSubthemaAsync(subthema.Id, new SubthemaWijzigingInvoer("Regen", 2, Guid.Empty, "K3")));
    }

    [Fact]
    public async Task Verwijder_subthema_cascades_children_but_leaves_thema()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));
        var subthema = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen", 2, _klas.Id, "K3"));
        var activiteit = await NieuweService().MaakActiviteitAsync(subthema.Id, new ActiviteitCreatie("Meten", ActiviteitType.Onderzoek));
        await NieuweService().KoppelActiviteitAanDoelAsync(activiteit.Id, "NL-001");

        await NieuweService().VerwijderSubthemaAsync(subthema.Id);

        Assert.NotNull(await NieuwContext().Themas.FirstOrDefaultAsync(t => t.Id == thema.Id));
        Assert.Empty(await NieuwContext().Subthemas.ToListAsync());
        Assert.Empty(await NieuwContext().Activiteiten.ToListAsync());
    }

    // --- Subthema goal links (live on Subdoel, Art. IX.2). ---

    [Fact]
    public async Task Koppel_subthema_creates_a_manueel_subdoel_at_the_subthema_leeftijd()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));
        var subthema = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen", 2, _klas.Id, "K3"));

        var subdoel = await NieuweService().KoppelSubthemaAanDoelAsync(subthema.Id, "NL-001");

        Assert.Equal("K3", subdoel.Leeftijd);
        Assert.Equal("NL-001", subdoel.Koppeling.LeerplandoelCode);
        Assert.Equal(KoppelingStatus.Manueel, subdoel.Koppeling.Status);

        // Round-trips with its status.
        var themaNa = await NieuweService().HaalThemaOpAsync(thema.Id);
        var subdoelNa = themaNa.Subthemas.Single().Subdoelen.Single();
        Assert.Equal(KoppelingStatus.Manueel, subdoelNa.Koppeling.Status);
    }

    [Fact]
    public async Task Koppel_subthema_rejects_a_duplicate_link()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));
        var subthema = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen", 2, _klas.Id, "K3"));
        await NieuweService().KoppelSubthemaAanDoelAsync(subthema.Id, "NL-001");

        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => NieuweService().KoppelSubthemaAanDoelAsync(subthema.Id, "NL-001"));
    }

    [Fact]
    public async Task Ontkoppel_subdoel_removes_the_link()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));
        var subthema = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen", 2, _klas.Id, "K3"));
        var subdoel = await NieuweService().KoppelSubthemaAanDoelAsync(subthema.Id, "NL-001");

        await NieuweService().OntkoppelSubdoelAsync(subthema.Id, subdoel.Id);

        Assert.Empty(await NieuwContext().Subdoelen.ToListAsync());
    }

    // --- Activiteit CRUD + multiple goal links (Art. IX.2). ---

    [Fact]
    public async Task Maak_activiteit_inherits_the_subthema_scope()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));
        var subthema = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen", 2, _klas.Id, "K3"));

        var activiteit = await NieuweService().MaakActiviteitAsync(subthema.Id, new ActiviteitCreatie(
            "Plassen meten", ActiviteitType.Waarneming, Hoek: "ontdektafel"));

        Assert.Equal("Plassen meten", activiteit.Naam);
        Assert.Equal(ActiviteitType.Waarneming, activiteit.ActiviteitType);
        Assert.Equal("ontdektafel", activiteit.Hoek);
    }

    [Fact]
    public async Task Activiteit_links_to_multiple_leerdoelen_each_manueel()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));
        var subthema = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen", 2, _klas.Id, "K3"));
        var activiteit = await NieuweService().MaakActiviteitAsync(subthema.Id, new ActiviteitCreatie("Meten", ActiviteitType.Onderzoek));

        await NieuweService().KoppelActiviteitAanDoelAsync(activiteit.Id, "NL-001");
        var tweede = await NieuweService().KoppelActiviteitAanDoelAsync(activiteit.Id, "WIS-001");

        Assert.Equal(KoppelingStatus.Manueel, tweede.Status);

        var themaNa = await NieuweService().HaalThemaOpAsync(thema.Id);
        var actNa = themaNa.Subthemas.Single().Activiteiten.Single();
        Assert.Equal(2, actNa.Doelkoppelingen.Count);
        Assert.All(actNa.Doelkoppelingen, k => Assert.Equal(KoppelingStatus.Manueel, k.Status));
    }

    [Fact]
    public async Task Activiteit_link_to_unknown_code_is_rejected_and_curriculum_untouched()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));
        var subthema = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen", 2, _klas.Id, "K3"));
        var activiteit = await NieuweService().MaakActiviteitAsync(subthema.Id, new ActiviteitCreatie("Meten", ActiviteitType.Onderzoek));

        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => NieuweService().KoppelActiviteitAanDoelAsync(activiteit.Id, "BESTAAT-NIET"));

        // Read-only curriculum is unchanged (Art. III): still exactly the 3 seeded codes.
        Assert.Equal(3, await NieuwContext().Leerplandoelen.CountAsync());
    }

    [Fact]
    public async Task Ontkoppel_activiteit_doel_removes_only_that_link()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));
        var subthema = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen", 2, _klas.Id, "K3"));
        var activiteit = await NieuweService().MaakActiviteitAsync(subthema.Id, new ActiviteitCreatie("Meten", ActiviteitType.Onderzoek));
        var k1 = await NieuweService().KoppelActiviteitAanDoelAsync(activiteit.Id, "NL-001");
        await NieuweService().KoppelActiviteitAanDoelAsync(activiteit.Id, "WIS-001");

        await NieuweService().OntkoppelActiviteitDoelAsync(activiteit.Id, k1.Id);

        var actNa = (await NieuweService().HaalThemaOpAsync(thema.Id)).Subthemas.Single().Activiteiten.Single();
        Assert.Single(actNa.Doelkoppelingen);
        Assert.Equal("WIS-001", actNa.Doelkoppelingen[0].LeerplandoelCode);
    }

    [Fact]
    public async Task Wijzig_activiteit_updates_type_and_uitkomsten()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));
        var subthema = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen", 2, _klas.Id, "K3"));
        var activiteit = await NieuweService().MaakActiviteitAsync(subthema.Id, new ActiviteitCreatie("Meten", ActiviteitType.Onderzoek));

        var gewijzigd = await NieuweService().WijzigActiviteitAsync(activiteit.Id, new ActiviteitWijzigingInvoer(
            "Plassen meten", ActiviteitType.Waarneming, VerwachteUitkomsten: "kind meet waterhoogte"));

        Assert.Equal("Plassen meten", gewijzigd.Naam);
        Assert.Equal(ActiviteitType.Waarneming, gewijzigd.ActiviteitType);
        Assert.Equal("kind meet waterhoogte", gewijzigd.VerwachteUitkomsten);
    }

    [Fact]
    public async Task Verwijder_activiteit_removes_it_and_its_links()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));
        var subthema = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen", 2, _klas.Id, "K3"));
        var activiteit = await NieuweService().MaakActiviteitAsync(subthema.Id, new ActiviteitCreatie("Meten", ActiviteitType.Onderzoek));
        await NieuweService().KoppelActiviteitAanDoelAsync(activiteit.Id, "NL-001");

        await NieuweService().VerwijderActiviteitAsync(activiteit.Id);

        Assert.Empty(await NieuwContext().Activiteiten.ToListAsync());
        // The subthema survives the activiteit delete.
        Assert.NotNull(await NieuwContext().Subthemas.FirstOrDefaultAsync(s => s.Id == subthema.Id));
    }
}
