using Jaarplanner.Infrastructure.OpstapImport;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// Splitting a goal's description into voorbeelden, woordenschat and toelichting (E1-21). Every heading form here was
/// counted in the G goals of snapshot 1.2; the counts are in the E1-21 worklog. The property that matters most is the
/// last one in the class doc of <see cref="OpstapBeschrijving"/>: nothing is lost, only placed.
/// </summary>
public sealed class OpstapBeschrijvingTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void Een_lege_beschrijving_geeft_drie_keer_niets(string? html) =>
        Assert.Equal((null, null, null), OpstapBeschrijving.Splits(html));

    /// <summary>Without a heading the whole text is toelichting, exactly as the converter writes it.</summary>
    [Fact]
    public void Zonder_kop_is_alles_toelichting()
    {
        const string html = "Machten van tien zijn getallen zoals <br>10<sup>2</sup>=10x10= 100";

        var (voorbeelden, woordenschat, toelichting) = OpstapBeschrijving.Splits(html);

        Assert.Null(voorbeelden);
        Assert.Null(woordenschat);
        Assert.Equal("Machten van tien zijn getallen zoals\n10^2=10x10= 100", toelichting);
        Assert.Equal(OpstapHtml.NaarTekst(html), toelichting);
    }

    /// <summary><c>2.1.GL3.10</c>: the label is dropped, what follows it is the examples, what precedes it the toelichting.</summary>
    [Fact]
    public void Het_label_valt_weg_en_wat_volgt_zijn_de_voorbeelden()
    {
        var (voorbeelden, woordenschat, toelichting) = OpstapBeschrijving.Splits(
            "Machten van tien zijn getallen zoals <br>10<sup>1</sup>= 10<br><br><strong>Voorbeeld(en):</strong>" +
            "<ul><li>Wel 105, 110, 115…</li><li>Wel 22,24,26</li></ul>");

        Assert.Equal("- Wel 105, 110, 115…\n- Wel 22,24,26", voorbeelden);
        Assert.Null(woordenschat);
        Assert.Equal("Machten van tien zijn getallen zoals\n10^1= 10", toelichting);
    }

    /// <summary>
    /// Every way KOV wrote the label in snapshot 1.2: the colon inside or outside the bold, the word split over two bold
    /// runs (<c>4.3.GL2.4</c>), bold inside bold, a span inside bold (<c>6.6.GL6.15</c>), a bare span on its own line
    /// (<c>9-3.2.GL4.7</c>), and KOV's typo <c>Voorbeel(den)</c>.
    /// </summary>
    [Theory]
    [InlineData("<strong>Voorbeeld(en):</strong>")]
    [InlineData("<strong>Voorbeeld(en): </strong>")]
    [InlineData("<strong>Voorbeelden:</strong>")]
    [InlineData("<strong>Voorbeeld:</strong>")]
    [InlineData("<strong>Voorbeeld</strong>:")]
    [InlineData("<strong>Voorbeeld(en)</strong>:")]
    [InlineData("<strong>Voorbeel(den):</strong>")]
    [InlineData("<strong>V</strong><strong>oorbeeld(en):</strong>")]
    [InlineData("<strong><strong>Voorbeelden:</strong></strong>")]
    [InlineData("<strong><span class=\"iNqyIf\">Voorbeeld(en):</span></strong>")]
    [InlineData("<span>Voorbeelden:</span>")]
    public void Elke_labelvorm_uit_de_bron_opent_de_voorbeelden(string label)
    {
        var (voorbeelden, _, toelichting) = OpstapBeschrijving.Splits(
            $"Herkennen.<br>{label}<ul><li>een plattegrond van de school</li></ul>");

        Assert.Equal("- een plattegrond van de school", voorbeelden);
        Assert.Equal("Herkennen.", toelichting);
    }

    [Fact]
    public void De_woordenschat_krijgt_een_eigen_veld()
    {
        var (voorbeelden, woordenschat, toelichting) = OpstapBeschrijving.Splits(
            "<strong>Toelichting:</strong> Kinderen ordenen gebeurtenissen in de tijd.<br>" +
            "<strong>Richtinggevende woordenschat:</strong> hedendaagse tijd, vroegmoderne tijd");

        Assert.Null(voorbeelden);
        Assert.Equal("hedendaagse tijd, vroegmoderne tijd", woordenschat);
        Assert.Equal("Kinderen ordenen gebeurtenissen in de tijd.", toelichting);
    }

    [Fact]
    public void Een_dubbelepunt_na_het_vet_hoort_bij_het_label() =>
        Assert.Equal(
            "democratie, rechtsstaat",
            OpstapBeschrijving.Splits("<strong>Richtinggevende woordenschat</strong>: democratie, rechtsstaat").Woordenschat);

    /// <summary><c>2.5.GL6.6</c> and <c>2.2.GL2.2</c>: a heading that names its example stays, as the example's first line.</summary>
    [Fact]
    public void Een_kop_met_een_titel_blijft_de_eerste_regel()
    {
        var (voorbeelden, _, toelichting) = OpstapBeschrijving.Splits(
            "<strong>Toelichting</strong><br>Uitleg.<br><strong>Voorbeeld 1: </strong><strong>Dobbelsteen</strong><br>Vraag?" +
            "<br><strong>Voorbeeld 2</strong>: Knikkers<br>Vraag twee?");

        Assert.Equal("Voorbeeld 1: Dobbelsteen\nVraag?\nVoorbeeld 2: Knikkers\nVraag twee?", voorbeelden);
        Assert.Equal("Uitleg.", toelichting);
    }

    /// <summary>
    /// The didactic sections KOV writes after the examples (9 × "Mogelijke aanpak in de klaspraktijk", 5 × "Verdere
    /// referenties" in snapshot 1.2) are toelichting, and keep their heading.
    /// </summary>
    [Fact]
    public void Didactische_secties_na_de_voorbeelden_horen_bij_de_toelichting()
    {
        var (voorbeelden, _, toelichting) = OpstapBeschrijving.Splits(
            "Inleiding.<br><strong>Voorbeelden:</strong><ul><li>een</li></ul>" +
            "<strong>Mogelijke aanpak in de klaspraktijk</strong><br>Stap 1.<br><strong>Verdere referenties</strong><br>Bron X.");

        Assert.Equal("- een", voorbeelden);
        Assert.Equal("Inleiding.\nMogelijke aanpak in de klaspraktijk\nStap 1.\nVerdere referenties\nBron X.", toelichting);
    }

    /// <summary>Bold at the start of a line that is no heading (sums, emoji, a subtitle) is content of its section.</summary>
    [Fact]
    public void Ander_vet_aan_het_begin_van_een_regel_blijft_in_zijn_sectie()
    {
        var (voorbeelden, _, toelichting) = OpstapBeschrijving.Splits(
            "<strong>Voorbeelden:</strong><br><strong>6 × 19</strong><br>= 114<br><strong>🐰 🐰</strong><br><strong>Spelsituatie</strong>");

        Assert.Equal("6 × 19\n= 114\n🐰 🐰\nSpelsituatie", voorbeelden);
        Assert.Null(toelichting);
    }

    [Fact]
    public void Vet_binnen_een_lijstitem_is_geen_kop()
    {
        var (voorbeelden, _, toelichting) = OpstapBeschrijving.Splits("<ul><li><strong>Voorbeelden:</strong> een</li></ul>");

        Assert.Null(voorbeelden);
        Assert.Equal("- Voorbeelden: een", toelichting);
    }

    [Fact]
    public void Een_woord_dat_met_voorbeeld_begint_is_geen_kop()
    {
        var (voorbeelden, _, toelichting) = OpstapBeschrijving.Splits("<strong>Voorbeeldgedrag</strong> is belangrijk.");

        Assert.Null(voorbeelden);
        Assert.Equal("Voorbeeldgedrag is belangrijk.", toelichting);
    }

    /// <summary><c>8.1.GL1.1</c>: both labels sit in one-cell layout tables, and are found once the tables are unwrapped.</summary>
    [Fact]
    public void Labels_in_een_opmaaktabel_worden_herkend()
    {
        var (voorbeelden, _, toelichting) = OpstapBeschrijving.Splits(
            "<table style=\"width: 50%;\"><tbody><tr><td><br><strong>Toelichting</strong>:</td></tr></tbody></table>" +
            "<table><tbody><tr><td><ul><li>Digitaal betekent dat een object met codes werkt.</li></ul> <strong>Voorbeeld(en)</strong>:" +
            "</td></tr></tbody></table><ul><li>Een filmpje van Youtube bekijken.</li></ul>");

        Assert.Equal("- Digitaal betekent dat een object met codes werkt.", toelichting);
        Assert.Equal("- Een filmpje van Youtube bekijken.", voorbeelden);
    }

    [Fact]
    public void Een_label_met_tekst_op_dezelfde_regel_begint_de_sectie_met_die_tekst() =>
        Assert.Equal(
            "Tijdens de les tellen we.",
            OpstapBeschrijving.Splits("<strong>Voorbeeld(en):</strong> Tijdens de les tellen we.").Voorbeelden);
}
