using Jaarplanner.Application.Planning;
using Jaarplanner.Application.Planning.Rooster;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Planning;

/// <summary>
/// EF Core implementation of <see cref="IPlanningsroosterService"/> (E3-06): loads the school year and hands it
/// to the <see cref="IPlanningsblokIndeling"/> seam.
/// <para>
/// <b>It derives nothing itself.</b> Every period length lives in the seam's configuration (ADR-0013); this
/// class only loads, delegates and maps. If you find yourself computing a block boundary here, it belongs in
/// the seam.
/// </para>
/// </summary>
public sealed class PlanningsroosterService : IPlanningsroosterService
{
    private readonly AppDbContext _context;
    private readonly IPlanningsblokIndeling _indeling;

    public PlanningsroosterService(AppDbContext context, IPlanningsblokIndeling indeling)
    {
        _context = context;
        _indeling = indeling;
    }

    /// <inheritdoc />
    public async Task<PlanningsroosterWeergave> HaalRoosterOpAsync(
        Guid schooljaarId,
        Planningsblokniveau niveau = Planningsblokniveau.Themaperiode,
        CancellationToken cancellationToken = default)
    {
        var schooljaar = await _context.Schooljaren
            .FirstOrDefaultAsync(s => s.Id == schooljaarId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Schooljaar {schooljaarId} is niet gevonden.");

        var blokken = _indeling.Blokken(schooljaar, niveau)
            .Select(blok => new PlanningsblokWeergave(
                blok.Ordinaal,
                blok.Start,
                blok.Eind,
                blok.OuderOrdinaal,
                TelOpenDagen(schooljaar, blok),
                // The display figure, from the domain rather than recomputed here: `PlanningsblokWeergave`'s own
                // documentation warns that a second weekend-aware definition living in this mapper is the drift this
                // project keeps paying for, so both counts are the schooljaar's and this only asks.
                schooljaar.TelOpenWeekdagen(blok.Start, blok.Eind)))
            .ToList();

        // Vakanties only — a VrijeDag sits inside a block and must not be drawn as a gap (ADR-0020 §5).
        var onderbrekingen = schooljaar.Vakanties
            .Select(v => new PlanningsonderbrekingWeergave(v.Naam, v.Start, v.Eind))
            .ToList();

        return new PlanningsroosterWeergave(
            schooljaar.Id,
            schooljaar.Naam,
            schooljaar.Start,
            schooljaar.Eind,
            niveau.ToString(),
            _indeling.Omschrijving,
            blokken,
            onderbrekingen);
    }

    /// <summary>
    /// Delegates to <see cref="Schooljaar.TelOpenDagen"/> so the ribbon and the spreading report cannot drift
    /// apart. This method used to implement the count itself, while <c>Spreidingsrapport</c> used the raw
    /// calendar span — so the two disagreed about the length of the same block.
    /// </summary>
    private static int TelOpenDagen(Schooljaar schooljaar, Planningsblok blok) =>
        schooljaar.TelOpenDagen(blok.Start, blok.Eind);
}
