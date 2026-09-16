using Jaarplanner.Application.Planning.Rooster;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Planning;

/// <summary>
/// EF Core implementation of <see cref="IPlanningsroosterService"/>: loads the school year and maps its span and
/// vacations. It derives nothing.
/// </summary>
public sealed class PlanningsroosterService : IPlanningsroosterService
{
    private readonly AppDbContext _context;

    public PlanningsroosterService(AppDbContext context)
    {
        _context = context;
    }

    /// <inheritdoc />
    public async Task<PlanningsroosterWeergave> HaalRoosterOpAsync(
        Guid schooljaarId,
        CancellationToken cancellationToken = default)
    {
        var schooljaar = await _context.Schooljaren
            .FirstOrDefaultAsync(s => s.Id == schooljaarId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Schooljaar {schooljaarId} is niet gevonden.");

        // Vakanties only — a VrijeDag is a day off inside a week, not a gap in the timeline.
        var onderbrekingen = schooljaar.Vakanties
            .Select(v => new PlanningsonderbrekingWeergave(v.Naam, v.Start, v.Eind))
            .ToList();

        return new PlanningsroosterWeergave(
            schooljaar.Id,
            schooljaar.Naam,
            schooljaar.Start,
            schooljaar.Eind,
            onderbrekingen);
    }
}
