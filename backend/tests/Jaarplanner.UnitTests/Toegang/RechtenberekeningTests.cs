using Jaarplanner.Application.Toegang;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Toegang;

namespace Jaarplanner.UnitTests.Toegang;

/// <summary>
/// The rights a gebruiker holds on a given day (E6-02, Art. VI.1, ADR-0030 §3 column definitions): which schooljaar
/// counts (R20), the stated jaarfase and nothing else (R22, I12), no end date for the klas's planning (I21), no
/// klastoewijzing needed for a hoofdleerkracht (I20), and the union of all of them.
/// </summary>
public sealed class RechtenberekeningTests
{
    private static readonly Guid An = Guid.Parse("a0000000-0000-4000-8000-000000000001");
    private static readonly DateOnly Vandaag = new(2026, 9, 14);

    private static readonly DateOnly LopendEind = new(2027, 6, 30);
    private static readonly DateOnly AfgelopenEind = new(2026, 6, 30);
    private static readonly DateOnly VolgendEind = new(2028, 6, 30);

    private static Rechten Bereken(
        IEnumerable<KlastoewijzingFeit>? toewijzingen = null,
        IEnumerable<AanstellingFeit>? aanstellingen = null,
        DateOnly? vandaag = null,
        bool isDirectie = false,
        bool themabeheer = false) =>
        Rechtenberekening.Bereken(An, isDirectie, themabeheer, toewijzingen ?? [], aanstellingen ?? [], vandaag ?? Vandaag);

    // --- HL: the appointment, while its schooljaar has not ended (R5, R20, I20). ---

    [Fact]
    public void Een_aanstelling_in_het_lopende_schooljaar_telt()
    {
        var rechten = Bereken(aanstellingen: [new AanstellingFeit("K3", LopendEind)]);

        Assert.Equal(["K3"], rechten.HoofdleerkrachtLeeftijden);
        Assert.True(rechten.IsHoofdleerkrachtVan("K3"));
        Assert.False(rechten.IsHoofdleerkrachtVan("K2"));
    }

    [Fact]
    public void Een_aanstelling_in_een_schooljaar_dat_nog_niet_begon_telt_al()
    {
        // R20: a hoofdleerkracht prepares next year in June.
        var rechten = Bereken(aanstellingen: [new AanstellingFeit("L2", VolgendEind)]);

        Assert.Equal(["L2"], rechten.HoofdleerkrachtLeeftijden);
    }

    [Fact]
    public void Een_aanstelling_in_een_afgelopen_schooljaar_telt_niet_meer()
    {
        var rechten = Bereken(aanstellingen: [new AanstellingFeit("K3", AfgelopenEind)]);

        Assert.Empty(rechten.HoofdleerkrachtLeeftijden);
    }

    [Fact]
    public void Op_de_laatste_schooldag_telt_de_aanstelling_nog_en_de_dag_erna_niet()
    {
        AanstellingFeit[] aanstelling = [new AanstellingFeit("K3", LopendEind)];

        Assert.Equal(["K3"], Bereken(aanstellingen: aanstelling, vandaag: LopendEind).HoofdleerkrachtLeeftijden);
        Assert.Empty(Bereken(aanstellingen: aanstelling, vandaag: LopendEind.AddDays(1)).HoofdleerkrachtLeeftijden);
    }

    [Fact]
    public void Een_hoofdleerkracht_zonder_klastoewijzing_heeft_toch_het_recht()
    {
        // I20: the appointment alone gives the right.
        var rechten = Bereken(aanstellingen: [new AanstellingFeit("K3", LopendEind)]);

        Assert.Equal(["K3"], rechten.HoofdleerkrachtLeeftijden);
        Assert.Empty(rechten.LeerkrachtLeeftijden);
        Assert.Empty(rechten.EigenKlasIds);
    }

    // --- LK leeftijd: the klas's STATED jaarfase, while its schooljaar has not ended (R17, R20, R22, I12). ---

    [Fact]
    public void Een_klastoewijzing_geeft_de_leeftijd_van_de_klas_zolang_het_schooljaar_loopt()
    {
        var klas = Guid.NewGuid();

        var rechten = Bereken(toewijzingen: [new KlastoewijzingFeit(klas, "K3", LopendEind)]);

        Assert.Equal(["K3"], rechten.LeerkrachtLeeftijden);
        Assert.Equal([klas], rechten.EigenKlasIds);
    }

    [Fact]
    public void Een_klas_van_een_schooljaar_dat_nog_niet_begon_geeft_de_leeftijd_al()
    {
        var rechten = Bereken(toewijzingen: [new KlastoewijzingFeit(Guid.NewGuid(), "L4", VolgendEind)]);

        Assert.Equal(["L4"], rechten.LeerkrachtLeeftijden);
    }

    [Fact]
    public void Een_klas_van_een_afgelopen_schooljaar_geeft_geen_leeftijd_meer_maar_blijft_de_eigen_klas()
    {
        // R20 for the shared content, I21 for the klas's own planning: no end date there.
        var klas = Guid.NewGuid();

        var rechten = Bereken(toewijzingen: [new KlastoewijzingFeit(klas, "K3", AfgelopenEind)]);

        Assert.Empty(rechten.LeerkrachtLeeftijden);
        Assert.Equal([klas], rechten.EigenKlasIds);
        Assert.True(rechten.IsLeerkrachtVanKlas(klas));
    }

    [Fact]
    public void Op_de_laatste_schooldag_telt_de_klastoewijzing_nog_voor_de_leeftijd_en_de_dag_erna_niet()
    {
        KlastoewijzingFeit[] toewijzing = [new KlastoewijzingFeit(Guid.NewGuid(), "K3", LopendEind)];

        Assert.Equal(["K3"], Bereken(toewijzingen: toewijzing, vandaag: LopendEind).LeerkrachtLeeftijden);
        Assert.Empty(Bereken(toewijzingen: toewijzing, vandaag: LopendEind.AddDays(1)).LeerkrachtLeeftijden);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("L7")]
    [InlineData("F1")]
    [InlineData("3K")]
    public void Een_klas_zonder_geldige_gestelde_jaarfase_geeft_geen_enkele_leeftijd(string? gesteld)
    {
        // I12: fail closed. The klas is still the leerkracht's own klas for its planning.
        var klas = Guid.NewGuid();

        var rechten = Bereken(toewijzingen: [new KlastoewijzingFeit(klas, gesteld, LopendEind)]);

        Assert.Empty(rechten.LeerkrachtLeeftijden);
        Assert.Equal([klas], rechten.EigenKlasIds);
    }

    [Fact]
    public void Een_graadklas_geeft_alleen_haar_gestelde_jaarfase()
    {
        // R22, provisional: an L1/L2 graadklas recorded as L1 grants L1, not L2.
        var rechten = Bereken(toewijzingen: [new KlastoewijzingFeit(Guid.NewGuid(), "L1", LopendEind)]);

        Assert.Equal(["L1"], rechten.LeerkrachtLeeftijden);
        Assert.False(rechten.IsLeerkrachtVanLeeftijd("L2"));
    }

    [Fact]
    public void Twee_klassen_van_dezelfde_leeftijd_geven_die_leeftijd_een_keer()
    {
        var rechten = Bereken(toewijzingen:
        [
            new KlastoewijzingFeit(Guid.NewGuid(), "K3", LopendEind),
            new KlastoewijzingFeit(Guid.NewGuid(), "K3", LopendEind),
        ]);

        Assert.Equal(["K3"], rechten.LeerkrachtLeeftijden);
        Assert.Equal(2, rechten.EigenKlasIds.Count);
    }

    // --- The union rule and the plain flags. ---

    [Fact]
    public void Een_gebruiker_houdt_elke_relatie_die_voor_hem_geldt()
    {
        var groen = Guid.NewGuid();
        var oud = Guid.NewGuid();

        var rechten = Bereken(
            toewijzingen:
            [
                new KlastoewijzingFeit(groen, "K3", LopendEind),
                new KlastoewijzingFeit(oud, "L4", AfgelopenEind),
            ],
            aanstellingen:
            [
                new AanstellingFeit("L2", LopendEind),
                new AanstellingFeit("K3", VolgendEind),
                new AanstellingFeit("L6", AfgelopenEind),
            ],
            themabeheer: true);

        Assert.False(rechten.IsDirectie);
        Assert.True(rechten.HeeftThemabeheer);
        Assert.Equal(["K3", "L2"], rechten.HoofdleerkrachtLeeftijden);
        Assert.Equal(["K3"], rechten.LeerkrachtLeeftijden);
        Assert.Equal(new[] { groen, oud }.Order(), rechten.EigenKlasIds);
    }

    [Fact]
    public void De_leeftijden_staan_in_de_volgorde_van_de_jaarfasen()
    {
        var rechten = new Rechten(An, false, false, ["L6", "JK", "L1"], ["L2", "K2"], []);

        Assert.Equal(["JK", "L1", "L6"], rechten.HoofdleerkrachtLeeftijden);
        Assert.Equal(["K2", "L2"], rechten.LeerkrachtLeeftijden);
    }

    [Fact]
    public void Directie_wordt_doorgegeven_zoals_het_is()
    {
        Assert.True(Bereken(isDirectie: true).IsDirectie);
        Assert.False(Bereken().IsDirectie);
    }

    [Fact]
    public void Geen_rechten_is_echt_niets()
    {
        var geen = Rechten.Geen(An);

        Assert.Equal(An, geen.GebruikerId);
        Assert.False(geen.IsDirectie);
        Assert.False(geen.HeeftThemabeheer);
        Assert.Empty(geen.HoofdleerkrachtLeeftijden);
        Assert.Empty(geen.LeerkrachtLeeftijden);
        Assert.Empty(geen.EigenKlasIds);
        Assert.Empty(geen.RapportklasIds);
        Assert.Empty(geen.LopendeRapportklasIds);
    }

    // --- LK eigen for the ontwikkelingsrapport (FB-001, ADR-0030 footnote ⁶): a K3 klas (D9), read with no end date and
    // filled in only during its schooljaar (ADR-0035 R26, which overrides I21 for these rows). ---

    [Fact]
    public void Een_K3_klas_in_het_lopende_schooljaar_is_een_rapportklas_om_te_lezen_en_in_te_vullen()
    {
        var klas = Guid.NewGuid();

        var rechten = Bereken(toewijzingen: [new KlastoewijzingFeit(klas, "K3", LopendEind)]);

        Assert.Equal([klas], rechten.RapportklasIds);
        Assert.Equal([klas], rechten.LopendeRapportklasIds);
        Assert.True(rechten.IsRapportleerkrachtVan(klas));
        Assert.True(rechten.VultRapportIn(klas));
    }

    [Fact]
    public void Een_K3_klas_van_een_afgelopen_schooljaar_blijft_leesbaar_maar_wordt_niet_meer_ingevuld()
    {
        var klas = Guid.NewGuid();

        var rechten = Bereken(toewijzingen: [new KlastoewijzingFeit(klas, "K3", AfgelopenEind)]);

        Assert.Equal([klas], rechten.RapportklasIds);
        Assert.Empty(rechten.LopendeRapportklasIds);
        Assert.True(rechten.IsRapportleerkrachtVan(klas));
        Assert.False(rechten.VultRapportIn(klas));
    }

    [Fact]
    public void Een_K3_klas_van_een_schooljaar_dat_nog_niet_begon_wordt_al_ingevuld()
    {
        // The same "vandaag ≤ Eind" as R20: a leerkracht may enter next year's children in June.
        var klas = Guid.NewGuid();

        var rechten = Bereken(toewijzingen: [new KlastoewijzingFeit(klas, "K3", VolgendEind)]);

        Assert.Equal([klas], rechten.LopendeRapportklasIds);
    }

    [Fact]
    public void Op_de_laatste_schooldag_vult_de_leerkracht_nog_in_en_de_dag_erna_niet()
    {
        var klas = Guid.NewGuid();
        KlastoewijzingFeit[] toewijzing = [new KlastoewijzingFeit(klas, "K3", LopendEind)];

        Assert.Equal([klas], Bereken(toewijzingen: toewijzing, vandaag: LopendEind).LopendeRapportklasIds);

        var daarna = Bereken(toewijzingen: toewijzing, vandaag: LopendEind.AddDays(1));
        Assert.Empty(daarna.LopendeRapportklasIds);
        Assert.Equal([klas], daarna.RapportklasIds);
    }

    [Theory]
    [InlineData("JK")]
    [InlineData("K2")]
    [InlineData("L1")]
    [InlineData("L6")]
    public void Een_klas_die_geen_K3_geeft_is_geen_rapportklas_maar_blijft_de_eigen_klas(string jaarfase)
    {
        // D9: only a klas that grants K3 has leerlingen. Its planning is still the leerkracht's own (I21).
        var klas = Guid.NewGuid();

        var rechten = Bereken(toewijzingen: [new KlastoewijzingFeit(klas, jaarfase, LopendEind)]);

        Assert.Empty(rechten.RapportklasIds);
        Assert.Empty(rechten.LopendeRapportklasIds);
        Assert.Equal([klas], rechten.EigenKlasIds);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("3K")]
    [InlineData("K4")]
    public void Een_klas_zonder_geldige_gestelde_jaarfase_is_geen_rapportklas(string? gesteld)
    {
        // Fails closed through the one mapping (R22, I12), never widened the way the dekking widens a kleutergroep.
        var rechten = Bereken(toewijzingen: [new KlastoewijzingFeit(Guid.NewGuid(), gesteld, LopendEind)]);

        Assert.Empty(rechten.RapportklasIds);
        Assert.Empty(rechten.LopendeRapportklasIds);
    }

    [Fact]
    public void Een_gestelde_jaarfase_met_spaties_telt_zoals_de_mapping_ze_leest()
    {
        var klas = Guid.NewGuid();

        var rechten = Bereken(toewijzingen: [new KlastoewijzingFeit(klas, " K3 ", LopendEind)]);

        Assert.Equal([klas], rechten.RapportklasIds);
    }

    [Fact]
    public void Een_leerkracht_met_meerdere_klassen_krijgt_precies_zijn_K3_klassen()
    {
        var lopend = Guid.NewGuid();
        var afgelopen = Guid.NewGuid();
        var k2 = Guid.NewGuid();

        var rechten = Bereken(toewijzingen:
        [
            new KlastoewijzingFeit(lopend, "K3", LopendEind),
            new KlastoewijzingFeit(afgelopen, "K3", AfgelopenEind),
            new KlastoewijzingFeit(k2, "K2", LopendEind),
        ]);

        Assert.Equal(new[] { lopend, afgelopen }.Order(), rechten.RapportklasIds);
        Assert.Equal([lopend], rechten.LopendeRapportklasIds);
        Assert.Equal(new[] { lopend, afgelopen, k2 }.Order(), rechten.EigenKlasIds);
    }

    [Fact]
    public void Een_klas_om_in_te_vullen_is_altijd_ook_een_klas_om_te_lezen()
    {
        // The constructor keeps the one list a subset of the other, whoever builds it.
        var gelezen = Guid.NewGuid();
        var alleenIngevuld = Guid.NewGuid();

        var rechten = new Rechten(An, false, false, [], [], [], [gelezen], [gelezen, alleenIngevuld]);

        Assert.Equal([gelezen], rechten.LopendeRapportklasIds);
        Assert.False(rechten.VultRapportIn(alleenIngevuld));
    }

    [Fact]
    public void Zonder_rapportlijsten_heeft_een_rechtenobject_geen_rapportklas()
    {
        // The optional parameters default to nothing, which is the direction a right must fail in.
        var rechten = new Rechten(An, false, false, [], ["K3"], [Guid.NewGuid()]);

        Assert.Empty(rechten.RapportklasIds);
        Assert.Empty(rechten.LopendeRapportklasIds);
    }

    // --- The one mapping from a klas to its leeftijden (R22), and why it is not Klasleeftijden. ---

    [Fact]
    public void De_mapping_leest_de_gestelde_jaarfase_en_trimt_ze()
    {
        Assert.Equal(["K3"], Leeftijdsrechten.VoorKlas("K3"));
        Assert.Equal(["L5"], Leeftijdsrechten.VoorKlas(" L5 "));
    }

    [Fact]
    public void De_mapping_verbreedt_nooit_zoals_de_dekking_dat_doet()
    {
        // The dekking side widens a kleutergroep without a stated year to all three kleuter codes; a right must not.
        Assert.Equal(3, Jaarfasen.VoorKlas(leerjaar: 0, jaarfase: null)!.Count);
        Assert.Empty(Leeftijdsrechten.VoorKlas(null));
    }
}
