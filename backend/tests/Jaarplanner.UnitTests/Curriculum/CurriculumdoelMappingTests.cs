using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Infrastructure.OpstapImport;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// The one mapping from a <c>krcItems</c> goal to a <see cref="Leerplandoel"/> (E1-21, Art. III.3). The goal is
/// <c>2.1.GL3.10</c> as snapshot 1.2 publishes it, its description shortened to one example.
/// </summary>
public sealed class CurriculumdoelMappingTests
{
    private const string MinimumdoelHref = "/agodi/onderwijsdoelen/opstap/93408";

    private static readonly Guid Sleutel = new("dfbcef35-a21b-41a6-a1dd-958cc0cccdbc");

    private static readonly Dictionary<string, string> Minimumdoelen =
        new(StringComparer.Ordinal) { [MinimumdoelHref] = "4-2.1.7" };

    private static KrcItemDto Item(string type, string? identifier, string? titel) =>
        new() { Key = Guid.NewGuid().ToString(), Href = $"/content/{Guid.NewGuid()}", Type = type, Identifier = identifier, Title = titel };

    private static Curriculumplaats Plaats(
        string leeftijd = "L3",
        string? cluster = "Een getal ≤ 1000 interpreteren als een hoeveelheid",
        string subdomein = "Natuurlijke getallen") =>
        new(
            "2",
            Item(CurriculumApiBron.TypeDomein, "1", "Getallenkennis"),
            Item(CurriculumApiBron.TypeSubdomein, null, subdomein),
            cluster is null ? null : Item(CurriculumApiBron.TypeCluster, null, cluster),
            Item(CurriculumApiBron.TypeDoelset, "G", "Routedoelen"),
            Item(CurriculumApiBron.TypeLeeftijd, leeftijd, "3de leerjaar"));

    private static KrcItemDto Doel(
        string titel = "De leerlingen kunnen met machten van tien tellen tot getallen (≤ 1000).",
        string? beschrijving = "Machten van tien zijn getallen zoals <br>10<sup>2</sup>=10x10= 100<br><br>" +
                               "<strong>Voorbeeld(en):</strong><ul><li>Wel 105, 110, 115… maar niet 134, 139, 144…</li></ul>",
        List<string>? minimumdoelen = null,
        string code = "2.1.GL3.10") =>
        new()
        {
            Key = Sleutel.ToString(),
            Href = $"/content/{Sleutel}",
            Type = CurriculumApiBron.TypeDoel,
            Identifier = code,
            Title = titel,
            Description = beschrijving,
            MinimumGoals = minimumdoelen ?? [MinimumdoelHref],
        };

    [Fact]
    public void Een_G_doel_wordt_een_volledig_leerplandoel()
    {
        var (doel, probleem) = CurriculumdoelMapping.Map(Doel(), Plaats(), Minimumdoelen);

        Assert.Null(probleem);
        Assert.NotNull(doel);
        Assert.Equal("2.1.GL3.10", doel.Code);
        Assert.Equal(Doelsoort.Gemeenschappelijk, doel.Doelsoort);
        Assert.Equal("L3", doel.JaarFase);
        Assert.Equal("2", doel.DisciplineNummer);
        Assert.Equal("Getallenkennis", doel.Domein);
        Assert.Equal("Natuurlijke getallen", doel.Subdomein);
        Assert.Equal("Een getal ≤ 1000 interpreteren als een hoeveelheid", doel.Cluster);
        Assert.Equal("De leerlingen kunnen met machten van tien tellen tot getallen (≤ 1000).", doel.Tekst);
        Assert.Equal("- Wel 105, 110, 115… maar niet 134, 139, 144…", doel.Voorbeelden);
        Assert.Equal("Machten van tien zijn getallen zoals\n10^2=10x10= 100", doel.Toelichting);
        Assert.Null(doel.Woordenschat);
        Assert.Equal("4-2.1.7", doel.MinimumdoelRef);
        Assert.Equal(Sleutel, doel.OpstapSleutel);
        Assert.False(doel.NietMeerInOpstap);
    }

    /// <summary>A third of the G goals sit directly under their subdomain (1,954 of 5,835 in snapshot 1.2).</summary>
    [Fact]
    public void Een_doel_zonder_cluster_krijgt_geen_cluster() =>
        Assert.Null(CurriculumdoelMapping.Map(Doel(), Plaats(cluster: null), Minimumdoelen).Doel!.Cluster);

    /// <summary>852 G goals of snapshot 1.2 concord to no minimumdoel.</summary>
    [Fact]
    public void Een_doel_zonder_minimumdoel_is_niet_geconcordeerd() =>
        Assert.Null(CurriculumdoelMapping.Map(Doel(minimumdoelen: []), Plaats(), Minimumdoelen).Doel!.MinimumdoelRef);

    [Fact]
    public void Dezelfde_verwijzing_twee_keer_telt_als_een() =>
        Assert.Equal(
            "4-2.1.7",
            CurriculumdoelMapping.Map(Doel(minimumdoelen: [MinimumdoelHref, MinimumdoelHref]), Plaats(), Minimumdoelen).Doel!.MinimumdoelRef);

    [Theory]
    [InlineData("3K", "K3")]
    [InlineData("1K", "JK")]
    [InlineData("4L", "L4")]
    [InlineData("JK", "JK")]
    public void De_leeftijd_wordt_genormaliseerd(string bron, string verwacht) =>
        Assert.Equal(verwacht, CurriculumdoelMapping.Map(Doel(), Plaats(leeftijd: bron), Minimumdoelen).Doel!.JaarFase);

    /// <summary>A G goal is for one of the nine jaren; a fase, a zwemdoel range or nothing at all is not guessed at.</summary>
    [Theory]
    [InlineData("F3")]
    [InlineData("ZW")]
    [InlineData("K1")]
    [InlineData("")]
    public void Een_leeftijd_buiten_JK_tot_L6_wordt_geweigerd(string leeftijd) =>
        Assert.Contains("age range", Probleem(Doel(), Plaats(leeftijd: leeftijd)));

    /// <summary>ADR-0018 holds one minimumdoel per goal. Concording to the first of two would drop the other silently.</summary>
    [Fact]
    public void Meer_dan_een_minimumdoel_wordt_geweigerd_en_niet_half_geconcordeerd() =>
        Assert.Contains(
            "refers to 2 minimumdoelen",
            Probleem(Doel(minimumdoelen: [MinimumdoelHref, "/agodi/onderwijsdoelen/opstap/1"]), Plaats()));

    [Fact]
    public void Een_verwijzing_naar_een_onbekend_minimumdoel_wordt_geweigerd() =>
        Assert.Contains(
            "is not among the minimumdoelen KOV publishes",
            Probleem(Doel(minimumdoelen: ["/agodi/onderwijsdoelen/opstap/1"]), Plaats()));

    [Fact]
    public void Onvertaalbare_opmaak_in_de_beschrijving_weigert_het_doel() =>
        Assert.Contains("<sub>", Probleem(Doel(beschrijving: "H<sub>2</sub>O"), Plaats()));

    [Fact]
    public void Onvertaalbare_opmaak_in_een_clustertitel_weigert_het_doel_ook() =>
        Assert.Contains("<sub>", Probleem(Doel(), Plaats(cluster: "H<sub>2</sub>O")));

    [Fact]
    public void Een_lege_titel_wordt_geweigerd() =>
        Assert.Contains("title is empty", Probleem(Doel(titel: "<p> </p>"), Plaats()));

    [Fact]
    public void Een_te_lange_code_wordt_geweigerd() =>
        Assert.Contains("longer than 64", Probleem(Doel(code: new string('x', 65)), Plaats()));

    [Fact]
    public void Een_te_lange_subdomeintitel_wordt_geweigerd() =>
        Assert.Contains("longer than 256", Probleem(Doel(), Plaats(subdomein: new string('s', 257))));

    [Fact]
    public void Het_probleem_noemt_de_code() =>
        Assert.Equal("2.1.GL3.10", CurriculumdoelMapping.Map(Doel(titel: ""), Plaats(), Minimumdoelen).Probleem!.Value.Code);

    /// <summary>KOV writes <c>9-1</c>; this repo's seeded taxonomy (Art. VII.0) writes <c>9.1</c>.</summary>
    [Theory]
    [InlineData("9-1", "9.1")]
    [InlineData(" 9-3 ", "9.3")]
    [InlineData("9.2", "9.2")]
    [InlineData("2", "2")]
    [InlineData("11", "11")]
    public void Het_disciplinenummer_wordt_dat_van_deze_toepassing(string bron, string verwacht) =>
        Assert.Equal(verwacht, CurriculumdoelMapping.NormaliseerDisciplineNummer(bron));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("9-x")]
    [InlineData("1-2-3")]
    [InlineData("Wiskunde")]
    public void Een_disciplinenummer_van_een_andere_vorm_geeft_niets(string? bron) =>
        Assert.Null(CurriculumdoelMapping.NormaliseerDisciplineNummer(bron));

    private static string Probleem(KrcItemDto doel, Curriculumplaats plaats)
    {
        var (leerplandoel, probleem) = CurriculumdoelMapping.Map(doel, plaats, Minimumdoelen);
        Assert.Null(leerplandoel);
        return probleem!.Value.Reden;
    }
}
