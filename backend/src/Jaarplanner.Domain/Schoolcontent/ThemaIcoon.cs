using System.Globalization;
using System.Text;

namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// The rule for a thema's icoon (FB-060): nothing, or exactly one emoji.
/// <para>
/// <b>One emoji is one grapheme, not one code point.</b> A family (👨‍👩‍👧), a flag (🇧🇪), a keycap (1️⃣) and a skin tone
/// (👋🏽) are several code points that a reader sees as one picture, so the count is taken in text elements, which .NET
/// segments as extended grapheme clusters. Any emoji a person can pick in the operating system's own emoji panel is
/// accepted, not only the ones the app's picker offers.
/// </para>
/// <para>
/// <b>An emoji is recognised by its code points, not by a font.</b> .NET exposes no Extended_Pictographic property, so
/// every code point in the cluster must be one an emoji is built from: a pictograph from the emoji blocks, a joiner or
/// variation selector, a skin-tone modifier, a tag of a subdivision flag, or the base digit of a keycap. Plain text,
/// even a single letter, is refused, and so is a cluster that mixes a letter into an emoji.
/// </para>
/// </summary>
public static class ThemaIcoon
{
    /// <summary>
    /// The longest icoon stored, in UTF-16 units. The longest emoji in use (a family or a subdivision flag) needs about
    /// 14; the cap only keeps a pathological cluster out of the column.
    /// </summary>
    public const int MaxLengte = 32;

    /// <summary>The sentence a teacher reads when the value is not one emoji.</summary>
    public const string Foutzin = "Kies één emoji als icoon van het thema, of laat het vakje leeg.";

    /// <summary>
    /// Returns the icoon to store: <c>null</c> for nothing, else the trimmed emoji.
    /// </summary>
    /// <exception cref="ArgumentException">The value is not empty and not exactly one emoji.</exception>
    public static string? Normaliseer(string? waarde)
    {
        if (string.IsNullOrWhiteSpace(waarde))
        {
            return null;
        }

        var icoon = waarde.Trim();
        if (icoon.Length > MaxLengte
            || new StringInfo(icoon).LengthInTextElements != 1
            || !IsEmoji(icoon))
        {
            // No parameter name: the message goes to a teacher as it is, and a "(Parameter ...)" suffix would go with it.
            throw new ArgumentException(Foutzin);
        }

        return icoon;
    }

    private static bool IsEmoji(string cluster)
    {
        var runen = cluster.EnumerateRunes().ToList();
        var isKeycap = runen.Any(r => r.Value == 0x20E3);
        var alsEmoji = runen.Any(r => r.Value == 0xFE0F);
        var heeftPictogram = false;

        for (var i = 0; i < runen.Count; i++)
        {
            var r = runen[i];
            if (IsPictogram(r))
            {
                // An arrow or a square on its own is text: it counts only when asked to show as an emoji.
                if (IsTekstStandaard(r) && !alsEmoji)
                {
                    return false;
                }

                heeftPictogram = true;
            }
            else if (i == 0 && isKeycap && IsKeycapBasis(r))
            {
                heeftPictogram = true;
            }
            else if (!IsSamensteller(r))
            {
                return false;
            }
        }

        return heeftPictogram;
    }

    // The code points that build an emoji without being one: joiner, variation selectors, the keycap mark and the tags
    // that spell a subdivision flag.
    private static bool IsSamensteller(Rune r) =>
        r.Value is 0x200D or 0xFE0E or 0xFE0F or 0x20E3
        || r.Value is >= 0xE0020 and <= 0xE007F;

    private static bool IsKeycapBasis(Rune r) =>
        r.Value is '#' or '*' or (>= '0' and <= '9');

    // Symbols from the arrow, technical, geometric-shape and misc-symbols-and-arrows blocks, and the loose ones below,
    // that display as text unless followed by U+FE0F. The few in those blocks that display as emoji by default
    // (a watch, an hourglass, a star, a large circle, ...) are excepted.
    private static bool IsTekstStandaard(Rune r) => r.Value switch
    {
        0x231A or 0x231B or (>= 0x23E9 and <= 0x23EC) or 0x23F0 or 0x23F3 or 0x25FD or 0x25FE
            or 0x2B1B or 0x2B1C or 0x2B50 or 0x2B55 => false,
        (>= 0x2190 and <= 0x21FF) or (>= 0x2300 and <= 0x23FF) or (>= 0x25A0 and <= 0x25FF) or (>= 0x2B00 and <= 0x2BFF) => true,
        0x00A9 or 0x00AE or 0x203C or 0x2934 or 0x2935 or 0x2049 or 0x2122 or 0x2139 or 0x24C2 or 0x3030 or 0x303D or 0x3297 or 0x3299 => true,
        _ => false,
    };

    // The blocks the Unicode emoji set draws its pictographs from. Skin tones (U+1F3FB..U+1F3FF) and regional
    // indicators (U+1F1E6..U+1F1FF) sit inside the first range.
    private static bool IsPictogram(Rune r) => r.Value switch
    {
        >= 0x1F000 and <= 0x1FAFF => true,
        >= 0x2600 and <= 0x27BF => true,
        >= 0x2300 and <= 0x23FF => true,
        >= 0x2B00 and <= 0x2BFF => true,
        >= 0x2190 and <= 0x21FF => true,
        >= 0x25A0 and <= 0x25FF => true,
        0x00A9 or 0x00AE or 0x203C or 0x2934 or 0x2935 or 0x2049 or 0x2122 or 0x2139 or 0x24C2 or 0x3030 or 0x303D or 0x3297 or 0x3299 => true,
        _ => false,
    };
}
