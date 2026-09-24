using Jaarplanner.Application.Planning.Weekplanning;

namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// Thrown when a teacher's placement of a thema cannot be honoured: adding one, giving one new dates or dragging one
/// (FR-6.2, FR-7.2, ADR-0053). The (thin) Api maps it to a 400 via <c>PlanningExceptionHandler</c>.
/// <para>
/// <b>One factory per case</b>, following the <c>OngeldigeImportFout</c> precedent: a refusal composed at the throw
/// site ends up existing twice once a second caller needs it, and the copies drift. Every sentence a teacher can read
/// for this fault is in this file. Dutch, because every case is one the teacher can act on (Art. II.3), with dates
/// written the way the weekplanning refusals write them.
/// </para>
/// </summary>
public sealed class OngeldigePlaatsingFout : Exception
{
    private OngeldigePlaatsingFout(string message)
        : base(message)
    {
    }

    /// <summary>The chosen first day is not a schooldag: a weekend, a vacation or a free day.</summary>
    public static OngeldigePlaatsingFout GeenSchooldag(DateOnly datum) =>
        new($"Op {Dagnotatie.Formatteer(datum)} is er geen school. Kies een schooldag als begin.");

    /// <summary>
    /// The thema is not meant for the klas's leeftijd (FB-012, ADR-0069 D2). The screen does not offer it; this answers a
    /// request that names it anyway.
    /// </summary>
    public static OngeldigePlaatsingFout NietVoorKlas(string themaNaam, string klasNaam, IEnumerable<string> leeftijden) =>
        new($"Het thema '{themaNaam}' is niet bedoeld voor de leeftijd van {klasNaam}. Het geldt voor {string.Join(", ", leeftijden)}.");

    /// <summary>The end lies before the begin.</summary>
    public static OngeldigePlaatsingFout EindeVoorBegin() =>
        new("De einddatum ligt vóór de begindatum. Kies een latere einddatum.");

    /// <summary>A date lies outside the school year the class belongs to.</summary>
    public static OngeldigePlaatsingFout BuitenSchooljaar(DateOnly eerste, DateOnly laatste) =>
        new($"Die datum ligt buiten het schooljaar. Kies een dag van {Dagnotatie.Formatteer(eerste)} " +
            $"tot {Dagnotatie.Formatteer(laatste)}.");

    /// <summary>The chosen days hold no schooldag at all, so nothing would be stored.</summary>
    public static OngeldigePlaatsingFout GeenSchooldagen() =>
        new("Tussen die datums valt geen enkele schooldag. Kies andere datums.");

    /// <summary>
    /// The chosen days share a day with another placement. No two thema's run on the same day (owner ruling
    /// 2026-09-16), so the sentence names the thema in the way and its days.
    /// </summary>
    public static OngeldigePlaatsingFout Overlapt(string themaNaam, DateOnly van, DateOnly tot) =>
        new($"Van {Dagnotatie.Formatteer(van)} tot {Dagnotatie.Formatteer(tot)} loopt al het thema " +
            $"'{themaNaam}'. Twee thema's kunnen niet op dezelfde dag lopen: kies andere dagen of verschuif dat thema eerst.");
}
