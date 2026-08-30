namespace Jaarplanner.Domain.Planning;

/// <summary>
/// What a hoek is enriched with over one stretch of days: "prentenboeken over de herfst, bladerenpers op tafel"
/// (owner, meeting 2026-08-30). It belongs to a <see cref="Hoekplaatsing"/> and cannot exist without one.
/// <para>
/// <b>This is the entity that carries the pedagogy, and it is free text on purpose.</b> The owner's first sketch
/// had verrijkingen configured per subthema and picked from a list; that was dropped in the same session, because
/// what a teacher puts in her boekenhoek for these two weeks is too specific to be worth choosing from a menu she
/// would first have had to fill in. So there is nothing to validate here beyond "she wrote something".
/// </para>
/// <para>
/// <b>It carries its own window, and that is what makes a hoek placed once able to change through the year.</b>
/// The boekenhoek is placed from september to june; inside that placement one verrijking runs to the autumn
/// holiday and the next starts after it. Without its own dates a verrijking would be a property of the whole
/// placement, and a teacher wanting a second one would have to cut the placement in two, which is bookkeeping
/// about a corner that never moved.
/// </para>
/// <para>
/// <b>Gaps are legal and overlaps are not</b> — see <see cref="Hoekplaatsing.VoegVerrijkingToe"/> for the
/// reasoning, which belongs on the aggregate that can see the other verrijkingen.
/// </para>
/// </summary>
public sealed class Hoekverrijking
{
    // EF Core materialisation only.
    private Hoekverrijking()
    {
        Tekst = null!;
    }

    /// <summary>Creates a verrijking over <paramref name="van"/>–<paramref name="tot"/>.</summary>
    /// <param name="hoekplaatsingId">The placement this enrichment belongs to.</param>
    /// <param name="van">First day, inclusive.</param>
    /// <param name="tot">
    /// Last day, inclusive. Equal to <paramref name="van"/> for a single day, which is legal: a teacher may
    /// enrich a corner for one morning.
    /// </param>
    /// <param name="tekst">What she puts in the corner. Required — an enrichment that says nothing is not one.</param>
    /// <exception cref="ArgumentException">
    /// The window ends before it starts. Dutch, because both dates come from two fields on a teacher's screen and
    /// this is the sentence she can act on (Art. II.3).
    /// </exception>
    public Hoekverrijking(Guid hoekplaatsingId, DateOnly van, DateOnly tot, string tekst)
    {
        if (tot < van)
        {
            throw new ArgumentException("De laatste dag van een verrijking kan niet voor de eerste dag liggen.");
        }

        HoekplaatsingId = RequireId(hoekplaatsingId, nameof(hoekplaatsingId));
        Van = van;
        Tot = tot;
        Tekst = Require(tekst, nameof(tekst));
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The placement this enrichment hangs on.</summary>
    public Guid HoekplaatsingId { get; private set; }

    /// <summary>First day, inclusive.</summary>
    public DateOnly Van { get; private set; }

    /// <summary>Last day, inclusive.</summary>
    public DateOnly Tot { get; private set; }

    /// <summary>What the corner is enriched with. Free text, required.</summary>
    public string Tekst { get; private set; }

    /// <summary>Whether this enrichment covers <paramref name="datum"/>.</summary>
    public bool Omvat(DateOnly datum) => datum >= Van && datum <= Tot;

    /// <summary>
    /// Whether this enrichment shares a day with <paramref name="van"/>–<paramref name="tot"/>. Abutting windows
    /// (one ends on the Friday the next begins on the Monday) share no day and therefore do not overlap, which is
    /// what one enrichment following another looks like.
    /// </summary>
    public bool Overlapt(DateOnly van, DateOnly tot) => van <= Tot && tot >= Van;

    /// <summary>
    /// Rewrites the text and/or moves the window. Used by the detail sheet the teacher reaches by clicking the
    /// hoek in her agenda: she may have written the enrichment while dragging and thought better of it since.
    /// <para>
    /// The caller is <see cref="Hoekplaatsing.WijzigVerrijking"/> rather than a screen, because whether a new
    /// window is free is a question only the placement can answer.
    /// </para>
    /// </summary>
    internal void Wijzig(DateOnly van, DateOnly tot, string tekst)
    {
        if (tot < van)
        {
            throw new ArgumentException("De laatste dag van een verrijking kan niet voor de eerste dag liggen.");
        }

        Van = van;
        Tot = tot;
        Tekst = Require(tekst, nameof(tekst));
    }

    private static Guid RequireId(Guid value, string paramName) =>
        value == Guid.Empty ? throw new ArgumentException($"'{paramName}' is required.", paramName) : value;

    private static string Require(string value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"'{paramName}' is required.", paramName);
        }

        return value.Trim();
    }
}
