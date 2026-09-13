using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Infrastructure.OpstapImport;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// The minimumdoelen import (E1-12, ADR-0032): upsert on the ref, a preview that writes nothing, and a disappearance
/// that is reported and never deleted (Art. III.4). EF in-memory, as for <see cref="OpstapImportServiceTests"/>; the
/// Restrict FK that makes "never delete" matter is proven on PostgreSQL by the endpoint tests.
/// </summary>
public sealed class MinimumdoelImportServiceTests : IDisposable
{
    private readonly AppDbContext _context;
    private readonly VasteBron _bron = new();
    private readonly MinimumdoelImportService _service;

    public MinimumdoelImportServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"minimumdoelen_{Guid.NewGuid():N}")
            .Options;
        _context = new AppDbContext(options);
        _service = new MinimumdoelImportService(_context, _bron);
    }

    public void Dispose() => _context.Dispose();

    private static Minimumdoel Md(string nr, string omschrijving = "De kleuters kunnen tellen.", string leeftijd = "K-") =>
        new(leeftijd + nr, leeftijd, nr, omschrijving);

    [Fact]
    public async Task De_eerste_import_voegt_alle_minimumdoelen_toe()
    {
        _bron.Geef(Md("1.2"), Md("1.1"));

        var resultaat = await _service.ImporteerAsync(toepassen: true);

        Assert.True(resultaat.Toegepast);
        Assert.Equal(["K-1.1", "K-1.2"], resultaat.Diff.Toegevoegd);
        Assert.Equal(2, await _context.Minimumdoelen.CountAsync());
    }

    [Fact]
    public async Task Het_voorbeeld_schrijft_niets()
    {
        _bron.Geef(Md("1.1"));

        var resultaat = await _service.ImporteerAsync(toepassen: false);

        Assert.False(resultaat.Toegepast);
        Assert.Equal(["K-1.1"], resultaat.Diff.Toegevoegd);
        Assert.Empty(await _context.Minimumdoelen.ToListAsync());
    }

    [Fact]
    public async Task Dezelfde_bron_twee_keer_inlezen_wijzigt_niets()
    {
        _bron.Geef(Md("1.1"), Md("1.2"));
        await _service.ImporteerAsync(toepassen: true);

        var resultaat = await _service.ImporteerAsync(toepassen: true);

        Assert.True(resultaat.Diff.IsLeeg);
        Assert.False(resultaat.Diff.VereistReview);
        Assert.Equal(["K-1.1", "K-1.2"], resultaat.Diff.Ongewijzigd);
    }

    [Fact]
    public async Task Een_gewijzigde_omschrijving_wordt_gemeld_en_bijgewerkt()
    {
        _bron.Geef(Md("1.1", "Oude tekst."));
        await _service.ImporteerAsync(toepassen: true);
        _bron.Geef(Md("1.1", "Nieuwe tekst."));

        var resultaat = await _service.ImporteerAsync(toepassen: true);

        var wijziging = Assert.Single(resultaat.Diff.Gewijzigd);
        Assert.Equal("K-1.1", wijziging.Ref);
        Assert.Equal(new VeldWijziging(nameof(Minimumdoel.Omschrijving), "Oude tekst.", "Nieuwe tekst."), Assert.Single(wijziging.Velden));
        Assert.True(resultaat.Diff.VereistReview);
        _context.ChangeTracker.Clear();
        Assert.Equal("Nieuwe tekst.", (await _context.Minimumdoelen.SingleAsync()).Omschrijving);
    }

    [Fact]
    public async Task Een_wijziging_in_het_voorbeeld_raakt_de_databank_niet()
    {
        _bron.Geef(Md("1.1", "Oude tekst."));
        await _service.ImporteerAsync(toepassen: true);
        _bron.Geef(Md("1.1", "Nieuwe tekst."));

        await _service.ImporteerAsync(toepassen: false);

        _context.ChangeTracker.Clear();
        Assert.Equal("Oude tekst.", (await _context.Minimumdoelen.SingleAsync()).Omschrijving);
    }

    [Fact]
    public async Task Een_minimumdoel_dat_uit_de_bron_verdwijnt_blijft_staan_en_wordt_gemeld()
    {
        _bron.Geef(Md("1.1"), Md("1.2"), Md("1.3"));
        await _service.ImporteerAsync(toepassen: true);
        _bron.Geef(Md("1.1"));

        var resultaat = await _service.ImporteerAsync(toepassen: true);

        Assert.Equal(["K-1.2", "K-1.3"], resultaat.Diff.Verdwenen);
        Assert.True(resultaat.Diff.VereistReview);
        Assert.Equal([MinimumdoelImportService.VerdwenenMelding(2)], resultaat.Diff.Opmerkingen);
        Assert.Equal(3, await _context.Minimumdoelen.CountAsync());
    }

    /// <summary>An empty answer is a skip, not the decree shrinking to nothing (Art. III.4).</summary>
    [Fact]
    public async Task Een_lege_bron_wordt_overgeslagen_en_wijzigt_niets()
    {
        _bron.Geef(Md("1.1"));
        await _service.ImporteerAsync(toepassen: true);
        var probleem = new MinimumdoelBronProbleem("K-9", "title is empty, so there is no decreed text to import.");
        _bron.Geef([], [probleem]);

        var resultaat = await _service.ImporteerAsync(toepassen: true);

        Assert.True(resultaat.Diff.Overgeslagen);
        // Every stored minimumdoel went unread, so a skip is not an empty import (antagonist, E1-12 round 3).
        Assert.False(resultaat.Diff.IsLeeg);
        Assert.False(resultaat.Toegepast);
        Assert.Empty(resultaat.Diff.Verdwenen);
        Assert.Equal([probleem], resultaat.Problemen);
        Assert.Equal(
            ["De Op.stap-bron gaf geen bruikbare minimumdoelen terug. Er is niets ingelezen of gewijzigd."],
            resultaat.Diff.Opmerkingen);
        Assert.Equal(1, await _context.Minimumdoelen.CountAsync());
    }

    [Fact]
    public async Task De_problemen_van_de_bron_komen_mee_in_het_resultaat()
    {
        var probleem = new MinimumdoelBronProbleem("6/4.1.1", "uniqueCode '6/4.1.1' is not K-, 4- or 6- followed by a dotted number.");
        _bron.Geef([Md("1.1")], [probleem]);

        var resultaat = await _service.ImporteerAsync(toepassen: true);

        Assert.Equal([probleem], resultaat.Problemen);
        Assert.Equal(["K-1.1"], resultaat.Diff.Toegevoegd);
    }

    [Fact]
    public async Task Een_onleesbare_bron_schrijft_niets()
    {
        _bron.Faal(new OpstapBronFout("GET x answered 503 Service Unavailable."));

        await Assert.ThrowsAsync<OpstapBronFout>(() => _service.ImporteerAsync(toepassen: true));

        Assert.Empty(await _context.Minimumdoelen.ToListAsync());
    }

    /// <summary>Server-composed Dutch: the guard reads the value, because no catalogue keeps it in step (CLAUDE.md).</summary>
    [Fact]
    public void De_melding_over_verdwenen_minimumdoelen_is_verbogen()
    {
        Assert.Equal(
            "1 minimumdoel staat niet meer in de Op.stap-bron. Het blijft in de toepassing staan en wordt niet verwijderd.",
            MinimumdoelImportService.VerdwenenMelding(1));
        Assert.Equal(
            "4 minimumdoelen staan niet meer in de Op.stap-bron. Ze blijven in de toepassing staan en worden niet verwijderd.",
            MinimumdoelImportService.VerdwenenMelding(4));
    }

    /// <summary>
    /// A ref the source still names but whose row is refused this time is not "no longer in the source" (antagonist,
    /// E1-12 round 1): it gets its own bucket, and its previous text stays.
    /// </summary>
    [Fact]
    public async Task Een_geweigerde_rij_van_een_bestaand_minimumdoel_is_niet_verdwenen()
    {
        _bron.Geef(Md("1.1"), Md("1.2", "De vorige tekst."));
        await _service.ImporteerAsync(toepassen: true);
        var probleem = new MinimumdoelBronProbleem("K-1.2", "contains markup the mapping cannot convert faithfully (<sub>).");
        _bron.Geef([Md("1.1")], [probleem]);

        var resultaat = await _service.ImporteerAsync(toepassen: true);

        Assert.Empty(resultaat.Diff.Verdwenen);
        Assert.Equal(["K-1.2"], resultaat.Diff.NietIngelezen);
        Assert.True(resultaat.Diff.VereistReview);
        Assert.False(resultaat.Diff.IsLeeg);
        Assert.Equal([MinimumdoelImportService.NietIngelezenMelding(1)], resultaat.Diff.Opmerkingen);
        _context.ChangeTracker.Clear();
        Assert.Equal("De vorige tekst.", (await _context.Minimumdoelen.SingleAsync(m => m.Ref == "K-1.2")).Omschrijving);
    }

    [Fact]
    public void De_melding_over_niet_ingelezen_minimumdoelen_is_verbogen()
    {
        Assert.Equal(
            "1 minimumdoel staat nog in de Op.stap-bron maar werd niet ingelezen. De vorige tekst blijft staan.",
            MinimumdoelImportService.NietIngelezenMelding(1));
        Assert.Equal(
            "3 minimumdoelen staan nog in de Op.stap-bron maar werden niet ingelezen. De vorige teksten blijven staan.",
            MinimumdoelImportService.NietIngelezenMelding(3));
    }

    /// <summary>
    /// The flag ADR-0032's consequences asked for (E1-21): a minimumdoel the source no longer names is kept, and marked;
    /// when it returns, the mark goes and the row is otherwise unchanged.
    /// </summary>
    [Fact]
    public async Task Een_verdwenen_minimumdoel_wordt_gemarkeerd_en_bij_terugkeer_weer_vrijgegeven()
    {
        _bron.Geef(Md("1.1"), Md("1.2"));
        await _service.ImporteerAsync(toepassen: true);
        _bron.Geef(Md("1.1"));
        await _service.ImporteerAsync(toepassen: true);
        _context.ChangeTracker.Clear();
        Assert.True((await _context.Minimumdoelen.SingleAsync(m => m.Ref == "K-1.2")).NietMeerInOpstap);
        Assert.False((await _context.Minimumdoelen.SingleAsync(m => m.Ref == "K-1.1")).NietMeerInOpstap);

        _bron.Geef(Md("1.1"), Md("1.2"));
        var resultaat = await _service.ImporteerAsync(toepassen: true);

        // Since E1-22 a return is its own bucket: clearing the flag is a write, so it is reported as one.
        Assert.Equal(["K-1.1"], resultaat.Diff.Ongewijzigd);
        Assert.Equal(["K-1.2"], resultaat.Diff.Teruggekeerd);
        Assert.True(resultaat.Diff.SchrijftIets);
        Assert.False(resultaat.Diff.IsLeeg);
        Assert.Equal([MinimumdoelImportService.TeruggekeerdMelding(1)], resultaat.Diff.Opmerkingen);
        _context.ChangeTracker.Clear();
        Assert.False((await _context.Minimumdoelen.SingleAsync(m => m.Ref == "K-1.2")).NietMeerInOpstap);
    }

    /// <summary>
    /// E1-22, antagonist round 1 MAJOR: once a vanished minimumdoel is flagged, a later read of the same source reports it
    /// as already gone, writes nothing, asks for no review and says nothing, so no screen offers an apply that would only
    /// re-set a flag that is set.
    /// </summary>
    [Fact]
    public async Task Een_al_gemarkeerd_minimumdoel_wordt_niet_opnieuw_als_verdwenen_gemeld_en_er_valt_niets_te_schrijven()
    {
        _bron.Geef(Md("1.1"), Md("1.2"));
        await _service.ImporteerAsync(toepassen: true);
        _bron.Geef(Md("1.1"));
        var eerste = await _service.ImporteerAsync(toepassen: true);

        var herhaling = await _service.ImporteerAsync(toepassen: false);

        Assert.Equal(["K-1.2"], eerste.Diff.Verdwenen);
        Assert.True(eerste.Diff.SchrijftIets);
        Assert.Empty(herhaling.Diff.Verdwenen);
        Assert.Equal(["K-1.2"], herhaling.Diff.EerderVerdwenen);
        Assert.False(herhaling.Diff.SchrijftIets);
        Assert.True(herhaling.Diff.IsLeeg);
        Assert.False(herhaling.Diff.VereistReview);
        Assert.Empty(herhaling.Diff.Opmerkingen);
    }

    [Fact]
    public void De_melding_over_teruggekeerde_minimumdoelen_is_verbogen()
    {
        Assert.Equal(
            "1 minimumdoel staat weer in de Op.stap-bron en wordt niet langer als vervallen gemarkeerd.",
            MinimumdoelImportService.TeruggekeerdMelding(1));
        Assert.Equal(
            "2 minimumdoelen staan weer in de Op.stap-bron en worden niet langer als vervallen gemarkeerd.",
            MinimumdoelImportService.TeruggekeerdMelding(2));
    }

    [Fact]
    public async Task Het_voorbeeld_markeert_niets()
    {
        _bron.Geef(Md("1.1"), Md("1.2"));
        await _service.ImporteerAsync(toepassen: true);
        _bron.Geef(Md("1.1"));

        await _service.ImporteerAsync(toepassen: false);

        _context.ChangeTracker.Clear();
        Assert.False(await _context.Minimumdoelen.AnyAsync(m => m.NietMeerInOpstap));
    }

    /// <summary>A refused row is still in the source, so it is not marked as gone.</summary>
    [Fact]
    public async Task Een_geweigerde_rij_wordt_niet_gemarkeerd()
    {
        _bron.Geef(Md("1.1"), Md("1.2"));
        await _service.ImporteerAsync(toepassen: true);
        _bron.Geef([Md("1.1")], [new MinimumdoelBronProbleem("K-1.2", "contains markup the mapping cannot convert faithfully (<sub>).")]);

        await _service.ImporteerAsync(toepassen: true);

        _context.ChangeTracker.Clear();
        Assert.False((await _context.Minimumdoelen.SingleAsync(m => m.Ref == "K-1.2")).NietMeerInOpstap);
    }

    private sealed class VasteBron : IMinimumdoelBron
    {
        private Func<MinimumdoelBronResultaat> _antwoord = () => new MinimumdoelBronResultaat([], []);

        public void Geef(params Minimumdoel[] doelen) => Geef(doelen, []);

        // A fresh entity per call, as the real source returns: the service must not depend on reference identity.
        public void Geef(IReadOnlyList<Minimumdoel> doelen, IReadOnlyList<MinimumdoelBronProbleem> problemen) =>
            _antwoord = () => new MinimumdoelBronResultaat(
                doelen.Select(d => new Minimumdoel(d.Ref, d.Leeftijd, d.Nr, d.Omschrijving)).ToList(),
                problemen);

        public void Faal(OpstapBronFout fout) => _antwoord = () => throw fout;

        public Task<MinimumdoelBronResultaat> HaalOpAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(_antwoord());
    }
}
