using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Kat;
using Jaarplanner.Application.Planning.Weekplanning;
using Jaarplanner.Application.Planning.Weekvoorstel;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Application.Toegang;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Planning;

/// <summary>
/// EF Core implementation of <see cref="IWeekvoorstelService"/> (FB-027, ADR-0067). Gathers what runs that week, asks the
/// model, fits its picks with <see cref="Weekinpassing"/> and stores them as open proposals in the klas's jaarplan, the
/// same <see cref="Activiteitplaatsing"/> a teacher makes by hand, with status <see cref="KoppelingStatus.Voorgesteld"/>.
/// </summary>
public sealed class WeekvoorstelService : IWeekvoorstelService
{
    private const string GeenSubthema =
        "In deze week loopt geen subthema. Plan eerst een subthema in de agenda, dan kan de AI er activiteiten voor voorstellen.";

    private const string WeekVoorbij = "Deze week is voorbij. Kies een week die nog moet komen.";

    private const string GeenSchooldag = "Deze week heeft vanaf vandaag geen schooldag meer. Kies een andere week.";

    private const string GeenSchooluren =
        "Voor de dagen van deze week zijn geen schooluren ingesteld. Een admin stelt ze in bij Schooluren.";

    private const string AllesGepland =
        "Alle activiteiten van het subthema van deze week staan al in de agenda. Er is niets meer om voor te stellen.";

    private readonly AppDbContext _context;
    private readonly IWeekplanningOpslag _opslag;
    private readonly IAiClient _ai;
    private readonly Promptbegrenzing _begrenzing;
    private readonly TimeProvider _tijd;

    public WeekvoorstelService(
        AppDbContext context,
        IWeekplanningOpslag opslag,
        IAiClient ai,
        Promptbegrenzing begrenzing,
        TimeProvider tijd)
    {
        _context = context;
        _opslag = opslag;
        _ai = ai;
        _begrenzing = begrenzing;
        _tijd = tijd;
    }

    public async Task<WeekvoorstelResultaat> StelVoorAsync(
        Guid klasId,
        DateOnly dagInWeek,
        Rechten vrager,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(vrager);

        var (klas, schooljaar) = await _opslag.LaadKlasMetSchooljaarAsync(klasId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Klas {klasId} is niet gevonden.");

        // The week from today on and inside the school year (D2).
        var maandag = dagInWeek.AddDays(-(((int)dagInWeek.DayOfWeek + 6) % 7));
        var nu = _tijd.GetLocalNow().DateTime;
        var vandaag = DateOnly.FromDateTime(nu);
        var van = Max(Max(maandag, vandaag), schooljaar.Start);
        var tot = Min(maandag.AddDays(6), schooljaar.Eind);
        if (tot < van)
        {
            throw new SchoolcontentValidatieFout(WeekVoorbij);
        }

        var jaarplan = await _opslag.LaadJaarplanAsync(klasId, cancellationToken)
            ?? throw new SchoolcontentValidatieFout(GeenSubthema);

        // W3: the subthema's whose window touches these days, at a leeftijd the klas teaches.
        var leeftijden = Jaarfasen.VoorKlas(klas.Leerjaar, klas.Jaarfase);
        var vensters = jaarplan.Subthemaplaatsingen.Where(p => p.Van <= tot && p.Tot >= van).ToList();
        var vensterSubthemaIds = vensters.Select(p => p.SubthemaId).Distinct().ToList();
        var subthemas = (await _context.Subthemas.AsNoTracking()
                .Where(s => vensterSubthemaIds.Contains(s.Id))
                .Select(s => new { s.Id, s.Naam, s.Leeftijd })
                .ToListAsync(cancellationToken))
            .Where(s => leeftijden is null || leeftijden.Contains(s.Leeftijd, StringComparer.Ordinal))
            .ToDictionary(s => s.Id);
        if (subthemas.Count == 0)
        {
            throw new SchoolcontentValidatieFout(GeenSubthema);
        }

        // W5: the open proposals this run replaces are the shared activiteiten's and the asker's own. A co-teacher's
        // proposals of her own activiteiten stay: they are hers to decide, and never this asker's candidates.
        var open = jaarplan.Activiteitplaatsingen.Where(p => p.IsVervangbaar && p.Datum >= van && p.Datum <= tot).ToList();
        var openIds = open.Select(p => p.ActiviteitId).Distinct().ToList();
        var eigenaars = await _context.Activiteiten.AsNoTracking()
            .Where(a => openIds.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id, a => a.EigenaarId, cancellationToken);
        var vervangen = open
            .Where(p => eigenaars.GetValueOrDefault(p.ActiviteitId) is not { } eigenaar || eigenaar == vrager.GebruikerId)
            .ToList();
        var blijven = open.Except(vervangen).ToList();

        var dagen = await BouwDagenAsync(klasId, schooljaar, van, tot, blijven, vandaag, TimeOnly.FromDateTime(nu), cancellationToken);
        if (dagen.Count == 0)
        {
            throw new SchoolcontentValidatieFout(GeenSchooldag);
        }

        if (dagen.All(d => d.Uren is null))
        {
            throw new SchoolcontentValidatieFout(GeenSchooluren);
        }

        var kandidaten = await KandidatenAsync(jaarplan, vensters, subthemas.ToDictionary(s => s.Key, s => s.Value.Naam), dagen, vrager.GebruikerId, cancellationToken);
        if (kandidaten.Count == 0)
        {
            throw new SchoolcontentValidatieFout(AllesGepland);
        }

        var context = new WeekvoorstelContext(
            leeftijden is { Count: 1 } ? leeftijden[0] : null,
            kandidaten,
            dagen);
        var verzoek = WeekvoorstelPromptBuilder.Bouw(context);
        _begrenzing.BewaakWeekvoorstel(verzoek, kandidaten.Count);

        var antwoord = WeekvoorstelResponseParser.Parse(await _ai.CompleteAsync(verzoek, cancellationToken));
        if (!antwoord.IsGeldig)
        {
            return WeekvoorstelResultaat.Mislukt(antwoord.Fout!);
        }

        var inpassing = Weekinpassing.Pas(context, antwoord.Keuzes);
        if (inpassing.Blokken.Count == 0)
        {
            // W5: an answer that keeps nothing leaves the open proposals as they were.
            return WeekvoorstelResultaat.Geslaagd(0, inpassing.PastNiet, inpassing.AantalOvergeslagen);
        }

        // W5: the week's open proposals make way. Removed and saved before the new ones go in, so a new block on the
        // very moment of an old one cannot collide with it on the unique index.
        await using var transactie = await _context.Database.BeginTransactionAsync(cancellationToken);
        foreach (var oud in vervangen)
        {
            jaarplan.VerwijderActiviteitplaatsing(oud);
        }

        await _opslag.BewaarAsync(cancellationToken);

        foreach (var blok in inpassing.Blokken)
        {
            jaarplan.PlaatsActiviteit(
                blok.Kandidaat.ActiviteitId,
                blok.Datum,
                KoppelingStatus.Voorgesteld,
                blok.Begin,
                blok.Einde,
                blok.Motivatie);
        }

        await _opslag.BewaarAsync(cancellationToken);
        await transactie.CommitAsync(cancellationToken);

        return WeekvoorstelResultaat.Geslaagd(inpassing.Blokken.Count, inpassing.PastNiet, inpassing.AantalOvergeslagen);
    }

    /// <summary>
    /// W3: the shared activiteiten and the asker's own under the running subthema's, minus those a person already
    /// planned inside that subthema's window, each with the days of the week its window covers.
    /// </summary>
    private async Task<List<Weekkandidaat>> KandidatenAsync(
        Jaarplan jaarplan,
        IReadOnlyList<Subthemaplaatsing> vensters,
        IReadOnlyDictionary<Guid, string> subthemaNamen,
        IReadOnlyList<Schooldagvenster> dagen,
        Guid vragerId,
        CancellationToken cancellationToken)
    {
        var subthemaIds = subthemaNamen.Keys.ToList();
        var activiteiten = await _context.Activiteiten.AsNoTracking()
            .Where(a => subthemaIds.Contains(a.SubthemaId) && (a.EigenaarId == null || a.EigenaarId == vragerId))
            .OrderBy(a => a.Naam)
            .ToListAsync(cancellationToken);

        var kandidaten = new List<Weekkandidaat>();
        foreach (var activiteit in activiteiten)
        {
            var eigenVensters = vensters.Where(v => v.SubthemaId == activiteit.SubthemaId).ToList();
            var alGepland = jaarplan.Activiteitplaatsingen.Any(p =>
                p.ActiviteitId == activiteit.Id
                && !p.IsVervangbaar
                && eigenVensters.Any(v => p.Datum >= v.Van && p.Datum <= v.Tot));
            if (alGepland)
            {
                continue;
            }

            var mogelijk = dagen
                .Where(d => eigenVensters.Any(v => d.Datum >= v.Van && d.Datum <= v.Tot))
                .Select(d => d.Datum)
                .ToHashSet();
            if (mogelijk.Count == 0)
            {
                continue;
            }

            kandidaten.Add(new Weekkandidaat(
                $"A{kandidaten.Count + 1}",
                activiteit.Id,
                activiteit.Naam,
                activiteit.ActiviteitType,
                activiteit.VerwachteUitkomsten,
                activiteit.LengteInLesuren,
                subthemaNamen[activiteit.SubthemaId],
                mogelijk));
        }

        return kandidaten;
    }

    /// <summary>
    /// The schooldagen of <paramref name="van"/>–<paramref name="tot"/>, with the school's hours and what is taken:
    /// everything but the open proposals this run replaces (W5), and on today the hours that have passed (D2).
    /// </summary>
    private async Task<IReadOnlyList<Schooldagvenster>> BouwDagenAsync(
        Guid klasId,
        Schooljaar schooljaar,
        DateOnly van,
        DateOnly tot,
        IReadOnlyList<Activiteitplaatsing> blijvendeVoorstellen,
        DateOnly vandaag,
        TimeOnly nu,
        CancellationToken ct)
    {
        var kalender = new Themakalender(schooljaar);
        var uren = await _context.Schooldaguren.AsNoTracking().ToDictionaryAsync(u => u.Weekdag, ct);
        var bezet = await Klasbezetting.HaalAsync(_context, klasId, van, tot, ct, zonderOpenVoorstellen: true);
        foreach (var voorstel in blijvendeVoorstellen)
        {
            Voeg(bezet, voorstel.Datum, new Tijdvak(voorstel.Begin, voorstel.Einde));
        }

        Voeg(bezet, vandaag, new Tijdvak(TimeOnly.MinValue, nu));

        var dagen = new List<Schooldagvenster>();
        for (var dag = van; dag <= tot; dag = dag.AddDays(1))
        {
            if (kalender.IsSchooldag(dag))
            {
                dagen.Add(new Schooldagvenster(dag, uren.GetValueOrDefault(dag.DayOfWeek), bezet.GetValueOrDefault(dag, [])));
            }
        }

        return dagen;
    }

    private static void Voeg(Dictionary<DateOnly, List<Tijdvak>> bezet, DateOnly dag, Tijdvak vak)
    {
        if (!bezet.TryGetValue(dag, out var lijst))
        {
            lijst = [];
            bezet[dag] = lijst;
        }

        lijst.Add(vak);
    }

    private static DateOnly Max(DateOnly a, DateOnly b) => a > b ? a : b;

    private static DateOnly Min(DateOnly a, DateOnly b) => a < b ? a : b;
}
