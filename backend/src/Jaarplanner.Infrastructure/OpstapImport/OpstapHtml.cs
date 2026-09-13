using System.Net;
using System.Text.RegularExpressions;

namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// Turns the HTML fragments KOV's API uses for goal texts into plain text (ADR-0032 decision 3), <b>without changing
/// what the decreed text says</b> (Art. III.1). The rules were fitted to the 998 minimumdoelen of 2026-09-11 (which use
/// <c>p</c>, <c>ul</c>, <c>li</c>, <c>br</c>, <c>strong</c>, <c>em</c>, <c>a</c>, <c>img</c> and one MathML shape) plus
/// two shapes found in the curriculum's G goals: a plain <c>sup</c> and a raw <c>&lt;</c> used as a comparison sign.
/// They are <b>not</b> fitted to the rest of the curriculum, which also carries tables, <c>ol</c>, <c>hr</c> and MathML
/// beyond fractions; those are refused (see below), which is what E1-21 must resolve shape by shape.
/// <list type="bullet">
/// <item>A <c>&lt;</c> that does not start a tag (<c>=, ≠, &lt;, &gt;</c>, <c>(&lt; 1 week)</c>) is text and is kept.</item>
/// <item>A paragraph, line break or list end becomes a newline; an unordered list item a line starting with <c>"- "</c>.</item>
/// <item>A MathML fraction <c>&lt;math&gt;&lt;mfrac&gt;&lt;mn&gt;1&lt;/mn&gt;&lt;mn&gt;2&lt;/mn&gt;&lt;/mfrac&gt;&lt;/math&gt;</c>
/// becomes <c>1/2</c>, and a superscript that is a plain number, <c>10&lt;sup&gt;2&lt;/sup&gt;</c>, becomes <c>10^2</c>.
/// Stripping their tags would have written <c>12</c> and <c>102</c>: different numbers.</item>
/// <item>A closed link with a double-quoted address keeps it: <c>Word (https://…)</c>. An image becomes its alt text on a
/// line of its own.</item>
/// <item>Entities are decoded only <b>after</b> the tags are gone, so KOV's escaped angle-bracket notation around
/// examples (<c>&amp;lt; bv. tanden poetsen &amp;gt;</c>) stays visible text.</item>
/// </list>
/// <para>
/// <b>What this class cannot convert faithfully, it does not guess at.</b> <see cref="OnvertaalbareOpmaak"/> names it: an
/// unknown tag, any <c>sup</c> that is not a plain number, a link that is not closed or whose address is not
/// double-quoted, an image without an <c>alt</c> attribute of its own. The mapping then refuses the row rather than import
/// a text it may have altered. A missing minimumdoel is loud (its leerplandoelen refuse to import); a silently rewritten
/// one is not.
/// </para>
/// <para>
/// <b>Why plain text and not sanitised HTML.</b> Nothing downstream should ever have to decide whether a stored
/// curriculum text is safe to render as markup. Storing text makes that question disappear.
/// </para>
/// </summary>
internal static partial class OpstapHtml
{
    /// <summary>
    /// Tag names whose meaning <see cref="NaarTekst"/> can preserve. Being on this list is necessary, not sufficient:
    /// <c>sup</c>, <c>a</c> and <c>img</c> are only convertible in the shapes <see cref="OnvertaalbareOpmaak"/> checks for.
    /// MathML is handled only as the fraction shape, before this list is consulted. <c>ol</c> and <c>sub</c> are
    /// deliberately absent.
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

        // Voorbereid has rewritten every plain-number superscript, so any <sup> still standing is one it could not keep
        // (an attribute, markup inside, "n+1", an ordinal like "2de").
        if (SupOpening().IsMatch(voorbereid))
        {
            gevonden.Add("<sup> other than a plain number");
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

    /// <summary>Only a plain number: <c>2</c> in <c>10&lt;sup&gt;2&lt;/sup&gt;</c>. Anything else stays for the guard.</summary>
    [GeneratedRegex(@"<sup>\s*(\d+)\s*</sup>", RegexOptions.IgnoreCase)]
    private static partial Regex Superscript();

    [GeneratedRegex(@"<sup\b", RegexOptions.IgnoreCase)]
    private static partial Regex SupOpening();

    [GeneratedRegex(@"<img\b[^>]*>", RegexOptions.IgnoreCase)]
    private static partial Regex Afbeelding();

    /// <summary>The <c>alt</c> attribute itself, not the tail of another name such as <c>data-alt</c>.</summary>
    [GeneratedRegex(@"(?<![\w-])alt\s*=\s*""([^""]*)""", RegexOptions.IgnoreCase)]
    private static partial Regex AltTekst();

    [GeneratedRegex(@"<a\b[^>]*?(?<![\w-])href\s*=\s*""([^""]*)""[^>]*>(.*?)</a>", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex Link();

    [GeneratedRegex(@"<a\b", RegexOptions.IgnoreCase)]
    private static partial Regex LinkOpening();

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
