using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Dekking;

/// <summary>
/// Computes one class's dekking (FR-9.1, FR-9.3, Art. V.1) — <b>the highest-risk logic in the system together with
/// the Op.stap import</b> (Art. V.6), which is why every rule it applies is stated here and pinned by a test rather
/// than left to be inferred from the code.
/// <para>
/// <b>Two steps, both computed, never stored</b> (ADR-0047). Every goal gets a <see cref="Dekkingsstap"/>:
/// </para>
/// <list type="bullet">
/// <item>A <b>minimumdoel</b> is in the prognose when it is a themadoel of a thema, and gedekt when such a thema is
/// placed. Nothing else makes it either (D2).</item>
/// <item>A <b>leerplandoel</b> is in the prognose when a subdoel or activiteit link of a subthema at the klas's
/// leeftijd carries it (D3, S1); it is gedekt when that subthema is placed in the klas's agenda, or when a planned
/// algemene fiche carries it (D4). An own activiteit's link never counts through its subthema: it is in the prognose of
/// its owner's klassen and of a klas that plans it, and gedekt where it is planned (ADR-0049 D7). A thema's
/// doelsuggestie proposes a minimumdoel and never reaches a leerplandoel (ADR-0050).</item>
/// </list>
/// <para>
/// A thema counts as placed when its placement is <c>aanvaard</c> or <c>manueel</c> and not stale (S3). It reads the
/// plan through <see cref="IJaarplanLezer"/> — the same projection the teacher's calendar shows — so coverage and the
/// stale-placement notice cannot disagree about which placements are broken.
/// </para>
/// </summary>
public sealed class DekkingService
{
    private readonly IJaarplanLezer _lezer;
    private readonly IDekkingOpslag _opslag;

    public DekkingService(IJaarplanLezer lezer, IDekkingOpslag opslag)
    {
        _lezer = lezer;
        _opslag = opslag;
    }

    /// <summary>
    /// Computes the coverage of one class.
    /// </summary>
    /// <param name="klasId">The class to compute coverage for.</param>
    /// <param name="bereik">
    /// Which goals to measure against (owner ruling 2026-08-04): the class's own jaar/fase and mijlpaal by default, or
    /// the whole curriculum.
    /// </param>
    /// <param name="jaarFase">
    /// Narrow <see cref="Dekkingsbereik.EigenJaarFase"/> to this one code, when the class has more than one available.
    /// Ignored when null, when the scope is the whole curriculum, or when the code is not one this class could be
    /// measured against; <c>GemetenJaarFasen</c> reports what was applied.
    /// </param>
    /// <param name="cancellationToken">Cancellation.</param>
    /// <exception cref="Jaarplanner.Application.Schoolcontent.Beheer.SchoolcontentNietGevondenFout">
    /// The class does not exist. A class that exists but has never generated a plan is <b>not</b> an error.
    /// </exception>
    public async Task<DekkingWeergave> BerekenAsync(
        Guid klasId,
        Dekkingsbereik bereik = Dekkingsbereik.EigenJaarFase,
        string? jaarFase = null,
        CancellationToken cancellationToken = default)
    {
        var plan = await _lezer.HaalJaarplanAsync(klasId, cancellationToken);
        var geplaatsteThemaIds = Themaplaatsingen(plan, TeltVoorDekking);
        var scope = await BepaalBereikAsync(klasId, bereik, jaarFase, cancellationToken);
        var kandidaten = await _opslag.HaalKandidaatKoppelingenAsync(klasId, cancellationToken);
        var bronnen = await HaalBronnenAsync(klasId, cancellationToken);

        var kandidatenPerCode = kandidaten
            .GroupBy(k => k.LeerplandoelCode, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<KandidaatKoppeling>)g.ToList(), StringComparer.Ordinal);

        // A lacune's cheapest route is found by how this plan treats the thema's that could close it (E5-05).
        var voorstelbareThemaIds = Themaplaatsingen(plan, IsVoorstelbaar).ToHashSet();
        var geweigerdeThemaIds = Themaplaatsingen(plan, IsGeweigerd).ToHashSet();
        var disciplinenamen = await _opslag.HaalDisciplinenamenAsync(cancellationToken);

        var doelen = scope.Leerplandoelen
            .Select(l =>
            {
                var dekkendeThemas = bronnen.DekkendPerCode.GetValueOrDefault(l.Code, []);
                var dekkendeFiches = bronnen.FichesPerCode.GetValueOrDefault(l.Code, []);
                var dekkendeActiviteiten = bronnen.EigenActiviteitenPerCode.GetValueOrDefault(l.Code, []);
                var prognose = bronnen.PrognosePerCode.GetValueOrDefault(l.Code, []);
                var stap = dekkendeThemas.Count > 0 || dekkendeFiches.Count > 0 || dekkendeActiviteiten.Count > 0
                    ? Dekkingsstap.Gedekt
                    : prognose.Count > 0 ? Dekkingsstap.Prognose : Dekkingsstap.Geen;
                var lacune = stap == Dekkingsstap.Gedekt
                    ? (Oorzaak: (Lacuneoorzaak?)null, Themas: (IReadOnlyList<string>)[])
                    : BepaalOorzaak(kandidatenPerCode.GetValueOrDefault(l.Code, []), prognose);

                return new LeerplandoelDekking(
                    l.Code,
                    l.Doelsoort,
                    l.JaarFase,
                    l.DisciplineNummer,
                    disciplinenamen.GetValueOrDefault(l.DisciplineNummer),
                    l.Domein,
                    l.Subdomein,
                    l.Tekst,
                    l.MinimumdoelRef,
                    l.NietMeerInOpstap,
                    IsGedekt: stap == Dekkingsstap.Gedekt,
                    dekkendeThemas,
                    dekkendeFiches,
                    lacune.Oorzaak,
                    lacune.Themas,
                    stap,
                    prognose,
                    dekkendeActiviteiten);
            })
            .OrderBy(d => d.Domein, StringComparer.Ordinal)
            .ThenBy(d => d.Subdomein, StringComparer.Ordinal)
            .ThenBy(d => d.Code, StringComparer.Ordinal)
            .ToList();

        var minimumdoelen = await BerekenMinimumdoelenAsync(
            scope, geplaatsteThemaIds.ToHashSet(), voorstelbareThemaIds, geweigerdeThemaIds, cancellationToken);

        // Directie 2026-07-28: an unresolved stale placement withholds every figure, since a thema whose period is
        // unknown is not demonstrably taught. The lists stay: they are what a teacher uses to fix it.
        var onopgeloste = TelOnopgelosteVervallen(plan);
        var isBetrouwbaar = onopgeloste == 0;

        return new DekkingWeergave(
            plan.KlasId,
            plan.KlasNaam,
            plan.SchooljaarId,
            plan.SchooljaarNaam,
            scope.ToegepastBereik,
            scope.GemetenFasen ?? [],
            scope.BeschikbareFasen ?? [],
            scope.IsTerugval,
            scope.AantalBuitenBereik,
            isBetrouwbaar,
            onopgeloste,
            AantalGedekt: isBetrouwbaar ? doelen.Count(d => d.Stap == Dekkingsstap.Gedekt) : null,
            doelen.Count,
            doelen,
            AantalInPrognose: isBetrouwbaar ? doelen.Count(d => d.Stap == Dekkingsstap.Prognose) : null,
            AantalMinimumdoelenGedekt: isBetrouwbaar ? minimumdoelen.Count(m => m.Stap == Dekkingsstap.Gedekt) : null,
            AantalMinimumdoelenInPrognose: isBetrouwbaar ? minimumdoelen.Count(m => m.Stap == Dekkingsstap.Prognose) : null,
            minimumdoelen.Count,
            minimumdoelen);
    }

    /// <summary>
    /// The plan's coverage <b>now</b> beside what it would be if every proposed thema placement were accepted
    /// (E4-06). Only the leerplandoel figures: this is the generation's report, and it asks what the plan could do.
    /// <para>
    /// Under Art. V.1 no thema placement reaches a leerplandoel any more (ADR-0050): the subthema, own activiteit and fiche
    /// routes do not depend on it, so the two figures are equal. The shape stays, so the report keeps working; whether it should
    /// count minimumdoelen instead is an open question for the owner.
    /// </para>
    /// </summary>
    public async Task<Dekkingsvooruitzicht> BerekenVooruitzichtAsync(
        Guid klasId,
        Dekkingsbereik bereik = Dekkingsbereik.EigenJaarFase,
        string? jaarFase = null,
        CancellationToken cancellationToken = default)
    {
        var plan = await _lezer.HaalJaarplanAsync(klasId, cancellationToken);
        var scope = await BepaalBereikAsync(klasId, bereik, jaarFase, cancellationToken);

        var gedekteCodes = new HashSet<string>(StringComparer.Ordinal);
        gedekteCodes.UnionWith((await _opslag.HaalFichekoppelingenAsync(klasId, cancellationToken)).Select(k => k.LeerplandoelCode));
        gedekteCodes.UnionWith((await _opslag.HaalSubthemakoppelingenAsync(klasId, cancellationToken))
            .Where(k => k.IsIngepland)
            .Select(k => k.LeerplandoelCode));
        gedekteCodes.UnionWith((await _opslag.HaalEigenActiviteitkoppelingenAsync(klasId, cancellationToken))
            .Where(k => k.IsIngepland)
            .Select(k => k.LeerplandoelCode));

        // Counted over the goals in scope, never over the links: a link to a goal outside the scope raises nothing.
        var nuGedekt = scope.Leerplandoelen.Count(l => gedekteCodes.Contains(l.Code));
        var mogelijkGedekt = nuGedekt;

        var onopgeloste = TelOnopgelosteVervallen(plan);
        var isBetrouwbaar = onopgeloste == 0;

        return new Dekkingsvooruitzicht(
            scope.ToegepastBereik,
            scope.GemetenFasen ?? [],
            scope.IsTerugval,
            scope.AantalBuitenBereik,
            isBetrouwbaar,
            onopgeloste,
            AantalGedekt: isBetrouwbaar ? nuGedekt : null,
            AantalMogelijkGedekt: isBetrouwbaar ? mogelijkGedekt : null,
            scope.Leerplandoelen.Count);
    }

    private async Task<Bronnen> HaalBronnenAsync(Guid klasId, CancellationToken cancellationToken)
    {
        var subthemas = await _opslag.HaalSubthemakoppelingenAsync(klasId, cancellationToken);
        var fiches = await _opslag.HaalFichekoppelingenAsync(klasId, cancellationToken);
        var eigen = await _opslag.HaalEigenActiviteitkoppelingenAsync(klasId, cancellationToken);

        var dekkend = subthemas.Where(k => k.IsIngepland).Select(k => (k.LeerplandoelCode, Naam: Subthemanaam(k)));

        // The prognose is what the school's content aims at, placed or not: every decided subthema link at the klas's
        // leeftijd (S1), and every own activiteit that concerns the klas (ADR-0049 D7).
        var prognose = subthemas.Select(k => (k.LeerplandoelCode, Naam: Subthemanaam(k)))
            .Concat(eigen.Select(k => (k.LeerplandoelCode, Naam: EigenActiviteitnaam(k))));

        return new Bronnen(
            NamenPerCode(dekkend, r => r.LeerplandoelCode, r => r.Naam),
            NamenPerCode(fiches, k => k.LeerplandoelCode, k => k.FicheNaam),
            NamenPerCode(prognose, r => r.LeerplandoelCode, r => r.Naam),
            NamenPerCode(eigen.Where(k => k.IsIngepland), k => k.LeerplandoelCode, k => k.ActiviteitNaam));
    }

    private sealed record Bronnen(
        Dictionary<string, IReadOnlyList<string>> DekkendPerCode,
        Dictionary<string, IReadOnlyList<string>> FichesPerCode,
        Dictionary<string, IReadOnlyList<string>> PrognosePerCode,
        Dictionary<string, IReadOnlyList<string>> EigenActiviteitenPerCode);

    /// <summary>
    /// How an own activiteit is named as a prognose source: its name, marked as an own activiteit, so it is never read as
    /// a thema or a subthema (ADR-0049 D7).
    /// </summary>
    private static string EigenActiviteitnaam(EigenActiviteitkoppeling koppeling) => $"{koppeling.ActiviteitNaam} (eigen activiteit)";

    /// <summary>How a subthema is named as evidence: its own name, with its thema, since two thema's may share one.</summary>
    private static string Subthemanaam(Subthemakoppeling koppeling) => $"{koppeling.SubthemaNaam} ({koppeling.ThemaNaam})";

    private async Task<IReadOnlyList<MinimumdoelDekking>> BerekenMinimumdoelenAsync(
        Bereikuitkomst scope,
        IReadOnlySet<Guid> geplaatsteThemaIds,
        IReadOnlySet<Guid> voorstelbareThemaIds,
        IReadOnlySet<Guid> geweigerdeThemaIds,
        CancellationToken cancellationToken)
    {
        var mijlpalen = scope.GemetenFasen is null ? null : Jaarfasen.MijlpalenVoor(scope.GemetenFasen);
        var minimumdoelen = await _opslag.HaalMinimumdoelenAsync(mijlpalen, cancellationToken);
        var koppelingenPerRef = (await _opslag.HaalThemaMinimumdoelenAsync(cancellationToken))
            .GroupBy(k => k.MinimumdoelRef, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.Ordinal);

        return minimumdoelen
            .Select(m =>
            {
                var koppelingen = koppelingenPerRef.GetValueOrDefault(m.Ref, []);
                var prognose = Namen(koppelingen.Select(k => k.ThemaNaam));
                var dekkend = Namen(koppelingen.Where(k => geplaatsteThemaIds.Contains(k.ThemaId)).Select(k => k.ThemaNaam));
                var stap = dekkend.Count > 0
                    ? Dekkingsstap.Gedekt
                    : prognose.Count > 0 ? Dekkingsstap.Prognose : Dekkingsstap.Geen;
                var lacune = stap switch
                {
                    Dekkingsstap.Gedekt => (Oorzaak: (Lacuneoorzaak?)null, Themas: (IReadOnlyList<string>)[]),
                    Dekkingsstap.Prognose => OorzaakVanThemas(koppelingen, voorstelbareThemaIds, geweigerdeThemaIds),
                    _ => (Oorzaak: Lacuneoorzaak.GeenThema, Themas: []),
                };

                return new MinimumdoelDekking(
                    m.Ref,
                    m.Leeftijd,
                    m.Nr,
                    m.Omschrijving,
                    m.Leergebied,
                    m.Rubriek,
                    m.Subrubriek,
                    m.NietMeerInOpstap,
                    stap,
                    IsGedekt: stap == Dekkingsstap.Gedekt,
                    prognose,
                    dekkend,
                    lacune.Oorzaak,
                    lacune.Themas);
            })
            .OrderBy(m => m.Leergebied is null)
            .ThenBy(m => m.Leergebied, StringComparer.Ordinal)
            .ThenBy(m => m.Rubriek, StringComparer.Ordinal)
            .ThenBy(m => m.Subrubriek, StringComparer.Ordinal)
            .ThenBy(m => m.Ref, StringComparer.Ordinal)
            .ToList();
    }

    /// <summary>
    /// Why a minimumdoel in the prognose is not gedekt: the cheapest route among the thema's it is a themadoel of,
    /// in the order of <see cref="Lacuneoorzaak"/>.
    /// </summary>
    private static (Lacuneoorzaak? Oorzaak, IReadOnlyList<string> Themas) OorzaakVanThemas(
        IReadOnlyList<Themaminimumdoelkoppeling> koppelingen,
        IReadOnlySet<Guid> voorstelbareThemaIds,
        IReadOnlySet<Guid> geweigerdeThemaIds)
    {
        var wachtend = Namen(koppelingen.Where(k => voorstelbareThemaIds.Contains(k.ThemaId)).Select(k => k.ThemaNaam));
        if (wachtend.Count > 0)
        {
            return (Lacuneoorzaak.WachtOpBeslissing, wachtend);
        }

        var geweigerd = Namen(koppelingen.Where(k => geweigerdeThemaIds.Contains(k.ThemaId)).Select(k => k.ThemaNaam));
        return geweigerd.Count > 0
            ? (Lacuneoorzaak.PlaatsingGeweigerd, geweigerd)
            : (Lacuneoorzaak.NietIngepland, Namen(koppelingen.Select(k => k.ThemaNaam)));
    }

    /// <summary>
    /// Classifies why a leerplandoel is not gedekt, taking the first cause that applies in the order of
    /// <see cref="Lacuneoorzaak"/>: the cheapest route to closing it (E5-05). No thema placement reaches a leerplandoel
    /// (ADR-0050), so the two causes about one, <see cref="Lacuneoorzaak.WachtOpBeslissing"/> and
    /// <see cref="Lacuneoorzaak.PlaatsingGeweigerd"/>, apply to minimumdoelen only.
    /// <list type="number">
    /// <item><see cref="Lacuneoorzaak.NietIngepland"/>: in the prognose, so a subthema aims at it, and the agenda does
    /// not hold it; names every prognose source.</item>
    /// <item><see cref="Lacuneoorzaak.KoppelingNietBeslist"/>: only undecided links carry it.</item>
    /// <item><see cref="Lacuneoorzaak.GeenThema"/>: nothing carries it.</item>
    /// </list>
    /// </summary>
    private static (Lacuneoorzaak Oorzaak, IReadOnlyList<string> Themas) BepaalOorzaak(
        IReadOnlyList<KandidaatKoppeling> kandidaten,
        IReadOnlyList<string> prognose)
    {
        if (prognose.Count > 0)
        {
            return (Lacuneoorzaak.NietIngepland, prognose);
        }

        var onbeslist = Namen(kandidaten.Where(k => !k.IsBeslist).Select(k => k.ThemaNaam));
        return onbeslist.Count > 0
            ? (Lacuneoorzaak.KoppelingNietBeslist, onbeslist)
            : (Lacuneoorzaak.GeenThema, []);
    }

    private static IReadOnlyList<string> Namen(IEnumerable<string> namen) =>
        namen
            .Distinct(StringComparer.Ordinal)
            .OrderBy(naam => naam, StringComparer.Ordinal)
            .ToList();

    /// <summary>
    /// The distinct thema ids of the placements that stand in a real period and whose status passes
    /// <paramref name="teltMee"/>. A stale placement is excluded whatever its status: it is in no period.
    /// </summary>
    private static IReadOnlyList<Guid> Themaplaatsingen(JaarplanWeergave plan, Func<string, bool> teltMee) =>
        plan.Plaatsingen
            .Where(p => !p.IsVervallen && teltMee(p.Status))
            .Select(p => p.ThemaId)
            .Distinct()
            .ToList();

    private static Dictionary<string, IReadOnlyList<string>> NamenPerCode<T>(
        IEnumerable<T> rijen,
        Func<T, string> code,
        Func<T, string> naam) =>
        rijen
            .GroupBy(code, StringComparer.Ordinal)
            .ToDictionary(
                g => g.Key,
                g => Namen(g.Select(naam)),
                StringComparer.Ordinal);

    /// <summary>
    /// How many stale placements are unresolved. A rejected one contributes nothing whether or not its period still
    /// exists, so it does not withhold the figure; any other status, an unknown one included, does.
    /// </summary>
    private static int TelOnopgelosteVervallen(JaarplanWeergave plan) =>
        plan.Plaatsingen.Count(p => p.IsVervallen && !IsGeweigerd(p.Status));

    /// <summary>
    /// Resolves the requested scope into the leerplandoelen to measure against, and reports what was applied (owner
    /// ruling 2026-08-04). A class whose jaar/fase cannot be derived widens to the whole curriculum rather than
    /// narrowing, and says so: a narrower-than-intended scope would overstate coverage.
    /// </summary>
    private async Task<Bereikuitkomst> BepaalBereikAsync(
        Guid klasId,
        Dekkingsbereik bereik,
        string? jaarFase,
        CancellationToken cancellationToken)
    {
        var beschikbareFasen = bereik == Dekkingsbereik.EigenJaarFase
            ? await BepaalEigenJaarFasenAsync(klasId, cancellationToken)
            : null;
        var isTerugval = bereik == Dekkingsbereik.EigenJaarFase && beschikbareFasen is null;

        var gemetenFasen = beschikbareFasen is { Count: > 1 } && jaarFase is not null
            && beschikbareFasen.Contains(jaarFase, StringComparer.Ordinal)
                ? (IReadOnlyList<string>)[jaarFase]
                : beschikbareFasen;

        var leerplandoelen = await _opslag.HaalLeerplandoelenAsync(gemetenFasen, cancellationToken);
        var aantalBuitenBereik = gemetenFasen is null
            ? 0
            : Math.Max(0, await _opslag.TelAlleLeerplandoelenAsync(cancellationToken) - leerplandoelen.Count);

        return new Bereikuitkomst(
            isTerugval ? Dekkingsbereik.HeelCurriculum : bereik,
            gemetenFasen,
            beschikbareFasen,
            isTerugval,
            aantalBuitenBereik,
            leerplandoelen);
    }

    private sealed record Bereikuitkomst(
        Dekkingsbereik ToegepastBereik,
        IReadOnlyList<string>? GemetenFasen,
        IReadOnlyList<string>? BeschikbareFasen,
        bool IsTerugval,
        int AantalBuitenBereik,
        IReadOnlyList<Leerplandoel> Leerplandoelen);

    private async Task<IReadOnlyList<string>?> BepaalEigenJaarFasenAsync(
        Guid klasId,
        CancellationToken cancellationToken)
    {
        var scope = await _opslag.HaalKlasscopeAsync(klasId, cancellationToken);
        return scope is null ? null : Jaarfasen.VoorKlas(scope.Value.Leerjaar, scope.Value.Jaarfase);
    }

    /// <summary>
    /// Whether a placement's status lets it count: <c>aanvaard</c> or <c>manueel</c>. Parsed rather than compared as a
    /// string, and an unknown value counts for nothing (fail closed).
    /// </summary>
    private static bool TeltVoorDekking(string status) =>
        Enum.TryParse<KoppelingStatus>(status, out var geparsed)
        && geparsed is KoppelingStatus.Aanvaard or KoppelingStatus.Manueel;

    private static bool IsVoorstelbaar(string status) =>
        TeltVoorDekking(status)
        || (Enum.TryParse<KoppelingStatus>(status, out var geparsed) && geparsed == KoppelingStatus.Voorgesteld);

    private static bool IsGeweigerd(string status) =>
        Enum.TryParse<KoppelingStatus>(status, out var geparsed)
        && geparsed == KoppelingStatus.Geweigerd;
}
