using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// A class's jaarplan as the teacher builds it by hand (FR-6, FR-7, ADR-0053): read it, propose an end for a thema,
/// place a thema from one day to another, give a placement new dates or drag it, decide a proposal, lock it, remove it.
/// <para>
/// <b>Every rule about days comes from <see cref="Themakalender"/></b>: which day is a schooldag, where a vacation
/// splits a thema, what end a thema's duration proposes. This service only applies them and refuses, in Dutch, what the
/// teacher can correct (<see cref="OngeldigePlaatsingFout"/>).
/// </para>
/// <para>
/// <b>No two placements share a day</b> (owner ruling 2026-09-16). Every write checks the new days against the plan
/// and names the thema in the way; the aggregate refuses the same thing as a backstop.
/// </para>
/// </summary>
public sealed class JaarplanService : IJaarplanLezer
{
    /// <summary>The value of <see cref="EindvoorstelWeergave.BeperktDoor"/> when the next thema cut the proposal.</summary>
    public const string BeperktDoorVolgendThema = "VolgendThema";

    /// <summary>The value of <see cref="EindvoorstelWeergave.BeperktDoor"/> when the school year did.</summary>
    public const string BeperktDoorSchooljaar = "Schooljaar";

    private readonly IJaarplanOpslag _opslag;

    /// <summary>Constructs the service around its persistence port (DI / tests).</summary>
    public JaarplanService(IJaarplanOpslag opslag)
    {
        _opslag = opslag ?? throw new ArgumentNullException(nameof(opslag));
    }

    /// <inheritdoc />
    public async Task<JaarplanWeergave> HaalJaarplanAsync(Guid klasId, CancellationToken cancellationToken = default)
    {
        var (klas, schooljaar) = await LaadKlasAsync(klasId, cancellationToken);
        var jaarplan = await _opslag.LaadJaarplanAsync(klasId, cancellationToken);
        var themas = await _opslag.LaadThemasAsync(cancellationToken);

        return Projecteer(klas, schooljaar, themas, jaarplan);
    }

    /// <summary>
    /// The end the tool proposes for <paramref name="themaId"/> starting on <paramref name="van"/>, and the parts that
    /// would be stored (ADR-0053 R2, R3, R5).
    /// <para>
    /// The proposal is the thema's duration counted in lesweken, cut to the last schooldag before the next placement
    /// when that one starts earlier, and to the last schooldag of the year. It writes nothing.
    /// </para>
    /// </summary>
    /// <exception cref="OngeldigePlaatsingFout">
    /// The first day lies outside the year, is no schooldag, or already belongs to another placement.
    /// </exception>
    /// <exception cref="SchoolcontentNietGevondenFout">The class or the thema does not exist.</exception>
    public async Task<EindvoorstelWeergave> StelEindeVoorAsync(
        Guid klasId,
        Guid themaId,
        DateOnly van,
        CancellationToken cancellationToken = default)
    {
        var (_, schooljaar) = await LaadKlasAsync(klasId, cancellationToken);
        var kalender = new Themakalender(schooljaar);
        var themas = await _opslag.LaadThemasAsync(cancellationToken);
        var thema = VindThema(themas, themaId);
        var jaarplan = await _opslag.LaadJaarplanAsync(klasId, cancellationToken);

        return Voorstel(kalender, schooljaar, themas, jaarplan, thema, van);
    }

    /// <summary>
    /// Places a thema by hand from <paramref name="van"/> to <paramref name="tot"/> (FR-7.2), splitting it at every
    /// vacation, and persists it at once. Creates the class's jaarplan when it has none yet.
    /// <para>
    /// <b>Without an end, the proposed one is used</b> (<see cref="StelEindeVoorAsync"/>). An end after the last
    /// schooldag is cut to it (ADR-0053 R5). Every part lands as <see cref="KoppelingStatus.Manueel"/>: the teacher
    /// chose these days, so it counts for dekking and no regeneration may discard it.
    /// </para>
    /// </summary>
    /// <exception cref="OngeldigePlaatsingFout">The days are invalid or taken.</exception>
    /// <exception cref="SchoolcontentNietGevondenFout">The class or the thema does not exist.</exception>
    public async Task<JaarplanWeergave> PlaatsThemaAsync(
        Guid klasId,
        Guid themaId,
        DateOnly van,
        DateOnly? tot,
        CancellationToken cancellationToken = default)
    {
        var (klas, schooljaar) = await LaadKlasAsync(klasId, cancellationToken);
        var kalender = new Themakalender(schooljaar);
        var themas = await _opslag.LaadThemasAsync(cancellationToken);
        var thema = VindThema(themas, themaId);
        if (!thema.GeldtVoor(Jaarfasen.VoorKlas(klas.Leerjaar, klas.Jaarfase)))
        {
            throw OngeldigePlaatsingFout.NietVoorKlas(thema.Naam, klas.Naam, thema.Leeftijden);
        }

        var bestaand = await _opslag.LaadJaarplanAsync(klasId, cancellationToken);
        var einde = tot ?? Voorstel(kalender, schooljaar, themas, bestaand, thema, van).Tot;

        var delen = Delen(kalender, schooljaar, van, einde);
        ControleerVrij(bestaand, themas, delen, behalve: null);

        var jaarplan = bestaand ?? MaakJaarplan(klasId);
        foreach (var (deelVan, deelTot) in delen)
        {
            jaarplan.VoegPlaatsingToe(thema.Id, deelVan, deelTot, KoppelingStatus.Manueel);
        }

        await _opslag.BewaarAsync(cancellationToken);

        return Projecteer(klas, schooljaar, themas, jaarplan);
    }

    /// <summary>
    /// Gives a placement a new first and last day (the date fields on its card), splitting it again at every vacation.
    /// <para>
    /// The placement keeps the first part; any further part is stored as a new manual placement of the same thema.
    /// <b>Nothing is written when the days do not change</b>, so opening a card and saving it unchanged does not cost a
    /// standing proposal its status and motivation. A <i>vervallen</i> placement saved with the same days is split again,
    /// which is how the teacher resolves it (ADR-0053 decision 5).
    /// </para>
    /// </summary>
    /// <exception cref="OngeldigePlaatsingFout">The days are invalid or taken.</exception>
    /// <exception cref="SchoolcontentNietGevondenFout">The class, its plan or the placement does not exist.</exception>
    public async Task<JaarplanWeergave> WijzigDatumsAsync(
        Guid klasId,
        Guid plaatsingId,
        DateOnly van,
        DateOnly tot,
        CancellationToken cancellationToken = default)
    {
        var (klas, schooljaar) = await LaadKlasAsync(klasId, cancellationToken);
        var (jaarplan, plaatsing) = await LaadPlaatsingAsync(klasId, plaatsingId, cancellationToken);
        var kalender = new Themakalender(schooljaar);
        var themas = await _opslag.LaadThemasAsync(cancellationToken);

        await HerplanAsync(kalender, schooljaar, themas, jaarplan, plaatsing, van, tot, cancellationToken);

        return Projecteer(klas, schooljaar, themas, jaarplan);
    }

    /// <summary>
    /// Moves a placement to start on <paramref name="van"/>, keeping its number of schooldagen: the drag on the
    /// timeline, by mouse or keyboard (FR-6.2).
    /// <para>
    /// A dragged bar lands on a week, so a <paramref name="van"/> that is no schooldag moves forward to the next one.
    /// The end is the day on which the placement has as many schooldagen as before, walking over vacations; the result is
    /// split at every vacation like any other change.
    /// </para>
    /// </summary>
    /// <exception cref="OngeldigePlaatsingFout">The new days leave the year or are taken.</exception>
    /// <exception cref="SchoolcontentNietGevondenFout">The class, its plan or the placement does not exist.</exception>
    public async Task<JaarplanWeergave> VerschuifAsync(
        Guid klasId,
        Guid plaatsingId,
        DateOnly van,
        CancellationToken cancellationToken = default)
    {
        var (klas, schooljaar) = await LaadKlasAsync(klasId, cancellationToken);
        var (jaarplan, plaatsing) = await LaadPlaatsingAsync(klasId, plaatsingId, cancellationToken);
        var kalender = new Themakalender(schooljaar);
        var themas = await _opslag.LaadThemasAsync(cancellationToken);

        if (van < schooljaar.Start || van > schooljaar.Eind)
        {
            throw OngeldigePlaatsingFout.BuitenSchooljaar(kalender.EersteSchooldag, kalender.LaatsteSchooldag);
        }

        var nieuweVan = kalender.VolgendeSchooldag(van)
            ?? throw OngeldigePlaatsingFout.BuitenSchooljaar(kalender.EersteSchooldag, kalender.LaatsteSchooldag);
        var schooldagen = Math.Max(1, kalender.TelSchooldagen(plaatsing.Van, plaatsing.Tot));
        var nieuweTot = kalender.EindeNaSchooldagen(nieuweVan, schooldagen);

        await HerplanAsync(kalender, schooljaar, themas, jaarplan, plaatsing, nieuweVan, nieuweTot, cancellationToken);

        return Projecteer(klas, schooljaar, themas, jaarplan);
    }

    /// <summary>
    /// Records the teacher's decision on a proposed placement (Art. IV.1/IV.2): accept it, or take it as their own.
    /// <para>
    /// <b>Rejecting is not a status any more</b> (ADR-0053 R12): a teacher rejects a proposal by removing it, so a
    /// rejected placement cannot sit on the timeline holding days that no other thema may use.
    /// </para>
    /// </summary>
    /// <exception cref="OngeldigePlaatsingsstatusFout"><paramref name="status"/> is not aanvaard or manueel.</exception>
    /// <exception cref="SchoolcontentNietGevondenFout">The class or the placement does not exist.</exception>
    public Task<JaarplanWeergave> WijzigPlaatsingStatusAsync(
        Guid klasId,
        Guid plaatsingId,
        KoppelingStatus status,
        CancellationToken cancellationToken = default)
    {
        if (status is not (KoppelingStatus.Aanvaard or KoppelingStatus.Manueel))
        {
            throw new OngeldigePlaatsingsstatusFout(
                $"Status '{status}' is geen beslissing die hier kan; kies aanvaard of manueel. " +
                "Een voorstel weigeren doe je door het te verwijderen.");
        }

        return MuteerAsync(klasId, plaatsingId, plaatsing => plaatsing.WijzigStatus(status), cancellationToken);
    }

    /// <summary>Locks or unlocks a placement against (re)generation (Art. IX.3 <c>vergrendeld</c>).</summary>
    /// <exception cref="SchoolcontentNietGevondenFout">The class or the placement does not exist.</exception>
    public Task<JaarplanWeergave> WijzigVergrendelingAsync(
        Guid klasId,
        Guid plaatsingId,
        bool vergrendeld,
        CancellationToken cancellationToken = default) =>
        MuteerAsync(klasId, plaatsingId, plaatsing => plaatsing.StelVergrendelingIn(vergrendeld), cancellationToken);

    /// <summary>
    /// Removes one placement, whatever its status or lock (FR-7): an explicit teacher action is the one actor
    /// Art. IV.2 allows to discard a human decision. It is also how a proposal is rejected. Only this part goes: the
    /// other parts of its thema stay.
    /// </summary>
    /// <exception cref="SchoolcontentNietGevondenFout">The class, its plan or the placement does not exist.</exception>
    public async Task<JaarplanWeergave> VerwijderPlaatsingAsync(
        Guid klasId,
        Guid plaatsingId,
        CancellationToken cancellationToken = default)
    {
        var (klas, schooljaar) = await LaadKlasAsync(klasId, cancellationToken);
        var (jaarplan, plaatsing) = await LaadPlaatsingAsync(klasId, plaatsingId, cancellationToken);

        jaarplan.VerwijderPlaatsing(plaatsing);
        await _opslag.BewaarAsync(cancellationToken);

        var themas = await _opslag.LaadThemasAsync(cancellationToken);

        return Projecteer(klas, schooljaar, themas, jaarplan);
    }

    private async Task HerplanAsync(
        Themakalender kalender,
        Schooljaar schooljaar,
        IReadOnlyList<Thema> themas,
        Jaarplan jaarplan,
        Themaplaatsing plaatsing,
        DateOnly van,
        DateOnly tot,
        CancellationToken cancellationToken)
    {
        var delen = Delen(kalender, schooljaar, van, tot);

        var ongewijzigd = delen.Count == 1
            && delen[0] == (plaatsing.Van, plaatsing.Tot)
            && !kalender.IsVervallen(plaatsing.Van, plaatsing.Tot);
        if (ongewijzigd)
        {
            return;
        }

        ControleerVrij(jaarplan, themas, delen, behalve: plaatsing.Id);

        jaarplan.HerplanPlaatsing(plaatsing, delen[0].Van, delen[0].Tot);
        foreach (var (deelVan, deelTot) in delen.Skip(1))
        {
            jaarplan.VoegPlaatsingToe(plaatsing.ThemaId, deelVan, deelTot, KoppelingStatus.Manueel);
        }

        await _opslag.BewaarAsync(cancellationToken);
    }

    private static EindvoorstelWeergave Voorstel(
        Themakalender kalender,
        Schooljaar schooljaar,
        IReadOnlyList<Thema> themas,
        Jaarplan? jaarplan,
        Thema thema,
        DateOnly van)
    {
        ControleerBegin(kalender, schooljaar, van);

        if (jaarplan?.Overlappend(van, van) is { } bezet)
        {
            throw OngeldigePlaatsingFout.Overlapt(ThemaNaam(themas, bezet.ThemaId), bezet.Van, bezet.Tot);
        }

        var tot = kalender.VoorgesteldEinde(van, thema.DuurWeken, out var afgekapt);
        string? beperktDoor = afgekapt ? BeperktDoorSchooljaar : null;
        string? volgendThemaNaam = null;

        var volgende = jaarplan?.Plaatsingen.FirstOrDefault(p => p.Van > van);
        if (volgende is not null && volgende.Van <= tot)
        {
            tot = kalender.VorigeSchooldag(volgende.Van.AddDays(-1)) ?? van;
            beperktDoor = BeperktDoorVolgendThema;
            volgendThemaNaam = ThemaNaam(themas, volgende.ThemaId);
        }

        var delen = kalender.Splits(van, tot)
            .Select(deel => new DeelWeergave(deel.Van, deel.Tot))
            .ToList();

        return new EindvoorstelWeergave(van, tot, delen, beperktDoor, volgendThemaNaam);
    }

    /// <summary>
    /// Checks a requested range and cuts it into the parts that will be stored: the first day must be a schooldag
    /// inside the year, the end not before it; an end after the year is cut to the last schooldag (ADR-0053 R5).
    /// </summary>
    private static IReadOnlyList<(DateOnly Van, DateOnly Tot)> Delen(
        Themakalender kalender,
        Schooljaar schooljaar,
        DateOnly van,
        DateOnly tot)
    {
        if (tot < van)
        {
            throw OngeldigePlaatsingFout.EindeVoorBegin();
        }

        ControleerBegin(kalender, schooljaar, van);

        var einde = tot > kalender.LaatsteSchooldag ? kalender.LaatsteSchooldag : tot;
        var delen = kalender.Splits(van, einde);

        return delen.Count == 0 ? throw OngeldigePlaatsingFout.GeenSchooldagen() : delen;
    }

    private static void ControleerBegin(Themakalender kalender, Schooljaar schooljaar, DateOnly van)
    {
        if (van < schooljaar.Start || van > schooljaar.Eind)
        {
            throw OngeldigePlaatsingFout.BuitenSchooljaar(kalender.EersteSchooldag, kalender.LaatsteSchooldag);
        }

        if (!kalender.IsSchooldag(van))
        {
            throw OngeldigePlaatsingFout.GeenSchooldag(van);
        }
    }

    private static void ControleerVrij(
        Jaarplan? jaarplan,
        IReadOnlyList<Thema> themas,
        IReadOnlyList<(DateOnly Van, DateOnly Tot)> delen,
        Guid? behalve)
    {
        if (jaarplan is null)
        {
            return;
        }

        foreach (var (van, tot) in delen)
        {
            if (jaarplan.Overlappend(van, tot, behalve) is { } bezet)
            {
                throw OngeldigePlaatsingFout.Overlapt(ThemaNaam(themas, bezet.ThemaId), bezet.Van, bezet.Tot);
            }
        }
    }

    private async Task<JaarplanWeergave> MuteerAsync(
        Guid klasId,
        Guid plaatsingId,
        Action<Themaplaatsing> mutatie,
        CancellationToken cancellationToken)
    {
        var (klas, schooljaar) = await LaadKlasAsync(klasId, cancellationToken);
        var (jaarplan, plaatsing) = await LaadPlaatsingAsync(klasId, plaatsingId, cancellationToken);

        mutatie(plaatsing);
        await _opslag.BewaarAsync(cancellationToken);

        var themas = await _opslag.LaadThemasAsync(cancellationToken);

        return Projecteer(klas, schooljaar, themas, jaarplan);
    }

    private async Task<(Klas Klas, Schooljaar Schooljaar)> LaadKlasAsync(
        Guid klasId,
        CancellationToken cancellationToken) =>
        await _opslag.LaadKlasMetSchooljaarAsync(klasId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Klas {klasId} is niet gevonden.");

    private async Task<(Jaarplan Jaarplan, Themaplaatsing Plaatsing)> LaadPlaatsingAsync(
        Guid klasId,
        Guid plaatsingId,
        CancellationToken cancellationToken)
    {
        var jaarplan = await _opslag.LaadJaarplanAsync(klasId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Klas {klasId} heeft nog geen jaarplan.");

        var plaatsing = jaarplan.VindPlaatsing(plaatsingId)
            ?? throw new SchoolcontentNietGevondenFout(
                $"Themaplaatsing {plaatsingId} bestaat niet in het jaarplan van klas {klasId}.");

        return (jaarplan, plaatsing);
    }

    private Jaarplan MaakJaarplan(Guid klasId)
    {
        // One jaarplan per klas (Art. IX.3), created lazily on the first placement so a fresh class carries no empty row.
        var jaarplan = new Jaarplan(klasId);
        _opslag.VoegJaarplanToe(jaarplan);

        return jaarplan;
    }

    private static Thema VindThema(IReadOnlyList<Thema> themas, Guid themaId) =>
        themas.FirstOrDefault(t => t.Id == themaId)
            ?? throw new SchoolcontentNietGevondenFout($"Thema {themaId} is niet gevonden.");

    private static string ThemaNaam(IReadOnlyList<Thema> themas, Guid themaId) =>
        themas.FirstOrDefault(t => t.Id == themaId)?.Naam ?? "onbekend thema";

    /// <summary>
    /// Projects the persisted plan for the screen: each placement with its run and whether it still fits, every lesweek
    /// with whether a thema runs in it, and the balance (ADR-0053 decision 6).
    /// </summary>
    private static JaarplanWeergave Projecteer(
        Klas klas,
        Schooljaar schooljaar,
        IReadOnlyList<Thema> themas,
        Jaarplan? jaarplan)
    {
        var kalender = new Themakalender(schooljaar);
        var themaPerId = themas.ToDictionary(t => t.Id);
        var plaatsingen = jaarplan?.Plaatsingen ?? [];

        var reeksPerPlaatsing = new Dictionary<Guid, ReeksWeergave>();
        foreach (var reeks in Themareeks.Bepaal(plaatsingen, kalender))
        {
            var duur = themaPerId.GetValueOrDefault(reeks.ThemaId)?.DuurWeken ?? 0;
            var eindeAangepast = false;
            var stopt = false;
            if (duur > 0)
            {
                var voorgesteld = kalender.VoorgesteldEinde(reeks.Van, duur, out var afgekapt);
                eindeAangepast = reeks.Tot != voorgesteld;
                stopt = afgekapt && reeks.Tot == kalender.LaatsteSchooldag;
            }

            var weken = kalender.VolleLesweken(reeks.Van, reeks.Tot);
            for (var index = 0; index < reeks.Delen.Count; index++)
            {
                reeksPerPlaatsing[reeks.Delen[index].Id] = new ReeksWeergave(
                    Deel: index + 1,
                    AantalDelen: reeks.Delen.Count,
                    ReeksVan: reeks.Van,
                    ReeksTot: reeks.Tot,
                    Weken: weken,
                    EindeAangepast: eindeAangepast,
                    StoptBijEindeSchooljaar: stopt);
            }
        }

        var weergaven = plaatsingen
            .Select(p =>
            {
                var thema = themaPerId.GetValueOrDefault(p.ThemaId);

                return new ThemaplaatsingWeergave(
                    p.Id,
                    p.ThemaId,
                    thema?.Naam ?? string.Empty,
                    p.Van,
                    p.Tot,
                    IsVervallen: kalender.IsVervallen(p.Van, p.Tot),
                    p.Status.ToString(),
                    p.AiMotivatie,
                    p.Vergrendeld,
                    thema is null ? [] : JaarplanGeneratiePromptBuilder.ThemaDoelcodes(thema),
                    thema?.DuurWeken ?? 0,
                    reeksPerPlaatsing.GetValueOrDefault(p.Id),
                    thema?.Icoon);
            })
            .ToList();

        var gepland = plaatsingen.Where(p => p.IsGepland).ToList();
        var lesweken = kalender.Lesweken()
            .Select(maandag => new LesweekWeergave(
                maandag,
                gepland.Any(p => p.Overlapt(maandag, maandag.AddDays(4)))))
            .ToList();
        var metThema = lesweken.Count(w => w.HeeftThema);

        return new JaarplanWeergave(
            klas.Id,
            klas.Naam,
            schooljaar.Id,
            schooljaar.Naam,
            kalender.EersteSchooldag,
            kalender.LaatsteSchooldag,
            weergaven,
            lesweken,
            new JaarbalansWeergave(lesweken.Count, metThema, lesweken.Count - metThema));
    }
}
