using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Infrastructure.OpstapImport;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// Pins the E1-06 discipline-selection seam (Art. XIV "Disciplines first"): which disciplines the
/// Op.stap import path processes is <b>data-driven</b>, never compiled in. The same code yields
/// either "all" or "a starter selection" purely from configuration — and changing the config changes
/// the behaviour with no code change. These tests drive the seam exclusively through configuration
/// values / options to prove no discipline list is baked into logic.
/// </summary>
public sealed class OpstapImportDisciplineSelectieTests : IDisposable
{
    private readonly AppDbContext _context;

    public OpstapImportDisciplineSelectieTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"selectie_{Guid.NewGuid():N}")
            .Options;
        _context = new AppDbContext(options);

        // The disciplines these tests import into. A real database always has the official taxonomy (the
        // migrations seed all 13 rows), and since E1-15 the import path checks that the stated discipline is
        // one of them — which the required Restrict FK has always enforced on PostgreSQL and which the
        // in-memory provider silently ignores. Seeding here keeps the fixture honest about the state it
        // claims to represent; it says nothing about the selection seam these tests exercise.
        _context.Disciplines.AddRange(
            new Discipline("1", "Nederlands en communicatie"),
            new Discipline("2", "Wiskunde"));
        _context.SaveChanges();
    }

    private static Leerplandoel Doel(string code, string disciplineNummer) =>
        new(
            code: code,
            doelsoort: Doelsoort.Gemeenschappelijk,
            jaarFase: "L1",
            domein: "Getallen",
            subdomein: "Getalbegrip",
            disciplineNummer: disciplineNummer,
            tekst: "tekst");

    private static OpstapParseResult Parse(string disciplineNummer, params Leerplandoel[] doelen) =>
        new(disciplineNummer, doelen, []);

    private OpstapImportService ServiceMet(IDisciplineSelectie selectie) =>
        new(_context, selectie);

    // --- The selection is a pure function of config/options (no compiled-in list) ---

    [Theory]
    [InlineData("1")]
    [InlineData("2")]
    [InlineData("9.2")]
    [InlineData("11")]
    public void Alle_modus_admits_every_discipline(string disciplineNummer)
    {
        var selectie = new GeconfigureerdeDisciplineSelectie(
            new DisciplineSelectieOptions { Modus = DisciplineSelectieModus.Alle });

        Assert.True(selectie.IsInScope(disciplineNummer));
    }

    [Fact]
    public void Selectie_modus_admits_only_the_configured_numbers()
    {
        var selectie = new GeconfigureerdeDisciplineSelectie(
            new DisciplineSelectieOptions
            {
                Modus = DisciplineSelectieModus.Selectie,
                Disciplines = ["1", "2", "6"],
            });

        Assert.True(selectie.IsInScope("1"));
        Assert.True(selectie.IsInScope("2"));
        Assert.True(selectie.IsInScope("6"));
        Assert.False(selectie.IsInScope("3"));
        Assert.False(selectie.IsInScope("9.2"));
    }

    [Fact]
    public void Configured_numbers_are_trimmed_and_matched_exactly()
    {
        var selectie = new GeconfigureerdeDisciplineSelectie(
            new DisciplineSelectieOptions
            {
                Modus = DisciplineSelectieModus.Selectie,
                Disciplines = [" 9.2 "],
            });

        Assert.True(selectie.IsInScope("9.2"));
        Assert.True(selectie.IsInScope(" 9.2"));
        Assert.False(selectie.IsInScope("9"));
    }

    [Fact]
    public void Selectie_modus_with_no_configured_numbers_admits_nothing()
    {
        var selectie = new GeconfigureerdeDisciplineSelectie(
            new DisciplineSelectieOptions { Modus = DisciplineSelectieModus.Selectie });

        Assert.False(selectie.IsInScope("1"));
        Assert.False(selectie.IsInScope("2"));
    }

    // --- The documented default is the overridable placeholder, resolved from config space ---

    [Fact]
    public void Unconfigured_options_default_to_the_all_placeholder()
    {
        // An absent `Opstap:DisciplineSelectie` section binds to the type's defaults; the documented
        // placeholder (Modus = Alle) is what an unconfigured deployment resolves to — not a list
        // baked into logic. This is the Art. XIV placeholder pending the directie decision.
        var bound = new DisciplineSelectieOptions();
        var selectie = new GeconfigureerdeDisciplineSelectie(bound);

        Assert.Equal(DisciplineSelectieModus.Alle, bound.Modus);
        Assert.True(selectie.IsInScope("1"));
    }

    [Fact]
    public void Options_bind_from_configuration_so_the_directie_sets_scope_without_a_code_change()
    {
        // Build the selection from raw configuration key/values (as appsettings / env / Key Vault
        // would supply), proving the choice travels purely as data through the standard options path.
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Opstap:DisciplineSelectie:Modus"] = "Selectie",
                ["Opstap:DisciplineSelectie:Disciplines:0"] = "2",
                ["Opstap:DisciplineSelectie:Disciplines:1"] = "6",
            })
            .Build();

        var bound = new DisciplineSelectieOptions();
        configuration.GetSection(DisciplineSelectieOptions.SectionName).Bind(bound);
        var selectie = new GeconfigureerdeDisciplineSelectie(Options.Create(bound));

        Assert.True(selectie.IsInScope("2"));
        Assert.True(selectie.IsInScope("6"));
        Assert.False(selectie.IsInScope("1"));
    }

    // --- End-to-end through the import path: same code, config decides what is imported ---

    [Fact]
    public async Task Import_accepts_every_discipline_when_configured_all()
    {
        var service = ServiceMet(new GeconfigureerdeDisciplineSelectie(
            new DisciplineSelectieOptions { Modus = DisciplineSelectieModus.Alle }));

        var r1 = await service.ImporteerAsync(Parse("1", Doel("NL-1", "1")), toepassen: true);
        var r2 = await service.ImporteerAsync(Parse("2", Doel("WI-1", "2")), toepassen: true);

        Assert.True(r1.Toegepast);
        Assert.True(r2.Toegepast);
        Assert.False(r1.Diff.Overgeslagen);
        Assert.False(r2.Diff.Overgeslagen);
        Assert.Equal(2, await _context.Leerplandoelen.CountAsync());
    }

    [Fact]
    public async Task Import_processes_only_in_scope_disciplines_and_skips_the_rest_when_configured_subset()
    {
        // Subset config: discipline "1" is in scope, "2" is not — the SAME import code, different data.
        var service = ServiceMet(new GeconfigureerdeDisciplineSelectie(
            new DisciplineSelectieOptions
            {
                Modus = DisciplineSelectieModus.Selectie,
                Disciplines = ["1"],
            }));

        var inScope = await service.ImporteerAsync(Parse("1", Doel("NL-1", "1")), toepassen: true);
        var outOfScope = await service.ImporteerAsync(Parse("2", Doel("WI-1", "2")), toepassen: true);

        // In-scope discipline imported normally.
        Assert.True(inScope.Toegepast);
        Assert.Equal(["NL-1"], inScope.Diff.Toegevoegd.ToArray());

        // Out-of-scope discipline skipped: nothing inserted, a review notice explains why.
        Assert.False(outOfScope.Toegepast);
        Assert.True(outOfScope.Diff.Overgeslagen);
        Assert.Empty(outOfScope.Diff.Toegevoegd);
        Assert.NotEmpty(outOfScope.Diff.Opmerkingen);

        // Only the in-scope discipline's row reached the database.
        Assert.Equal(1, await _context.Leerplandoelen.CountAsync());
        Assert.False(await _context.Leerplandoelen.AnyAsync(l => l.DisciplineNummer == "2"));
    }

    [Fact]
    public async Task Changing_the_config_changes_the_behaviour_with_no_code_change()
    {
        // Discipline "2" with one and the same import call, two different configs → two outcomes.
        var parse = Parse("2", Doel("WI-1", "2"));

        var verboden = ServiceMet(new GeconfigureerdeDisciplineSelectie(
            new DisciplineSelectieOptions
            {
                Modus = DisciplineSelectieModus.Selectie,
                Disciplines = ["1"], // "2" not listed
            }));
        var geweigerd = await verboden.ImporteerAsync(parse, toepassen: true);
        Assert.True(geweigerd.Diff.Overgeslagen);
        Assert.Equal(0, await _context.Leerplandoelen.CountAsync());

        var toegestaan = ServiceMet(new GeconfigureerdeDisciplineSelectie(
            new DisciplineSelectieOptions
            {
                Modus = DisciplineSelectieModus.Selectie,
                Disciplines = ["1", "2"], // now "2" is in scope — config-only change
            }));
        var aanvaard = await toegestaan.ImporteerAsync(parse, toepassen: true);
        Assert.True(aanvaard.Toegepast);
        Assert.Equal(["WI-1"], aanvaard.Diff.Toegevoegd.ToArray());
        Assert.Equal(1, await _context.Leerplandoelen.CountAsync());
    }

    [Fact]
    public async Task Out_of_scope_skip_never_touches_existing_rows_of_that_discipline()
    {
        // Seed discipline "2" while it is in scope, then re-import it while out of scope: the existing
        // rows must be left completely untouched (no flagging, no deletion) — like the empty-file guard.
        var all = ServiceMet(new GeconfigureerdeDisciplineSelectie(
            new DisciplineSelectieOptions { Modus = DisciplineSelectieModus.Alle }));
        await all.ImporteerAsync(Parse("2", Doel("WI-1", "2"), Doel("WI-2", "2")), toepassen: true);

        var subset = ServiceMet(new GeconfigureerdeDisciplineSelectie(
            new DisciplineSelectieOptions
            {
                Modus = DisciplineSelectieModus.Selectie,
                Disciplines = ["1"],
            }));
        var result = await subset.ImporteerAsync(Parse("2", Doel("WI-1", "2")), toepassen: true);

        Assert.True(result.Diff.Overgeslagen);
        Assert.False(result.Toegepast);
        Assert.Empty(result.Diff.Verdwenen);
        Assert.Equal(2, await _context.Leerplandoelen.CountAsync(l => l.DisciplineNummer == "2"));
        Assert.False(await _context.Leerplandoelen.AnyAsync(l => l.NietMeerInOpstap));
    }

    public void Dispose() => _context.Dispose();
}
