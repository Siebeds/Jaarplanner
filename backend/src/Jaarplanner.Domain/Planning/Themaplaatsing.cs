using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Domain.Planning;

/// <summary>
/// One thema placed in one planningsblok of a <see cref="Jaarplan"/> (Art. IX.3: "per planningsblok a list
/// of thema's, with a <c>vergrendeld</c> flag per thema"). This is the only thing a jaarplan persists — the
/// grid itself is derived (ADR-0013/0020), so there is no planningsblok row for this to point at.
/// <para>
/// <b>It keys on <see cref="BlokStart"/>, never on <c>Planningsblok.Ordinaal</c>.</b> This is the single most
/// consequential design decision in the type. The ordinal is a display position over a <i>derived</i> grid:
/// move one vakantie by a day and a teaching stretch can yield a different number of blocks, re-pointing every
/// later ordinal (pinned by <c>PlanningsblokIndelingTests.Ordinaal_is_geen_stabiele_sleutel_over_vakantiewijzigingen</c>).
/// A placement keyed on the ordinal would therefore silently relocate a teacher's thema when the school edited
/// its calendar. The block's start date is a real calendar anchor, so that is what is stored, together with the
/// <see cref="BlokNiveau"/> — the two halves of <c>Planningsblok</c>'s documented identity (ADR-0020 §3).
/// </para>
/// <para>
/// <b>Keyed on a date is still not immune to a calendar edit.</b> A stored start date can stop being a block
/// boundary after a vakantie edit. That placement is then <i>stale</i>, and the ruling of 2026-07-28 (ADR-0020
/// follow-ups) is explicit: it is never silently moved, it raises a persistent notification, and dekking is
/// reported as <i>te herzien</i> until a human resolves it. Detecting and surfacing that is E3-07/E3-09's job;
/// what this type guarantees is only that the stored key is honest enough for it to be detectable.
/// </para>
/// <para>
/// <b>Advisory, like every AI output</b> (Art. IV.1/IV.2/IV.3): a generated placement is persisted with
/// <see cref="KoppelingStatus.Voorgesteld"/> and an <see cref="AiMotivatie"/>, and only the teacher moves it to
/// aanvaard/geweigerd/manueel. Nothing is auto-applied.
/// </para>
/// </summary>
public sealed class Themaplaatsing
{
    // EF Core materialisation only.
    private Themaplaatsing()
    {
    }

    /// <summary>Creates a placement of one thema in one planningsblok.</summary>
    /// <param name="jaarplanId">The owning jaarplan.</param>
    /// <param name="themaId">The placed thema (school-scoped autonomous content, Art. IX.2).</param>
    /// <param name="blokNiveau">The tier of the block the thema is placed in.</param>
    /// <param name="blokStart">
    /// The block's <b>start date</b> — the stable half of the block identity. Never an ordinal.
    /// </param>
    /// <param name="status">
    /// The human-in-the-loop status (Art. IV.2). AI-generated placements start
    /// <see cref="KoppelingStatus.Voorgesteld"/>; a teacher-made placement is <see cref="KoppelingStatus.Manueel"/>.
    /// </param>
    /// <param name="aiMotivatie">The AI's short "waarom hier?" motivation (Art. IV.3); null for manual placements.</param>
    public Themaplaatsing(
        Guid jaarplanId,
        Guid themaId,
        Planningsblokniveau blokNiveau,
        DateOnly blokStart,
        KoppelingStatus status,
        string? aiMotivatie = null)
    {
        JaarplanId = RequireId(jaarplanId, nameof(jaarplanId));
        ThemaId = RequireId(themaId, nameof(themaId));
        BlokNiveau = RequireNiveau(blokNiveau);
        BlokStart = blokStart;
        Status = RequireStatus(status);
        AiMotivatie = Optional(aiMotivatie);
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The owning jaarplan.</summary>
    public Guid JaarplanId { get; private set; }

    /// <summary>The placed thema (Art. IX.2 — school-scoped, shared school-wide).</summary>
    public Guid ThemaId { get; private set; }

    /// <summary>Which tier of the grid this placement sits on (themaperiode or subthemaperiode).</summary>
    public Planningsblokniveau BlokNiveau { get; private set; }

    /// <summary>
    /// The <b>start date</b> of the planningsblok this thema is placed in — the stable key (ADR-0020 §3).
    /// Deliberately not an ordinal: see the type documentation.
    /// </summary>
    public DateOnly BlokStart { get; private set; }

    /// <summary>The persisted human-in-the-loop status of this placement (Art. IV.2).</summary>
    public KoppelingStatus Status { get; private set; }

    /// <summary>
    /// The AI's short motivation for placing this thema here (Art. IV.3); null for a purely manual placement.
    /// </summary>
    public string? AiMotivatie { get; private set; }

    /// <summary>
    /// <b>Excluded from (re)generation</b> (Art. IX.3, consumed by E4). A teacher who is happy with a thema in a
    /// period locks it, and a later regeneration must leave it exactly where it is. Modelled here rather than in
    /// E4 because it is a property of the placement, and a flag invented at regeneration time would have no
    /// place to live.
    /// </summary>
    public bool Vergrendeld { get; private set; }

    /// <summary>
    /// Whether a (re)generation run may discard this placement: only an untouched AI proposal that the teacher
    /// has not locked. An accepted/rejected/manual placement is a human decision and a locked one is an explicit
    /// "leave this alone" — neither is the generator's to overwrite (Art. IV.1, Art. IX.3).
    /// </summary>
    public bool IsVervangbaar => Status == KoppelingStatus.Voorgesteld && !Vergrendeld;

    /// <summary>
    /// Records the teacher's decision on this placement (Art. IV.1/IV.2). The teacher is the only actor that
    /// moves a placement off <see cref="KoppelingStatus.Voorgesteld"/>.
    /// </summary>
    public void WijzigStatus(KoppelingStatus status) => Status = RequireStatus(status);

    /// <summary>Locks or unlocks the placement against (re)generation (Art. IX.3).</summary>
    public void StelVergrendelingIn(bool vergrendeld) => Vergrendeld = vergrendeld;

    private static KoppelingStatus RequireStatus(KoppelingStatus status) =>
        Enum.IsDefined(status)
            ? status
            : throw new ArgumentOutOfRangeException(nameof(status), status, "Unknown plaatsingsstatus.");

    private static Planningsblokniveau RequireNiveau(Planningsblokniveau niveau) =>
        Enum.IsDefined(niveau)
            ? niveau
            : throw new ArgumentOutOfRangeException(nameof(niveau), niveau, "Onbekend planningsblokniveau.");

    private static Guid RequireId(Guid value, string paramName) =>
        value == Guid.Empty
            ? throw new ArgumentException($"'{paramName}' is required.", paramName)
            : value;

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
