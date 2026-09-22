using Jaarplanner.Application.Dekking;
using Jaarplanner.Application.Kat;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;

namespace Jaarplanner.UnitTests.Kat;

/// <summary>
/// What the two dekking detectors are tested against (FB-069). No database and <b>no AI client</b>: detection is
/// deterministic (ADR-0059 K1), which is what the ticket asks to be proven.
/// </summary>
internal sealed class NepJaarplanlezer(JaarplanWeergave plan) : IJaarplanLezer
{
    public Task<JaarplanWeergave> HaalJaarplanAsync(Guid klasId, CancellationToken cancellationToken = default) =>
        Task.FromResult(plan);
}

internal sealed class NepKatplanbron : IKatplanbron
{
    public List<Themadrager> Dragers { get; init; } = [];

    public List<Katsubthema> Subthemas { get; init; } = [];

    public Schooljaar? Schooljaar { get; init; }

    public Task<IReadOnlyList<Themadrager>> HaalThemadragersAsync(CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<Themadrager>>(Dragers);

    public Task<IReadOnlyList<Katsubthema>> HaalSubthemasAsync(Guid klasId, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<Katsubthema>>(Subthemas);

    public Task<Schooljaar?> HaalSchooljaarAsync(Guid klasId, CancellationToken ct) =>
        Task.FromResult(Schooljaar);
}

/// <summary>
/// Builds the two read models the detectors take, with everything they do not look at filled in. Keeping the noise
/// here is what lets a test say only what it is about.
/// </summary>
internal static class Detectorbouw
{
    public static readonly Guid Klas = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public static readonly Guid Juf = Guid.Parse("22222222-2222-2222-2222-222222222222");

    /// <summary>A klas whose leeftijden are known. Leaving them out means K3, not "unknown".</summary>
    public static Katcontext Context(
        DekkingWeergave dekking,
        DateOnly vandaag,
        IReadOnlyList<string>? leeftijden = null) =>
        new(Klas, leeftijden ?? ["K3"], [Juf], vandaag, _ => Task.FromResult(dekking));

    /// <summary>
    /// A klas whose leeftijden cannot be derived (Art. XIV, the graadklas): the <c>null</c> a detector must read as
    /// "widen, do not narrow". Its own helper, because a default argument would quietly turn it back into K3.
    /// </summary>
    public static Katcontext ContextZonderLeeftijd(DekkingWeergave dekking, DateOnly vandaag) =>
        new(Klas, null, [Juf], vandaag, _ => Task.FromResult(dekking));

    /// <summary>A dekking holding exactly these minimumdoelen and leerplandoelen.</summary>
    public static DekkingWeergave Dekking(
        IEnumerable<MinimumdoelDekking>? minimumdoelen = null,
        IEnumerable<LeerplandoelDekking>? doelen = null)
    {
        var mds = (minimumdoelen ?? []).ToList();
        var lds = (doelen ?? []).ToList();
        return new DekkingWeergave(
            Klas, "K3a", Guid.NewGuid(), "2026-2027",
            Dekkingsbereik.EigenJaarFase, ["K3"], ["K3"],
            IsTerugvalNaarHeelCurriculum: false,
            AantalBuitenBereik: 0,
            IsBetrouwbaar: true,
            AantalOnopgelosteVervallenPlaatsingen: 0,
            AantalGedekt: lds.Count(d => d.IsGedekt),
            AantalLeerplandoelen: lds.Count,
            Doelen: lds,
            AantalInPrognose: 0,
            AantalMinimumdoelenGedekt: mds.Count(m => m.IsGedekt),
            AantalMinimumdoelenInPrognose: mds.Count(m => m.Stap == Dekkingsstap.Prognose),
            AantalMinimumdoelen: mds.Count,
            Minimumdoelen: mds);
    }

    public static MinimumdoelDekking Minimumdoel(
        string doelRef,
        Dekkingsstap stap,
        string omschrijving = "Het kind telt tot tien.",
        Lacuneoorzaak? oorzaak = null) =>
        new(doelRef, "K-", doelRef, omschrijving, "Wiskunde", null, null,
            NietMeerInOpstap: false,
            Stap: stap,
            IsGedekt: stap == Dekkingsstap.Gedekt,
            PrognoseThemas: [],
            DekkendeThemas: [],
            Oorzaak: oorzaak,
            KandidaatThemas: []);

    public static LeerplandoelDekking Leerplandoel(string code, bool isGedekt) =>
        new(code, Doelsoort.Gemeenschappelijk, "K3", "9", "Natuur", "Water", "Drijven", $"Tekst van {code}",
            MinimumdoelRef: null,
            NietMeerInOpstap: false,
            IsGedekt: isGedekt,
            DekkendeThemas: [],
            DekkendeFiches: [],
            Oorzaak: null,
            KandidaatThemas: [],
            Stap: isGedekt ? Dekkingsstap.Gedekt : Dekkingsstap.Geen,
            PrognoseBronnen: [],
            DekkendeActiviteiten: []);

    /// <summary>A plan with these lesweken (each Monday, and whether a thema is aimed at it) and these placements.</summary>
    public static JaarplanWeergave Plan(
        IEnumerable<(DateOnly Maandag, bool HeeftThema)>? lesweken = null,
        IEnumerable<ThemaplaatsingWeergave>? plaatsingen = null)
    {
        var weken = (lesweken ?? []).Select(w => new LesweekWeergave(w.Maandag, w.HeeftThema)).ToList();
        return new JaarplanWeergave(
            Klas, "K3a", Guid.NewGuid(), "2026-2027",
            new DateOnly(2026, 9, 1), new DateOnly(2027, 6, 30),
            (plaatsingen ?? []).ToList(),
            weken,
            new JaarbalansWeergave(weken.Count, weken.Count(w => w.HeeftThema), weken.Count(w => !w.HeeftThema)));
    }

    public static ThemaplaatsingWeergave Plaatsing(
        Guid themaId,
        string naam,
        DateOnly van,
        DateOnly tot,
        bool isVervallen = false,
        ReeksWeergave? reeks = null,
        string status = "Aanvaard") =>
        new(Guid.NewGuid(), themaId, naam, van, tot, isVervallen, status, null, false, [], 4, reeks);

    /// <summary>A schooljaar with no closures: every weekday is a schooldag, which keeps a calendar test readable.</summary>
    public static Schooljaar Schooljaar() => new("2026-2027", new DateOnly(2026, 9, 1), new DateOnly(2027, 6, 30));
}
