using Jaarplanner.Application.AiAuthoring;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.UnitTests.AiAuthoring;

/// <summary>
/// In-memory <see cref="ILeerdoelCatalogus"/> for tests (Art. VIII / IV.6). It returns a canned
/// leerplandoel set and does <b>no</b> database I/O, proving the authoring assist (E2-07) and the goal
/// matching (E2-08) run against fakes with no database. It applies the same optional
/// discipline/jaar-fase/code filter as the real EF query so selection behaviour is exercised, and records
/// the last selection so tests can assert on it.
/// <para>
/// <b>Parity is claimed for filtering only</b>, not for ordering — the fake sorts ordinally, the real query
/// sorts under the database collation. See the note at the return statement.
/// </para>
/// </summary>
public sealed class FakeLeerdoelCatalogus : ILeerdoelCatalogus
{
    private readonly IReadOnlyList<Leerplandoel> _leerdoelen;

    /// <summary>The selection most recently passed to <see cref="HaalLeerdoelenAsync"/>, or null if none.</summary>
    public LeerdoelSelectie? LaatsteSelectie { get; private set; }

    /// <summary>How many times <see cref="HaalLeerdoelenAsync"/> has been called.</summary>
    public int AantalAanroepen { get; private set; }

    public FakeLeerdoelCatalogus(IReadOnlyList<Leerplandoel> leerdoelen) => _leerdoelen = leerdoelen;

    /// <inheritdoc />
    public Task<IReadOnlyList<Leerplandoel>> HaalLeerdoelenAsync(
        LeerdoelSelectie selectie,
        CancellationToken cancellationToken = default)
    {
        LaatsteSelectie = selectie;
        AantalAanroepen++;

        IEnumerable<Leerplandoel> query = _leerdoelen;

        // **Filtering** is normalised and compared exactly as the EF implementation does: trimmed, blanks
        // dropped, and case-insensitive on every dimension (the ILeerdoelCatalogus contract). A fake that
        // filters more strictly than the real query lets a case bug pass here and fail only in a browser.
        //
        // The parity claim stops at filtering — see the note on the ordering below.
        var disciplines = Genormaliseerd(selectie.Disciplines);
        if (disciplines.Count > 0)
        {
            query = query.Where(d => disciplines.Contains(d.DisciplineNummer.ToLowerInvariant()));
        }

        var jaarFasen = Genormaliseerd(selectie.JaarFasen);
        if (jaarFasen.Count > 0)
        {
            query = query.Where(d => jaarFasen.Contains(d.JaarFase.ToLowerInvariant()));
        }

        var codes = Genormaliseerd(selectie.Codes);
        if (codes.Count > 0)
        {
            query = query.Where(d => codes.Contains(d.Code.ToLowerInvariant()));
        }

        // Ordering is NOT claimed to match production. `EfLeerdoelCatalogus` orders with `OrderBy(d => d.Code)`,
        // which Postgres evaluates under the database collation; this fake uses `StringComparer.Ordinal`, which
        // is deterministic in-process but genuinely disagrees with ICU/libc collations on the hyphenated,
        // digit-bearing shape of an Op.stap code (collations typically ignore or reweight punctuation, ordinal
        // does not). Since candidate order becomes prompt order (`MatchingPromptBuilder`), fake and production
        // can hand the model differently sorted lists.
        //
        // Left as-is on purpose, and stated rather than papered over: nothing in the matching flow depends on
        // candidate order (the response is matched back by code, not by position), so this is a fidelity gap
        // rather than a defect, and a fake cannot reproduce a collation it has no database to ask. What matters
        // is that ordinal here is *stable*, so no test is order-flaky. Reproducing the real ordering would mean
        // testing against a database — which is what the Postgres-backed
        // `ReferentiedataIntegriteitTests.Leerdoelcatalogus_*` tests do.
        return Task.FromResult<IReadOnlyList<Leerplandoel>>(query.OrderBy(d => d.Code, StringComparer.Ordinal).ToList());
    }

    private static List<string> Genormaliseerd(IReadOnlyCollection<string>? waarden) =>
        (waarden ?? [])
            .Where(w => !string.IsNullOrWhiteSpace(w))
            .Select(w => w.Trim().ToLowerInvariant())
            .Distinct(StringComparer.Ordinal)
            .ToList();
}
