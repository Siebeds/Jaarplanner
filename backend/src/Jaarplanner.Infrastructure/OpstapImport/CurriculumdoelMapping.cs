using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// The one place where a goal of KOV's <c>krcItems</c> becomes a <see cref="Leerplandoel"/> (Art. III.3, ADR-0032,
/// E1-21). If KOV changes a field, this is the file that changes; the Excel route's mapping is <see cref="OpstapKolom"/>.
/// <list type="table">
/// <item><term><c>Code</c></term><description>The goal's <c>identifier</c> verbatim (<c>2.1.GL3.10</c>, and
/// <c>9-1.2.GL3.4</c> for the 9.x disciplines, exactly as the Excel files wrote it).</description></item>
/// <item><term><c>Doelsoort</c></term><description><see cref="Doelsoort.Gemeenschappelijk"/>: only goal set G is imported
/// (owner ruling 2026-09-11). The API path never produces <see cref="Doelsoort.Minimumdoel"/>; the concordance travels in
/// <c>MinimumdoelRef</c>.</description></item>
/// <item><term><c>JaarFase</c></term><description>The parent <c>KRC_AGE_RANGE_ITEM.identifier</c> through
/// <see cref="Jaarfasen.Normaliseer"/>, and it must then be one of JK, K2, K3, L1–L6.</description></item>
/// <item><term><c>Domein</c> / <c>Subdomein</c> / <c>Cluster</c></term><description>The ancestors' titles as plain
/// text; the cluster is absent for a third of the goals and is then null.</description></item>
/// <item><term><c>DisciplineNummer</c></term><description>The discipline's <c>identifier</c>, KOV's <c>9-1</c> written as
/// this repo's <c>9.1</c> (<see cref="NormaliseerDisciplineNummer"/>).</description></item>
/// <item><term><c>Tekst</c></term><description><c>title</c> as plain text (<see cref="OpstapHtml"/>).</description></item>
/// <item><term><c>Voorbeelden</c> / <c>Woordenschat</c> / <c>Toelichting</c></term><description><c>description</c>, split on
/// its headings by <see cref="OpstapBeschrijving"/>.</description></item>
/// <item><term><c>MinimumdoelRef</c></term><description>The <c>uniqueCode</c> of the minimumdoel <c>minimumGoals[0]</c>
/// points at, looked up in KOV's own minimumdoelen list. A goal naming more than one is refused rather than concorded to
/// the first (ADR-0018 holds one per goal; none does on snapshot 1.2).</description></item>
/// <item><term><c>OpstapSleutel</c></term><description>The goal's UUID <c>key</c> (ADR-0032 decision 7).</description></item>
/// </list>
/// A goal the mapping cannot deliver faithfully is refused with an English reason, never imported half.
/// </summary>
internal static partial class CurriculumdoelMapping
{
    /// <summary>The only goal set imported (owner ruling 2026-09-11, ADR-0032 decision 5).</summary>
    public const string GeimporteerdeDoelset = "G";

    /// <summary><c>leerplandoelen.Code</c> is a <c>varchar(64)</c>.</summary>
    public const int MaxCodeLengte = 64;

    /// <summary><c>Domein</c>, <c>Subdomein</c> and <c>Cluster</c> are <c>varchar(256)</c>.</summary>
    public const int MaxTaxonomieLengte = 256;

    /// <summary>Maps one G goal, or explains why it cannot be imported. Exactly one of the two results is set.</summary>
    /// <param name="doel">The goal item.</param>
    /// <param name="plaats">Where it sits in the tree, as <see cref="CurriculumApiBron"/> resolved it.</param>
    /// <param name="minimumdoelPerHref">KOV's minimumdoelen, from their href to their <c>uniqueCode</c>.</param>
    public static (Leerplandoel? Doel, LeerplandoelBronProbleem? Probleem) Map(
        KrcItemDto doel,
        Curriculumplaats plaats,
        IReadOnlyDictionary<string, string> minimumdoelPerHref)
    {
        var code = doel.Identifier!.Trim();
        if (code.Length > MaxCodeLengte)
        {
            return Probleem(code, $"identifier is longer than {MaxCodeLengte} characters.");
        }

        var jaarFase = Jaarfasen.Normaliseer(plaats.Leeftijd.Identifier ?? string.Empty);
        if (!Jaarfasen.IsBekend(jaarFase))
        {
            return Probleem(code, $"age range '{plaats.Leeftijd.Identifier}' is not one of JK, K2, K3, L1-L6.");
        }

        var onvertaalbaar = new[] { doel.Title, doel.Description, plaats.Domein.Title, plaats.Subdomein.Title, plaats.Cluster?.Title }
            .SelectMany(OpstapHtml.OnvertaalbareOpmaak)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (onvertaalbaar.Count > 0)
        {
            // Refused rather than stripped, as for the minimumdoelen: a missing goal is loud, a rewritten one is not.
            return Probleem(
                code,
                $"contains markup the mapping cannot convert faithfully ({string.Join(", ", onvertaalbaar)}); " +
                "not imported, because stripping it could change the text.");
        }

        var tekst = OpstapHtml.NaarTekst(doel.Title);
        if (tekst.Length == 0)
        {
            return Probleem(code, "title is empty, so there is no goal text to import.");
        }

        var domein = OpstapHtml.NaarTekst(plaats.Domein.Title);
        var subdomein = OpstapHtml.NaarTekst(plaats.Subdomein.Title);
        var cluster = plaats.Cluster is null ? null : OpstapHtml.NaarTekst(plaats.Cluster.Title);
        if (domein.Length == 0 || subdomein.Length == 0)
        {
            return Probleem(code, "its domain or subdomain has no title.");
        }

        if (new[] { domein, subdomein, cluster ?? string.Empty }.Any(t => t.Length > MaxTaxonomieLengte))
        {
            return Probleem(code, $"a domain, subdomain or cluster title is longer than {MaxTaxonomieLengte} characters.");
        }

        var verwijzingen = (doel.MinimumGoals ?? [])
            .Where(h => !string.IsNullOrWhiteSpace(h))
            .Select(h => h.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();
        string? minimumdoelRef = null;
        if (verwijzingen.Count > 1)
        {
            return Probleem(
                code,
                $"refers to {verwijzingen.Count} minimumdoelen; the model holds one per goal (ADR-0018), so it is not " +
                "imported rather than concorded to only one of them.");
        }

        if (verwijzingen.Count == 1)
        {
            if (!minimumdoelPerHref.TryGetValue(verwijzingen[0], out minimumdoelRef))
            {
                return Probleem(code, $"minimumGoals[0] '{verwijzingen[0]}' is not among the minimumdoelen KOV publishes.");
            }
        }

        var (voorbeelden, woordenschat, toelichting) = OpstapBeschrijving.Splits(doel.Description);

        try
        {
            return (new Leerplandoel(
                code: code,
                doelsoort: Doelsoort.Gemeenschappelijk,
                jaarFase: jaarFase,
                domein: domein,
                subdomein: subdomein,
                disciplineNummer: plaats.DisciplineNummer,
                cluster: string.IsNullOrWhiteSpace(cluster) ? null : cluster,
                tekst: tekst,
                voorbeelden: voorbeelden,
                toelichting: toelichting,
                woordenschat: woordenschat,
                minimumdoelRef: minimumdoelRef,
                opstapSleutel: Guid.Parse(doel.Key!)), null);
        }
        catch (ArgumentException ex)
        {
            return Probleem(code, ex.Message);
        }
    }

    /// <summary>
    /// This repo's discipline number for KOV's <c>identifier</c>: <c>9-1</c> becomes <c>9.1</c> (and <c>9.1</c> stays
    /// itself), <c>2</c> stays <c>2</c>. Null for any other shape, which the source treats as a changed response.
    /// </summary>
    public static string? NormaliseerDisciplineNummer(string? identifier)
    {
        var waarde = identifier?.Trim() ?? string.Empty;
        return DisciplineVorm().IsMatch(waarde) ? waarde.Replace('-', '.') : null;
    }

    private static (Leerplandoel?, LeerplandoelBronProbleem?) Probleem(string code, string reden) =>
        (null, new LeerplandoelBronProbleem(code, reden));

    [GeneratedRegex(@"^\d{1,2}(?:[-.]\d{1,2})?$")]
    private static partial Regex DisciplineVorm();
}

/// <summary>Where a goal sits in the curriculum tree, resolved by <see cref="CurriculumApiBron"/>.</summary>
/// <param name="DisciplineNummer">This repo's discipline number.</param>
/// <param name="Domein">The <c>KRC_CURRICULUM_DOMAIN</c> ancestor.</param>
/// <param name="Subdomein">The <c>KRC_CURRICULUM_SUBDOMAIN</c> ancestor.</param>
/// <param name="Cluster">The <c>KRC_CURRICULUM_CLUSTER</c> ancestor, when there is one.</param>
/// <param name="Doelset">The <c>KRC_GOAL_SET_ITEM</c> ancestor.</param>
/// <param name="Leeftijd">The <c>KRC_AGE_RANGE_ITEM</c> parent.</param>
internal sealed record Curriculumplaats(
    string DisciplineNummer,
    KrcItemDto Domein,
    KrcItemDto Subdomein,
    KrcItemDto? Cluster,
    KrcItemDto Doelset,
    KrcItemDto Leeftijd);

/// <summary><c>…/snapshots/{versie}/krcItems</c>, as far as the mapping reads it.</summary>
internal sealed class KrcSnapshotDto
{
    [JsonPropertyName("version")]
    public string? Version { get; set; }

    [JsonPropertyName("timestamp")]
    public string? Timestamp { get; set; }

    [JsonPropertyName("changelog")]
    public string? Changelog { get; set; }

    [JsonPropertyName("items")]
    public List<KrcItemDto>? Items { get; set; }
}

/// <summary>One item of the flat curriculum list: a discipline, domain, subdomain, cluster, goal set, age range or goal.</summary>
internal sealed class KrcItemDto
{
    [JsonPropertyName("key")]
    public string? Key { get; set; }

    [JsonPropertyName("href")]
    public string? Href { get; set; }

    [JsonPropertyName("type")]
    public string? Type { get; set; }

    [JsonPropertyName("title")]
    public string? Title { get; set; }

    [JsonPropertyName("identifier")]
    public string? Identifier { get; set; }

    [JsonPropertyName("parentHref")]
    public string? ParentHref { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("minimumGoals")]
    public List<string>? MinimumGoals { get; set; }
}

/// <summary><c>…/krcItems/hash</c>: which version, and KOV's hash for it.</summary>
internal sealed class KrcVersieDto
{
    [JsonPropertyName("version")]
    public string? Version { get; set; }

    [JsonPropertyName("hash")]
    public string? Hash { get; set; }
}
