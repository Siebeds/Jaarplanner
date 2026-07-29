using Jaarplanner.Domain.Planning;

namespace Jaarplanner.IntegrationTests;

/// <summary>
/// Test helper for the school year a <see cref="Klas"/> now requires (Art. IX.3 containment, E3-01). Unlike the
/// in-memory unit tests, the Postgres suite has a real FK to satisfy, so the year must genuinely exist.
/// </summary>
internal static class TestSchooljaar
{
    /// <summary>
    /// The database limit on <c>Schooljaar.Naam</c> — <c>varchar(32)</c>, per <c>SchooljaarConfiguration</c>. Right for
    /// a label like "2026-2027", and unforgiving of a test that appends a full 32-char guid to a prefix.
    /// </summary>
    public const int MaxNaamLengte = 32;

    /// <summary>
    /// A unique school-year label guaranteed to fit <see cref="MaxNaamLengte"/>.
    /// <para>
    /// <b>Why this exists.</b> Seeds that built their own <c>$"{prefix}-{Guid.NewGuid():N}"</c> produced 41- and
    /// 44-character labels and every affected test died in its fixture with Postgres <c>22001 value too long for type
    /// character varying(32)</c>. Locally those tests <b>skip</b>, so nothing could show it until CI ran. Bounding the
    /// name here rather than at each call site means a new seed cannot reintroduce it.
    /// </para>
    /// <para>
    /// The truncation keeps at least 8 hex characters of the guid, which is ample: databases are per test class and
    /// labels only have to be unique within one.
    /// </para>
    /// </summary>
    public static string UniekeNaam(string prefix)
    {
        const int MinimumEntropie = 8;
        var maxPrefix = MaxNaamLengte - MinimumEntropie - 1; // -1 for the separator.
        var kort = prefix.Length > maxPrefix ? prefix[..maxPrefix] : prefix;

        return $"{kort}-{Guid.NewGuid():N}"[..MaxNaamLengte];
    }

    /// <summary>
    /// A realistic Belgian school year (September → June) with no closures. <paramref name="startJaar"/> keeps the
    /// span consistent with the label when a test needs a second year.
    /// </summary>
    public static Schooljaar Maak(string naam = "2026-2027", int startJaar = 2026) =>
        new(Kort(naam), new DateOnly(startJaar, 9, 1), new DateOnly(startJaar + 1, 6, 30));

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

    /// <summary>
    /// Clamps a caller-supplied label to <see cref="MaxNaamLengte"/>. A last-resort net so a long literal cannot fail
    /// a whole fixture with a <c>22001</c>; prefer <see cref="UniekeNaam"/>, which stays collision-resistant.
    /// </summary>
    private static string Kort(string naam) =>
        naam.Length > MaxNaamLengte ? naam[..MaxNaamLengte] : naam;
}
