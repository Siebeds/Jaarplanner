using Jaarplanner.Application.Schoolcontent.Import;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.SchoolcontentImport;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// The <c>diff.opmerkingen</c> a teacher actually reads on the import screen (E1-13 clause 2, FR-1.2).
/// <para>
/// <b>Why this file exists.</b> These strings were free text nobody rendered until E1-13 gave them a
/// screen, and three of them then failed rules that bind the product rather than the code: an em dash
/// (Art. II.5, product-wide since 2026-07-30), a <c>(s)</c> plural dodge, and a constitution article
/// reference inside a sentence addressed to a teacher (Art. II.3 — a reader who cannot act on "Art. IX.2"
/// is not the audience for it). The lesson E1-15 recorded is the reason these are tested here rather than
/// simply rewritten: <i>"did I add a Dutch string?" is the wrong question; the right one is "did I make one
/// visible?"</i>, and a story that only adds a caller can breach Art. II.5 without touching a literal.
/// </para>
/// <para>
/// Scoped to the three reachable notices on purpose. A repo-wide literal scan would have to tell product
/// copy from code comments and XML docs, where English typography is correct, and a guard that has to be
/// weakened to pass teaches nothing.
/// </para>
/// </summary>
public sealed class SchoolcontentImportOpmerkingenTests
{
    private const string GeldigeCode = "NAT-K3-01";

    /// <summary>What every teacher-facing notice must satisfy, whatever else it says.</summary>
    private static void AssertLeesbaarVoorEenLeerkracht(string opmerking)
    {
        Assert.DoesNotContain("—", opmerking, StringComparison.Ordinal);
        Assert.DoesNotContain("Art.", opmerking, StringComparison.Ordinal);
        Assert.DoesNotContain("(s)", opmerking, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Leeg_bestand_meldt_in_leesbaar_Nederlands_dat_er_niets_gebeurde()
    {
        await using var context = MaakContext();

        var resultaat = await new SchoolcontentImportService(context).ImporteerAsync(
            new SchoolcontentParseResult([], []),
            SchoolcontentImportOpties.Toevoegen,
            toepassen: true);

        Assert.True(resultaat.Diff.Overgeslagen);
        var opmerking = Assert.Single(resultaat.Diff.Opmerkingen);
        AssertLeesbaarVoorEenLeerkracht(opmerking);
        // The point of the notice: nothing happened, and it says so rather than leaving a silent no-op.
        Assert.Contains("niets geïmporteerd", opmerking, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    public async Task Onbekende_codes_worden_grammaticaal_gemeld_bij_een_en_bij_meer(int aantal)
    {
        await using var context = MaakContext();
        await SeedAsync(context, GeldigeCode);

        var codes = aantal == 1 ? "TYPO-1" : "TYPO-1;TYPO-2";
        var parseResultaat = Parse(new SchoolcontentWorkbookBuilder()
            .MetHeader()
            .MetRij(themadoelen: $"{GeldigeCode};{codes}")
            .Bouw());

        var resultaat = await new SchoolcontentImportService(context).ImporteerAsync(
            parseResultaat, SchoolcontentImportOpties.Toevoegen, toepassen: true);

        var opmerking = Assert.Single(
            resultaat.Diff.Opmerkingen,
            o => o.Contains("TYPO-1", StringComparison.Ordinal));
        AssertLeesbaarVoorEenLeerkracht(opmerking);

        // Dutch inflects the noun *and* the demonstrative, so one code and two codes need two sentences.
        // "1 leerplandoelcodes ... Deze codes staan niet" is the plural bug that has shipped five times in
        // this repo; the server composes this one, so the frontend's `tAantal` cannot rescue it.
        if (aantal == 1)
        {
            Assert.Contains("1 leerplandoelcode uit dit bestand is overgeslagen", opmerking, StringComparison.Ordinal);
            Assert.Contains("Deze code staat niet", opmerking, StringComparison.Ordinal);
        }
        else
        {
            Assert.Contains("2 leerplandoelcodes uit dit bestand zijn overgeslagen", opmerking, StringComparison.Ordinal);
            Assert.Contains("Deze codes staan niet", opmerking, StringComparison.Ordinal);
        }
    }

    [Fact]
    public async Task Onbekende_klas_meldt_wat_er_misging_en_wat_de_leerkracht_kan_doen()
    {
        await using var context = MaakContext();
        await SeedAsync(context);

        var parseResultaat = Parse(new SchoolcontentWorkbookBuilder()
            .MetHeader()
            .MetRij(klas: "L6 bestaat niet")
            .Bouw());

        var resultaat = await new SchoolcontentImportService(context).ImporteerAsync(
            parseResultaat, SchoolcontentImportOpties.Toevoegen, toepassen: true);

        var opmerking = Assert.Single(resultaat.Diff.Opmerkingen);
        AssertLeesbaarVoorEenLeerkracht(opmerking);
        // It names the klas from the file (only this layer knows it) and states the next step.
        Assert.Contains("L6 bestaat niet", opmerking, StringComparison.Ordinal);
        Assert.Contains("overgeslagen", opmerking, StringComparison.Ordinal);
        Assert.Contains("Maak die klas eerst aan", opmerking, StringComparison.Ordinal);
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
            .UseInMemoryDatabase($"import_opmerkingen_{Guid.NewGuid():N}")
            .Options);

    /// <summary>Seeds the klas the fixture rows reference plus the given (valid) leerplandoel codes.</summary>
    private static async Task SeedAsync(AppDbContext context, params string[] codes)
    {
        var schooljaar = TestSchooljaar.Maak();
        schooljaar.VoegKlasToe("K3", leerjaar: 0);
        context.Schooljaren.Add(schooljaar);

        foreach (var code in codes)
        {
            context.Leerplandoelen.Add(new Leerplandoel(
                code, Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Levende natuur", "3", tekst: "doeltekst"));
        }

        await context.SaveChangesAsync();
    }
}
