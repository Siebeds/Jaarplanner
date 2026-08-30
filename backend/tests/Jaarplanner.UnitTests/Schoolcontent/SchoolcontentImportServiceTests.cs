using Jaarplanner.Application.Schoolcontent.Import;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.SchoolcontentImport;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// Exercises the E1-08 school-content import-commit path (FR-1.3/1.4, Art. IV.2): a preview that
/// matches the committed result, add vs update/overwrite modes, and — the headline — that an overwrite
/// <b>preserves teacher-set <see cref="DoelKoppeling"/> statuses</b> (aanvaard/geweigerd/manueel) or warns
/// before discarding them. Uses the EF Core in-memory provider so the data-integrity behaviour runs
/// without Docker; the level-scoping FK that backs the guarantee is pinned by the model-config tests.
/// </summary>
public sealed class SchoolcontentImportServiceTests : IDisposable
{
    private readonly AppDbContext _context;
    private readonly SchoolcontentImportService _service;
    private readonly Klas _klas;

    public SchoolcontentImportServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"schoolcontent_import_{Guid.NewGuid():N}")
            .Options;
        _context = new AppDbContext(options);
        _service = new SchoolcontentImportService(_context);

        // A Klas lives in a Schooljaar (Art. IX.3 containment, E3-01).
        var schooljaar = TestSchooljaar.Maak();
        _klas = schooljaar.VoegKlasToe("L1 — eerste leerjaar", "L1");
        _context.Schooljaren.Add(schooljaar);

        // Seed the leerplandoelen these fixtures link to. The import now validates every goal code
        // against the curriculum before building a DoelKoppeling, because that code is a required
        // Restrict FK — an unknown code is reported and skipped rather than aborting the whole import.
        // These tests previously passed only because the in-memory provider ignores foreign keys; with
        // the codes absent the links are (correctly) filtered out and nothing links at all.
        foreach (var code in (string[])["LP-1", "LP-2", "LP-3", "LP-7", "LP-9"])
        {
            _context.Leerplandoelen.Add(new Leerplandoel(
                code, Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Levende natuur", "3", tekst: "doeltekst"));
        }

        _context.SaveChanges();
    }

    private SchoolcontentRij Rij(
        string thema = "Herfst",
        int themaDuur = 4,
        string? invalshoeken = null,
        IReadOnlyList<string>? kern = null,
        IReadOnlyList<string>? rijk = null,
        IReadOnlyList<string>? themadoelen = null,
        string subthema = "Bladeren",
        int subthemaDuur = 2,
        string? klas = null,
        string leeftijd = "K3",
        string? probleemstelling = null,
        string? onderzoeksvraag = null,
        IReadOnlyList<string>? subdoelen = null,
        string activiteit = "Bladeren rapen",
        ActiviteitType activiteitType = ActiviteitType.Waarneming,
        string? hoek = null,
        string? uitkomsten = null,
        int rijNummer = 2) =>
        new()
        {
            RijNummer = rijNummer,
            ThemaNaam = thema,
            ThemaDuurWeken = themaDuur,
            ThemaInvalshoeken = invalshoeken,
            Kernwoordenschat = kern ?? [],
            RijkeWoordenschat = rijk ?? [],
            Themadoelen = themadoelen ?? [],
            SubthemaNaam = subthema,
            SubthemaDuurWeken = subthemaDuur,
            SubthemaKlas = klas ?? _klas.Naam,
            SubthemaLeeftijd = leeftijd,
            SubthemaProbleemstelling = probleemstelling,
            SubthemaOnderzoeksvraag = onderzoeksvraag,
            Subdoelen = subdoelen ?? [],
            ActiviteitNaam = activiteit,
            ActiviteitType = activiteitType,
            ActiviteitHoek = hoek,
            ActiviteitVerwachteUitkomsten = uitkomsten,
        };

    private static SchoolcontentParseResult Parse(params SchoolcontentRij[] rijen) => new(rijen, []);

    private Task<SchoolcontentImportResultaat> Importeer(
        SchoolcontentParseResult parse,
        SchoolcontentImportModus modus = SchoolcontentImportModus.Toevoegen,
        bool toepassen = true,
        bool verwijderBeslissingen = false) =>
        _service.ImporteerAsync(
            parse,
            new SchoolcontentImportOpties(modus, verwijderBeslissingen),
            toepassen);

    // --- First import + persistence + level scoping. ---

    [Fact]
    public async Task First_import_persists_the_full_hierarchy_with_level_scoping()
    {
        var result = await Importeer(Parse(Rij(
            kern: ["blad", "boom"],
            rijk: ["loofboom"],
            themadoelen: ["LP-1", "LP-2"],
            subdoelen: ["LP-3"])));

        Assert.True(result.Toegepast);

        var thema = await _context.Themas
            .Include(t => t.Themadoelen)
            .Include(t => t.Subthemas).ThenInclude(s => s.Subdoelen)
            .Include(t => t.Subthemas).ThenInclude(s => s.Activiteiten)
            .SingleAsync();

        Assert.Equal("Herfst", thema.Naam);
        Assert.Equal(["blad", "boom"], thema.Kernwoordenschat);
        Assert.Equal(["loofboom"], thema.RijkeWoordenschat);
        Assert.Equal(2, thema.Themadoelen.Count);

        var subthema = Assert.Single(thema.Subthemas);
        Assert.Equal("K3", subthema.Leeftijd); // age scoping persisted (Art. IX.2)
        var subdoel = Assert.Single(subthema.Subdoelen);
        Assert.Equal("LP-3", subdoel.Koppeling.LeerplandoelCode);
        Assert.Equal("K3", subdoel.Leeftijd);
        var activiteit = Assert.Single(subthema.Activiteiten);
        Assert.Equal("Bladeren rapen", activiteit.Naam);
    }

    /// <summary>
    /// An unknown klas is no longer fatal by itself (Art. IX.2, amended 2026-08-30): the klas column is a fallback
    /// source for the leeftijd, not the scope, so a row carrying a valid jaar/fase code imports regardless.
    /// </summary>
    [Fact]
    public async Task Subthema_met_een_onbekende_klas_maar_geldige_leeftijd_wordt_gewoon_ingelezen()
    {
        var rij = Rij(klas: "L9 bestaat niet", leeftijd: "K3");

        var result = await Importeer(Parse(rij));

        Assert.Empty(result.Diff.Opmerkingen);
        var thema = await _context.Themas.Include(t => t.Subthemas).SingleAsync();
        Assert.Equal("K3", Assert.Single(thema.Subthemas).Leeftijd);
    }

    /// <summary>
    /// And what IS fatal: a leeftijd that is not one of the nine codes, with no klas able to supply one. The
    /// subthema would be stored and unreachable from every screen, so it is skipped and reported instead.
    /// </summary>
    [Fact]
    public async Task Subthema_zonder_bruikbare_leeftijd_is_overgeslagen_met_een_melding()
    {
        var rij = Rij(klas: "L9 bestaat niet", leeftijd: "5-6");

        var result = await Importeer(Parse(rij));

        Assert.NotEmpty(result.Diff.Opmerkingen);
        var thema = await _context.Themas.Include(t => t.Subthemas).SingleAsync();
        Assert.Empty(thema.Subthemas);
    }

    // --- Preview == commit. ---

    [Fact]
    public async Task Preview_does_not_write_anything()
    {
        var preview = await Importeer(Parse(Rij(themadoelen: ["LP-1"])), toepassen: false);

        Assert.False(preview.Toegepast);
        Assert.Equal(WijzigingSoort.Toegevoegd, Assert.Single(preview.Diff.Themas).Soort);
        Assert.Equal(0, await _context.Themas.CountAsync());
    }

    [Fact]
    public async Task Preview_matches_the_committed_result_for_the_same_input()
    {
        // Seed an existing thema so the diff has add + update + unchanged variety.
        await Importeer(Parse(Rij(themadoelen: ["LP-1"])));

        var herimport = Parse(
            Rij(themaDuur: 6, themadoelen: ["LP-1"]),                 // update (duur changed)
            Rij(thema: "Winter", subthema: "Sneeuw", activiteit: "Iglo bouwen")); // add

        var preview = await Importeer(herimport, SchoolcontentImportModus.Bijwerken, toepassen: false);
        var commit = await Importeer(herimport, SchoolcontentImportModus.Bijwerken, toepassen: true);

        // Same classification per level — the preview==commit guarantee.
        Assert.Equal(
            preview.Diff.Themas.Select(t => (t.Naam, t.Soort)).OrderBy(x => x.Naam),
            commit.Diff.Themas.Select(t => (t.Naam, t.Soort)).OrderBy(x => x.Naam));
        Assert.Equal(
            preview.Diff.Subthemas.Select(s => (s.Naam, s.Soort)).OrderBy(x => x.Naam),
            commit.Diff.Subthemas.Select(s => (s.Naam, s.Soort)).OrderBy(x => x.Naam));
        Assert.Equal(
            preview.Diff.Activiteiten.Select(a => (a.Naam, a.Soort)).OrderBy(x => x.Naam),
            commit.Diff.Activiteiten.Select(a => (a.Naam, a.Soort)).OrderBy(x => x.Naam));

        Assert.Equal(
            preview.Diff.BedreigdeBeslissingen,
            commit.Diff.BedreigdeBeslissingen);

        // And the committed store reflects exactly what the preview promised.
        Assert.Equal(2, await _context.Themas.CountAsync());
        var herfst = await _context.Themas.SingleAsync(t => t.Naam == "Herfst");
        Assert.Equal(6, herfst.DuurWeken);
    }

    // --- Add mode: never touch existing. ---

    [Fact]
    public async Task Add_mode_leaves_existing_content_untouched()
    {
        await Importeer(Parse(Rij(themaDuur: 4, activiteit: "Bladeren rapen", uitkomsten: "origineel")));

        // Re-import in add-mode with changed attributes for the SAME thema/subthema/activiteit.
        var result = await Importeer(
            Parse(Rij(themaDuur: 9, activiteit: "Bladeren rapen", uitkomsten: "GEWIJZIGD")),
            SchoolcontentImportModus.Toevoegen);

        Assert.Equal(WijzigingSoort.Ongewijzigd, Assert.Single(result.Diff.Themas).Soort);

        var thema = await _context.Themas
            .Include(t => t.Subthemas).ThenInclude(s => s.Activiteiten)
            .SingleAsync();
        Assert.Equal(4, thema.DuurWeken); // unchanged — add mode does not clobber
        var activiteit = thema.Subthemas.Single().Activiteiten.Single();
        Assert.Equal("origineel", activiteit.VerwachteUitkomsten);
    }

    [Fact]
    public async Task Add_mode_adds_genuinely_new_content_alongside_existing()
    {
        await Importeer(Parse(Rij()));

        var result = await Importeer(
            Parse(Rij(thema: "Winter", subthema: "Sneeuw", activiteit: "Iglo")),
            SchoolcontentImportModus.Toevoegen);

        Assert.Equal(WijzigingSoort.Toegevoegd, Assert.Single(result.Diff.Themas).Soort);
        Assert.Equal(2, await _context.Themas.CountAsync());
    }

    // --- Update/overwrite mode. ---

    [Fact]
    public async Task Update_mode_overwrites_matching_content_attributes()
    {
        await Importeer(Parse(Rij(themaDuur: 4, subthemaDuur: 2)));

        var result = await Importeer(
            Parse(Rij(themaDuur: 6, subthemaDuur: 3)),
            SchoolcontentImportModus.Bijwerken);

        Assert.Equal(WijzigingSoort.Bijgewerkt, Assert.Single(result.Diff.Themas).Soort);

        var thema = await _context.Themas.Include(t => t.Subthemas).SingleAsync();
        Assert.Equal(6, thema.DuurWeken);
        Assert.Equal(3, thema.Subthemas.Single().DuurWeken);
    }

    [Fact]
    public async Task Update_mode_reports_unchanged_when_nothing_differs()
    {
        await Importeer(Parse(Rij()));

        var result = await Importeer(Parse(Rij()), SchoolcontentImportModus.Bijwerken);

        Assert.Equal(WijzigingSoort.Ongewijzigd, Assert.Single(result.Diff.Themas).Soort);
        Assert.True(result.Diff.IsLeeg);
    }

    // --- HEADLINE (Art. IV.2): teacher decisions survive overwrite. ---

    [Fact]
    public async Task Overwrite_preserves_a_teacher_set_themadoel_status_that_is_still_in_the_file()
    {
        await Importeer(Parse(Rij(themadoelen: ["LP-1"])));
        await SetThemadoelStatusAsync("Herfst", "LP-1", KoppelingStatus.Aanvaard);

        // Re-import overwrites the thema, still carrying LP-1.
        await Importeer(Parse(Rij(themaDuur: 6, themadoelen: ["LP-1"])), SchoolcontentImportModus.Bijwerken);

        var thema = await LoadThemaAsync("Herfst");
        var themadoel = Assert.Single(thema.Themadoelen);
        Assert.Equal("LP-1", themadoel.Koppeling.LeerplandoelCode);
        Assert.Equal(KoppelingStatus.Aanvaard, themadoel.Koppeling.Status); // teacher decision preserved
    }

    [Fact]
    public async Task Overwrite_warns_but_keeps_a_teacher_decision_the_file_no_longer_carries()
    {
        await Importeer(Parse(Rij(themadoelen: ["LP-1"])));
        await SetThemadoelStatusAsync("Herfst", "LP-1", KoppelingStatus.Geweigerd);

        // The new file no longer carries LP-1. By default the human decision must NOT be silently lost.
        var result = await Importeer(
            Parse(Rij(themaDuur: 6, themadoelen: ["LP-9"])),
            SchoolcontentImportModus.Bijwerken);

        var bedreigd = Assert.Single(result.Diff.BedreigdeBeslissingen);
        Assert.Equal("LP-1", bedreigd.LeerplandoelCode);
        Assert.Equal(KoppelingStatus.Geweigerd, bedreigd.Status);
        Assert.Equal(KoppelingNiveau.Themadoel, bedreigd.Niveau);
        Assert.True(result.Diff.VereistReview);

        // LP-1 still persisted with its teacher status; LP-9 added as voorgesteld.
        var thema = await LoadThemaAsync("Herfst");
        var lp1 = Assert.Single(thema.Themadoelen, td => td.Koppeling.LeerplandoelCode == "LP-1");
        Assert.Equal(KoppelingStatus.Geweigerd, lp1.Koppeling.Status);
        Assert.Contains(thema.Themadoelen, td => td.Koppeling.LeerplandoelCode == "LP-9");
    }

    [Fact]
    public async Task Overwrite_discards_a_teacher_decision_only_on_explicit_opt_in()
    {
        await Importeer(Parse(Rij(themadoelen: ["LP-1"])));
        await SetThemadoelStatusAsync("Herfst", "LP-1", KoppelingStatus.Manueel);

        // Explicit confirmation: discard human decisions the file no longer carries.
        var result = await Importeer(
            Parse(Rij(themadoelen: ["LP-9"])),
            SchoolcontentImportModus.Bijwerken,
            verwijderBeslissingen: true);

        Assert.Empty(result.Diff.BedreigdeBeslissingen); // discarded by explicit choice — nothing "threatened"

        var thema = await LoadThemaAsync("Herfst");
        Assert.DoesNotContain(thema.Themadoelen, td => td.Koppeling.LeerplandoelCode == "LP-1");
        Assert.Contains(thema.Themadoelen, td => td.Koppeling.LeerplandoelCode == "LP-9");
    }

    [Fact]
    public async Task Overwrite_preserves_an_imported_link_the_file_no_longer_carries()
    {
        // **This test asserted the opposite until 2026-08-04, and the change is a ruling rather than a fix.**
        // It used to be called `Overwrite_freely_replaces_an_ai_only_voorgesteld_link`, because an imported
        // link was `Voorgesteld` and therefore not a human decision. E1-18 established that it is one: the
        // owner ruled that a school imports *decided* links, so the import now writes `Manueel`.
        //
        // The consequence lands exactly here. `Manueel` satisfies `IsMenselijkeBeslissing`, so a link that
        // disappears from a later version of the file is **preserved and reported as bedreigd** instead of
        // being dropped silently, and removing it takes E1-13's explicit opt-in. That follows from the ruling:
        // if the school decided a link, the tool does not un-decide it because a later spreadsheet forgot it.
        await Importeer(Parse(Rij(themadoelen: ["LP-1"])));

        var result = await Importeer(
            Parse(Rij(themadoelen: ["LP-9"])),
            SchoolcontentImportModus.Bijwerken);

        var bedreigd = Assert.Single(result.Diff.BedreigdeBeslissingen);
        Assert.Equal(KoppelingNiveau.Themadoel, bedreigd.Niveau);
        Assert.Equal("LP-1", bedreigd.LeerplandoelCode);

        var thema = await LoadThemaAsync("Herfst");
        Assert.Contains(thema.Themadoelen, td => td.Koppeling.LeerplandoelCode == "LP-1");
        Assert.Contains(thema.Themadoelen, td => td.Koppeling.LeerplandoelCode == "LP-9");
    }

    [Fact]
    public async Task An_imported_link_counts_for_dekking_because_it_is_a_decision()
    {
        // The whole point of E1-18, asserted at the level where the defect actually bit: dekking counts only
        // `Aanvaard`/`Manueel` (Art. V.1), so an imported themadoel used to contribute nothing to a school's
        // coverage, permanently, with no way in the product to change it.
        await Importeer(Parse(Rij(themadoelen: ["LP-1"], subdoelen: ["LP-3"])));

        var thema = await LoadThemaAsync("Herfst");
        var themadoel = Assert.Single(thema.Themadoelen);
        Assert.Equal(KoppelingStatus.Manueel, themadoel.Koppeling.Status);

        var subthema = Assert.Single(thema.Subthemas);
        var subdoel = Assert.Single(subthema.Subdoelen);
        Assert.Equal(KoppelingStatus.Manueel, subdoel.Koppeling.Status);
    }

    [Fact]
    public async Task Overwrite_preserves_a_teacher_set_subdoel_status_the_file_no_longer_carries()
    {
        await Importeer(Parse(Rij(subdoelen: ["LP-3"])));
        await SetSubdoelStatusAsync("Bladeren", "LP-3", KoppelingStatus.Aanvaard);

        var result = await Importeer(
            Parse(Rij(subdoelen: ["LP-7"])),
            SchoolcontentImportModus.Bijwerken);

        var bedreigd = Assert.Single(result.Diff.BedreigdeBeslissingen);
        Assert.Equal(KoppelingNiveau.Subdoel, bedreigd.Niveau);
        Assert.Equal("LP-3", bedreigd.LeerplandoelCode);

        var thema = await LoadThemaAsync("Herfst");
        var subthema = Assert.Single(thema.Subthemas);
        Assert.Contains(subthema.Subdoelen, sd => sd.Koppeling.LeerplandoelCode == "LP-3" && sd.Koppeling.Status == KoppelingStatus.Aanvaard);
        Assert.Contains(subthema.Subdoelen, sd => sd.Koppeling.LeerplandoelCode == "LP-7");
    }

    [Fact]
    public async Task Add_mode_never_threatens_a_teacher_decision()
    {
        await Importeer(Parse(Rij(themadoelen: ["LP-1"])));
        await SetThemadoelStatusAsync("Herfst", "LP-1", KoppelingStatus.Aanvaard);

        // Add-mode re-import with different codes leaves the existing thema (and its decision) entirely alone.
        var result = await Importeer(
            Parse(Rij(themadoelen: ["LP-9"])),
            SchoolcontentImportModus.Toevoegen);

        Assert.Empty(result.Diff.BedreigdeBeslissingen);
        var thema = await LoadThemaAsync("Herfst");
        var themadoel = Assert.Single(thema.Themadoelen);
        Assert.Equal("LP-1", themadoel.Koppeling.LeerplandoelCode);
        Assert.Equal(KoppelingStatus.Aanvaard, themadoel.Koppeling.Status);
    }

    // --- Empty-file guard. ---

    [Fact]
    public async Task Empty_parse_result_skips_and_keeps_existing_content()
    {
        await Importeer(Parse(Rij(themadoelen: ["LP-1"])));
        await SetThemadoelStatusAsync("Herfst", "LP-1", KoppelingStatus.Aanvaard);

        var result = await Importeer(Parse(), SchoolcontentImportModus.Bijwerken);

        Assert.False(result.Toegepast);
        Assert.True(result.Diff.Overgeslagen);
        Assert.NotEmpty(result.Diff.Opmerkingen);

        var thema = await LoadThemaAsync("Herfst");
        Assert.Equal(KoppelingStatus.Aanvaard, thema.Themadoelen.Single().Koppeling.Status);
    }

    private async Task<Thema> LoadThemaAsync(string naam) =>
        await _context.Themas
            .Include(t => t.Themadoelen)
            .Include(t => t.Subthemas).ThenInclude(s => s.Subdoelen)
            .Include(t => t.Subthemas).ThenInclude(s => s.Activiteiten)
            .SingleAsync(t => t.Naam == naam);

    private async Task SetThemadoelStatusAsync(string themaNaam, string code, KoppelingStatus status)
    {
        var thema = await LoadThemaAsync(themaNaam);
        var themadoel = thema.Themadoelen.Single(td => td.Koppeling.LeerplandoelCode == code);
        themadoel.Koppeling.WijzigStatus(status);
        await _context.SaveChangesAsync();
    }

    private async Task SetSubdoelStatusAsync(string subthemaNaam, string code, KoppelingStatus status)
    {
        var subthema = await _context.Subthemas
            .Include(s => s.Subdoelen)
            .SingleAsync(s => s.Naam == subthemaNaam);
        var subdoel = subthema.Subdoelen.Single(sd => sd.Koppeling.LeerplandoelCode == code);
        subdoel.Koppeling.WijzigStatus(status);
        await _context.SaveChangesAsync();
    }

    public void Dispose() => _context.Dispose();
}
