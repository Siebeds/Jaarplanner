namespace Jaarplanner.Domain.Ontwikkelingsrapport;

/// <summary>
/// That a <see cref="Rapportdoel"/> bundles one subdoel (FB-002, R3). A join row, identified by the pair, and created
/// only by <see cref="Rapportdoel.Wijzig"/> and its constructor.
/// <para>
/// <b>The subdoel does not know about it</b> (<c>Subdoel</c> and <c>Subthema</c> stay unaware of the report). The
/// database removes this row with the subdoel (a cascade on <c>rapportdoel_subdoelen.SubdoelId</c>), so every path that
/// deletes a subdoel takes it out of every rapportdoel, which keeps its titel (ADR-0035 D3).
/// </para>
/// </summary>
public sealed class RapportdoelSubdoel
{
    // EF Core materialisation only.
    private RapportdoelSubdoel()
    {
    }

    internal RapportdoelSubdoel(Guid rapportdoelId, Guid subdoelId)
    {
        RapportdoelId = rapportdoelId;
        SubdoelId = subdoelId;
    }

    /// <summary>The rapportdoel that bundles the subdoel.</summary>
    public Guid RapportdoelId { get; private set; }

    /// <summary>The bundled subdoel.</summary>
    public Guid SubdoelId { get; private set; }
}
