namespace Jaarplanner.Domain.Toegang;

/// <summary>
/// A staff member who may log in (ADR-0030 R2, ADR-0031). Directie creates one by invitation, under the e-mail
/// address directie typed; on that person's first login it is bound to their Microsoft Entra account for good.
/// <para>
/// <b>Once bound, the identity is the Entra pair, never the e-mail.</b> An address can be reassigned to someone else
/// by the school's tenant administrator, so after the first login <see cref="EntraTenantId"/> and
/// <see cref="EntraObjectId"/> are what a login is matched on, and the address only names the person. Before the first
/// login the address is all there is, which is why a binding is only ever made onto a row that has none yet
/// (<see cref="KoppelAanEntra"/>).
/// </para>
/// <para>
/// <b>Staff data, and nothing else (Art. VI.2).</b> A name, an address and two identifiers. It is personal data all
/// the same, so it has an entry to earn in the processing register (E7-06).
/// </para>
/// </summary>
public sealed class Gebruiker
{
    // EF Core materialisation only.
    private Gebruiker()
    {
        Email = null!;
        Naam = null!;
    }

    /// <summary>Invites a person. They can log in once their Entra account is bound on first login.</summary>
    /// <param name="email">The address directie invited them under. Stored normalised (<see cref="NormaliseerEmail"/>).</param>
    /// <param name="naam">The name to show until Entra supplies one; blank falls back to the address.</param>
    /// <param name="isDirectie">Whether this person is directie (ADR-0030 R3). The only right E6-01 knows.</param>
    public Gebruiker(string email, string naam, bool isDirectie)
    {
        Email = NormaliseerEmail(email);
        Naam = string.IsNullOrWhiteSpace(naam) ? Email : naam.Trim();
        IsDirectie = isDirectie;
    }

    /// <summary>Surrogate identity, assigned here because no Guid key in this model is store-generated.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The invitation address, trimmed and lower-cased. Unique.</summary>
    public string Email { get; private set; }

    /// <summary>The name shown in the app: the invitation's, replaced by Entra's display name on first login.</summary>
    public string Naam { get; private set; }

    /// <summary>
    /// Directie sees and edits everything (ADR-0030 R3), and maintains gebruikers and their rights (R16, Art. VI.1).
    /// Changed only through <see cref="GeefDirectierecht"/> and <see cref="NeemDirectierechtAf"/>.
    /// </summary>
    public bool IsDirectie { get; private set; }

    /// <summary>
    /// Themabeheer (ADR-0030 R4, Art. VI.1): edits thema's, runs the FR-1 import and the thema-opbouw wizard, and is,
    /// beside directie, the only right that generates and reviews doelsuggesties. Directie gives it (FA FR-12.2).
    /// </summary>
    public bool HeeftThemabeheer { get; private set; }

    /// <summary>Gives this gebruiker themabeheer. Idempotent.</summary>
    public void GeefThemabeheer() => HeeftThemabeheer = true;

    /// <summary>Takes themabeheer away. Idempotent. What they built stays; only the right goes.</summary>
    public void NeemThemabeheerAf() => HeeftThemabeheer = false;

    /// <summary>
    /// Leerlingzorg (ADR-0035 R18, §3.4; Art. VI.1): reads every ontwikkelingsrapport and does nothing else. Directie
    /// gives it, as it gives themabeheer (FA FR-12.2). A zorgcoördinator holds it because directie gave it, not by a title.
    /// </summary>
    public bool HeeftLeerlingzorg { get; private set; }

    /// <summary>Gives this gebruiker Leerlingzorg. Idempotent.</summary>
    public void GeefLeerlingzorg() => HeeftLeerlingzorg = true;

    /// <summary>Takes Leerlingzorg away. Idempotent.</summary>
    public void NeemLeerlingzorgAf() => HeeftLeerlingzorg = false;

    /// <summary>Gives this gebruiker the directie right (ADR-0030 R16: directie may give it to someone else). Idempotent.</summary>
    public void GeefDirectierecht() => IsDirectie = true;

    /// <summary>
    /// Takes the directie right away, unless this is the last gebruiker who holds it (ADR-0031 decision 7).
    /// <para>
    /// <b>The count is a parameter, so the guard cannot be skipped by forgetting it.</b> This entity cannot see the
    /// others, so the caller must say how many <i>other</i> gebruikers hold the right, and must read that figure in the
    /// same transaction as the write: two directieleden demoting each other at once would otherwise both see one other
    /// and both succeed. That locking is the caller's (E6-04), the rule is here.
    /// </para>
    /// </summary>
    /// <param name="aantalAndereDirectieleden">How many gebruikers other than this one hold the directie right.</param>
    /// <exception cref="InvalidOperationException">This is the last directie.</exception>
    public void NeemDirectierechtAf(int aantalAndereDirectieleden)
    {
        if (!IsDirectie)
        {
            return;
        }

        VereisAndereDirectie(aantalAndereDirectieleden);
        IsDirectie = false;
    }

    /// <summary>
    /// Refuses removing this gebruiker when they are the last directie (ADR-0031 decision 7): the bootstrap does not
    /// reopen once anyone exists, so a school without directie could never administer itself again. The same
    /// same-transaction caveat as <see cref="NeemDirectierechtAf"/> applies to the count.
    /// </summary>
    /// <param name="aantalAndereDirectieleden">How many gebruikers other than this one hold the directie right.</param>
    /// <exception cref="InvalidOperationException">This is the last directie.</exception>
    public void BevestigVerwijderbaar(int aantalAndereDirectieleden)
    {
        if (IsDirectie)
        {
            VereisAndereDirectie(aantalAndereDirectieleden);
        }
    }

    private static void VereisAndereDirectie(int aantalAndereDirectieleden)
    {
        if (aantalAndereDirectieleden < 1)
        {
            throw new InvalidOperationException(
                "The last gebruiker with the directie right cannot lose it (ADR-0031 decision 7).");
        }
    }

    /// <summary>The Entra tenant this person's account lives in; empty until the first login.</summary>
    public Guid? EntraTenantId { get; private set; }

    /// <summary>The Entra object id of this person's account; empty until the first login.</summary>
    public Guid? EntraObjectId { get; private set; }

    /// <summary>Whether a first login has bound this invitation to an Entra account.</summary>
    public bool IsGekoppeld => EntraObjectId is not null;

    /// <summary>
    /// Binds this invitation to the Entra account that just logged in with its address. <b>Permanent</b>: a second
    /// call throws, so an address that is later given to someone else can never take over an account that is bound.
    /// </summary>
    public void KoppelAanEntra(Guid tenantId, Guid objectId, string? naam)
    {
        if (IsGekoppeld)
        {
            throw new InvalidOperationException("This Gebruiker is already bound to an Entra account; a binding is permanent.");
        }

        if (tenantId == Guid.Empty || objectId == Guid.Empty)
        {
            throw new ArgumentException("An Entra binding needs both a tenant id and an object id.");
        }

        EntraTenantId = tenantId;
        EntraObjectId = objectId;
        if (!string.IsNullOrWhiteSpace(naam))
        {
            Naam = naam.Trim();
        }
    }

    /// <summary>
    /// The one way an address is compared: trimmed and lower-cased, and refused unless it is a single address.
    /// Entra user principal names are case-insensitive, and directie types them by hand.
    /// </summary>
    public static string NormaliseerEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            throw new ArgumentException("'email' is required.", nameof(email));
        }

        var genormaliseerd = email.Trim().ToLowerInvariant();
        var apenstaart = genormaliseerd.IndexOf('@');
        if (apenstaart <= 0
            || apenstaart == genormaliseerd.Length - 1
            || genormaliseerd.IndexOf('@', apenstaart + 1) >= 0
            || genormaliseerd.Any(char.IsWhiteSpace))
        {
            throw new ArgumentException("'email' must be a single address.", nameof(email));
        }

        return genormaliseerd;
    }
}
