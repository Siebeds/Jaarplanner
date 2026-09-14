using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// The one place where a row of KOV's <c>/agodi/onderwijsdoelen/opstap</c> endpoint becomes a <see cref="Minimumdoel"/>
/// (Art. III.3, ADR-0032 decision 3). If KOV changes a field, this is the file that changes.
/// <list type="table">
/// <item><term><c>Ref</c></term><description><c>uniqueCode</c> verbatim, e.g. <c>K-1.3.9</c>. Nothing is concatenated,
/// which is what removes the padding hazard E1-12 recorded for the Excel route (<c>6-1</c> against <c>6-01</c>).</description></item>
/// <item><term><c>Leeftijd</c></term><description>The prefix of <c>uniqueCode</c>: <c>K-</c>, <c>4-</c> or <c>6-</c>.</description></item>
/// <item><term><c>Nr</c></term><description><c>code</c>, which must equal the rest of <c>uniqueCode</c>.</description></item>
/// <item><term><c>Omschrijving</c></term><description><c>title</c> (the doelzin), then <c>description</c> (the
/// uitbreiding) on the next line when there is one, both as plain text.</description></item>
/// <item><term><c>Leergebied</c>, <c>Rubriek</c>, <c>Subrubriek</c></term><description><c>path</c>, split on
/// <c> &gt; </c>: two or three levels, verbatim (TB-010). Any other shape leaves all three empty.</description></item>
/// <item><term><c>Soort</c></term><description><c>type</c>, one of the decree's three kinds (TB-010). Any other value
/// leaves it empty.</description></item>
/// </list>
/// A row whose <c>validity.endDate</c> has passed is left out, with a reason. <b>An unusable <c>path</c> or <c>type</c>
/// never refuses a row:</b> they place the minimumdoel in the register, and a decreed eindterm left out for want of a
/// heading would be the worse loss. The row is imported without them, and the register lists it apart.
/// </summary>
internal static partial class OnderwijsdoelMapping
{
    /// <summary>The longest level name the mapping keeps; the columns are this wide. KOV's longest is 89 characters.</summary>
    internal const int MaxOrdeningLengte = 256;

    /// <summary>Maps one row, or explains why it cannot be imported. Exactly one of the two results is set.</summary>
    /// <param name="rij">The expanded row.</param>
    /// <param name="href">The row's href, used to name it when it has no usable <c>uniqueCode</c>.</param>
    /// <param name="peildatum">The moment against which <c>validity.endDate</c> is judged.</param>
    public static (Minimumdoel? Doel, MinimumdoelBronProbleem? Probleem) Map(
        OnderwijsdoelDto rij,
        string? href,
        DateTimeOffset peildatum)
    {
        var sleutel = rij.UniqueCode ?? href ?? "(no uniqueCode, no href)";

        var vorm = UniqueCodeVorm().Match(rij.UniqueCode ?? string.Empty);
        if (!vorm.Success)
        {
            return Probleem(sleutel, $"uniqueCode '{rij.UniqueCode}' is not K-, 4- or 6- followed by a dotted number.");
        }

        var leeftijd = vorm.Groups["leeftijd"].Value + "-";
        var nr = vorm.Groups["nr"].Value;
        if (!string.Equals(rij.Code, nr, StringComparison.Ordinal))
        {
            return Probleem(sleutel, $"code '{rij.Code}' does not match the number in uniqueCode '{rij.UniqueCode}'.");
        }

        if (rij.Validity?.EndDate is { } einde && einde <= peildatum)
        {
            return Probleem(sleutel, $"validity ended on {einde:yyyy-MM-dd}; not imported.");
        }

        var onvertaalbaar = OpstapHtml.OnvertaalbareOpmaak(rij.Title)
            .Concat(OpstapHtml.OnvertaalbareOpmaak(rij.Description))
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (onvertaalbaar.Count > 0)
        {
            // Refused rather than stripped: markup whose meaning cannot be kept may carry part of the decreed text (a
            // fraction and a superscript both did), and Art. III.1 forbids altering it. A missing row is loud; a
            // rewritten one is not.
            return Probleem(
                sleutel,
                $"contains markup the mapping cannot convert faithfully ({string.Join(", ", onvertaalbaar)}); " +
                "not imported, because stripping it could change the decreed text.");
        }

        var doelzin = OpstapHtml.NaarTekst(rij.Title);
        if (doelzin.Length == 0)
        {
            return Probleem(sleutel, "title is empty, so there is no decreed text to import.");
        }

        var uitbreiding = OpstapHtml.NaarTekst(rij.Description);
        var omschrijving = uitbreiding.Length == 0 ? doelzin : $"{doelzin}\n{uitbreiding}";
        var (leergebied, rubriek, subrubriek) = Ordening(rij.Path);

        return (new Minimumdoel(rij.UniqueCode!, leeftijd, nr, omschrijving, leergebied, rubriek, subrubriek, Soort(rij.Type)), null);
    }

    /// <summary>
    /// True when <paramref name="waarde"/> has the shape of a minimumdoel ref (<c>K-</c>, <c>4-</c> or <c>6-</c> and a
    /// dotted number). The source uses it to refuse a read with a row it cannot identify (E1-12 round 2).
    /// </summary>
    public static bool IsWelgevormdeRef(string? waarde) => UniqueCodeVorm().IsMatch(waarde ?? string.Empty);

    /// <summary>
    /// <c>path</c> as the decree's ordering: <c>Nederlands &gt; Lezen &gt; Vlot en vloeiend lezen</c> gives three levels,
    /// <c>Attitudes &gt; Leren leren</c> two. One level, more than three, an empty level, a level longer than the column,
    /// or anything that looks like markup gives none: the path is plain text in every row KOV publishes (measured on
    /// 2026-09-14), so a different shape is a change in the source that should not be guessed at.
    /// </summary>
    private static (string? Leergebied, string? Rubriek, string? Subrubriek) Ordening(string? pad)
    {
        if (string.IsNullOrWhiteSpace(pad))
        {
            return (null, null, null);
        }

        var niveaus = pad.Split(" > ", StringSplitOptions.TrimEntries);
        if (niveaus.Length is < 2 or > 3 ||
            niveaus.Any(n => n.Length == 0 || n.Length > MaxOrdeningLengte || n.Contains('<') || n.Contains('>')))
        {
            return (null, null, null);
        }

        return (niveaus[0], niveaus[1], niveaus.Length == 3 ? niveaus[2] : null);
    }

    /// <summary><c>type</c> as one of the decree's three kinds, or null for anything else.</summary>
    private static MinimumdoelSoort? Soort(string? type) => type?.Trim() switch
    {
        "Te bereiken minimumdoelen op individueel niveau" => MinimumdoelSoort.TeBereikenIndividueel,
        "Te bereiken minimumdoelen op populatieniveau" => MinimumdoelSoort.TeBereikenPopulatie,
        "Na te streven minimumdoelen op populatieniveau" => MinimumdoelSoort.NaTeStreven,
        _ => null,
    };

    private static (Minimumdoel?, MinimumdoelBronProbleem?) Probleem(string sleutel, string reden) =>
        (null, new MinimumdoelBronProbleem(sleutel, reden));

    [GeneratedRegex(@"^(?<leeftijd>K|4|6)-(?<nr>\d+(?:\.\d+)*)$")]
    private static partial Regex UniqueCodeVorm();
}

/// <summary>One page of <c>/agodi/onderwijsdoelen/opstap</c>, as far as the mapping reads it.</summary>
internal sealed class OnderwijsdoelenPaginaDto
{
    [JsonPropertyName("$$meta")]
    public OnderwijsdoelenMetaDto? Meta { get; set; }

    [JsonPropertyName("results")]
    public List<OnderwijsdoelResultaatDto>? Results { get; set; }
}

/// <summary>The paging metadata: the total and the href of the next page, absent on the last one.</summary>
internal sealed class OnderwijsdoelenMetaDto
{
    [JsonPropertyName("count")]
    public int? Count { get; set; }

    [JsonPropertyName("next")]
    public string? Next { get; set; }
}

/// <summary>One entry of a page: the row's href and the row itself.</summary>
internal sealed class OnderwijsdoelResultaatDto
{
    [JsonPropertyName("href")]
    public string? Href { get; set; }

    [JsonPropertyName("$$expanded")]
    public OnderwijsdoelDto? Expanded { get; set; }
}

/// <summary>One decreed minimumdoel as KOV publishes it.</summary>
internal sealed class OnderwijsdoelDto
{
    [JsonPropertyName("code")]
    public string? Code { get; set; }

    [JsonPropertyName("uniqueCode")]
    public string? UniqueCode { get; set; }

    [JsonPropertyName("title")]
    public string? Title { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    /// <summary>The decree's ordering as plain text, e.g. <c>Geschiedenis &gt; Kennis van het verleden &gt; Prehistorie</c>.</summary>
    [JsonPropertyName("path")]
    public string? Path { get; set; }

    /// <summary>The decree's kind, e.g. <c>Te bereiken minimumdoelen op populatieniveau</c>.</summary>
    [JsonPropertyName("type")]
    public string? Type { get; set; }

    [JsonPropertyName("validity")]
    public OnderwijsdoelGeldigheidDto? Validity { get; set; }
}

/// <summary>When a minimumdoel applies.</summary>
internal sealed class OnderwijsdoelGeldigheidDto
{
    [JsonPropertyName("startDate")]
    public DateTimeOffset? StartDate { get; set; }

    [JsonPropertyName("endDate")]
    public DateTimeOffset? EndDate { get; set; }
}
