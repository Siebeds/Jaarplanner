using System.Globalization;
using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Domain.Curriculum;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// Reads the Op.stap leerplandoelen from KOV's API (E1-21, ADR-0032): one numbered snapshot of
/// <c>GET /documents/{document}/snapshots/{versie}/krcItems</c>, a flat list of about 15,000 items linked by
/// <c>parentHref</c>, walked from each goal up through <c>KRC_AGE_RANGE_ITEM → KRC_GOAL_SET_ITEM →
/// [KRC_CURRICULUM_CLUSTER] → KRC_CURRICULUM_SUBDOMAIN → KRC_CURRICULUM_DOMAIN → KRC_CURRICULUM_DISCIPLINE</c>. Goals of
/// set G go through <see cref="CurriculumdoelMapping"/>; the others are counted per set and their codes named, so the
/// import can leave stored ones alone. A typed <see cref="HttpClient"/> registered by <see cref="OpstapApiRegistratie"/>.
/// <para>
/// <b>Pinned, never <c>latest</c> (ADR-0032 decision 6).</b> Asked for no version, it reads
/// <c>…/snapshots/latest/krcItems/hash</c> (63 bytes) only to learn the newest <i>number</i>, and then reads that number.
/// It checks that the snapshot it got is the version it asked for, and it reports KOV's hash for that version, so a
/// preview names a version an apply can pin and the database can record what it was built from.
/// </para>
/// <para>
/// <b>All or nothing, as for the minimumdoelen.</b> A goal without a code or a UUID key, a code that occurs twice, a goal
/// that does not sit in the tree as above, a discipline identifier of an unknown shape, a snapshot without a single G goal
/// or a minimumdoel row that cannot be identified refuses the whole read with an <see cref="OpstapBronFout"/>: any of
/// them could otherwise make a stored goal read as <i>verdwenen</i> while KOV still lists it. A G goal that is identified
/// but cannot be delivered faithfully is refused alone and reported by code.
/// </para>
/// <para>
/// <b>The concordance.</b> A goal points at its minimumdoel by that row's href in <c>/agodi/onderwijsdoelen/opstap</c>, so
/// that list is read too (<see cref="OnderwijsdoelenApiBron.LeesRijenAsync"/>) to turn the href into the
/// <c>uniqueCode</c> the <c>minimumdoelen</c> table is keyed on. Whether that minimumdoel is loaded is the import's
/// integrity check, not this class's.
/// </para>
/// </summary>
public sealed class CurriculumApiBron : ILeerplandoelBron
{
    internal const string TypeDiscipline = "KRC_CURRICULUM_DISCIPLINE";
    internal const string TypeDomein = "KRC_CURRICULUM_DOMAIN";
    internal const string TypeSubdomein = "KRC_CURRICULUM_SUBDOMAIN";
    internal const string TypeCluster = "KRC_CURRICULUM_CLUSTER";
    internal const string TypeDoelset = "KRC_GOAL_SET_ITEM";
    internal const string TypeLeeftijd = "KRC_AGE_RANGE_ITEM";
    internal const string TypeDoel = "KRC_CURRICULUM_GOAL";

    private readonly HttpClient _http;
    private readonly OpstapApiOptions _opties;
    private readonly ILogger<CurriculumApiBron> _logger;

    /// <summary>The DI constructor.</summary>
    public CurriculumApiBron(HttpClient http, IOptions<OpstapApiOptions> opties, ILogger<CurriculumApiBron> logger)
    {
        ArgumentNullException.ThrowIfNull(http);
        ArgumentNullException.ThrowIfNull(opties);
        ArgumentNullException.ThrowIfNull(logger);

        _http = http;
        _opties = opties.Value;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<LeerplandoelBronResultaat> HaalOpAsync(string? versie, CancellationToken cancellationToken = default)
    {
        if (versie is not null && !Opstapversie.IsGeldigeVersie(versie))
        {
            throw new ArgumentException($"'{versie}' is not a numbered Op.stap version such as 1.2.", nameof(versie));
        }

        var basis = KovHttp.MetSlotSlash(_opties.BasisUrl);
        var gevraagd = versie?.Trim() ?? await NieuwsteVersieAsync(basis, cancellationToken);

        var versieInfo = await KovHttp.LeesJsonAsync<KrcVersieDto>(_http, Adres(basis, gevraagd, "/hash"), cancellationToken);
        if (!string.Equals(versieInfo.Version, gevraagd, StringComparison.Ordinal) || string.IsNullOrWhiteSpace(versieInfo.Hash))
        {
            throw new OpstapBronFout(
                $"The hash of snapshot {gevraagd} came back as version '{versieInfo.Version}' with hash '{versieInfo.Hash}'.");
        }

        var snapshot = await KovHttp.LeesJsonAsync<KrcSnapshotDto>(_http, Adres(basis, gevraagd, string.Empty), cancellationToken);
        if (!string.Equals(snapshot.Version, gevraagd, StringComparison.Ordinal))
        {
            throw new OpstapBronFout($"Snapshot {gevraagd} was asked for and version '{snapshot.Version}' came back; refused.");
        }

        var items = snapshot.Items ?? throw new OpstapBronFout($"Snapshot {gevraagd} has no 'items' array.");
        var minimumdoelPerHref = await MinimumdoelIndexAsync(cancellationToken);
        var (disciplines, verwijzingen) = Verwerk(gevraagd, items, minimumdoelPerHref);

        return new LeerplandoelBronResultaat(
            gevraagd,
            versieInfo.Hash.Trim(),
            DateTimeOffset.TryParse(snapshot.Timestamp, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var tijdstip)
                ? tijdstip
                : null,
            Wijzigingslog(gevraagd, snapshot.Changelog),
            disciplines,
            verwijzingen,
            minimumdoelPerHref.Values.ToHashSet(StringComparer.Ordinal));
    }

    /// <summary>The newest numbered version, from the 63-byte hash of <c>latest</c>; the data itself is never read as latest.</summary>
    private async Task<string> NieuwsteVersieAsync(Uri basis, CancellationToken cancellationToken)
    {
        var laatste = await KovHttp.LeesJsonAsync<KrcVersieDto>(_http, Adres(basis, "latest", "/hash"), cancellationToken);
        return Opstapversie.IsGeldigeVersie(laatste.Version)
            ? laatste.Version!.Trim()
            : throw new OpstapBronFout($"The newest snapshot names version '{laatste.Version}', which is not a numbered version.");
    }

    private Uri Adres(Uri basis, string versie, string staart) =>
        new(basis, $"documents/{_opties.CurriculumDocument:D}/snapshots/{versie}/krcItems{staart}");

    private async Task<IReadOnlyDictionary<string, string>> MinimumdoelIndexAsync(CancellationToken cancellationToken)
    {
        var index = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var rij in await OnderwijsdoelenApiBron.LeesRijenAsync(_http, _opties, cancellationToken))
        {
            if (rij.Expanded is null)
            {
                throw OnderwijsdoelenApiBron.NietExpanded(rij);
            }

            if (string.IsNullOrWhiteSpace(rij.Href) || !OnderwijsdoelMapping.IsWelgevormdeRef(rij.Expanded.UniqueCode))
            {
                throw new OpstapBronFout(
                    $"Row {rij.Href ?? "(no href)"} of {OnderwijsdoelenApiBron.Pad} has no usable href or uniqueCode " +
                    $"('{rij.Expanded.UniqueCode}'); the goals that point at it could not be concorded, so the read is refused.");
            }

            index[rij.Href.Trim()] = rij.Expanded.UniqueCode!;
        }

        return index;
    }

    private static (List<LeerplandoelBronDiscipline> Disciplines, List<MinimumdoelVerwijzing> Verwijzingen) Verwerk(
        string versie,
        IReadOnlyList<KrcItemDto> items,
        IReadOnlyDictionary<string, string> minimumdoelPerHref)
    {
        // The goals that point at a minimumdoel without being imported, for the reason a minimumdoel has no loaded
        // leerplandoel (E1-22). The mapped G goals carry theirs in MinimumdoelRef.
        var verwijzingen = new List<MinimumdoelVerwijzing>();
        var perHref = new Dictionary<string, KrcItemDto>(StringComparer.Ordinal);
        foreach (var item in items.Where(i => !string.IsNullOrWhiteSpace(i.Href)))
        {
            if (!perHref.TryAdd(item.Href!, item))
            {
                throw new OpstapBronFout($"Snapshot {versie} lists item {item.Href} twice; refused.");
            }
        }

        // One collector per discipline, in the snapshot's order, including a discipline without a single goal.
        var disciplines = new Dictionary<string, Verzameling>(StringComparer.Ordinal);
        var nummers = new HashSet<string>(StringComparer.Ordinal);
        foreach (var discipline in items.Where(i => i.Type == TypeDiscipline))
        {
            var nummer = CurriculumdoelMapping.NormaliseerDisciplineNummer(discipline.Identifier)
                ?? throw new OpstapBronFout($"Discipline {discipline.Href} has identifier '{discipline.Identifier}', which is not a discipline number.");
            if (!nummers.Add(nummer) || string.IsNullOrWhiteSpace(discipline.Href))
            {
                throw new OpstapBronFout($"Discipline number {nummer} occurs more than once in snapshot {versie}, or has no href.");
            }

            disciplines[discipline.Href] = new Verzameling(nummer, discipline.Title?.Trim() ?? nummer);
        }

        var codes = new HashSet<string>(StringComparer.Ordinal);
        var aantalG = 0;
        foreach (var doel in items.Where(i => i.Type == TypeDoel))
        {
            var code = doel.Identifier?.Trim();
            if (string.IsNullOrEmpty(code) || !Guid.TryParse(doel.Key, out _))
            {
                throw new OpstapBronFout(
                    $"Goal {doel.Href ?? doel.Key ?? "(no href)"} has no identifier or no UUID key; a read whose goals cannot " +
                    "all be identified is refused.");
            }

            if (!codes.Add(code))
            {
                throw new OpstapBronFout($"Goal code {code} occurs more than once in snapshot {versie}; refused.");
            }

            var (plaats, disciplineHref) = Plaats(doel, perHref, disciplines)
                ?? throw new OpstapBronFout(
                    $"Goal {code} does not sit where a goal belongs (age range, goal set, optional cluster, subdomain, " +
                    "domain, discipline); the shape of the curriculum changed, so the read is refused.");
            var verzameling = disciplines[disciplineHref];

            var doelset = plaats.Doelset.Identifier?.Trim();
            if (string.IsNullOrEmpty(doelset))
            {
                throw new OpstapBronFout($"The goal set above goal {code} has no identifier; refused.");
            }

            if (doelset != CurriculumdoelMapping.GeimporteerdeDoelset)
            {
                verzameling.BuitenBereik.Add(code);
                verzameling.Overgeslagen[doelset] = verzameling.Overgeslagen.GetValueOrDefault(doelset) + 1;
                VoegVerwijzingenToe(verwijzingen, doel, minimumdoelPerHref, doelset, geweigerd: false);
                continue;
            }

            aantalG++;
            var (leerplandoel, probleem) = CurriculumdoelMapping.Map(doel, plaats, minimumdoelPerHref);
            if (probleem is { } reden)
            {
                verzameling.Problemen.Add(reden);
                VoegVerwijzingenToe(verwijzingen, doel, minimumdoelPerHref, doelset, geweigerd: true);
            }
            else
            {
                verzameling.Leerplandoelen.Add(leerplandoel!);
            }
        }

        if (aantalG == 0)
        {
            // A snapshot without G goals would make every stored goal look disappeared; absence of input is refused.
            throw new OpstapBronFout($"Snapshot {versie} holds no goal of goal set G; refused.");
        }

        var resultaat = disciplines.Values
            .Select(v => new LeerplandoelBronDiscipline(
                v.Nummer,
                v.Naam,
                v.Leerplandoelen,
                v.Problemen,
                v.BuitenBereik,
                v.Overgeslagen
                    .OrderBy(t => t.Key, StringComparer.Ordinal)
                    .Select(t => new DoelsetTelling(t.Key, t.Value))
                    .ToList()))
            .ToList();

        return (resultaat, verwijzingen);
    }

    /// <summary>
    /// Records where a goal that is not imported points. A reference that does not resolve to a published minimumdoel is
    /// left out: it cannot explain a minimumdoel that exists, and for a skipped goal it is not this import's to refuse.
    /// </summary>
    private static void VoegVerwijzingenToe(
        List<MinimumdoelVerwijzing> verwijzingen,
        KrcItemDto doel,
        IReadOnlyDictionary<string, string> minimumdoelPerHref,
        string doelset,
        bool geweigerd)
    {
        foreach (var href in (doel.MinimumGoals ?? [])
                     .Where(h => !string.IsNullOrWhiteSpace(h))
                     .Select(h => h.Trim())
                     .Distinct(StringComparer.Ordinal))
        {
            if (minimumdoelPerHref.TryGetValue(href, out var minimumdoelRef))
            {
                verwijzingen.Add(new MinimumdoelVerwijzing(minimumdoelRef, doelset, geweigerd));
            }
        }
    }

    /// <summary>Walks from a goal to its discipline, or null when any step is not the item type the tree promises.</summary>
    private static (Curriculumplaats Plaats, string DisciplineHref)? Plaats(
        KrcItemDto doel,
        IReadOnlyDictionary<string, KrcItemDto> perHref,
        IReadOnlyDictionary<string, Verzameling> disciplines)
    {
        var leeftijd = Ouder(doel, TypeLeeftijd);
        var doelset = leeftijd is null ? null : Ouder(leeftijd, TypeDoelset);
        var boven = doelset is null ? null : Ouder(doelset, null);

        KrcItemDto? cluster = null;
        if (boven?.Type == TypeCluster)
        {
            cluster = boven;
            boven = Ouder(boven, null);
        }

        var subdomein = boven?.Type == TypeSubdomein ? boven : null;
        var domein = subdomein is null ? null : Ouder(subdomein, TypeDomein);
        var discipline = domein is null ? null : Ouder(domein, TypeDiscipline);

        if (leeftijd is null || doelset is null || subdomein is null || domein is null || discipline is null
            || !disciplines.TryGetValue(discipline.Href!, out var verzameling))
        {
            return null;
        }

        return (new Curriculumplaats(verzameling.Nummer, domein, subdomein, cluster, doelset, leeftijd), discipline.Href!);

        KrcItemDto? Ouder(KrcItemDto kind, string? type) =>
            kind.ParentHref is { } href && perHref.TryGetValue(href, out var ouder) && (type is null || ouder.Type == type)
                ? ouder
                : null;
    }

    /// <summary>
    /// KOV's changelog for the version as plain text, or null when there is none or it cannot be kept faithfully. The
    /// report cannot tell those two nulls apart, so the second is logged as an English operator warning (E1-21,
    /// antagonist round 1 MINOR 3); the changelog is not curriculum data, so it does not refuse the read.
    /// </summary>
    private string? Wijzigingslog(string versie, string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return null;
        }

        var onvertaalbaar = OpstapHtml.OnvertaalbareOpmaak(html);
        if (onvertaalbaar.Count > 0)
        {
            _logger.LogWarning(
                "KOV's changelog for snapshot {Versie} carries markup the conversion cannot keep ({Opmaak}); the report omits it.",
                versie,
                string.Join(", ", onvertaalbaar));
            return null;
        }

        return OpstapHtml.NaarTekst(html);
    }

    private sealed class Verzameling(string nummer, string naam)
    {
        public string Nummer { get; } = nummer;

        public string Naam { get; } = naam;

        public List<Leerplandoel> Leerplandoelen { get; } = [];

        public List<LeerplandoelBronProbleem> Problemen { get; } = [];

        public List<string> BuitenBereik { get; } = [];

        public Dictionary<string, int> Overgeslagen { get; } = new(StringComparer.Ordinal);
    }
}
