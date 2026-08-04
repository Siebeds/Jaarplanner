using Jaarplanner.Application.Schoolcontent.Import;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
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
/// <b>There are four reachable notices, not three (E1-13 fix round 1, antagonist MAJOR 4).</b> The first round
/// of this file said three, and the fourth <c>PasThemadoelCapToe</c> notice was the one still carrying
/// "(Art. IX.2)" into a teacher's sentence: the rule was articulated and an instance in the same file was
/// missed. So the guard below is no longer applied notice by notice.
/// <see cref="Elke_opmerking_van_een_run_is_leesbaar_voor_een_leerkracht"/> drives <b>one</b> import that trips
/// three of the four sources at once and asserts the predicates over <i>every</i> opmerking the diff carries,
/// so a notice added to that path in future is covered without anyone remembering to add a test. The empty-file
/// notice needs its own test because it short-circuits before any other source can run.
/// </para>
/// <para>
/// Still scoped to this service rather than to a repo-wide literal scan: such a scan would have to tell product
/// copy from code comments and XML docs, where English typography and article references are correct, and a
/// guard that has to be weakened to pass teaches nothing.
/// </para>
/// </summary>
public sealed class SchoolcontentImportOpmerkingenTests
{
    private const string GeldigeCode = "NAT-K3-01";

    /// <summary>
    /// What every teacher-facing notice must satisfy, whatever else it says.
    /// <para>
    /// <b>These three predicates are not the whole rule, and reading them as if they were is how the fifth
    /// defect got shipped.</b> They catch typography and audience leaks in a <i>fixed</i> string. They cannot
    /// catch a wrong <b>inflection</b> in a string the server composes: <c>"De 1 bestaande doelen blijven
    /// ongewijzigd"</c> passes all three and is still wrong Dutch, and that exact sentence was live in
    /// <c>OpstapImportService</c> while this helper existed. A notice that interpolates a count therefore needs a
    /// case <b>per grammatical form</b> on top of these predicates. See
    /// <see cref="Themadoelcap_wordt_leesbaar_gemeld_met_de_codes_die_wegvallen"/> for the shape, and
    /// <c>OpstapImportOpmerkingenTests</c> for the same treatment on the other importer.
    /// </para>
    /// </summary>
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

    /// <summary>
    /// The <see cref="Thema.MaxThemadoelen"/> cap, reported to a teacher rather than to a constitution reader.
    /// <para>
    /// Both grammatical forms, because Dutch inflects and the server composes this one. The theory also pins
    /// <b>which</b> codes are dropped: the cap keeps the first ones in the cell, which is what makes the
    /// notice's advice ("put the anchoring ones first") true rather than merely soothing.
    /// </para>
    /// </summary>
    [Theory]
    [InlineData(4, 1)]
    [InlineData(5, 2)]
    public async Task Themadoelcap_wordt_leesbaar_gemeld_met_de_codes_die_wegvallen(int aantalCodes, int genegeerd)
    {
        var codes = Enumerable.Range(1, aantalCodes).Select(i => $"NAT-K3-{i:00}").ToArray();

        await using var context = MaakContext();
        await SeedAsync(context, codes);

        var parseResultaat = Parse(new SchoolcontentWorkbookBuilder()
            .MetHeader()
            .MetRij(themadoelen: string.Join(";", codes))
            .Bouw());

        var resultaat = await new SchoolcontentImportService(context).ImporteerAsync(
            parseResultaat, SchoolcontentImportOpties.Toevoegen, toepassen: true);

        var opmerking = Assert.Single(resultaat.Diff.Opmerkingen);
        AssertLeesbaarVoorEenLeerkracht(opmerking);

        if (genegeerd == 1)
        {
            Assert.Contains("1 themadoel is daarom overgeslagen", opmerking, StringComparison.Ordinal);
        }
        else
        {
            Assert.Contains($"{genegeerd} themadoelen zijn daarom overgeslagen", opmerking, StringComparison.Ordinal);
        }

        // The dropped codes are named, the kept ones are not paraded as dropped, and the reader is told what
        // to change in their own file.
        foreach (var code in codes.Skip(Thema.MaxThemadoelen))
        {
            Assert.Contains(code, opmerking, StringComparison.Ordinal);
        }

        Assert.DoesNotContain(codes[0], opmerking, StringComparison.Ordinal);
        Assert.Contains("vooraan in de kolom Themadoelen", opmerking, StringComparison.Ordinal);

        var thema = await context.Themas.Include(t => t.Themadoelen).SingleAsync();
        Assert.Equal(
            codes.Take(Thema.MaxThemadoelen),
            thema.Themadoelen.Select(td => td.Koppeling.LeerplandoelCode));
    }

    /// <summary>
    /// The same cap, reached from the <b>reconcile</b> path with the slots held by <b>preserved decisions</b>,
    /// where the column-order advice above is false.
    /// <para>
    /// Here two of the three slots are held by links kept from the database — the teacher-set decisions Art. IV.2
    /// preserves — so reordering the file's <c>Themadoelen</c> cell can only decide which <b>one</b> of the three
    /// incoming codes lands, and the blocker is two slots the file cannot dislodge. The round-1 notice said
    /// "put the anchoring ones first" here too, which is advice a reader cannot act on (E1-13 round-2 audit,
    /// MINOR 2). This is the <b>only</b> case in which the discard opt-in is offered, because it is the only case
    /// in which it can change the outcome. Its sibling
    /// <see cref="Themadoelcap_wijst_naar_het_bestand_als_het_bestand_zelf_de_plaatsen_bezet"/> covers the case
    /// where it cannot, which round 2 shipped this same sentence into (round-3 audit, MAJOR 1).
    /// </para>
    /// </summary>
    [Fact]
    public async Task Themadoelcap_op_de_overschrijfroute_noemt_de_bezette_plaatsen()
    {
        string[] bewaard = ["NAT-K3-90", "NAT-K3-91"];
        string[] inkomend = ["NAT-K3-01", "NAT-K3-02", "NAT-K3-03"];

        await using var context = MaakContext();
        await SeedAsync(context, [.. bewaard, .. inkomend]);

        // Two links the teacher decided on, which the incoming file does not carry: they are preserved (Art. IV.2)
        // and therefore occupy two of the three slots.
        var bestaand = new Thema("Herfst", duurWeken: 5);
        foreach (var code in bewaard)
        {
            bestaand.VoegThemadoelToe(new DoelKoppeling(code, KoppelingStatus.Manueel));
        }

        context.Themas.Add(bestaand);
        await context.SaveChangesAsync();

        var parseResultaat = Parse(new SchoolcontentWorkbookBuilder()
            .MetHeader()
            .MetRij(themadoelen: string.Join(";", inkomend))
            .Bouw());

        var resultaat = await new SchoolcontentImportService(context).ImporteerAsync(
            parseResultaat, SchoolcontentImportOpties.Bijwerken, toepassen: true);

        var opmerking = Assert.Single(resultaat.Diff.Opmerkingen);
        AssertLeesbaarVoorEenLeerkracht(opmerking);

        // It names the occupied slots as the reason, rather than blaming the file's column order.
        Assert.Contains("2 themadoelen die er al staan", opmerking, StringComparison.Ordinal);
        Assert.Contains("3 nieuwe codes", opmerking, StringComparison.Ordinal);
        Assert.Contains("2 themadoelen zijn daarom overgeslagen", opmerking, StringComparison.Ordinal);
        Assert.Contains(
            "2 plaatsen zijn bezet door koppelingen waar iemand zelf al over beslist heeft",
            opmerking,
            StringComparison.Ordinal);
        Assert.DoesNotContain("vooraan in de kolom", opmerking, StringComparison.Ordinal);

        // The discard opt-in is offered here, and only here, together with the fact that it is global over the
        // run. Arming it really does free these slots: the two Manueel links are absent from the file.
        Assert.Contains("mogen verdwijnen", opmerking, StringComparison.Ordinal);
        Assert.Contains("geldt voor het hele bestand", opmerking, StringComparison.Ordinal);

        // No slot here is held by a code the file carries, so the cheap "shorten the cell" lever is not offered.
        Assert.DoesNotContain("Wat er nog bezet is", opmerking, StringComparison.Ordinal);

        // And the advice it does not give any more: no screen offers removing a themadoel on the thema itself
        // (E1-14 is unbuilt), so pointing a teacher at it is the E3-06 rule in sentence form.
        Assert.DoesNotContain("bij het thema zelf", opmerking, StringComparison.Ordinal);

        // And the preserved decisions really are still there, which is what makes the sentence true.
        var thema = await context.Themas.Include(t => t.Themadoelen).SingleAsync();
        Assert.Equal(
            [inkomend[0], bewaard[0], bewaard[1]],
            thema.Themadoelen.Select(td => td.Koppeling.LeerplandoelCode).Order(StringComparer.Ordinal));
    }

    /// <summary>
    /// The singular form of the reconcile notice, because Dutch inflects both counts in it and a theory over one
    /// of them would leave the other unpinned.
    /// </summary>
    [Fact]
    public async Task Themadoelcap_op_de_overschrijfroute_verbuigt_het_enkelvoud()
    {
        string[] inkomend = ["NAT-K3-01", "NAT-K3-02", "NAT-K3-03", "NAT-K3-04"];

        await using var context = MaakContext();
        await SeedAsync(context, ["NAT-K3-90", .. inkomend]);

        var bestaand = new Thema("Herfst", duurWeken: 5);
        bestaand.VoegThemadoelToe(new DoelKoppeling("NAT-K3-90", KoppelingStatus.Manueel));
        context.Themas.Add(bestaand);
        await context.SaveChangesAsync();

        var resultaat = await new SchoolcontentImportService(context).ImporteerAsync(
            Parse(new SchoolcontentWorkbookBuilder()
                .MetHeader()
                .MetRij(themadoelen: string.Join(";", inkomend))
                .Bouw()),
            SchoolcontentImportOpties.Bijwerken,
            toepassen: true);

        var opmerking = Assert.Single(resultaat.Diff.Opmerkingen);
        AssertLeesbaarVoorEenLeerkracht(opmerking);
        Assert.Contains("1 themadoel dat er al staat", opmerking, StringComparison.Ordinal);
        Assert.DoesNotContain("1 themadoelen", opmerking, StringComparison.Ordinal);

        // The second interpolated count inflects too, and it is in the sentence round 3 rewrote.
        Assert.Contains(
            "1 plaats is bezet door een koppeling waar iemand zelf al over beslist heeft",
            opmerking,
            StringComparison.Ordinal);
        Assert.DoesNotContain("1 plaatsen", opmerking, StringComparison.Ordinal);
    }

    /// <summary>
    /// <b>The case round 2 shipped a falsehood into, and the one that fires most often (round-3 audit, MAJOR 1).</b>
    /// <para>
    /// The import creates themadoelen as <c>voorgesteld</c>, so a <i>second import of the same file</i> meets
    /// retained links that <b>are</b> in the file. Round 2's notice then told the teacher "de bezette plaatsen kan
    /// dit bestand niet vrijmaken", offered a screen that does not exist, and offered the global discard opt-in,
    /// which cannot raise the cap here at all while deleting teacher decisions across every other thema in the
    /// run. All three were wrong. Both of round 2's tests covered only the <c>manueel</c>-and-absent case, where
    /// the sentence was true, which is exactly why the defect shipped.
    /// </para>
    /// <para>
    /// So this test does two things: it pins the notice, and then it <b>carries out the advice the notice gives</b>
    /// and checks the outcome the old sentence denied. That second half is the part a copy assertion cannot fake.
    /// </para>
    /// </summary>
    [Fact]
    public async Task Themadoelcap_wijst_naar_het_bestand_als_het_bestand_zelf_de_plaatsen_bezet()
    {
        string[] alle = ["NAT-K3-01", "NAT-K3-02", "NAT-K3-03", "NAT-K3-04"];

        await using var context = MaakContext();
        await SeedAsync(context, alle);

        // What a first import of this file leaves behind: voorgesteld links, and the file still carries them.
        var bestaand = new Thema("Herfst", duurWeken: 5);
        bestaand.VoegThemadoelToe(new DoelKoppeling(alle[0], KoppelingStatus.Voorgesteld));
        bestaand.VoegThemadoelToe(new DoelKoppeling(alle[1], KoppelingStatus.Voorgesteld));
        context.Themas.Add(bestaand);
        await context.SaveChangesAsync();

        var resultaat = await new SchoolcontentImportService(context).ImporteerAsync(
            Parse(new SchoolcontentWorkbookBuilder()
                .MetHeader()
                .MetRij(themadoelen: string.Join(";", alle))
                .Bouw()),
            SchoolcontentImportOpties.Bijwerken,
            toepassen: true);

        var opmerking = Assert.Single(resultaat.Diff.Opmerkingen);
        AssertLeesbaarVoorEenLeerkracht(opmerking);

        // The count is the number of codes in the file's own cell, because that is all this thema will hold.
        Assert.Contains("zou 4 themadoelen krijgen", opmerking, StringComparison.Ordinal);
        Assert.Contains("1 themadoel is daarom overgeslagen: NAT-K3-04", opmerking, StringComparison.Ordinal);
        Assert.Contains(
            "haal in de kolom Themadoelen codes weg tot er 3 overblijven",
            opmerking,
            StringComparison.Ordinal);

        // The three things it must NOT say here: the falsehood, the screen that does not exist, and the global
        // opt-in that cannot free a single slot in this case.
        Assert.DoesNotContain("niet vrijmaken", opmerking, StringComparison.Ordinal);
        Assert.DoesNotContain("bij het thema zelf", opmerking, StringComparison.Ordinal);
        Assert.DoesNotContain("mogen verdwijnen", opmerking, StringComparison.Ordinal);

        // Column order is not the fix either: NAT-K3-01 and -02 keep their slots wherever they sit in the cell.
        Assert.DoesNotContain("vooraan in de kolom", opmerking, StringComparison.Ordinal);

        var naEerste = await context.Themas.Include(t => t.Themadoelen).SingleAsync();
        Assert.Equal(
            ["NAT-K3-01", "NAT-K3-02", "NAT-K3-03"],
            naEerste.Themadoelen.Select(td => td.Koppeling.LeerplandoelCode).Order(StringComparer.Ordinal));

        // Now do what the notice says: leave 3 codes in the cell. If the advice is true the slot is freed, the
        // dropped code lands, and there is no cap notice at all. Round 2's sentence claimed this was impossible.
        var tweede = await new SchoolcontentImportService(context).ImporteerAsync(
            Parse(new SchoolcontentWorkbookBuilder()
                .MetHeader()
                .MetRij(themadoelen: string.Join(";", alle.Skip(1)))
                .Bouw()),
            SchoolcontentImportOpties.Bijwerken,
            toepassen: true);

        Assert.Empty(tweede.Diff.Opmerkingen);

        var naTweede = await context.Themas.Include(t => t.Themadoelen).SingleAsync();
        Assert.Equal(
            ["NAT-K3-02", "NAT-K3-03", "NAT-K3-04"],
            naTweede.Themadoelen.Select(td => td.Koppeling.LeerplandoelCode).Order(StringComparer.Ordinal));
    }

    /// <summary>
    /// One slot held by a preserved decision, one by a code the file carries: both levers exist, so the notice
    /// names both, cheapest first in effect and the global one with its blast radius attached.
    /// <para>
    /// This is the case the composed sentence is easiest to get wrong in, and neither of the other two reaches it.
    /// </para>
    /// </summary>
    [Fact]
    public async Task Themadoelcap_noemt_beide_hefbomen_als_het_bestand_er_een_van_de_plaatsen_bezet()
    {
        const string Beslist = "NAT-K3-90";
        string[] inBestand = ["NAT-K3-01", "NAT-K3-02", "NAT-K3-03", "NAT-K3-04"];

        await using var context = MaakContext();
        await SeedAsync(context, [Beslist, .. inBestand]);

        var bestaand = new Thema("Herfst", duurWeken: 5);
        bestaand.VoegThemadoelToe(new DoelKoppeling(Beslist, KoppelingStatus.Aanvaard));
        bestaand.VoegThemadoelToe(new DoelKoppeling(inBestand[0], KoppelingStatus.Voorgesteld));
        context.Themas.Add(bestaand);
        await context.SaveChangesAsync();

        var resultaat = await new SchoolcontentImportService(context).ImporteerAsync(
            Parse(new SchoolcontentWorkbookBuilder()
                .MetHeader()
                .MetRij(themadoelen: string.Join(";", inBestand))
                .Bouw()),
            SchoolcontentImportOpties.Bijwerken,
            toepassen: true);

        var opmerking = Assert.Single(resultaat.Diff.Opmerkingen);
        AssertLeesbaarVoorEenLeerkracht(opmerking);

        Assert.Contains("2 themadoelen die er al staan", opmerking, StringComparison.Ordinal);
        Assert.Contains(
            "1 plaats is bezet door een koppeling waar iemand zelf al over beslist heeft",
            opmerking,
            StringComparison.Ordinal);
        Assert.Contains("mogen verdwijnen", opmerking, StringComparison.Ordinal);
        Assert.Contains("geldt voor het hele bestand", opmerking, StringComparison.Ordinal);
        Assert.Contains(
            "Wat er nog bezet is, komt uit dit bestand zelf",
            opmerking,
            StringComparison.Ordinal);
        Assert.DoesNotContain("bij het thema zelf", opmerking, StringComparison.Ordinal);

        // The Aanvaard link is preserved (Art. IV.2), which is what makes the first lever the only one for it.
        var thema = await context.Themas.Include(t => t.Themadoelen).SingleAsync();
        Assert.Equal(
            ["NAT-K3-01", "NAT-K3-02", Beslist],
            thema.Themadoelen.Select(td => td.Koppeling.LeerplandoelCode).Order(StringComparer.Ordinal));
    }

    /// <summary>
    /// <b>The guard that grows by itself.</b> One import trips three of the four notice sources at once, and
    /// every opmerking it produces has to pass the predicates — not the three someone remembered to name.
    /// <para>
    /// This is the shape the first round was missing. It asserted each notice it had rewritten, so the fourth
    /// notice in the same file was neither rewritten nor asserted, and the story recorded "three reachable
    /// notices" as a fact. A future fifth source on this path fails here without any new test.
    /// </para>
    /// </summary>
    [Fact]
    public async Task Elke_opmerking_van_een_run_is_leesbaar_voor_een_leerkracht()
    {
        var codes = Enumerable.Range(1, 4).Select(i => $"NAT-K3-{i:00}").ToArray();

        await using var context = MaakContext();
        await SeedAsync(context, codes);

        // Four valid themadoel codes (the cap notice), one typo (the unknown-code notice) and a klas that does
        // not exist (the unknown-klas notice). The thema layer is processed before the subthema is skipped, so
        // all three fire in the same run.
        var parseResultaat = Parse(new SchoolcontentWorkbookBuilder()
            .MetHeader()
            .MetRij(themadoelen: $"{string.Join(";", codes)};TYPO-1", klas: "L6 bestaat niet")
            .Bouw());

        var resultaat = await new SchoolcontentImportService(context).ImporteerAsync(
            parseResultaat, SchoolcontentImportOpties.Toevoegen, toepassen: true);

        Assert.Equal(3, resultaat.Diff.Opmerkingen.Count);
        foreach (var opmerking in resultaat.Diff.Opmerkingen)
        {
            AssertLeesbaarVoorEenLeerkracht(opmerking);
        }
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
