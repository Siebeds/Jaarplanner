using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Planning.Hoeken;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Planning;

/// <summary>
/// EF Core implementation of <see cref="IHoekverrijkingsvoorstelService"/> (FB-028, ADR-0070). The AI step is context,
/// prompt, call, parse, then two checks of its own: a text equal to what the corner holds or to a rejected one is kept
/// out. Accepting writes through <see cref="IHoekverrijkingService.BewaarAsync"/>, the route a typed verrijking takes, so
/// the window rules (found or stored as the agenda draws it) are the same ones.
/// </summary>
public sealed class HoekverrijkingsvoorstelService : IHoekverrijkingsvoorstelService
{
    private const string VoorstelWeg = "Dit voorstel is er niet meer. Vernieuw de pagina om te zien wat er nu staat.";
    private const string AlBeslist = "Over dit voorstel is al beslist. Vernieuw de pagina om te zien wat er nu staat.";

    private readonly AppDbContext _db;
    private readonly IAiClient _ai;
    private readonly Promptbegrenzing _begrenzing;
    private readonly IHoekverrijkingService _verrijkingen;

    public HoekverrijkingsvoorstelService(
        AppDbContext db,
        IAiClient ai,
        Promptbegrenzing begrenzing,
        IHoekverrijkingService verrijkingen)
    {
        _db = db;
        _ai = ai;
        _begrenzing = begrenzing;
        _verrijkingen = verrijkingen;
    }

    public async Task<IReadOnlyList<HoekverrijkingsvoorstelWeergave>> HaalOpAsync(
        Guid klasId,
        CancellationToken cancellationToken = default)
    {
        await LaadKlasAsync(klasId, cancellationToken);

        var voorstellen = await VanKlas(klasId)
            .AsNoTracking()
            .Where(v => v.Status == KoppelingStatus.Voorgesteld)
            .ToListAsync(cancellationToken);

        return voorstellen.Select(Weergave).ToList();
    }

    public async Task<HoekverrijkingsvoorstelResultaat> StelVoorAsync(
        Guid klasId,
        Guid hoekId,
        Guid subthemaId,
        CancellationToken cancellationToken = default)
    {
        var klas = await LaadKlasAsync(klasId, cancellationToken);

        var hoek = await _db.Hoeken.AsNoTracking().SingleOrDefaultAsync(h => h.Id == hoekId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout("Deze hoek bestaat niet meer. Vernieuw de pagina.");
        if (hoek.KlasId != klasId)
        {
            throw new SchoolcontentValidatieFout("Die hoek hoort bij een andere klas.");
        }

        var subthema = await _db.Subthemas.AsNoTracking()
            .Include(s => s.Subdoelen)
            .Include(s => s.Onderzoeksvragen)
            .AsSplitQuery()
            .SingleOrDefaultAsync(s => s.Id == subthemaId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout("Dit subthema bestaat niet meer. Iemand anders heeft het verwijderd.");

        // The rule the planner applies to a window (WeekplanningService.GeeftLeeftijd): a subthema of another age never
        // runs in this klas, so a proposal for it would answer a question nobody could have asked from the agenda.
        var leeftijden = Jaarfasen.VoorKlas(klas.Leerjaar, klas.Jaarfase);
        if (leeftijden is not null && !leeftijden.Contains(subthema.Leeftijd, StringComparer.Ordinal))
        {
            throw new SchoolcontentValidatieFout($"{subthema.Naam} is een subthema voor {subthema.Leeftijd}, niet voor deze klas.");
        }

        var context = await ContextAsync(klasId, hoek, subthema, cancellationToken);
        var verzoek = HoekverrijkingsvoorstelPromptBuilder.Bouw(context);
        _begrenzing.BewaakHoekverrijking(verzoek);

        var antwoord = HoekverrijkingsvoorstelResponseParser.Parse(await _ai.CompleteAsync(verzoek, cancellationToken));
        if (!antwoord.IsGeldig)
        {
            return HoekverrijkingsvoorstelResultaat.Mislukt(antwoord.Fout!);
        }

        // Nothing new: nothing fitting, the text the corner already holds, or one the klas rejected. The open proposal,
        // if any, stays as it was, so none vanishes without a replacement.
        if (antwoord.Tekst is not { } tekst
            || Gelijk(tekst, context.HuidigeVerrijking)
            || context.Geweigerd.Any(g => Gelijk(tekst, g)))
        {
            return HoekverrijkingsvoorstelResultaat.Geslaagd(null);
        }

        // One open proposal per (hoek, subthema): a new request replaces it. Decided ones stay (Art. IV.2).
        _db.Hoekverrijkingsvoorstellen.RemoveRange(await _db.Hoekverrijkingsvoorstellen
            .Where(v => v.HoekId == hoekId && v.SubthemaId == subthemaId && v.Status == KoppelingStatus.Voorgesteld)
            .ToListAsync(cancellationToken));

        var voorstel = new Hoekverrijkingsvoorstel(hoekId, subthemaId, tekst, antwoord.Motivatie!);
        _db.Hoekverrijkingsvoorstellen.Add(voorstel);
        await _db.SaveChangesAsync(cancellationToken);

        return HoekverrijkingsvoorstelResultaat.Geslaagd(Weergave(voorstel));
    }

    public async Task<HoekverrijkingsvoorstelBesluit> BeslisAsync(
        Guid klasId,
        Guid voorstelId,
        HoekverrijkingsvoorstelBeslissing beslissing,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(beslissing);
        if (beslissing.Status is not (KoppelingStatus.Aanvaard or KoppelingStatus.Geweigerd))
        {
            throw new SchoolcontentValidatieFout("Een voorstel neem je over of weiger je.");
        }

        await LaadKlasAsync(klasId, cancellationToken);

        // Found only through a hoek of this klas: the route names a klas, and nothing outside it is reachable through it.
        var voorstel = await VanKlas(klasId).SingleOrDefaultAsync(v => v.Id == voorstelId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout(VoorstelWeg);
        if (!voorstel.IsOpen)
        {
            throw new SchoolcontentValidatieFout(AlBeslist);
        }

        if (beslissing.Status == KoppelingStatus.Geweigerd)
        {
            voorstel.Weiger();
            await BewaarAsync(cancellationToken);
            return new HoekverrijkingsvoorstelBesluit(KoppelingStatus.Geweigerd, null);
        }

        var tekst = (beslissing.Tekst ?? voorstel.Tekst).Trim();
        if (tekst.Length == 0)
        {
            throw new SchoolcontentValidatieFout("Schrijf wat er in de hoek komt, of weiger het voorstel.");
        }

        if (tekst.Length > Hoekverrijkingsvoorstel.MaxTekstlengte)
        {
            throw new SchoolcontentValidatieFout(
                $"Een voorgestelde verrijking is hoogstens {Hoekverrijkingsvoorstel.MaxTekstlengte} tekens lang. Maak de tekst korter.");
        }

        if (beslissing.SubthemaperiodeId is { } periodeId)
        {
            var periodeSubthema = await _db.Subthemaplaatsingen.AsNoTracking()
                .Where(p => p.Id == periodeId)
                .Select(p => (Guid?)p.SubthemaId)
                .SingleOrDefaultAsync(cancellationToken);
            if (periodeSubthema is { } ander && ander != voorstel.SubthemaId)
            {
                throw new SchoolcontentValidatieFout("Dit voorstel hoort bij een ander subthema dan die periode.");
            }
        }

        // Marked first, so the verrijking's save below stores the decision in the same SaveChanges: accepted and
        // written, or neither. The row version refuses a second, simultaneous decision there. One exception, the one
        // HoekverrijkingService already names: storing a missing window saves on its own first, and if the texts then
        // fail, the window and this decision stay. That window is what the agenda already drew.
        voorstel.Aanvaard(tekst);
        SubthemaperiodeVerrijkingen periode;
        try
        {
            periode = await _verrijkingen.BewaarAsync(
                klasId,
                new HoekverrijkingenInvoer(
                    beslissing.SubthemaperiodeId,
                    beslissing.SubthemaperiodeId is null ? voorstel.SubthemaId : null,
                    beslissing.SubthemaperiodeId is null ? beslissing.Van : null,
                    beslissing.SubthemaperiodeId is null ? beslissing.Tot : null,
                    [new HoekverrijkingTekst(voorstel.HoekId, tekst)]),
                cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new SchoolcontentValidatieFout(AlBeslist);
        }

        return new HoekverrijkingsvoorstelBesluit(voorstel.Status, periode);
    }

    /// <summary>The proposals for the hoeken of one klas.</summary>
    private IQueryable<Hoekverrijkingsvoorstel> VanKlas(Guid klasId) =>
        _db.Hoekverrijkingsvoorstellen.Where(v => _db.Hoeken.Any(h => h.Id == v.HoekId && h.KlasId == klasId));

    private async Task<HoekverrijkingsvoorstelContext> ContextAsync(
        Guid klasId,
        Hoek hoek,
        Subthema subthema,
        CancellationToken cancellationToken)
    {
        var themaNaam = await _db.Themas.AsNoTracking()
            .Where(t => t.Id == subthema.ThemaId)
            .Select(t => t.Naam)
            .SingleAsync(cancellationToken);

        // The decided subdoelen, as loaded goals; one no longer in Op.stap is not offered. Texts only: the proposal
        // links no goal, so the model has no code to repeat (Art. IV.4).
        var codes = subthema.Subdoelen
            .Where(sd => sd.Koppeling.Status is KoppelingStatus.Aanvaard or KoppelingStatus.Manueel)
            .Select(sd => sd.Koppeling.LeerplandoelCode)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        var subdoelen = codes.Count == 0
            ? []
            : await _db.Leerplandoelen.AsNoTracking()
                .Where(l => codes.Contains(l.Code) && !l.NietMeerInOpstap)
                .OrderBy(l => l.Code)
                .Select(l => l.Tekst)
                .ToListAsync(cancellationToken);

        // What the corner holds now for this subthema, in this klas's plan. A subthema planned in two stretches has
        // two windows; the first one's text stands for it here, which is enough to keep the model from repeating it.
        var huidige = await _db.Hoekverrijkingen.AsNoTracking()
            .Where(v => v.HoekId == hoek.Id
                        && _db.Subthemaplaatsingen.Any(p => p.Id == v.SubthemaplaatsingId
                                                           && p.SubthemaId == subthema.Id
                                                           && _db.Jaarplannen.Any(j => j.Id == p.JaarplanId && j.KlasId == klasId)))
            .Select(v => v.Tekst)
            .FirstOrDefaultAsync(cancellationToken);

        var geweigerd = await _db.Hoekverrijkingsvoorstellen.AsNoTracking()
            .Where(v => v.HoekId == hoek.Id && v.SubthemaId == subthema.Id && v.Status == KoppelingStatus.Geweigerd)
            .Select(v => v.Tekst)
            .ToListAsync(cancellationToken);

        return new HoekverrijkingsvoorstelContext(
            themaNaam,
            subthema.Naam,
            Jaarfasen.Normaliseer(subthema.Leeftijd),
            subthema.Onderzoeksvragen.Select(o => o.Vraag).ToList(),
            subdoelen,
            hoek.Naam,
            hoek.Omschrijving,
            huidige,
            geweigerd);
    }

    private async Task<Klas> LaadKlasAsync(Guid klasId, CancellationToken cancellationToken) =>
        await _db.Klassen.AsNoTracking().SingleOrDefaultAsync(k => k.Id == klasId, cancellationToken)
        ?? throw new SchoolcontentNietGevondenFout($"Klas {klasId} is niet gevonden.");

    private async Task BewaarAsync(CancellationToken cancellationToken)
    {
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new SchoolcontentValidatieFout(AlBeslist);
        }
    }

    private static bool Gelijk(string tekst, string? ander) =>
        ander is not null && string.Equals(tekst.Trim(), ander.Trim(), StringComparison.OrdinalIgnoreCase);

    private static HoekverrijkingsvoorstelWeergave Weergave(Hoekverrijkingsvoorstel v) =>
        new(v.Id, v.HoekId, v.SubthemaId, v.Tekst, v.AiMotivatie);
}
