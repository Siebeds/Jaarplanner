using Jaarplanner.Application.Kat.Chat;
using Jaarplanner.Application.Toegang;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Kat.Chat;

/// <summary>
/// A small school for the chat's lookups (FB-031): two thema's, K3 and K2 subthema's, a shared and an own activiteit,
/// an algemene fiche per klas, and an agenda. No real child's name, and no pupil data: the chat reads none.
/// </summary>
internal sealed class Chatschool : IKatopzoekbron
{
    public static readonly Guid Herfst = Guid.Parse("10000000-0000-0000-0000-000000000001");
    public static readonly Guid Water = Guid.Parse("10000000-0000-0000-0000-000000000002");
    public static readonly Guid Bladeren = Guid.Parse("20000000-0000-0000-0000-000000000001");
    public static readonly Guid BladerenK2 = Guid.Parse("20000000-0000-0000-0000-000000000002");
    public static readonly Guid Regen = Guid.Parse("20000000-0000-0000-0000-000000000003");
    public static readonly Guid BladerenSorteren = Guid.Parse("30000000-0000-0000-0000-000000000001");
    public static readonly Guid EigenPlassen = Guid.Parse("30000000-0000-0000-0000-000000000002");
    public static readonly Guid Regenmeter = Guid.Parse("30000000-0000-0000-0000-000000000003");
    public static readonly Guid K3Blauw = Guid.Parse("40000000-0000-0000-0000-000000000001");
    public static readonly Guid K3Groen = Guid.Parse("40000000-0000-0000-0000-000000000002");
    public static readonly Guid FicheOnthaal = Guid.Parse("50000000-0000-0000-0000-000000000001");
    public static readonly Guid FicheGroen = Guid.Parse("50000000-0000-0000-0000-000000000002");
    public static readonly Guid Collega = Guid.Parse("60000000-0000-0000-0000-000000000001");

    public static readonly Katdoel Sorteren = new("G-WO-01", Katdoelsoort.Leerplandoel, "Voorwerpen sorteren volgens kleur en vorm.");
    public static readonly Katdoel Meten = new("G-WI-02", Katdoelsoort.Leerplandoel, "Hoeveelheden vergelijken en meten.");
    public static readonly Katdoel Tellen = new("G-WI-03", Katdoelsoort.Leerplandoel, "Hoeveelheden tellen tot tien.");
    public static readonly Katdoel Seizoenen = new("MD-K-01", Katdoelsoort.Minimumdoel, "De kleuters herkennen seizoenen.");
    public static readonly Katdoel Weer = new("MD-K-02", Katdoelsoort.Minimumdoel, "De kleuters beschrijven het weer.");

    public List<Katdoel> Doelen { get; } = [Sorteren, Meten, Tellen, Seizoenen, Weer];

    public Katbibliotheek Bibliotheek { get; set; } = new(
        [new Chatthema(Herfst, "Herfst"), new Chatthema(Water, "Water")],
        [
            new Chatsubthema(Bladeren, Herfst, "Bladeren", "K3"),
            new Chatsubthema(BladerenK2, Herfst, "Bladeren", "K2"),
            new Chatsubthema(Regen, Water, "Regen", "K3"),
        ],
        [
            new Chatactiviteit(BladerenSorteren, Bladeren, "Bladeren sorteren", null),
            new Chatactiviteit(EigenPlassen, Regen, "Plassen springen", Collega),
            new Chatactiviteit(Regenmeter, Regen, "Regenmeter maken", null),
        ],
        [new Chatfiche(FicheOnthaal, K3Blauw, "Onthaal"), new Chatfiche(FicheGroen, K3Groen, "Turnen")],
        [
            new Katkoppeling(Kathouder.Thema, Herfst, Seizoenen.Code, Katdoelsoort.Minimumdoel, KoppelingStatus.Manueel),
            new Katkoppeling(Kathouder.Thema, Water, Weer.Code, Katdoelsoort.Minimumdoel, KoppelingStatus.Voorgesteld),
            new Katkoppeling(Kathouder.Subthema, Bladeren, Sorteren.Code, Katdoelsoort.Leerplandoel, KoppelingStatus.Aanvaard),
            new Katkoppeling(Kathouder.Subthema, BladerenK2, Meten.Code, Katdoelsoort.Leerplandoel, KoppelingStatus.Voorgesteld),
            new Katkoppeling(Kathouder.Subthema, Regen, Tellen.Code, Katdoelsoort.Leerplandoel, KoppelingStatus.Geweigerd),
            new Katkoppeling(Kathouder.Activiteit, BladerenSorteren, Sorteren.Code, Katdoelsoort.Leerplandoel, KoppelingStatus.Manueel),
            new Katkoppeling(Kathouder.Activiteit, EigenPlassen, Meten.Code, Katdoelsoort.Leerplandoel, KoppelingStatus.Aanvaard),
            new Katkoppeling(Kathouder.Activiteit, Regenmeter, Meten.Code, Katdoelsoort.Leerplandoel, KoppelingStatus.Aanvaard),
            new Katkoppeling(Kathouder.AlgemeneFiche, FicheOnthaal, Tellen.Code, Katdoelsoort.Leerplandoel, KoppelingStatus.Manueel),
            new Katkoppeling(Kathouder.AlgemeneFiche, FicheGroen, Tellen.Code, Katdoelsoort.Leerplandoel, KoppelingStatus.Manueel),
        ]);

    public Katagenda Agenda { get; set; } = new(
        [
            new Katthemaplaatsing(K3Blauw, Herfst, new DateOnly(2026, 10, 5), new DateOnly(2026, 10, 30), false),
            new Katthemaplaatsing(K3Groen, Herfst, new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 27), true),
        ],
        [new Katsubthemaplaatsing(K3Blauw, Bladeren, new DateOnly(2026, 10, 5), new DateOnly(2026, 10, 16))],
        [
            new Katactiviteitplaatsing(K3Blauw, EigenPlassen, new DateOnly(2026, 10, 7), false),
            new Katactiviteitplaatsing(K3Groen, Regenmeter, new DateOnly(2026, 10, 8), false),
        ],
        [new Katficheplaatsing(K3Blauw, FicheOnthaal, new DateOnly(2026, 9, 1), new DateOnly(2027, 6, 30))]);

    /// <summary>The klas ids the agenda was last asked for, or null when it was never asked.</summary>
    public IReadOnlyCollection<Guid>? GevraagdeAgenda { get; private set; }

    public Task<Katbibliotheek> HaalBibliotheekAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(Bibliotheek);

    public Task<IReadOnlyList<Katdoel>> ZoekDoelenAsync(string term, int max, CancellationToken cancellationToken = default)
    {
        var opCode = Doelen.Where(d => string.Equals(d.Code, term.Trim(), StringComparison.OrdinalIgnoreCase)).ToList();
        if (opCode.Count > 0)
        {
            return Task.FromResult<IReadOnlyList<Katdoel>>(opCode);
        }

        var woorden = term.Split(' ', StringSplitOptions.RemoveEmptyEntries).Where(w => w.Length >= 3).ToList();
        var gevonden = woorden.Count == 0
            ? []
            : Doelen.Where(d => woorden.All(w => d.Tekst.Contains(w, StringComparison.OrdinalIgnoreCase))).Take(max).ToList();
        return Task.FromResult<IReadOnlyList<Katdoel>>(gevonden);
    }

    public Task<IReadOnlyList<Katdoel>> HaalDoelenAsync(IReadOnlyCollection<string> codes, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Katdoel>>(Doelen.Where(d => codes.Contains(d.Code)).ToList());

    public Task<Katagenda> HaalAgendaAsync(IReadOnlyCollection<Guid> klasIds, CancellationToken cancellationToken = default)
    {
        GevraagdeAgenda = klasIds;
        return Task.FromResult(Agenda);
    }

    /// <summary>A leerkracht of <paramref name="leeftijd"/> who reads the given klassen.</summary>
    public static Katlezer Leerkracht(string leeftijd, params Guid[] klassen) =>
        new(new Rechten(Guid.NewGuid(), false, false, [], [leeftijd], klassen), Klassen(klassen));

    public static Katlezer Admin() =>
        new(new Rechten(Guid.NewGuid(), true, false, [], [], []), Klassen(K3Blauw, K3Groen));

    private static List<Chatklas> Klassen(params Guid[] ids) =>
        ids.Select(id => new Chatklas(id, id == K3Blauw ? "K3 Blauw" : "K3 Groen")).ToList();
}
