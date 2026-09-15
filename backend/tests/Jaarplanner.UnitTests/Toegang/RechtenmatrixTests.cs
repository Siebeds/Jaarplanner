using System.Reflection;
using Jaarplanner.Application.Toegang;

namespace Jaarplanner.UnitTests.Toegang;

/// <summary>
/// The ADR-0030 §3 matrix as <see cref="Rechtenmatrix"/> declares it, row by row and column by column (E6-02, Art.
/// VI.1): each row allows exactly the relations §3 gives it, on a resource of that row's kind, and nothing else.
/// Directie passes every row (R3) except <c>RapportsetBewerken</c> (ADR-0035 R31); a missing or foreign resource fails
/// closed. Three of the six ontwikkelingsrapport rows of §3 (footnote ⁶) are declared and tested here, two since FB-001 and
/// one since FB-002; the other three get their tests with their policies (FB-003, FB-006, FB-007).
/// </summary>
public sealed class RechtenmatrixTests
{
    private static readonly Guid Ik = Guid.Parse("a0000000-0000-4000-8000-000000000001");
    private static readonly Guid AnderePersoon = Guid.Parse("b0000000-0000-4000-8000-000000000002");
    private static readonly Guid EigenKlas = Guid.Parse("c0000000-0000-4000-8000-000000000003");
    private static readonly Guid AndereKlas = Guid.Parse("d0000000-0000-4000-8000-000000000004");
    private const string Leeftijd = "K3";

    /// <summary>The relations of §3, each held alone, towards content of <see cref="Leeftijd"/> and <see cref="EigenKlas"/>.</summary>
    private static readonly Dictionary<string, Rechten> Relaties = new()
    {
        ["Directie"] = new Rechten(Ik, isDirectie: true, heeftThemabeheer: false, [], [], []),
        ["TB"] = new Rechten(Ik, isDirectie: false, heeftThemabeheer: true, [], [], []),
        ["HL"] = new Rechten(Ik, false, false, [Leeftijd], [], []),
        ["HL andere leeftijd"] = new Rechten(Ik, false, false, ["L1"], [], []),
        ["LK leeftijd"] = new Rechten(Ik, false, false, [], [Leeftijd], []),
        ["LK andere leeftijd"] = new Rechten(Ik, false, false, [], ["L1"], []),
        ["LK eigen"] = new Rechten(Ik, false, false, [], [], [EigenKlas]),
        // FB-001: one klastoewijzing on a K3 klas, as Rechtenberekening builds it, in a running and in an ended schooljaar.
        ["LK K3 lopend"] = new Rechten(Ik, false, false, [], [Leeftijd], [EigenKlas], [EigenKlas], [EigenKlas]),
        ["LK K3 afgelopen"] = new Rechten(Ik, false, false, [], [], [EigenKlas], [EigenKlas], []),
        ["Ander"] = Rechten.Geen(Ik),
    };

    /// <summary>
    /// §3 as data: for each row, the relations that pass it. Every row except the two activiteit rows, which depend on
    /// the resource's maker and links and have their own tests below.
    /// </summary>
    private static readonly Dictionary<string, string[]> Verwacht = new()
    {
        [Rechtenmatrix.Beleid.Curriculumbeheer] = ["Directie"],
        [Rechtenmatrix.Beleid.Beheer] = ["Directie"],
        [Rechtenmatrix.Beleid.MenselijkeBeslissingenVerwijderen] = ["Directie"],
        [Rechtenmatrix.Beleid.ThemaBewerken] = ["Directie", "TB"],
        // Without a Themabron only directie; themabeheer on an empty thema is its own test below (I26).
        [Rechtenmatrix.Beleid.ThemaVerwijderen] = ["Directie"],
        [Rechtenmatrix.Beleid.SchoolcontentImporteren] = ["Directie", "TB"],
        [Rechtenmatrix.Beleid.ThemaOpbouw] = ["Directie", "TB"],
        [Rechtenmatrix.Beleid.Wizardinhoud] = ["Directie", "TB"],
        [Rechtenmatrix.Beleid.DoelsuggestiesMaken] = ["Directie", "TB"],
        [Rechtenmatrix.Beleid.DoelsuggestiesBeoordelen] = ["Directie", "TB"],
        [Rechtenmatrix.Beleid.SubthemaBeheren] = ["Directie", "HL"],
        [Rechtenmatrix.Beleid.SubdoelenBeheren] = ["Directie", "HL"],
        [Rechtenmatrix.Beleid.DoelenKoppelen] = ["Directie", "HL"],
        [Rechtenmatrix.Beleid.StreefwoordenschatAanpassen] = ["Directie", "HL", "LK leeftijd", "LK K3 lopend"],
        [Rechtenmatrix.Beleid.GedeeldeActiviteitBewerken] = ["Directie", "HL", "LK leeftijd", "LK K3 lopend"],
        [Rechtenmatrix.Beleid.KlasplanningBewerken] = ["Directie", "LK eigen", "LK K3 lopend", "LK K3 afgelopen"],
        // FB-013 (ADR-0040 Z1-Z5): reading a K3 klas is for its own leerkracht, every leerkracht and hoofdleerkracht of
        // K3, themabeheer and directie. Not for another leeftijd, and not for a gebruiker without a right (Z4).
        [Rechtenmatrix.Beleid.KlasplanningBekijken] =
            ["Directie", "TB", "HL", "LK leeftijd", "LK eigen", "LK K3 lopend", "LK K3 afgelopen"],
        // Footnote ⁶ (ADR-0035 R16, R17, R26): the klas's K3 leerkracht reads with no end date and keeps the leerlingen
        // only during the schooljaar. Nobody else but directie, not HL, TB or "LK leeftijd" (R17).
        [Rechtenmatrix.Beleid.OntwikkelingsrapportLezen] = ["Directie", "LK K3 lopend", "LK K3 afgelopen"],
        [Rechtenmatrix.Beleid.LeerlingenBeheren] = ["Directie", "LK K3 lopend"],
        // FB-002 (ADR-0035 R6, R31, D4): a K3 leerkracht during a running schooljaar, and nobody else, not even directie.
        // Not "LK leeftijd" as this list builds it, with K3 among its leeftijden and no rapportklas: the column reads the
        // running rapportklassen (the D9 function), not the stated jaarfase.
        [Rechtenmatrix.Beleid.RapportsetBewerken] = ["LK K3 lopend"],
    };

    private static readonly string[] ActiviteitRijen =
        [Rechtenmatrix.Beleid.ActiviteitVerwijderen, Rechtenmatrix.Beleid.ActiviteitVerplaatsen];

    public static TheoryData<string, string> ElkeRijMetElkeRelatie()
    {
        var data = new TheoryData<string, string>();
        foreach (var beleid in Verwacht.Keys)
        {
            foreach (var relatie in Relaties.Keys)
            {
                data.Add(beleid, relatie);
            }
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(ElkeRijMetElkeRelatie))]
    public void Elke_rij_laat_precies_de_relaties_van_paragraaf_3_toe(string beleid, string relatie)
    {
        var rij = Rij(beleid);

        var toegelaten = Rechtenmatrix.StaatToe(Relaties[relatie], rij, BronVoor(rij));

        Assert.Equal(Verwacht[beleid].Contains(relatie), toegelaten);
    }

    [Fact]
    public void Elke_rij_van_de_matrix_heeft_een_verwachting_in_deze_tests()
    {
        // A row added to the matrix without a line above fails here, so no row ships untested.
        var getest = Verwacht.Keys.Concat(ActiviteitRijen).Order(StringComparer.Ordinal);

        Assert.Equal(getest, Rechtenmatrix.Rijen.Select(r => r.Beleid).Order(StringComparer.Ordinal));
    }

    [Fact]
    public void Elke_beleidsnaam_hoort_bij_precies_een_rij()
    {
        var constanten = typeof(Rechtenmatrix.Beleid)
            .GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(f => f.IsLiteral)
            .Select(f => (string)f.GetRawConstantValue()!)
            .Order(StringComparer.Ordinal)
            .ToList();

        Assert.Equal(constanten, Rechtenmatrix.Rijen.Select(r => r.Beleid).Order(StringComparer.Ordinal));
        Assert.Equal(Rechtenmatrix.Rijen.Count, Rechtenmatrix.Rijen.Select(r => r.Beleid).Distinct().Count());
    }

    [Fact]
    public void Directie_mag_elke_rij_behalve_de_rapportset_met_of_zonder_bron()
    {
        var directie = Relaties["Directie"];
        object?[] bronnen =
        [
            null,
            new object(),
            new Leeftijdsinhoud("L6"),
            new Klasplanning(AndereKlas),
            Klasinzage.Voor(AndereKlas, "L6"),
            Klasinzage.Voor(AndereKlas, gesteldeJaarfase: null),
            new Rapportklas(AndereKlas),
            new Activiteitbron(Guid.NewGuid(), "L6", MakerId: null, HeeftDoelkoppelingen: true),
        ];

        Assert.All(Rechtenmatrix.Rijen.Where(rij => !rij.ZonderDirectie), rij =>
            Assert.All(bronnen, bron => Assert.True(Rechtenmatrix.StaatToe(directie, rij, bron))));

        // R31: exactly one row is closed to directie as such, and it is the K3 set. With any resource.
        Assert.Equal(
            [Rechtenmatrix.Beleid.RapportsetBewerken],
            Rechtenmatrix.Rijen.Where(rij => rij.ZonderDirectie).Select(rij => rij.Beleid));
        Assert.All(bronnen, bron => Assert.False(Rechtenmatrix.StaatToe(directie, Rechtenmatrix.RapportsetBewerken, bron)));
    }

    // --- Resources that are missing or of the wrong kind fail closed. ---

    [Fact]
    public void Een_leeftijdsrij_zonder_bron_laat_een_hoofdleerkracht_niet_toe()
    {
        Assert.False(Rechtenmatrix.StaatToe(Relaties["HL"], Rechtenmatrix.SubthemaBeheren, bron: null));
        Assert.False(Rechtenmatrix.StaatToe(Relaties["HL"], Rechtenmatrix.SubthemaBeheren, new object()));
    }

    [Fact]
    public void Een_bron_van_de_verkeerde_soort_laat_niemand_toe()
    {
        var alles = new Rechten(Ik, false, true, [Leeftijd], [Leeftijd], [EigenKlas]);

        Assert.False(Rechtenmatrix.StaatToe(alles, Rechtenmatrix.SubthemaBeheren, new Klasplanning(EigenKlas)));
        Assert.False(Rechtenmatrix.StaatToe(alles, Rechtenmatrix.KlasplanningBewerken, new Leeftijdsinhoud(Leeftijd)));
    }

    [Fact]
    public void Een_andere_klas_is_niet_de_eigen_klas()
    {
        Assert.False(Rechtenmatrix.StaatToe(
            Relaties["LK eigen"], Rechtenmatrix.KlasplanningBewerken, new Klasplanning(AndereKlas)));
    }

    // --- Reading a klas's planning (FB-013, ADR-0040): the klas's jaarfase decides, through the one mapping. ---

    [Fact]
    public void Een_klas_van_een_andere_jaarfase_leest_alleen_themabeheer_en_directie_Z1_Z2_Z3()
    {
        var k2 = Klasinzage.Voor(AndereKlas, "K2");

        foreach (var relatie in new[] { "HL", "LK leeftijd", "LK eigen", "LK K3 lopend", "LK K3 afgelopen", "Ander" })
        {
            Assert.False(Rechtenmatrix.StaatToe(Relaties[relatie], Rechtenmatrix.KlasplanningBekijken, k2));
        }

        Assert.True(Rechtenmatrix.StaatToe(Relaties["TB"], Rechtenmatrix.KlasplanningBekijken, k2));
        Assert.True(Rechtenmatrix.StaatToe(Relaties["Directie"], Rechtenmatrix.KlasplanningBekijken, k2));
        // A leerkracht with a klas in each jaarfase reads both.
        var beide = new Rechten(Ik, false, false, [], ["K2", Leeftijd], [EigenKlas]);
        Assert.True(Rechtenmatrix.StaatToe(beide, Rechtenmatrix.KlasplanningBekijken, k2));
        Assert.True(Rechtenmatrix.StaatToe(beide, Rechtenmatrix.KlasplanningBekijken, Klasinzage.Voor(AndereKlas, Leeftijd)));
    }

    [Fact]
    public void Een_klas_zonder_gestelde_jaarfase_staat_voor_geen_leeftijd_en_leest_alleen_haar_eigen_leerkracht()
    {
        // Leeftijdsrechten.VoorKlas fails closed (I12): a klas that states no jaarfase belongs to no jaarfase's readers.
        Assert.False(Rechtenmatrix.StaatToe(Relaties["LK leeftijd"], Rechtenmatrix.KlasplanningBekijken, Klasinzage.Voor(AndereKlas, null)));
        Assert.False(Rechtenmatrix.StaatToe(Relaties["HL"], Rechtenmatrix.KlasplanningBekijken, Klasinzage.Voor(AndereKlas, "  ")));
        Assert.True(Rechtenmatrix.StaatToe(Relaties["LK eigen"], Rechtenmatrix.KlasplanningBekijken, Klasinzage.Voor(EigenKlas, null)));
        Assert.True(Rechtenmatrix.StaatToe(Relaties["TB"], Rechtenmatrix.KlasplanningBekijken, Klasinzage.Voor(AndereKlas, null)));
    }

    [Fact]
    public void Een_leesbron_opent_geen_andere_rij_en_een_andere_bron_opent_de_leesrij_niet()
    {
        var alles = new Rechten(Ik, false, false, [Leeftijd], [Leeftijd], [EigenKlas]);
        var inzage = Klasinzage.Voor(EigenKlas, Leeftijd);

        Assert.False(Rechtenmatrix.StaatToe(alles, Rechtenmatrix.KlasplanningBewerken, inzage));
        Assert.False(Rechtenmatrix.StaatToe(alles, Rechtenmatrix.SubthemaBeheren, inzage));
        Assert.False(Rechtenmatrix.StaatToe(alles, Rechtenmatrix.GedeeldeActiviteitBewerken, inzage));
        Assert.False(Rechtenmatrix.StaatToe(alles, Rechtenmatrix.OntwikkelingsrapportLezen, inzage));
        Assert.False(Rechtenmatrix.StaatToe(alles, Rechtenmatrix.KlasplanningBekijken, new Klasplanning(EigenKlas)));
        Assert.False(Rechtenmatrix.StaatToe(alles, Rechtenmatrix.KlasplanningBekijken, new Leeftijdsinhoud(Leeftijd)));
        Assert.False(Rechtenmatrix.StaatToe(alles, Rechtenmatrix.KlasplanningBekijken, bron: null));
    }

    // --- The union rule (§3): one matching relation is enough, and none takes away another's grant. ---

    [Fact]
    public void Wie_meerdere_relaties_heeft_krijgt_ze_allemaal()
    {
        // Hoofdleerkracht of K3, leerkracht of an L1 klas, themabeheer.
        var samen = new Rechten(Ik, false, true, [Leeftijd], ["L1"], [EigenKlas]);

        Assert.True(Rechtenmatrix.StaatToe(samen, Rechtenmatrix.SubthemaBeheren, new Leeftijdsinhoud(Leeftijd)));
        Assert.False(Rechtenmatrix.StaatToe(samen, Rechtenmatrix.SubthemaBeheren, new Leeftijdsinhoud("L1")));
        Assert.True(Rechtenmatrix.StaatToe(samen, Rechtenmatrix.GedeeldeActiviteitBewerken, new Leeftijdsinhoud("L1")));
        Assert.True(Rechtenmatrix.StaatToe(samen, Rechtenmatrix.KlasplanningBewerken, new Klasplanning(EigenKlas)));
        Assert.True(Rechtenmatrix.StaatToe(samen, Rechtenmatrix.ThemaBewerken, bron: null));
        Assert.False(Rechtenmatrix.StaatToe(samen, Rechtenmatrix.Curriculumbeheer, bron: null));
    }

    // --- Deleting a thema (I26): directie always; themabeheer only while it holds nothing but its own open run's items. ---

    [Fact]
    public void Themabeheer_verwijdert_een_thema_alleen_zonder_andermans_inhoud()
    {
        var zonder = new Themabron(Guid.NewGuid(), HeeftAndermansInhoud: false, GekoppeldeLeeftijden: []);
        var met = new Themabron(Guid.NewGuid(), HeeftAndermansInhoud: true, GekoppeldeLeeftijden: []);

        Assert.True(Rechtenmatrix.StaatToe(Relaties["TB"], Rechtenmatrix.ThemaVerwijderen, zonder));
        Assert.False(Rechtenmatrix.StaatToe(Relaties["TB"], Rechtenmatrix.ThemaVerwijderen, met));
        Assert.True(Rechtenmatrix.StaatToe(Relaties["Directie"], Rechtenmatrix.ThemaVerwijderen, met));
        foreach (var relatie in new[] { "HL", "LK leeftijd", "LK eigen", "Ander" })
        {
            Assert.False(Rechtenmatrix.StaatToe(Relaties[relatie], Rechtenmatrix.ThemaVerwijderen, zonder));
        }

        // Q4 (a): a goal link on an activiteit of the open run protects the thema, unless themabeheer may also link goals
        // at that leeftijd, asked through the one DoelenKoppelen rule.
        var gekoppeld = new Themabron(Guid.NewGuid(), HeeftAndermansInhoud: false, GekoppeldeLeeftijden: [Leeftijd]);
        Assert.False(Rechtenmatrix.StaatToe(Relaties["TB"], Rechtenmatrix.ThemaVerwijderen, gekoppeld));
        Assert.True(Rechtenmatrix.StaatToe(new Rechten(Ik, false, true, [Leeftijd], [], []), Rechtenmatrix.ThemaVerwijderen, gekoppeld));
        Assert.False(Rechtenmatrix.StaatToe(new Rechten(Ik, false, true, ["L1"], [], []), Rechtenmatrix.ThemaVerwijderen, gekoppeld));
        Assert.False(Rechtenmatrix.StaatToe(Relaties["HL"], Rechtenmatrix.ThemaVerwijderen, gekoppeld));
        Assert.True(Rechtenmatrix.StaatToe(Relaties["Directie"], Rechtenmatrix.ThemaVerwijderen, gekoppeld));
        var tweeLeeftijden = new Themabron(Guid.NewGuid(), HeeftAndermansInhoud: false, GekoppeldeLeeftijden: [Leeftijd, "L1"]);
        Assert.False(Rechtenmatrix.StaatToe(new Rechten(Ik, false, true, [Leeftijd], [], []), Rechtenmatrix.ThemaVerwijderen, tweeLeeftijden));

        // The column needs the resource: themabeheer through an attribute (no Themabron) does not pass.
        Assert.False(Rechtenmatrix.StaatToe(Relaties["TB"], Rechtenmatrix.ThemaVerwijderen, bron: null));
    }

    // --- Deleting an activiteit: the maker while no goal is linked (R25, R33); the hoofdleerkracht always. ---

    [Fact]
    public void De_maker_verwijdert_zijn_activiteit_zonder_koppelingen_ook_zonder_klas_van_die_leeftijd()
    {
        Assert.True(Verwijderen(Relaties["Ander"], maker: Ik, koppelingen: false));
        Assert.True(Verwijderen(Relaties["TB"], maker: Ik, koppelingen: false));
        Assert.True(Verwijderen(Relaties["LK andere leeftijd"], maker: Ik, koppelingen: false));
    }

    [Fact]
    public void De_maker_verwijdert_zijn_activiteit_niet_meer_zodra_er_een_doel_aan_hangt()
    {
        Assert.False(Verwijderen(Relaties["Ander"], maker: Ik, koppelingen: true));
        Assert.False(Verwijderen(Relaties["LK leeftijd"], maker: Ik, koppelingen: true));
    }

    [Fact]
    public void Een_leerkracht_van_die_leeftijd_verwijdert_andermans_activiteit_niet()
    {
        Assert.False(Verwijderen(Relaties["LK leeftijd"], maker: AnderePersoon, koppelingen: false));
        Assert.False(Verwijderen(Relaties["LK leeftijd"], maker: null, koppelingen: false));
    }

    [Fact]
    public void De_hoofdleerkracht_van_die_leeftijd_verwijdert_elke_activiteit()
    {
        Assert.True(Verwijderen(Relaties["HL"], maker: AnderePersoon, koppelingen: true));
        Assert.True(Verwijderen(Relaties["HL"], maker: null, koppelingen: false));
        Assert.False(Verwijderen(Relaties["HL andere leeftijd"], maker: null, koppelingen: true));
    }

    [Fact]
    public void Niemand_behalve_directie_en_hoofdleerkracht_verwijdert_een_activiteit_zonder_maker()
    {
        foreach (var relatie in new[] { "TB", "LK leeftijd", "LK eigen", "Ander" })
        {
            Assert.False(Verwijderen(Relaties[relatie], maker: null, koppelingen: false));
        }
    }

    // --- Moving an activiteit: the goal-link right with links, every leerkracht of that leeftijd without (I19). ---

    [Fact]
    public void Een_leerkracht_van_die_leeftijd_verplaatst_een_activiteit_zonder_koppelingen()
    {
        Assert.True(Verplaatsen(Relaties["LK leeftijd"], maker: null, koppelingen: false));
        Assert.False(Verplaatsen(Relaties["LK andere leeftijd"], maker: null, koppelingen: false));
    }

    [Fact]
    public void Een_activiteit_met_koppelingen_verplaatst_alleen_de_hoofdleerkracht()
    {
        Assert.False(Verplaatsen(Relaties["LK leeftijd"], maker: null, koppelingen: true));
        Assert.True(Verplaatsen(Relaties["HL"], maker: null, koppelingen: true));
    }

    [Fact]
    public void Maker_zijn_geeft_geen_recht_om_te_verplaatsen()
    {
        // I19: a move is not a deletion for the maker right (R25).
        Assert.False(Verplaatsen(Relaties["Ander"], maker: Ik, koppelingen: false));
        Assert.False(Verplaatsen(Relaties["TB"], maker: Ik, koppelingen: false));
        Assert.False(Verplaatsen(Relaties["LK eigen"], maker: Ik, koppelingen: false));
    }

    // --- The ontwikkelingsrapport of one klas (footnote ⁶, ADR-0035 §3.3; FB-001). ---

    [Fact]
    public void Een_leerkracht_van_een_andere_K3_klas_leest_en_beheert_de_kinderen_van_deze_klas_niet()
    {
        // R17: another klas's K3 leerkracht reads none of it, whatever I9 grants for plans.
        var andereK3 = new Rechten(Ik, false, false, [], [Leeftijd], [AndereKlas], [AndereKlas], [AndereKlas]);

        Assert.False(Rechtenmatrix.StaatToe(andereK3, Rechtenmatrix.OntwikkelingsrapportLezen, new Rapportklas(EigenKlas)));
        Assert.False(Rechtenmatrix.StaatToe(andereK3, Rechtenmatrix.LeerlingenBeheren, new Rapportklas(EigenKlas)));
        Assert.True(Rechtenmatrix.StaatToe(andereK3, Rechtenmatrix.LeerlingenBeheren, new Rapportklas(AndereKlas)));
    }

    [Theory]
    [InlineData("K2")]
    [InlineData("L1")]
    [InlineData(null)]
    public void Een_leerkracht_van_een_klas_die_geen_K3_geeft_heeft_daar_geen_rapportklas(string? jaarfase)
    {
        // Built the way RechtenService builds it, so D9's mapping is part of what is tested: the klas is the leerkracht's
        // own for its planning, and still no rapportklas.
        var rechten = Rechtenberekening.Bereken(
            Ik, false, false, [new KlastoewijzingFeit(EigenKlas, jaarfase, new DateOnly(2027, 6, 30))], [], new DateOnly(2026, 9, 15));

        Assert.True(Rechtenmatrix.StaatToe(rechten, Rechtenmatrix.KlasplanningBewerken, new Klasplanning(EigenKlas)));
        Assert.False(Rechtenmatrix.StaatToe(rechten, Rechtenmatrix.OntwikkelingsrapportLezen, new Rapportklas(EigenKlas)));
        Assert.False(Rechtenmatrix.StaatToe(rechten, Rechtenmatrix.LeerlingenBeheren, new Rapportklas(EigenKlas)));

        // FB-002 (D4): nor a K3 leerkracht who may edit the K3 set.
        Assert.False(Rechtenmatrix.StaatToe(rechten, Rechtenmatrix.RapportsetBewerken, bron: null));
    }

    [Fact]
    public void Na_het_schooljaar_leest_de_leerkracht_nog_maar_beheert_ze_de_kinderen_niet_meer()
    {
        // R26, through the real computation: the klas's schooljaar ended yesterday.
        var vandaag = new DateOnly(2027, 7, 1);
        var rechten = Rechtenberekening.Bereken(
            Ik, false, false, [new KlastoewijzingFeit(EigenKlas, "K3", vandaag.AddDays(-1))], [], vandaag);

        Assert.True(Rechtenmatrix.StaatToe(rechten, Rechtenmatrix.OntwikkelingsrapportLezen, new Rapportklas(EigenKlas)));
        Assert.False(Rechtenmatrix.StaatToe(rechten, Rechtenmatrix.LeerlingenBeheren, new Rapportklas(EigenKlas)));

        // Directie still does (R3, and R26's "Directie kan nog alles").
        Assert.True(Rechtenmatrix.StaatToe(Relaties["Directie"], Rechtenmatrix.LeerlingenBeheren, new Rapportklas(EigenKlas)));
    }

    [Fact]
    public void Een_hoofdleerkracht_en_themabeheerder_van_K3_zonder_klastoewijzing_lezen_geen_rapport()
    {
        // D4 and R17: a K3 appointment or themabeheer is no klastoewijzing, so no rapportklas.
        var hlEnTb = new Rechten(Ik, false, true, [Leeftijd], [], []);

        Assert.False(Rechtenmatrix.StaatToe(hlEnTb, Rechtenmatrix.OntwikkelingsrapportLezen, new Rapportklas(EigenKlas)));
        Assert.False(Rechtenmatrix.StaatToe(hlEnTb, Rechtenmatrix.LeerlingenBeheren, new Rapportklas(EigenKlas)));
    }

    [Fact]
    public void Een_rapportrij_opent_alleen_met_een_rapportklas_als_bron_en_omgekeerd()
    {
        var k3 = Relaties["LK K3 lopend"];
        object?[] andereBronnen =
        [
            null,
            new object(),
            new Klasplanning(EigenKlas),
            new Leeftijdsinhoud(Leeftijd),
            new Activiteitbron(Guid.NewGuid(), Leeftijd, Ik, HeeftDoelkoppelingen: false),
        ];

        Assert.All(andereBronnen, bron =>
        {
            Assert.False(Rechtenmatrix.StaatToe(k3, Rechtenmatrix.OntwikkelingsrapportLezen, bron));
            Assert.False(Rechtenmatrix.StaatToe(k3, Rechtenmatrix.LeerlingenBeheren, bron));
        });

        // A report resource never opens a planning or leeftijd row either.
        Assert.False(Rechtenmatrix.StaatToe(k3, Rechtenmatrix.KlasplanningBewerken, new Rapportklas(EigenKlas)));
        Assert.False(Rechtenmatrix.StaatToe(k3, Rechtenmatrix.GedeeldeActiviteitBewerken, new Rapportklas(EigenKlas)));
    }

    // --- The one K3 set of rapportdoelen and the scale (footnote ⁶, ADR-0035 R6, R31, D4; FB-002). ---

    [Fact]
    public void Elke_K3_leerkracht_wijzigt_de_rapportset_tijdens_het_schooljaar_met_of_zonder_bron()
    {
        // Through the real computation: a K3 klas whose schooljaar runs. Which klas does not matter, the set is one for
        // all of K3 (R4, R5), so no resource is needed and none takes the right away.
        var vandaag = new DateOnly(2026, 9, 15);
        var rechten = Rechtenberekening.Bereken(
            Ik, false, false, [new KlastoewijzingFeit(AndereKlas, "K3", new DateOnly(2027, 6, 30))], [], vandaag);
        object?[] bronnen = [null, new object(), new Rapportklas(EigenKlas), new Leeftijdsinhoud("L1")];

        Assert.All(bronnen, bron => Assert.True(Rechtenmatrix.StaatToe(rechten, Rechtenmatrix.RapportsetBewerken, bron)));
    }

    [Fact]
    public void Na_het_schooljaar_wijzigt_de_K3_leerkracht_de_rapportset_niet_meer()
    {
        // D4: "in a schooljaar that has not ended". The same leerkracht still reads the klas's reports (R26).
        var vandaag = new DateOnly(2027, 7, 1);
        var rechten = Rechtenberekening.Bereken(
            Ik, false, false, [new KlastoewijzingFeit(EigenKlas, "K3", vandaag.AddDays(-1))], [], vandaag);

        Assert.False(Rechtenmatrix.StaatToe(rechten, Rechtenmatrix.RapportsetBewerken, bron: null));
        Assert.True(Rechtenmatrix.StaatToe(rechten, Rechtenmatrix.OntwikkelingsrapportLezen, new Rapportklas(EigenKlas)));
    }

    [Fact]
    public void Een_hoofdleerkracht_van_K3_zonder_klastoewijzing_en_themabeheer_wijzigen_de_rapportset_niet()
    {
        // D4 names the hoofdleerkracht of K3 without a K3 klastoewijzing explicitly.
        Assert.False(Rechtenmatrix.StaatToe(new Rechten(Ik, false, true, [Leeftijd], [], []), Rechtenmatrix.RapportsetBewerken, bron: null));
        Assert.False(Rechtenmatrix.StaatToe(Relaties["HL"], Rechtenmatrix.RapportsetBewerken, bron: null));
        Assert.False(Rechtenmatrix.StaatToe(Relaties["TB"], Rechtenmatrix.RapportsetBewerken, bron: null));
    }

    [Fact]
    public void Een_directeur_die_zelf_een_K3_klas_heeft_wijzigt_de_rapportset_toch_niet()
    {
        // R31 as the owner read it on 2026-09-15 ("Nooit wie directie heeft"): the union rule does not reach this row for
        // directie. The same klastoewijzing makes a plain gebruiker a K3 leerkracht who passes, which the second assert
        // pins, so the refusal comes from the directie right and not from the klas.
        var vandaag = new DateOnly(2026, 9, 15);
        var toewijzing = new KlastoewijzingFeit(EigenKlas, "K3", new DateOnly(2027, 6, 30));
        var directeur = Rechtenberekening.Bereken(Ik, true, false, [toewijzing], [], vandaag);
        var leerkracht = Rechtenberekening.Bereken(Ik, false, false, [toewijzing], [], vandaag);

        Assert.False(Rechtenmatrix.StaatToe(directeur, Rechtenmatrix.RapportsetBewerken, bron: null));
        Assert.True(Rechtenmatrix.StaatToe(leerkracht, Rechtenmatrix.RapportsetBewerken, bron: null));
    }

    private static bool Verwijderen(Rechten rechten, Guid? maker, bool koppelingen) =>
        Rechtenmatrix.StaatToe(rechten, Rechtenmatrix.ActiviteitVerwijderen, Activiteit(maker, koppelingen));

    private static bool Verplaatsen(Rechten rechten, Guid? maker, bool koppelingen) =>
        Rechtenmatrix.StaatToe(rechten, Rechtenmatrix.ActiviteitVerplaatsen, Activiteit(maker, koppelingen));

    private static Activiteitbron Activiteit(Guid? maker, bool koppelingen) =>
        new(Guid.NewGuid(), Leeftijd, maker, koppelingen);

    private static Matrixrij Rij(string beleid) => Rechtenmatrix.Rijen.Single(r => r.Beleid == beleid);

    /// <summary>The resource a controller would pass for this row: none for resource-free rows.</summary>
    private static object? BronVoor(Matrixrij rij) => rij.Kolommen switch
    {
        _ when rij.Kolommen.HasFlag(Kolom.LeerkrachtRapportLezen) || rij.Kolommen.HasFlag(Kolom.LeerkrachtRapportInvullen) =>
            new Rapportklas(EigenKlas),
        _ when rij.Kolommen.HasFlag(Kolom.LeerkrachtEigenLezen) => Klasinzage.Voor(EigenKlas, Leeftijd),
        _ when rij.Kolommen.HasFlag(Kolom.LeerkrachtEigen) => new Klasplanning(EigenKlas),
        _ when rij.Kolommen.HasFlag(Kolom.Hoofdleerkracht) || rij.Kolommen.HasFlag(Kolom.LeerkrachtLeeftijd) =>
            new Leeftijdsinhoud(Leeftijd),
        _ => null,
    };
}
