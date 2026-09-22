using Jaarplanner.Application.Activiteitvoorstellen;
using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Kat;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Kat;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Activiteitvoorstellen;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.Planning;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Jaarplanner.Infrastructure.Kat;

/// <summary>
/// What the cat does about an aanbod-gat (FB-070, ADR-0060): it asks the AI for two or three activiteiten in the
/// discipline the klas hardly touches, inside the thema that is about to start, and stores them as open proposals
/// addressed to the klas (D2). <b>The first <see cref="IKattaak"/>, and the first AI call nobody asked for</b>
/// (Art. IV.8).
/// <para>
/// <b>It prepares, it never decides</b> (ADR-0059 K2): every row it writes is <c>voorgesteld</c>, with a motivation
/// (Art. IV.3), and a leerkracht of the klas or an admin decides it (Art. IV.1).
/// </para>
/// <para>
/// <b>Once per placement</b> (G3). The round already runs a task only for a finding it has no signal for, but a
/// signal whose reason briefly disappears and comes back would run it twice; the proposals themselves carry the
/// <see cref="Activiteitvoorstel.ThemaplaatsingId"/>, so the durable guard is here and not in the round.
/// </para>
/// <para>
/// <b>It may bring nothing</b> (G4), and that is a normal outcome: when no goal of the gap belongs in this thema the
/// model answers with an empty list, and the cat keeps quiet rather than forcing an activiteit.
/// </para>
/// </summary>
public sealed class AanbodgatTaak : IKattaak
{
    /// <summary>How many proposals the cat asks for (G3: "two or three").</summary>
    public const int Aantal = 3;

    private readonly AppDbContext _context;
    private readonly IAiClient _ai;
    private readonly Promptbegrenzing _begrenzing;
    private readonly IJaarplanLezer _plan;
    private readonly Katdekkingbron _dekking;
    private readonly ILogger<AanbodgatTaak> _logger;

    public AanbodgatTaak(
        AppDbContext context,
        IAiClient ai,
        Promptbegrenzing begrenzing,
        IJaarplanLezer plan,
        Katdekkingbron dekking,
        ILogger<AanbodgatTaak> logger)
    {
        _context = context;
        _ai = ai;
        _begrenzing = begrenzing;
        _plan = plan;
        _dekking = dekking;
        _logger = logger;
    }

    public Signaalsoort Soort => Signaalsoort.Aanbodgat;

    public async Task VoerUitAsync(Signaalvondst vondst, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(vondst);

        if (!Guid.TryParse(vondst.Sleutel, out var themaplaatsingId))
        {
            return;
        }

        var klasId = vondst.KlasId;
        if (await _context.Activiteitvoorstellen.AsNoTracking()
                .AnyAsync(v => v.KlasId == klasId && v.ThemaplaatsingId == themaplaatsingId, ct))
        {
            return;
        }

        var (klas, schooljaar) = await LaadKlasAsync(klasId, ct);
        if (klas is null || schooljaar is null)
        {
            return;
        }

        if (VindLoop(await _plan.HaalJaarplanAsync(klasId, ct), themaplaatsingId) is not { } loop)
        {
            return;
        }

        // The dekking a second time, after the detector's. A task runs once per thema placement, at most a handful of
        // times a year per klas, and the alternative is carrying the goal codes through the Signaalvondst, whose
        // Gegevens is the message's placeholders and reaches the frontend.
        if (Aanbodgatbepaling.Grootste(await _dekking(klasId, ct)) is not { } gat)
        {
            return;
        }

        // D5: a goal of a rejected proposal is not proposed again for this klas. A klas lives in one schooljaar, so
        // "this klas" is already "this schooljaar".
        var geweigerd = await _context.Activiteitvoorstellen.AsNoTracking()
            .Where(v => v.KlasId == klasId && v.Status == KoppelingStatus.Geweigerd)
            .Select(v => new { v.Naam, v.LeerplandoelCodes })
            .ToListAsync(ct);
        var uitgesloten = geweigerd.SelectMany(v => v.LeerplandoelCodes).ToHashSet(StringComparer.Ordinal);

        var codes = gat.Codes.Where(c => !uitgesloten.Contains(c)).ToList();
        if (codes.Count == 0)
        {
            return;
        }

        var leeftijden = Jaarfasen.VoorKlas(klas.Leerjaar, klas.Jaarfase);
        var subthemas = await LaadSubthemasAsync(loop.ThemaId, leeftijden, ct);
        if (subthemas.Count == 0)
        {
            return;
        }

        var doelen = await _context.Leerplandoelen.AsNoTracking()
            .Where(d => codes.Contains(d.Code))
            .ToListAsync(ct);
        if (doelen.Count == 0)
        {
            return;
        }

        // Built before the call now, because the model chooses its moment from them (ADR-0062 M1).
        var dagen = await BouwDagenAsync(klasId, schooljaar, loop, ct);
        if (dagen.Count == 0)
        {
            return;
        }

        var context = new AanbodgatContext(
            loop.ThemaNaam,
            // The first subthema's own leeftijd, not the klas's derived set: a subthema is written for one age, and
            // that is what the model should speak to. A klas whose set cannot be derived (Art. XIV) still names one.
            Jaarfasen.Normaliseer(subthemas[0].Leeftijd),
            gat.DisciplineNaam ?? gat.DisciplineNummer,
            subthemas.Select(s => s.Prompt).ToList(),
            doelen,
            geweigerd.Select(v => v.Naam).ToList(),
            Aantal,
            dagen);

        var verzoek = AanbodgatPromptBuilder.Bouw(context);
        _begrenzing.Bewaak(verzoek, doelen);

        var antwoord = ActiviteitvoorstelResponseParser.Parse(await _ai.CompleteAsync(verzoek, ct));
        if (!antwoord.IsGeldig)
        {
            // Operator-only (Art. II.3): nobody sees this, and nothing is stored (Art. IV.5).
            _logger.LogWarning(
                "Cat aanbod-gat proposals for klas {KlasId}, placement {PlaatsingId}: unreadable AI answer: {Fout}",
                klasId,
                themaplaatsingId,
                antwoord.Fout);
            return;
        }

        var plan = AanbodgatValidator.Keur(context, antwoord);
        if (plan.Voorstellen.Count == 0)
        {
            _logger.LogInformation(
                "Cat aanbod-gat proposals for klas {KlasId}, placement {PlaatsingId}: nothing fitted ({Overgeslagen} dropped).",
                klasId,
                themaplaatsingId,
                plan.AantalOvergeslagen);
            return;
        }

        await BewaarAsync(klas.Id, dagen, themaplaatsingId, plan, ct);
    }

    /// <summary>
    /// Stores what fitted, each on the moment the model proposed, corrected to a free one the school can give
    /// (ADR-0062 D1). A proposal the calendar has no room for at all is left out rather than stored without a moment:
    /// an own activiteit that is not planned counts for nothing (ADR-0060 G5, Art. V.1), so a proposal she cannot place
    /// is a proposal that cannot help her.
    /// </summary>
    private async Task BewaarAsync(
        Guid klasId,
        IReadOnlyList<Schooldagvenster> dagen,
        Guid themaplaatsingId,
        AanbodgatVoorstelplan plan,
        CancellationToken ct)
    {
        var volgnummer = await _context.Activiteitvoorstellen
            .Where(v => v.KlasId == klasId)
            .MaxAsync(v => (int?)EF.Property<int>(v, ActiviteitvoorstelService.Volgnummer), ct) ?? 0;

        foreach (var voorstel in plan.Voorstellen)
        {
            var minuten = voorstel.Activiteit.LengteInLesuren * Vrijmoment.MinutenPerLesuur;
            if (Vrijmoment.Zoek(dagen, minuten, voorstel.Voorkeur) is not { } moment)
            {
                continue;
            }

            var rij = Activiteitvoorstel.OpAanbodgat(
                voorstel.SubthemaId,
                klasId,
                themaplaatsingId,
                voorstel.Activiteit.Naam,
                voorstel.Activiteit.ActiviteitType,
                voorstel.Activiteit.VerwachteUitkomsten,
                voorstel.Activiteit.LengteInLesuren,
                voorstel.Activiteit.OnderzoeksvraagId,
                voorstel.Activiteit.LeerplandoelCodes,
                voorstel.Activiteit.Motivatie,
                moment.Datum,
                moment.Begin,
                moment.Einde);

            _context.Activiteitvoorstellen.Add(rij);
            _context.Entry(rij).Property(ActiviteitvoorstelService.Volgnummer).CurrentValue = ++volgnummer;

            // The next proposal may not land on this one: the cat brings a set she can accept whole.
            dagen = Bezet(dagen, moment);
        }

        await _context.SaveChangesAsync(ct);
    }

    /// <summary>
    /// The schooldagen of the thema's run, with the school's hours and what is already planned on each.
    /// <para>
    /// The whole run, with no clamp to today: <see cref="Application.Kat.Detectoren.AanbodgatDetector"/> only brings a
    /// finding for a run that has not started yet, so every day here is still ahead.
    /// </para>
    /// </summary>
    private async Task<IReadOnlyList<Schooldagvenster>> BouwDagenAsync(
        Guid klasId,
        Schooljaar schooljaar,
        Themaloop loop,
        CancellationToken ct)
    {
        var kalender = new Themakalender(schooljaar);
        var uren = await _context.Schooldaguren.AsNoTracking().ToDictionaryAsync(u => u.Weekdag, ct);
        var bezet = await Klasbezetting.HaalAsync(_context, klasId, loop.Van, loop.Tot, ct);

        var dagen = new List<Schooldagvenster>();
        for (var dag = loop.Van; dag <= loop.Tot; dag = dag.AddDays(1))
        {
            if (kalender.IsSchooldag(dag))
            {
                dagen.Add(new Schooldagvenster(dag, uren.GetValueOrDefault(dag.DayOfWeek), bezet.GetValueOrDefault(dag, [])));
            }
        }

        return dagen;
    }

    /// <summary>The same days, with one more moment taken.</summary>
    private static IReadOnlyList<Schooldagvenster> Bezet(
        IReadOnlyList<Schooldagvenster> dagen,
        (DateOnly Datum, TimeOnly Begin, TimeOnly Einde) moment) =>
        dagen
            .Select(d => d.Datum == moment.Datum
                ? d with { Bezet = [.. d.Bezet, new Tijdvak(moment.Begin, moment.Einde)] }
                : d)
            .ToList();

    private async Task<(Klas? Klas, Schooljaar? Schooljaar)> LaadKlasAsync(Guid klasId, CancellationToken ct)
    {
        var klas = await _context.Klassen.AsNoTracking().FirstOrDefaultAsync(k => k.Id == klasId, ct);
        if (klas is null)
        {
            return (null, null);
        }

        // The closures are an owned collection, so they come with the year and need no Include.
        var schooljaar = await _context.Schooljaren.AsNoTracking().FirstOrDefaultAsync(j => j.Id == klas.SchooljaarId, ct);
        return (klas, schooljaar);
    }

    /// <summary>
    /// The whole run the placement belongs to, by its first and last day (ADR-0053): a vacation stores one thema as
    /// several placements, and the activiteit may land in any part of it.
    /// </summary>
    private static Themaloop? VindLoop(JaarplanWeergave plan, Guid themaplaatsingId)
    {
        var plaatsing = plan.Plaatsingen.FirstOrDefault(p => p.Id == themaplaatsingId);
        return plaatsing is null
            ? null
            : new Themaloop(
                plaatsing.ThemaId,
                plaatsing.ThemaNaam,
                plaatsing.Reeks?.ReeksVan ?? plaatsing.Van,
                plaatsing.Reeks?.ReeksTot ?? plaatsing.Tot);
    }

    /// <summary>
    /// The thema's subthema's at the klas's leeftijd, with their onderzoeksvragen and the activiteiten already under
    /// them, keyed <c>S1</c>, <c>S2</c>, … so no database id reaches the prompt.
    /// </summary>
    private async Task<IReadOnlyList<Kandidaatsubthema>> LaadSubthemasAsync(
        Guid themaId,
        IReadOnlyList<string>? leeftijden,
        CancellationToken ct)
    {
        var rijen = await _context.Subthemas.AsNoTracking()
            .Where(s => s.ThemaId == themaId)
            .Select(s => new
            {
                s.Id,
                s.Naam,
                s.Leeftijd,
                Vragen = s.Onderzoeksvragen.Select(v => new { v.Id, v.Vraag }).ToList(),
                Activiteitnamen = s.Activiteiten.Select(a => new { a.Naam, a.ActiviteitType }).ToList(),
            })
            .ToListAsync(ct);

        // A klas whose leeftijden cannot be derived widens rather than narrows (Art. XIV), as the dekking does.
        var passend = (leeftijden is null
                ? rijen
                : rijen.Where(s => leeftijden.Contains(s.Leeftijd, StringComparer.Ordinal)))
            // Ordinally by name, so a retried tick keys the same subthema S1 and the model's answer means the same
            // thing. The database's order is not promised to be stable.
            .OrderBy(s => s.Naam, StringComparer.Ordinal)
            .ThenBy(s => s.Id)
            .ToList();

        return passend
            .Select((s, i) => new Kandidaatsubthema(
                s.Leeftijd,
                new PromptSubthema(
                    $"S{i + 1}",
                    s.Id,
                    s.Naam,
                    s.Vragen.Select((v, j) => new PromptOnderzoeksvraag($"V{j + 1}", v.Id, v.Vraag)).ToList(),
                    s.Activiteitnamen.Select(a => new BestaandeActiviteit(a.Naam, a.ActiviteitType)).ToList())))
            .ToList();
    }

    private sealed record Themaloop(Guid ThemaId, string ThemaNaam, DateOnly Van, DateOnly Tot);

    private sealed record Kandidaatsubthema(string Leeftijd, PromptSubthema Prompt);
}
