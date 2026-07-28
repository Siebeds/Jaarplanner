namespace Jaarplanner.Domain.Planning;

/// <summary>
/// A school year (Art. IX.3): it spans the Belgian school year and <b>carries the
/// vakantie-/periodestructuur</b> from which the planning grid is derived.
/// <para>
/// <b>Belgian school year, not a calendar year.</b> It runs from September to June and therefore straddles
/// two calendar years — one more reason the planning grid is not a month sequence (ADR-0013). The dates are
/// supplied per school rather than computed, because the exact first and last school day, and the vacation
/// dates, differ by school and by year and are set by the onderwijskalender.
/// </para>
/// <para>
/// The blocks themselves are <b>not stored here.</b> They are derived on demand by the planningsblok-indeling
/// seam, so the granularity stays a configuration concern and no persisted row commits the school to a grain
/// (Art. XIV / ADR-0013). What this entity owns is the raw input to that derivation: the span and the
/// vacations.
/// </para>
/// </summary>
public sealed class Schooljaar
{
    private readonly List<Schoolvakantie> _vakanties = [];

    // EF Core materialisation only.
    private Schooljaar()
    {
        Naam = null!;
    }

    /// <summary>Creates a school year.</summary>
    /// <param name="naam">The school year label, e.g. "2026-2027".</param>
    /// <param name="start">First school day (typically early September).</param>
    /// <param name="eind">Last school day, inclusive (typically end of June).</param>
    public Schooljaar(string naam, DateOnly start, DateOnly eind)
    {
        if (string.IsNullOrWhiteSpace(naam))
        {
            throw new ArgumentException("'naam' is required.", nameof(naam));
        }

        if (eind <= start)
        {
            throw new ArgumentException("Een schooljaar moet na de startdatum eindigen.", nameof(eind));
        }

        Naam = naam.Trim();
        Start = start;
        Eind = eind;
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The school year label (e.g. "2026-2027").</summary>
    public string Naam { get; private set; }

    /// <summary>First school day.</summary>
    public DateOnly Start { get; private set; }

    /// <summary>Last school day (inclusive).</summary>
    public DateOnly Eind { get; private set; }

    /// <summary>The vacation/closure periods, ordered by start date.</summary>
    public IReadOnlyList<Schoolvakantie> Vakanties => _vakanties.OrderBy(v => v.Start).ToList();

    /// <summary>Adds a vacation period. Rejects one falling outside the school year, and overlaps.</summary>
    public void VoegVakantieToe(Schoolvakantie vakantie)
    {
        ArgumentNullException.ThrowIfNull(vakantie);

        if (vakantie.Start < Start || vakantie.Eind > Eind)
        {
            throw new ArgumentException(
                $"Vakantie '{vakantie.Naam}' valt buiten het schooljaar ({Start:yyyy-MM-dd} t/m {Eind:yyyy-MM-dd}).",
                nameof(vakantie));
        }

        var overlap = _vakanties.FirstOrDefault(v => v.Start <= vakantie.Eind && vakantie.Start <= v.Eind);
        if (overlap is not null)
        {
            throw new ArgumentException(
                $"Vakantie '{vakantie.Naam}' overlapt met '{overlap.Naam}'.",
                nameof(vakantie));
        }

        _vakanties.Add(vakantie);
    }

    /// <summary>True when <paramref name="datum"/> is a teaching day: inside the year and not in a vacation.</summary>
    public bool IsLesdag(DateOnly datum) =>
        datum >= Start && datum <= Eind && !_vakanties.Any(v => v.Bevat(datum));

    /// <summary>
    /// The teaching stretches between vacations, in order — the raw material the indeling seam turns into
    /// blocks. Returned as (start, eind) pairs; a year with no vacations yields a single stretch.
    /// </summary>
    public IReadOnlyList<(DateOnly Start, DateOnly Eind)> Lesperiodes()
    {
        var periodes = new List<(DateOnly Start, DateOnly Eind)>();
        var cursor = Start;

        foreach (var vakantie in _vakanties.OrderBy(v => v.Start))
        {
            if (vakantie.Start > cursor)
            {
                periodes.Add((cursor, vakantie.Start.AddDays(-1)));
            }

            if (vakantie.Eind >= cursor)
            {
                cursor = vakantie.Eind.AddDays(1);
            }
        }

        if (cursor <= Eind)
        {
            periodes.Add((cursor, Eind));
        }

        return periodes;
    }
}
