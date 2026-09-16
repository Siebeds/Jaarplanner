using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Jaarplanner.Application.Ontwikkelingsrapport;
using Microsoft.AspNetCore.DataProtection;

namespace Jaarplanner.Infrastructure.Ontwikkelingsrapport;

/// <summary>
/// The server's seal on a rewrite proposal (FB-004, ADR-0035 §3.5 D13), over ASP.NET Core Data Protection.
/// <para>
/// <b>No new secret.</b> It uses the key ring the app already has for its session cookies (ADR-0031 decision 5): kept in
/// the database and, outside Development, encrypted with the Key Vault key. So a seal survives a restart, is understood
/// by every instance, and there is no second thing an operator has to set or rotate.
/// </para>
/// <para>
/// <b>The seal carries no text.</b> Its payload names the doel and a SHA-256 of the proposal, never the proposal itself:
/// the server can recognise the text it is handed back without ever having stored it, and a seal that leaks tells no one
/// what was proposed. Data Protection encrypts and authenticates that payload, so the doel does not leak either, and a
/// seal cannot be edited into one for another child.
/// </para>
/// <para>
/// <b>The expiry is inside the payload</b>, checked here against the injected clock, rather than taken from
/// <c>ITimeLimitedDataProtector</c>: that lives in a package this project does not carry, and one timestamp under an
/// authenticated payload is the whole of what it would add.
/// </para>
/// </summary>
public sealed class HerschrijfZegel : IHerschrijfZegel
{
    /// <summary>
    /// How long a seal is good for. Long enough to read two texts side by side and decide, short enough that one cannot
    /// be kept and replayed against a text written much later.
    /// </summary>
    public static readonly TimeSpan Geldigheidsduur = TimeSpan.FromMinutes(20);

    /// <summary>Stands in for the rapportdoel id of the algemeen besluit, which has none.</summary>
    private const string Besluitsleutel = "besluit";

    private const char Scheiding = '|';

    private readonly IDataProtector _beschermer;
    private readonly TimeProvider _tijd;

    public HerschrijfZegel(IDataProtectionProvider provider, TimeProvider tijd)
    {
        ArgumentNullException.ThrowIfNull(provider);
        _beschermer = provider.CreateProtector("Jaarplanner.Ontwikkelingsrapport.Herschrijving.v1");
        _tijd = tijd ?? TimeProvider.System;
    }

    /// <inheritdoc />
    public string Onderteken(Herschrijfdoel doel, string voorstel)
    {
        ArgumentNullException.ThrowIfNull(doel);
        ArgumentNullException.ThrowIfNull(voorstel);

        var vervalt = _tijd.GetUtcNow().Add(Geldigheidsduur).ToUnixTimeSeconds();
        return _beschermer.Protect(
            vervalt.ToString(CultureInfo.InvariantCulture) + Scheiding + Lading(doel, voorstel));
    }

    /// <inheritdoc />
    public bool Klopt(Herschrijfdoel doel, string? voorstel, string zegel)
    {
        ArgumentNullException.ThrowIfNull(doel);
        if (string.IsNullOrWhiteSpace(zegel))
        {
            return false;
        }

        string ontsloten;
        try
        {
            ontsloten = _beschermer.Unprotect(zegel);
        }
        catch (CryptographicException)
        {
            // Tampered with, or sealed with a key this ring no longer has. Both mean the same to the caller: this is not
            // the server's own word, so it proves nothing.
            return false;
        }
        catch (FormatException)
        {
            // Not even base64: someone sent something that was never a seal.
            return false;
        }

        var streep = ontsloten.IndexOf(Scheiding, StringComparison.Ordinal);
        if (streep < 0
            || !long.TryParse(ontsloten[..streep], CultureInfo.InvariantCulture, out var vervalt)
            || DateTimeOffset.FromUnixTimeSeconds(vervalt) <= _tijd.GetUtcNow())
        {
            return false;
        }

        var lading = ontsloten[(streep + 1)..];

        // A rejection sends no text, because none may be stored: then only the doel is proven, which is all a rejection
        // needs. Ordinal, because both sides are of the server's own making.
        return voorstel is null
            ? lading.StartsWith(Doeldeel(doel), StringComparison.Ordinal)
            : string.Equals(lading, Lading(doel, voorstel), StringComparison.Ordinal);
    }

    private static string Lading(Herschrijfdoel doel, string voorstel) =>
        Doeldeel(doel) + Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(voorstel)));

    /// <summary>The doel's part of the payload, ending in its separator so it cannot match a longer id by prefix.</summary>
    private static string Doeldeel(Herschrijfdoel doel) =>
        string.Create(
            CultureInfo.InvariantCulture,
            $"{doel.LeerlingId:D}{Scheiding}{doel.Moment}{Scheiding}{(doel.RapportdoelId is { } id ? id.ToString("D", CultureInfo.InvariantCulture) : Besluitsleutel)}{Scheiding}");
}
