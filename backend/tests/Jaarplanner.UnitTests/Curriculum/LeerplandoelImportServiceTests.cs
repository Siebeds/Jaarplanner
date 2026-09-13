using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Infrastructure.OpstapImport;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// The leerplandoelen import from KOV's API (E1-21): one numbered snapshot, handed per discipline to the shared
/// non-destructive re-import. EF in-memory, as for <see cref="OpstapImportServiceTests"/>; the transaction that makes an
/// apply all-or-nothing, and the Restrict FKs, are proven on PostgreSQL by the endpoint tests.
/// </summary>
public sealed class LeerplandoelImportServiceTests : IDisposable
{
    private static readonly DateTimeOffset Nu = new(2026, 9, 13, 12, 0, 0, TimeSpan.Zero);

    private readonly AppDbContext _context;
    private readonly VasteBron _bron = new();
    private readonly LeerplandoelImportService _service;

    public LeerplandoelImportServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"leerplandoelen_{Guid.NewGuid():N}")
            // The in-memory store has no transactions; the apply's all-or-nothing is a PostgreSQL test.
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        _context = new AppDbContext(options);
        _context.Disciplines.AddRange(new Discipline("2", "Wiskunde"), new Discipline("9.1", "Veilige en gezonde levensstijl"));
        _context.Minimumdoelen.Add(new Minimumdoel("4-2.1.7", "4-", "2.1.7", "De leerlingen kunnen tellen."));
        _context.SaveChanges();

        _service = Service(new DisciplineSelectieOptions { Modus = DisciplineSelectieModus.Alle });
    }

    public void Dispose() => _context.Dispose();

    private LeerplandoelImportService Service(DisciplineSelectieOptions selectie) =>
        new(
            _context,
            _bron,
            new OpstapImportService(_context, new GeconfigureerdeDisciplineSelectie(selectie)),
            new VasteTijd(Nu));

    private static Leerplandoel Doel(string code, string tekst = "De leerlingen tellen.", string discipline = "2", Guid? sleutel = null, string? minimumdoelRef = null) =>
        new(code, Doelsoort.Gemeenschappelijk, "L3", "Getallenkennis", "Natuurlijke getallen", discipline,
            tekst: tekst, minimumdoelRef: minimumdoelRef, opstapSleutel: sleutel ?? Guid.NewGuid());

    private static LeerplandoelBronDiscipline Discipline(
        string nummer,
        IReadOnlyList<Leerplandoel> doelen,
        IReadOnlyList<LeerplandoelBronProbleem>? problemen = null,
        IReadOnlyList<string>? buitenBereik = null,
        string naam = "Wiskunde") =>
        new(nummer, naam, doelen, problemen ?? [], buitenBereik ?? [], buitenBereik is { Count: > 0 } ? [new DoelsetTelling("P", buitenBereik.Count)] : []);

    [Fact]
    public async Task Het_voorbeeld_schrijft_niets_en_noemt_de_versie()
    {
        _bron.Geef(Discipline("2", [Doel("2.1.GL3.10", minimumdoelRef: "4-2.1.7")]));

        var resultaat = await _service.ImporteerAsync(versie: null, toepassen: false);

        Assert.False(resultaat.Toegepast);
        Assert.Equal("1.2", resultaat.Versie);
        Assert.Equal("8f470a12", resultaat.Hash);
        Assert.Equal("TOEGEVOEGD", resultaat.Wijzigingslog);
        Assert.Null(_bron.GevraagdeVersie);
        Assert.Equal(["2.1.GL3.10"], Assert.Single(resultaat.Disciplines).Diff.Toegevoegd);
        Assert.Empty(await _context.Leerplandoelen.ToListAsync());
        Assert.Empty(await _context.Opstapversies.ToListAsync());
    }

    [Fact]
    public async Task De_toepassing_schrijft_de_doelen_en_de_versie()
    {
        var sleutel = Guid.NewGuid();
        _bron.Geef(Discipline("2", [Doel("2.1.GL3.10", sleutel: sleutel, minimumdoelRef: "4-2.1.7")]));

        var resultaat = await _service.ImporteerAsync("1.2", toepassen: true);

        Assert.True(resultaat.Toegepast);
        Assert.Equal("1.2", _bron.GevraagdeVersie);
        _context.ChangeTracker.Clear();
        var doel = await _context.Leerplandoelen.SingleAsync();
        Assert.Equal("4-2.1.7", doel.MinimumdoelRef);
        Assert.Equal(sleutel, doel.OpstapSleutel);
        var versie = await _context.Opstapversies.SingleAsync();
        Assert.Equal(("1.2", "8f470a12", Nu), (versie.Versie, versie.Hash, versie.ToegepastOp));
    }

    /// <summary>An apply writes the version the reviewer saw; without one it cannot know which that was.</summary>
    [Theory]
    [InlineData(null)]
    [InlineData(" ")]
    public async Task Een_toepassing_zonder_versie_wordt_geweigerd(string? versie)
    {
        _bron.Geef(Discipline("2", [Doel("2.1.GL3.10")]));

        await Assert.ThrowsAsync<ArgumentException>(() => _service.ImporteerAsync(versie, toepassen: true));

        Assert.Equal(0, _bron.Aanroepen);
    }

    [Fact]
    public async Task Het_rapport_noemt_de_vorige_toegepaste_versie()
    {
        _context.Opstapversies.AddRange(
            new Opstapversie("1.0", "oud", Nu.AddDays(-60)),
            new Opstapversie("1.1", "minder-oud", Nu.AddDays(-30)));
        await _context.SaveChangesAsync();
        _bron.Geef(Discipline("2", [Doel("2.1.GL3.10")]));

        var resultaat = await _service.ImporteerAsync("1.2", toepassen: false);

        Assert.Equal(new OpstapversieWeergave("1.1", "minder-oud", Nu.AddDays(-30)), resultaat.VorigeVersie);
    }

    /// <summary>
    /// KOV adding a discipline is not an uploader's mistake, so it is not the shared writer's 400: that discipline is
    /// skipped with a Dutch notice and the others import.
    /// </summary>
    [Fact]
    public async Task Een_discipline_die_de_toepassing_niet_kent_wordt_overgeslagen_met_een_melding()
    {
        _bron.Geef(
            Discipline("12", [Doel("12.1.GL1.1", discipline: "12")], naam: "Burgerschap"),
            Discipline("2", [Doel("2.1.GL3.10")]));

        var resultaat = await _service.ImporteerAsync("1.2", toepassen: true);

        var onbekend = resultaat.Disciplines[0].Diff;
        Assert.True(onbekend.Overgeslagen);
        Assert.Equal([LeerplandoelImportService.OnbekendeDisciplineMelding("Burgerschap", "12")], onbekend.Opmerkingen);
        Assert.Equal(
            "Discipline 12 (Burgerschap) staat in de Op.stap-bron maar niet in de toepassing. Er is niets van ingelezen of gewijzigd.",
            onbekend.Opmerkingen[0]);
        Assert.Equal(["2.1.GL3.10"], await _context.Leerplandoelen.Select(l => l.Code).ToListAsync());
    }

    /// <summary>
    /// The defect this story would otherwise have shipped: the Excel route loaded P, S, + and A goals, the API import
    /// takes only G, and a G-only import must not call those "niet meer in Op.stap" while KOV still lists them.
    /// </summary>
    [Fact]
    public async Task Een_opgeslagen_doel_uit_een_overgeslagen_doelset_blijft_onaangeroerd()
    {
        _context.Leerplandoelen.Add(new Leerplandoel("2.1.PF3.1", Doelsoort.Precurriculum, "F3", "Getallenkennis", "Natuurlijke getallen", "2", tekst: "Uit Excel."));
        await _context.SaveChangesAsync();
        _bron.Geef(Discipline("2", [Doel("2.1.GL3.10")], buitenBereik: ["2.1.PF3.1"]));

        var resultaat = await _service.ImporteerAsync("1.2", toepassen: true);

        var diff = Assert.Single(resultaat.Disciplines).Diff;
        Assert.Equal(["2.1.PF3.1"], diff.BuitenBereik);
        Assert.Empty(diff.Verdwenen);
        Assert.Empty(diff.Opmerkingen);
        Assert.Equal([new DoelsetTelling("P", 1)], resultaat.OvergeslagenDoelsets);
        _context.ChangeTracker.Clear();
        var p = await _context.Leerplandoelen.SingleAsync(l => l.Code == "2.1.PF3.1");
        Assert.False(p.NietMeerInOpstap);
        Assert.Equal("Uit Excel.", p.Tekst);
    }

    [Fact]
    public async Task Een_opgeslagen_doel_dat_nu_geweigerd_wordt_blijft_zoals_het_was()
    {
        _context.Leerplandoelen.Add(Doel("2.1.GL3.11", tekst: "De vorige tekst."));
        await _context.SaveChangesAsync();
        var probleem = new LeerplandoelBronProbleem("2.1.GL3.11", "contains markup the mapping cannot convert faithfully (<sub>).");
        _bron.Geef(Discipline("2", [Doel("2.1.GL3.10")], problemen: [probleem]));

        var resultaat = await _service.ImporteerAsync("1.2", toepassen: true);

        var diff = Assert.Single(resultaat.Disciplines).Diff;
        Assert.Equal(["2.1.GL3.11"], diff.NietIngelezen);
        Assert.Empty(diff.Verdwenen);
        Assert.True(diff.VereistReview);
        Assert.Equal([OpstapImportService.NietIngelezenMelding(1, OpstapHerkomst.OpstapApi)], diff.Opmerkingen);
        Assert.Equal([probleem], resultaat.Problemen);
        Assert.Equal([probleem], resultaat.Disciplines[0].Problemen);
        _context.ChangeTracker.Clear();
        var bewaard = await _context.Leerplandoelen.SingleAsync(l => l.Code == "2.1.GL3.11");
        Assert.Equal("De vorige tekst.", bewaard.Tekst);
        Assert.False(bewaard.NietMeerInOpstap);
    }

    [Fact]
    public async Task De_importselectie_blijft_gelden()
    {
        _bron.Geef(
            Discipline("2", [Doel("2.1.GL3.10")]),
            Discipline("9.1", [Doel("9-1.1.GL1.1", discipline: "9.1")], naam: "Veilige en gezonde levensstijl"));
        var service = Service(new DisciplineSelectieOptions { Modus = DisciplineSelectieModus.Selectie, Disciplines = ["2"] });

        var resultaat = await service.ImporteerAsync("1.2", toepassen: true);

        Assert.True(resultaat.Disciplines[1].Diff.Overgeslagen);
        Assert.StartsWith("Discipline 9.1 valt buiten de ingestelde importselectie", resultaat.Disciplines[1].Diff.Opmerkingen[0], StringComparison.Ordinal);
        Assert.Equal(["2.1.GL3.10"], await _context.Leerplandoelen.Select(l => l.Code).ToListAsync());
    }

    [Fact]
    public async Task Een_onleesbare_bron_schrijft_niets()
    {
        _bron.Faal(new OpstapBronFout("GET x answered 503."));

        await Assert.ThrowsAsync<OpstapBronFout>(() => _service.ImporteerAsync("1.2", toepassen: true));

        Assert.Empty(await _context.Leerplandoelen.ToListAsync());
        Assert.Empty(await _context.Opstapversies.ToListAsync());
    }

    /// <summary>The shared writer's refusal reaches the caller unchanged, and the version is then not recorded.</summary>
    [Fact]
    public async Task Een_ontbrekend_minimumdoel_weigert_de_import_en_de_versie_wordt_niet_vastgelegd()
    {
        _bron.Geef(Discipline("2", [Doel("2.1.GL3.10", minimumdoelRef: "6-9.9.9")]));

        var fout = await Assert.ThrowsAsync<OpstapImportFout>(() => _service.ImporteerAsync("1.2", toepassen: true));

        Assert.Equal(OpstapImportFoutSoort.OntbrekendeMinimumdoelen, fout.Soort);
        Assert.Empty(await _context.Opstapversies.ToListAsync());
    }

    /// <summary>
    /// E1-22, antagonist round 1 MAJOR: applying the snapshot that was already applied writes nothing and records no
    /// second version, which would have moved "doorgevoerd op" to today.
    /// </summary>
    [Fact]
    public async Task Een_herhaalde_toepassing_van_dezelfde_versie_schrijft_niets_en_legt_geen_tweede_versie_vast()
    {
        _bron.Geef(Discipline("2", [Doel("2.1.GL3.10", minimumdoelRef: "4-2.1.7")]));
        var eerste = await _service.ImporteerAsync("1.2", toepassen: true);

        var voorbeeld = await _service.ImporteerAsync("1.2", toepassen: false);
        var herhaling = await _service.ImporteerAsync("1.2", toepassen: true);

        Assert.True(eerste.SchrijftIets);
        Assert.False(voorbeeld.SchrijftIets);
        Assert.Equal(0, voorbeeld.AantalRedenenGewijzigd);
        Assert.False(herhaling.SchrijftIets);
        Assert.Single(await _context.Opstapversies.ToListAsync());
    }

    /// <summary>A version other than the last applied one is recorded even when no goal changes: the stand must name it.</summary>
    [Fact]
    public async Task Een_andere_versie_zonder_gewijzigde_doelen_wordt_toch_vastgelegd()
    {
        _bron.Geef(Discipline("2", [Doel("2.1.GL3.10", minimumdoelRef: "4-2.1.7")]));
        await _service.ImporteerAsync("1.2", toepassen: true);
        _context.Opstapversies.Add(new Opstapversie("1.3", "nieuwer", Nu.AddDays(1)));
        await _context.SaveChangesAsync();

        var voorbeeld = await _service.ImporteerAsync("1.2", toepassen: false);
        await _service.ImporteerAsync("1.2", toepassen: true);

        Assert.True(Assert.Single(voorbeeld.Disciplines).Diff.IsLeeg);
        Assert.True(voorbeeld.SchrijftIets);
        Assert.Equal(3, await _context.Opstapversies.CountAsync());
    }

    /// <summary>The same version is no proof of nothing to write: a widened selection makes the same snapshot add goals.</summary>
    [Fact]
    public async Task Een_verbrede_selectie_bij_dezelfde_versie_heeft_wel_iets_te_schrijven()
    {
        _bron.Geef(
            Discipline("2", [Doel("2.1.GL3.10")]),
            Discipline("9.1", [Doel("9-1.1.GL1.1", discipline: "9.1")], naam: "Veilige en gezonde levensstijl"));
        await Service(new DisciplineSelectieOptions { Modus = DisciplineSelectieModus.Selectie, Disciplines = ["2"] })
            .ImporteerAsync("1.2", toepassen: true);

        var verbreed = await _service.ImporteerAsync("1.2", toepassen: false);

        Assert.True(verbreed.SchrijftIets);
        Assert.Equal(["9-1.1.GL1.1"], verbreed.Disciplines[1].Diff.Toegevoegd);
    }

    /// <summary>
    /// Owner ruling 2026-09-13 "Reden tonen": the apply stores, per minimumdoel, why no loaded leerplandoel concords it,
    /// derived from its snapshot; a preview counts what would change and writes nothing.
    /// </summary>
    [Fact]
    public async Task De_reden_per_minimumdoel_wordt_uit_de_snapshot_afgeleid_en_met_de_toepassing_opgeslagen()
    {
        _context.Minimumdoelen.AddRange(
            new Minimumdoel("6-7.1.6", "6-", "7.1.6", "De leerlingen kunnen zwemmen."),
            new Minimumdoel("K-1.2.6", "K-", "1.2.6", "De kleuters kunnen luisteren."));
        await _context.SaveChangesAsync();
        _bron.Verwijzingen = [new MinimumdoelVerwijzing("6-7.1.6", "Z", Geweigerd: false)];
        _bron.Geef(Discipline("2", [Doel("2.1.GL3.10", minimumdoelRef: "4-2.1.7")]));

        var voorbeeld = await _service.ImporteerAsync("1.2", toepassen: false);
        _context.ChangeTracker.Clear();
        Assert.Null((await _context.Minimumdoelen.SingleAsync(m => m.Ref == "6-7.1.6")).ZonderLeerplandoelReden);
        var toepassing = await _service.ImporteerAsync("1.2", toepassen: true);

        Assert.Equal(2, voorbeeld.AantalRedenenGewijzigd);
        Assert.Equal(2, toepassing.AantalRedenenGewijzigd);
        _context.ChangeTracker.Clear();
        var zwemmen = await _context.Minimumdoelen.SingleAsync(m => m.Ref == "6-7.1.6");
        Assert.Equal((ZonderLeerplandoelReden.AlleenOvergeslagenDoelsets, "Z"), (zwemmen.ZonderLeerplandoelReden!.Value, zwemmen.ZonderLeerplandoelDoelsets));
        Assert.Equal(ZonderLeerplandoelReden.GeenDoelInOpstap, (await _context.Minimumdoelen.SingleAsync(m => m.Ref == "K-1.2.6")).ZonderLeerplandoelReden);
        Assert.Null((await _context.Minimumdoelen.SingleAsync(m => m.Ref == "4-2.1.7")).ZonderLeerplandoelReden);
        Assert.Equal(0, (await _service.ImporteerAsync("1.2", toepassen: false)).AantalRedenenGewijzigd);
    }

    /// <summary>
    /// Antagonist round 2, MINOR 1 (a): a goal KOV dropped stays stored, flagged and concorded, so its minimumdoel keeps
    /// its place in the register. It gets no reason, and the preview does not count a change the register will not show.
    /// </summary>
    [Fact]
    public async Task Een_minimumdoel_waar_een_opgeslagen_verdwenen_doel_naar_verwijst_krijgt_geen_reden()
    {
        _bron.Geef(Discipline("2", [Doel("2.1.GL3.10", minimumdoelRef: "4-2.1.7"), Doel("2.1.GL3.11")]));
        await _service.ImporteerAsync("1.2", toepassen: true);
        _bron.Geef(Discipline("2", [Doel("2.1.GL3.11")]));

        var voorbeeld = await _service.ImporteerAsync("1.2", toepassen: false);
        await _service.ImporteerAsync("1.2", toepassen: true);

        Assert.Equal(["2.1.GL3.10"], Assert.Single(voorbeeld.Disciplines).Diff.Verdwenen);
        Assert.Equal(0, voorbeeld.AantalRedenenGewijzigd);
        _context.ChangeTracker.Clear();
        Assert.Null((await _context.Minimumdoelen.SingleAsync(m => m.Ref == "4-2.1.7")).ZonderLeerplandoelReden);
        Assert.True((await _context.Leerplandoelen.SingleAsync(l => l.Code == "2.1.GL3.10")).NietMeerInOpstap);
    }

    /// <summary>
    /// Antagonist round 2, MINOR 1 (b): a minimumdoel that is itself no longer in Op.stap gets no reason. A goal may still
    /// point at its old address, which the source drops, so "no goal refers to it" is unproven.
    /// </summary>
    [Fact]
    public async Task Een_minimumdoel_dat_niet_meer_in_opstap_staat_krijgt_geen_reden()
    {
        var ingetrokken = new Minimumdoel("6-9.9.9", "6-", "9.9.9", "Een ingetrokken minimumdoel.");
        _context.Minimumdoelen.Add(ingetrokken);
        _context.Entry(ingetrokken).Property(m => m.NietMeerInOpstap).CurrentValue = true;
        await _context.SaveChangesAsync();
        _bron.Geef(Discipline("2", [Doel("2.1.GL3.10", minimumdoelRef: "4-2.1.7")]));

        var voorbeeld = await _service.ImporteerAsync("1.2", toepassen: false);
        await _service.ImporteerAsync("1.2", toepassen: true);

        Assert.Equal(0, voorbeeld.AantalRedenenGewijzigd);
        _context.ChangeTracker.Clear();
        Assert.Null((await _context.Minimumdoelen.SingleAsync(m => m.Ref == "6-9.9.9")).ZonderLeerplandoelReden);
    }

    /// <summary>
    /// Antagonist round 3, MINOR 1: a minimumdoel KOV no longer publishes gets no reason even before the minimumdoelen
    /// import has flagged it. "No longer in Op.stap" is read from this import's own read of KOV's minimumdoelen list.
    /// </summary>
    [Fact]
    public async Task Een_minimumdoel_dat_kov_niet_meer_publiceert_krijgt_geen_reden_ook_zonder_markering()
    {
        _context.Minimumdoelen.Add(new Minimumdoel("6-9.9.8", "6-", "9.9.8", "Een minimumdoel dat KOV introk."));
        await _context.SaveChangesAsync();
        _bron.GepubliceerdeMinimumdoelen = new HashSet<string>(["4-2.1.7"], StringComparer.Ordinal);
        _bron.Geef(Discipline("2", [Doel("2.1.GL3.10", minimumdoelRef: "4-2.1.7")]));

        var voorbeeld = await _service.ImporteerAsync("1.2", toepassen: false);
        await _service.ImporteerAsync("1.2", toepassen: true);

        Assert.Equal(0, voorbeeld.AantalRedenenGewijzigd);
        _context.ChangeTracker.Clear();
        var ingetrokken = await _context.Minimumdoelen.SingleAsync(m => m.Ref == "6-9.9.8");
        Assert.False(ingetrokken.NietMeerInOpstap);
        Assert.Null(ingetrokken.ZonderLeerplandoelReden);
    }

    /// <summary>
    /// Antagonist round 2, MINOR 2: a first apply records the version even when no discipline writes and no reason changes
    /// (here the only discipline is outside the selection), so it is offered and it closes the Excel route.
    /// </summary>
    [Fact]
    public async Task Een_eerste_toepassing_legt_de_versie_vast_ook_als_er_geen_doel_verandert()
    {
        _bron.Geef(Discipline("2", [Doel("2.1.GL3.10", minimumdoelRef: "4-2.1.7")]));
        var service = Service(new DisciplineSelectieOptions { Modus = DisciplineSelectieModus.Selectie, Disciplines = ["9.1"] });

        var voorbeeld = await service.ImporteerAsync("1.2", toepassen: false);
        await service.ImporteerAsync("1.2", toepassen: true);

        Assert.True(Assert.Single(voorbeeld.Disciplines).Diff.Overgeslagen);
        Assert.Equal(0, voorbeeld.AantalRedenenGewijzigd);
        Assert.Null(voorbeeld.VorigeVersie);
        Assert.True(voorbeeld.SchrijftIets);
        Assert.Equal("1.2", (await _context.Opstapversies.SingleAsync()).Versie);
    }

    private sealed class VasteBron : ILeerplandoelBron
    {
        private Func<LeerplandoelBronResultaat> _antwoord = () => throw new InvalidOperationException("no answer set");

        public string? GevraagdeVersie { get; private set; }

        public int Aanroepen { get; private set; }

        /// <summary>The goals that point at a minimumdoel without being imported, for the reason per minimumdoel (E1-22).</summary>
        public IReadOnlyList<MinimumdoelVerwijzing> Verwijzingen { get; set; } = [];

        /// <summary>The minimumdoelen KOV publishes in this read, or null for "not said" (E1-22 fix round 3).</summary>
        public IReadOnlySet<string>? GepubliceerdeMinimumdoelen { get; set; }

        public void Geef(params LeerplandoelBronDiscipline[] disciplines) =>
            _antwoord = () => new LeerplandoelBronResultaat(
                "1.2",
                "8f470a12",
                Nu.AddDays(-17),
                "TOEGEVOEGD",
                // Fresh entities per call, as the real source returns: the service must not depend on reference identity.
                disciplines.Select(d => new LeerplandoelBronDiscipline(
                    d.DisciplineNummer,
                    d.DisciplineNaam,
                    d.Leerplandoelen.Select(Kopie).ToList(),
                    d.Problemen,
                    d.BuitenBereikCodes,
                    d.OvergeslagenDoelsets)).ToList(),
                Verwijzingen,
                GepubliceerdeMinimumdoelen);

        public void Faal(OpstapBronFout fout) => _antwoord = () => throw fout;

        public Task<LeerplandoelBronResultaat> HaalOpAsync(string? versie, CancellationToken cancellationToken = default)
        {
            Aanroepen++;
            GevraagdeVersie = versie;
            return Task.FromResult(_antwoord());
        }

        private static Leerplandoel Kopie(Leerplandoel l) =>
            new(l.Code, l.Doelsoort, l.JaarFase, l.Domein, l.Subdomein, l.DisciplineNummer, l.Cluster, l.Tekst,
                l.Voorbeelden, l.Toelichting, l.Woordenschat, l.MinimumdoelRef, l.OpstapSleutel);
    }

    private sealed class VasteTijd(DateTimeOffset nu) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => nu;
    }
}
