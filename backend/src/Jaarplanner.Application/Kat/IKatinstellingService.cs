namespace Jaarplanner.Application.Kat;

/// <summary>
/// Whether the school shows Chuck (FB-071, ADR-0065): read by every session, because every screen draws him or not;
/// changed by admin.
/// </summary>
public interface IKatinstellingService
{
    /// <summary>The school's setting. Off when admin never set it.</summary>
    Task<KatinstellingWeergave> HaalOpAsync(CancellationToken cancellationToken = default);

    /// <summary>Turns Chuck on or off for the whole school.</summary>
    Task<KatinstellingWeergave> ZetAsync(KatinstellingWeergave invoer, CancellationToken cancellationToken = default);
}

/// <summary>The setting as it travels, both ways.</summary>
public sealed record KatinstellingWeergave(bool IsZichtbaar);
