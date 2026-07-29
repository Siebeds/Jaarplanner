using Jaarplanner.Domain.Planning;

namespace Jaarplanner.UnitTests;

/// <summary>
/// Test helper for the school year a <see cref="Klas"/> now requires (Art. IX.3 containment, E3-01). Fixtures that
/// only need "a class that exists" get one in two lines instead of re-typing a Belgian calendar.
/// </summary>
internal static class TestSchooljaar
{
    /// <summary>A realistic Belgian school year: 1 Sept 2026 → 30 June 2027, with no closures.</summary>
    public static Schooljaar Maak(string naam = "2026-2027") =>
        new(naam, new DateOnly(2026, 9, 1), new DateOnly(2027, 6, 30));

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
