using Jaarplanner.Application.Activiteitvoorstellen;
using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Jaarplanner.Infrastructure.Activiteitvoorstellen;

/// <summary>
/// EF Core implementation of <see cref="IActiviteitvoorstelService"/> (FB-025, ADR-0052). The AI step is prompt, call,
/// shape check, then <see cref="ActiviteitvoorstelValidator"/>; accepting writes the same own activiteit a leerkracht
/// creates by hand, with its goal links <c>aanvaard</c>, so every reader of activiteiten counts an accepted proposal as
/// an own activiteit and none counts an open one.
/// </summary>
public sealed class ActiviteitvoorstelService : IActiviteitvoorstelService
{
    /// <summary>
    /// The shadow column that keeps the proposals in the order they were stored: oldest run first, and within a run the
    /// order the model gave. Not a domain fact, so not on the entity.
    /// </summary>
    internal const string Volgnummer = "Volgnummer";

    private const string SubthemaWeg = "Dit subthema bestaat niet meer. Iemand anders heeft het verwijderd.";
    private const string VoorstelWeg = "Dit voorstel is er niet meer. Vernieuw de pagina om te zien wat er nu staat.";
    private const string AlBeslist = "Over dit voorstel is al beslist. Vernieuw de pagina om te zien wat er nu staat.";

    private readonly AppDbContext _context;
    private readonly IAiClient _ai;
    private readonly Promptbegrenzing _begrenzing;
    private readonly ActiviteitvoorstelOpties _opties;

    public ActiviteitvoorstelService(
        AppDbContext context,
        IAiClient ai,
        Promptbegrenzing begrenzing,
        IOptions<ActiviteitvoorstelOpties> opties)
    {
        _context = context;
        _ai = ai;
        _begrenzing = begrenzing;
        _opties = opties.Value;
    }

    public async Task<IReadOnlyList<ActiviteitvoorstelWeergave>> HaalOpAsync(
        Guid subthemaId,
        Guid gebruikerId,
        bool vanIedereen,
        CancellationToken cancellationToken = default)
    {
        var subthema = await LaadSubthemaAsync(subthemaId, tracking: false, cancellationToken);
        var voorstellen = await _context.Activiteitvoorstellen.AsNoTracking()
            .Where(v => v.SubthemaId == subthemaId && v.Status == KoppelingStatus.Voorgesteld)
            .Where(v => vanIedereen || v.GebruikerId == gebruikerId)
            .OrderBy(v => v.GebruikerId != gebruikerId)
            .ThenBy(v => v.GebruikerId)
            .ThenBy(v => EF.Property<int>(v, Volgnummer))
            .ToListAsync(cancellationToken);
        var aanvragers = voorstellen.Select(v => v.GebruikerId).Distinct().ToList();
        var namen = await _context.Gebruikers.AsNoTracking()
            .Where(g => aanvragers.Contains(g.Id))
            .ToDictionaryAsync(g => g.Id, g => g.Naam, cancellationToken);
        var doelen = await DoelenAsync(voorstellen.SelectMany(v => v.LeerplandoelCodes), cancellationToken);
        var vragen = subthema.Onderzoeksvragen.ToDictionary(o => o.Id, o => o.Vraag);

        return voorstellen
            .Select(v => new ActiviteitvoorstelWeergave(
                v.Id,
                v.SubthemaId,
                v.GebruikerId,
                namen.GetValueOrDefault(v.GebruikerId, string.Empty),
                v.GebruikerId == gebruikerId,
                v.Naam,
                v.ActiviteitType,
                v.VerwachteUitkomsten,
                v.LengteInLesuren,
                v.OnderzoeksvraagId is { } id && vragen.ContainsKey(id) ? id : null,
                v.OnderzoeksvraagId is { } vraagId && vragen.TryGetValue(vraagId, out var vraag) ? vraag : null,
                v.LeerplandoelCodes
                    .Select(code => doelen.TryGetValue(code, out var d)
                        ? new ActiviteitvoorstelDoel(code, d.Tekst, d.Doelsoort)
                        : new ActiviteitvoorstelDoel(code, null, null))
                    .ToList(),
                v.AiMotivatie))
            .ToList();
    }

    public async Task<ActiviteitvoorstelResultaat> StelVoorAsync(Guid subthemaId, Guid gebruikerId, CancellationToken cancellationToken = default)
    {
        var subthema = await LaadSubthemaAsync(subthemaId, tracking: false, cancellationToken);
        var subdoelen = await BesliteSubdoelenAsync(subthema, cancellationToken);
        if (subdoelen.Count == 0)
        {
            throw new SchoolcontentValidatieFout(
                $"{subthema.Naam} heeft nog geen subdoelen. Voeg er eerst toe, dan kan de AI er activiteiten bij voorstellen.");
        }

        // A proposal belongs to a gebruiker row (D9); a session without one is someone removed a moment ago.
        if (!await _context.Gebruikers.AnyAsync(g => g.Id == gebruikerId, cancellationToken))
        {
            throw new SchoolcontentValidatieFout("Je bent geen gebruiker meer van de tool. Meld opnieuw aan.");
        }

        var context = await ContextAsync(subthema, gebruikerId, subdoelen, cancellationToken);
        var verzoek = ActiviteitvoorstelPromptBuilder.Bouw(context);
        _begrenzing.Bewaak(verzoek, subdoelen);

        var antwoord = ActiviteitvoorstelResponseParser.Parse(await _ai.CompleteAsync(verzoek, cancellationToken));
        if (!antwoord.IsGeldig)
        {
            return ActiviteitvoorstelResultaat.Mislukt(antwoord.Fout!);
        }

        var plan = ActiviteitvoorstelValidator.Keur(context, antwoord);
        if (plan.Activiteiten.Count == 0)
        {
            // D4: a run that keeps nothing leaves the open proposals as they were, so none vanish without a replacement.
            return ActiviteitvoorstelResultaat.Geslaagd(0, plan.AantalOvergeslagen);
        }

        // D4: the run replaces the asker's open proposals here; decided ones stay, as the rejected ones must (D5).
        _context.Activiteitvoorstellen.RemoveRange(await _context.Activiteitvoorstellen
            .Where(v => v.SubthemaId == subthemaId && v.GebruikerId == gebruikerId && v.Status == KoppelingStatus.Voorgesteld)
            .ToListAsync(cancellationToken));

        var volgnummer = await _context.Activiteitvoorstellen
            .Where(v => v.SubthemaId == subthemaId && v.GebruikerId == gebruikerId)
            .MaxAsync(v => (int?)EF.Property<int>(v, Volgnummer), cancellationToken) ?? 0;
        foreach (var activiteit in plan.Activiteiten)
        {
            var voorstel = new Activiteitvoorstel(
                subthemaId,
                gebruikerId,
                activiteit.Naam,
                activiteit.ActiviteitType,
                activiteit.VerwachteUitkomsten,
                activiteit.LengteInLesuren,
                activiteit.OnderzoeksvraagId,
                activiteit.LeerplandoelCodes,
                activiteit.Motivatie);
            _context.Activiteitvoorstellen.Add(voorstel);
            _context.Entry(voorstel).Property<int>(Volgnummer).CurrentValue = ++volgnummer;
        }

        await _context.SaveChangesAsync(cancellationToken);
        return ActiviteitvoorstelResultaat.Geslaagd(plan.Activiteiten.Count, plan.AantalOvergeslagen);
    }

    public async Task<ActiviteitvoorstelBesluit> BeslisAsync(
        Guid activiteitvoorstelId,
        ActiviteitvoorstelBeslissing beslissing,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(beslissing);
        if (beslissing.Status is not (KoppelingStatus.Aanvaard or KoppelingStatus.Geweigerd))
        {
            throw new SchoolcontentValidatieFout("Een voorstel aanvaard of weiger je.");
        }

        var voorstel = await _context.Activiteitvoorstellen
            .SingleOrDefaultAsync(v => v.Id == activiteitvoorstelId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout(VoorstelWeg);
        if (!voorstel.IsOpen)
        {
            throw new SchoolcontentValidatieFout(AlBeslist);
        }

        if (beslissing.Status == KoppelingStatus.Geweigerd)
        {
            voorstel.Weiger();
            await BewaarAsync(cancellationToken);
            return new ActiviteitvoorstelBesluit(KoppelingStatus.Geweigerd, null);
        }

        var bewerkt = beslissing.Naam is not null;
        var naam = bewerkt ? beslissing.Naam! : voorstel.Naam;
        var soort = bewerkt ? beslissing.ActiviteitType : voorstel.ActiviteitType;
        var uitkomsten = bewerkt ? beslissing.VerwachteUitkomsten : voorstel.VerwachteUitkomsten;
        var lengte = bewerkt ? beslissing.LengteInLesuren : voorstel.LengteInLesuren;
        var codes = (bewerkt ? beslissing.LeerplandoelCodes ?? [] : voorstel.LeerplandoelCodes)
            .Select(c => c.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (string.IsNullOrWhiteSpace(naam))
        {
            throw new SchoolcontentValidatieFout("Geef de activiteit een naam.");
        }

        if (naam.Trim().Length > Activiteitvoorstel.MaxNaamlengte)
        {
            throw new SchoolcontentValidatieFout($"De naam telt hoogstens {Activiteitvoorstel.MaxNaamlengte} tekens.");
        }

        if (string.IsNullOrWhiteSpace(uitkomsten))
        {
            throw new SchoolcontentValidatieFout("Beschrijf wat de kinderen doen en wat er verwacht wordt.");
        }

        if (uitkomsten.Trim().Length > Activiteitvoorstel.MaxUitkomstlengte)
        {
            throw new SchoolcontentValidatieFout($"De beschrijving telt hoogstens {Activiteitvoorstel.MaxUitkomstlengte} tekens.");
        }

        if (lengte is not { } lesuren || lesuren is < Activiteitvoorstel.MinLesuren or > Activiteitvoorstel.MaxLesuren)
        {
            throw new SchoolcontentValidatieFout(
                $"Een voorgestelde activiteit duurt {Activiteitvoorstel.MinLesuren} tot {Activiteitvoorstel.MaxLesuren} lesuren.");
        }

        if (soort is { } gekozen && !Enum.IsDefined(gekozen))
        {
            throw new SchoolcontentValidatieFout("Kies een bestaande soort, of geen.");
        }

        if (codes.FirstOrDefault(c => !voorstel.LeerplandoelCodes.Contains(c, StringComparer.Ordinal)) is { } vreemd)
        {
            throw new SchoolcontentValidatieFout($"{vreemd} hoort niet bij dit voorstel. Je kunt alleen de voorgestelde doelen houden.");
        }

        var subthema = await LaadSubthemaAsync(voorstel.SubthemaId, tracking: true, cancellationToken);

        // D8: a goal that is no longer a decided subdoel is refused rather than linked in silence.
        var besliste = subthema.Subdoelen
            .Where(sd => sd.Koppeling.Status is KoppelingStatus.Aanvaard or KoppelingStatus.Manueel)
            .Select(sd => sd.Koppeling.LeerplandoelCode)
            .ToHashSet(StringComparer.Ordinal);
        if (codes.FirstOrDefault(c => !besliste.Contains(c)) is { } weg)
        {
            throw new SchoolcontentValidatieFout(
                $"{weg} is intussen geen subdoel meer van {subthema.Naam}. Laat het weg, of vraag nieuwe voorstellen.");
        }

        // A2, A3: the activiteit is the asker's own, also when directie decides.
        var aanvrager = voorstel.GebruikerId;
        var activiteit = subthema.VoegActiviteitToe(naam.Trim(), soort, hoek: null, uitkomsten.Trim(), aanvrager, aanvrager);
        activiteit.StelLengteIn(lesuren);
        if (voorstel.OnderzoeksvraagId is { } vraagId && subthema.Onderzoeksvragen.Any(o => o.Id == vraagId))
        {
            activiteit.KoppelAanOnderzoeksvraag(vraagId);
        }

        foreach (var code in codes.Order(StringComparer.Ordinal))
        {
            activiteit.VoegDoelkoppelingToe(new DoelKoppeling(code, KoppelingStatus.Aanvaard, voorstel.AiMotivatie));
        }

        _context.Activiteiten.Add(activiteit);
        voorstel.Aanvaard(activiteit.Id, naam, soort, uitkomsten, lesuren, codes);
        await BewaarAsync(cancellationToken);
        return new ActiviteitvoorstelBesluit(voorstel.Status, activiteit.Id);
    }

    /// <summary>
    /// Saves a decision. The proposal's row version makes a second, simultaneous decision fail here rather than create a
    /// second activiteit.
    /// </summary>
    private async Task BewaarAsync(CancellationToken cancellationToken)
    {
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new SchoolcontentValidatieFout(AlBeslist);
        }
    }

    private async Task<Subthema> LaadSubthemaAsync(Guid subthemaId, bool tracking, CancellationToken cancellationToken)
    {
        var query = _context.Subthemas
            .Include(s => s.Subdoelen)
            .Include(s => s.Onderzoeksvragen)
            .AsSplitQuery();
        if (!tracking)
        {
            query = query.AsNoTracking();
        }

        return await query.SingleOrDefaultAsync(s => s.Id == subthemaId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout(SubthemaWeg);
    }

    /// <summary>D6: the subthema's decided subdoelen, as loaded goals; one no longer in Op.stap is not offered.</summary>
    private async Task<List<Leerplandoel>> BesliteSubdoelenAsync(Subthema subthema, CancellationToken cancellationToken)
    {
        var codes = subthema.Subdoelen
            .Where(sd => sd.Koppeling.Status is KoppelingStatus.Aanvaard or KoppelingStatus.Manueel)
            .Select(sd => sd.Koppeling.LeerplandoelCode)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (codes.Count == 0)
        {
            return [];
        }

        return await _context.Leerplandoelen.AsNoTracking()
            .Where(l => codes.Contains(l.Code) && !l.NietMeerInOpstap)
            .OrderBy(l => l.Code)
            .ToListAsync(cancellationToken);
    }

    private async Task<ActiviteitvoorstelContext> ContextAsync(
        Subthema subthema,
        Guid gebruikerId,
        IReadOnlyList<Leerplandoel> subdoelen,
        CancellationToken cancellationToken)
    {
        var themaNaam = await _context.Themas.AsNoTracking()
            .Where(t => t.Id == subthema.ThemaId)
            .Select(t => t.Naam)
            .SingleAsync(cancellationToken);

        // The shared activiteiten and the asker's own: someone else's own activiteit is hers (ADR-0049 D3), and
        // proposing next to it is no repeat of anything the asker has.
        var bestaand = await _context.Activiteiten.AsNoTracking()
            .Where(a => a.SubthemaId == subthema.Id && (a.EigenaarId == null || a.EigenaarId == gebruikerId))
            .Select(a => new BestaandeActiviteit(a.Naam, a.ActiviteitType))
            .ToListAsync(cancellationToken);

        var geweigerd = await _context.Activiteitvoorstellen.AsNoTracking()
            .Where(v => v.SubthemaId == subthema.Id && v.GebruikerId == gebruikerId && v.Status == KoppelingStatus.Geweigerd)
            .Select(v => v.Naam)
            .ToListAsync(cancellationToken);

        return new ActiviteitvoorstelContext(
            themaNaam,
            subthema.Naam,
            Jaarfasen.Normaliseer(subthema.Leeftijd),
            subthema.DuurWeken,
            subthema.Onderzoeksvragen.Select((o, i) => new PromptOnderzoeksvraag($"V{i + 1}", o.Id, o.Vraag)).ToList(),
            subdoelen,
            bestaand,
            geweigerd,
            Math.Clamp(_opties.MaxPerVraag, 1, ActiviteitvoorstelOpties.Bovengrens));
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
}
