using System.Globalization;
using System.Text;

namespace Jaarplanner.Application.Kat.Chat;

/// <summary>
/// Finds the thema's, subthema's or activiteiten a term the gebruiker typed names (FB-031). Case, accents, quotes and
/// extra spaces do not count. It takes the best tier that finds anything, so an exact name is never drowned by names
/// that merely contain it:
/// <list type="number">
/// <item>the id itself, when the term is one (a candidate she picked);</item>
/// <item>the name is the term;</item>
/// <item>the name holds the term;</item>
/// <item>the name holds every word of the term ("egel herfst" names "De egel in de herfst");</item>
/// <item>the term holds the name as words ("het thema herfst" names "Herfst").</item>
/// </list>
/// </summary>
public static class Naamzoeker
{
    /// <summary>What <paramref name="term"/> names in <paramref name="alle"/>, by the best tier that finds anything.</summary>
    public static List<T> Vind<T>(string term, IEnumerable<T> alle, Func<T, Guid> id, Func<T, string> naam)
    {
        ArgumentNullException.ThrowIfNull(alle);
        var lijst = alle.ToList();

        if (Guid.TryParse(term, out var gezocht))
        {
            return lijst.Where(x => id(x) == gezocht).ToList();
        }

        var normaal = Normaal(term);
        if (normaal.Length == 0)
        {
            return [];
        }

        var namen = lijst.Select(x => (Item: x, Naam: Normaal(naam(x)))).Where(x => x.Naam.Length > 0).ToList();
        var woorden = normaal.Split(' ');
        var trappen = new Func<string, bool>[]
        {
            n => n == normaal,
            n => n.Contains(normaal, StringComparison.Ordinal),
            n => woorden.All(w => n.Contains(w, StringComparison.Ordinal)),
            n => Woordgrens(normaal, n),
        };

        foreach (var trap in trappen)
        {
            var gevonden = namen.Where(x => trap(x.Naam)).Select(x => x.Item).ToList();
            if (gevonden.Count > 0)
            {
                return gevonden;
            }
        }

        return [];
    }

    /// <summary>Lower case, without accents, quotes or punctuation at the edges, and single spaces.</summary>
    public static string Normaal(string? tekst)
    {
        if (string.IsNullOrWhiteSpace(tekst))
        {
            return string.Empty;
        }

        var ontleed = tekst.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(ontleed.Length);
        foreach (var teken in ontleed)
        {
            var categorie = CharUnicodeInfo.GetUnicodeCategory(teken);
            if (categorie == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            sb.Append(char.IsLetterOrDigit(teken) ? char.ToLowerInvariant(teken) : ' ');
        }

        return string.Join(' ', sb.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    // The term holds the whole name as words: "thema herfst" holds "herfst", "herfstbladeren" does not hold "herfst"
    // this way, so a short name does not match inside a longer word.
    private static bool Woordgrens(string term, string naam) =>
        $" {term} ".Contains($" {naam} ", StringComparison.Ordinal);
}
