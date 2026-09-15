namespace Jaarplanner.Application.Ontwikkelingsrapport;

/// <summary>
/// The children of a K3 klas, for the ontwikkelingsrapport (FB-001, FR-13.1, Art. IX.4, ADR-0035 §3.1). <b>Pupil data</b>
/// (Art. VI.7): a voornaam and an achternaam, typed by hand one child at a time (R14, R15), and nothing else.
/// <para>
/// <b>Who may call what is the matrix's</b> (<c>OntwikkelingsrapportLezen</c>, <c>LeerlingenBeheren</c>), applied on the
/// routes. What this service adds is the rule that holds for directie too: only a klas that grants K3 can have
/// leerlingen (default D9).
/// </para>
/// <para>
/// <b>No child's name in a fault or a log</b> (ADR-0035 §3.8). Refusals name the field, never its value. Faults use the
/// shared CRUD vocabulary (<c>SchoolcontentNietGevondenFout</c> → 404, <c>SchoolcontentValidatieFout</c> → 400).
/// </para>
/// </summary>
public interface ILeerlingBeheerService
{
    /// <summary>The children of a klas, by voornaam and then achternaam, ignoring case. 404 when the klas does not exist.</summary>
    Task<IReadOnlyList<LeerlingWeergave>> HaalLeerlingenOpAsync(Guid klasId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Adds a child. 404 when the klas does not exist, 400 when it does not grant K3 (D9) or a name is missing or too long.
    /// </summary>
    Task<LeerlingWeergave> MaakLeerlingAsync(Guid klasId, LeerlingInvoer invoer, CancellationToken cancellationToken = default);

    /// <summary>Corrects a child's name. 404 when the child no longer exists.</summary>
    Task<LeerlingWeergave> WijzigLeerlingAsync(
        Guid leerlingId,
        LeerlingInvoer invoer,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a child with every report of theirs (D8: for a child who leaves the school, or a parent who asks for
    /// erasure), through the database cascade. 404 when the child no longer exists.
    /// </summary>
    Task VerwijderLeerlingAsync(Guid leerlingId, CancellationToken cancellationToken = default);
}

/// <summary>What a teacher types about a child: the two names and nothing else (Art. VI.7).</summary>
/// <param name="Voornaam">Required, at most 100 characters after trimming.</param>
/// <param name="Achternaam">Required, at most 100 characters after trimming.</param>
/// <remarks>
/// Nullable on purpose: with a non-nullable string, ASP.NET's implicit <c>[Required]</c> would refuse a blank name first,
/// in English, before the service's Dutch sentence could.
/// </remarks>
public sealed record LeerlingInvoer(string? Voornaam, string? Achternaam);

/// <summary>A child as the list screen reads it.</summary>
/// <param name="Id">Surrogate identity.</param>
/// <param name="KlasId">The klas the child is in.</param>
/// <param name="Voornaam">The child's first name.</param>
/// <param name="Achternaam">The child's family name.</param>
public sealed record LeerlingWeergave(Guid Id, Guid KlasId, string Voornaam, string Achternaam);
