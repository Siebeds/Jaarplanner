using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;

namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// Turns the HTML fragments KOV's API uses for goal texts into plain text (ADR-0032 decision 3), <b>without changing
/// what the text says</b> (Art. III.1). Every rule rests on a count of the real data: the 998 minimumdoelen of 2026-09-11
/// (E1-12) and the 5,835 G goals of curriculum snapshot 1.2 (E1-21, census in <c>backlog/worklogs/E1-21</c>).
/// <list type="bullet">
/// <item>A <c>&lt;</c> that does not start a tag (<c>=, ≠, &lt;, &gt;</c>, <c>(&lt; 1 week)</c>) is text and is kept.</item>
/// <item>A paragraph, line break, horizontal rule or list end becomes a newline; an unordered list item a line starting
/// with <c>"- "</c>, an ordered one a line starting with its number (<c>"1. "</c>), because the numbering is part of what an
/// ordered list says. An ordered list inside another ordered list is refused: flattened, its numbers would repeat
/// without their level.</item>
/// <item>MathML is converted element by element, not stripped: a fraction becomes <c>1/2</c> (stripping would have written
/// <c>12</c>), an operator keeps its sign between spaces (<c>7/10 - 3/10</c>, <c>kans = 1/6</c>), <c>mrow</c> groups and
/// <c>semantics</c> keeps its presentation and drops its <c>annotation</c> (the same formula again in LaTeX). Only the
/// elements the data uses are known; any other MathML element is refused. A superscript that is a plain number,
/// <c>10&lt;sup&gt;2&lt;/sup&gt;</c>, becomes <c>10^2</c>.</item>
/// <item>KaTeX renders a formula twice, as MathML and as a visual copy in <c>&lt;span class="katex-html"&gt;</c>. The
/// visual copy is dropped and the MathML kept, or the formula would be written three times in a row.</item>
/// <item>A table becomes one line per row with its cells between <c>" | "</c>. A one-cell table is layout, not data, and
/// its content stands in its place. A table whose cells hold no text and no markup beyond plain formatting (<c>p</c>,
/// <c>div</c>, <c>span</c>, <c>br</c>, <c>hr</c>, bold, italics, underline) is a drawing (a grid to count): it becomes
/// <c>[lege tabel van 4 rijen en 5 kolommen]</c>, the same kind of marker an image without text gets. Any other element
/// in a cell is content even without text: in a table of several cells an image or an unknown element is refused, and a
/// link keeps its address.</item>
/// <item>A closed link with a double-quoted address keeps it: <c>Word (https://…)</c>. An image becomes its alt text on a
/// line of its own.</item>
/// <item>Entities are decoded only <b>after</b> the tags are gone, so KOV's escaped angle-bracket notation around
/// examples (<c>&amp;lt; bv. tanden poetsen &amp;gt;</c>) stays visible text.</item>
/// </list>
/// <para>
/// <b>What this class cannot convert faithfully, it does not guess at.</b> The shapes above are rewritten into plain,
/// known markup first (<see cref="Voorbereid"/>); whatever survives that step and is not on the known list is named by
/// <see cref="OnvertaalbareOpmaak"/>: an unknown tag (so any MathML, table or ordered list the rewrite could not take), any
/// <c>sup</c> that is not a plain number, a link that is not closed or whose address is not double-quoted, an image
/// without an <c>alt</c> attribute of its own, a KaTeX copy whose end cannot be found. The mapping then refuses the row
/// rather than import a text it may have altered.
/// </para>
/// <para>
/// <b>Why plain text and not sanitised HTML.</b> Nothing downstream should ever have to decide whether a stored
/// curriculum text is safe to render as markup. Storing text makes that question disappear.
/// </para>
/// </summary>
internal static partial class OpstapHtml
{
    /// <summary>Marks where bold text starts, for <see cref="NaarTekst(string?, bool)"/> with <c>behoudVet</c>.</summary>
    internal const char VetBegin = (char)1;

    /// <summary>Marks where bold text ends.</summary>
    internal const char VetEinde = (char)2;

    /// <summary>
    /// Tag names whose meaning <see cref="NaarTekst(string?)"/> can preserve. Being on this list is necessary, not
    /// sufficient: <c>sup</c>, <c>a</c> and <c>img</c> are only convertible in the shapes <see cref="OnvertaalbareOpmaak"/>
    /// checks for. MathML, tables, <c>ol</c> and <c>hr</c> are absent on purpose: <see cref="Voorbereid"/> rewrites the
    /// shapes of them it can keep, so any that are left over are exactly the ones it could not.
    /// </summary>
    private static readonly HashSet<string> BekendeTags = new(StringComparer.OrdinalIgnoreCase)
    {
        "p", "div", "span", "br", "ul", "li", "strong", "b", "em", "i", "u", "sup",
        "h1", "h2", "h3", "h4", "h5", "h6", "a", "img",
    };

    /// <summary>
    /// The MathML containers whose children are simply read in order. With <c>semantics</c>, <c>mfrac</c> and the token
    /// elements (<c>mn</c>, <c>mi</c>, <c>mo</c>, <c>mtext</c>) these are the only MathML elements the data uses, and so
    /// the only ones <see cref="Wiskunde"/> converts.
    /// </summary>
    private static readonly HashSet<string> WiskundeGroepen = new(StringComparer.Ordinal) { "math", "mrow" };

    /// <summary>
    /// The elements that carry no content of their own: layout, line breaks, emphasis and table structure. A table cell
    /// holding only these, and no text, is empty; anything else in it is content (<see cref="IsLeeg"/>).
    /// </summary>
    private static readonly HashSet<string> TekstlozeOpmaak = new(StringComparer.OrdinalIgnoreCase)
    {
        "p", "div", "span", "br", "hr", "strong", "b", "em", "i", "u",
        "table", "thead", "tbody", "tfoot", "tr", "td", "th",
    };

    /// <summary>Converts one HTML fragment to plain text; returns an empty string for null or blank input.</summary>
    public static string NaarTekst(string? html) => NaarTekst(html, behoudVet: false);

    /// <summary>
    /// Converts one HTML fragment to plain text. With <paramref name="behoudVet"/>, bold text stays wrapped in
    /// <see cref="VetBegin"/> and <see cref="VetEinde"/>, so <see cref="OpstapBeschrijving"/> can find the section headings
    /// KOV writes in bold after the text is already plain; the caller removes the markers.
    /// </summary>
    internal static string NaarTekst(string? html, bool behoudVet)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return string.Empty;
        }

        var tekst = Voorbereid(html);
        tekst = Afbeelding().Replace(tekst, m =>
        {
            var alt = AltTekst().Match(m.Value);
            return alt.Success && !string.IsNullOrWhiteSpace(alt.Groups[1].Value)
                ? $"\n[afbeelding: {alt.Groups[1].Value}]\n"
                : "\n[afbeelding]\n";
        });
        tekst = Link().Replace(tekst, "$2 ($1)");
        if (behoudVet)
        {
            tekst = VetOpening().Replace(tekst, VetBegin.ToString());
            tekst = VetSluiting().Replace(tekst, VetEinde.ToString());
        }

        tekst = Regeleinde().Replace(tekst, "\n");
        tekst = Lijstitem().Replace(tekst, "\n- ");
        tekst = Tag().Replace(tekst, string.Empty);
        // &nbsp; decodes to U+00A0, which the whitespace rule below would otherwise leave standing.
        tekst = WebUtility.HtmlDecode(tekst).Replace((char)0xA0, ' ');

        var regels = tekst
            .Split('\n')
            .Select(regel => Witruimte().Replace(regel, " ").Trim())
            // A lone "-" is what an empty <li></li> leaves behind.
            .Where(regel => regel.Length > 0 && regel != "-");

        return string.Join('\n', regels);
    }

    /// <summary>
    /// Everything in <paramref name="html"/> that <see cref="NaarTekst(string?)"/> would not convert faithfully, as short
    /// English descriptions (<c>&lt;sub&gt;</c>, <c>&lt;img&gt; without alt text</c>), distinct and in order of appearance.
    /// Empty when the fragment is safe to convert.
    /// </summary>
    public static IReadOnlyList<string> OnvertaalbareOpmaak(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return [];
        }

        var gevonden = new List<string>();

        // The bold markers must mean what NaarTekst puts there and nothing else.
        if (html.Contains(VetBegin) || html.Contains(VetEinde))
        {
            gevonden.Add("control character U+0001 or U+0002");
        }

        var voorbereid = Voorbereid(html);

        foreach (Match tag in TagNaam().Matches(voorbereid))
        {
            var naam = tag.Groups[1].Value.ToLowerInvariant();
            if (!BekendeTags.Contains(naam))
            {
                gevonden.Add($"<{naam}>");
            }
        }

        // Voorbereid has rewritten every plain-number superscript, so any <sup> still standing is one it could not keep
        // (an attribute, markup inside, "n+1", an ordinal like "2de").
        if (SupOpening().IsMatch(voorbereid))
        {
            gevonden.Add("<sup> other than a plain number");
        }

        // Voorbereid removes every KaTeX copy it can find the end of; one left over would be written out as a second,
        // garbled copy of its formula.
        if (KatexWeergave().IsMatch(voorbereid))
        {
            gevonden.Add("<span class=\"katex-html\"> without its closing tag");
        }

        if (Afbeelding().Matches(voorbereid).Any(img =>
                AltTekst().Match(img.Value) is not { Success: true } alt || string.IsNullOrWhiteSpace(alt.Groups[1].Value)))
        {
            gevonden.Add("<img> without alt text");
        }

        // Link() converts only a closed link with a double-quoted address; any <a> it leaves behind would lose that address.
        if (LinkOpening().IsMatch(Link().Replace(voorbereid, "$2 ($1)")))
        {
            gevonden.Add("<a> without a closing tag or a double-quoted href");
        }

        return gevonden.Distinct(StringComparer.Ordinal).ToList();
    }

    /// <summary>
    /// The steps both methods share. A <c>&lt;</c> that starts no tag is escaped so the stripper cannot eat the text
    /// after it; then every shape this class can keep is rewritten into plain, known markup: KaTeX's visual copy goes,
    /// MathML becomes text, a plain-number superscript becomes <c>^n</c>, tables and ordered lists become lines, a
    /// horizontal rule becomes a line break. A shape a rewrite cannot keep is <b>left as it was</b>, which is what makes
    /// <see cref="OnvertaalbareOpmaak"/> name it.
    /// </summary>
    private static string Voorbereid(string html)
    {
        var tekst = KaleKleinerDan().Replace(html, "&lt;");
        tekst = VerwijderKatexWeergave(tekst);
        tekst = WiskundeFragment().Replace(tekst, m => Wiskunde(m.Value) is { } omgezet ? WebUtility.HtmlEncode(omgezet) : m.Value);
        tekst = Superscript().Replace(tekst, "^$1");
        // An empty line at the start of a list item carries nothing, and it would part the item from its dash or number.
        tekst = LijstitemMetRegeleinde().Replace(tekst, "$1");
        tekst = Tabel().Replace(tekst, m => Tabelregels(m.Value) ?? m.Value);
        tekst = NummerOrdeLijsten(tekst);
        return HorizontaleLijn().Replace(tekst, "<br>");
    }

    /// <summary>
    /// KaTeX's two wrappers. The visual copy (<c>katex-html</c>) goes with everything inside it. A display formula
    /// (<c>katex-display</c>) is a block on the page, so it gets a line of its own: without that, "Berekening" and the
    /// formula after it ran together as "Berekening2/10 = 1/5" (<c>2.5.GL6.6</c>).
    /// </summary>
    private static string VerwijderKatexWeergave(string html)
    {
        var zonderKopie = VervangSpans(html, KatexWeergave(), _ => string.Empty);
        return VervangSpans(zonderKopie, KatexBlok(), binnen => $"<br>{binnen}<br>");
    }

    /// <summary>
    /// Replaces each span whose opening tag <paramref name="opening"/> matches, up to its own closing tag (nested spans
    /// counted), by what <paramref name="vervanging"/> makes of its inner HTML. A span whose end is not found is left
    /// standing, so <see cref="OnvertaalbareOpmaak"/> can see it.
    /// </summary>
    private static string VervangSpans(string html, Regex opening, Func<string, string> vervanging)
    {
        var resultaat = html;
        var zoekVanaf = 0;
        while (opening.Match(resultaat, zoekVanaf) is { Success: true } begin)
        {
            var binnenBegin = begin.Index + begin.Length;
            var diepte = 1;
            Match? sluiting = null;
            foreach (Match span in SpanTag().Matches(resultaat, binnenBegin))
            {
                diepte += span.Value.StartsWith("</", StringComparison.Ordinal) ? -1 : 1;
                if (diepte == 0)
                {
                    sluiting = span;
                    break;
                }
            }

            if (sluiting is null)
            {
                zoekVanaf = binnenBegin;
                continue;
            }

            var nieuw = vervanging(resultaat[binnenBegin..sluiting.Index]);
            resultaat = string.Concat(resultaat.AsSpan(0, begin.Index), nieuw, resultaat.AsSpan(sluiting.Index + sluiting.Length));
            zoekVanaf = begin.Index + nieuw.Length;
        }

        return resultaat;
    }

    /// <summary>
    /// One <c>&lt;math&gt;</c> element as text, or null when it uses anything the conversion does not know, or is not
    /// well-formed XML. Parsed as XML rather than matched with patterns, so nesting cannot fool it; DTDs are not
    /// processed.
    /// </summary>
    private static string? Wiskunde(string fragment)
    {
        XElement math;
        try
        {
            math = XElement.Parse(fragment);
        }
        catch (XmlException)
        {
            return null;
        }

        var tekst = WiskundeElement(math);
        return tekst is null ? null : Witruimte().Replace(tekst, " ").Trim();
    }

    private static string? WiskundeElement(XElement element)
    {
        var naam = element.Name.LocalName;

        if (WiskundeGroepen.Contains(naam))
        {
            return Kinderen(element, element.Elements());
        }

        switch (naam)
        {
            case "semantics":
                {
                    // The presentation first, then annotations: the same formula again (LaTeX), which is dropped.
                    var kinderen = element.Elements().ToList();
                    if (kinderen.Count == 0 || kinderen.Skip(1).Any(k => k.Name.LocalName is not ("annotation" or "annotation-xml")))
                    {
                        return null;
                    }

                    return HeeftLosseTekst(element) ? null : WiskundeElement(kinderen[0]);
                }

            case "mn" or "mi" or "mtext":
                return element.HasElements ? null : element.Value.Trim();

            case "mo":
                {
                    if (element.HasElements)
                    {
                        return null;
                    }

                    var teken = element.Value.Trim();
                    return teken is "(" or ")" or "[" or "]" or "," ? teken : $" {teken} ";
                }

            case "mfrac":
                {
                    var delen = element.Elements().ToList();
                    if (delen.Count != 2 || HeeftLosseTekst(element))
                    {
                        return null;
                    }

                    var teller = WiskundeElement(delen[0]);
                    var noemer = WiskundeElement(delen[1]);
                    return teller is null || noemer is null ? null : $"{Operand(teller)}/{Operand(noemer)}";
                }

            default:
                return null;
        }
    }

    private static string? Kinderen(XElement ouder, IEnumerable<XElement> kinderen)
    {
        if (HeeftLosseTekst(ouder))
        {
            return null;
        }

        var tekst = new StringBuilder();
        foreach (var kind in kinderen)
        {
            if (WiskundeElement(kind) is not { } deel)
            {
                return null;
            }

            tekst.Append(deel);
        }

        return tekst.ToString();
    }

    /// <summary>Text directly inside a container element is not MathML the conversion understands.</summary>
    private static bool HeeftLosseTekst(XElement element) =>
        element.Nodes().OfType<XText>().Any(t => !string.IsNullOrWhiteSpace(t.Value));

    /// <summary>A compound numerator or denominator keeps its grouping: <c>(a + b)/c</c>, never <c>a + b/c</c>.</summary>
    private static string Operand(string tekst)
    {
        var waarde = tekst.Trim();
        return waarde.Any(c => c is ' ' or '+' or '-' or '−' or '/' or '*' or '×' or ':' or '=') ? $"({waarde})" : waarde;
    }

    /// <summary>
    /// One table as lines of known markup, or null when it cannot be flattened faithfully: a nested table, a cell that
    /// spans rows or columns, content outside the cells, or a row of several cells one of which holds block content.
    /// </summary>
    private static string? Tabelregels(string tabel)
    {
        var binnen = TabelBinnenkant().Match(tabel);
        if (!binnen.Success || binnen.Groups[1].Value.Contains("<table", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var rest = TabelSectie().Replace(binnen.Groups[1].Value, string.Empty);
        var rijen = Rij().Matches(rest);
        if (rijen.Count == 0 || !IsLeeg(Rij().Replace(rest, string.Empty)))
        {
            return null;
        }

        var regels = new List<List<string>>();
        foreach (Match rij in rijen)
        {
            var cellen = Cel().Matches(rij.Groups[1].Value);
            if (cellen.Count == 0 || !IsLeeg(Cel().Replace(rij.Groups[1].Value, string.Empty)))
            {
                return null;
            }

            var regel = new List<string>();
            foreach (Match cel in cellen)
            {
                if (CelOverspanning().IsMatch(cel.Groups[2].Value))
                {
                    return null;
                }

                regel.Add(cel.Groups[3].Value);
            }

            regels.Add(regel);
        }

        if (regels.Count == 1 && regels[0].Count == 1)
        {
            // Layout: the cell's content stands where the table stood.
            return $"<br>{regels[0][0]}<br>";
        }

        if (regels.SelectMany(r => r).All(IsLeeg))
        {
            var kolommen = regels.Max(r => r.Count);
            var rijTekst = regels.Count == 1 ? "1 rij" : $"{regels.Count} rijen";
            var kolomTekst = kolommen == 1 ? "1 kolom" : $"{kolommen} kolommen";
            return $"<br>[lege tabel van {rijTekst} en {kolomTekst}]<br>";
        }

        if (regels.SelectMany(r => r).Any(cel => Blokopmaak().IsMatch(cel)))
        {
            return null;
        }

        return "<br>" + string.Join("<br>", regels.Select(r => string.Join(" | ", r))) + "<br>";
    }

    /// <summary>
    /// True when a fragment holds nothing: no text, and no element beyond <see cref="TekstlozeOpmaak"/>. Any other element
    /// carries content without text of its own (an image's alt text, a link's address, an <c>svg</c> or an <c>iframe</c>),
    /// so it makes a cell non-empty and lets the table fall through to the guard instead of becoming "[lege tabel …]"
    /// (E1-21: antagonist round 1 MAJOR 2 for images and links, round 2 MINOR 3 for every other element).
    /// </summary>
    private static bool IsLeeg(string fragment) =>
        TagNaam().Matches(fragment).All(tag => TekstlozeOpmaak.Contains(tag.Groups[1].Value)) &&
        string.IsNullOrWhiteSpace(WebUtility.HtmlDecode(Tag().Replace(fragment, string.Empty)).Replace((char)0xA0, ' '));

    /// <summary>
    /// Numbers the items of every ordered list (<c>1. </c>, <c>2. </c>, from <c>start</c> when given), leaving the items
    /// of unordered lists, nested or not, for the ordinary dash. An <c>ol</c> with any other attribute (<c>type</c>,
    /// <c>reversed</c>), an <c>ol</c> inside another <c>ol</c>, or tags that do not balance, is left as it was, so the
    /// guard refuses it.
    /// </summary>
    private static string NummerOrdeLijsten(string html)
    {
        if (!html.Contains("<ol", StringComparison.OrdinalIgnoreCase))
        {
            return html;
        }

        var stapel = new Stack<int?>();
        var uit = new StringBuilder();
        var vorige = 0;
        foreach (Match tag in LijstTag().Matches(html))
        {
            uit.Append(html, vorige, tag.Index - vorige);
            vorige = tag.Index + tag.Length;

            var sluit = tag.Groups[1].Value == "/";
            var naam = tag.Groups[2].Value.ToLowerInvariant();
            var attributen = tag.Groups[3].Value;

            switch (naam, sluit)
            {
                case ("ol", false):
                    // A second level of numbers flattened onto the first would read "1. 1. 2. 2." without saying which
                    // belongs to which (antagonist round 1, MAJOR 2); none occurs in snapshot 1.2, so it is refused.
                    if (!string.IsNullOrWhiteSpace(StartAttribuut().Replace(attributen, string.Empty))
                        || stapel.Any(niveau => niveau is not null))
                    {
                        return html;
                    }

                    var start = StartAttribuut().Match(attributen) is { Success: true } s ? int.Parse(s.Groups[1].Value) : 1;
                    stapel.Push(start - 1);
                    break;
                case ("ul", false):
                    stapel.Push(null);
                    uit.Append(tag.Value);
                    break;
                case ("ol", true):
                    if (stapel.Count == 0 || stapel.Pop() is null)
                    {
                        return html;
                    }

                    uit.Append("<br>");
                    break;
                case ("ul", true):
                    if (stapel.Count == 0 || stapel.Pop() is not null)
                    {
                        return html;
                    }

                    uit.Append(tag.Value);
                    break;
                case ("li", false) when stapel.Count > 0 && stapel.Peek() is { } teller:
                    stapel.Pop();
                    stapel.Push(teller + 1);
                    uit.Append($"<br>{teller + 1}. ");
                    break;
                default:
                    uit.Append(tag.Value);
                    break;
            }
        }

        if (stapel.Count != 0)
        {
            return html;
        }

        uit.Append(html, vorige, html.Length - vorige);
        return uit.ToString();
    }

    [GeneratedRegex(@"<(?![a-zA-Z/!])")]
    private static partial Regex KaleKleinerDan();

    [GeneratedRegex(@"<math\b[^>]*>.*?</math\s*>", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex WiskundeFragment();

    [GeneratedRegex(@"<span\b[^>]*\bclass\s*=\s*""[^""]*\bkatex-html\b[^""]*""[^>]*>", RegexOptions.IgnoreCase)]
    private static partial Regex KatexWeergave();

    [GeneratedRegex(@"<span\b[^>]*\bclass\s*=\s*""[^""]*\bkatex-display\b[^""]*""[^>]*>", RegexOptions.IgnoreCase)]
    private static partial Regex KatexBlok();

    [GeneratedRegex(@"</?span\b[^>]*>", RegexOptions.IgnoreCase)]
    private static partial Regex SpanTag();

    /// <summary>Only a plain number: <c>2</c> in <c>10&lt;sup&gt;2&lt;/sup&gt;</c>. Anything else stays for the guard.</summary>
    [GeneratedRegex(@"<sup>\s*(\d+)\s*</sup>", RegexOptions.IgnoreCase)]
    private static partial Regex Superscript();

    [GeneratedRegex(@"<sup\b", RegexOptions.IgnoreCase)]
    private static partial Regex SupOpening();

    [GeneratedRegex(@"(<li\b[^>]*>)(?:\s|&nbsp;)*(?:<br\s*/?>(?:\s|&nbsp;)*)+", RegexOptions.IgnoreCase)]
    private static partial Regex LijstitemMetRegeleinde();

    [GeneratedRegex(@"<table\b[^>]*>.*?</table\s*>", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex Tabel();

    [GeneratedRegex(@"^<table\b[^>]*>(.*)</table\s*>$", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex TabelBinnenkant();

    [GeneratedRegex(@"</?(?:thead|tbody|tfoot)\b[^>]*>", RegexOptions.IgnoreCase)]
    private static partial Regex TabelSectie();

    [GeneratedRegex(@"<tr\b[^>]*>(.*?)</tr\s*>", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex Rij();

    [GeneratedRegex(@"<(td|th)\b([^>]*)>(.*?)</\1\s*>", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex Cel();

    [GeneratedRegex(@"\b(?:colspan|rowspan)\s*=", RegexOptions.IgnoreCase)]
    private static partial Regex CelOverspanning();

    [GeneratedRegex(@"<(?:br|p|div|ul|ol|li|table|hr|img|h[1-6])\b", RegexOptions.IgnoreCase)]
    private static partial Regex Blokopmaak();

    [GeneratedRegex(@"<(/?)(ol|ul|li)\b([^>]*)>", RegexOptions.IgnoreCase)]
    private static partial Regex LijstTag();

    [GeneratedRegex(@"\s*\bstart\s*=\s*""(\d{1,4})""\s*", RegexOptions.IgnoreCase)]
    private static partial Regex StartAttribuut();

    [GeneratedRegex(@"<hr\b[^>]*>", RegexOptions.IgnoreCase)]
    private static partial Regex HorizontaleLijn();

    [GeneratedRegex(@"<img\b[^>]*>", RegexOptions.IgnoreCase)]
    private static partial Regex Afbeelding();

    /// <summary>The <c>alt</c> attribute itself, not the tail of another name such as <c>data-alt</c>.</summary>
    [GeneratedRegex(@"(?<![\w-])alt\s*=\s*""([^""]*)""", RegexOptions.IgnoreCase)]
    private static partial Regex AltTekst();

    [GeneratedRegex(@"<a\b[^>]*?(?<![\w-])href\s*=\s*""([^""]*)""[^>]*>(.*?)</a>", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex Link();

    [GeneratedRegex(@"<a\b", RegexOptions.IgnoreCase)]
    private static partial Regex LinkOpening();

    [GeneratedRegex(@"<(?:strong|b)\b[^>]*>", RegexOptions.IgnoreCase)]
    private static partial Regex VetOpening();

    [GeneratedRegex(@"</(?:strong|b)\s*>", RegexOptions.IgnoreCase)]
    private static partial Regex VetSluiting();

    [GeneratedRegex(@"<br\s*/?>|</(?:p|div|ul|li|h[1-6])\s*>", RegexOptions.IgnoreCase)]
    private static partial Regex Regeleinde();

    [GeneratedRegex(@"<li\b[^>]*>", RegexOptions.IgnoreCase)]
    private static partial Regex Lijstitem();

    [GeneratedRegex(@"<[^>]*>")]
    private static partial Regex Tag();

    [GeneratedRegex(@"</?([a-zA-Z][a-zA-Z0-9]*)")]
    private static partial Regex TagNaam();

    [GeneratedRegex(@"[ \t\r\f\v]+")]
    private static partial Regex Witruimte();
}
