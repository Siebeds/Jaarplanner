using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Infrastructure.OpstapImport;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// The <c>diff.opmerkingen</c> a beheerder actually reads on the Op.stap half of the import screen (E1-13
/// clause 6, FR-2.1/2.5).
/// <para>
/// <b>Why this file exists.</b> The school-content importer got exactly this guard in E1-13's first fix round;
/// this importer did not, and one round later its own composed notice was found carrying the plural bug
/// (<c>"De 1 bestaande doelen blijven ongewijzigd"</c>) with no test anywhere asserting either grammatical
/// form. That is the selective-fix pattern the round diagnosed, one file over (E1-13 round-2 audit, MINOR 3).
/// So this is the sibling of <c>SchoolcontentImportOpmerkingenTests</c>: the same three predicates over
/// <b>every</b> opmerking on the path, plus one case per grammatical form of the composed sentence.
/// </para>
/// <para>
/// Note the predicates cannot catch an inflection error on their own — <c>"De 1 bestaande doelen"</c> passes all
/// three. The per-form cases are what pins that, which is why they are not optional extras here.
/// </para>
/// </summary>
public sealed class OpstapImportOpmerkingenTests : IDisposable
{
    private const string Discipline = "2";

    private readonly AppDbContext _context;

    public OpstapImportOpmerkingenTests()
    {
        _context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"opstap_opmerkingen_{Guid.NewGuid():N}")
            .Options);
        _context.Disciplines.Add(new Discipline(Discipline, "Wiskunde"));
        _context.SaveChanges();
    }

    public void Dispose() => _context.Dispose();

    /// <summary>What every notice on this path must satisfy, whatever else it says (Art. II.3 / II.5).</summary>
    private static void AssertLeesbaarVoorEenBeheerder(string opmerking)
    {
        Assert.DoesNotContain("—", opmerking, StringComparison.Ordinal);
        Assert.DoesNotContain("Art.", opmerking, StringComparison.Ordinal);
        Assert.DoesNotContain("(s)", opmerking, StringComparison.Ordinal);
    }

    /// <summary>
    /// The composed "nothing was read" notice, in all three of its grammatical forms. The zero case exists
    /// because absence of input is now a skip even on a first import (see the guard's own comment): the two-form
    /// version would have claimed "Het bestaande doel blijft ongewijzigd" about a row that does not exist.
    /// </summary>
    [Theory]
    [InlineData(0, "Er staan nog geen doelen voor deze discipline")]
    [InlineData(1, "Het bestaande doel blijft ongewijzigd.")]
    [InlineData(3, "De 3 bestaande doelen blijven ongewijzigd.")]
    public async Task Leeg_bestand_verbuigt_naar_het_aantal_bestaande_doelen(int bestaand, string verwacht)
    {
        for (var i = 1; i <= bestaand; i++)
        {
            _context.Leerplandoelen.Add(Doel($"LP-{i}"));
        }

        await _context.SaveChangesAsync();

        var resultaat = await Service().ImporteerAsync(new OpstapParseResult(Discipline, [], []), toepassen: true);

        Assert.True(resultaat.Diff.Overgeslagen);
        Assert.False(resultaat.Toegepast);

        var opmerking = Assert.Single(resultaat.Diff.Opmerkingen);
        AssertLeesbaarVoorEenBeheerder(opmerking);
        Assert.Contains(verwacht, opmerking, StringComparison.Ordinal);

        // The wrong inflection of the other forms, pinned explicitly: a count spliced into a fixed plural is the
        // bug this repo has shipped five times, and it passes the three predicates above.
        Assert.DoesNotContain("De 1 bestaande doelen", opmerking, StringComparison.Ordinal);
        Assert.DoesNotContain("De 0 bestaande", opmerking, StringComparison.Ordinal);
    }

    /// <summary>
    /// A first import that reads nothing is a skip too, so the screen cannot offer a commit control that would
    /// write nothing and then report success (the E3-06 rule; E1-13 round-2 audit, MINOR 4). Asserted on the
    /// wire value the frontend guard keys on, not on the copy.
    /// </summary>
    [Fact]
    public async Task Eerste_import_zonder_bruikbare_rijen_is_ook_overgeslagen()
    {
        var resultaat = await Service().ImporteerAsync(new OpstapParseResult(Discipline, [], []), toepassen: true);

        Assert.True(resultaat.Diff.Overgeslagen);
        Assert.False(resultaat.Toegepast);
        Assert.Empty(resultaat.Diff.Toegevoegd);
        Assert.Empty(await _context.Leerplandoelen.ToListAsync());
    }

    /// <summary>
    /// The other rendered notice on this path: a discipline outside the configured selection (E1-06). It names
    /// no configuration key, because widening the selection is an operator action rather than the reader's.
    /// </summary>
    [Fact]
    public async Task Discipline_buiten_de_selectie_meldt_leesbaar_wat_er_gebeurde()
    {
        var service = new OpstapImportService(
            _context,
            new GeconfigureerdeDisciplineSelectie(new DisciplineSelectieOptions
            {
                Modus = DisciplineSelectieModus.Selectie,
                Disciplines = ["7"],
            }));

        var resultaat = await service.ImporteerAsync(
            new OpstapParseResult(Discipline, [Doel("LP-1")], []), toepassen: true);

        Assert.True(resultaat.Diff.Overgeslagen);
        var opmerking = Assert.Single(resultaat.Diff.Opmerkingen);
        AssertLeesbaarVoorEenBeheerder(opmerking);
        Assert.Contains("buiten de ingestelde importselectie", opmerking, StringComparison.Ordinal);
        Assert.Contains("Er is niets ingelezen of gewijzigd.", opmerking, StringComparison.Ordinal);
        Assert.DoesNotContain("Opstap:DisciplineSelectie", opmerking, StringComparison.Ordinal);
    }

    /// <summary>
    /// The sweep-over-everything half, mirroring the school-content guard: whatever a run on this path emits,
    /// every opmerking passes the predicates. A notice added here later is covered without a new test.
    /// </summary>
    [Fact]
    public async Task Elke_opmerking_van_een_opstaprun_is_leesbaar()
    {
        _context.Leerplandoelen.Add(Doel("LP-1"));
        await _context.SaveChangesAsync();

        var runs = new[]
        {
            await Service().ImporteerAsync(new OpstapParseResult(Discipline, [], []), toepassen: false),
            await Service().ImporteerAsync(new OpstapParseResult(Discipline, [Doel("LP-2")], []), toepassen: false),
        };

        Assert.Contains(runs, r => r.Diff.Opmerkingen.Count > 0);
        foreach (var opmerking in runs.SelectMany(r => r.Diff.Opmerkingen))
        {
            AssertLeesbaarVoorEenBeheerder(opmerking);
        }
    }

    private OpstapImportService Service() =>
        new(
            _context,
            new GeconfigureerdeDisciplineSelectie(
                new DisciplineSelectieOptions { Modus = DisciplineSelectieModus.Alle }));

    private static Leerplandoel Doel(string code) =>
        new(
            code: code,
            doelsoort: Doelsoort.Gemeenschappelijk,
            jaarFase: "L1",
            domein: "Getallen",
            subdomein: "Getalbegrip",
            disciplineNummer: Discipline,
            tekst: "tekst");
}
