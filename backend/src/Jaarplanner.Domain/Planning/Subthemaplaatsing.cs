namespace Jaarplanner.Domain.Planning;

/// <summary>
/// The stretch of days a subthema runs over in a <see cref="Jaarplan"/>: the window the teacher chose,
/// stored (owner ruling, 2026-08-25).
/// <para>
/// <b>THIS REVERSES A RECORDED DECISION, SO IT SAYS WHY.</b> <see cref="Activiteitplaatsing"/> stated
/// that a subthema is deliberately not placed at all, its span being derived from the activiteiten
/// under it, on the ground that a second placed thing is a second thing to keep in step. The owner
/// overruled it for a reason the original did not weigh: <b>a period has to be able to exist before
/// its content does.</b> A teacher who marks off five days for "de zon en de planten" and has one
/// activiteit ready has planned five days, and a calendar that draws one is not showing a smaller
/// version of their plan, it is showing a different plan. Activiteiten are added later, which is the
/// normal order of work.
/// </para>
/// <para>
/// <b>The objection in that note was real, and the answer is not to store more but to read less.</b>
/// Nothing here overrides the derived span: the calendar draws the <i>union</i> of this window and the
/// days that actually carry an activiteit of the subthema. So the two cannot contradict each other by
/// construction. An activiteit dragged past the end of its window widens the band instead of sitting
/// outside it, and shortening a window can never hide an activiteit that is already planned. There is
/// exactly one direction in which they can disagree, and in that direction the visible thing wins.
/// </para>
/// <para>
/// <b>It keys on calendar dates, like <see cref="Activiteitplaatsing"/> and unlike
/// <see cref="Themaplaatsing"/>.</b> A themaperiode keys on a derived block boundary and therefore
/// carries a staleness problem (<c>IsVervallen</c>, a notice, a re-placement route). A subthema window
/// the teacher drew with two date fields is not a derived boundary and must not inherit that machinery:
/// edit the school year and these dates either stay teaching days or become closures, which is the
/// smaller problem the day-level axis already lives with.
/// </para>
/// <para>
/// <b>It grants no dekking.</b> Art. V.1 makes a leerplandoel gedekt through a link hanging off a
/// <see cref="Themaplaatsing"/>. Marking off a fortnight for a subthema proves nothing about content
/// being taught, so nothing here may move a dekkingscijfer — the same rule
/// <see cref="Activiteitplaatsing"/> states for the same reason.
/// </para>
/// </summary>
public sealed class Subthemaplaatsing
{
    // EF Core materialisation only.
    private Subthemaplaatsing()
    {
    }

    /// <summary>Marks off <paramref name="van"/> to <paramref name="tot"/> for one subthema.</summary>
    /// <param name="jaarplanId">The owning jaarplan.</param>
    /// <param name="subthemaId">
    /// The subthema. It inherits its thema's klas (Art. IX.2); that the klas matches this plan's is
    /// enforced by <see cref="Jaarplan.PlaatsSubthema"/>, the only layer that knows both.
    /// </param>
    /// <param name="van">First day of the window, inclusive.</param>
    /// <param name="tot">
    /// Last day, inclusive. Equal to <paramref name="van"/> for a one-day window, which is legal: a
    /// teacher may mark off a single day.
    /// </param>
    /// <exception cref="ArgumentException">
    /// The window ends before it starts. Dutch, because both dates come from two fields on a teacher's
    /// screen and this is the sentence they can act on (Art. II.3).
    /// </exception>
    public Subthemaplaatsing(Guid jaarplanId, Guid subthemaId, DateOnly van, DateOnly tot)
    {
        if (tot < van)
        {
            throw new ArgumentException("De laatste dag van een subthemaperiode kan niet voor de eerste dag liggen.");
        }

        JaarplanId = jaarplanId;
        SubthemaId = subthemaId;
        Van = van;
        Tot = tot;
    }

    /// <summary>Identity of this window.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The plan this window belongs to.</summary>
    public Guid JaarplanId { get; private set; }

    /// <summary>The subthema that runs in it.</summary>
    public Guid SubthemaId { get; private set; }

    /// <summary>First day, inclusive.</summary>
    public DateOnly Van { get; private set; }

    /// <summary>Last day, inclusive.</summary>
    public DateOnly Tot { get; private set; }

    /// <summary>Whether this window covers <paramref name="datum"/>.</summary>
    public bool Omvat(DateOnly datum) => datum >= Van && datum <= Tot;

    /// <summary>
    /// Whether this window shares a day with <paramref name="van"/>–<paramref name="tot"/>.
    /// <para>
    /// Used to decide whether a newly chosen window <i>replaces</i> this one or sits beside it. Touching
    /// counts as overlapping only when a day is genuinely shared: two windows that abut (one ends on the
    /// Friday the next begins on the Monday) are two periods, not one, which is what a subthema running
    /// twice in a year looks like.
    /// </para>
    /// </summary>
    public bool Overlapt(DateOnly van, DateOnly tot) => van <= Tot && tot >= Van;

    /// <summary>
    /// Moves this window to a new range.
    /// <para>
    /// Used when a teacher re-plans a subthema they had already marked off: the newest answer wins whole
    /// rather than being merged with the old one. Merging would make a shortened window impossible to
    /// express, and "I meant these days instead" is the ordinary reason to open the planner again.
    /// </para>
    /// </summary>
    public void Herzet(DateOnly van, DateOnly tot)
    {
        if (tot < van)
        {
            throw new ArgumentException("De laatste dag van een subthemaperiode kan niet voor de eerste dag liggen.");
        }

        Van = van;
        Tot = tot;
    }
}
