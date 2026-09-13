using System.Net;
using System.Text.RegularExpressions;

namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// Turns the HTML fragments KOV's API uses for goal texts into plain text (ADR-0032 decision 3), <b>without changing
/// what the decreed text says</b> (Art. III.1). The rules come from the real data of 2026-09-11: the 998 minimumdoelen
/// use <c>p</c>, <c>ul</c>, <c>li</c>, <c>br</c>, <c>strong</c>, <c>em</c>, <c>a</c>, <c>img</c> and one MathML shape;
/// the curriculum (<c>krcItems</c>, E1-21) adds <c>sup</c> and a raw <c>&lt;</c> used as a comparison sign.
/// <list type="bullet">
/// <item>A <c>&lt;</c> that does not start a tag (<c>=, ≠, &lt;, &gt;</c>, <c>(&lt; 1 week)</c>) is text and is kept.</item>
/// <item>A paragraph, line break or list end becomes a newline; an unordered list item a line starting with <c>"- "</c>.</item>
/// <item>A MathML fraction <c>&lt;math&gt;&lt;mfrac&gt;&lt;mn&gt;1&lt;/mn&gt;&lt;mn&gt;2&lt;/mn&gt;&lt;/mfrac&gt;&lt;/math&gt;</c>
/// becomes <c>1/2</c>, and a superscript <c>10&lt;sup&gt;2&lt;/sup&gt;</c> becomes <c>10^2</c>. Stripping their tags would
/// have written <c>12</c> and <c>102</c>: different numbers.</item>
/// <item>A link keeps its address: <c>Word (https://…)</c>. An image becomes its alt text on a line of its own.</item>
/// <item>Entities are decoded only <b>after</b> the tags are gone, so KOV's escaped angle-bracket notation around
/// examples (<c>&amp;lt; bv. tanden poetsen &amp;gt;</c>) stays visible text.</item>
/// </list>
/// <para>
/// <b>What this class cannot convert faithfully, it does not guess at.</b> <see cref="OnvertaalbareOpmaak"/> names it
/// (an unknown tag, an ordered list whose numbers would be lost, an image without alt text, a link without a quoted
/// address), and the mapping refuses the row rather than import a text it may have altered. A missing minimumdoel is loud
/// (its leerplandoelen refuse to import); a silently rewritten one is not.
/// </para>
/// <para>
/// <b>Why plain text and not sanitised HTML.</b> Nothing downstream should ever have to decide whether a stored
/// curriculum text is safe to render as markup. Storing text makes that question disappear.
/// </para>
/// </summary>
internal static partial class OpstapHtml
{
    /// <summary>
    /// Tags whose meaning <see cref="NaarTekst"/> preserves. MathML is known only in the fraction shape, <c>sup</c> only
    /// as a superscript, <c>img</c> only with alt text and <c>a</c> only with a double-quoted address, which
    /// <see cref="OnvertaalbareOpmaak"/> checks separately. <c>ol</c> and <c>sub</c> are deliberately absent.
    /// </summary>
    private static readonly HashSet<string> BekendeTags = new(StringComparer.OrdinalIgnoreCase)
    {
        "p", "div", "span", "br", "ul", "li", "strong", "b", "em", "i", "u", "sup",
        "h1", "h2", "h3", "h4", "h5", "h6", "a", "img",
    };

    /// <summary>Converts one HTML fragment to plain text; returns an empty string for null or blank input.</summary>
    public static string NaarTekst(string? html)
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
        tekst = Regeleinde().Replace(tekst, "\n");
        tekst = Lijstitem().Replace(tekst, "\n- ");
        tekst = Tag().Replace(tekst, string.Empty);
        // &nbsp; decodes to U+00A0, which the whitespace rule below would otherwise leave standing.
        tekst = WebUtility.HtmlDecode(tekst).Replace('\u00A0', ' ');

        var regels = tekst
            .Split('\n')
            .Select(regel => Witruimte().Replace(regel, " ").Trim())
            // A lone "-" is what an empty <li></li> leaves behind.
            .Where(regel => regel.Length > 0 && regel != "-");

        return string.Join('\n', regels);
    }

    /// <summary>
    /// Everything in <paramref name="html"/> that <see cref="NaarTekst"/> would not convert faithfully, as short English
    /// descriptions (<c>&lt;sub&gt;</c>, <c>&lt;img&gt; without alt text</c>), distinct and in order of appearance. Empty
    /// when the fragment is safe to convert.
    /// </summary>
    public static IReadOnlyList<string> OnvertaalbareOpmaak(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return [];
        }

        var voorbereid = Voorbereid(html);
        var gevonden = new List<string>();

        foreach (Match tag in TagNaam().Matches(voorbereid))
        {
            var naam = tag.Groups[1].Value.ToLowerInvariant();
            if (!BekendeTags.Contains(naam))
            {
                gevonden.Add($"<{naam}>");
            }
        }

        if (Afbeelding().Matches(voorbereid).Any(img => !AltTekst().Match(img.Value).Success
            || string.IsNullOrWhiteSpace(AltTekst().Match(img.Value).Groups[1].Value)))
        {
            gevonden.Add("<img> without alt text");
        }

        if (LinkOpening().Matches(voorbereid).Any(a => !Adres().IsMatch(a.Value)))
        {
            gevonden.Add("<a> without a double-quoted href");
        }

        return gevonden.Distinct(StringComparer.Ordinal).ToList();
    }

    /// <summary>
    /// The steps both methods share: a <c>&lt;</c> that starts no tag is escaped so the stripper cannot eat the text
    /// after it, and the two numeric shapes are rewritten before any tag is removed.
    /// </summary>
    private static string Voorbereid(string html)
    {
        var tekst = KaleKleinerDan().Replace(html, "&lt;");
        tekst = Breuk().Replace(tekst, "$1/$2");
        return Superscript().Replace(tekst, "^$1");
    }

    [GeneratedRegex(@"<(?![a-zA-Z/!])")]
    private static partial Regex KaleKleinerDan();

    [GeneratedRegex(@"<math>\s*<mfrac>\s*<mn>([^<]*)</mn>\s*<mn>([^<]*)</mn>\s*</mfrac>\s*</math>", RegexOptions.IgnoreCase)]
    private static partial Regex Breuk();

    [GeneratedRegex(@"<sup>([^<]*)</sup>", RegexOptions.IgnoreCase)]
    private static partial Regex Superscript();

    [GeneratedRegex(@"<img\b[^>]*>", RegexOptions.IgnoreCase)]
    private static partial Regex Afbeelding();

    [GeneratedRegex(@"\balt\s*=\s*""([^""]*)""", RegexOptions.IgnoreCase)]
    private static partial Regex AltTekst();

    [GeneratedRegex(@"<a\b[^>]*?\bhref\s*=\s*""([^""]*)""[^>]*>(.*?)</a>", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex Link();

    [GeneratedRegex(@"<a\b[^>]*>", RegexOptions.IgnoreCase)]
    private static partial Regex LinkOpening();

    [GeneratedRegex(@"\bhref\s*=\s*""[^""]*""", RegexOptions.IgnoreCase)]
    private static partial Regex Adres();

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
