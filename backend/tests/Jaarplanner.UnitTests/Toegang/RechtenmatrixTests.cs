using System.Reflection;
using Jaarplanner.Application.Toegang;

namespace Jaarplanner.UnitTests.Toegang;

/// <summary>
/// The ADR-0030 §3 matrix, row by row and column by column (E6-02, Art. VI.1): each row allows exactly the relations
/// §3 gives it, on a resource of that row's kind, and nothing else. Directie passes every row (R3); a missing or
/// foreign resource fails closed.
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
        [Rechtenmatrix.Beleid.StreefwoordenschatAanpassen] = ["Directie", "HL", "LK leeftijd"],
        [Rechtenmatrix.Beleid.GedeeldeActiviteitBewerken] = ["Directie", "HL", "LK leeftijd"],
        [Rechtenmatrix.Beleid.KlasplanningBewerken] = ["Directie", "LK eigen"],
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
    public void Directie_mag_elke_rij_met_of_zonder_bron()
    {
        var directie = Relaties["Directie"];
        object?[] bronnen =
        [
            null,
            new object(),
            new Leeftijdsinhoud("L6"),
            new Klasplanning(AndereKlas),
            new Activiteitbron(Guid.NewGuid(), "L6", MakerId: null, HeeftDoelkoppelingen: true),
        ];

        Assert.All(Rechtenmatrix.Rijen, rij =>
            Assert.All(bronnen, bron => Assert.True(Rechtenmatrix.StaatToe(directie, rij, bron))));
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
        _ when rij.Kolommen.HasFlag(Kolom.LeerkrachtEigen) => new Klasplanning(EigenKlas),
        _ when rij.Kolommen.HasFlag(Kolom.Hoofdleerkracht) || rij.Kolommen.HasFlag(Kolom.LeerkrachtLeeftijd) =>
            new Leeftijdsinhoud(Leeftijd),
        _ => null,
    };
}
