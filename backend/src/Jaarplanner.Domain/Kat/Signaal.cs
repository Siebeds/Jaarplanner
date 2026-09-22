namespace Jaarplanner.Domain.Kat;

/// <summary>
/// Something the cat noticed about one klas, for one recipient (TB-057, Art. IX.3, ADR-0059 D2). The background job
/// derives it without AI, and removes it again when its reason is gone. It never counts for dekking (Art. V.1).
/// <para>
/// <b>It stores no message.</b> What the recipient reads is derived again when the deurmat shows it, so the cat can
/// never assert a state of the dekking the computation no longer supports (D2). A row therefore holds identity
/// (<see cref="Soort"/>, <see cref="KlasId"/>, <see cref="OntvangerId"/>, <see cref="Sleutel"/>) and the state a
/// person put on it (<see cref="GezienOp"/>, <see cref="UitgesteldTot"/>), and nothing a recomputation could
/// contradict.
/// </para>
/// <para>
/// <b>One row per recipient.</b> Two leerkrachten of one klas each get their own, because each postpones and reads
/// for herself. An admin reads every klas's signals but is addressed by none (D5), so no row is ever written for her.
/// </para>
/// </summary>
public sealed class Signaal
{
    /// <summary>The longest <see cref="Sleutel"/>, in characters: a goal code, a subthema id, or such a pair.</summary>
    public const int MaxSleutellengte = 200;

    // EF Core materialisation only.
    private Signaal()
    {
        Sleutel = null!;
    }

    /// <summary>A newly noticed signal, unseen and not postponed.</summary>
    /// <exception cref="ArgumentException">An id is empty, or the sleutel is blank or too long.</exception>
    /// <exception cref="ArgumentOutOfRangeException">The soort is not one of <see cref="Signaalsoort"/>.</exception>
    public Signaal(Signaalsoort soort, Guid klasId, Guid ontvangerId, string sleutel, DateTimeOffset aangemaakt)
    {
        if (!Enum.IsDefined(soort))
        {
            throw new ArgumentOutOfRangeException(nameof(soort), soort, "Unknown signaalsoort.");
        }

        if (klasId == Guid.Empty)
        {
            throw new ArgumentException("'klasId' is required.", nameof(klasId));
        }

        if (ontvangerId == Guid.Empty)
        {
            throw new ArgumentException("'ontvangerId' is required.", nameof(ontvangerId));
        }

        Soort = soort;
        KlasId = klasId;
        OntvangerId = ontvangerId;
        Sleutel = SchoneSleutel(sleutel);
        Aangemaakt = aangemaakt;
    }

    /// <summary>Surrogate identity, assigned here because no Guid key in this model is store-generated.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>What was noticed.</summary>
    public Signaalsoort Soort { get; private set; }

    /// <summary>The klas it is about. Removing the klas removes the signal.</summary>
    public Guid KlasId { get; private set; }

    /// <summary>Who is addressed: a leerkracht of the klas (D5). Removing the gebruiker removes the signal.</summary>
    public Guid OntvangerId { get; private set; }

    /// <summary>
    /// What makes it the same thing noticed twice: unique together with <see cref="Soort"/>, <see cref="KlasId"/> and
    /// <see cref="OntvangerId"/>. The detector chooses it (a goal code, a subthema id), and a tick over an unchanged
    /// state therefore writes nothing (D1).
    /// </summary>
    public string Sleutel { get; private set; }

    /// <summary>When the tick first noticed it.</summary>
    public DateTimeOffset Aangemaakt { get; private set; }

    /// <summary>When the recipient first saw it in the deurmat, or <c>null</c> while she has not.</summary>
    public DateTimeOffset? GezienOp { get; private set; }

    /// <summary>
    /// The day it comes back after "Later", or <c>null</c> when it was not postponed: the next schooldag by default
    /// (ADR-0059 D4). The caller decides which day that is; a signal knows only that it stays away until then.
    /// </summary>
    public DateOnly? UitgesteldTot { get; private set; }

    /// <summary>Whether the deurmat shows it on <paramref name="vandaag"/>, the school's day (Schoolklok).</summary>
    public bool IsZichtbaarOp(DateOnly vandaag) => UitgesteldTot is not { } tot || tot <= vandaag;

    /// <summary>Records that the recipient saw it. Seeing it again changes nothing.</summary>
    public void MarkeerGezien(DateTimeOffset moment) => GezienOp ??= moment;

    /// <summary>
    /// Puts it away until <paramref name="tot"/> (D4). Postponing it again moves the day, which is what a second
    /// "Later" on a signal that came back means.
    /// </summary>
    public void StelUit(DateOnly tot) => UitgesteldTot = tot;

    private static string SchoneSleutel(string sleutel)
    {
        if (string.IsNullOrWhiteSpace(sleutel))
        {
            throw new ArgumentException("'sleutel' is required.", nameof(sleutel));
        }

        var schoon = sleutel.Trim();
        return schoon.Length <= MaxSleutellengte
            ? schoon
            : throw new ArgumentException($"'sleutel' is longer than {MaxSleutellengte} characters.", nameof(sleutel));
    }
}
