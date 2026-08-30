using Jaarplanner.Domain.Curriculum;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Persistence;

/// <summary>
/// Which ages a klas reaches, and therefore which subthema's are its own (Art. IX.2 as amended 2026-08-30).
/// <para>
/// <b>This is the join that replaced a foreign key.</b> A subthema used to name its <c>KlasId</c>, so "is this
/// subthema this class's" was answered by the database. It is now answered by comparing the class's jaar/fase
/// against <c>Subthema.Leeftijd</c>, and that comparison is asked from at least four places: the per-class thema
/// view, the move-destination picker, both dekking layers, and the klassenlijst. Written once here so those five
/// answers cannot drift, which is the same reason <c>Jaarfasen</c> itself is not restated in the browser.
/// </para>
/// </summary>
public static class Klasleeftijden
{
    /// <summary>
    /// The jaar/fase codes <paramref name="klasId"/> teaches, <c>null</c> when that cannot be derived, and
    /// <c>Onbekend</c> when there is no such class.
    /// <para>
    /// <b>The three answers are deliberately distinct and callers must not collapse them.</b> A list narrows;
    /// <c>null</c> means the class exists and its jaar/fase is underivable (the unresolved graadklas ordinal,
    /// Art. XIV) and the caller must WIDEN rather than narrow to nothing, exactly as <c>Jaarfasen</c> documents;
    /// and a class that does not exist is a 404 the caller already raises, never an empty scope. Narrowing to an
    /// empty set would report a class as having no content at all, which is the one direction these figures must
    /// never move by themselves.
    /// </para>
    /// </summary>
    public static async Task<Klasleeftijd> VoorKlasAsync(
        AppDbContext context,
        Guid klasId,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(context);

        // Two columns, not the entity: this is a read-only computation and materialising the aggregate would put
        // a mutable Klas in reach of it. The nullable struct keeps the "no such class" signal that a plain
        // projection would lose, because `default.Leerjaar` is 0 and 0 is a VALID leerjaar here.
        var scope = await context.Klassen
            .AsNoTracking()
            .Where(k => k.Id == klasId)
            .Select(k => (Klasscope?)new Klasscope(k.Leerjaar, k.Jaarfase))
            .FirstOrDefaultAsync(cancellationToken);

        if (scope is null)
        {
            return Klasleeftijd.Onbekend;
        }

        var codes = Jaarfasen.VoorKlas(scope.Value.Leerjaar, scope.Value.Jaarfase);
        return codes is null ? Klasleeftijd.NietAfTeLeiden : Klasleeftijd.Codes(codes);
    }

    /// <summary>The two columns a class's jaar/fase is derived from.</summary>
    private readonly record struct Klasscope(int Leerjaar, string? Jaarfase);
}

/// <summary>
/// The answer to "which ages does this klas teach": a set of codes, or one of two refusals that mean different
/// things. Deliberately not an <c>IReadOnlyList&lt;string&gt;?</c>, because that type has already produced the
/// bug it invites: an empty list and a null list read the same at a call site and mean the opposite there.
/// </summary>
public readonly record struct Klasleeftijd
{
    private Klasleeftijd(IReadOnlyList<string>? codes, bool bestaat)
    {
        Waarden = codes;
        Bestaat = bestaat;
    }

    /// <summary>The codes to narrow on, or <c>null</c> when the caller must not narrow at all.</summary>
    public IReadOnlyList<string>? Waarden { get; }

    /// <summary>Whether the class exists. <c>false</c> is a 404, never an empty scope.</summary>
    public bool Bestaat { get; }

    /// <summary>Whether the caller may narrow. When false it must include everything and say that it did.</summary>
    public bool KanFilteren => Waarden is { Count: > 0 };

    public static Klasleeftijd Codes(IReadOnlyList<string> codes) => new(codes, bestaat: true);

    /// <summary>The class exists; its jaar/fase cannot be derived (Art. XIV graadklas). Widen.</summary>
    public static Klasleeftijd NietAfTeLeiden { get; } = new(null, bestaat: true);

    /// <summary>There is no such class.</summary>
    public static Klasleeftijd Onbekend { get; } = new(null, bestaat: false);
}
