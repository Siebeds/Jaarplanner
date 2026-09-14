namespace Jaarplanner.Domain.Toegang;

/// <summary>
/// A gebruiker teaches a klas: the link that makes them a leerkracht of it (Art. VI.1 "Leerkracht", ADR-0030 R15).
/// Many-to-many, so a klas may have several leerkrachten (a co-teacher, a duobaan) and a leerkracht several klassen.
/// Unique per pair.
/// <para>
/// <b>What it grants is computed, not stored here</b> (the rights service reads it): the klas's planning with no end
/// date (ADR-0030 I21), and, while the klas's schooljaar has not ended, the leeftijd right for the klas's
/// <b>stated</b> jaarfase (R20, R22, I12; <see cref="Leeftijdsrechten"/>). A row holds nothing that could go stale.
/// </para>
/// </summary>
public sealed class Klastoewijzing
{
    // EF Core materialisation only.
    private Klastoewijzing()
    {
    }

    /// <summary>Links <paramref name="gebruikerId"/> to <paramref name="klasId"/> as its leerkracht.</summary>
    public Klastoewijzing(Guid gebruikerId, Guid klasId)
    {
        if (gebruikerId == Guid.Empty)
        {
            throw new ArgumentException("'gebruikerId' is required.", nameof(gebruikerId));
        }

        if (klasId == Guid.Empty)
        {
            throw new ArgumentException("'klasId' is required.", nameof(klasId));
        }

        GebruikerId = gebruikerId;
        KlasId = klasId;
    }

    /// <summary>Surrogate identity, assigned here because no Guid key in this model is store-generated.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The leerkracht. Removing the gebruiker removes this link.</summary>
    public Guid GebruikerId { get; private set; }

    /// <summary>The klas they teach. Removing the klas removes this link.</summary>
    public Guid KlasId { get; private set; }
}
