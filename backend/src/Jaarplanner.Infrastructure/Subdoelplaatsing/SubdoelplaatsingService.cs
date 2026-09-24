using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Application.Subdoelplaatsing;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Subdoelplaatsing;

/// <summary>
/// EF Core implementation of <see cref="ISubdoelplaatsingService"/> (FB-057, ADR-0050). The AI step is prompt, call,
/// shape check, then <see cref="SubdoelplaatsingValidator"/>; deciding writes the same subdoel and subthema rows a
/// person writes by hand, so every reader of decided content counts an accepted proposal and none counts an open one.
/// </summary>
public sealed class SubdoelplaatsingService : ISubdoelplaatsingService
{
    private const string ThemaWeg = "Dit thema bestaat niet meer. Iemand anders heeft het verwijderd.";
    private const string VoorstelWeg = "Dit voorstel is er niet meer. Vernieuw de pagina om te zien wat er nu staat.";
    private const string AlBeslist = "Over dit voorstel is al beslist. Vernieuw de pagina om te zien wat er nu staat.";

    private readonly AppDbContext _context;
    private readonly IAiClient _ai;
    private readonly Promptbegrenzing _begrenzing;

    public SubdoelplaatsingService(AppDbContext context, IAiClient ai, Promptbegrenzing begrenzing)
    {
        _context = context;
        _ai = ai;
        _begrenzing = begrenzing;
    }

    public async Task<SubdoelplaatsingOverzicht> HaalOpAsync(Guid themaId, CancellationToken cancellationToken = default)
    {
        var thema = await LaadThemaAsync(themaId, tracking: false, cancellationToken);
        var perLeeftijd = LeeftijdenMetSubthema(thema);
        var kandidaten = await KandidatenAsync(thema, cancellationToken);

        // ADR-0064: a leeftijd without a subthema is shown too while the themadoelen bring it open goals, so the AI can
        // propose its first subthema. The Api keeps it from whoever may not decide there.
        var zonderSubthema = kandidaten
            .Select(l => Jaarfasen.Normaliseer(l.JaarFase))
            .Where(l => Jaarfasen.IsBekend(l) && !perLeeftijd.ContainsKey(l))
            .ToHashSet(StringComparer.Ordinal);
        var open = OpenDoelen(thema, kandidaten, perLeeftijd.Keys.Concat(zonderSubthema));

        var voorstellen = await _context.Subdoelvoorstellen.AsNoTracking()
            .Where(v => v.ThemaId == themaId && v.Status == KoppelingStatus.Voorgesteld)
            .ToListAsync(cancellationToken);
        var subthemavoorstellen = await _context.Subthemavoorstellen.AsNoTracking()
            .Where(v => v.ThemaId == themaId && v.Status == KoppelingStatus.Voorgesteld)
            .ToListAsync(cancellationToken);
        var doelen = await DoelenAsync(voorstellen.Select(v => v.LeerplandoelCode), cancellationToken);
        var activiteitIds = voorstellen.Where(v => v.ActiviteitId is not null).Select(v => v.ActiviteitId!.Value).Distinct().ToList();
        var activiteitNamen = activiteitIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await _context.Activiteiten.AsNoTracking()
                .Where(a => activiteitIds.Contains(a.Id))
                .ToDictionaryAsync(a => a.Id, a => a.Naam, cancellationToken);

        var leeftijden = perLeeftijd.Keys
            .Concat(zonderSubthema.Where(l => open[l].Count > 0))
            .OrderBy(l => Jaarfasen.Alle.ToList().IndexOf(l))
            .Select(leeftijd => new LeeftijdPlaatsing(
                leeftijd,
                open[leeftijd].Count,
                MagBeslissen: true,
                voorstellen
                    .Where(v => v.Leeftijd == leeftijd && v.SubthemaId is not null)
                    .OrderBy(v => v.LeerplandoelCode, StringComparer.Ordinal)
                    .Select(v => Map(v, doelen, activiteitNamen))
                    .ToList(),
                subthemavoorstellen
                    .Where(s => s.Leeftijd == leeftijd)
                    .OrderBy(s => s.Naam, StringComparer.OrdinalIgnoreCase)
                    .Select(s => new SubthemavoorstelWeergave(
                        s.Id,
                        s.Naam,
                        s.Onderzoeksvraag,
                        s.DuurWeken,
                        s.AiMotivatie,
                        voorstellen
                            .Where(v => v.SubthemavoorstelId == s.Id)
                            .OrderBy(v => v.LeerplandoelCode, StringComparer.Ordinal)
                            .Select(v => Map(v, doelen))
                            .ToList()))
                    .ToList(),
                HeeftSubthema: perLeeftijd.ContainsKey(leeftijd)))
            .ToList();

        return new SubdoelplaatsingOverzicht(themaId, leeftijden);
    }

    public async Task<SubdoelplaatsingResultaat> StelVoorAsync(Guid themaId, string leeftijd, CancellationToken cancellationToken = default)
    {
        var code = Jaarfasen.LeesLeeftijd(leeftijd)
            ?? throw new SchoolcontentValidatieFout($"'{leeftijd}' is geen leeftijd. Kies JK, K2, K3 of L1 tot L6.");
        var thema = await LaadThemaAsync(themaId, tracking: false, cancellationToken);
        // ADR-0064: a leeftijd without a subthema is asked too; the model then has only new subthema's to propose.
        var subthemas = LeeftijdenMetSubthema(thema).GetValueOrDefault(code) ?? [];
        var open = OpenDoelen(thema, await KandidatenAsync(thema, cancellationToken), [code])[code];
        if (open.Count == 0)
        {
            throw new SchoolcontentValidatieFout($"Alle leerplandoelen van de themadoelen staan al in een subthema van {code}.");
        }

        var context = await ContextAsync(thema, code, subthemas, open, cancellationToken);
        var verzoek = SubdoelplaatsingPromptBuilder.Bouw(context);
        _begrenzing.Bewaak(verzoek, open);

        var antwoord = SubdoelplaatsingResponseParser.Parse(await _ai.CompleteAsync(verzoek, cancellationToken));
        if (!antwoord.IsGeldig)
        {
            return SubdoelplaatsingResultaat.Mislukt(antwoord.Fout!);
        }

        var plan = SubdoelplaatsingValidator.Keur(context, antwoord);

        // D2: the run replaces this leeftijd's open proposals; decided ones stay, as the rejected ones must (D3). One that
        // came from an activiteit is not this run's to replace (ADR-0054 D4), and its goal is not placed a second time.
        var openVoorstellen = await _context.Subdoelvoorstellen
            .Where(v => v.ThemaId == themaId && v.Leeftijd == code && v.Status == KoppelingStatus.Voorgesteld)
            .ToListAsync(cancellationToken);
        _context.Subdoelvoorstellen.RemoveRange(openVoorstellen.Where(v => v.ActiviteitId is null));
        var wachtend = openVoorstellen
            .Where(v => v.ActiviteitId is not null)
            .Select(v => (v.LeerplandoelCode, v.SubthemaId))
            .ToHashSet();
        _context.Subthemavoorstellen.RemoveRange(await _context.Subthemavoorstellen
            .Where(v => v.ThemaId == themaId && v.Leeftijd == code && v.Status == KoppelingStatus.Voorgesteld)
            .ToListAsync(cancellationToken));

        var inBestaand = plan.InBestaand.Where(p => !wachtend.Contains((p.Code, p.SubthemaId))).ToList();
        foreach (var plaatsing in inBestaand)
        {
            _context.Subdoelvoorstellen.Add(Subdoelvoorstel.InSubthema(themaId, code, plaatsing.Code, plaatsing.SubthemaId, plaatsing.Motivatie));
        }

        foreach (var nieuw in plan.Nieuw)
        {
            var voorstel = new Subthemavoorstel(themaId, code, nieuw.Naam, nieuw.Onderzoeksvraag, nieuw.DuurWeken, nieuw.Motivatie);
            _context.Subthemavoorstellen.Add(voorstel);
            foreach (var doel in nieuw.Doelen)
            {
                _context.Subdoelvoorstellen.Add(Subdoelvoorstel.InNieuwSubthema(themaId, code, doel.Code, voorstel.Id, doel.Motivatie));
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
        return SubdoelplaatsingResultaat.Geslaagd(
            inBestaand.Count + plan.Nieuw.Sum(n => n.Doelen.Count),
            plan.Nieuw.Count,
            plan.AantalOvergeslagen + plan.InBestaand.Count - inBestaand.Count);
    }

    public async Task BeslisSubdoelAsync(Guid subdoelvoorstelId, KoppelingStatus status, CancellationToken cancellationToken = default)
    {
        if (status is not (KoppelingStatus.Aanvaard or KoppelingStatus.Geweigerd))
        {
            throw new SchoolcontentValidatieFout("Een voorstel aanvaard of weiger je.");
        }

        var voorstel = await _context.Subdoelvoorstellen.SingleOrDefaultAsync(v => v.Id == subdoelvoorstelId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout(VoorstelWeg);
        if (voorstel.SubthemaId is not { } subthemaId)
        {
            throw new SchoolcontentValidatieFout("Dit doel hoort bij een voorgesteld nieuw subthema. Beslis over dat subthema.");
        }

        if (!voorstel.IsOpen)
        {
            throw new SchoolcontentValidatieFout(AlBeslist);
        }

        if (status == KoppelingStatus.Aanvaard)
        {
            var subthema = await _context.Subthemas
                .Include(s => s.Subdoelen)
                .SingleOrDefaultAsync(s => s.Id == subthemaId, cancellationToken)
                ?? throw new SchoolcontentNietGevondenFout(VoorstelWeg);
            if (Jaarfasen.Normaliseer(subthema.Leeftijd) != voorstel.Leeftijd)
            {
                // The subthema moved to another leeftijd after the proposal: the proposal no longer says what it would do.
                throw new SchoolcontentValidatieFout(
                    $"{subthema.Naam} hoort intussen bij een andere leeftijd. Vraag opnieuw voorstellen voor {Jaarfasen.Normaliseer(subthema.Leeftijd)}.");
            }

            if (subthema.Subdoelen.Any(sd => string.Equals(sd.Koppeling.LeerplandoelCode, voorstel.LeerplandoelCode, StringComparison.Ordinal)))
            {
                throw new SchoolcontentValidatieFout(
                    $"{voorstel.LeerplandoelCode} staat al als subdoel in {subthema.Naam}. Vernieuw de pagina om te zien wat er nu staat.");
            }

            var subdoel = subthema.VoegSubdoelToe(
                subthema.Leeftijd,
                new DoelKoppeling(voorstel.LeerplandoelCode, KoppelingStatus.Aanvaard, voorstel.AiMotivatie));
            _context.Subdoelen.Add(subdoel);
        }

        voorstel.Beslis(status);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task BeslisSubthemaAsync(Guid subthemavoorstelId, SubthemavoorstelBeslissing beslissing, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(beslissing);
        if (beslissing.Status is not (KoppelingStatus.Aanvaard or KoppelingStatus.Geweigerd))
        {
            throw new SchoolcontentValidatieFout("Een voorgesteld subthema aanvaard of weiger je.");
        }

        var voorstel = await _context.Subthemavoorstellen.SingleOrDefaultAsync(v => v.Id == subthemavoorstelId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout(VoorstelWeg);
        if (voorstel.Status != KoppelingStatus.Voorgesteld)
        {
            throw new SchoolcontentValidatieFout(AlBeslist);
        }

        var doelen = await _context.Subdoelvoorstellen
            .Where(v => v.SubthemavoorstelId == voorstel.Id)
            .ToListAsync(cancellationToken);

        if (beslissing.Status == KoppelingStatus.Geweigerd)
        {
            voorstel.Weiger();
            foreach (var doel in doelen.Where(d => d.IsOpen))
            {
                doel.Beslis(KoppelingStatus.Geweigerd);
            }

            await _context.SaveChangesAsync(cancellationToken);
            return;
        }

        var houden = beslissing.LeerplandoelCodes?.ToHashSet(StringComparer.Ordinal)
            ?? doelen.Select(d => d.LeerplandoelCode).ToHashSet(StringComparer.Ordinal);
        if (houden.Any(c => doelen.All(d => d.LeerplandoelCode != c)))
        {
            throw new SchoolcontentValidatieFout("Je kunt alleen doelen houden die bij dit voorstel horen.");
        }

        if (houden.Count == 0)
        {
            throw new SchoolcontentValidatieFout("Houd minstens één doel, of weiger het voorgestelde subthema.");
        }

        var naam = beslissing.Naam ?? voorstel.Naam;
        var vraag = beslissing.Onderzoeksvraag ?? voorstel.Onderzoeksvraag;
        var duur = beslissing.DuurWeken ?? voorstel.DuurWeken;
        if (string.IsNullOrWhiteSpace(naam))
        {
            throw new SchoolcontentValidatieFout("Geef het subthema een naam.");
        }

        if (string.IsNullOrWhiteSpace(vraag))
        {
            throw new SchoolcontentValidatieFout("Geef het subthema een onderzoeksvraag.");
        }

        if (duur is < Subthemavoorstel.MinDuurWeken or > Subthemavoorstel.MaxDuurWeken)
        {
            throw new SchoolcontentValidatieFout(
                $"Een subthema duurt {Subthemavoorstel.MinDuurWeken} tot {Subthemavoorstel.MaxDuurWeken} weken.");
        }

        if (naam.Trim().Length > Subthemavoorstel.MaxNaamlengte)
        {
            throw new SchoolcontentValidatieFout($"De naam telt hoogstens {Subthemavoorstel.MaxNaamlengte} tekens.");
        }

        var thema = await LaadThemaAsync(voorstel.ThemaId, tracking: true, cancellationToken);

        // The thema may have been limited since the proposal was made (ADR-0069 D3).
        if (!thema.HoudtLeeftijd(voorstel.Leeftijd))
        {
            throw new SchoolcontentValidatieFout(thema.NietVoorLeeftijd(voorstel.Leeftijd));
        }

        var vanLeeftijd = thema.Subthemas.Where(s => Jaarfasen.Normaliseer(s.Leeftijd) == voorstel.Leeftijd).ToList();
        if (vanLeeftijd.Any(s => string.Equals(s.Naam.Trim(), naam.Trim(), StringComparison.OrdinalIgnoreCase)))
        {
            throw new SchoolcontentValidatieFout($"Er is al een subthema {naam.Trim()} voor {voorstel.Leeftijd}. Kies een andere naam.");
        }

        // D7 at decision time too: a goal someone placed by hand in the meantime is not placed a second time.
        var geplaatst = vanLeeftijd.SelectMany(s => s.Subdoelen).Select(sd => sd.Koppeling.LeerplandoelCode).ToHashSet(StringComparer.Ordinal);
        if (houden.FirstOrDefault(geplaatst.Contains) is { } alGeplaatst)
        {
            throw new SchoolcontentValidatieFout(
                $"{alGeplaatst} staat intussen al in een subthema van {voorstel.Leeftijd}. Laat het weg, of weiger het voorgestelde subthema.");
        }

        var subthema = thema.VoegSubthemaToe(naam.Trim(), duur, voorstel.Leeftijd);
        subthema.VoegOnderzoeksvraagToe(vraag.Trim());
        foreach (var doel in doelen.OrderBy(d => d.LeerplandoelCode, StringComparer.Ordinal))
        {
            if (!doel.IsOpen)
            {
                continue;
            }

            if (houden.Contains(doel.LeerplandoelCode))
            {
                subthema.VoegSubdoelToe(voorstel.Leeftijd, new DoelKoppeling(doel.LeerplandoelCode, KoppelingStatus.Aanvaard, doel.AiMotivatie));
                doel.Beslis(KoppelingStatus.Aanvaard);
            }
            else
            {
                doel.Beslis(KoppelingStatus.Geweigerd);
            }
        }

        _context.Subthemas.Add(subthema);
        voorstel.Aanvaard(subthema.Id, naam, vraag, duur, doelenGewijzigd: houden.Count != doelen.Count);
        await _context.SaveChangesAsync(cancellationToken);
    }

    private async Task<Thema> LaadThemaAsync(Guid themaId, bool tracking, CancellationToken cancellationToken)
    {
        var query = _context.Themas
            .Include(t => t.Subthemas).ThenInclude(s => s.Subdoelen)
            .Include(t => t.Subthemas).ThenInclude(s => s.Onderzoeksvragen)
            .AsSplitQuery();
        if (!tracking)
        {
            query = query.AsNoTracking();
        }

        return await query.SingleOrDefaultAsync(t => t.Id == themaId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout(ThemaWeg);
    }

    /// <summary>The thema's subthema's by canonical leeftijd; a subthema with an unknown leeftijd is left out (D1).</summary>
    private static Dictionary<string, List<Subthema>> LeeftijdenMetSubthema(Thema thema) =>
        thema.Subthemas
            .Select(s => (Leeftijd: Jaarfasen.Normaliseer(s.Leeftijd), Subthema: s))
            .Where(p => Jaarfasen.IsBekend(p.Leeftijd))
            .GroupBy(p => p.Leeftijd, StringComparer.Ordinal)
            .ToDictionary(
                g => g.Key,
                g => g.Select(p => p.Subthema).OrderBy(s => s.Naam, StringComparer.OrdinalIgnoreCase).ToList(),
                StringComparer.Ordinal);

    /// <summary>The leerplandoelen that concord to a themadoel of the thema, at any leeftijd. A goal no longer in Op.stap is not proposed.</summary>
    private async Task<List<Leerplandoel>> KandidatenAsync(Thema thema, CancellationToken cancellationToken)
    {
        var refs = thema.Minimumdoelen.Select(m => m.MinimumdoelRef).Distinct(StringComparer.Ordinal).ToList();
        return refs.Count == 0
            ? []
            : await _context.Leerplandoelen.AsNoTracking()
                .Where(l => l.MinimumdoelRef != null && refs.Contains(l.MinimumdoelRef) && !l.NietMeerInOpstap)
                .ToListAsync(cancellationToken);
    }

    /// <summary>
    /// D1: per leeftijd, the <paramref name="kandidaten"/> of that jaar/fase that no subthema of the thema at that
    /// leeftijd holds as a subdoel.
    /// </summary>
    private static Dictionary<string, List<Leerplandoel>> OpenDoelen(
        Thema thema,
        IReadOnlyList<Leerplandoel> kandidaten,
        IEnumerable<string> leeftijden)
    {
        var resultaat = new Dictionary<string, List<Leerplandoel>>(StringComparer.Ordinal);
        foreach (var leeftijd in leeftijden)
        {
            var bezet = thema.Subthemas
                .Where(s => Jaarfasen.Normaliseer(s.Leeftijd) == leeftijd)
                .SelectMany(s => s.Subdoelen)
                .Select(sd => sd.Koppeling.LeerplandoelCode)
                .ToHashSet(StringComparer.Ordinal);
            resultaat[leeftijd] = kandidaten
                .Where(l => Jaarfasen.Normaliseer(l.JaarFase) == leeftijd && !bezet.Contains(l.Code))
                .OrderBy(l => l.Code, StringComparer.Ordinal)
                .ToList();
        }

        return resultaat;
    }

    private async Task<SubdoelplaatsingContext> ContextAsync(
        Thema thema,
        string leeftijd,
        IReadOnlyList<Subthema> subthemas,
        IReadOnlyList<Leerplandoel> open,
        CancellationToken cancellationToken)
    {
        var refs = thema.Minimumdoelen.Select(m => m.MinimumdoelRef).ToList();
        var minimumdoelen = await _context.Minimumdoelen.AsNoTracking()
            .Where(m => refs.Contains(m.Ref))
            .Select(m => new PromptMinimumdoel(m.Ref, m.Omschrijving))
            .ToListAsync(cancellationToken);

        var subdoelteksten = await DoelenAsync(subthemas.SelectMany(s => s.Subdoelen).Select(sd => sd.Koppeling.LeerplandoelCode), cancellationToken);
        var promptSubthemas = subthemas
            .Select((s, i) => new PromptSubthema(
                $"S{i + 1}",
                s.Id,
                s.Naam,
                s.DuurWeken,
                s.Onderzoeksvragen.Select(o => o.Vraag).ToList(),
                s.Subdoelen
                    .Where(sd => sd.Koppeling.Status is KoppelingStatus.Aanvaard or KoppelingStatus.Manueel)
                    .Select(sd => new PromptSubdoel(
                        sd.Koppeling.LeerplandoelCode,
                        subdoelteksten.TryGetValue(sd.Koppeling.LeerplandoelCode, out var d) ? d.Tekst : string.Empty))
                    .ToList()))
            .ToList();

        var geweigerdePlaatsingen = await _context.Subdoelvoorstellen.AsNoTracking()
            .Where(v => v.ThemaId == thema.Id && v.Leeftijd == leeftijd && v.Status == KoppelingStatus.Geweigerd && v.SubthemaId != null)
            .Select(v => new GeweigerdePlaatsing(v.LeerplandoelCode, v.SubthemaId!.Value))
            .ToListAsync(cancellationToken);
        var geweigerdeNamen = await _context.Subthemavoorstellen.AsNoTracking()
            .Where(v => v.ThemaId == thema.Id && v.Leeftijd == leeftijd && v.Status == KoppelingStatus.Geweigerd)
            .Select(v => v.Naam)
            .ToListAsync(cancellationToken);

        return new SubdoelplaatsingContext(
            thema.Naam,
            thema.Invalshoeken,
            leeftijd,
            minimumdoelen,
            promptSubthemas,
            open,
            geweigerdePlaatsingen,
            geweigerdeNamen);
    }

    private async Task<Dictionary<string, Leerplandoel>> DoelenAsync(IEnumerable<string> codes, CancellationToken cancellationToken)
    {
        var lijst = codes.Distinct(StringComparer.Ordinal).ToList();
        if (lijst.Count == 0)
        {
            return new Dictionary<string, Leerplandoel>(StringComparer.Ordinal);
        }

        return await _context.Leerplandoelen.AsNoTracking()
            .Where(l => lijst.Contains(l.Code))
            .ToDictionaryAsync(l => l.Code, StringComparer.Ordinal, cancellationToken);
    }

    private static SubdoelvoorstelWeergave Map(
        Subdoelvoorstel voorstel,
        IReadOnlyDictionary<string, Leerplandoel> doelen,
        IReadOnlyDictionary<Guid, string>? activiteitNamen = null)
    {
        doelen.TryGetValue(voorstel.LeerplandoelCode, out var doel);
        string? activiteitNaam = null;
        if (voorstel.ActiviteitId is { } activiteitId)
        {
            activiteitNamen?.TryGetValue(activiteitId, out activiteitNaam);
        }

        return new SubdoelvoorstelWeergave(
            voorstel.Id,
            voorstel.LeerplandoelCode,
            doel?.Tekst,
            doel?.Doelsoort,
            voorstel.SubthemaId,
            voorstel.AiMotivatie,
            activiteitNaam);
    }
}
