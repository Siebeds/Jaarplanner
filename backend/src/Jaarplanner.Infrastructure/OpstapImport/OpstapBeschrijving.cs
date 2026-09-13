using System.Text.RegularExpressions;

namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// Splits the HTML <c>description</c> of an Op.stap goal into <c>Voorbeelden</c>, <c>Woordenschat</c> and
/// <c>Toelichting</c> (E1-21), the three fields the Excel route kept in columns K, M and L. KOV writes them as one text
/// with bold section headings; this class finds those headings. Part of the mapping, so it is called only from
/// <see cref="CurriculumdoelMapping"/> (Art. III.3).
/// <para>
/// <b>What a heading is, from the census of the 5,835 G goals of snapshot 1.2</b> (counts in the E1-21 worklog):
/// bold text at the <b>start of a line</b> (after a paragraph, line break, list end, table or rule; not inside a list
/// item), or a line that holds nothing but one of the plain headings (KOV wrote <c>&lt;span&gt;Voorbeelden:&lt;/span&gt;</c>
/// 41 times). Adjacent bold runs are one heading, because KOV split one word over two (<c>V</c> + <c>oorbeeld(en):</c>),
/// and a colon may sit inside or outside the bold.
/// <list type="bullet">
/// <item><b>Voorbeelden</b>: <c>Voorbeeld</c>, <c>Voorbeelden</c>, <c>Voorbeeld(en)</c> and KOV's typo <c>Voorbeel(den)</c>
/// are dropped as labels. A heading that says more (<c>Voorbeeld 1: Toename</c>, <c>Voorbeelden van seriëren</c>) names an
/// example and stays as its first line.</item>
/// <item><b>Woordenschat</b>: <c>Richtinggevende woordenschat</c>, dropped as a label.</item>
/// <item><b>Toelichting</b>: everything before the first heading, a <c>Toelichting</c> label (dropped), a heading that
/// begins with <c>Toelichting</c> (kept), and the didactic sections KOV writes after the examples:
/// <c>Mogelijke aanpak…</c>, <c>Mogelijke indeling…</c>, <c>Mogelijke onderzoekscontexten</c>, <c>Verdere
/// referenties</c> (kept as their first line).</item>
/// <item>Any other bold at the start of a line (<c>6 × 19</c>, <c>🐰 🐰 🐰</c>, <c>Spelsituatie</c>) is content of the
/// section it stands in.</item>
/// </list>
/// </para>
/// <para>
/// <b>What the split drops, and what it does not promise.</b> Of the converted text, it drops only the bare labels (and a
/// colon after one); every other line lands in one of the three fields, in document order <i>within</i> that field. The
/// order <i>between</i> fields is not kept: a toelichting section after the examples is joined to the toelichting before
/// them. A heading this class does not recognise leaves its text in the section above it. A description without any
/// heading comes back whole in <c>Toelichting</c>, as <see cref="OpstapHtml.NaarTekst(string?)"/> converts it. The split
/// works on that conversion, so it is only as faithful as <see cref="OpstapHtml"/>, which refuses what it cannot keep.
/// </para>
/// </summary>
internal static partial class OpstapBeschrijving
{
    private enum Soort
    {
        Toelichting,
        Voorbeelden,
        Woordenschat,
    }

    /// <summary>Splits one description. Each field is null when it would be empty.</summary>
    public static (string? Voorbeelden, string? Woordenschat, string? Toelichting) Splits(string? html)
    {
        var tekst = OpstapHtml.NaarTekst(html, behoudVet: true);
        if (tekst.Length == 0)
        {
            return (null, null, null);
        }

        var secties = new List<(Soort Soort, List<string> Regels)> { (Soort.Toelichting, []) };
        foreach (var regel in tekst.Split('\n'))
        {
            if (LeesKop(regel) is { } kop)
            {
                secties.Add((kop.Soort, []));
                if (kop.EersteRegel is { Length: > 0 } eerste)
                {
                    secties[^1].Regels.Add(eerste);
                }
            }
            else
            {
                secties[^1].Regels.Add(regel);
            }
        }

        return (Samen(secties, Soort.Voorbeelden), Samen(secties, Soort.Woordenschat), Samen(secties, Soort.Toelichting));
    }

    /// <summary>
    /// The heading this line opens, if any, and the text that stays as the section's first line: the rest of the line
    /// after a bare label, or the whole line when the heading itself says something.
    /// </summary>
    private static (Soort Soort, string? EersteRegel)? LeesKop(string regel)
    {
        var vet = LeidendVet().Match(regel);
        if (!vet.Success)
        {
            // Not bold: only a line that is nothing but a bare label counts.
            return Label(ZonderVet(regel).Trim().TrimEnd(':').TrimEnd()) is { } soort ? (soort, null) : null;
        }

        var kop = ZonderVet(vet.Value).Trim();
        var rest = ZonderVet(regel[vet.Length..]).Trim();
        var zonderDubbelepunt = kop.TrimEnd(':').TrimEnd();

        if (Label(zonderDubbelepunt) is { } label)
        {
            // The colon may follow the bold instead of closing it: "<strong>Voorbeeld</strong>: …".
            if (!kop.EndsWith(':') && rest.StartsWith(':'))
            {
                rest = rest[1..].TrimStart();
            }

            return (label, rest.Length > 0 ? rest : null);
        }

        return GetiteldeKop(zonderDubbelepunt) is { } soortVanTitel ? (soortVanTitel, ZonderVet(regel).Trim()) : null;
    }

    /// <summary>The bare labels, which name their section and say nothing else.</summary>
    private static Soort? Label(string tekst) =>
        VoorbeeldLabel().IsMatch(tekst) ? Soort.Voorbeelden
        : string.Equals(tekst, "Richtinggevende woordenschat", StringComparison.OrdinalIgnoreCase) ? Soort.Woordenschat
        : string.Equals(tekst, "Toelichting", StringComparison.OrdinalIgnoreCase) ? Soort.Toelichting
        : null;

    /// <summary>A heading that opens a section and is itself content, so it stays.</summary>
    private static Soort? GetiteldeKop(string tekst) =>
        VoorbeeldKop().IsMatch(tekst) ? Soort.Voorbeelden
        : WoordenschatKop().IsMatch(tekst) ? Soort.Woordenschat
        : ToelichtingKop().IsMatch(tekst) ? Soort.Toelichting
        : null;

    private static string? Samen(List<(Soort Soort, List<string> Regels)> secties, Soort soort)
    {
        var regels = secties
            .Where(s => s.Soort == soort)
            .SelectMany(s => s.Regels)
            .Select(r => Witruimte().Replace(ZonderVet(r), " ").Trim())
            .Where(r => r.Length > 0 && r != "-")
            .ToList();

        return regels.Count == 0 ? null : string.Join('\n', regels);
    }

    private static string ZonderVet(string tekst) =>
        tekst.Replace(OpstapHtml.VetBegin.ToString(), string.Empty, StringComparison.Ordinal)
            .Replace(OpstapHtml.VetEinde.ToString(), string.Empty, StringComparison.Ordinal);

    /// <summary>
    /// One or more bold runs at the very start of a line, nested bold included. <c>\x01</c> and <c>\x02</c> are
    /// <see cref="OpstapHtml.VetBegin"/> and <see cref="OpstapHtml.VetEinde"/>, written as regex escapes so the source
    /// holds no invisible characters.
    /// </summary>
    [GeneratedRegex(@"^(?:\x01+[^\x01\x02]*\x02+[ ]*)+")]
    private static partial Regex LeidendVet();

    [GeneratedRegex(@"^(?:Voorbeeld|Voorbeelden|Voorbeeld\(en\)|Voorbeel\(den\))$", RegexOptions.IgnoreCase)]
    private static partial Regex VoorbeeldLabel();

    /// <summary>"Voorbeeld 1: …", "Voorbeelden van …" — but not a word that merely starts the same ("Voorbeeldgedrag").</summary>
    [GeneratedRegex(@"^(?:Voorbeeld|Voorbeelden|Voorbeeld\(en\)|Voorbeel\(den\))(?=[\s:,0-9])", RegexOptions.IgnoreCase)]
    private static partial Regex VoorbeeldKop();

    [GeneratedRegex(@"^Richtinggevende woordenschat(?=[\s:])", RegexOptions.IgnoreCase)]
    private static partial Regex WoordenschatKop();

    [GeneratedRegex(@"^(?:Toelichting(?=[\s:])|Mogelijke aanpak\b|Mogelijke indeling\b|Mogelijke onderzoekscontexten\b|Verdere referenties$)", RegexOptions.IgnoreCase)]
    private static partial Regex ToelichtingKop();

    [GeneratedRegex(@"[ \t]+")]
    private static partial Regex Witruimte();
}
