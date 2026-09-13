using Jaarplanner.Infrastructure.OpstapImport;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// The HTML-to-text conversion every KOV goal text passes through (ADR-0032 decision 3). The inputs are shaped after
/// what the API really returns: the minimumdoelen of 2026-09-11 (E1-12), including the nested paragraph-in-list-item of
/// <c>6-4.1.1</c>, and the G goals of curriculum snapshot 1.2 (E1-21), whose tables, ordered lists, KaTeX formulas and
/// MathML beyond plain fractions the E1-12 version refused 43 goals over.
/// </summary>
public sealed class OpstapHtmlTests
{
    private const string MathMl = "http://www.w3.org/1998/Math/MathML";

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
                "<math> <mfrac> <mn>1</mn> <mn>100</mn> </mfrac> </math> [I].</li></ul>"));

    /// <summary>
    /// 124 of the 132 formulas in the G goals of snapshot 1.2 wrap each number in <c>mrow</c>, carry the MathML namespace
    /// and sit in a <c>math-node</c> span (<c>2.1.GL2.20</c>). The E1-12 converter refused every one of them.
    /// </summary>
    [Fact]
    public void Een_breuk_met_mrow_en_naamruimte_wordt_een_breuk() =>
        Assert.Equal(
            "De leerlingen kennen de wiskundige notaties: 1/2, 1/4 [F].",
            OpstapHtml.NaarTekst(
                "De leerlingen kennen de wiskundige notaties: " +
                $"<span class=\"math-node\"><math xmlns=\"{MathMl}\"><mrow><mfrac><mrow><mn>1</mn></mrow><mrow><mn>2</mn></mrow></mfrac></mrow></math></span>, " +
                $"<span class=\"math-node\"><math xmlns=\"{MathMl}\"><mrow><mfrac><mrow><mn>1</mn></mrow><mrow><mn>4</mn></mrow></mfrac></mrow></math></span> [F]."));

    /// <summary><c>2.2.GL4.6</c>: an operator keeps its sign, between spaces.</summary>
    [Fact]
    public void Een_operator_houdt_zijn_teken() =>
        Assert.Equal(
            "Bewerking: 7/10 - 3/10",
            OpstapHtml.NaarTekst(
                $"Bewerking: <math xmlns=\"{MathMl}\"><mrow><mfrac><mrow><mn>7</mn></mrow><mrow><mn>10</mn></mrow></mfrac>" +
                "<mo>-</mo><mfrac><mrow><mn>3</mn></mrow><mrow><mn>10</mn></mrow></mfrac></mrow></math>"));

    /// <summary><c>2.5.GL6.6</c>: <c>semantics</c> keeps the formula and drops its LaTeX annotation, the same formula again.</summary>
    [Fact]
    public void Semantics_houdt_de_formule_en_laat_de_annotatie_weg() =>
        Assert.Equal(
            "kans = 1/6",
            OpstapHtml.NaarTekst(
                $"<math xmlns=\"{MathMl}\"><semantics><mrow><mtext>kans</mtext><mo>=</mo><mfrac><mn>1</mn><mn>6</mn></mfrac>" +
                "</mrow><annotation>\\text{kans}=\\frac{1}{6}</annotation></semantics></math>"));

    /// <summary>A numerator that is itself a sum keeps its grouping: (1 + 2)/3, not 1 + 2/3.</summary>
    [Fact]
    public void Een_samengestelde_teller_krijgt_haakjes() =>
        Assert.Equal(
            "(1 + 2)/3",
            OpstapHtml.NaarTekst("<math><mfrac><mrow><mn>1</mn><mo>+</mo><mn>2</mn></mrow><mn>3</mn></mfrac></math>"));

    /// <summary>
    /// <c>2.5.GL6.6</c>, shortened: KaTeX writes the formula as MathML and again as a visual copy. The copy goes, and a
    /// display formula gets its own line; before that fix "Berekening" and the formula ran together as "Berekening2/10".
    /// </summary>
    [Fact]
    public void KaTeX_schrijft_de_formule_een_keer_op_een_eigen_regel() =>
        Assert.Equal(
            "Berekening\n2/10 = 1/5\nDe leerlingen komen tot deze uitspraak.",
            OpstapHtml.NaarTekst(
                "Berekening<span class=\"katex-display\"><span class=\"katex\"><span class=\"katex-mathml\"><span class=\"math-node\">" +
                $"<math xmlns=\"{MathMl}\"><semantics><mrow><mfrac><mn>2</mn><mn>10</mn></mfrac><mo>=</mo><mfrac><mn>1</mn><mn>5</mn></mfrac>" +
                "</mrow><annotation>\\frac{2}{10}=\\frac{1}{5}</annotation></semantics></math></span></span>" +
                "<span class=\"katex-html\"><span class=\"base\"><span class=\"mord\"><span class=\"mfrac\"><span class=\"vlist\">" +
                "<span class=\"mord\">10</span><span class=\"mord\">2</span></span></span></span><span class=\"mrel\">=</span></span>" +
                "</span></span></span> De leerlingen komen tot deze uitspraak."));

    /// <summary>
    /// <c>2.4.GL1.2</c>, shortened: an ordered list keeps its numbers, and an unordered list inside an item keeps its
    /// dashes. The E1-12 converter refused <c>ol</c>, because turning numbers into dashes changes what a list says.
    /// </summary>
    [Fact]
    public void Een_geordende_lijst_houdt_haar_nummers() =>
        Assert.Equal(
            "1. De leerkracht toont een driehoek.\n2. Daarna zoeken ze voorwerpen:\n- klok → cirkel\n- raam → rechthoek\n3. De voorwerpen worden gesorteerd.",
            OpstapHtml.NaarTekst(
                "<ol><li>De leerkracht toont een driehoek.</li><li>Daarna zoeken ze voorwerpen:<ul><li>klok → cirkel</li>" +
                "<li>raam → rechthoek</li></ul></li><li>De voorwerpen worden gesorteerd.</li></ol>"));

    /// <summary><c>2.1.GL6.31</c>: an item that starts with a line break keeps its number next to its text.</summary>
    [Fact]
    public void Een_lijstitem_dat_met_een_regeleinde_begint_houdt_zijn_nummer() =>
        Assert.Equal(
            "1. Bereken de toename:\n- 11 500 − 10 000 = 1 500 inwoners\n2. Zet om naar een percentage:",
            OpstapHtml.NaarTekst(
                "<ol><li><br>Bereken de toename:<ul><li>11 500 − 10 000 = 1 500 inwoners</li></ul></li>" +
                "<li><br>Zet om naar een percentage:</li></ol>"));

    [Fact]
    public void Een_geordende_lijst_begint_bij_haar_startnummer() =>
        Assert.Equal("3. drie\n4. vier", OpstapHtml.NaarTekst("<ol start=\"3\"><li>drie</li><li>vier</li></ol>"));

    /// <summary><c>2.4.GL4.9</c> separates two examples with a rule.</summary>
    [Fact]
    public void Een_horizontale_lijn_wordt_een_nieuwe_regel() =>
        Assert.Equal("Besluit.\nVoorbeeld 2", OpstapHtml.NaarTekst("Besluit. <hr /><br><strong>Voorbeeld 2</strong>"));

    /// <summary><c>2.4.GL4.9</c>, shortened: one line per row, the cells between bars, headers as cells.</summary>
    [Fact]
    public void Een_tabel_wordt_een_regel_per_rij() =>
        Assert.Equal(
            "Een fiche.\nEigenschap | Vierkant | Ruit\n4 rechte hoeken | ✓ | ✗\nKlaar.",
            OpstapHtml.NaarTekst(
                "Een fiche.<table style=\"min-width: 50%;\"><thead><tr><th>Eigenschap</th><th>Vierkant</th><th>Ruit</th></tr></thead>" +
                "<tbody><tr><td style=\"border: 1px solid #e6e6e6;\">4 rechte hoeken</td><td>✓</td><td>✗</td></tr></tbody></table>Klaar."));

    /// <summary><c>8.1.GL1.1</c>: KOV uses one-cell tables for layout. The cell's content stands where the table stood.</summary>
    [Fact]
    public void Een_tabel_van_een_cel_is_opmaak() =>
        Assert.Equal(
            "Toelichting:\n- Digitaal betekent dat een object met codes werkt.",
            OpstapHtml.NaarTekst(
                "<table style=\"width: 50%;\"><tbody><tr><td style=\"width: 98%;\"><br><strong>Toelichting</strong>:</td></tr></tbody></table>" +
                "<table><tbody><tr><td><ul><li>Digitaal betekent dat een object met codes werkt.</li></ul></td></tr></tbody></table>"));

    /// <summary>
    /// <c>2.2.GL2.2</c> draws "4 rijen met telkens 5 stoelen" as an empty 4 × 5 table. Text cannot draw it, so it is
    /// named, the way an image without text is: stripping it would lose that there is a picture, and flattening it would
    /// write rows of bars.
    /// </summary>
    [Theory]
    [InlineData("<table border=\"1\"><tbody><tr><td> </td><td>&nbsp;</td><td></td></tr><tr><td> </td><td> </td><td> </td></tr></tbody></table>", "[lege tabel van 2 rijen en 3 kolommen]")]
    [InlineData("<table><tr><td> </td><td> </td></tr></table>", "[lege tabel van 1 rij en 2 kolommen]")]
    public void Een_lege_tabel_wordt_benoemd(string html, string verwacht) =>
        Assert.Equal(verwacht, OpstapHtml.NaarTekst(html));

    /// <summary>
    /// An image is content without text (antagonist round 1, MAJOR 2). A table of images was read as empty and written as
    /// "[lege tabel …]", losing every alt text; now it is refused. A one-cell layout table still unwraps to the image.
    /// </summary>
    [Fact]
    public void Een_tabel_van_afbeeldingen_is_niet_leeg_en_wordt_geweigerd()
    {
        Assert.Contains("<table>", OpstapHtml.OnvertaalbareOpmaak(
            "<table><tr><td><img alt=\"appel\"></td><td><img alt=\"peer\"></td></tr></table>"));
        Assert.Equal("[afbeelding: appel]", OpstapHtml.NaarTekst("<table><tr><td><img alt=\"appel\"></td></tr></table>"));
    }

    /// <summary>A link without text is not empty either: its address is what it says, so the cell keeps it.</summary>
    [Fact]
    public void Een_cel_met_alleen_een_link_zonder_tekst_houdt_het_adres()
    {
        const string html = "<table><tr><td><a href=\"https://x.test/a\"></a></td><td><a href=\"https://x.test/b\"></a></td></tr></table>";

        Assert.Empty(OpstapHtml.OnvertaalbareOpmaak(html));
        Assert.Equal("(https://x.test/a) | (https://x.test/b)", OpstapHtml.NaarTekst(html));
    }

    /// <summary>
    /// Two levels of numbers flattened onto one would read "1. 1. 2." without their level, so an ordered list inside an
    /// ordered list is refused. An ordered list inside an unordered one keeps both: its numbers and the parent's dashes.
    /// </summary>
    [Fact]
    public void Een_geneste_geordende_lijst_wordt_geweigerd()
    {
        Assert.Contains("<ol>", OpstapHtml.OnvertaalbareOpmaak("<ol><li>a<ol><li>b</li></ol></li><li>c</li></ol>"));
        Assert.Contains("<ol>", OpstapHtml.OnvertaalbareOpmaak("<ol><li>a<ul><li>b<ol><li>c</li></ol></li></ul></li></ol>"));
        Assert.Equal("- x\n1. y", OpstapHtml.NaarTekst("<ul><li>x<ol><li>y</li></ol></li></ul>"));
    }

    [Fact]
    public void Vet_blijft_gemarkeerd_als_daarom_gevraagd_wordt() =>
        Assert.Equal(
            "\u0001Voorbeeld(en):\u0002\n- een",
            OpstapHtml.NaarTekst("<strong>Voorbeeld(en):</strong><ul><li>een</li></ul>", behoudVet: true));

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
            "<img alt=\"e\"/><math><mfrac><mn>1</mn><mn>2</mn></mfrac></math><ol><li>f</li></ol><hr>" +
            "<table><tr><th>g</th><th>h</th></tr><tr><td>1</td><td>2</td></tr></table>"));

    /// <summary>
    /// MathML the data does not use, and a table that cannot be flattened, are named, not guessed at. The rewrite leaves
    /// them standing, so every tag in them is named.
    /// </summary>
    [Fact]
    public void Onbekende_opmaak_wordt_bij_naam_genoemd() =>
        Assert.Equal(
            ["<table>", "<tr>", "<math>", "<msup>", "<mn>"],
            OpstapHtml.OnvertaalbareOpmaak("<table><tr>x</tr></table><math><msup><mn>2</mn><mn>3</mn></msup></math>"));

    /// <summary>Each of these would lose content if stripped, so each is refused rather than converted.</summary>
    [Theory]
    [InlineData("<ol type=\"a\"><li>eerst</li><li>dan</li></ol>", "<ol>")]
    [InlineData("<ol><li>open", "<ol>")]
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
    [InlineData("<math><mfrac><mn>1</mn></mfrac></math>", "<math>")]
    [InlineData("<math><mn>1&nbsp;</mn></math>", "<math>")]
    [InlineData("<math><mrow>los<mn>1</mn></mrow></math>", "<math>")]
    [InlineData("<math><annotation>1</annotation></math>", "<math>")]
    [InlineData("<table><tr><td colspan=\"2\">a</td></tr><tr><td>b</td><td>c</td></tr></table>", "<table>")]
    [InlineData("<table><tr><td>a<br>b</td><td>c</td></tr></table>", "<table>")]
    [InlineData("<table><tr><td><table><tr><td>a</td></tr></table></td><td>b</td></tr></table>", "<table>")]
    [InlineData("<span class=\"katex-html\"><span>2</span>", "<span class=\"katex-html\"> without its closing tag")]
    [InlineData("a\u0001b", "control character U+0001 or U+0002")]
    public void Opmaak_die_inhoud_zou_verliezen_wordt_genoemd(string html, string verwacht) =>
        Assert.Contains(verwacht, OpstapHtml.OnvertaalbareOpmaak(html));
}
