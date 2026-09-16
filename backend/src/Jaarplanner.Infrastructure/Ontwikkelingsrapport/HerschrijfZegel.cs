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
/// <b>The seal carries no text.</b> Its payload names the doel and a SHA-256 of each of the two texts, never a text:
/// the server can recognise what it handed out without ever having stored it, and a seal that leaks tells no one what
/// was proposed. Data Protection encrypts and authenticates that payload, so the doel does not leak either, and a seal
/// cannot be edited into one for another child.
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

    /// <summary>
    /// The field separator. Every field is a number, a GUID, a fixed word or base64, and none of those can contain it,
    /// so the payload parses back unambiguously.
    /// </summary>
    private const char Scheiding = '|';

    private const int Velden = 6;

    private readonly IDataProtector _beschermer;
    private readonly TimeProvider _tijd;

    public HerschrijfZegel(IDataProtectionProvider provider, TimeProvider tijd)
    {
        ArgumentNullException.ThrowIfNull(provider);
        _beschermer = provider.CreateProtector("Jaarplanner.Ontwikkelingsrapport.Herschrijving.v1");
        _tijd = tijd ?? TimeProvider.System;
    }

    /// <inheritdoc />
    public string Onderteken(Herschrijfdoel doel, string brontekst, string voorstel)
    {
        ArgumentNullException.ThrowIfNull(doel);
        ArgumentNullException.ThrowIfNull(brontekst);
        ArgumentNullException.ThrowIfNull(voorstel);

        var vervalt = _tijd.GetUtcNow().Add(Geldigheidsduur).ToUnixTimeSeconds();
        return _beschermer.Protect(string.Join(
            Scheiding,
            vervalt.ToString(CultureInfo.InvariantCulture),
            doel.LeerlingId.ToString("D", CultureInfo.InvariantCulture),
            doel.Moment.ToString(CultureInfo.InvariantCulture),
            Doelsleutel(doel),
            Afdruk(brontekst),
            Afdruk(voorstel)));
    }

    /// <inheritdoc />
    public bool DektVoorstel(Herschrijfdoel doel, string? voorstel, string? zegel) =>
        voorstel is not null && Lees(doel, zegel) is { } velden && velden[5] == Afdruk(voorstel);

    /// <inheritdoc />
    public bool DektBrontekst(Herschrijfdoel doel, string? brontekst, string? zegel) =>
        brontekst is not null && Lees(doel, zegel) is { } velden && velden[4] == Afdruk(brontekst);

    /// <summary>
    /// The payload of a seal that is this server's own, this doel's, and not expired, or <c>null</c> when it is none of
    /// those. All three failures mean the same to a caller: this is not the server's word, so it proves nothing.
    /// </summary>
    private string[]? Lees(Herschrijfdoel doel, string? zegel)
    {
        ArgumentNullException.ThrowIfNull(doel);
        if (string.IsNullOrWhiteSpace(zegel))
        {
            return null;
        }

        string ontsloten;
        try
        {
            ontsloten = _beschermer.Unprotect(zegel);
        }
        catch (CryptographicException)
        {
            // Tampered with, or sealed with a key this ring no longer has.
            return null;
        }
        catch (FormatException)
        {
            // Not even base64: someone sent something that was never a seal.
            return null;
        }

        var velden = ontsloten.Split(Scheiding);
        if (velden.Length != Velden
            || !long.TryParse(velden[0], CultureInfo.InvariantCulture, out var vervalt)
            || DateTimeOffset.FromUnixTimeSeconds(vervalt) <= _tijd.GetUtcNow())
        {
            return null;
        }

        // Ordinal throughout: both sides are of the server's own making.
        return string.Equals(velden[1], doel.LeerlingId.ToString("D", CultureInfo.InvariantCulture), StringComparison.Ordinal)
            && string.Equals(velden[2], doel.Moment.ToString(CultureInfo.InvariantCulture), StringComparison.Ordinal)
            && string.Equals(velden[3], Doelsleutel(doel), StringComparison.Ordinal)
                ? velden
                : null;
    }

    private static string Doelsleutel(Herschrijfdoel doel) =>
        doel.RapportdoelId is { } id ? id.ToString("D", CultureInfo.InvariantCulture) : Besluitsleutel;

    private static string Afdruk(string tekst) =>
        Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(tekst)));
}
