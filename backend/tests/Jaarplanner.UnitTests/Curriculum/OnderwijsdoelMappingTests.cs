using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Infrastructure.OpstapImport;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// The single mapping from a KOV onderwijsdoel row to a <c>Minimumdoel</c> (Art. III.3, ADR-0032 decision 3). The rows
/// are copied from the live API on 2026-09-11, so the expected values are what a real import stores.
/// </summary>
public sealed class OnderwijsdoelMappingTests
{
    private static readonly DateTimeOffset Peildatum = new(2026, 9, 11, 12, 0, 0, TimeSpan.Zero);

    private static OnderwijsdoelDto Rij(
        string? uniqueCode = "K-1.3.9",
        string? code = "1.3.9",
        string? title = "<p>De kleuters kunnen actief deelnemen aan mondelinge interactievormen.</p>",
        string? description = null,
        DateTimeOffset? einde = null,
        string? path = "Nederlands > Mondeling taalgebruik > Mondelinge interactievaardigheden",
        string? type = "Te bereiken minimumdoelen op individueel niveau") =>
        new()
        {
            UniqueCode = uniqueCode,
            Code = code,
            Title = title,
            Description = description,
            Path = path,
            Type = type,
            Validity = new OnderwijsdoelGeldigheidDto
            {
                StartDate = new DateTimeOffset(2025, 9, 1, 0, 0, 0, TimeSpan.Zero),
                EndDate = einde,
            },
        };

    [Fact]
    public void Een_echte_rij_met_uitbreiding_wordt_een_minimumdoel()
    {
        var rij = Rij(
            title: "<p>De kleuters kunnen actief deelnemen aan mondelinge interactievormen zoals kringgesprekken, samen " +
                "spelen, gesprekken met gekende volwassenen en hierbij de volgende interactiestrategieën toepassen:</p>",
            description: "<ul><li>op een gepaste manier het woord nemen en vragen;</li><li>elkaar laten uitspreken;</li>" +
                "<li>inspelen op wat anderen zeggen;</li><li>standaardformules gebruiken bij het groeten, aanspreken, " +
                "bedanken en vragen.</li></ul>");

        var (doel, probleem) = OnderwijsdoelMapping.Map(rij, "/agodi/onderwijsdoelen/opstap/92958", Peildatum);

        Assert.Null(probleem);
        Assert.NotNull(doel);
        Assert.Equal("K-1.3.9", doel.Ref);
        Assert.Equal("K-", doel.Leeftijd);
        Assert.Equal("1.3.9", doel.Nr);
        Assert.Equal(
            "De kleuters kunnen actief deelnemen aan mondelinge interactievormen zoals kringgesprekken, samen spelen, " +
            "gesprekken met gekende volwassenen en hierbij de volgende interactiestrategieën toepassen:\n" +
            "- op een gepaste manier het woord nemen en vragen;\n" +
            "- elkaar laten uitspreken;\n" +
            "- inspelen op wat anderen zeggen;\n" +
            "- standaardformules gebruiken bij het groeten, aanspreken, bedanken en vragen.",
            doel.Omschrijving);
    }

    [Fact]
    public void Zonder_uitbreiding_is_de_omschrijving_de_doelzin()
    {
        var (doel, _) = OnderwijsdoelMapping.Map(
            Rij("4-5.2.1", "5.2.1", "<p>De leerlingen kennen het verschil tussen bron en bewijs.</p>"),
            href: null,
            Peildatum);

        Assert.Equal("4-", doel!.Leeftijd);
        Assert.Equal("De leerlingen kennen het verschil tussen bron en bewijs.", doel.Omschrijving);
    }

    [Theory]
    [InlineData("6-4.1.1", "6-", "4.1.1")]
    [InlineData("K-5.1.1", "K-", "5.1.1")]
    [InlineData("4-12", "4-", "12")]
    public void De_leeftijd_is_het_voorvoegsel_en_het_nummer_de_rest(string uniqueCode, string leeftijd, string nr)
    {
        var (doel, _) = OnderwijsdoelMapping.Map(Rij(uniqueCode, nr), href: null, Peildatum);

        Assert.Equal(uniqueCode, doel!.Ref);
        Assert.Equal(leeftijd, doel.Leeftijd);
        Assert.Equal(nr, doel.Nr);
    }

    [Theory]
    [InlineData("X-1.2")]
    [InlineData("K1.2")]
    [InlineData("K-")]
    [InlineData("K-1.2a")]
    [InlineData("")]
    public void Een_uniqueCode_van_de_verkeerde_vorm_wordt_niet_ingelezen(string uniqueCode)
    {
        var (doel, probleem) = OnderwijsdoelMapping.Map(Rij(uniqueCode), href: "/x/1", Peildatum);

        Assert.Null(doel);
        Assert.Equal(uniqueCode, probleem!.Value.Sleutel);
        Assert.Contains("uniqueCode", probleem.Value.Reden, StringComparison.Ordinal);
    }

    [Fact]
    public void Zonder_uniqueCode_noemt_het_probleem_de_href()
    {
        var (_, probleem) = OnderwijsdoelMapping.Map(Rij(uniqueCode: null), href: "/agodi/onderwijsdoelen/opstap/1", Peildatum);

        Assert.Equal("/agodi/onderwijsdoelen/opstap/1", probleem!.Value.Sleutel);
    }

    [Fact]
    public void Een_code_die_niet_bij_de_uniqueCode_past_wordt_niet_ingelezen()
    {
        var (doel, probleem) = OnderwijsdoelMapping.Map(Rij("K-1.3.9", code: "1.3.10"), href: null, Peildatum);

        Assert.Null(doel);
        Assert.Contains("does not match", probleem!.Value.Reden, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("<p>&nbsp;</p>")]
    public void Zonder_doelzin_is_er_geen_decretale_tekst(string? title)
    {
        var (doel, probleem) = OnderwijsdoelMapping.Map(Rij(title: title), href: null, Peildatum);

        Assert.Null(doel);
        Assert.Contains("title is empty", probleem!.Value.Reden, StringComparison.Ordinal);
    }

    /// <summary>Refused, not stripped: an unknown tag may carry part of the decreed text (Art. III.1).</summary>
    [Fact]
    public void Een_rij_met_onbekende_opmaak_wordt_geweigerd_in_plaats_van_veranderd()
    {
        var (doel, probleem) = OnderwijsdoelMapping.Map(
            Rij(description: "<p>De oppervlakte is <math><msup><mn>2</mn><mn>3</mn></msup></math> m.</p>"),
            href: null,
            Peildatum);

        Assert.Null(doel);
        Assert.Contains("<math>, <msup>, <mn>", probleem!.Value.Reden, StringComparison.Ordinal);
        Assert.Contains("could change the decreed text", probleem.Value.Reden, StringComparison.Ordinal);
    }

    [Fact]
    public void Een_verlopen_minimumdoel_wordt_niet_ingelezen()
    {
        var (doel, probleem) = OnderwijsdoelMapping.Map(Rij(einde: Peildatum.AddDays(-1)), href: null, Peildatum);

        Assert.Null(doel);
        Assert.Contains("validity ended on 2026-09-10", probleem!.Value.Reden, StringComparison.Ordinal);
    }

    [Fact]
    public void Een_minimumdoel_met_een_einddatum_in_de_toekomst_wordt_ingelezen()
    {
        var (doel, probleem) = OnderwijsdoelMapping.Map(Rij(einde: Peildatum.AddYears(1)), href: null, Peildatum);

        Assert.Null(probleem);
        Assert.NotNull(doel);
    }

    /// <summary>TB-010: <c>path</c> is the decree's own ordering, three levels verbatim (a real row of 2026-09-14).</summary>
    [Fact]
    public void Het_pad_wordt_de_ordening_van_het_decreet()
    {
        var (doel, _) = OnderwijsdoelMapping.Map(
            Rij("K-5.1.1", "5.1.1", path: "Geschiedenis > Kennis van het verleden > Prehistorie", type: "Na te streven minimumdoelen op populatieniveau"),
            href: null,
            Peildatum);

        Assert.Equal("Geschiedenis", doel!.Leergebied);
        Assert.Equal("Kennis van het verleden", doel.Rubriek);
        Assert.Equal("Prehistorie", doel.Subrubriek);
        Assert.Equal(MinimumdoelSoort.NaTeStreven, doel.Soort);
    }

    /// <summary>A whole rubriek of the decree has no third level; 54 minimumdoelen have a path of two.</summary>
    [Fact]
    public void Een_pad_met_twee_niveaus_heeft_geen_subrubriek()
    {
        var (doel, _) = OnderwijsdoelMapping.Map(Rij(path: "Attitudes > Leren leren"), href: null, Peildatum);

        Assert.Equal("Attitudes", doel!.Leergebied);
        Assert.Equal("Leren leren", doel.Rubriek);
        Assert.Null(doel.Subrubriek);
    }

    /// <summary>
    /// A path of another shape leaves the ordering empty and never costs the row: the eindterm is decreed whatever its
    /// heading, and the register lists it apart.
    /// </summary>
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Nederlands")]
    [InlineData("Nederlands > Lezen > Tekstbegrip > Extra")]
    [InlineData("Nederlands >  > Tekstbegrip")]
    [InlineData("Nederlands > <b>Lezen</b>")]
    [InlineData("Nederlands>Lezen")]
    public void Een_pad_van_een_andere_vorm_laat_de_ordening_leeg_en_weigert_de_rij_niet(string? path)
    {
        var (doel, probleem) = OnderwijsdoelMapping.Map(Rij(path: path), href: null, Peildatum);

        Assert.Null(probleem);
        Assert.NotNull(doel);
        Assert.Null(doel.Leergebied);
        Assert.Null(doel.Rubriek);
        Assert.Null(doel.Subrubriek);
    }

    [Fact]
    public void Een_niveau_breder_dan_de_kolom_laat_de_ordening_leeg()
    {
        var lang = new string('a', Minimumdoel.MaxOrdeningLengte + 1);

        var (doel, _) = OnderwijsdoelMapping.Map(Rij(path: $"Nederlands > {lang}"), href: null, Peildatum);

        Assert.Null(doel!.Leergebied);
    }

    [Theory]
    [InlineData("Te bereiken minimumdoelen op individueel niveau", MinimumdoelSoort.TeBereikenIndividueel)]
    [InlineData("Te bereiken minimumdoelen op populatieniveau", MinimumdoelSoort.TeBereikenPopulatie)]
    [InlineData("Na te streven minimumdoelen op populatieniveau", MinimumdoelSoort.NaTeStreven)]
    [InlineData(" Na te streven minimumdoelen op populatieniveau ", MinimumdoelSoort.NaTeStreven)]
    [InlineData("Een nieuwe soort", null)]
    [InlineData(null, null)]
    public void Het_type_wordt_de_soort_van_het_decreet(string? type, MinimumdoelSoort? soort)
    {
        var (doel, probleem) = OnderwijsdoelMapping.Map(Rij(type: type), href: null, Peildatum);

        Assert.Null(probleem);
        Assert.Equal(soort, doel!.Soort);
    }
}
