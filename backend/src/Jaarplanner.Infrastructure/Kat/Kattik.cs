namespace Jaarplanner.Infrastructure.Kat;

/// <summary>
/// One tick of the cat's background job, claimed (ADR-0059 D1: "one tick runs on one instance only, through a lease
/// row in Postgres"). The scheduled moment is the primary key, so claiming a tick is an insert: whichever instance
/// inserts first owns it, and every other instance's insert violates the key and skips.
/// <para>
/// <b>Deliberately not a renewable lease.</b> A lease with an expiry would let a second instance take over a tick the
/// first died during, at the price of two instances running one round when the first is merely slow. A round is
/// idempotent and the next tick recomputes everything (D1, D2), so a lost tick costs at most a few hours of delay,
/// while a double round could call the AI twice for one finding and spend the school's budget twice. The cheaper
/// mistake is the one this makes.
/// </para>
/// <para>
/// This is not domain: it is how the job coordinates, and nothing in <c>Domain</c> or <c>Application</c> knows it.
/// </para>
/// </summary>
public sealed class Kattik
{
    /// <summary>The longest <see cref="Instantie"/>, in characters.</summary>
    public const int MaxInstantielengte = 100;

    // EF Core materialisation only.
    private Kattik()
    {
        Instantie = null!;
    }

    /// <summary>Claims <paramref name="moment"/> for <paramref name="instantie"/>.</summary>
    public Kattik(DateTimeOffset moment, string instantie, DateTimeOffset gestart)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(instantie);

        Moment = moment;
        Instantie = instantie.Trim()[..Math.Min(instantie.Trim().Length, MaxInstantielengte)];
        Gestart = gestart;
    }

    /// <summary>The scheduled moment this row claims, in UTC. The key, and so the claim.</summary>
    public DateTimeOffset Moment { get; private set; }

    /// <summary>Which process took it, for reading the log of a round that went wrong.</summary>
    public string Instantie { get; private set; }

    /// <summary>When the claim was taken.</summary>
    public DateTimeOffset Gestart { get; private set; }

    /// <summary>When the round finished, or <c>null</c> for one that was interrupted.</summary>
    public DateTimeOffset? Voltooid { get; private set; }

    /// <summary>Records that the round finished.</summary>
    public void MarkeerVoltooid(DateTimeOffset moment) => Voltooid = moment;
}
