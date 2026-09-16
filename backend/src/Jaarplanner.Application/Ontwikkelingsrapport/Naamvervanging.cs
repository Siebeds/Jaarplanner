using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Jaarplanner.Application.Ontwikkelingsrapport;

/// <summary>
/// One masked text and what was taken out of it: the placeholder (<c>#NAAM1#</c>) against the name it stands for.
/// </summary>
/// <param name="Tekst">The text as it may leave the server.</param>
/// <param name="Plaatshouders">Placeholder to original name. Empty when the text held no name of the klas.</param>
public sealed record Naammasker(string Tekst, IReadOnlyDictionary<string, string> Plaatshouders);

/// <summary>
/// Takes the names of a klas's children out of a text before it goes to the AI, and puts them back afterwards (FB-004,
/// R21, R25, ADR-0035 §3.5 D14). Pure and side-effect free, so it is testable without a klas, a database or a model.
/// <para>
/// <b>The match is on whole words and follows the capitals of the stored name</b> (D14). Many Dutch first names are
/// ordinary words (Roos, Storm, Lente), and in running text those words are written in lower case, so
/// <c>StringComparison.Ordinal</c> leaves "een roos" alone and replaces "Roos". A sentence that starts with such a word
/// capitalised is replaced all the same. That costs a word, never a name.
/// </para>
/// <para>
/// <b>What it does not catch, stated so nobody over-reads it</b> (ADR-0035 §3.5): a nickname, a misspelling, or the name
/// of a sibling, a parent or a child outside the klas. The teacher is told so beside the button (R25). Masked text is
/// still personal data (AVG recital 26); this is data minimisation, not anonymisation.
/// </para>
/// <para>
/// <b>A longer name wins.</b> Names are tried longest first, so a klas with both "Berg" and "Van den Berg" masks the
/// whole family name rather than its last word.
/// </para>
/// </summary>
public static partial class Naamvervanging
{
    /// <summary>
    /// The placeholder a masked name leaves behind: <c>#NAAM1#</c>, <c>#NAAM2#</c>, and so on, numbered in the order the
    /// names first appear in the text. The hashes make it a token no rewrite mistakes for a word to translate.
    /// </summary>
    public static string Plaatshouder(int nummer) => $"#NAAM{nummer.ToString(CultureInfo.InvariantCulture)}#";

    /// <summary>
    /// Replaces every name of <paramref name="namen"/> in <paramref name="tekst"/> with a numbered placeholder. Blank
    /// names are ignored, and the same name twice gets one placeholder.
    /// </summary>
    public static Naammasker Maskeer(string tekst, IEnumerable<string> namen)
    {
        ArgumentNullException.ThrowIfNull(tekst);
        ArgumentNullException.ThrowIfNull(namen);

        var teZoeken = namen
            .Where(naam => !string.IsNullOrWhiteSpace(naam))
            .Select(naam => naam.Trim())
            .Distinct(StringComparer.Ordinal)
            // Longest first, then a fixed order, so the result never depends on the order the klas came out of the
            // database.
            .OrderByDescending(naam => naam.Length)
            .ThenBy(naam => naam, StringComparer.Ordinal)
            .ToList();

        if (teZoeken.Count == 0)
        {
            return new Naammasker(tekst, new Dictionary<string, string>(StringComparer.Ordinal));
        }

        var plaatshouders = new Dictionary<string, string>(StringComparer.Ordinal);
        var perNaam = new Dictionary<string, string>(StringComparer.Ordinal);
        var gemaskeerd = new StringBuilder(tekst.Length);

        var i = 0;
        while (i < tekst.Length)
        {
            var naam = teZoeken.Find(kandidaat => IsHeelWoordOp(tekst, i, kandidaat));
            if (naam is null)
            {
                gemaskeerd.Append(tekst[i]);
                i++;
                continue;
            }

            if (!perNaam.TryGetValue(naam, out var plaatshouder))
            {
                plaatshouder = Plaatshouder(plaatshouders.Count + 1);
                perNaam[naam] = plaatshouder;
                plaatshouders[plaatshouder] = naam;
            }

            gemaskeerd.Append(plaatshouder);
            i += naam.Length;
        }

        return new Naammasker(gemaskeerd.ToString(), plaatshouders);
    }

    /// <summary>Puts back exactly what <see cref="Maskeer"/> took out.</summary>
    public static string Herstel(string tekst, IReadOnlyDictionary<string, string> plaatshouders)
    {
        ArgumentNullException.ThrowIfNull(tekst);
        ArgumentNullException.ThrowIfNull(plaatshouders);

        var hersteld = tekst;
        foreach (var (plaatshouder, naam) in plaatshouders)
        {
            hersteld = hersteld.Replace(plaatshouder, naam, StringComparison.Ordinal);
        }

        return hersteld;
    }

    /// <summary>
    /// Whether <paramref name="tekst"/> carries exactly the placeholders of <paramref name="plaatshouders"/>: every one
    /// that was sent is back, and none that was not (ADR-0035 §3.5, Art. IV.5). Compared as sets, not as counts: a
    /// rewrite may join two sentences about the same child, and that loses a repeat, not a name. A dropped name or an
    /// invented <c>#NAAM9#</c> refuses the answer as a whole.
    /// </summary>
    public static bool HeeftPreciesDeze(string tekst, IReadOnlyDictionary<string, string> plaatshouders)
    {
        ArgumentNullException.ThrowIfNull(tekst);
        ArgumentNullException.ThrowIfNull(plaatshouders);

        var gevonden = PlaatshouderPatroon()
            .Matches(tekst)
            .Select(treffer => treffer.Value)
            .ToHashSet(StringComparer.Ordinal);

        return gevonden.SetEquals(plaatshouders.Keys);
    }

    /// <summary>
    /// Whether <paramref name="naam"/> stands at <paramref name="positie"/> as a whole word: the same characters, and
    /// neither neighbour a letter or a digit. Punctuation, a space, a hyphen and an apostrophe all end a word, so
    /// "Roos," and "Roos'" are the name and "Rooske" is not.
    /// </summary>
    private static bool IsHeelWoordOp(string tekst, int positie, string naam)
    {
        if (positie + naam.Length > tekst.Length
            || string.CompareOrdinal(tekst, positie, naam, 0, naam.Length) != 0)
        {
            return false;
        }

        var ervoor = positie > 0 && char.IsLetterOrDigit(tekst[positie - 1]);
        var einde = positie + naam.Length;
        var erna = einde < tekst.Length && char.IsLetterOrDigit(tekst[einde]);
        return !ervoor && !erna;
    }

    [GeneratedRegex(@"#NAAM\d+#", RegexOptions.CultureInvariant)]
    private static partial Regex PlaatshouderPatroon();
}
