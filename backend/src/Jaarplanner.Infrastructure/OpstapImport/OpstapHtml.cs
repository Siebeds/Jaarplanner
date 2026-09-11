using System.Net;
using System.Text.RegularExpressions;

namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// Turns the HTML fragments KOV's API uses for goal texts into plain text (ADR-0032 decision 3), <b>without changing
/// what the decreed text says</b> (Art. III.1). Every rule below was taken from the real data of 2026-09-11, where the
/// 998 minimumdoelen use <c>p</c>, <c>ul</c>, <c>li</c>, <c>br</c>, <c>strong</c>, <c>em</c>, <c>a</c>, <c>img</c> and
/// one MathML shape, and three entities (<c>&amp;lt;</c>, <c>&amp;gt;</c>, <c>&amp;nbsp;</c>).
/// <list type="bullet">
/// <item>A paragraph, line break or list end becomes a newline; a list item becomes a line starting with <c>"- "</c>.</item>
/// <item>A MathML fraction <c>&lt;math&gt;&lt;mfrac&gt;&lt;mn&gt;1&lt;/mn&gt;&lt;mn&gt;2&lt;/mn&gt;&lt;/mfrac&gt;&lt;/math&gt;</c>
/// becomes <c>1/2</c>. Stripping its tags would have written <c>12</c>, a different number.</item>
/// <item>A link keeps its address: <c>Word (https://…)</c>. The Frans minimumdoelen point at their word list this way.</item>
/// <item>An image becomes its alt text on a line of its own: <c>[afbeelding: De lamp]</c>.</item>
/// <item>Any other tag is dropped, and entities are decoded only <b>after</b> the tags are gone, so KOV's own
/// angle-bracket notation around examples (<c>&amp;lt; bv. tanden poetsen &amp;gt;</c>, with or without the space)
/// stays visible text. It follows that any <c>&lt;…&gt;</c> in the output is KOV's text, never a surviving tag.</item>
/// </list>
/// <para>
/// <b>Why plain text and not sanitised HTML.</b> Nothing downstream should ever have to decide whether a stored
/// curriculum text is safe to render as markup. Storing text makes that question disappear.
/// </para>
/// <para>
/// <b>Markup this class does not know is not guessed at.</b> <see cref="OnbekendeTags"/> names it, and the mapping
/// refuses the row rather than import a text it may have altered; a missing minimumdoel is loud (its leerplandoelen
/// refuse to import), a silently rewritten one is not.
/// </para>
/// </summary>
internal static partial class OpstapHtml
{
    /// <summary>Tags whose meaning <see cref="NaarTekst"/> preserves. MathML is known only in the fraction shape.</summary>
    private static readonly HashSet<string> BekendeTags = new(StringComparer.OrdinalIgnoreCase)
    {
        "p", "div", "span", "br", "ul", "ol", "li", "strong", "b", "em", "i", "u", "sup", "sub",
        "h1", "h2", "h3", "h4", "h5", "h6", "a", "img",
    };

    /// <summary>Converts one HTML fragment to plain text; returns an empty string for null or blank input.</summary>
    public static string NaarTekst(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return string.Empty;
        }

        var tekst = Breuk().Replace(html, "$1/$2");
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
    /// The tag names in <paramref name="html"/> whose meaning <see cref="NaarTekst"/> would not preserve, lower-cased
    /// and distinct, in order of appearance. Empty when the fragment is safe to convert. A MathML fraction in the known
    /// shape does not count.
    /// </summary>
    public static IReadOnlyList<string> OnbekendeTags(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return [];
        }

        return TagNaam()
            .Matches(Breuk().Replace(html, "$1/$2"))
            .Select(m => m.Groups[1].Value.ToLowerInvariant())
            .Where(naam => !BekendeTags.Contains(naam))
            .Distinct(StringComparer.Ordinal)
            .ToList();
    }

    [GeneratedRegex(@"<math>\s*<mfrac>\s*<mn>([^<]*)</mn>\s*<mn>([^<]*)</mn>\s*</mfrac>\s*</math>", RegexOptions.IgnoreCase)]
    private static partial Regex Breuk();

    [GeneratedRegex(@"<img\b[^>]*>", RegexOptions.IgnoreCase)]
    private static partial Regex Afbeelding();

    [GeneratedRegex(@"\balt\s*=\s*""([^""]*)""", RegexOptions.IgnoreCase)]
    private static partial Regex AltTekst();

    [GeneratedRegex(@"<a\b[^>]*?\bhref\s*=\s*""([^""]*)""[^>]*>(.*?)</a>", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex Link();

    [GeneratedRegex(@"<br\s*/?>|</(?:p|div|ul|ol|li|h[1-6])\s*>", RegexOptions.IgnoreCase)]
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
