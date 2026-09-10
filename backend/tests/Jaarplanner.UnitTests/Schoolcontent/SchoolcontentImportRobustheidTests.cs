using Jaarplanner.Application.Schoolcontent.Import;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.SchoolcontentImport;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// Robustness of the school-content import against the three ways a real teacher's file broke it
/// (E1-07, FR-1.1/1.2, in the spirit of ADR-0006 §4, whose actual text is "validation produces clear, per-row diagnostics before commit"):
/// a reordered header silently importing wrong data, one typo'd goal code aborting the entire import,
/// and a 4th themadoel passing preview then throwing on commit.
/// </summary>
public sealed class SchoolcontentImportRobustheidTests
{
    private const string GeldigeCode = "NAT-K3-01";
    private const string TweedeCode = "NAT-K3-02";
    private const string DerdeCode = "NAT-K3-03";
    private const string VierdeCode = "NAT-K3-04";

    // --- Header layout (finding 6). ---

    /// <summary>
    /// A reordered header is rejected. Previously the check only asked whether each required label
    /// appeared <i>somewhere</i>, so this file passed validation and then every value was read from the
    /// wrong column — thema names landing in klas fields as perfectly "valid" data.
    /// </summary>
    [Fact]
    public void Verwisselde_kolommen_worden_geweigerd()
    {
        using var stroom = new SchoolcontentWorkbookBuilder()
            .MetHeaderVerwisseld(SchoolcontentKolom.ThemaNaam, SchoolcontentKolom.SubthemaNaam)
            .MetRij()
            .Bouw();

        var resultaat = new ClosedXmlSchoolcontentParser().Parse(stroom);

        Assert.False(resultaat.IsGeldig);
        Assert.Empty(resultaat.Rijen);
        var melding = Assert.Single(resultaat.Problemen).Melding;
        Assert.Contains("kolomindeling", melding, StringComparison.OrdinalIgnoreCase);
        // Names the offending position and both labels so the teacher can actually fix it.
        Assert.Contains(SchoolcontentKolommen.Label(SchoolcontentKolom.ThemaNaam), melding);
        Assert.Contains(SchoolcontentKolommen.Label(SchoolcontentKolom.SubthemaNaam), melding);
    }

    /// <summary>The unmodified template layout still parses cleanly — the check is positional, not brittle.</summary>
    [Fact]
    public void Standaard_kolomindeling_blijft_geldig()
    {
        using var stroom = new SchoolcontentWorkbookBuilder().MetHeader().MetRij().Bouw();

        var resultaat = new ClosedXmlSchoolcontentParser().Parse(stroom);

        Assert.True(resultaat.IsGeldig);
        Assert.Single(resultaat.Rijen);
    }

    // --- Unknown goal codes (finding 4). ---

    /// <summary>
    /// An unknown leerplandoel code is reported and skipped; the rest of the file still imports.
    /// Before this, the unknown code became a <c>DoelKoppeling</c> whose required <c>Restrict</c> FK
    /// failed, so one typo threw a <see cref="DbUpdateException"/> and discarded the whole import.
    /// </summary>
    [Fact]
    public async Task Onbekende_doelcode_wordt_gerapporteerd_en_overgeslagen()
    {
        await using var context = MaakContext();
        await SeedAsync(context, GeldigeCode);

        var parseResultaat = Parse(new SchoolcontentWorkbookBuilder()
            .MetHeader()
            .MetRij(themadoelen: $"{GeldigeCode};TYPO-999")
            .Bouw());

        var service = new SchoolcontentImportService(context);
        var resultaat = await service.ImporteerAsync(parseResultaat, SchoolcontentImportOpties.Toevoegen, toepassen: true);

        Assert.True(resultaat.Toegepast);
        Assert.Contains(resultaat.Diff.Opmerkingen, o => o.Contains("TYPO-999", StringComparison.Ordinal));

        // The good code landed; the unknown one did not.
        var thema = await context.Themas.Include(t => t.Themadoelen).SingleAsync();
        Assert.Equal([GeldigeCode], thema.Themadoelen.Select(td => td.Koppeling.LeerplandoelCode));
    }

    // --- Themadoel cap (finding 5). ---

    /// <summary>
    /// Four themadoelen on a new thema are capped at three with a notice, instead of throwing. The
    /// domain's <c>VoegThemadoelToe</c> throws on the 4th, which used to surface as a 500 that discarded
    /// the import.
    /// </summary>
    [Fact]
    public async Task Vier_themadoelen_worden_gecapt_met_opmerking()
    {
        await using var context = MaakContext();
        await SeedAsync(context, GeldigeCode, TweedeCode, DerdeCode, VierdeCode);

        var parseResultaat = Parse(new SchoolcontentWorkbookBuilder()
            .MetHeader()
            .MetRij(themadoelen: $"{GeldigeCode};{TweedeCode};{DerdeCode};{VierdeCode}")
            .Bouw());

        var service = new SchoolcontentImportService(context);
        var resultaat = await service.ImporteerAsync(parseResultaat, SchoolcontentImportOpties.Toevoegen, toepassen: true);

        Assert.True(resultaat.Toegepast);
        // Keyed on the dropped **code**, not on a word from the sentence. The notice's wording is product copy
        // (rewritten in E1-13's fix round, which broke this assertion); what this test is about is that the code
        // the cap discarded is named at all. The copy predicates live in SchoolcontentImportOpmerkingenTests.
        Assert.Contains(resultaat.Diff.Opmerkingen, o => o.Contains(VierdeCode, StringComparison.Ordinal));

        var thema = await context.Themas.Include(t => t.Themadoelen).SingleAsync();
        Assert.Equal(Thema.MaxThemadoelen, thema.Themadoelen.Count);
    }

    /// <summary>
    /// The preview reports the same cap notice the commit does. This is the actual regression: the cap
    /// used to be evaluated only under <c>toepassen</c>, so a preview said "Toegevoegd" with no problem
    /// and the commit then threw — breaking the service's documented "preview == commit" guarantee.
    /// </summary>
    [Fact]
    public async Task Voorbeeld_en_commit_melden_dezelfde_cap()
    {
        await using var context = MaakContext();
        await SeedAsync(context, GeldigeCode, TweedeCode, DerdeCode, VierdeCode);

        var workbook = () => new SchoolcontentWorkbookBuilder()
            .MetHeader()
            .MetRij(themadoelen: $"{GeldigeCode};{TweedeCode};{DerdeCode};{VierdeCode}")
            .Bouw();

        var service = new SchoolcontentImportService(context);

        var voorbeeld = await service.ImporteerAsync(Parse(workbook()), SchoolcontentImportOpties.Toevoegen, toepassen: false);
        var commit = await service.ImporteerAsync(Parse(workbook()), SchoolcontentImportOpties.Toevoegen, toepassen: true);

        Assert.False(voorbeeld.Toegepast);
        Assert.True(commit.Toegepast);
        // Non-empty first, then equal. Filtering on a word from the copy made this pass vacuously the moment
        // the notice was reworded: two empty sequences compare equal, so the guarantee would have been lost in
        // silence. Keyed on the dropped code instead, which is behaviour rather than wording.
        var capOpmerkingen = voorbeeld.Diff.Opmerkingen
            .Where(o => o.Contains(VierdeCode, StringComparison.Ordinal))
            .ToList();
        Assert.NotEmpty(capOpmerkingen);
        Assert.Equal(
            capOpmerkingen,
            commit.Diff.Opmerkingen.Where(o => o.Contains(VierdeCode, StringComparison.Ordinal)));
    }

    /// <summary>
    /// The overwrite path reports its ignored themadoel codes too. This had <b>no</b> coverage: the cap on
    /// <c>ReconcileThemadoelen</c> skipped over-cap codes with a bare <c>continue</c> and emitted no
    /// opmerking at all, so an overwrite discarded goal codes in complete silence — while the create path
    /// reported them.
    /// </summary>
    [Fact]
    public async Task Overschrijven_meldt_genegeerde_themadoelen_ook()
    {
        await using var context = MaakContext();
        await SeedAsync(context, GeldigeCode, TweedeCode, DerdeCode, VierdeCode);

        var service = new SchoolcontentImportService(context);

        // First import establishes the thema with a single themadoel.
        await service.ImporteerAsync(
            Parse(new SchoolcontentWorkbookBuilder().MetHeader().MetRij(themadoelen: GeldigeCode).Bouw()),
            SchoolcontentImportOpties.Toevoegen,
            toepassen: true);

        // Re-import in overwrite mode with four codes — one fits, three cannot.
        var resultaat = await service.ImporteerAsync(
            Parse(new SchoolcontentWorkbookBuilder()
                .MetHeader()
                .MetRij(themadoelen: $"{GeldigeCode};{TweedeCode};{DerdeCode};{VierdeCode}")
                .Bouw()),
            SchoolcontentImportOpties.Bijwerken,
            toepassen: true);

        Assert.True(resultaat.Toegepast);
        // Keyed on the dropped **code**, not on a word from the sentence. The notice's wording is product copy
        // (rewritten in E1-13's fix round, which broke this assertion); what this test is about is that the code
        // the cap discarded is named at all. The copy predicates live in SchoolcontentImportOpmerkingenTests.
        Assert.Contains(resultaat.Diff.Opmerkingen, o => o.Contains(VierdeCode, StringComparison.Ordinal));

        var thema = await context.Themas.Include(t => t.Themadoelen).SingleAsync();
        Assert.Equal(Thema.MaxThemadoelen, thema.Themadoelen.Count);
    }

    /// <summary>
    /// Preview and commit agree on the overwrite path as well. The cap guard used to read
    /// <c>thema.Themadoelen.Count</c>, which the removal loop mutates only when <c>toepassen</c> is true —
    /// so the two passes walked different arithmetic entirely.
    /// </summary>
    [Fact]
    public async Task Overschrijven_voorbeeld_en_commit_melden_hetzelfde()
    {
        await using var context = MaakContext();
        await SeedAsync(context, GeldigeCode, TweedeCode, DerdeCode, VierdeCode);

        var service = new SchoolcontentImportService(context);
        await service.ImporteerAsync(
            Parse(new SchoolcontentWorkbookBuilder().MetHeader().MetRij(themadoelen: GeldigeCode).Bouw()),
            SchoolcontentImportOpties.Toevoegen,
            toepassen: true);

        var werkboek = () => new SchoolcontentWorkbookBuilder()
            .MetHeader()
            .MetRij(themadoelen: $"{GeldigeCode};{TweedeCode};{DerdeCode};{VierdeCode}")
            .Bouw();

        var voorbeeld = await service.ImporteerAsync(
            Parse(werkboek()), SchoolcontentImportOpties.Bijwerken, toepassen: false);
        var commit = await service.ImporteerAsync(
            Parse(werkboek()), SchoolcontentImportOpties.Bijwerken, toepassen: true);

        // Non-empty first, then equal. Filtering on a word from the copy made this pass vacuously the moment
        // the notice was reworded: two empty sequences compare equal, so the guarantee would have been lost in
        // silence. Keyed on the dropped code instead, which is behaviour rather than wording.
        var capOpmerkingen = voorbeeld.Diff.Opmerkingen
            .Where(o => o.Contains(VierdeCode, StringComparison.Ordinal))
            .ToList();
        Assert.NotEmpty(capOpmerkingen);
        Assert.Equal(
            capOpmerkingen,
            commit.Diff.Opmerkingen.Where(o => o.Contains(VierdeCode, StringComparison.Ordinal)));
    }

    private static SchoolcontentParseResult Parse(MemoryStream stroom)
    {
        using (stroom)
        {
            return new ClosedXmlSchoolcontentParser().Parse(stroom);
        }
    }

    private static AppDbContext MaakContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"import_robust_{Guid.NewGuid():N}")
            .Options);

    /// <summary>Seeds the klas the fixture rows reference plus the given (valid) leerplandoel codes.</summary>
    private static async Task SeedAsync(AppDbContext context, params string[] codes)
    {
        // A Klas lives in a Schooljaar (Art. IX.3 containment, E3-01).
        var schooljaar = TestSchooljaar.Maak();
        schooljaar.VoegKlasToe("K3", "K3");
        context.Schooljaren.Add(schooljaar);
        foreach (var code in codes)
        {
            context.Leerplandoelen.Add(new Leerplandoel(
                code, Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Levende natuur", "3", tekst: "doeltekst"));
        }

        await context.SaveChangesAsync();
    }
}
