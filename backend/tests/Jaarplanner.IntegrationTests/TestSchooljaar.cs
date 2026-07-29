using Jaarplanner.Domain.Planning;

namespace Jaarplanner.IntegrationTests;

/// <summary>
/// Test helper for the school year a <see cref="Klas"/> now requires (Art. IX.3 containment, E3-01). Unlike the
/// in-memory unit tests, the Postgres suite has a real FK to satisfy, so the year must genuinely exist.
/// </summary>
internal static class TestSchooljaar
{
    /// <summary>
    /// A realistic Belgian school year (September → June) with no closures. <paramref name="startJaar"/> keeps the
    /// span consistent with the label when a test needs a second year.
    /// </summary>
    public static Schooljaar Maak(string naam = "2026-2027", int startJaar = 2026) =>
        new(naam, new DateOnly(startJaar, 9, 1), new DateOnly(startJaar + 1, 6, 30));

    /// <summary>The four standard Belgian vacations on top of <see cref="Maak"/> — the realistic grid fixture.</summary>
    public static Schooljaar MetVakanties(string naam = "2026-2027")
    {
        var schooljaar = Maak(naam);
        schooljaar.VoegSluitingToe(new Schoolsluiting("Herfstvakantie", new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 8)));
        schooljaar.VoegSluitingToe(new Schoolsluiting("Kerstvakantie", new DateOnly(2026, 12, 21), new DateOnly(2027, 1, 3)));
        schooljaar.VoegSluitingToe(new Schoolsluiting("Krokusvakantie", new DateOnly(2027, 2, 15), new DateOnly(2027, 2, 21)));
        schooljaar.VoegSluitingToe(new Schoolsluiting("Paasvakantie", new DateOnly(2027, 4, 5), new DateOnly(2027, 4, 18)));

        return schooljaar;
    }
}
