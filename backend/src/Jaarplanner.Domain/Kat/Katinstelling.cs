namespace Jaarplanner.Domain.Kat;

/// <summary>
/// Whether the school shows Chuck, the cat, in the app (FB-071, ADR-0065). One row for the school, set by admin.
/// <para>
/// <b>Off until the school turns it on.</b> The owner ruled on 2026-09-22 that Chuck waits behind this setting until the
/// onderwijsadviseur approves him (ADR-0059). No row means off, so a fresh database shows no cat. A gebruiker cannot
/// hide him for herself: this is the only switch, and it is the school's.
/// </para>
/// <para>
/// It only hides the cat. The background job that notices signals has its own switch (<c>Kat:Ingeschakeld</c>), which is
/// operator configuration, not a school decision.
/// </para>
/// </summary>
public sealed class Katinstelling
{
    /// <summary>The id of the one row: the app serves one school per database (ADR-0036), so there is nothing to key by.</summary>
    public static readonly Guid EnigeId = new("6b61742d-0000-4000-8000-000000000001");

    // EF Core materialisation only.
    private Katinstelling()
    {
    }

    /// <summary>The school's setting, as admin set it.</summary>
    public Katinstelling(bool isZichtbaar)
    {
        IsZichtbaar = isZichtbaar;
    }

    /// <summary>Always <see cref="EnigeId"/>.</summary>
    public Guid Id { get; private set; } = EnigeId;

    /// <summary>Whether Chuck lies in the app for every gebruiker.</summary>
    public bool IsZichtbaar { get; private set; }

    /// <summary>Turns him on or off for the whole school.</summary>
    public void Zet(bool isZichtbaar) => IsZichtbaar = isZichtbaar;
}
