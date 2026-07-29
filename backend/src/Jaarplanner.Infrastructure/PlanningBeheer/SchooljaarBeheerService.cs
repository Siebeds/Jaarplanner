using Jaarplanner.Application.Planning.Beheer;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.PlanningBeheer;

/// <summary>
/// EF Core implementation of <see cref="ISchooljaarBeheerService"/> over <see cref="AppDbContext"/> (E3-01) — the
/// minimum creation path for the container Art. IX.3 requires. See the interface for why it is deliberately
/// create/read only.
/// <para>
/// All validation of the year itself lives in the <see cref="Schooljaar"/> domain entity (span, closure inside the
/// year, no overlapping closures); this service translates those <see cref="ArgumentException"/>s into the shared
/// 400 fault so a data-entry mistake is a friendly Dutch validation message rather than a 500.
/// </para>
/// </summary>
public sealed class SchooljaarBeheerService : ISchooljaarBeheerService
{
    private readonly AppDbContext _context;

    public SchooljaarBeheerService(AppDbContext context) => _context = context;

    /// <inheritdoc />
    public async Task<IReadOnlyList<SchooljaarWeergave>> HaalSchooljarenOpAsync(
        CancellationToken cancellationToken = default)
    {
        var schooljaren = await _context.Schooljaren
            .Include("_klassen")
            .OrderBy(s => s.Start)
            .ToListAsync(cancellationToken);

        return schooljaren.Select(Map).ToList();
    }

    /// <inheritdoc />
    public async Task<SchooljaarWeergave> HaalSchooljaarOpAsync(
        Guid schooljaarId,
        CancellationToken cancellationToken = default) =>
        Map(await VindAsync(schooljaarId, cancellationToken));

    /// <inheritdoc />
    public async Task<SchooljaarWeergave> MaakSchooljaarAsync(
        SchooljaarCreatie creatie,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(creatie);

        var schooljaar = Bouw(creatie);

        var bezet = await _context.Schooljaren
            .AnyAsync(s => s.Naam.ToLower() == schooljaar.Naam.ToLower(), cancellationToken);
        if (bezet)
        {
            throw new SchoolcontentValidatieFout($"Er bestaat al een schooljaar met de naam '{schooljaar.Naam}'.");
        }

        _context.Schooljaren.Add(schooljaar);

        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniekeNaamSchending(ex))
        {
            // The pre-check above cannot cover two simultaneous POSTs; the unique index can.
            throw new SchoolcontentValidatieFout($"Er bestaat al een schooljaar met de naam '{schooljaar.Naam}'.");
        }

        return Map(schooljaar);
    }

    /// <summary>
    /// Builds the aggregate, turning the domain's own invariant breaches into the shared 400 fault. Note the
    /// closures are added through <see cref="Schooljaar.VoegSluitingToe"/> so the "inside the year, no overlap"
    /// rules are enforced in exactly one place rather than re-implemented here.
    /// </summary>
    private static Schooljaar Bouw(SchooljaarCreatie creatie)
    {
        try
        {
            var schooljaar = new Schooljaar(creatie.Naam, creatie.Start, creatie.Eind);

            foreach (var sluiting in creatie.Sluitingen ?? [])
            {
                schooljaar.VoegSluitingToe(
                    new Schoolsluiting(sluiting.Naam, sluiting.Start, sluiting.Eind, sluiting.Soort));
            }

            return schooljaar;
        }
        catch (ArgumentException ex)
        {
            throw new SchoolcontentValidatieFout(ex.Message);
        }
    }

    private async Task<Schooljaar> VindAsync(Guid schooljaarId, CancellationToken cancellationToken)
    {
        var schooljaar = await _context.Schooljaren
            .Include("_klassen")
            .FirstOrDefaultAsync(s => s.Id == schooljaarId, cancellationToken);

        return schooljaar ?? throw new SchoolcontentNietGevondenFout($"Schooljaar {schooljaarId} is niet gevonden.");
    }

    private static SchooljaarWeergave Map(Schooljaar schooljaar) =>
        new(schooljaar.Id,
            schooljaar.Naam,
            schooljaar.Start,
            schooljaar.Eind,
            schooljaar.Sluitingen
                .Select(s => new SchoolsluitingWeergave(s.Id, s.Naam, s.Start, s.Eind, s.Soort.ToString()))
                .ToList(),
            schooljaar.Klassen
                .Select(k => new KlasVerwijzing(k.Id, k.Naam, k.Leerjaar))
                .ToList());

    private static bool IsUniekeNaamSchending(DbUpdateException ex) =>
        ex.InnerException is Npgsql.PostgresException { SqlState: "23505" } pg &&
        pg.ConstraintName?.Contains("schooljaren", StringComparison.OrdinalIgnoreCase) == true;
}
