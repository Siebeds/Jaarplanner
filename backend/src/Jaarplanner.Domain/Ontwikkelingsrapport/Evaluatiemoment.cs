namespace Jaarplanner.Domain.Ontwikkelingsrapport;

/// <summary>
/// The three fixed moments a child is evaluated at in a schooljaar: Rapport 1, 2 and 3 (FB-003, ADR-0035 R8, Art. IX.4).
/// <b>A value, not an entity</b>: no name and no date belongs to a moment (R8), so it is stored as its number on the
/// <see cref="Ontwikkelingsrapport"/> it identifies.
/// </summary>
public static class Evaluatiemoment
{
    /// <summary>Rapport 1.</summary>
    public const int Eerste = 1;

    /// <summary>Rapport 3.</summary>
    public const int Laatste = 3;

    /// <summary>Whether <paramref name="moment"/> is one of the three.</summary>
    public static bool IsGeldig(int moment) => moment is >= Eerste and <= Laatste;
}
