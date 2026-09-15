using Jaarplanner.Application.Planning.Beheer;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.PlanningBeheer;

/// <summary>
/// The school's hours per weekday, over EF Core (FB-023, ADR-0038).
/// <para>
/// <b>A replace is written as updates, inserts and deletes per weekday</b>, not as "delete every row, insert the new
/// ones". Both give the same table, but the second asks one save to delete Wednesday and insert Wednesday under a
/// unique index, and whether that succeeds would then depend on the order EF chooses for the commands.
/// </para>
/// </summary>
public sealed class SchoolurenService : ISchoolurenService
{
    private readonly AppDbContext _db;

    public SchoolurenService(AppDbContext db) => _db = db;

    public async Task<SchoolurenWeergave> HaalOpAsync(CancellationToken cancellationToken = default)
    {
        var dagen = await _db.Schooldaguren.AsNoTracking().ToListAsync(cancellationToken);
        return Weergave(dagen);
    }

    public async Task<SchoolurenWeergave> VervangAsync(
        SchoolurenInvoer invoer,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(invoer);

        // An absent list is refused rather than read as "no hours": a body that lost its field would otherwise wipe
        // the school's hours. An empty list is an answer, and it clears them.
        if (invoer.Dagen is null)
        {
            throw new SchoolcontentValidatieFout("Geef de schooluren per weekdag mee.");
        }

        if (invoer.Dagen.Any(d => d.Weekdag is < 1 or > 7))
        {
            throw new SchoolcontentValidatieFout("Onbekende weekdag.");
        }

        if (invoer.Dagen.GroupBy(d => d.Weekdag).FirstOrDefault(g => g.Count() > 1) is { } dubbel)
        {
            throw new SchoolcontentValidatieFout(
                $"{Hoofdletter(Schooldaguren.Dagnaam(AlsWeekdag(dubbel.Key)))} staat twee keer in de schooluren.");
        }

        // Every weekday is checked before any row is touched, so one refused day leaves the whole set as it was.
        List<Schooldaguren> gevraagd;
        try
        {
            gevraagd = invoer.Dagen
                .Select(d => new Schooldaguren(
                    AlsWeekdag(d.Weekdag), d.Begin, d.Einde, d.MiddagpauzeBegin, d.MiddagpauzeEinde))
                .ToList();
        }
        catch (ArgumentException fout)
        {
            // The domain says it in Dutch; this only makes the shared handler answer 400 instead of 500.
            throw new SchoolcontentValidatieFout(fout.Message);
        }

        var bestaand = await _db.Schooldaguren.ToListAsync(cancellationToken);

        foreach (var dag in gevraagd)
        {
            if (bestaand.FirstOrDefault(b => b.Weekdag == dag.Weekdag) is { } rij)
            {
                rij.Wijzig(dag.Begin, dag.Einde, dag.MiddagpauzeBegin, dag.MiddagpauzeEinde);
            }
            else
            {
                _db.Schooldaguren.Add(dag);
            }
        }

        _db.Schooldaguren.RemoveRange(bestaand.Where(b => gevraagd.All(g => g.Weekdag != b.Weekdag)));

        await _db.SaveChangesAsync(cancellationToken);

        return await HaalOpAsync(cancellationToken);
    }

    // ISO numbering, as the algemene fiches send theirs: 1 is Monday and 7 is Sunday, which DayOfWeek calls 0. A
    // weekend number passes through so the domain can refuse it with the sentence it owns.
    private static DayOfWeek AlsWeekdag(int nummer) => nummer == 7 ? DayOfWeek.Sunday : (DayOfWeek)nummer;

    private static string Hoofdletter(string woord) => char.ToUpperInvariant(woord[0]) + woord[1..];

    // Monday first. The weekend never has a row, so DayOfWeek's own order (Monday = 1 .. Friday = 5) is the week's.
    private static SchoolurenWeergave Weergave(IEnumerable<Schooldaguren> dagen) =>
        new(dagen
            .OrderBy(d => d.Weekdag)
            .Select(d => new SchooldagurenWeergave(
                (int)d.Weekdag, d.Begin, d.Einde, d.MiddagpauzeBegin, d.MiddagpauzeEinde))
            .ToList());
}
