using System.Collections.ObjectModel;

namespace Jaarplanner.Domain.Curriculum;

/// <summary>
/// Single source of truth for the mapping between the official Op.stap doelsoort
/// short codes (Excel column A — <c>MD</c>, <c>G</c>, <c>+</c>, <c>P</c>, <c>S</c>,
/// <c>A</c>) and the <see cref="Doelsoort"/> enum (Art. III.3 — the column→model
/// mapping lives in one place; Art. VII.1). The Excel parser (E1-04) reuses this
/// instead of re-deciding the codes.
/// </summary>
public static class DoelsoortCodes
{
    private static readonly ReadOnlyDictionary<Doelsoort, string> ByDoelsoort =
        new(new Dictionary<Doelsoort, string>
        {
            [Doelsoort.Minimumdoel] = "MD",
            [Doelsoort.Gemeenschappelijk] = "G",
            [Doelsoort.Verdieping] = "+",
            [Doelsoort.Precurriculum] = "P",
            [Doelsoort.Specifiek] = "S",
            [Doelsoort.AnderstaligeNieuwkomers] = "A",
        });

    private static readonly ReadOnlyDictionary<string, Doelsoort> ByCode =
        new(ByDoelsoort.ToDictionary(kvp => kvp.Value, kvp => kvp.Key, StringComparer.OrdinalIgnoreCase));

    /// <summary>The official short code (e.g. <c>"MD"</c>, <c>"+"</c>) for a doelsoort.</summary>
    public static string ToCode(this Doelsoort doelsoort) =>
        ByDoelsoort.TryGetValue(doelsoort, out var code)
            ? code
            : throw new ArgumentOutOfRangeException(nameof(doelsoort), doelsoort, "Unknown doelsoort.");

    /// <summary>
    /// Parses an official Op.stap short code into a <see cref="Doelsoort"/>.
    /// Case-insensitive; surrounding whitespace is trimmed.
    /// </summary>
    public static Doelsoort FromCode(string code)
    {
        ArgumentNullException.ThrowIfNull(code);
        if (ByCode.TryGetValue(code.Trim(), out var doelsoort))
        {
            return doelsoort;
        }

        throw new ArgumentException($"Unknown doelsoort code '{code}'.", nameof(code));
    }

    /// <summary>Attempts to parse an official short code; returns false on an unknown/empty code.</summary>
    public static bool TryFromCode(string? code, out Doelsoort doelsoort)
    {
        if (!string.IsNullOrWhiteSpace(code) && ByCode.TryGetValue(code.Trim(), out doelsoort))
        {
            return true;
        }

        doelsoort = default;
        return false;
    }
}
