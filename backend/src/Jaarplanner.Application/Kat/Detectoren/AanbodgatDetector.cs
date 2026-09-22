using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Kat;
using Jaarplanner.Domain.Planning;

namespace Jaarplanner.Application.Kat.Detectoren;

/// <summary>
/// "A thema starts and this discipline is hardly in the klas's aanbod" (FB-070, ADR-0060 G2, G3): a thema's run in the
/// klas starts within <see cref="Schooldagenvooraf"/> schooldagen, and some discipline of the klas's jaarfase has goals
/// in no dekkingsprognose of the klas at all. The discipline with the largest share is the one it names.
/// <para>
/// <b>No AI</b> (ADR-0059 K1): the choice of discipline is arithmetic over the klas's computed dekking
/// (<see cref="Aanbodgatbepaling"/>). What the AI is then asked for is content, and that is <c>AanbodgatTaak</c>'s
/// (<see cref="IKattaak"/>), which runs only for a finding noticed for the first time.
/// </para>
/// <para>
/// <b>Silent when the thema has no subthema at the klas's leeftijd.</b> Every proposal goes under one (ADR-0060 D3), so
/// a thema that offers none has nowhere to put what the AI would bring, and a signal about it would be a promise the
/// cat cannot keep.
/// </para>
/// </summary>
public sealed class AanbodgatDetector : ISignaaldetector
{
    /// <summary>
    /// How long before a thema starts the cat looks, in schooldagen (ADR-0060 G3). A week of school: long enough to
    /// prepare something, short enough that the thema is already the teacher's next concern.
    /// </summary>
    public const int Schooldagenvooraf = 5;

    /// <summary>The keys of this soort's message in <c>nl.json</c>.</summary>
    public static class Sleutels
    {
        public const string Thema = "thema";
        public const string Discipline = "discipline";
        public const string AantalDoelen = "aantalDoelen";
        public const string AantalInDiscipline = "aantalInDiscipline";
    }

    private readonly IJaarplanLezer _plan;
    private readonly IKatplanbron _bron;

    public AanbodgatDetector(IJaarplanLezer plan, IKatplanbron bron)
    {
        _plan = plan;
        _bron = bron;
    }

    public async Task<IReadOnlyList<Signaalvondst>> DetecteerAsync(Katcontext context, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (await _bron.HaalSchooljaarAsync(context.KlasId, ct) is not { } schooljaar)
        {
            return [];
        }

        var kalender = new Themakalender(schooljaar);
        var startend = StartenBinnenkort(await _plan.HaalJaarplanAsync(context.KlasId, ct), kalender, context.Vandaag);
        if (startend.Count == 0)
        {
            return [];
        }

        if (Aanbodgatbepaling.Grootste(await context.HaalDekkingAsync(ct)) is not { } gat)
        {
            return [];
        }

        var subthemas = await _bron.HaalSubthemasAsync(context.KlasId, ct);

        var vondsten = new List<Signaalvondst>();
        foreach (var start in startend)
        {
            // A klas whose leeftijden cannot be derived widens rather than narrows (Art. XIV), as the dekking does.
            var heeftSubthema = subthemas.Any(s =>
                s.ThemaId == start.ThemaId
                && (context.Leeftijden is not { } leeftijden || leeftijden.Contains(s.Leeftijd, StringComparer.Ordinal)));
            if (!heeftSubthema)
            {
                continue;
            }

            vondsten.Add(new Signaalvondst(
                Signaalsoort.Aanbodgat,
                context.KlasId,
                start.PlaatsingId.ToString(),
                context.OntvangerIds,
                new Dictionary<string, object>(StringComparer.Ordinal)
                {
                    [Sleutels.Thema] = start.ThemaNaam,
                    [Sleutels.Discipline] = gat.DisciplineNaam ?? gat.DisciplineNummer,
                    [Sleutels.AantalDoelen] = gat.Codes.Count,
                    [Sleutels.AantalInDiscipline] = gat.AantalInBereik,
                },
                Agendaverwijzing.Periodes));
        }

        return vondsten;
    }

    /// <summary>
    /// The thema runs in this klas that start within <see cref="Schooldagenvooraf"/> schooldagen, with the id of the
    /// part that opens the run.
    /// <para>
    /// <b>The start of the run, not of a part.</b> A vacation stores one thema as several placements (ADR-0053) and the
    /// teacher reads the run as one thema; the second part's start is the middle of a thema she already began.
    /// </para>
    /// <para>
    /// <b>Strictly before.</b> A thema that starts today is running: preparing for it is no longer preparing. So is one
    /// that started last week, whose <c>TelSchooldagen</c> of an empty stretch would otherwise read as 0.
    /// </para>
    /// </summary>
    internal static IReadOnlyList<(Guid PlaatsingId, Guid ThemaId, string ThemaNaam)> StartenBinnenkort(
        JaarplanWeergave plan,
        Themakalender kalender,
        DateOnly vandaag) =>
        plan.Plaatsingen
            .Where(p => !p.IsVervallen && !IsGeweigerd(p))
            .GroupBy(p => p.ThemaId)
            .Select(g => g.OrderBy(p => p.Reeks?.ReeksVan ?? p.Van).ThenBy(p => p.Van).First())
            .Select(p => new { p.Id, p.ThemaId, p.ThemaNaam, Start = p.Reeks?.ReeksVan ?? p.Van })
            .Where(t => t.Start > vandaag && kalender.TelSchooldagen(vandaag.AddDays(1), t.Start) <= Schooldagenvooraf)
            .OrderBy(t => t.Start)
            .Select(t => (t.Id, t.ThemaId, t.ThemaNaam))
            .ToList();

    /// <summary>
    /// A rejected placement is not a period: nothing is taught on its account, so it can neither run nor start.
    /// Compared as text because that is how <see cref="ThemaplaatsingWeergave"/> carries the status.
    /// </summary>
    private static bool IsGeweigerd(ThemaplaatsingWeergave plaatsing) =>
        string.Equals(plaatsing.Status, nameof(Domain.Schoolcontent.KoppelingStatus.Geweigerd), StringComparison.Ordinal);
}
