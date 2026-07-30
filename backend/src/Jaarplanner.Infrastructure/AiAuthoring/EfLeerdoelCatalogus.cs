using Jaarplanner.Application.AiAuthoring;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.AiAuthoring;

/// <summary>
/// EF Core implementation of <see cref="ILeerdoelCatalogus"/> over <see cref="AppDbContext"/> (E2-07).
/// Reads the Op.stap leerplandoelen <c>AsNoTracking</c> — a pure read of read-only reference data, so
/// it never mutates curriculum content (Art. III.1) — applying the optional discipline/jaar-fase/code
/// filter and ordering by the stable code so callers get a deterministic candidate set.
/// <para>
/// <b>The filter matches case-insensitively.</b> A teacher types these values by hand (the E2-08 panel
/// offers two free-text fields), and Postgres' default collation is case-sensitive, so <c>k3</c> or
/// <c>l3</c> used to return zero candidates — a silent empty result that looks exactly like "the
/// curriculum holds nothing for your class". Comparison is done with <c>ToLower()</c> on both sides
/// because that is what EF translates to SQL <c>lower()</c>; <c>ToLowerInvariant()</c> is not
/// translatable. All of these values (jaar/fase codes, discipline numbers, leerplandoel codes) are
/// ASCII, so invariant-vs-current culture cannot bite here.
/// </para>
/// <para>
/// <b>No functional index backs the code filter, deliberately.</b> <c>lower("Code") = ANY(...)</c>
/// cannot use the primary-key index on <c>leerplandoelen."Code"</c>, so the code lookup is a sequential
/// scan — and this project's two other case-insensitive lookups each did get a
/// <c>lower(...)</c> index in a dedicated migration (<c>KlasNaamCaseInsensitiefUniek</c>,
/// <c>SchooljaarNaamCaseInsensitiefUniek</c>). This one departs on purpose, so the difference is not read
/// as an oversight: those two indexes exist to <b>enforce uniqueness</b> case-insensitively (they are
/// <c>UNIQUE</c> indexes closing a real race), which is a correctness obligation. Here the only benefit
/// would be speed, and the table is Op.stap-sized — 13 disciplines' goals, thousands of rows at most,
/// scanned once per substitution on a read path a teacher triggers by hand. Adding
/// <c>CREATE INDEX ... ON leerplandoelen (lower("Code"))</c> is a one-line migration if measurement ever
/// says otherwise; inventing it now would be an unmeasured index on the project's most read-only table.
/// The same reasoning covers <c>JaarFase</c> and <c>DisciplineNummer</c>, neither of which is indexed
/// case-sensitively either.
/// </para>
/// </summary>
public sealed class EfLeerdoelCatalogus : ILeerdoelCatalogus
{
    private readonly AppDbContext _context;

    public EfLeerdoelCatalogus(AppDbContext context) => _context = context;

    /// <inheritdoc />
    public async Task<IReadOnlyList<Leerplandoel>> HaalLeerdoelenAsync(
        LeerdoelSelectie selectie,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(selectie);

        IQueryable<Leerplandoel> query = _context.Leerplandoelen.AsNoTracking();

        var disciplines = Genormaliseerd(selectie.Disciplines);
        if (disciplines.Count > 0)
        {
            query = query.Where(d => disciplines.Contains(d.DisciplineNummer.ToLower()));
        }

        var jaarFasen = Genormaliseerd(selectie.JaarFasen);
        if (jaarFasen.Count > 0)
        {
            query = query.Where(d => jaarFasen.Contains(d.JaarFase.ToLower()));
        }

        var codes = Genormaliseerd(selectie.Codes);
        if (codes.Count > 0)
        {
            query = query.Where(d => codes.Contains(d.Code.ToLower()));
        }

        return await query
            .OrderBy(d => d.Code)
            .ToListAsync(cancellationToken);
    }

    // Trims, drops blanks, and case-folds so the comparison above is case-insensitive (see the class summary).
    private static List<string> Genormaliseerd(IReadOnlyCollection<string>? waarden) =>
        (waarden ?? [])
            .Where(w => !string.IsNullOrWhiteSpace(w))
            .Select(w => w.Trim().ToLowerInvariant())
            .Distinct(StringComparer.Ordinal)
            .ToList();
}
