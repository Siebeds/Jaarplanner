namespace Jaarplanner.Application.Toegang;

/// <summary>
/// Who may log in, and who is logged in (E6-01, ADR-0030 R2, ADR-0031 decision 3).
/// <para>
/// Deliberately knows nothing about OpenID Connect, cookies or HTTP: the Api reads the claims Entra sent and hands them
/// over as an <see cref="EntraIdentiteit"/>, so the rule that decides whether a person gets a session can be tested
/// against a real database without a tenant (ADR-0011 §1: the mechanism is wrapped, use cases do not depend on it).
/// </para>
/// </summary>
public interface IToegangService
{
    /// <summary>
    /// Decides whether the Entra account that just authenticated may have a session, and binds a pending invitation
    /// to it on its first login.
    /// <list type="number">
    /// <item>The account must belong to <paramref name="schoolTenantId"/> and be a member, not a guest.</item>
    /// <item>An account already bound is recognised by its tenant id and object id alone.</item>
    /// <item>Otherwise its user principal name is compared, normalised, with the invitation addresses, and only an
    /// invitation that is <b>not yet bound</b> can match. The binding is then permanent.</item>
    /// </list>
    /// No e-mail claim is ever consulted: only the principal name, which the tenant administrator assigns.
    /// </summary>
    Task<Aanmeldresultaat> MeldAanMetEntraAsync(
        EntraIdentiteit identiteit,
        Guid schoolTenantId,
        CancellationToken cancellationToken = default);

    /// <summary>The person behind a session, or <c>null</c> when they no longer exist.</summary>
    Task<GebruikerWeergave?> HaalGebruikerOpAsync(Guid gebruikerId, CancellationToken cancellationToken = default);

    /// <summary>Everyone who may log in, by name. Only the development sign-in lists them.</summary>
    Task<IReadOnlyList<GebruikerWeergave>> HaalGebruikersOpAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates the first directie account for <paramref name="email"/>, but <b>only while nobody exists at all</b>
    /// (ADR-0031 decision 7). Returns whether it created one. Removing the last directie later therefore does not
    /// reopen this door.
    /// </summary>
    Task<bool> ZorgVoorEersteDirectieAsync(string email, CancellationToken cancellationToken = default);
}

/// <summary>What the Api read from Entra's ID token, before anything has been decided about it.</summary>
/// <param name="TenantId">The <c>tid</c> claim.</param>
/// <param name="ObjectId">The <c>oid</c> claim: the stable identity of the account inside its tenant.</param>
/// <param name="Upn">The <c>preferred_username</c> claim, which for a member account of a single tenant is its UPN.</param>
/// <param name="Naam">The <c>name</c> claim, for display only.</param>
/// <param name="IsLid">Whether the <c>acct</c> optional claim said "member" (<c>0</c>). Absent counts as not a member.</param>
public sealed record EntraIdentiteit(Guid? TenantId, Guid? ObjectId, string? Upn, string? Naam, bool IsLid);

/// <summary>Why a login was refused. For the log, not for the person: they see one Dutch sentence whatever the reason.</summary>
public enum Aanmeldweigering
{
    /// <summary>The token lacked a tenant id or an object id.</summary>
    OnvolledigeIdentiteit,

    /// <summary>The account belongs to another tenant than the school's.</summary>
    AndereTenant,

    /// <summary>The account is a guest in the school's tenant, or the <c>acct</c> claim was not issued.</summary>
    GeenLid,

    /// <summary>No invitation matches, or the matching one is already bound to another account.</summary>
    NietUitgenodigd,
}

/// <summary>The outcome of <see cref="IToegangService.MeldAanMetEntraAsync"/>: a person, or a reason.</summary>
public sealed record Aanmeldresultaat(GebruikerWeergave? Gebruiker, Aanmeldweigering? Weigering)
{
    public static Aanmeldresultaat Toegelaten(GebruikerWeergave gebruiker) => new(gebruiker, null);

    public static Aanmeldresultaat Geweigerd(Aanmeldweigering weigering) => new(null, weigering);
}

/// <summary>A person who may log in, as the API shows them (<c>GET /api/ik</c>).</summary>
public sealed record GebruikerWeergave(Guid Id, string Naam, string Email, bool IsDirectie);
