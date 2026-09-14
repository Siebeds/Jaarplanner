using Jaarplanner.Application.Toegang;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Toegang;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;

namespace Jaarplanner.Infrastructure.Toegang;

/// <summary>
/// EF Core implementation of <see cref="IGebruikerBeheerService"/> (E6-04).
/// <para>
/// <b>The last-directie guard reads its count under a row lock.</b> <c>Gebruiker.NeemDirectierechtAf</c> and
/// <c>BevestigVerwijderbaar</c> take the number of <i>other</i> directieleden and refuse at zero (ADR-0031 decision 7),
/// but a count read with a plain <c>SELECT</c> is stale the moment it is read: two directieleden demoting each other
/// at once would each see one other and both succeed. So both writes first lock every directie row
/// (<c>SELECT … FOR UPDATE</c>, in id order so two callers never lock in opposite orders), inside the transaction
/// that writes. The second caller then waits for the first to commit, and PostgreSQL re-reads the locked set after
/// that commit, so it counts what is true then. <see cref="LeesAndereDirectieOnderSlotAsync"/> is the one place
/// that does it.
/// </para>
/// <para>
/// <b>It counts only another directie who can sign in</b> (<see cref="GebruikerbeheerOpties"/>): a bound one under Entra.
/// An unbound directie invitation may never be used, so it cannot be what keeps the school administrable (antagonist,
/// E6-04 slice 2 round 1, MAJOR). The refusal then says why: the others have not signed in yet.
/// </para>
/// <para>
/// <b>"Counts for the shared content" is computed with the rights' own rule</b>
/// (<see cref="Rechtenberekening.TeltNog"/> on the school's clock, and <see cref="Leeftijdsrechten.VoorKlas"/> for a
/// klas), so this screen and the rights service cannot disagree about who holds what today.
/// </para>
/// </summary>
public sealed class GebruikerBeheerService : IGebruikerBeheerService
{
    /// <summary>The column widths in <c>GebruikerConfiguration</c>, checked here so a long input is a 400, not a 500.</summary>
    private const int MaxAanmeldnaam = 320;
    private const int MaxNaam = 256;

    private readonly AppDbContext _context;
    private readonly TimeProvider _tijd;
    private readonly ILogger<GebruikerBeheerService> _logger;
    private readonly GebruikerbeheerOpties _opties;

    public GebruikerBeheerService(
        AppDbContext context,
        TimeProvider tijd,
        ILogger<GebruikerBeheerService> logger,
        IOptions<GebruikerbeheerOpties> opties)
    {
        _context = context;
        _tijd = tijd;
        _logger = logger;
        _opties = opties.Value;
    }

    public async Task<GebruikersOverzicht> HaalOverzichtOpAsync(CancellationToken cancellationToken = default)
    {
        var vandaag = Schoolklok.Vandaag(_tijd, _logger);
        var gebruikers = await LeesAsync(alleen: null, vandaag, cancellationToken);

        var schooljaren = await _context.Schooljaren.AsNoTracking()
            .Select(s => new { s.Id, s.Eind })
            .ToListAsync(cancellationToken);
        var voorbij = schooljaren
            .Where(s => !Rechtenberekening.TeltNog(s.Eind, vandaag))
            .Select(s => s.Id)
            .ToList();

        return new GebruikersOverzicht(gebruikers, voorbij);
    }

    public async Task<GebruikerBeheerWeergave> HaalGebruikerOpAsync(Guid gebruikerId, CancellationToken cancellationToken = default)
    {
        var gevonden = await LeesAsync(gebruikerId, Schoolklok.Vandaag(_tijd, _logger), cancellationToken);
        return gevonden.SingleOrDefault() ?? throw NietGevonden(gebruikerId);
    }

    public async Task<GebruikerBeheerWeergave> NodigUitAsync(
        GebruikerUitnodiging uitnodiging,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(uitnodiging);

        var email = LeesAanmeldnaam(uitnodiging.Email);

        // The name the list shows until the first login replaces it; a blank one falls back to the sign-in name,
        // which is the domain's rule, so the length is checked on what will actually be stored.
        var naam = uitnodiging.Naam?.Trim() ?? string.Empty;
        if ((naam.Length == 0 ? email : naam).Length > MaxNaam)
        {
            throw new GebruikerbeheerValidatieFout($"Een naam is hoogstens {MaxNaam} tekens lang.");
        }

        if (await _context.Gebruikers.AnyAsync(g => g.Email == email, cancellationToken))
        {
            throw BestaatAl(email);
        }

        var gebruiker = new Gebruiker(email, naam, uitnodiging.IsDirectie);
        if (uitnodiging.HeeftThemabeheer)
        {
            gebruiker.GeefThemabeheer();
        }

        _context.Gebruikers.Add(gebruiker);
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException fout) when (IsUniekeIndexSchending(fout))
        {
            // Two directie tabs inviting the same address: the unique index settles it, and the loser hears the same
            // sentence the pre-check gives.
            throw BestaatAl(email);
        }

        return await HaalGebruikerOpAsync(gebruiker.Id, cancellationToken);
    }

    public async Task<GebruikerBeheerWeergave> GeefDirectierechtAsync(Guid gebruikerId, CancellationToken cancellationToken = default)
    {
        var gebruiker = await VindAsync(gebruikerId, cancellationToken);
        gebruiker.GeefDirectierecht();
        await BewaarWijzigingAsync(cancellationToken);
        return await HaalGebruikerOpAsync(gebruikerId, cancellationToken);
    }

    public async Task<GebruikerBeheerWeergave> NeemDirectierechtAfAsync(Guid gebruikerId, CancellationToken cancellationToken = default)
    {
        await using (var transactie = await _context.Database.BeginTransactionAsync(cancellationToken))
        {
            var anderen = await LeesAndereDirectieOnderSlotAsync(gebruikerId, cancellationToken);

            // Read after the lock, so a concurrent change that committed while this one waited is what is seen.
            var gebruiker = await VindAsync(gebruikerId, cancellationToken);
            if (gebruiker.IsDirectie && anderen.Aanmeldbaar < 1)
            {
                throw new LaatsteDirectieFout(anderen.Totaal == 0
                    ? $"{gebruiker.Naam} is de enige met het directierecht. "
                      + "Geef het directierecht eerst aan iemand anders die zich al heeft aangemeld."
                    : $"{gebruiker.Naam} is de enige met het directierecht die zich al heeft aangemeld. "
                      + "Wie verder het directierecht heeft, heeft zich nog niet aangemeld, dus het directierecht kan nog niet weg.");
            }

            // The domain's own guard, with the same locked count: a backstop, never the only check.
            gebruiker.NeemDirectierechtAf(anderen.Aanmeldbaar);
            await BewaarWijzigingAsync(cancellationToken);
            await transactie.CommitAsync(cancellationToken);
        }

        return await HaalGebruikerOpAsync(gebruikerId, cancellationToken);
    }

    public async Task<GebruikerBeheerWeergave> GeefThemabeheerAsync(Guid gebruikerId, CancellationToken cancellationToken = default)
    {
        var gebruiker = await VindAsync(gebruikerId, cancellationToken);
        gebruiker.GeefThemabeheer();
        await BewaarWijzigingAsync(cancellationToken);
        return await HaalGebruikerOpAsync(gebruikerId, cancellationToken);
    }

    public async Task<GebruikerBeheerWeergave> NeemThemabeheerAfAsync(Guid gebruikerId, CancellationToken cancellationToken = default)
    {
        var gebruiker = await VindAsync(gebruikerId, cancellationToken);
        gebruiker.NeemThemabeheerAf();
        await BewaarWijzigingAsync(cancellationToken);
        return await HaalGebruikerOpAsync(gebruikerId, cancellationToken);
    }

    public async Task VerwijderAsync(Guid gebruikerId, CancellationToken cancellationToken = default)
    {
        await using var transactie = await _context.Database.BeginTransactionAsync(cancellationToken);

        var anderen = await LeesAndereDirectieOnderSlotAsync(gebruikerId, cancellationToken);
        var gebruiker = await VindAsync(gebruikerId, cancellationToken);
        if (gebruiker.IsDirectie && anderen.Aanmeldbaar < 1)
        {
            throw new LaatsteDirectieFout(anderen.Totaal == 0
                ? $"{gebruiker.Naam} is de enige met het directierecht en kan niet verwijderd worden. "
                  + "Geef het directierecht eerst aan iemand anders die zich al heeft aangemeld."
                : $"{gebruiker.Naam} is de enige met het directierecht die zich al heeft aangemeld, en kan niet verwijderd "
                  + "worden. Wie verder het directierecht heeft, heeft zich nog niet aangemeld.");
        }

        gebruiker.BevestigVerwijderbaar(anderen.Aanmeldbaar);

        // The database does the rest: klastoewijzingen and appointments cascade, and every activiteit this gebruiker
        // made keeps existing with its maker set to null (ActiviteitConfiguration), purely shared from now on (I17).
        _context.Gebruikers.Remove(gebruiker);
        await BewaarWijzigingAsync(cancellationToken);
        await transactie.CommitAsync(cancellationToken);
    }

    public async Task<GebruikerBeheerWeergave> WijsKlasToeAsync(Guid gebruikerId, Guid klasId, CancellationToken cancellationToken = default)
    {
        await VereisGebruikerAsync(gebruikerId, cancellationToken);
        if (!await _context.Klassen.AnyAsync(k => k.Id == klasId, cancellationToken))
        {
            throw new GebruikerbeheerNietGevondenFout($"Klas {klasId} is niet gevonden.");
        }

        var bestaat = await _context.Klastoewijzingen
            .AnyAsync(t => t.GebruikerId == gebruikerId && t.KlasId == klasId, cancellationToken);
        if (!bestaat)
        {
            _context.Klastoewijzingen.Add(new Klastoewijzing(gebruikerId, klasId));
            await BewaarIdempotentAsync("De gebruiker of de klas bestaat niet meer.", cancellationToken);
        }

        return await HaalGebruikerOpAsync(gebruikerId, cancellationToken);
    }

    public async Task<GebruikerBeheerWeergave> HaalKlasWegAsync(Guid gebruikerId, Guid klasId, CancellationToken cancellationToken = default)
    {
        await VereisGebruikerAsync(gebruikerId, cancellationToken);
        await _context.Klastoewijzingen
            .Where(t => t.GebruikerId == gebruikerId && t.KlasId == klasId)
            .ExecuteDeleteAsync(cancellationToken);
        return await HaalGebruikerOpAsync(gebruikerId, cancellationToken);
    }

    public async Task<GebruikerBeheerWeergave> StelAanAlsHoofdleerkrachtAsync(
        Guid gebruikerId,
        Guid schooljaarId,
        string jaarfase,
        CancellationToken cancellationToken = default)
    {
        var code = LeesJaarfase(jaarfase);
        await VereisGebruikerAsync(gebruikerId, cancellationToken);
        if (!await _context.Schooljaren.AnyAsync(s => s.Id == schooljaarId, cancellationToken))
        {
            throw new GebruikerbeheerNietGevondenFout($"Schooljaar {schooljaarId} is niet gevonden.");
        }

        var bestaat = await _context.Hoofdleerkrachtaanstellingen.AnyAsync(
            a => a.GebruikerId == gebruikerId && a.SchooljaarId == schooljaarId && a.Jaarfase == code,
            cancellationToken);
        if (!bestaat)
        {
            _context.Hoofdleerkrachtaanstellingen.Add(new Hoofdleerkrachtaanstelling(gebruikerId, schooljaarId, code));
            await BewaarIdempotentAsync("De gebruiker of het schooljaar bestaat niet meer.", cancellationToken);
        }

        return await HaalGebruikerOpAsync(gebruikerId, cancellationToken);
    }

    public async Task<GebruikerBeheerWeergave> TrekAanstellingInAsync(
        Guid gebruikerId,
        Guid schooljaarId,
        string jaarfase,
        CancellationToken cancellationToken = default)
    {
        var code = LeesJaarfase(jaarfase);
        await VereisGebruikerAsync(gebruikerId, cancellationToken);
        await _context.Hoofdleerkrachtaanstellingen
            .Where(a => a.GebruikerId == gebruikerId && a.SchooljaarId == schooljaarId && a.Jaarfase == code)
            .ExecuteDeleteAsync(cancellationToken);
        return await HaalGebruikerOpAsync(gebruikerId, cancellationToken);
    }

    /// <summary>
    /// Locks every directie row and answers how many of them are someone other than <paramref name="gebruikerId"/>, and
    /// how many of those can sign in (<see cref="GebruikerbeheerOpties"/>). Must run inside the transaction that writes;
    /// the lock is held until it commits or rolls back. Every directie row is locked, bound or not, so a first login
    /// binding one of them waits for this transaction too.
    /// </summary>
    private async Task<AndereDirectie> LeesAndereDirectieOnderSlotAsync(Guid gebruikerId, CancellationToken cancellationToken)
    {
        var directie = await _context.Database
            .SqlQuery<Directierij>(
                $"""SELECT "Id", "EntraObjectId" IS NOT NULL AS "IsGekoppeld" FROM gebruikers WHERE "IsDirectie" ORDER BY "Id" FOR UPDATE""")
            .ToListAsync(cancellationToken);

        var anderen = directie.Where(rij => rij.Id != gebruikerId).ToList();
        return new AndereDirectie(
            anderen.Count,
            anderen.Count(rij => rij.IsGekoppeld || _opties.OngekoppeldeDirectieKanAanmelden));
    }

    /// <summary>The other directieleden: all of them, and those who can sign in.</summary>
    private readonly record struct AndereDirectie(int Totaal, int Aanmeldbaar);

    /// <summary>One locked directie row, as the raw query reads it.</summary>
    private sealed class Directierij
    {
        public Guid Id { get; set; }

        public bool IsGekoppeld { get; set; }
    }

    /// <summary>The gebruikers (all, or one) with their links, as the beheer screen reads them.</summary>
    private async Task<List<GebruikerBeheerWeergave>> LeesAsync(Guid? alleen, DateOnly vandaag, CancellationToken cancellationToken)
    {
        var gebruikersQuery = _context.Gebruikers.AsNoTracking();
        var toewijzingenQuery = _context.Klastoewijzingen.AsNoTracking();
        var aanstellingenQuery = _context.Hoofdleerkrachtaanstellingen.AsNoTracking();
        if (alleen is { } id)
        {
            gebruikersQuery = gebruikersQuery.Where(g => g.Id == id);
            toewijzingenQuery = toewijzingenQuery.Where(t => t.GebruikerId == id);
            aanstellingenQuery = aanstellingenQuery.Where(a => a.GebruikerId == id);
        }

        var gebruikers = await gebruikersQuery
            .OrderBy(g => g.Naam)
            .ThenBy(g => g.Email)
            .ToListAsync(cancellationToken);

        var toewijzingen = await (
                from toewijzing in toewijzingenQuery
                join klas in _context.Klassen on toewijzing.KlasId equals klas.Id
                join schooljaar in _context.Schooljaren on klas.SchooljaarId equals schooljaar.Id
                orderby klas.Leerjaar, klas.Naam
                select new
                {
                    toewijzing.GebruikerId,
                    KlasId = klas.Id,
                    klas.Naam,
                    klas.Jaarfase,
                    klas.SchooljaarId,
                    schooljaar.Eind,
                })
            .ToListAsync(cancellationToken);

        var aanstellingen = await (
                from aanstelling in aanstellingenQuery
                join schooljaar in _context.Schooljaren on aanstelling.SchooljaarId equals schooljaar.Id
                select new { aanstelling.GebruikerId, aanstelling.SchooljaarId, aanstelling.Jaarfase, schooljaar.Eind })
            .ToListAsync(cancellationToken);

        var toewijzingenPerGebruiker = toewijzingen.ToLookup(t => t.GebruikerId);
        var aanstellingenPerGebruiker = aanstellingen.ToLookup(a => a.GebruikerId);

        return gebruikers
            .Select(g => new GebruikerBeheerWeergave(
                g.Id,
                g.Naam,
                g.Email,
                g.IsDirectie,
                g.HeeftThemabeheer,
                g.IsGekoppeld,
                toewijzingenPerGebruiker[g.Id]
                    .Select(t => new KlastoewijzingBeheerWeergave(
                        t.KlasId,
                        t.Naam,
                        t.Jaarfase,
                        t.SchooljaarId,
                        Rechtenberekening.TeltNog(t.Eind, vandaag) && Leeftijdsrechten.VoorKlas(t.Jaarfase).Count > 0))
                    .ToList(),
                aanstellingenPerGebruiker[g.Id]
                    .OrderBy(a => Volgorde(a.Jaarfase))
                    .Select(a => new AanstellingBeheerWeergave(
                        a.SchooljaarId, a.Jaarfase, Rechtenberekening.TeltNog(a.Eind, vandaag)))
                    .ToList()))
            .ToList();
    }

    private static int Volgorde(string jaarfase)
    {
        for (var i = 0; i < Jaarfasen.Alle.Count; i++)
        {
            if (Jaarfasen.Alle[i] == jaarfase)
            {
                return i;
            }
        }

        return int.MaxValue;
    }

    private async Task<Gebruiker> VindAsync(Guid gebruikerId, CancellationToken cancellationToken) =>
        await _context.Gebruikers.SingleOrDefaultAsync(g => g.Id == gebruikerId, cancellationToken)
        ?? throw NietGevonden(gebruikerId);

    private async Task VereisGebruikerAsync(Guid gebruikerId, CancellationToken cancellationToken)
    {
        if (!await _context.Gebruikers.AnyAsync(g => g.Id == gebruikerId, cancellationToken))
        {
            throw NietGevonden(gebruikerId);
        }
    }

    /// <summary>
    /// Saves a change to a tracked gebruiker: a right given or taken, or the row removed. When the write affects no row,
    /// another request removed that gebruiker between this one's read and its write. No concurrency token is configured
    /// on <c>gebruikers</c>, so nothing else can cause it. The answer is a Dutch 404, the same kind a request arriving
    /// after the removal gets, never a 500 (antagonist, slice 2 round 2). A repeated DELETE is therefore a 404 too, not an
    /// idempotent 204: it did not remove anyone, and the screen's own delete never sends one twice.
    /// </summary>
    private async Task BewaarWijzigingAsync(CancellationToken cancellationToken)
    {
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            _context.ChangeTracker.Clear();
            throw new GebruikerbeheerNietGevondenFout("Deze gebruiker is intussen verwijderd.");
        }
    }

    /// <summary>
    /// Saves a new link row. A unique-index violation means a concurrent request made the same pair first, which is
    /// the outcome this call asked for, so it is not an error. A foreign-key violation means the gebruiker, klas or
    /// schooljaar was removed between the existence check and the insert: that is a 404 with
    /// <paramref name="nietMeerMelding"/>, not a 500.
    /// </summary>
    private async Task BewaarIdempotentAsync(string nietMeerMelding, CancellationToken cancellationToken)
    {
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException fout) when (IsUniekeIndexSchending(fout))
        {
            _context.ChangeTracker.Clear();
        }
        catch (DbUpdateException fout) when (IsSleutelSchending(fout))
        {
            _context.ChangeTracker.Clear();
            throw new GebruikerbeheerNietGevondenFout(nietMeerMelding);
        }
    }

    /// <summary>The sign-in name as it is stored and compared (<see cref="Gebruiker.NormaliseerEmail"/>), or a Dutch 400.</summary>
    private static string LeesAanmeldnaam(string? invoer)
    {
        string email;
        try
        {
            email = Gebruiker.NormaliseerEmail(invoer ?? string.Empty);
        }
        catch (ArgumentException)
        {
            throw new GebruikerbeheerValidatieFout("Vul één Microsoft-aanmeldnaam in, zoals an.peeters@school.be.");
        }

        if (email.Length > MaxAanmeldnaam)
        {
            throw new GebruikerbeheerValidatieFout($"Een aanmeldnaam is hoogstens {MaxAanmeldnaam} tekens lang.");
        }

        return email;
    }

    /// <summary>
    /// The one leeftijd rule (<see cref="Jaarfasen.LeesLeeftijd"/>), the rule a klas's jaarfase and a subthema's
    /// leeftijd obey, with <see cref="Jaarfasen.WatIsErMisMet"/>'s sentence when it refuses. That method answers a
    /// sentence for exactly the inputs <c>LeesLeeftijd</c> refuses, so the sentence exists once, in the domain.
    /// </summary>
    private static string LeesJaarfase(string? jaarfase) =>
        Jaarfasen.LeesLeeftijd(jaarfase)
        ?? throw new GebruikerbeheerValidatieFout(Jaarfasen.WatIsErMisMet(jaarfase)!);

    private static GebruikerbeheerNietGevondenFout NietGevonden(Guid gebruikerId) =>
        new($"Gebruiker {gebruikerId} is niet gevonden.");

    private static GebruikerBestaatAlFout BestaatAl(string email) =>
        new($"Er is al een gebruiker met de aanmeldnaam {email}.");

    private static bool IsUniekeIndexSchending(DbUpdateException fout) =>
        fout.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    private static bool IsSleutelSchending(DbUpdateException fout) =>
        fout.InnerException is PostgresException { SqlState: PostgresErrorCodes.ForeignKeyViolation };
}
