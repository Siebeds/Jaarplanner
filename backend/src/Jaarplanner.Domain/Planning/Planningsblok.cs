namespace Jaarplanner.Domain.Planning;

/// <summary>
/// One slot in the school year's planning grid (Art. IX.3, ADR-0013).
/// <para>
/// <b>Unit-agnostic by construction.</b> A block knows only its tier, its ordinal within the school
/// year, and the dates it spans. It exposes no month, week number or period name, so generation (E3-01),
/// the calendar (E3-06), drag-and-drop (E3-07), the zoom levels (E3-08) and coverage can all be written
/// against this type without betting on the granularity decision. Changing the grain is a configuration
/// change (see the planningsblok-indeling seam), not a refactor.
/// </para>
/// <para>
/// <b>Identity is the ordinal within its tier</b>, not the dates: the ordinal is what a plan attaches
/// thema's to, and it stays stable when a school later shifts its vacation dates by a few days. Blocks
/// are <b>derived</b> from the <see cref="Schooljaar"/> rather than stored, precisely so no persisted row
/// hard-codes the open-ended granularity question.
/// </para>
/// </summary>
public sealed record Planningsblok
{
    /// <summary>Constructs a block. <paramref name="eind"/> is inclusive and must not precede <paramref name="start"/>.</summary>
    public Planningsblok(Planningsblokniveau niveau, int ordinaal, DateOnly start, DateOnly eind)
    {
        if (ordinaal < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(ordinaal), ordinaal, "Een planningsblok begint bij ordinaal 1.");
        }

        if (eind < start)
        {
            throw new ArgumentException("Het einde van een planningsblok mag niet voor de start liggen.", nameof(eind));
        }

        Niveau = niveau;
        Ordinaal = ordinaal;
        Start = start;
        Eind = eind;
    }

    /// <summary>Which tier this block belongs to (themaperiode or subthemaperiode).</summary>
    public Planningsblokniveau Niveau { get; }

    /// <summary>1-based position within the school year, per tier. The stable key a plan refers to.</summary>
    public int Ordinaal { get; }

    /// <summary>First school day covered by this block.</summary>
    public DateOnly Start { get; }

    /// <summary>Last school day covered by this block (inclusive).</summary>
    public DateOnly Eind { get; }

    /// <summary>
    /// Calendar days spanned, inclusive. Note this is elapsed span, not teaching days — a block's span
    /// may include a short vacation when the indeling chose to absorb rather than split on it.
    /// </summary>
    public int AantalDagen => Eind.DayNumber - Start.DayNumber + 1;

    /// <summary>True when the block covers <paramref name="datum"/>.</summary>
    public bool Bevat(DateOnly datum) => datum >= Start && datum <= Eind;
}
