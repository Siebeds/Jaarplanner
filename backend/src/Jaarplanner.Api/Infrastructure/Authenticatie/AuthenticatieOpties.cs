namespace Jaarplanner.Api.Infrastructure.Authenticatie;

/// <summary>
/// The <c>Authenticatie</c> configuration section (E6-01, ADR-0031). The client secret is read from here too, but it
/// only ever arrives through user-secrets locally or Key Vault in the cloud (Art. VI.4); nothing in the repo sets it.
/// </summary>
public sealed class AuthenticatieOpties
{
    /// <summary>The configuration section name.</summary>
    public const string Sectie = "Authenticatie";

    /// <summary>
    /// How a person signs in. <see cref="AuthenticatieModus.Entra"/> unless configured otherwise, so an environment
    /// that forgets to say fails at startup on missing Entra settings rather than starting with a development sign-in.
    /// </summary>
    public AuthenticatieModus Modus { get; set; } = AuthenticatieModus.Entra;

    /// <summary>How long a session lasts without use, in hours. Sliding: every request renews it.</summary>
    public double SessieUren { get; set; } = 10;

    /// <summary>The school's Entra app registration. Only read in <see cref="AuthenticatieModus.Entra"/>.</summary>
    public EntraOpties Entra { get; set; } = new();
}

/// <summary>How a person signs in.</summary>
public enum AuthenticatieModus
{
    /// <summary>Microsoft Entra ID over OpenID Connect, in the school's own tenant.</summary>
    Entra,

    /// <summary>
    /// Pick an existing <c>Gebruiker</c> on a local page. Development only, loopback only: the app refuses to start
    /// with it in any other environment (ADR-0031 decision 6).
    /// </summary>
    Ontwikkeling,
}

/// <summary>The school's Entra app registration (ADR-0031, deployment prerequisites).</summary>
public sealed class EntraOpties
{
    /// <summary>The Entra login host.</summary>
    public string Instance { get; set; } = "https://login.microsoftonline.com/";

    /// <summary>The school's tenant id. The only tenant whose accounts can sign in (ADR-0030 R1).</summary>
    public string? TenantId { get; set; }

    /// <summary>The app registration's client id.</summary>
    public string? ClientId { get; set; }

    /// <summary>The app registration's client secret. User-secrets or Key Vault only (Art. VI.4).</summary>
    public string? ClientSecret { get; set; }

    /// <summary>The OpenID Connect authority for the school's tenant.</summary>
    public string Authority(Guid tenantId) => $"{Instance.TrimEnd('/')}/{tenantId}/v2.0";
}
