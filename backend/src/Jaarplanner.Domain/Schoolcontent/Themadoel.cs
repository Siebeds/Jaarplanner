namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// One of the 2–3 overarching goals that anchor a whole <see cref="Thema"/> (Art. IX.2) —
/// <b>school-scoped</b>, deliberately the same school-wide, and meant to be verbreed/verdiept/
/// herhaald across ages. It links to a read-only leerplandoel through its owned
/// <see cref="Koppeling"/> (which carries the status + AI motivation). Distinct from a per-activity
/// goal link, which is why it is its own entity rather than a bare <see cref="DoelKoppeling"/>.
/// </summary>
public sealed class Themadoel
{
    // EF Core materialisation only.
    private Themadoel()
    {
        Koppeling = null!;
    }

    internal Themadoel(Guid themaId, DoelKoppeling koppeling)
    {
        ThemaId = themaId;
        Koppeling = koppeling ?? throw new ArgumentNullException(nameof(koppeling));
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The owning (school-scoped) thema.</summary>
    public Guid ThemaId { get; private set; }

    /// <summary>The link to the read-only leerplandoel, with status + AI motivation (Art. IV.2).</summary>
    public DoelKoppeling Koppeling { get; private set; }
}
