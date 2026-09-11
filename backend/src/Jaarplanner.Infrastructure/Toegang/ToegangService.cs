using Jaarplanner.Application.Toegang;
using Jaarplanner.Domain.Toegang;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Toegang;

/// <summary>EF Core implementation of <see cref="IToegangService"/> over the <c>gebruikers</c> table.</summary>
public sealed class ToegangService : IToegangService
{
    private readonly AppDbContext _context;

    public ToegangService(AppDbContext context) => _context = context;

    public async Task<Aanmeldresultaat> MeldAanMetEntraAsync(
        EntraIdentiteit identiteit,
        Guid schoolTenantId,
        CancellationToken cancellationToken = default)
    {
        if (identiteit.TenantId is not { } tenantId || tenantId == Guid.Empty
            || identiteit.ObjectId is not { } objectId || objectId == Guid.Empty)
        {
            return Aanmeldresultaat.Geweigerd(Aanmeldweigering.OnvolledigeIdentiteit);
        }

        if (tenantId != schoolTenantId)
        {
            return Aanmeldresultaat.Geweigerd(Aanmeldweigering.AndereTenant);
        }

        // Checked on every login, not only the first: an account the tenant later turned into a guest loses access
        // with it. Pupils and outsiders arrive as guests or not at all, which is the point of the rule (Art. VI.2).
        if (!identiteit.IsLid)
        {
            return Aanmeldresultaat.Geweigerd(Aanmeldweigering.GeenLid);
        }

        var gekoppeld = await ZoekGekoppeldAsync(tenantId, objectId, cancellationToken);
        if (gekoppeld is not null)
        {
            return Aanmeldresultaat.Toegelaten(Weergave(gekoppeld));
        }

        string email;
        try
        {
            email = Gebruiker.NormaliseerEmail(identiteit.Upn ?? string.Empty);
        }
        catch (ArgumentException)
        {
            return Aanmeldresultaat.Geweigerd(Aanmeldweigering.NietUitgenodigd);
        }

        // Only an invitation nobody has claimed yet. A bound row with this address belongs to someone else's
        // account, and matching it here is exactly the takeover the permanent binding exists to prevent.
        var uitnodiging = await _context.Gebruikers
            .SingleOrDefaultAsync(g => g.Email == email && g.EntraObjectId == null, cancellationToken);
        if (uitnodiging is null)
        {
            return Aanmeldresultaat.Geweigerd(Aanmeldweigering.NietUitgenodigd);
        }

        uitnodiging.KoppelAanEntra(tenantId, objectId, identiteit.Naam);
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Two first logins of the same account raced, and the unique (tenant, object) index let one of them win.
            // Whichever did, the account is bound now, so answer from the database rather than from this attempt.
            _context.ChangeTracker.Clear();
            var winnaar = await ZoekGekoppeldAsync(tenantId, objectId, cancellationToken);
            return winnaar is null
                ? Aanmeldresultaat.Geweigerd(Aanmeldweigering.NietUitgenodigd)
                : Aanmeldresultaat.Toegelaten(Weergave(winnaar));
        }

        return Aanmeldresultaat.Toegelaten(Weergave(uitnodiging));
    }

    public async Task<GebruikerWeergave?> HaalGebruikerOpAsync(Guid gebruikerId, CancellationToken cancellationToken = default)
    {
        var gebruiker = await _context.Gebruikers.AsNoTracking()
            .SingleOrDefaultAsync(g => g.Id == gebruikerId, cancellationToken);
        return gebruiker is null ? null : Weergave(gebruiker);
    }

    public async Task<IReadOnlyList<GebruikerWeergave>> HaalGebruikersOpAsync(CancellationToken cancellationToken = default)
    {
        var gebruikers = await _context.Gebruikers.AsNoTracking()
            .OrderByDescending(g => g.IsDirectie)
            .ThenBy(g => g.Naam)
            .ToListAsync(cancellationToken);
        return gebruikers.Select(Weergave).ToList();
    }

    public async Task<bool> ZorgVoorEersteDirectieAsync(string email, CancellationToken cancellationToken = default)
    {
        if (await _context.Gebruikers.AnyAsync(cancellationToken))
        {
            return false;
        }

        var directie = new Gebruiker(email, naam: string.Empty, isDirectie: true);
        _context.Gebruikers.Add(directie);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    private Task<Gebruiker?> ZoekGekoppeldAsync(Guid tenantId, Guid objectId, CancellationToken cancellationToken) =>
        _context.Gebruikers.SingleOrDefaultAsync(
            g => g.EntraTenantId == tenantId && g.EntraObjectId == objectId,
            cancellationToken);

    private static GebruikerWeergave Weergave(Gebruiker gebruiker) =>
        new(gebruiker.Id, gebruiker.Naam, gebruiker.Email, gebruiker.IsDirectie);
}
