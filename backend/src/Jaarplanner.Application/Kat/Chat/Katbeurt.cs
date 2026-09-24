using System.Security.Cryptography;
using System.Text;

namespace Jaarplanner.Application.Kat.Chat;

/// <summary>
/// One turn of a conversation with the cat, as the server wrote it (FB-093, ADR-0071): what she asked, what Chuck
/// answered in the form the model is sent again (<see cref="Katbeurtschrijver"/>), and the server's seal over both. The
/// tool keeps no conversation (ADR-0059 D6), so the browser holds the turns and sends the last ones back with a new
/// question; the seal is how the server knows a turn is its own and unchanged.
/// </summary>
public sealed record Katbeurt(string Vraag, string Antwoord, string Zegel)
{
    /// <summary>Only the kind: what she asked and what he answered stay out of every log (ADR-0059 D6).</summary>
    public override string ToString() => nameof(Katbeurt);
}

/// <summary>
/// Seals the cat's turns and checks a turn sent back (FB-093, ADR-0071). A turn that comes from the browser could be
/// forged, and a forged answer of the cat's would steer the model; the seal is an HMAC-SHA256 over the gebruiker, the
/// question and the answer, so a turn changed on the way, invented, or taken from another gebruiker does not check.
/// <para>
/// The key is drawn at random when the process starts and is kept nowhere. A conversation over a restart of the server
/// therefore no longer checks, and starts again: nothing about a conversation outlives the process that answered it.
/// </para>
/// </summary>
public sealed class Katbeurtzegel
{
    private readonly byte[] _sleutel;

    /// <summary>A seal with a fresh random key.</summary>
    public Katbeurtzegel()
        : this(RandomNumberGenerator.GetBytes(32))
    {
    }

    /// <summary>A seal with the given key; for tests.</summary>
    public Katbeurtzegel(byte[] sleutel)
    {
        ArgumentNullException.ThrowIfNull(sleutel);
        ArgumentOutOfRangeException.ThrowIfLessThan(sleutel.Length, 32);
        _sleutel = sleutel.ToArray();
    }

    /// <summary>The turn <paramref name="vraag"/> and <paramref name="antwoord"/> make for this gebruiker, sealed.</summary>
    public Katbeurt Verzegel(Guid gebruikerId, string vraag, string antwoord)
    {
        ArgumentNullException.ThrowIfNull(vraag);
        ArgumentNullException.ThrowIfNull(antwoord);
        return new Katbeurt(vraag, antwoord, Convert.ToBase64String(Bereken(gebruikerId, vraag, antwoord)));
    }

    /// <summary>Whether <paramref name="beurt"/> is a turn this process sealed for this gebruiker, unchanged.</summary>
    public bool Klopt(Guid gebruikerId, Katbeurt? beurt)
    {
        if (beurt?.Vraag is null || beurt.Antwoord is null || beurt.Zegel is null)
        {
            return false;
        }

        var zegel = new byte[32];
        return Convert.TryFromBase64String(beurt.Zegel, zegel, out var lengte)
            && lengte == zegel.Length
            && CryptographicOperations.FixedTimeEquals(zegel, Bereken(gebruikerId, beurt.Vraag, beurt.Antwoord));
    }

    // Each field is preceded by its length, so no two different turns write the same bytes.
    private byte[] Bereken(Guid gebruikerId, string vraag, string antwoord)
    {
        var tekst = $"katbeurt/1|{gebruikerId:N}|{vraag.Length}|{vraag}|{antwoord.Length}|{antwoord}";
        return HMACSHA256.HashData(_sleutel, Encoding.UTF8.GetBytes(tekst));
    }
}

/// <summary>
/// A turn sent back does not check against <see cref="Katbeurtzegel"/>: it was changed, invented, or sealed before the
/// server restarted. The model is not called. The message names no content (ADR-0059 D6).
/// </summary>
public sealed class GesprekKloptNietFout : Exception
{
    public GesprekKloptNietFout()
        : base("A turn of the conversation does not carry a valid seal; the conversation starts again.")
    {
    }
}
