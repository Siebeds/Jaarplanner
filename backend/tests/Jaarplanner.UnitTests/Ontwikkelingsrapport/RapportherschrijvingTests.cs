using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Ontwikkelingsrapport;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Ontwikkelingsrapport;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Infrastructure.Ontwikkelingsrapport;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Ontwikkelingsrapport;

/// <summary>
/// An AI rewrite of a rapporttekst end to end through <see cref="OntwikkelingsrapportService"/> (FB-004, R21 to R25,
/// D13, D14), over the in-memory provider and a faked <see cref="IAiClient"/> (Art. IV.6): what leaves the server, what
/// comes back, and what is stored by each of the three decisions.
/// <para>All names here are made up.</para>
/// </summary>
public sealed class RapportherschrijvingTests
{
    private const string EigenTekst = "Roos tekende deze periode vaak een roos en speelde graag met Staf.";

    private readonly DbContextOptions<AppDbContext> _options;
    private readonly ValsAiClient _ai = new();
    private readonly HerschrijfZegel _zegel;
    private readonly Guid _roos;
    private readonly Guid _rapportdoel;

    public RapportherschrijvingTests()
    {
        _options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"herschrijving_{Guid.NewGuid():N}")
            .Options;
        _zegel = new HerschrijfZegel(new EphemeralDataProtectionProvider(), TimeProvider.System);

        using var seed = new AppDbContext(_options);
        var schooljaar = new Schooljaar("2026-2027", new DateOnly(2026, 8, 31), new DateOnly(2027, 6, 30));
        var klas = schooljaar.VoegKlasToe("K3 groen", "K3");
        seed.Schooljaren.Add(schooljaar);

        var roos = new Leerling(klas.Id, "Roos", "Proefmans");
        seed.Leerlingen.Add(roos);
        seed.Leerlingen.Add(new Leerling(klas.Id, "Staf", "Voorbeeld"));

        var rapportdoel = new Rapportdoel("Ik speel samen", 1, []);
        seed.Rapportdoelen.Add(rapportdoel);
        seed.SaveChanges();

        _roos = roos.Id;
        _rapportdoel = rapportdoel.Id;
    }

    // --- What leaves the server (R21, R25, D14). ---

    [Fact]
    public async Task De_prompt_draagt_geen_enkele_naam_van_de_klas()
    {
        _ai.Antwoord = "{\"tekst\": \"#NAAM1# tekende vaak een roos en speelde met #NAAM2#.\"}";

        await Dienst().StelHerschrijvingVoorAsync(_roos, 1, _rapportdoel, EigenTekst);

        var prompt = _ai.LaatsteVerzoek!.UserPrompt;
        foreach (var naam in new[] { "Roos", "Proefmans", "Staf", "Voorbeeld" })
        {
            Assert.DoesNotContain(naam, prompt, StringComparison.Ordinal);
        }

        // The ordinary word in lower case did stay: it is a word, not the child (D14).
        Assert.Contains("een roos", prompt, StringComparison.Ordinal);
        Assert.Contains("#NAAM1#", prompt, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Het_voorstel_komt_terug_met_de_namen_erin()
    {
        _ai.Antwoord = "{\"tekst\": \"#NAAM1# tekende vaak een roos en speelde graag samen met #NAAM2#.\"}";

        var resultaat = await Dienst().StelHerschrijvingVoorAsync(_roos, 1, _rapportdoel, EigenTekst);

        Assert.True(resultaat.IsGeslaagd);
        Assert.Equal("Roos tekende vaak een roos en speelde graag samen met Staf.", resultaat.Voorstel);
        Assert.NotNull(resultaat.Zegel);
    }

    [Fact]
    public async Task Een_voorstel_bewaart_niets()
    {
        _ai.Antwoord = "{\"tekst\": \"#NAAM1# tekende vaak een roos en speelde met #NAAM2#.\"}";

        await Dienst().StelHerschrijvingVoorAsync(_roos, 1, _rapportdoel, EigenTekst);

        // Not the proposal, and not even an empty report to hang it on (Art. IV.2 as amended).
        await using var db = new AppDbContext(_options);
        Assert.Empty(db.Ontwikkelingsrapporten);
    }

    // --- An answer that may not be shown (Art. IV.5). ---

    [Fact]
    public async Task Een_antwoord_dat_een_naam_laat_vallen_wordt_geweigerd()
    {
        _ai.Antwoord = "{\"tekst\": \"#NAAM1# tekende vaak en speelde met een vriendje.\"}";

        var resultaat = await Dienst().StelHerschrijvingVoorAsync(_roos, 1, _rapportdoel, EigenTekst);

        Assert.False(resultaat.IsGeslaagd);
        Assert.Equal(Herschrijfmislukking.OnbruikbaarAntwoord, resultaat.Mislukking);
        Assert.Null(resultaat.Voorstel);
    }

    [Fact]
    public async Task Een_antwoord_met_een_verzonnen_plaatshouder_wordt_geweigerd()
    {
        _ai.Antwoord = "{\"tekst\": \"#NAAM1# speelde met #NAAM2# en #NAAM3#.\"}";

        var resultaat = await Dienst().StelHerschrijvingVoorAsync(_roos, 1, _rapportdoel, EigenTekst);

        Assert.False(resultaat.IsGeslaagd);
        Assert.Equal(Herschrijfmislukking.OnbruikbaarAntwoord, resultaat.Mislukking);
    }

    [Fact]
    public async Task Een_antwoord_buiten_het_contract_wordt_geweigerd()
    {
        _ai.Antwoord = "sorry, dat kan ik niet";

        var resultaat = await Dienst().StelHerschrijvingVoorAsync(_roos, 1, _rapportdoel, EigenTekst);

        Assert.False(resultaat.IsGeslaagd);
        Assert.Equal(Herschrijfmislukking.OnbruikbaarAntwoord, resultaat.Mislukking);
    }

    [Fact]
    public async Task Een_AI_die_niet_antwoordt_geeft_geen_fout_maar_een_mislukking()
    {
        // This is the case on any environment with no AI settings: the client throws, and the teacher must get a
        // sentence rather than a 500.
        _ai.Fout = new InvalidOperationException("Azure AI Foundry is not configured.");

        var resultaat = await Dienst().StelHerschrijvingVoorAsync(_roos, 1, _rapportdoel, EigenTekst);

        Assert.False(resultaat.IsGeslaagd);
        Assert.Equal(Herschrijfmislukking.AiOnbereikbaar, resultaat.Mislukking);
        // The diagnostic names the type and nothing of the request or the answer (ADR-0035 section 3.8).
        Assert.Equal("The AI client failed with InvalidOperationException.", resultaat.Fout);
    }

    [Fact]
    public async Task Zonder_eigen_tekst_herschrijft_de_AI_niets()
    {
        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Dienst().StelHerschrijvingVoorAsync(_roos, 1, _rapportdoel, "   "));

        Assert.Equal(OntwikkelingsrapportService.GeenTekstOmTeHerschrijven, fout.Message);
        Assert.Null(_ai.LaatsteVerzoek);
    }

    // --- The three decisions (R23, D13). ---

    [Fact]
    public async Task Onveranderd_aanvaard_wordt_bewaard_als_aanvaard()
    {
        var (voorstel, zegel) = await Voorstel();

        var bewaard = await Dienst().BewaarBeoordelingAsync(
            _roos,
            1,
            _rapportdoel,
            new BeoordelingInvoer(null, voorstel, zegel));

        Assert.Equal(voorstel, bewaard.Tekst);
        Assert.Equal(Tekststatus.Aanvaard, bewaard.TekstStatus);
    }

    [Fact]
    public async Task Eerst_aangepast_wordt_bewaard_als_manueel()
    {
        var (voorstel, zegel) = await Voorstel();

        var bewaard = await Dienst().BewaarBeoordelingAsync(
            _roos,
            1,
            _rapportdoel,
            new BeoordelingInvoer(null, voorstel + " Zij deelt ook graag.", zegel));

        Assert.Equal(Tekststatus.Manueel, bewaard.TekstStatus);
    }

    [Fact]
    public async Task Een_verzonnen_zegel_maakt_een_tekst_niet_aanvaard()
    {
        var bewaard = await Dienst().BewaarBeoordelingAsync(
            _roos,
            1,
            _rapportdoel,
            new BeoordelingInvoer(null, "Een tekst die de browser aanvaard noemt.", "een-verzonnen-zegel"));

        Assert.Equal(Tekststatus.Manueel, bewaard.TekstStatus);
    }

    [Fact]
    public async Task Weigeren_laat_de_tekst_staan_en_bewaart_het_voorstel_niet()
    {
        var dienst = Dienst();
        await dienst.BewaarBeoordelingAsync(_roos, 1, _rapportdoel, new BeoordelingInvoer(null, EigenTekst));
        var (voorstel, zegel) = await Voorstel();

        await dienst.WeigerHerschrijvingAsync(_roos, 1, _rapportdoel, zegel);

        await using var db = new AppDbContext(_options);
        var rij = await db.Ontwikkelingsrapporten
            .Include(r => r.Beoordelingen)
            .SelectMany(r => r.Beoordelingen)
            .SingleAsync();

        Assert.Equal(EigenTekst, rij.Tekst);
        Assert.Equal(Tekststatus.Manueel, rij.TekstStatus);
        Assert.True(rij.HerschrijvingGeweigerd);
        // The rejected text is nowhere: not in the row, and there is nothing else it could be in.
        Assert.DoesNotContain(voorstel, rij.Tekst!, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Een_weigering_zonder_geldig_zegel_wordt_afgewezen()
    {
        var dienst = Dienst();
        await dienst.BewaarBeoordelingAsync(_roos, 1, _rapportdoel, new BeoordelingInvoer(null, EigenTekst));

        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => dienst.WeigerHerschrijvingAsync(_roos, 1, _rapportdoel, "een-verzonnen-zegel"));

        Assert.Equal(OntwikkelingsrapportService.ZegelKloptNiet, fout.Message);
    }

    [Fact]
    public async Task Een_weigering_maakt_geen_leeg_rapport_aan()
    {
        var (_, zegel) = await Voorstel();

        await Dienst().WeigerHerschrijvingAsync(_roos, 1, _rapportdoel, zegel);

        await using var db = new AppDbContext(_options);
        Assert.Empty(db.Ontwikkelingsrapporten);
    }

    [Fact]
    public async Task Een_tekst_die_verandert_wist_het_weigermerk()
    {
        var dienst = Dienst();
        await dienst.BewaarBeoordelingAsync(_roos, 1, _rapportdoel, new BeoordelingInvoer(null, EigenTekst));
        var (_, zegel) = await Voorstel();
        await dienst.WeigerHerschrijvingAsync(_roos, 1, _rapportdoel, zegel);

        await dienst.BewaarBeoordelingAsync(_roos, 1, _rapportdoel, new BeoordelingInvoer(null, "Iets heel anders."));

        await using var db = new AppDbContext(_options);
        var rij = await db.Ontwikkelingsrapporten
            .Include(r => r.Beoordelingen)
            .SelectMany(r => r.Beoordelingen)
            .SingleAsync();
        Assert.False(rij.HerschrijvingGeweigerd);
    }

    // --- The algemeen besluit takes the same road (R22). ---

    [Fact]
    public async Task Het_besluit_wordt_op_dezelfde_manier_herschreven_en_aanvaard()
    {
        _ai.Antwoord = "{\"tekst\": \"#NAAM1# sluit het jaar sterk af.\"}";
        var dienst = Dienst();

        var voorstel = await dienst.StelHerschrijvingVoorAsync(_roos, 1, null, "Roos sluit het jaar sterk af.");
        Assert.True(voorstel.IsGeslaagd);
        Assert.Equal("Roos sluit het jaar sterk af.", voorstel.Voorstel);

        var bewaard = await dienst.BewaarBesluitAsync(_roos, 1, new BesluitInvoer(voorstel.Voorstel, voorstel.Zegel));
        Assert.Equal(Tekststatus.Aanvaard, bewaard.BesluitStatus);
    }

    [Fact]
    public async Task Het_zegel_van_een_rapportdoel_aanvaardt_geen_besluit()
    {
        var (voorstel, zegel) = await Voorstel();

        var bewaard = await Dienst().BewaarBesluitAsync(_roos, 1, new BesluitInvoer(voorstel, zegel));

        Assert.Equal(Tekststatus.Manueel, bewaard.BesluitStatus);
    }

    private OntwikkelingsrapportService Dienst()
    {
        var db = new AppDbContext(_options);
        return new OntwikkelingsrapportService(db, new RapportsetService(db), _ai, _zegel);
    }

    /// <summary>One proposal for the rapportdoel, with its seal.</summary>
    private async Task<(string Voorstel, string Zegel)> Voorstel()
    {
        _ai.Antwoord = "{\"tekst\": \"#NAAM1# tekende vaak een roos en speelde graag samen met #NAAM2#.\"}";
        var resultaat = await Dienst().StelHerschrijvingVoorAsync(_roos, 1, _rapportdoel, EigenTekst);
        Assert.True(resultaat.IsGeslaagd);
        return (resultaat.Voorstel!, resultaat.Zegel!);
    }

    /// <summary>A model that answers what the test tells it to, or fails the way the real client would.</summary>
    private sealed class ValsAiClient : IAiClient
    {
        public string Antwoord { get; set; } = "{\"tekst\": \"Een herschreven tekst.\"}";

        public Exception? Fout { get; set; }

        public AiRequest? LaatsteVerzoek { get; private set; }

        public Task<AiCompletion> CompleteAsync(AiRequest request, CancellationToken cancellationToken = default)
        {
            LaatsteVerzoek = request;
            return Fout is not null
                ? Task.FromException<AiCompletion>(Fout)
                : Task.FromResult(new AiCompletion { Content = Antwoord });
        }
    }
}
