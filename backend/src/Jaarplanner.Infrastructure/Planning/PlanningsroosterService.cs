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
                TelLesdagen(schooljaar, blok)))
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
    /// Counts the block's actual teaching days by asking the year about each date, rather than subtracting a
    /// closure's length — a closure may only partly overlap the block, and <see cref="Schooljaar.IsLesdag"/>
    /// already owns the "inside the year and covered by no closure" rule. Blocks span weeks, so the day-by-day
    /// loop is trivially cheap and keeps the definition in exactly one place.
    /// </summary>
    private static int TelLesdagen(Schooljaar schooljaar, Planningsblok blok)
    {
        var lesdagen = 0;

        for (var datum = blok.Start; datum <= blok.Eind; datum = datum.AddDays(1))
        {
            if (schooljaar.IsLesdag(datum))
            {
                lesdagen++;
            }
        }

        return lesdagen;
    }
}
