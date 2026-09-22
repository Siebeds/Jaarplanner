using Jaarplanner.Application.Kat;
using Jaarplanner.Domain.Kat;

namespace Jaarplanner.UnitTests.Kat;

/// <summary>
/// The cat's round (TB-057, ADR-0059 D1 to D3). Every test here runs without a database and <b>without an AI
/// client</b>: detection is deterministic, which is what K1 rules and what the ticket asks to be proven.
/// </summary>
public sealed class SignaalrondeTests
{
    private static readonly Guid Klas = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Juf = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid Meester = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly DateOnly Vandaag = new(2026, 9, 22);

    private static Katklas EenKlas(params Guid[] leerkrachten) => new(Klas, ["K3"], leerkrachten);

    [Fact]
    public async Task Een_klas_zonder_aanleiding_levert_geen_signaal_op()
    {
        var opslag = new NepSignaalopslag();
        var ronde = Katbouw.Ronde(new NepKlassenlezer(EenKlas(Juf)), opslag, [new NepDetector()]);

        var verslag = await ronde.VoerUitAsync(Vandaag, CancellationToken.None);

        Assert.Empty(opslag.Alles);
        Assert.Equal(0, verslag.Nieuw);
        Assert.Equal(0, opslag.Schrijfbeurten);
    }

    [Fact]
    public async Task Dezelfde_toestand_twee_keer_verwerkt_levert_geen_dubbel_signaal_op()
    {
        var opslag = new NepSignaalopslag();
        var detector = new NepDetector(Katbouw.Vondst(Klas, "MD-01", Juf));
        var ronde = Katbouw.Ronde(new NepKlassenlezer(EenKlas(Juf)), opslag, [detector]);

        await ronde.VoerUitAsync(Vandaag, CancellationToken.None);
        var tweede = await ronde.VoerUitAsync(Vandaag, CancellationToken.None);

        Assert.Single(opslag.Alles);
        Assert.Equal(0, tweede.Nieuw);

        // The second round wrote nothing at all: an unchanged state costs no transaction (D1).
        Assert.Equal(1, opslag.Schrijfbeurten);
    }

    [Fact]
    public async Task Een_signaal_waarvan_de_reden_verdwijnt_verdwijnt_bij_de_volgende_tik()
    {
        var opslag = new NepSignaalopslag();
        var detector = new NepDetector(Katbouw.Vondst(Klas, "MD-01", Juf));
        var ronde = Katbouw.Ronde(new NepKlassenlezer(EenKlas(Juf)), opslag, [detector]);
        await ronde.VoerUitAsync(Vandaag, CancellationToken.None);

        detector.Zet();
        var verslag = await ronde.VoerUitAsync(Vandaag, CancellationToken.None);

        Assert.Empty(opslag.Alles);
        Assert.Equal(1, verslag.Verdwenen);
    }

    [Fact]
    public async Task Elke_leerkracht_van_de_klas_krijgt_een_eigen_rij()
    {
        var opslag = new NepSignaalopslag();
        var ronde = Katbouw.Ronde(
            new NepKlassenlezer(EenKlas(Juf, Meester)),
            opslag,
            [new NepDetector(Katbouw.Vondst(Klas, "MD-01", Juf, Meester))]);

        await ronde.VoerUitAsync(Vandaag, CancellationToken.None);

        Assert.Equal(2, opslag.Alles.Count);
        Assert.Equal([Juf, Meester], opslag.Alles.Select(s => s.OntvangerId).Order().ToList());
    }

    [Fact]
    public async Task Een_ontvanger_die_de_klas_niet_geeft_wordt_geweigerd()
    {
        var vreemde = Guid.Parse("44444444-4444-4444-4444-444444444444");
        var opslag = new NepSignaalopslag();
        var ronde = Katbouw.Ronde(
            new NepKlassenlezer(EenKlas(Juf)),
            opslag,
            [new NepDetector(Katbouw.Vondst(Klas, "MD-01", Juf, vreemde))]);

        await ronde.VoerUitAsync(Vandaag, CancellationToken.None);

        // A detector narrows the recipients, it never widens them (D5): the stranger is dropped before anything is
        // stored, because a stored row is what the deurmat trusts.
        Assert.Single(opslag.Alles);
        Assert.Equal(Juf, opslag.Alles[0].OntvangerId);
    }

    [Fact]
    public async Task Een_taak_loopt_eenmaal_per_vondst_en_niet_bij_elke_tik()
    {
        var opslag = new NepSignaalopslag();
        var taak = new NepTaak(Signaalsoort.MinimumdoelInGevaar);
        var ronde = Katbouw.Ronde(
            new NepKlassenlezer(EenKlas(Juf)),
            opslag,
            [new NepDetector(Katbouw.Vondst(Klas, "MD-01", Juf))],
            [taak]);

        await ronde.VoerUitAsync(Vandaag, CancellationToken.None);
        await ronde.VoerUitAsync(Vandaag, CancellationToken.None);

        // Whatever the task costs (the AI, once FB-070 uses this seam), it costs it once per thing noticed.
        Assert.Single(taak.Uitgevoerd);
    }

    [Fact]
    public async Task Een_taak_van_een_andere_soort_wordt_niet_aangesproken()
    {
        var opslag = new NepSignaalopslag();
        var taak = new NepTaak(Signaalsoort.AanbodGat);
        var ronde = Katbouw.Ronde(
            new NepKlassenlezer(EenKlas(Juf)),
            opslag,
            [new NepDetector(Katbouw.Vondst(Klas, "MD-01", Juf))],
            [taak]);

        await ronde.VoerUitAsync(Vandaag, CancellationToken.None);

        Assert.Empty(taak.Uitgevoerd);
    }

    [Fact]
    public async Task Een_taak_die_faalt_laat_het_signaal_staan()
    {
        var opslag = new NepSignaalopslag();
        var ronde = Katbouw.Ronde(
            new NepKlassenlezer(EenKlas(Juf)),
            opslag,
            [new NepDetector(Katbouw.Vondst(Klas, "MD-01", Juf))],
            [new NepTaak(Signaalsoort.MinimumdoelInGevaar, faalt: true)]);

        var verslag = await ronde.VoerUitAsync(Vandaag, CancellationToken.None);

        Assert.Single(opslag.Alles);
        Assert.Single(verslag.Taakfouten);
    }

    [Fact]
    public async Task Een_klas_waarvan_de_detectie_stukloopt_kost_de_andere_klassen_hun_ronde_niet()
    {
        var tweede = Guid.Parse("55555555-5555-5555-5555-555555555555");
        var opslag = new NepSignaalopslag();
        var ronde = Katbouw.Ronde(
            new NepKlassenlezer(EenKlas(Juf), new Katklas(tweede, ["K2"], [Meester])),
            opslag,
            [new HalfStukkeDetector(Klas)]);

        var verslag = await ronde.VoerUitAsync(Vandaag, CancellationToken.None);

        Assert.Single(verslag.Mislukkingen);
        Assert.Equal(Klas, verslag.Mislukkingen[0].KlasId);
        Assert.Single(opslag.Alles);
        Assert.Equal(tweede, opslag.Alles[0].KlasId);
    }

    [Fact]
    public async Task De_dekking_wordt_hoogstens_een_keer_per_klas_berekend()
    {
        var berekeningen = 0;
        var opslag = new NepSignaalopslag();
        var ronde = Katbouw.Ronde(
            new NepKlassenlezer(EenKlas(Juf)),
            opslag,
            [new DekkingvragendeDetector(), new DekkingvragendeDetector()],
            dekking: (_, _) =>
            {
                berekeningen++;

                // What the dekking says does not matter here; that it is asked for once does.
                return Task.FromResult<Jaarplanner.Application.Dekking.DekkingWeergave>(null!);
            });

        await ronde.VoerUitAsync(Vandaag, CancellationToken.None);

        // The most expensive computation in the system (Art. V.6) is shared by every detector of one klas.
        Assert.Equal(1, berekeningen);
    }

    /// <summary>Throws for one klas and finds something for every other.</summary>
    private sealed class HalfStukkeDetector(Guid stuk) : ISignaaldetector
    {
        public Task<IReadOnlyList<Signaalvondst>> DetecteerAsync(Katcontext context, CancellationToken ct) =>
            context.KlasId == stuk
                ? throw new InvalidOperationException("This klas is broken on purpose.")
                : Task.FromResult<IReadOnlyList<Signaalvondst>>(
                    [Katbouw.Vondst(context.KlasId, "MD-02", context.OntvangerIds[0])]);
    }

    /// <summary>Asks for the dekking and finds nothing, so only the sharing is measured.</summary>
    private sealed class DekkingvragendeDetector : ISignaaldetector
    {
        public async Task<IReadOnlyList<Signaalvondst>> DetecteerAsync(Katcontext context, CancellationToken ct)
        {
            await context.HaalDekkingAsync(ct);
            return [];
        }
    }
}
