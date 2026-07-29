namespace Jaarplanner.Domain.Planning;

/// <summary>
/// A school year (Art. IX.3): it spans the Belgian school year and <b>carries the
/// vakantie-/periodestructuur</b> from which the planning grid is derived.
/// <para>
/// <b>Belgian school year, not a calendar year.</b> It runs from September to June and therefore straddles
/// two calendar years — one more reason the planning grid is not a month sequence (ADR-0013). The dates are
/// supplied per school rather than computed, because the exact first and last school day, and the closure
/// dates, differ by school and by year and are set by the onderwijskalender.
/// </para>
/// <para>
/// <b>Two kinds of closure, and only one of them breaks the grid</b> (directie 2026-07-28, ADR-0020). A
/// <see cref="Sluitingssoort.Vakantie"/> cuts the year into teaching stretches; a
/// <see cref="Sluitingssoort.VrijeDag"/> is a day off <i>inside</i> a stretch. Without that distinction the
/// 5 days between Hemelvaart and Pinksteren became their own one-week "themaperiode" — unplannable.
/// </para>
/// <para>
/// The blocks themselves are <b>not stored here.</b> They are derived on demand by the planningsblok-indeling
/// seam, so the granularity stays a configuration concern and no persisted row commits the school to a grain
/// (Art. XIV / ADR-0013). What this entity owns is the raw input to that derivation: the span and the closures.
/// </para>
/// </summary>
public sealed class Schooljaar
{
    private readonly List<Schoolsluiting> _sluitingen = [];
    private readonly List<Klas> _klassen = [];

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

    /// <summary>Every closure — vacations and single free days alike — ordered by start date.</summary>
    public IReadOnlyList<Schoolsluiting> Sluitingen => _sluitingen.OrderBy(s => s.Start).ToList();

    /// <summary>
    /// Only the closures that <b>end a planning period</b> (the real vacations), ordered by start date. This
    /// is what <see cref="Lesperiodes"/> cuts on.
    /// </summary>
    public IReadOnlyList<Schoolsluiting> Vakanties =>
        _sluitingen.Where(s => s.BreektPeriode).OrderBy(s => s.Start).ToList();

    /// <summary>
    /// The classes this school year contains (Art. IX.3: "Schooljaar — contains multiple klassen"), ordered by
    /// leerjaar then name. Each <see cref="Klas"/> has one <see cref="Jaarplan"/>, planned over the blocks
    /// derived from <i>this</i> year's vakantiestructuur — which is why the containment exists rather than
    /// classes floating free of any year.
    /// </summary>
    public IReadOnlyList<Klas> Klassen =>
        _klassen.OrderBy(k => k.Leerjaar).ThenBy(k => k.Naam, StringComparer.Ordinal).ToList();

    /// <summary>
    /// Creates a class inside this school year and returns it — the containment expressed as a mutator on the
    /// owning side, mirroring <c>Thema.VoegSubthemaToe</c>. Uniqueness of the class name is a school-wide
    /// database guarantee checked by the beheer service, not re-implemented here.
    /// </summary>
    /// <param name="naam">The class name (e.g. "L3 — derde leerjaar").</param>
    /// <param name="leerjaar">The leerjaar/leeftijdsgroep ordinal; 0 for kleuter groepen.</param>
    public Klas VoegKlasToe(string naam, int leerjaar)
    {
        var klas = new Klas(Id, naam, leerjaar);
        _klassen.Add(klas);

        return klas;
    }

    /// <summary>
    /// Adds a closure. Rejects one falling outside the school year, and one overlapping an existing closure.
    /// </summary>
    public void VoegSluitingToe(Schoolsluiting sluiting)
    {
        ArgumentNullException.ThrowIfNull(sluiting);

        if (sluiting.Start < Start || sluiting.Eind > Eind)
        {
            throw new ArgumentException(
                $"Sluiting '{sluiting.Naam}' valt buiten het schooljaar ({Start:yyyy-MM-dd} t/m {Eind:yyyy-MM-dd}).",
                nameof(sluiting));
        }

        var overlap = _sluitingen.FirstOrDefault(s => s.Start <= sluiting.Eind && sluiting.Start <= s.Eind);
        if (overlap is not null)
        {
            throw new ArgumentException(
                $"Sluiting '{sluiting.Naam}' overlapt met '{overlap.Naam}'.",
                nameof(sluiting));
        }

        _sluitingen.Add(sluiting);
    }

    /// <summary>
    /// True when <paramref name="datum"/> is a teaching day: inside the year and not covered by <b>any</b>
    /// closure. Note a planningsblok may still contain non-teaching days — a <see cref="Sluitingssoort.VrijeDag"/>
    /// falls inside a block by design.
    /// </summary>
    public bool IsLesdag(DateOnly datum) =>
        datum >= Start && datum <= Eind && !_sluitingen.Any(s => s.Bevat(datum));

    /// <summary>
    /// The teaching stretches between <b>vacations</b> — the raw material the indeling seam turns into blocks.
    /// Returned as (start, eind) pairs; a year with no vacations yields a single stretch.
    /// <para>
    /// Single free days (<see cref="Sluitingssoort.VrijeDag"/>) deliberately do <b>not</b> split a stretch, so
    /// a week containing Hemelvaart stays part of its surrounding period rather than becoming an unplannable
    /// sliver of its own.
    /// </para>
    /// </summary>
    public IReadOnlyList<(DateOnly Start, DateOnly Eind)> Lesperiodes()
    {
        var periodes = new List<(DateOnly Start, DateOnly Eind)>();
        var cursor = Start;

        foreach (var vakantie in _sluitingen.Where(s => s.BreektPeriode).OrderBy(s => s.Start))
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
