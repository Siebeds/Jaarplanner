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
/// <b>No functional index backs the code filter, deliberately — and no <c>UNIQUE</c> one ever may.</b>
/// <c>lower("Code") = ANY(...)</c> cannot use the primary-key index on <c>leerplandoelen."Code"</c>, so the
/// code lookup is a sequential scan, while this project's two other case-insensitive lookups each did get a
/// <c>UNIQUE INDEX ... (lower(...))</c> in a dedicated migration (<c>KlasNaamCaseInsensitiefUniek</c>,
/// <c>SchooljaarNaamCaseInsensitiefUniek</c>). The difference is not that those close a correctness gap and
/// this would only buy speed — the hazard is the same one in all three places (a lookup by a
/// human-typed value that two case-variant rows would make arbitrary). The difference is <b>who owns the
/// data</b>: klas and schooljaar names are the school's own, so the schema may forbid a collision outright,
/// whereas leerplandoelen are <b>decreed reference data the tool must accept as given</b> (Art. III.1).
/// A unique constraint on <c>lower("Code")</c> would therefore make the Op.stap import <b>reject official
/// rows</b> — the tool overruling the curriculum, which is exactly backwards. So the same obligation is met
/// at <b>runtime</b> instead: <c>DoelMatchingService.ZoekIngetypteLeerdoelAsync</c> prefers an exact hit and
/// refuses an ambiguous case-insensitive one rather than binding to whichever row sorted first. A
/// <i>non-unique</i> <c>CREATE INDEX ... ON leerplandoelen (lower("Code"))</c> stays available as a pure
/// performance measure if it is ever needed, but it is not needed today: the table is Op.stap-sized
/// (13 disciplines' goals, thousands of rows at most) and is scanned once per substitution, on a read path a
/// teacher triggers by hand. The same reasoning covers <c>JaarFase</c> and <c>DisciplineNummer</c>, neither
/// of which is indexed case-sensitively either.
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
