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
        Doelsoort doelsoort = Doelsoort.Gemeenschappelijk) =>
        new(
            code: code,
            doelsoort: doelsoort,
            jaarFase: jaarFase,
            domein: "Getallen",
            subdomein: "Getalbegrip",
            disciplineNummer: Discipline,
            tekst: tekst,
            minimumdoelRef: minimumdoelRef);

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

    private async Task LinkThemadoelAsync(string leerplandoelCode, KoppelingStatus status)
    {
        var thema = new Thema($"Thema voor {leerplandoelCode}", duurWeken: 4);
        thema.VoegThemadoelToe(new DoelKoppeling(leerplandoelCode, status, aiMotivatie: "past hier"));
        _context.Themas.Add(thema);
        await _context.SaveChangesAsync();
    }

    public void Dispose() => _context.Dispose();
}
