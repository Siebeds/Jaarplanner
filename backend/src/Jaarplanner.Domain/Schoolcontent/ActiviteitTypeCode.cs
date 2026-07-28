using System.Collections.ObjectModel;

namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// Single source of truth for the mapping between the Dutch activiteit-type words a teacher
/// writes in the import Excel (e.g. <c>"experiment"</c>, <c>"prentenboek"</c>, <c>"uitstap"</c>)
/// and the <see cref="ActiviteitType"/> enum (Art. III.3 — the value↔enum mapping lives in one
/// place, mirroring <c>DoelsoortCodes</c>). The school-content import parser reuses this rather
/// than re-deciding the words, so the type vocabulary stays legible and refinable in one spot.
/// </summary>
public static class ActiviteitTypeCode
{
    private static readonly ReadOnlyDictionary<ActiviteitType, string> ByType =
        new(new Dictionary<ActiviteitType, string>
        {
            [ActiviteitType.Experiment] = "experiment",
            [ActiviteitType.Prentenboek] = "prentenboek",
            [ActiviteitType.Hoek] = "hoek",
            [ActiviteitType.Uitstap] = "uitstap",
            [ActiviteitType.Spel] = "spel",
            [ActiviteitType.Waarneming] = "waarneming",
            [ActiviteitType.Beweging] = "beweging",
            [ActiviteitType.Onderzoek] = "onderzoek",
        });

    private static readonly ReadOnlyDictionary<string, ActiviteitType> ByCode =
        new(ByType.ToDictionary(kvp => kvp.Value, kvp => kvp.Key, StringComparer.OrdinalIgnoreCase));

    /// <summary>The Dutch type word (e.g. <c>"uitstap"</c>) for an activiteit type.</summary>
    public static string ToCode(this ActiviteitType type) =>
        ByType.TryGetValue(type, out var code)
            ? code
            : throw new ArgumentOutOfRangeException(nameof(type), type, "Unknown activiteit type.");

    /// <summary>
    /// Attempts to parse a Dutch activiteit-type word into an <see cref="ActiviteitType"/>.
    /// Case-insensitive; surrounding whitespace is trimmed; empty/unknown returns false.
    /// </summary>
    public static bool TryFromCode(string? code, out ActiviteitType type)
    {
        if (!string.IsNullOrWhiteSpace(code) && ByCode.TryGetValue(code.Trim(), out type))
        {
            return true;
        }

        type = default;
        return false;
    }
}
