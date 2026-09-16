using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Domain.Planning;

/// <summary>
/// One thema placed in a <see cref="Jaarplan"/> from one day to another (Art. IX.3, ADR-0049): the thema runs from
/// <see cref="Van"/> to <see cref="Tot"/>, both inclusive.
/// <para>
/// <b>It keys on its own dates, not on a derived period.</b> Until ADR-0049 a placement stored the start of the
/// themaperiode it sat in and always filled that period. The owner ruled that thema's are not planned in fixed periods,
/// so a placement now says exactly which days the thema runs. A vacation never lies inside a placement: the service
/// splits a range at every vacation and stores the parts, which <c>Themareeks</c> reads back as one thema.
/// </para>
/// <para>
/// <b>Dates can still stop fitting.</b> When the school edits its vacations, a placement may come to hold one, or reach
/// outside the year. It is then <i>vervallen</i>: never moved, reported with a lasting notice, and dekking reads
/// <i>te herzien</i> until the teacher saves it again (directie 2026-07-28, kept by ADR-0049 decision 5). Deciding that
/// takes the <see cref="Schooljaar"/>, so it is <see cref="Themakalender.IsVervallen"/>'s job, not this type's.
/// </para>
/// <para>
/// <b>Advisory, like every AI output</b> (Art. IV.1/IV.2/IV.3): a generated placement is persisted with
/// <see cref="KoppelingStatus.Voorgesteld"/> and an <see cref="AiMotivatie"/>, and only the teacher decides it.
/// </para>
/// </summary>
public sealed class Themaplaatsing
{
    // EF Core materialisation only.
    private Themaplaatsing()
    {
    }

    /// <summary>Creates a placement of one thema from <paramref name="van"/> to <paramref name="tot"/>.</summary>
    /// <param name="jaarplanId">The owning jaarplan.</param>
    /// <param name="themaId">The placed thema (school-scoped autonomous content, Art. IX.2).</param>
    /// <param name="van">First day, inclusive.</param>
    /// <param name="tot">Last day, inclusive; not before <paramref name="van"/>.</param>
    /// <param name="status">
    /// The human-in-the-loop status (Art. IV.2). AI-generated placements start
    /// <see cref="KoppelingStatus.Voorgesteld"/>; a teacher-made placement is <see cref="KoppelingStatus.Manueel"/>.
    /// </param>
    /// <param name="aiMotivatie">The AI's short "waarom hier?" motivation (Art. IV.3); null for manual placements.</param>
    public Themaplaatsing(
        Guid jaarplanId,
        Guid themaId,
        DateOnly van,
        DateOnly tot,
        KoppelingStatus status,
        string? aiMotivatie = null)
    {
        JaarplanId = RequireId(jaarplanId, nameof(jaarplanId));
        ThemaId = RequireId(themaId, nameof(themaId));
        (Van, Tot) = RequireRange(van, tot);
        Status = RequireStatus(status);
        AiMotivatie = Optional(aiMotivatie);
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The owning jaarplan.</summary>
    public Guid JaarplanId { get; private set; }

    /// <summary>The placed thema (Art. IX.2 — school-scoped, shared school-wide).</summary>
    public Guid ThemaId { get; private set; }

    /// <summary>The first day the thema runs, inclusive.</summary>
    public DateOnly Van { get; private set; }

    /// <summary>The last day the thema runs, inclusive.</summary>
    public DateOnly Tot { get; private set; }

    /// <summary>The persisted human-in-the-loop status of this placement (Art. IV.2).</summary>
    public KoppelingStatus Status { get; private set; }

    /// <summary>
    /// The AI's short motivation for placing this thema here (Art. IV.3); null for a purely manual placement.
    /// </summary>
    public string? AiMotivatie { get; private set; }

    /// <summary>
    /// <b>Excluded from (re)generation</b> (Art. IX.3). A teacher who is happy with a proposed thema locks it, and a
    /// later regeneration must leave it where it is.
    /// </summary>
    public bool Vergrendeld { get; private set; }

    /// <summary>
    /// Whether a (re)generation run may discard this placement: only an untouched AI proposal that the teacher
    /// has not locked (Art. IV.1, Art. IX.3).
    /// </summary>
    public bool IsVervangbaar => Status == KoppelingStatus.Voorgesteld && !Vergrendeld;

    /// <summary>
    /// Whether this placement means the thema is actually <b>planned</b>: anything except a rejected one.
    /// <para>
    /// Since ADR-0049 a rejection deletes the proposal and the migration deleted the old rejections, so a
    /// <see cref="KoppelingStatus.Geweigerd"/> placement no longer arises. The predicate stays because the status does,
    /// and every rule that asks "is this thema taught here?" keeps asking it through this one test.
    /// </para>
    /// </summary>
    public bool IsGepland => Status != KoppelingStatus.Geweigerd;

    /// <summary>Whether this placement shares a calendar day with <paramref name="van"/>–<paramref name="tot"/>.</summary>
    public bool Overlapt(DateOnly van, DateOnly tot) => Van <= tot && Tot >= van;

    /// <summary>
    /// Records the teacher's decision on this placement (Art. IV.1/IV.2). The teacher is the only actor that
    /// moves a placement off <see cref="KoppelingStatus.Voorgesteld"/>.
    /// </summary>
    public void WijzigStatus(KoppelingStatus status) => Status = RequireStatus(status);

    /// <summary>Locks or unlocks the placement against (re)generation (Art. IX.3).</summary>
    public void StelVergrendelingIn(bool vergrendeld) => Vergrendeld = vergrendeld;

    /// <summary>
    /// Gives the placement new dates: the teacher changed its begin or end, or dragged it (FR-6.2, FR-7.2).
    /// <para>
    /// <b>The dates are now the teacher's, so the status becomes <see cref="KoppelingStatus.Manueel"/> and the AI
    /// motivation is cleared.</b> The motivation argued for the days the model chose; keeping it would attribute the
    /// teacher's decision to the model (Art. IV.3). A change is therefore not reversible: moving back restores the dates
    /// only, which is why the service writes nothing when the dates do not change.
    /// </para>
    /// </summary>
    public void Herplan(DateOnly van, DateOnly tot)
    {
        (Van, Tot) = RequireRange(van, tot);
        Status = KoppelingStatus.Manueel;
        AiMotivatie = null;
    }

    private static KoppelingStatus RequireStatus(KoppelingStatus status) =>
        Enum.IsDefined(status)
            ? status
            : throw new ArgumentOutOfRangeException(nameof(status), status, "Unknown plaatsingsstatus.");

    // The guards below catch programmer error, never teacher input: the service refuses a reversed range in Dutch
    // before it gets here. English per Art. II.2.
    private static (DateOnly Van, DateOnly Tot) RequireRange(DateOnly van, DateOnly tot) =>
        tot < van
            ? throw new ArgumentException($"A placement cannot end ({tot:yyyy-MM-dd}) before it starts ({van:yyyy-MM-dd}).")
            : (van, tot);

    private static Guid RequireId(Guid value, string paramName) =>
        value == Guid.Empty
            ? throw new ArgumentException($"'{paramName}' is required.", paramName)
            : value;

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
