using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Application.Woordwebs;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Woordwebs;

/// <summary>
/// EF Core implementation of <see cref="IWoordwebService"/> (FB-036, ADR-0043). The rules are the aggregate's
/// (<see cref="Woordweb"/>); this loads, saves, turns the aggregate's refusals into the Dutch sentences a teacher can act
/// on (Art. II.3), and runs the AI step: prompt, call, validation, then each valid word through
/// <see cref="Woordweb.VoegVoorstelToe"/>.
/// </summary>
public sealed class WoordwebService : IWoordwebService
{
    private readonly AppDbContext _context;
    private readonly IAiClient _ai;
    private readonly Promptbegrenzing _begrenzing;

    public WoordwebService(AppDbContext context, IAiClient ai, Promptbegrenzing begrenzing)
    {
        _context = context;
        _ai = ai;
        _begrenzing = begrenzing;
    }

    public async Task<IReadOnlyList<WoordwebWeergave>> HaalVoorSubthemaAsync(
        Guid subthemaId,
        Guid gebruikerId,
        CancellationToken cancellationToken = default)
    {
        await VereisSubthemaAsync(subthemaId, cancellationToken);

        var webs = await _context.Woordwebs
            .AsNoTracking()
            .Include(w => w.Woorden)
            .Where(w => w.SubthemaId == subthemaId)
            .ToListAsync(cancellationToken);
        var namen = await NamenAsync(webs.Select(w => w.EigenaarId), cancellationToken);

        return webs
            .Select(w => Map(w, namen, gebruikerId))
            .OrderByDescending(w => w.IsEigen)
            .ThenBy(w => w.EigenaarNaam, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public async Task<WoordwebWeergave> VoegEigenWoordenToeAsync(
        Guid subthemaId,
        Guid gebruikerId,
        IReadOnlyList<string> woorden,
        CancellationToken cancellationToken = default)
    {
        var geldig = VereisWoorden(woorden);
        await VereisSubthemaAsync(subthemaId, cancellationToken);

        var web = await _context.Woordwebs
            .Include(w => w.Woorden)
            .SingleOrDefaultAsync(w => w.SubthemaId == subthemaId && w.EigenaarId == gebruikerId, cancellationToken);
        if (web is null)
        {
            web = new Woordweb(subthemaId, gebruikerId);
            _context.Woordwebs.Add(web);
        }

        VereisPlaats(web, geldig);
        web.VoegWoordenToe(geldig);
        await BewaarAsync(cancellationToken);
        return await MapAsync(web, gebruikerId, cancellationToken);
    }

    public async Task<WoordwebWeergave> VoegWoordenToeAsync(
        Guid woordwebId,
        Guid gebruikerId,
        IReadOnlyList<string> woorden,
        CancellationToken cancellationToken = default)
    {
        var geldig = VereisWoorden(woorden);
        var web = await LaadAsync(woordwebId, cancellationToken);

        VereisPlaats(web, geldig);
        web.VoegWoordenToe(geldig);
        await BewaarAsync(cancellationToken);
        return await MapAsync(web, gebruikerId, cancellationToken);
    }

    public async Task<WoordwebWeergave> VerwijderWoordAsync(
        Guid woordwebId,
        Guid woordId,
        Guid gebruikerId,
        CancellationToken cancellationToken = default)
    {
        var web = await LaadAsync(woordwebId, cancellationToken);
        var woord = web.Woorden.FirstOrDefault(w => w.Id == woordId)
            ?? throw new SchoolcontentNietGevondenFout("Dit woord staat niet meer in het woordweb.");
        if (!woord.StaatInWeb)
        {
            throw new SchoolcontentValidatieFout("Dit woord staat niet in het woordweb. Een voorstel aanvaard of weiger je.");
        }

        web.VerwijderWoord(woordId);
        await BewaarAsync(cancellationToken);
        return await MapAsync(web, gebruikerId, cancellationToken);
    }

    public async Task<WoordwebWeergave> BeslisAsync(
        Guid woordwebId,
        Guid woordId,
        KoppelingStatus status,
        Guid gebruikerId,
        CancellationToken cancellationToken = default)
    {
        if (status is not (KoppelingStatus.Aanvaard or KoppelingStatus.Geweigerd))
        {
            throw new SchoolcontentValidatieFout("Een voorgesteld woord aanvaard of weiger je.");
        }

        var web = await LaadAsync(woordwebId, cancellationToken);
        var woord = web.Woorden.FirstOrDefault(w => w.Id == woordId)
            ?? throw new SchoolcontentNietGevondenFout("Dit woord staat niet meer in het woordweb.");
        if (woord.Status != KoppelingStatus.Voorgesteld)
        {
            throw new SchoolcontentValidatieFout("Over dit woord is al beslist.");
        }

        if (status == KoppelingStatus.Aanvaard && web.AantalInWeb >= Woordweb.MaxWoordenInWeb)
        {
            throw new SchoolcontentValidatieFout(VolZin(web.AantalInWeb));
        }

        web.Beslis(woordId, status);
        await BewaarAsync(cancellationToken);
        return await MapAsync(web, gebruikerId, cancellationToken);
    }

    /// <summary>
    /// The AI step (W5, W6, D1). Refused before any call when the web holds no word of the teacher's own, when it keeps
    /// <see cref="Woordweb.MaxWoordenBewaard"/> words, or when the prompt is over the ceiling (TB-062). The model's
    /// answer is validated as a whole (Art. IV.5): an invalid one stores nothing and is reported, a valid one is taken
    /// word by word through the aggregate, which skips what the web already holds, and at most
    /// <see cref="WoordwebPromptBuilder.MaxVoorstellen"/> are kept.
    /// </summary>
    public async Task<WoordwebVoorstelResultaat> StelWoordenVoorAsync(
        Guid woordwebId,
        Guid gebruikerId,
        CancellationToken cancellationToken = default)
    {
        var web = await LaadAsync(woordwebId, cancellationToken);
        if (!web.HeeftWoordInWeb)
        {
            throw new SchoolcontentValidatieFout(
                "Zet eerst zelf een woord in je woordweb. Daarna stelt de AI er woorden bij voor.");
        }

        if (!web.KanVoorstellenOntvangen)
        {
            throw new SchoolcontentValidatieFout(
                $"De AI stelt voor dit woordweb geen woorden meer voor: het bewaart al {web.Woorden.Count} woorden, de voorstellen en de geweigerde woorden meegeteld.");
        }

        var subthema = await _context.Subthemas
            .AsNoTracking()
            .Include(s => s.Onderzoeksvragen)
            .SingleOrDefaultAsync(s => s.Id == web.SubthemaId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout("Dit subthema bestaat niet meer. Iemand anders heeft het verwijderd.");
        var thema = await _context.Themas
            .AsNoTracking()
            .SingleAsync(t => t.Id == subthema.ThemaId, cancellationToken);

        var verzoek = WoordwebPromptBuilder.Bouw(WoordwebPromptBuilder.ContextVoor(web, subthema, thema));
        _begrenzing.Bewaak(verzoek, web);
        var antwoord = await _ai.CompleteAsync(verzoek, cancellationToken);
        var parse = WoordwebResponseParser.Parse(antwoord);
        if (!parse.IsGeldig)
        {
            return WoordwebVoorstelResultaat.Mislukt(parse.Fout!);
        }

        var aantal = 0;
        foreach (var voorstel in parse.Voorstellen)
        {
            if (aantal == WoordwebPromptBuilder.MaxVoorstellen)
            {
                break;
            }

            if (web.VoegVoorstelToe(voorstel.Woord, voorstel.Motivatie) is not null)
            {
                aantal++;
            }
        }

        if (aantal > 0)
        {
            await BewaarAsync(cancellationToken);
        }

        return WoordwebVoorstelResultaat.Geslaagd(await MapAsync(web, gebruikerId, cancellationToken), aantal);
    }

    /// <summary>
    /// The typed words, checked in Dutch before the aggregate sees them: its own guard is an English exception meant for
    /// programmers (Art. II.3).
    /// </summary>
    private static IReadOnlyList<string> VereisWoorden(IReadOnlyList<string>? woorden)
    {
        var geldig = (woorden ?? []).Where(w => !string.IsNullOrWhiteSpace(w)).Select(w => w.Trim()).ToList();
        if (geldig.Count == 0)
        {
            throw new SchoolcontentValidatieFout("Typ minstens één woord.");
        }

        // Before anything is loaded, so an oversized request costs no more than this count (TB-062).
        if (geldig.Count > Woordweb.MaxWoordenInWeb)
        {
            throw new SchoolcontentValidatieFout(
                $"Je kan hoogstens {Woordweb.MaxWoordenInWeb} woorden tegelijk toevoegen. Voeg ze in kleinere delen toe.");
        }

        if (geldig.FirstOrDefault(w => w.Length > Woordweb.MaxWoordlengte) is { } teLang)
        {
            throw new SchoolcontentValidatieFout(
                $"\"{teLang[..20]}…\" is te lang. Een woord in het woordweb telt hoogstens {Woordweb.MaxWoordlengte} tekens.");
        }

        return geldig;
    }

    /// <summary>The web's bound (TB-062), in Dutch before the aggregate refuses in English.</summary>
    private static void VereisPlaats(Woordweb web, IReadOnlyList<string> woorden)
    {
        if (web.AantalInWeb + web.TelNieuwInWeb(woorden) > Woordweb.MaxWoordenInWeb)
        {
            throw new SchoolcontentValidatieFout(VolZin(web.AantalInWeb));
        }
    }

    // "Dit woordweb", not "je woordweb": admin also edits another person's web.
    private static string VolZin(int aantalInWeb) =>
        $"Er passen hoogstens {Woordweb.MaxWoordenInWeb} woorden in een woordweb, en dit woordweb telt er al {aantalInWeb}. Haal eerst woorden weg die je niet meer nodig hebt.";

    private async Task VereisSubthemaAsync(Guid subthemaId, CancellationToken cancellationToken)
    {
        if (!await _context.Subthemas.AsNoTracking().AnyAsync(s => s.Id == subthemaId, cancellationToken))
        {
            throw new SchoolcontentNietGevondenFout("Dit subthema bestaat niet meer. Iemand anders heeft het verwijderd.");
        }
    }

    private async Task<Woordweb> LaadAsync(Guid woordwebId, CancellationToken cancellationToken) =>
        await _context.Woordwebs
            .Include(w => w.Woorden)
            .SingleOrDefaultAsync(w => w.Id == woordwebId, cancellationToken)
        ?? throw new SchoolcontentNietGevondenFout("Dit woordweb bestaat niet meer.");

    /// <summary>
    /// Saves. The one unique index, one web per gebruiker and subthema, can only be hit by two first words from the same
    /// person at once; the second is told to try again rather than given a 500.
    /// </summary>
    private async Task BewaarAsync(CancellationToken cancellationToken)
    {
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: Npgsql.PostgresErrorCodes.UniqueViolation })
        {
            throw new SchoolcontentValidatieFout("Je woordweb werd net op een andere plek bewaard. Laad de pagina opnieuw en probeer nog eens.");
        }
    }

    private async Task<WoordwebWeergave> MapAsync(Woordweb web, Guid gebruikerId, CancellationToken cancellationToken) =>
        Map(web, await NamenAsync([web.EigenaarId], cancellationToken), gebruikerId);

    private async Task<IReadOnlyDictionary<Guid, string>> NamenAsync(IEnumerable<Guid> ids, CancellationToken cancellationToken)
    {
        var lijst = ids.Distinct().ToList();
        return await _context.Gebruikers
            .AsNoTracking()
            .Where(g => lijst.Contains(g.Id))
            .ToDictionaryAsync(g => g.Id, g => g.Naam, cancellationToken);
    }

    private static WoordwebWeergave Map(Woordweb web, IReadOnlyDictionary<Guid, string> namen, Guid gebruikerId) => new(
        web.Id,
        web.SubthemaId,
        web.EigenaarId,
        namen.TryGetValue(web.EigenaarId, out var naam) ? naam : string.Empty,
        web.EigenaarId == gebruikerId,
        web.Woorden
            // D7: another person's open proposals and rejected words stay hers, so only the owner is sent them.
            .Where(w => web.EigenaarId == gebruikerId || w.StaatInWeb)
            .OrderBy(w => w.Volgnummer)
            .Select(w => new WoordwebWoordWeergave(w.Id, w.Woord, w.Status.ToString(), w.AiMotivatie))
            .ToList());
}
