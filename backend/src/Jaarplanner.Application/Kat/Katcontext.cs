using Jaarplanner.Application.Dekking;

namespace Jaarplanner.Application.Kat;

/// <summary>
/// One klas, as the detectors of a tick or a read see it (TB-057). Built once per klas and handed to every detector,
/// so the dekking, the most expensive computation in the system (Art. V.6), is computed at most once for it however
/// many detectors ask.
/// </summary>
public sealed class Katcontext
{
    private readonly Func<CancellationToken, Task<DekkingWeergave>> _dekking;
    private Task<DekkingWeergave>? _lopend;

    /// <param name="ontvangerIds">
    /// The leerkrachten of the klas (ADR-0059 D5), which is who a signal about it may address. An admin is not here:
    /// she reads every klas's signals but is addressed by none.
    /// </param>
    /// <param name="dekking">
    /// How to compute the klas's dekking. A delegate rather than the service, so a detector test needs no dekking at
    /// all and a detector that never asks costs nothing.
    /// </param>
    public Katcontext(
        Guid klasId,
        IReadOnlyList<string>? leeftijden,
        IReadOnlyList<Guid> ontvangerIds,
        DateOnly vandaag,
        Func<CancellationToken, Task<DekkingWeergave>> dekking)
    {
        ArgumentNullException.ThrowIfNull(ontvangerIds);
        ArgumentNullException.ThrowIfNull(dekking);
        if (klasId == Guid.Empty)
        {
            throw new ArgumentException("'klasId' is required.", nameof(klasId));
        }

        KlasId = klasId;
        Leeftijden = leeftijden;
        OntvangerIds = ontvangerIds;
        Vandaag = vandaag;
        _dekking = dekking;
    }

    /// <summary>The klas.</summary>
    public Guid KlasId { get; }

    /// <summary>
    /// The jaar/fasen the klas is measured against, from the one mapping (<c>Jaarfasen.VoorKlas</c>, Art. VI.1), so a
    /// detector reads the klas the way the dekking it must agree with does. <c>null</c> is "cannot be derived": widen,
    /// do not narrow, and say so, as <c>DekkingService</c> does (Art. XIV).
    /// </summary>
    public IReadOnlyList<string>? Leeftijden { get; }

    /// <summary>The leerkrachten a finding about this klas may address.</summary>
    public IReadOnlyList<Guid> OntvangerIds { get; }

    /// <summary>The school's day (Schoolklok), so every detector of one tick judges against the same date.</summary>
    public DateOnly Vandaag { get; }

    /// <summary>
    /// The klas's dekking, computed on the first ask and reused by every later one, including a second ask while the
    /// first is still running.
    /// </summary>
    public Task<DekkingWeergave> HaalDekkingAsync(CancellationToken ct) => _lopend ??= _dekking(ct);
}
