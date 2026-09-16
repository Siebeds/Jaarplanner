using Jaarplanner.Application.Activiteitdoelen;
using Jaarplanner.Application.Ai;
using Jaarplanner.Application.AiMatching.Response;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Jaarplanner.Infrastructure.Activiteitdoelen;

/// <summary>
/// EF Core implementation of <see cref="IActiviteitDoelsuggestieService"/> (FB-026, ADR-0054): prompt, call, shape check
/// (<see cref="DoelMatchResponseParser"/>), then <see cref="ActiviteitDoelsuggestieValidator"/>. Accepting a proposal
/// writes the same <c>aanvaard</c> link every reader of decided links already counts, and proposes the goal as subdoel.
/// </summary>
public sealed class ActiviteitDoelsuggestieService : IActiviteitDoelsuggestieService
{
    private const string ActiviteitWeg = "Deze activiteit bestaat niet meer. Vernieuw de pagina om te zien wat er nu staat.";
    private const string VoorstelWeg = "Dit voorstel is er niet meer. Vernieuw de pagina om te zien wat er nu staat.";
    private const string AlBeslist = "Over dit voorstel is al beslist. Vernieuw de pagina om te zien wat er nu staat.";

    private readonly AppDbContext _context;
    private readonly IAiClient _ai;
    private readonly Promptbegrenzing _begrenzing;
    private readonly int _maxVoorstellen;

    public ActiviteitDoelsuggestieService(
        AppDbContext context,
        IAiClient ai,
        Promptbegrenzing begrenzing,
        IOptions<ActiviteitDoelsuggestieOptions> options)
    {
        _context = context;
        _ai = ai;
        _begrenzing = begrenzing;
        _maxVoorstellen = options.Value.MaxVoorstellen;
    }

    public async Task<ActiviteitDoelsuggestieResultaat> StelVoorAsync(Guid activiteitId, CancellationToken cancellationToken = default)
    {
        var activiteit = await LaadActiviteitAsync(activiteitId, cancellationToken);
        var plek = await LaadPlekAsync(activiteit.SubthemaId, cancellationToken);
        var leeftijd = Jaarfasen.Normaliseer(plek.Leeftijd);

        var kandidaten = await KandidatenAsync(leeftijd, cancellationToken);
        var nietVoorstellen = activiteit.Doelkoppelingen
            .Where(k => k.Status != KoppelingStatus.Voorgesteld)
            .Select(k => k.LeerplandoelCode)
            .ToList();
        if (kandidaten.All(k => nietVoorstellen.Contains(k.Code, StringComparer.Ordinal)))
        {
            throw new SchoolcontentValidatieFout($"Er zijn geen leerplandoelen van {leeftijd} meer om voor te stellen bij deze activiteit.");
        }

        var onderzoeksvraag = activiteit.OnderzoeksvraagId is { } vraagId
            ? await _context.Onderzoeksvragen.AsNoTracking()
                .Where(o => o.Id == vraagId).Select(o => o.Vraag).SingleOrDefaultAsync(cancellationToken)
            : null;

        var context = new ActiviteitDoelsuggestieContext(
            activiteit.Naam,
            activiteit.ActiviteitType?.ToString().ToLowerInvariant(),
            activiteit.Hoek,
            activiteit.VerwachteUitkomsten,
            onderzoeksvraag,
            plek.SubthemaNaam,
            plek.ThemaNaam,
            leeftijd,
            kandidaten,
            nietVoorstellen,
            _maxVoorstellen);
        var verzoek = ActiviteitDoelsuggestiePromptBuilder.Bouw(context);
        _begrenzing.Bewaak(verzoek, kandidaten);

        var antwoord = DoelMatchResponseParser.Parse(await _ai.CompleteAsync(verzoek, cancellationToken));
        if (!antwoord.IsGeldig)
        {
            return ActiviteitDoelsuggestieResultaat.Mislukt(antwoord.Fout!);
        }

        var plan = ActiviteitDoelsuggestieValidator.Keur(context, antwoord);

        // D3: the run replaces the open proposals; decided links, the rejected ones included, stay.
        activiteit.VerwijderOpenDoelvoorstellen();
        foreach (var voorstel in plan.Voorstellen)
        {
            activiteit.StelDoelVoor(voorstel.Code, voorstel.Motivatie);
        }

        await _context.SaveChangesAsync(cancellationToken);
        return ActiviteitDoelsuggestieResultaat.Geslaagd(plan.Voorstellen.Count, plan.AantalOvergeslagen);
    }

    public async Task BeslisAsync(Guid activiteitId, Guid koppelingId, KoppelingStatus status, CancellationToken cancellationToken = default)
    {
        if (status is not (KoppelingStatus.Aanvaard or KoppelingStatus.Geweigerd))
        {
            throw new SchoolcontentValidatieFout("Een voorstel aanvaard of weiger je.");
        }

        var activiteit = await LaadActiviteitAsync(activiteitId, cancellationToken);
        var koppeling = activiteit.Doelkoppelingen.FirstOrDefault(k => k.Id == koppelingId)
            ?? throw new SchoolcontentNietGevondenFout(VoorstelWeg);
        if (koppeling.Status != KoppelingStatus.Voorgesteld)
        {
            throw new SchoolcontentValidatieFout(AlBeslist);
        }

        koppeling.WijzigStatus(status);
        if (status == KoppelingStatus.Aanvaard)
        {
            await StelVoorAlsSubdoelAsync(activiteit, koppeling, cancellationToken);
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// D4: an accepted goal the subthema does not hold yet is proposed as its subdoel, unless that goal already waits
    /// there or was rejected there.
    /// </summary>
    private async Task StelVoorAlsSubdoelAsync(Activiteit activiteit, DoelKoppeling koppeling, CancellationToken cancellationToken)
    {
        var code = koppeling.LeerplandoelCode;
        var plek = await LaadPlekAsync(activiteit.SubthemaId, cancellationToken);
        var alSubdoel = await _context.Subdoelen.AsNoTracking()
            .AnyAsync(sd => sd.SubthemaId == activiteit.SubthemaId && sd.Koppeling.LeerplandoelCode == code, cancellationToken);
        var alVoorgesteld = await _context.Subdoelvoorstellen.AsNoTracking()
            .AnyAsync(
                v => v.SubthemaId == activiteit.SubthemaId
                    && v.LeerplandoelCode == code
                    && (v.Status == KoppelingStatus.Voorgesteld || v.Status == KoppelingStatus.Geweigerd),
                cancellationToken);
        if (alSubdoel || alVoorgesteld)
        {
            return;
        }

        _context.Subdoelvoorstellen.Add(Subdoelvoorstel.VanuitActiviteit(
            plek.ThemaId,
            Jaarfasen.Normaliseer(plek.Leeftijd),
            code,
            activiteit.SubthemaId,
            activiteit.Id,
            koppeling.AiMotivatie ?? string.Empty));
    }

    private async Task<Activiteit> LaadActiviteitAsync(Guid activiteitId, CancellationToken cancellationToken) =>
        await _context.Activiteiten
            .Include(a => a.Doelkoppelingen)
            .SingleOrDefaultAsync(a => a.Id == activiteitId, cancellationToken)
        ?? throw new SchoolcontentNietGevondenFout(ActiviteitWeg);

    private async Task<Plek> LaadPlekAsync(Guid subthemaId, CancellationToken cancellationToken) =>
        await (
                from subthema in _context.Subthemas.AsNoTracking()
                where subthema.Id == subthemaId
                join thema in _context.Themas on subthema.ThemaId equals thema.Id
                select new Plek(thema.Id, thema.Naam, subthema.Naam, subthema.Leeftijd))
            .SingleOrDefaultAsync(cancellationToken)
        ?? throw new SchoolcontentNietGevondenFout(ActiviteitWeg);

    /// <summary>
    /// The goals of <paramref name="leeftijd"/> still in Op.stap. A source may write the code the other way round
    /// (<c>3K</c>), so both spellings are read and normalised (<see cref="Jaarfasen.Normaliseer"/>).
    /// </summary>
    private async Task<IReadOnlyList<Leerplandoel>> KandidatenAsync(string leeftijd, CancellationToken cancellationToken)
    {
        var spellingen = new[] { leeftijd, AndereSpelling(leeftijd) };
        var doelen = await _context.Leerplandoelen.AsNoTracking()
            .Where(l => !l.NietMeerInOpstap && spellingen.Contains(l.JaarFase))
            .OrderBy(l => l.Code)
            .ToListAsync(cancellationToken);
        return doelen.Where(l => Jaarfasen.Normaliseer(l.JaarFase) == leeftijd).ToList();
    }

    private static string AndereSpelling(string leeftijd) => leeftijd switch
    {
        "JK" => "1K",
        "K2" => "2K",
        "K3" => "3K",
        ['L', var cijfer] => $"{cijfer}L",
        _ => leeftijd,
    };

    private sealed record Plek(Guid ThemaId, string ThemaNaam, string SubthemaNaam, string Leeftijd);
}
