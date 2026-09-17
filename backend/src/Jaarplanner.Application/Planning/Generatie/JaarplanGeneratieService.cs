using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Planning.Generatie.Response;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// The AI jaarplan generation (FR-5.1, FR-8.1, ADR-0055): the model proposes thema's with a start week, and this
/// service turns each into days by the same calendar rules a hand-placement follows.
/// <para>
/// <b>The model chooses, the calendar decides.</b> For each proposal, in order of its start week, the thema starts on
/// the first free schooldag from that week on, within the stretch the thema would span from there. It ends where
/// <see cref="Themakalender.VoorgesteldEinde"/> says, or before the next placement when that comes first, and is split
/// at every vacation. A stretch shorter than one lesweek is no place for a thema, and the proposal is reported as not
/// placed. So two thema's never share a day (ADR-0053 R4) whatever the model answers.
/// </para>
/// <para>
/// <b>Only open proposals are replaced</b> (Art. IX.3): a placement that is <see cref="KoppelingStatus.Voorgesteld"/>
/// and not locked goes; everything the teacher decided or locked stays, and its days are not offered to the model. Every
/// new placement is stored as <see cref="KoppelingStatus.Voorgesteld"/> with the model's motivation (Art. IV.1-IV.3).
/// </para>
/// <para>
/// <b>An unreadable answer changes nothing</b> (Art. IV.5): the plan is only touched after the answer parsed.
/// </para>
/// </summary>
public sealed class JaarplanGeneratieService
{
    private readonly IAiClient _aiClient;
    private readonly IJaarplanOpslag _opslag;
    private readonly Promptbegrenzing _begrenzing;

    /// <summary>Constructs the service around the AI seam, its persistence port and the prompt ceiling.</summary>
    public JaarplanGeneratieService(IAiClient aiClient, IJaarplanOpslag opslag, Promptbegrenzing begrenzing)
    {
        _aiClient = aiClient ?? throw new ArgumentNullException(nameof(aiClient));
        _opslag = opslag ?? throw new ArgumentNullException(nameof(opslag));
        _begrenzing = begrenzing ?? throw new ArgumentNullException(nameof(begrenzing));
    }

    /// <summary>Generates proposals for the whole school year of <paramref name="klasId"/>, on its free days.</summary>
    /// <exception cref="SchoolcontentNietGevondenFout">The class does not exist.</exception>
    /// <exception cref="SchoolcontentValidatieFout">The school has no thema's, or the plan has no free lesweek.</exception>
    /// <exception cref="PromptTeGrootFout">The request is over the prompt ceiling (TB-007).</exception>
    public async Task<JaarplanGeneratieResultaat> GenereerAsync(Guid klasId, CancellationToken cancellationToken = default)
    {
        var (klas, schooljaar) = await _opslag.LaadKlasMetSchooljaarAsync(klasId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Klas {klasId} is niet gevonden.");
        var kalender = new Themakalender(schooljaar);
        var themas = await _opslag.LaadThemasAsync(cancellationToken);
        if (themas.Count == 0)
        {
            throw new SchoolcontentValidatieFout("De school heeft nog geen thema's om in te plannen.");
        }

        var themaPerId = themas.ToDictionary(t => t.Id);
        var bestaand = await _opslag.LaadJaarplanAsync(klasId, cancellationToken);
        var blijvend = bestaand?.Plaatsingen.Where(p => !p.IsVervangbaar).ToList() ?? [];

        var weken = Planweken(kalender, blijvend, themaPerId);
        if (weken.All(w => w.IsVol))
        {
            throw new SchoolcontentValidatieFout(
                "Er is geen vrije lesweek meer in dit jaarplan. Verwijder eerst een thema om plaats te maken.");
        }

        var alGepland = blijvend.Select(p => Naam(themaPerId, p.ThemaId)).Distinct(StringComparer.Ordinal).ToList();
        var request = JaarplanGeneratiePromptBuilder.Bouw(klas, schooljaar, weken, themas, alGepland);
        _begrenzing.Bewaak(request, themas);

        var parse = JaarplanGeneratieResponseParser.Parse(await _aiClient.CompleteAsync(request, cancellationToken));
        if (!parse.IsGeldig)
        {
            return JaarplanGeneratieResultaat.Mislukt(parse.Fout!);
        }

        var jaarplan = bestaand ?? MaakJaarplan(klasId);
        var vervangen = jaarplan.VerwijderVervangbarePlaatsingen().Count;
        var behouden = Themareeks.Bepaal(jaarplan.Plaatsingen, kalender).Count;

        var themaPerNaam = themas
            .GroupBy(t => t.Naam, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
        var gepland = jaarplan.Plaatsingen.Select(p => p.ThemaId).ToHashSet();
        var nietGeplaatst = new List<NietGeplaatstThema>();
        var nieuw = 0;

        // By start week, so an earlier thema claims its days first. OrderBy is stable: a tie keeps the model's order.
        foreach (var suggestie in parse.Plaatsingen.OrderBy(s => s.Startweek))
        {
            if (!themaPerNaam.TryGetValue(suggestie.ThemaNaam, out var thema))
            {
                nietGeplaatst.Add(new NietGeplaatstThema(suggestie.ThemaNaam, NietGeplaatstThema.OnbekendThema));
                continue;
            }

            if (gepland.Contains(thema.Id))
            {
                nietGeplaatst.Add(new NietGeplaatstThema(thema.Naam, NietGeplaatstThema.AlGepland));
                continue;
            }

            var maandag = Themakalender.Maandag(suggestie.Startweek);
            if (!kalender.IsLesweek(maandag))
            {
                nietGeplaatst.Add(new NietGeplaatstThema(thema.Naam, NietGeplaatstThema.GeenLesweek));
                continue;
            }

            var delen = Delen(kalender, jaarplan, maandag, thema.DuurWeken);
            if (delen.Count == 0)
            {
                nietGeplaatst.Add(new NietGeplaatstThema(thema.Naam, NietGeplaatstThema.GeenPlaats));
                continue;
            }

            foreach (var (van, tot) in delen)
            {
                jaarplan.VoegPlaatsingToe(thema.Id, van, tot, KoppelingStatus.Voorgesteld, suggestie.Motivatie);
            }

            gepland.Add(thema.Id);
            nieuw++;
        }

        await _opslag.BewaarAsync(cancellationToken);

        return JaarplanGeneratieResultaat.Geslaagd(nieuw, behouden, vervangen, nietGeplaatst);
    }

    /// <summary>
    /// The parts a thema of <paramref name="weken"/> lesweken gets when it is to start in the week of
    /// <paramref name="maandag"/>, or none when there is no place for it.
    /// <para>
    /// The begin is the first free schooldag from that week on that starts a stretch of at least one whole lesweek, but
    /// no later than the end the thema would have if it started in that week: past that, the model's choice of season no
    /// longer holds. The end is the proposed end from the begin, cut before the next placement.
    /// </para>
    /// </summary>
    private static IReadOnlyList<(DateOnly Van, DateOnly Tot)> Delen(
        Themakalender kalender,
        Jaarplan jaarplan,
        DateOnly maandag,
        int weken)
    {
        var eersteDag = kalender.VolgendeSchooldag(maandag);
        if (eersteDag is null)
        {
            return [];
        }

        var uiterste = kalender.VoorgesteldEinde(eersteDag.Value, weken, out _);
        for (var dag = eersteDag; dag is not null && dag <= uiterste; dag = kalender.VolgendeSchooldag(dag.Value.AddDays(1)))
        {
            if (jaarplan.Overlappend(dag.Value, dag.Value) is not null)
            {
                continue;
            }

            var begin = dag.Value;
            var tot = kalender.VoorgesteldEinde(begin, weken, out _);
            var volgende = jaarplan.Plaatsingen.FirstOrDefault(p => p.Van > begin);
            if (volgende is not null && volgende.Van <= tot)
            {
                tot = kalender.VorigeSchooldag(volgende.Van.AddDays(-1)) ?? begin;
            }

            // A free stretch too short for one lesweek is skipped; a later free stretch in the window may still fit.
            if (kalender.VolleLesweken(begin, tot) >= 1)
            {
                return kalender.Splits(begin, tot);
            }
        }

        return [];
    }

    /// <summary>Every lesweek of the year with the thema's that stay in it and whether a schooldag in it is free.</summary>
    private static IReadOnlyList<Planweek> Planweken(
        Themakalender kalender,
        IReadOnlyList<Themaplaatsing> blijvend,
        IReadOnlyDictionary<Guid, Thema> themaPerId) =>
        kalender.Lesweken()
            .Select(maandag =>
            {
                var vrijdag = maandag.AddDays(4);
                var inWeek = blijvend.Where(p => p.Overlapt(maandag, vrijdag)).ToList();
                var vol = Enumerable.Range(0, 5)
                    .Select(maandag.AddDays)
                    .Where(kalender.IsSchooldag)
                    .All(dag => inWeek.Any(p => p.Overlapt(dag, dag)));

                return new Planweek(
                    maandag,
                    inWeek.Select(p => Naam(themaPerId, p.ThemaId)).Distinct(StringComparer.Ordinal).ToList(),
                    vol);
            })
            .ToList();

    private Jaarplan MaakJaarplan(Guid klasId)
    {
        // One jaarplan per klas (Art. IX.3), created only once the answer parsed, so a failed run leaves no empty row.
        var jaarplan = new Jaarplan(klasId);
        _opslag.VoegJaarplanToe(jaarplan);

        return jaarplan;
    }

    private static string Naam(IReadOnlyDictionary<Guid, Thema> themaPerId, Guid themaId) =>
        themaPerId.GetValueOrDefault(themaId)?.Naam ?? "onbekend thema";
}
