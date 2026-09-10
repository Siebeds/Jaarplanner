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
    /// <param name="jaarfase">
    /// The Op.stap jaar/fase the class teaches, or null. See <see cref="Klas.Jaarfase"/>: it is what lets a
    /// kleuterklas be measured against its own kleuterjaar instead of all three.
    /// </param>
    public Klas VoegKlasToe(string naam, string jaarfase)
    {
        var klas = new Klas(Id, naam, jaarfase);
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
    /// Days between <paramref name="start"/> and <paramref name="eind"/> (inclusive) on which the school is
    /// <b>open</b> — i.e. <see cref="IsLesdag"/> holds.
    /// <para>
    /// <b>The single definition, deliberately.</b> Two callers previously counted this for themselves: the
    /// planning grid (which reported open days) and the spreading report (which used the raw calendar span).
    /// The two therefore disagreed about how long the same block was — the kalender printed "4,9 weken" for a
    /// period the overload check treated as 5,3 — so a thema could be reported as fitting a period the screen
    /// beside it called too short. Counting lives here so there is one answer (E3-02 code review).
    /// </para>
    /// <para>
    /// Note this counts weekends, because <see cref="IsLesdag"/> excludes only closures and nothing in this
    /// model represents a weekend. Whether it should is an open question for the school; what matters here is
    /// that every caller gets the <i>same</i> figure.
    /// </para>
    /// </summary>
    public int TelOpenDagen(DateOnly start, DateOnly eind)
    {
        var open = 0;

        for (var datum = start; datum <= eind; datum = datum.AddDays(1))
        {
            if (IsLesdag(datum))
            {
                open++;
            }
        }

        return open;
    }

    /// <summary>
    /// Days between <paramref name="start"/> and <paramref name="eind"/> (inclusive) that are <b>both</b> open and a
    /// weekday — Monday to Friday, minus every closure. The figure a teacher recognises as "schooldagen" (E9-02).
    /// <para>
    /// <b>This is display-only and must never feed a weeks figure.</b> <see cref="TelOpenDagen"/> is what
    /// <c>BlokspreidingWeergave.BeschikbareWeken</c> divides by 7, and that is the <i>sole</i> definition of
    /// <c>te vol</c> (owner ruling 2026-07-31). Substituting this count there would turn a 5-week period into
    /// <c>ceil(25/7) = 4</c> weeks and make every nominal 5-week thema overload the period built for it. Pinned by a
    /// test; if you find yourself reaching for this in an arithmetic that produces weeks, you want the other one.
    /// </para>
    /// <para>
    /// <b>Why a second count exists at all, and why it is here rather than in a mapper.</b> The owner asked
    /// (2026-08-19) for a period's length to read in days as well as weeks, and <see cref="TelOpenDagen"/> cannot be
    /// printed as "schooldagen": it counts weekends, so a 5-week period reports 35. <c>PlanningsblokWeergave</c>'s own
    /// documentation warns that answering this with "a second, weekend-aware definition living in that mapper" is the
    /// drift this project keeps paying for — so it lives in the domain, next to the count it must not be confused
    /// with, and both say what they are for.
    /// </para>
    /// <para>
    /// <b>It does not answer the open question about <see cref="IsLesdag"/>.</b> That method still excludes only
    /// closures, and whether it <i>should</i> exclude weekends stays a question for the school. This adds a second
    /// fact ("how many days will I stand in front of this class?") rather than changing the first ("how long is this
    /// block?"), so nothing that depends on <see cref="IsLesdag"/> moves.
    /// </para>
    /// <para>
    /// <b>Half days are not modelled and this counts none.</b> Flemish primary schools do not teach Wednesday
    /// afternoons, so a teacher counting contact hours will find this figure generous. Whether a half day counts is a
    /// school question with no ruling, and inventing an answer in code would be exactly the kind of assumption
    /// Art. XIV reserves for the school.
    /// </para>
    /// <para>
    /// Named for what it counts rather than for what a screen calls it. <c>TelLesdagen</c> would sit beside
    /// <see cref="IsLesdag"/> meaning something narrower, which is one word with two meanings in one class; the Dutch
    /// word "schooldagen" belongs in <c>nl.json</c>, not here.
    /// </para>
    /// </summary>
    public int TelOpenWeekdagen(DateOnly start, DateOnly eind) => OpenWeekdagen(start, eind).Count;

    /// <summary>
    /// The open weekdays between <paramref name="start"/> and <paramref name="eind"/>, inclusive: the days
    /// themselves rather than how many there are.
    /// <para>
    /// <b><see cref="TelOpenWeekdagen"/> delegates to this rather than counting its own.</b> Two loops applying
    /// "not a weekend and not a closure" is one rule in two places, and the first thing that would drift is the
    /// half-day question this class deliberately leaves open: a school ruling on Wednesday afternoons would have
    /// to be applied twice and would be applied once.
    /// </para>
    /// <para>
    /// Added for the hoekplaatsingen (owner, 2026-08-30): a hoek that takes a lesuur takes it on every day the
    /// class is actually in front of the teacher, so the placement needs the list to write a row per day.
    /// </para>
    /// </summary>
    public IReadOnlyList<DateOnly> OpenWeekdagen(DateOnly start, DateOnly eind)
    {
        var dagen = new List<DateOnly>();

        for (var datum = start; datum <= eind; datum = datum.AddDays(1))
        {
            if (datum.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday) && IsLesdag(datum))
            {
                dagen.Add(datum);
            }
        }

        return dagen;
    }

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
