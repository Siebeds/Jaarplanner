using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.OpstapImport;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// Exercises the E1-05 non-destructive (re-)import (FR-2.5, Art. III.4 / IV.2): first import inserts,
/// re-import idempotently upserts changed reference data and emits a reviewable diff, and a goal that
/// disappears from Op.stap while still referenced by teacher content is <b>flagged, never deleted</b>
/// — teacher <c>DoelKoppeling</c> statuses survive intact. Uses the EF Core in-memory provider so the
/// data-integrity behaviour runs without Docker; the FK that backs the guarantee is pinned separately
/// by the model-configuration tests.
/// </summary>
public sealed class OpstapImportServiceTests : IDisposable
{
    private const string Discipline = "2";

    /// <summary>
    /// A selection that admits every discipline, so these E1-05 tests exercise the import behaviour
    /// itself (the E1-06 seam is tested separately in <see cref="OpstapImportDisciplineSelectieTests"/>).
    /// </summary>
    private static readonly IDisciplineSelectie AlleInScope =
        new GeconfigureerdeDisciplineSelectie(
            new DisciplineSelectieOptions { Modus = DisciplineSelectieModus.Alle });

    private readonly AppDbContext _context;
    private readonly OpstapImportService _service;

    public OpstapImportServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"import_{Guid.NewGuid():N}")
            .Options;
        _context = new AppDbContext(options);

        // The discipline these tests import into. A real database always has the official taxonomy (the
        // migrations seed all 13 rows), and since E1-15 the import path checks that the stated discipline is
        // one of them — which the required Restrict FK has always enforced on PostgreSQL and which the
        // in-memory provider silently ignores. Seeding it keeps the fixture honest about the state it claims
        // to represent.
        _context.Disciplines.Add(new Discipline(Discipline, "Wiskunde"));
        _context.SaveChanges();

        _service = new OpstapImportService(_context, AlleInScope);
    }

    private static Leerplandoel Doel(
        string code,
        string tekst = "tekst",
        string jaarFase = "L1",
        string? minimumdoelRef = null,
        Doelsoort doelsoort = Doelsoort.Gemeenschappelijk,
        Guid? sleutel = null) =>
        new(
            code: code,
            doelsoort: doelsoort,
            jaarFase: jaarFase,
            domein: "Getallen",
            subdomein: "Getalbegrip",
            disciplineNummer: Discipline,
            tekst: tekst,
            minimumdoelRef: minimumdoelRef,
            opstapSleutel: sleutel);

    private static OpstapParseResult Parse(params Leerplandoel[] doelen) =>
        new(Discipline, doelen, []);

    [Fact]
    public async Task First_import_inserts_all_leerplandoelen()
    {
        var result = await _service.ImporteerAsync(Parse(Doel("LP-1"), Doel("LP-2")), toepassen: true);

        Assert.True(result.Toegepast);
        Assert.Equal(["LP-1", "LP-2"], result.Diff.Toegevoegd.OrderBy(c => c).ToArray());
        Assert.Empty(result.Diff.Gewijzigd);
        Assert.Equal(2, await _context.Leerplandoelen.CountAsync());
    }

    [Fact]
    public async Task Re_import_of_the_same_file_is_idempotent_and_changes_nothing()
    {
        await _service.ImporteerAsync(Parse(Doel("LP-1"), Doel("LP-2")), toepassen: true);

        var result = await _service.ImporteerAsync(Parse(Doel("LP-1"), Doel("LP-2")), toepassen: true);

        Assert.Empty(result.Diff.Toegevoegd);
        Assert.Empty(result.Diff.Gewijzigd);
        Assert.Equal(["LP-1", "LP-2"], result.Diff.Ongewijzigd.OrderBy(c => c).ToArray());
        Assert.True(result.Diff.IsLeeg);
    }

    [Fact]
    public async Task Re_import_updates_a_changed_leerplandoel_and_reports_the_field_change()
    {
        await _service.ImporteerAsync(Parse(Doel("LP-1", tekst: "oude tekst")), toepassen: true);

        var result = await _service.ImporteerAsync(
            Parse(Doel("LP-1", tekst: "nieuwe, herziene tekst")),
            toepassen: true);

        var wijziging = Assert.Single(result.Diff.Gewijzigd);
        Assert.Equal("LP-1", wijziging.Code);
        var veld = Assert.Single(wijziging.Velden, v => v.Veld == nameof(Leerplandoel.Tekst));
        Assert.Equal("oude tekst", veld.OudeWaarde);
        Assert.Equal("nieuwe, herziene tekst", veld.NieuweWaarde);

        var persisted = await _context.Leerplandoelen.SingleAsync(l => l.Code == "LP-1");
        Assert.Equal("nieuwe, herziene tekst", persisted.Tekst);
    }

    [Fact]
    public async Task Preview_does_not_write_anything()
    {
        await _service.ImporteerAsync(Parse(Doel("LP-1", tekst: "oude tekst")), toepassen: true);

        var preview = await _service.ImporteerAsync(
            Parse(Doel("LP-1", tekst: "voorbeeld nieuwe tekst"), Doel("LP-2")),
            toepassen: false);

        Assert.False(preview.Toegepast);
        Assert.Contains("LP-2", preview.Diff.Toegevoegd);
        Assert.Single(preview.Diff.Gewijzigd);

        // Nothing changed in the store: LP-2 not inserted, LP-1 text untouched.
        Assert.Equal(1, await _context.Leerplandoelen.CountAsync());
        var lp1 = await _context.Leerplandoelen.SingleAsync(l => l.Code == "LP-1");
        Assert.Equal("oude tekst", lp1.Tekst);
    }

    [Fact]
    public async Task Disappeared_unreferenced_leerplandoel_is_flagged_and_kept_by_default_policy()
    {
        await _service.ImporteerAsync(Parse(Doel("LP-1"), Doel("LP-2")), toepassen: true);

        // LP-2 is gone from the new file and nothing references it. The conservative default is
        // flag-and-keep (never delete) — a disappearance is reported, the data is preserved.
        var result = await _service.ImporteerAsync(Parse(Doel("LP-1")), toepassen: true);

        Assert.Equal(["LP-2"], result.Diff.Verdwenen.ToArray());
        Assert.Empty(result.Diff.VerdwenenMaarGekoppeld);

        var lp2 = await _context.Leerplandoelen.SingleAsync(l => l.Code == "LP-2");
        Assert.True(lp2.NietMeerInOpstap);
    }

    [Fact]
    public async Task Disappeared_unreferenced_leerplandoel_is_purged_only_with_the_opt_in_policy()
    {
        // Explicit directie opt-in: the purge seam removes truly unused, disappeared goals.
        var purgeService = new OpstapImportService(_context, AlleInScope, verwijderVerweesdeNietGekoppelde: true);
        await purgeService.ImporteerAsync(Parse(Doel("LP-1"), Doel("LP-2")), toepassen: true);

        var result = await purgeService.ImporteerAsync(Parse(Doel("LP-1")), toepassen: true);

        Assert.Equal(["LP-2"], result.Diff.Verdwenen.ToArray());
        Assert.False(await _context.Leerplandoelen.AnyAsync(l => l.Code == "LP-2"));
    }

    [Fact]
    public async Task Empty_or_parse_failed_re_import_skips_and_keeps_existing_rows()
    {
        await _service.ImporteerAsync(Parse(Doel("LP-1"), Doel("LP-2")), toepassen: true);
        await LinkThemadoelAsync("LP-1", KoppelingStatus.Aanvaard);

        // An empty/partial/wrong file (no valid rows parsed) must NOT be read as a mass disappearance.
        var result = await _service.ImporteerAsync(Parse(), toepassen: true);

        Assert.False(result.Toegepast);
        Assert.True(result.Diff.Overgeslagen);
        Assert.NotEmpty(result.Diff.Opmerkingen);
        Assert.Empty(result.Diff.Verdwenen);
        Assert.Empty(result.Diff.VerdwenenMaarGekoppeld);

        // Both existing rows are untouched — not flagged, not deleted — and the teacher link survives.
        Assert.Equal(2, await _context.Leerplandoelen.CountAsync());
        Assert.False(await _context.Leerplandoelen.AnyAsync(l => l.NietMeerInOpstap));
        var themadoel = await _context.Themadoelen.SingleAsync(td => td.Koppeling.LeerplandoelCode == "LP-1");
        Assert.Equal(KoppelingStatus.Aanvaard, themadoel.Koppeling.Status);
    }

    [Fact]
    public async Task Disappeared_leerplandoel_that_is_still_linked_is_flagged_not_deleted()
    {
        await _service.ImporteerAsync(Parse(Doel("LP-1"), Doel("LP-2")), toepassen: true);
        await LinkThemadoelAsync("LP-2", KoppelingStatus.Aanvaard);

        // LP-2 disappears from the new Op.stap file, but a teacher link still references it.
        var result = await _service.ImporteerAsync(Parse(Doel("LP-1")), toepassen: true);

        // It must NOT be deleted (FK Restrict) — instead flagged for review.
        Assert.Empty(result.Diff.Verdwenen);
        var gekoppeld = Assert.Single(result.Diff.VerdwenenMaarGekoppeld);
        Assert.Equal("LP-2", gekoppeld.Code);
        Assert.Equal(1, gekoppeld.AantalKoppelingen);

        var lp2 = await _context.Leerplandoelen.SingleAsync(l => l.Code == "LP-2");
        Assert.True(lp2.NietMeerInOpstap);
    }

    [Fact]
    public async Task Teacher_doelkoppeling_status_survives_a_re_import()
    {
        await _service.ImporteerAsync(Parse(Doel("LP-1", tekst: "oude tekst")), toepassen: true);
        await LinkThemadoelAsync("LP-1", KoppelingStatus.Geweigerd);

        // Re-import that updates LP-1's official text must not touch the teacher's decision.
        await _service.ImporteerAsync(Parse(Doel("LP-1", tekst: "herziene tekst")), toepassen: true);

        var themadoel = await _context.Themadoelen
            .SingleAsync(td => td.Koppeling.LeerplandoelCode == "LP-1");
        Assert.Equal(KoppelingStatus.Geweigerd, themadoel.Koppeling.Status);

        var lp1 = await _context.Leerplandoelen.SingleAsync(l => l.Code == "LP-1");
        Assert.Equal("herziene tekst", lp1.Tekst);
    }

    [Fact]
    public async Task Diff_classifies_added_changed_unchanged_and_removed_in_one_pass()
    {
        await _service.ImporteerAsync(
            Parse(Doel("KEEP"), Doel("EDIT", tekst: "v1"), Doel("DROP")),
            toepassen: true);

        var result = await _service.ImporteerAsync(
            Parse(Doel("KEEP"), Doel("EDIT", tekst: "v2"), Doel("NEW")),
            toepassen: true);

        Assert.Equal(["NEW"], result.Diff.Toegevoegd.ToArray());
        Assert.Equal(["EDIT"], result.Diff.Gewijzigd.Select(w => w.Code).ToArray());
        Assert.Equal(["KEEP"], result.Diff.Ongewijzigd.ToArray());
        Assert.Equal(["DROP"], result.Diff.Verdwenen.ToArray());
        Assert.True(result.Diff.VereistReview);
    }

    [Fact]
    public async Task Reappearing_leerplandoel_clears_the_review_flag()
    {
        await _service.ImporteerAsync(Parse(Doel("LP-1"), Doel("LP-2")), toepassen: true);
        await LinkThemadoelAsync("LP-2", KoppelingStatus.Manueel);

        // LP-2 disappears (flagged), then reappears in a later import.
        await _service.ImporteerAsync(Parse(Doel("LP-1")), toepassen: true);
        Assert.True(await _context.Leerplandoelen.Where(l => l.Code == "LP-2").Select(l => l.NietMeerInOpstap).SingleAsync());

        await _service.ImporteerAsync(Parse(Doel("LP-1"), Doel("LP-2")), toepassen: true);

        var lp2 = await _context.Leerplandoelen.SingleAsync(l => l.Code == "LP-2");
        Assert.False(lp2.NietMeerInOpstap);
    }

    // --- Integrity preflight (E1-15): the refusals fire on the PREVIEW path too. ---
    //
    // These three exist because the first round of E1-15 let them fire on SaveChanges, which a preview never
    // reaches: a preview then answered "here is what would be added" for a file the commit refused outright.
    // An FR-2.5 review step that green-lights an impossible import is worse than none, so each case is
    // asserted with `toepassen: false`.

    [Fact]
    public async Task Preview_refuses_an_unknown_discipline_before_writing_anything()
    {
        var parse = new OpstapParseResult(
            "99",
            [new Leerplandoel("LP-1", Doelsoort.Gemeenschappelijk, "L1", "Getallen", "Getalbegrip", "99", tekst: "tekst")],
            []);

        var fout = await Assert.ThrowsAsync<OpstapImportFout>(
            () => _service.ImporteerAsync(parse, toepassen: false));

        Assert.Equal(OpstapImportFoutSoort.OnbekendeDiscipline, fout.Soort);
        Assert.Contains("99", fout.Message, StringComparison.Ordinal);
        Assert.Empty(await _context.Leerplandoelen.ToListAsync());
    }

    [Fact]
    public async Task Preview_refuses_a_code_that_already_belongs_to_another_discipline()
    {
        // LP-1 is loaded under discipline 3; the file claims it for discipline 2.
        _context.Disciplines.Add(new Discipline("3", "Wetenschap en techniek"));
        _context.Leerplandoelen.Add(new Leerplandoel(
            "LP-1", Doelsoort.Gemeenschappelijk, "L1", "Natuur", "Levende natuur", "3", tekst: "tekst"));
        await _context.SaveChangesAsync();

        var fout = await Assert.ThrowsAsync<OpstapImportFout>(
            () => _service.ImporteerAsync(Parse(Doel("LP-1")), toepassen: false));

        Assert.Equal(OpstapImportFoutSoort.CodeInAndereDiscipline, fout.Soort);
        Assert.Contains("LP-1", fout.Message, StringComparison.Ordinal);
        // The row that was already there is untouched, and still belongs to discipline 3.
        var doel = await _context.Leerplandoelen.SingleAsync();
        Assert.Equal("3", doel.DisciplineNummer);
    }

    [Fact]
    public async Task Preview_refuses_a_concordance_to_a_minimumdoel_that_is_not_loaded()
    {
        var fout = await Assert.ThrowsAsync<OpstapImportFout>(
            () => _service.ImporteerAsync(Parse(Doel("LP-1", minimumdoelRef: "4-12")), toepassen: false));

        Assert.Equal(OpstapImportFoutSoort.OntbrekendeMinimumdoelen, fout.Soort);
        Assert.Contains("4-12", fout.Message, StringComparison.Ordinal);
        Assert.Empty(await _context.Leerplandoelen.ToListAsync());
    }

    [Fact]
    public async Task A_loaded_minimumdoel_makes_the_concordance_importable()
    {
        _context.Minimumdoelen.Add(new Minimumdoel("4-12", "4-", "12", "De leerling meet lengtes."));
        await _context.SaveChangesAsync();

        var result = await _service.ImporteerAsync(
            Parse(Doel("LP-1", minimumdoelRef: "4-12")), toepassen: true);

        Assert.Equal(["LP-1"], result.Diff.Toegevoegd.ToArray());
        Assert.Equal("4-12", (await _context.Leerplandoelen.SingleAsync()).MinimumdoelRef);
    }

    // --- Named but not delivered, renumbered, and the Op.stap key (E1-21). ---

    /// <summary>
    /// A malformed row whose code is stored is still in the file. Calling it disappeared, and flagging it, would say
    /// Op.stap dropped a goal it contains: the defect E1-12's audits found for minimumdoelen, on the Excel path too.
    /// </summary>
    [Fact]
    public async Task Een_rij_met_een_probleem_waarvan_de_code_opgeslagen_is_is_niet_verdwenen()
    {
        await _service.ImporteerAsync(Parse(Doel("LP-1"), Doel("LP-2", tekst: "vorige tekst")), toepassen: true);
        var parse = new OpstapParseResult(Discipline, [Doel("LP-1")], [new OpstapRijProbleem(3, "Unknown or missing doelsoort code 'X'.", "LP-2")]);

        var result = await _service.ImporteerAsync(parse, toepassen: true);

        Assert.Empty(result.Diff.Verdwenen);
        Assert.Equal(["LP-2"], result.Diff.NietIngelezen);
        Assert.True(result.Diff.VereistReview);
        Assert.False(result.Diff.IsLeeg);
        Assert.Equal([OpstapImportService.NietIngelezenMelding(1, OpstapHerkomst.Bestand)], result.Diff.Opmerkingen);
        var lp2 = await _context.Leerplandoelen.SingleAsync(l => l.Code == "LP-2");
        Assert.False(lp2.NietMeerInOpstap);
        Assert.Equal("vorige tekst", lp2.Tekst);
    }

    [Fact]
    public async Task Een_goal_die_de_api_niet_kon_lezen_is_niet_verdwenen()
    {
        await _service.ImporteerAsync(Parse(Doel("LP-1"), Doel("LP-2")), toepassen: true);
        var parse = new OpstapParseResult(Discipline, [Doel("LP-1")], [], OpstapHerkomst.OpstapApi, nietIngelezenCodes: ["LP-2"]);

        var result = await _service.ImporteerAsync(parse, toepassen: true);

        Assert.Equal(["LP-2"], result.Diff.NietIngelezen);
        Assert.Equal([OpstapImportService.NietIngelezenMelding(1, OpstapHerkomst.OpstapApi)], result.Diff.Opmerkingen);
        Assert.False((await _context.Leerplandoelen.SingleAsync(l => l.Code == "LP-2")).NietMeerInOpstap);
    }

    /// <summary>
    /// Only goal set G is imported from the API. A stored P goal the source still lists is outside that scope, not gone,
    /// and it is not a review item: the owner ruled the scope.
    /// </summary>
    [Fact]
    public async Task Een_code_buiten_het_importbereik_blijft_onaangeroerd_en_vraagt_geen_nazicht()
    {
        await _service.ImporteerAsync(Parse(Doel("LP-1"), Doel("LP-P", doelsoort: Doelsoort.Precurriculum)), toepassen: true);
        var parse = new OpstapParseResult(Discipline, [Doel("LP-1")], [], OpstapHerkomst.OpstapApi, buitenBereikCodes: ["LP-P"]);

        var result = await _service.ImporteerAsync(parse, toepassen: true);

        Assert.Equal(["LP-P"], result.Diff.BuitenBereik);
        Assert.Empty(result.Diff.Verdwenen);
        Assert.Empty(result.Diff.Opmerkingen);
        Assert.True(result.Diff.IsLeeg);
        Assert.False(result.Diff.VereistReview);
        Assert.False((await _context.Leerplandoelen.SingleAsync(l => l.Code == "LP-P")).NietMeerInOpstap);
    }

    /// <summary>
    /// ADR-0032 decision 7: the key tells a renumbered goal from a removed one plus a new one. What is written does not
    /// change (the code is the identity, and a teacher's link stays on the code it was made to); only the report does.
    /// </summary>
    [Fact]
    public async Task Een_hernummerd_doel_wordt_als_een_gebeurtenis_gemeld()
    {
        var sleutel = Guid.NewGuid();
        await _service.ImporteerAsync(Parse(Doel("LP-1"), Doel("LP-OUD", sleutel: sleutel)), toepassen: true);
        await LinkThemadoelAsync("LP-OUD", KoppelingStatus.Aanvaard);

        var result = await _service.ImporteerAsync(Parse(Doel("LP-1"), Doel("LP-NIEUW", sleutel: sleutel)), toepassen: true);

        var hernummerd = Assert.Single(result.Diff.Hernummerd);
        Assert.Equal(new HernummerdDoel("LP-OUD", "LP-NIEUW", 1), hernummerd);
        Assert.Empty(result.Diff.Toegevoegd);
        Assert.Empty(result.Diff.Verdwenen);
        Assert.Empty(result.Diff.VerdwenenMaarGekoppeld);
        Assert.True(result.Diff.VereistReview);
        Assert.Equal([OpstapImportService.HernummerdMelding([hernummerd])], result.Diff.Opmerkingen);
        Assert.True((await _context.Leerplandoelen.SingleAsync(l => l.Code == "LP-OUD")).NietMeerInOpstap);
        Assert.False((await _context.Leerplandoelen.SingleAsync(l => l.Code == "LP-NIEUW")).NietMeerInOpstap);
        Assert.Equal("LP-OUD", (await _context.Themadoelen.SingleAsync()).Koppeling.LeerplandoelCode);
    }

    [Fact]
    public async Task Een_nieuwe_code_zonder_gedeelde_sleutel_blijft_een_toevoeging()
    {
        await _service.ImporteerAsync(Parse(Doel("LP-1"), Doel("LP-OUD", sleutel: Guid.NewGuid())), toepassen: true);

        var result = await _service.ImporteerAsync(Parse(Doel("LP-1"), Doel("LP-NIEUW", sleutel: Guid.NewGuid())), toepassen: true);

        Assert.Empty(result.Diff.Hernummerd);
        Assert.Equal(["LP-NIEUW"], result.Diff.Toegevoegd);
        Assert.Equal(["LP-OUD"], result.Diff.Verdwenen);
    }

    /// <summary>A goal loaded from Excel has no key; the first API import stores it without calling that a change.</summary>
    [Fact]
    public async Task Een_sleutel_op_een_doel_uit_excel_zetten_is_geen_wijziging()
    {
        await _service.ImporteerAsync(Parse(Doel("LP-1")), toepassen: true);
        var sleutel = Guid.NewGuid();

        var result = await _service.ImporteerAsync(Parse(Doel("LP-1", sleutel: sleutel)), toepassen: true);

        Assert.Empty(result.Diff.Gewijzigd);
        Assert.Equal(["LP-1"], result.Diff.Ongewijzigd);
        _context.ChangeTracker.Clear();
        Assert.Equal(sleutel, (await _context.Leerplandoelen.SingleAsync()).OpstapSleutel);
    }

    [Fact]
    public async Task Een_andere_sleutel_onder_dezelfde_code_wordt_gemeld()
    {
        var oud = Guid.NewGuid();
        var nieuw = Guid.NewGuid();
        await _service.ImporteerAsync(Parse(Doel("LP-1", sleutel: oud)), toepassen: true);

        var result = await _service.ImporteerAsync(Parse(Doel("LP-1", sleutel: nieuw)), toepassen: true);

        var veld = Assert.Single(Assert.Single(result.Diff.Gewijzigd).Velden);
        Assert.Equal(new VeldWijziging(nameof(Leerplandoel.OpstapSleutel), oud.ToString("D"), nieuw.ToString("D")), veld);
    }

    /// <summary>The Excel route carries no key; re-importing a file must not erase the one an API import stored.</summary>
    [Fact]
    public async Task Een_herimport_zonder_sleutel_houdt_de_opgeslagen_sleutel()
    {
        var sleutel = Guid.NewGuid();
        await _service.ImporteerAsync(Parse(Doel("LP-1", tekst: "oud", sleutel: sleutel)), toepassen: true);

        await _service.ImporteerAsync(Parse(Doel("LP-1", tekst: "nieuw")), toepassen: true);

        _context.ChangeTracker.Clear();
        var doel = await _context.Leerplandoelen.SingleAsync();
        Assert.Equal("nieuw", doel.Tekst);
        Assert.Equal(sleutel, doel.OpstapSleutel);
    }

    /// <summary>"Mogelijk is het bestand leeg" is false about an API read, so that path says less (the E5-03 rule).</summary>
    [Fact]
    public async Task Een_lege_levering_uit_de_api_noemt_geen_bestand()
    {
        var result = await _service.ImporteerAsync(new OpstapParseResult(Discipline, [], [], OpstapHerkomst.OpstapApi), toepassen: true);

        Assert.True(result.Diff.Overgeslagen);
        Assert.Equal(
            ["De Op.stap-bron leverde geen bruikbare leerplandoelen voor discipline 2, dus is er niets toegepast. " +
             "Er staan nog geen doelen voor deze discipline, dus er verandert ook niets."],
            result.Diff.Opmerkingen);
    }

    [Fact]
    public async Task Een_code_uit_de_api_die_bij_een_andere_discipline_staat_noemt_geen_bestand()
    {
        _context.Disciplines.Add(new Discipline("3", "Wetenschap en techniek"));
        _context.Leerplandoelen.Add(new Leerplandoel("LP-1", Doelsoort.Gemeenschappelijk, "L1", "Natuur", "Levende natuur", "3", tekst: "tekst"));
        await _context.SaveChangesAsync();

        var fout = await Assert.ThrowsAsync<OpstapImportFout>(() => _service.ImporteerAsync(
            new OpstapParseResult(Discipline, [Doel("LP-1")], [], OpstapHerkomst.OpstapApi),
            toepassen: false));

        Assert.DoesNotContain("bestand", fout.Message, StringComparison.Ordinal);
        Assert.Contains("Volgens de Op.stap-bron horen ze bij discipline 2.", fout.Message, StringComparison.Ordinal);
    }

    /// <summary>Server-composed Dutch: the guard reads the value, because no catalogue keeps it in step (CLAUDE.md).</summary>
    [Fact]
    public void De_meldingen_zijn_verbogen_en_zeggen_alleen_wat_hun_voorwaarde_waarborgt()
    {
        Assert.Equal(
            "1 leerplandoel staat nog in de Op.stap-bron maar werd niet ingelezen. De vorige tekst blijft staan.",
            OpstapImportService.NietIngelezenMelding(1, OpstapHerkomst.OpstapApi));
        Assert.Equal(
            "3 leerplandoelen staan nog in het bestand maar werden niet ingelezen. De vorige teksten blijven staan.",
            OpstapImportService.NietIngelezenMelding(3, OpstapHerkomst.Bestand));
        Assert.Equal(
            "1 leerplandoel heeft in Op.stap een nieuwe code gekregen. Het wordt onder de nieuwe code toegevoegd; " +
            "de oude code blijft staan en wordt gemarkeerd als niet meer in Op.stap.",
            OpstapImportService.HernummerdMelding([new HernummerdDoel("A", "B", 0)]));
        // The sentence about teacher links appears only when a renumbered code has one.
        Assert.Equal(
            "2 leerplandoelen hebben in Op.stap een nieuwe code gekregen. Ze worden onder de nieuwe code toegevoegd; " +
            "de oude codes blijven staan en worden gemarkeerd als niet meer in Op.stap. " +
            "Wat leerkrachten aan een oude code koppelden, blijft daaraan gekoppeld.",
            OpstapImportService.HernummerdMelding([new HernummerdDoel("A", "B", 0), new HernummerdDoel("C", "D", 2)]));
    }

    private async Task LinkThemadoelAsync(string leerplandoelCode, KoppelingStatus status)
    {
        var thema = new Thema($"Thema voor {leerplandoelCode}", duurWeken: 4);
        thema.VoegThemadoelToe(new DoelKoppeling(leerplandoelCode, status, aiMotivatie: "past hier"));
        _context.Themas.Add(thema);
        await _context.SaveChangesAsync();
    }

    public void Dispose() => _context.Dispose();
}
