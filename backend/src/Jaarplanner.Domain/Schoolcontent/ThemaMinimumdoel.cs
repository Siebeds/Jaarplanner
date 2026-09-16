namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// A minimumdoel a <see cref="Thema"/> aims at, as one of its themadoelen (FB-043, ADR-0046). School-scoped like the
/// thema: a thema runs across several leeftijden, and the minimumdoel is the level that spans them.
/// <para>
/// The link names the minimumdoel by its stable <see cref="MinimumdoelRef"/> and nothing else. The leerplandoelen it
/// brings along are those that concord to it, read through the concordance whenever they are needed and never copied
/// here, so they come and go with the link. It carries no status and no AI motivation: only a person makes this link.
/// </para>
/// </summary>
public sealed class ThemaMinimumdoel
{
    // EF Core materialisation only.
    private ThemaMinimumdoel()
    {
        MinimumdoelRef = null!;
    }

    internal ThemaMinimumdoel(Guid themaId, string minimumdoelRef)
    {
        if (string.IsNullOrWhiteSpace(minimumdoelRef))
        {
            throw new ArgumentException("'minimumdoelRef' is required.", nameof(minimumdoelRef));
        }

        ThemaId = themaId;
        MinimumdoelRef = minimumdoelRef.Trim();
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The owning (school-scoped) thema.</summary>
    public Guid ThemaId { get; private set; }

    /// <summary>The read-only minimumdoel's stable ref (Art. III.5).</summary>
    public string MinimumdoelRef { get; private set; }
}
