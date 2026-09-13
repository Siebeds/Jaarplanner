using Jaarplanner.Infrastructure.OpstapImport;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// The HTML-to-text conversion every KOV goal text passes through (ADR-0032 decision 3). The inputs are shaped after
/// what the API really returns on 2026-09-11, including the nested paragraph-in-list-item of <c>6-4.1.1</c>.
/// </summary>
public sealed class OpstapHtmlTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Lege_invoer_geeft_lege_tekst(string? html) =>
        Assert.Equal(string.Empty, OpstapHtml.NaarTekst(html));

    [Fact]
    public void Een_paragraaf_wordt_zijn_tekst() =>
        Assert.Equal(
            "De leerlingen kennen het verschil tussen bron en bewijs.",
            OpstapHtml.NaarTekst("<p>De leerlingen kennen het verschil tussen bron en bewijs.</p>"));

    [Fact]
    public void Een_lijst_wordt_een_regel_per_item_met_een_streepje() =>
        Assert.Equal(
            "- elkaar laten uitspreken;\n- inspelen op wat anderen zeggen;",
            OpstapHtml.NaarTekst("<ul><li>elkaar laten uitspreken;</li><li>inspelen op wat anderen zeggen;</li></ul>"));

    [Fact]
    public void Een_paragraaf_in_een_lijstitem_met_harde_spaties_blijft_een_regel() =>
        Assert.Equal(
            "- Egypte, Marokko, Congo, Zuid-Afrika;\n- Australië, Nieuw-Zeeland;",
            OpstapHtml.NaarTekst(
                "<ul><li><p>Egypte, Marokko, Congo, Zuid-Afrika;&nbsp;</p></li></ul>" +
                "<ul><li><p>Australië, Nieuw-Zeeland;&nbsp;</p></li></ul>"));

    [Fact]
    public void Een_regeleinde_wordt_een_nieuwe_regel() =>
        Assert.Equal("a\nb\nc", OpstapHtml.NaarTekst("a<br>b<br />c"));

    [Fact]
    public void Andere_tags_verdwijnen_en_hun_tekst_blijft() =>
        Assert.Equal(
            "Voorbeeld(en): het woord jas begrijpen.",
            OpstapHtml.NaarTekst("<strong>Voorbeeld(en):</strong> het woord <em>jas</em> begrijpen."));

    /// <summary>
    /// Entities are decoded after the tags are gone, so an escaped angle bracket in KOV's data stays text. Decoding first
    /// would have turned it into a tag and then deleted it.
    /// </summary>
    [Fact]
    public void Een_geescapete_hoek_blijft_zichtbare_tekst() =>
        Assert.Equal("5 &lt; 7 blijft 5 < 7 & klopt", OpstapHtml.NaarTekst("5 &amp;lt; 7 blijft 5 &lt; 7 &amp; klopt"));

    [Fact]
    public void Een_leeg_lijstitem_laat_geen_los_streepje_achter() =>
        Assert.Equal("- een", OpstapHtml.NaarTekst("<ul><li>een</li><li></li><li> </li></ul>"));

    [Fact]
    public void Witruimte_binnen_een_regel_wordt_een_spatie() =>
        Assert.Equal("een twee drie", OpstapHtml.NaarTekst("<p>een \t twee&nbsp;&nbsp; drie</p>"));

    /// <summary>
    /// KOV writes examples inside the decreed text between literal angle brackets (126 of 998 minimumdoelen on
    /// 2026-09-11, e.g. <c>K-9.1.4</c>). They are text and must survive: the first live contract run caught a test that
    /// assumed otherwise.
    /// </summary>
    [Theory]
    [InlineData("<p>&lt; bv. tanden poetsen en handen wassen &gt;</p>", "< bv. tanden poetsen en handen wassen >")]
    [InlineData("<p>&lt;bv. fietsband plakken, batterij vervangen &gt;</p>", "<bv. fietsband plakken, batterij vervangen >")]
    public void KOVs_hoekhaken_rond_een_voorbeeld_blijven_staan(string html, string verwacht) =>
        Assert.Equal(verwacht, OpstapHtml.NaarTekst(html));

    /// <summary>49 MathML fractions on 2026-09-11. Stripping the tags would have turned 1/10 into 110.</summary>
    [Fact]
    public void Een_mathml_breuk_wordt_teller_schuine_streep_noemer() =>
        Assert.Equal(
            "- lezen met zowel schuine (3/4) als horizontale (3/4) breukstreep;\n- via de breuken 1/10 en 1/100 [I].",
            OpstapHtml.NaarTekst(
                "<ul><li>lezen met zowel schuine (3/4) als horizontale (<math><mfrac><mn>3</mn><mn>4</mn></mfrac></math>) " +
                "breukstreep;</li><li>via de breuken <math><mfrac><mn>1</mn><mn>10</mn></mfrac></math> en " +
                "<math><mfrac><mn>1</mn><mn>100</mn></mfrac></math> [I].</li></ul>"));

    /// <summary>The Frans minimumdoelen point at their word list with a link; the address is part of what they say.</summary>
    [Fact]
    public void Een_link_houdt_zijn_adres() =>
        Assert.Equal(
            "vermeld in de woordenlijst Frans (Word (https://assets.vlaanderen.be/raw/upload/Woordenlijst_Frans.docx))",
            OpstapHtml.NaarTekst(
                "vermeld in de woordenlijst Frans (<a href=\"https://assets.vlaanderen.be/raw/upload/Woordenlijst_Frans.docx\" " +
                "target=\"_blank\">Word</a>)"));

    /// <summary><c>6-3.5.1</c> shows circuit symbols as images; their alt text is what a text-only copy can keep.</summary>
    [Fact]
    public void Een_afbeelding_wordt_haar_alt_tekst_op_een_eigen_regel() =>
        Assert.Equal(
            "- de isolator\n[afbeelding: De energiebron]\n[afbeelding: De lamp]\n[afbeelding]",
            OpstapHtml.NaarTekst(
                "<ul><li>de isolator</li></ul><img src=\"https://x/energiebron.png\" alt=\"De energiebron\"/>" +
                "<img src=\"https://x/lamp.png\" alt=\"De lamp\"/><img src=\"https://x/zonder.png\"/>"));

    /// <summary><c>2.1.GL3.10</c> in the curriculum: stripping the tag would have written 102.</summary>
    [Fact]
    public void Een_superscript_wordt_een_macht() =>
        Assert.Equal("10^2=10x10= 100", OpstapHtml.NaarTekst("10<sup>2</sup>=10x10= 100"));

    /// <summary>
    /// A raw <c>&lt;</c> used as a sign is text. <c>2.1.GL1.2</c> in the curriculum would otherwise have lost
    /// <c>&lt;, &gt;</c> to the tag stripper, and <c>2.3.GL2.48</c> its <c>(&lt; 1 week)</c> as soon as a <c>&gt;</c>
    /// followed.
    /// </summary>
    [Theory]
    [InlineData("<p>De leerlingen kennen de tekens =, ≠, <, > (tussen getallen).</p>", "De leerlingen kennen de tekens =, ≠, <, > (tussen getallen).")]
    [InlineData("<p>kort (< 1 week) of lang (> 1 week)</p>", "kort (< 1 week) of lang (> 1 week)")]
    public void Een_kale_kleiner_dan_is_tekst(string html, string verwacht) =>
        Assert.Equal(verwacht, OpstapHtml.NaarTekst(html));

    [Fact]
    public void Gekende_opmaak_is_vertaalbaar() =>
        Assert.Empty(OpstapHtml.OnvertaalbareOpmaak(
            "<p>a<br/><strong>b</strong> <em>c</em> 10<sup>2</sup> =, <, ></p><ul><li><a href=\"x\">d</a></li></ul>" +
            "<img alt=\"e\"/><math><mfrac><mn>1</mn><mn>2</mn></mfrac></math>"));

    /// <summary>MathML is known only in the fraction shape; any other shape is named, not guessed at.</summary>
    [Fact]
    public void Onbekende_opmaak_wordt_bij_naam_genoemd() =>
        Assert.Equal(
            ["<table>", "<tr>", "<math>", "<msup>", "<mn>"],
            OpstapHtml.OnvertaalbareOpmaak("<table><tr>x</tr></table><math><msup><mn>2</mn><mn>3</mn></msup></math>"));

    /// <summary>Each of these would lose content if stripped, so each is refused rather than converted.</summary>
    [Theory]
    [InlineData("<ol><li>eerst</li><li>dan</li></ol>", "<ol>")]
    [InlineData("H<sub>2</sub>O", "<sub>")]
    [InlineData("<img src=\"x.png\"/>", "<img> without alt text")]
    [InlineData("<img src=\"x.png\" alt=\"\"/>", "<img> without alt text")]
    [InlineData("<a href='https://x'>woordenlijst</a>", "<a> without a closing tag or a double-quoted href")]
    [InlineData("<a href=\"u\">w", "<a> without a closing tag or a double-quoted href")]
    [InlineData("10<sup class=\"x\">2</sup>", "<sup> other than a plain number")]
    [InlineData("10<sup><em>2</em></sup>", "<sup> other than a plain number")]
    [InlineData("x<sup>n+1</sup>", "<sup> other than a plain number")]
    [InlineData("2<sup>de</sup>", "<sup> other than a plain number")]
    [InlineData("<img data-alt=\"q\" src=\"x\">", "<img> without alt text")]
    public void Opmaak_die_inhoud_zou_verliezen_wordt_genoemd(string html, string verwacht) =>
        Assert.Contains(verwacht, OpstapHtml.OnvertaalbareOpmaak(html));
}
