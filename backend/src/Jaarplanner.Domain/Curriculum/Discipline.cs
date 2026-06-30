namespace Jaarplanner.Domain.Curriculum;

/// <summary>
/// An Op.stap discipline (one Excel file per discipline). Read-only reference data
/// (Art. III.1): the official content is never mutated by the application.
/// <para>
/// The <see cref="Nummer"/> is a <b>string</b> because the numbering is partly nested
/// (the 9.x split: 9.1 Veilige en gezonde levensstijl, 9.2 Leren leren, 9.3 Sociaal en
/// emotioneel leren). <see cref="ParentDisciplineNummer"/> is set for those children and
/// null for the top-level disciplines (Art. VII.0, Art. IX.1).
/// </para>
/// <para>
/// Immutability is structural: every property has a <c>private set</c>, the only public
/// constructor validates and assigns all values once, and no application code path exposes
/// a mutator. The private parameterless constructor exists solely for EF Core materialisation.
/// </para>
/// </summary>
public sealed class Discipline
{
    // EF Core materialisation only — not an application construction path.
    private Discipline()
    {
        Nummer = null!;
        Naam = null!;
    }

    /// <summary>Constructs a discipline. <paramref name="nummer"/> and <paramref name="naam"/> are required.</summary>
    /// <param name="nummer">The Op.stap discipline number as a string (e.g. "1", "9.2"). Identity.</param>
    /// <param name="naam">The discipline name (e.g. "Wiskunde").</param>
    /// <param name="parentDisciplineNummer">The parent discipline number for a 9.x child; null for a top-level discipline.</param>
    public Discipline(string nummer, string naam, string? parentDisciplineNummer = null)
    {
        Nummer = Require(nummer, nameof(nummer));
        Naam = Require(naam, nameof(naam));
        ParentDisciplineNummer = string.IsNullOrWhiteSpace(parentDisciplineNummer)
            ? null
            : parentDisciplineNummer.Trim();
    }

    /// <summary>The discipline number (string) — stable identity (e.g. "1", "9.2").</summary>
    public string Nummer { get; private set; }

    /// <summary>The discipline name.</summary>
    public string Naam { get; private set; }

    /// <summary>The parent discipline number for the 9.x nesting; null for a top-level discipline.</summary>
    public string? ParentDisciplineNummer { get; private set; }

    private static string Require(string value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"'{paramName}' is required.", paramName);
        }

        return value.Trim();
    }
}
