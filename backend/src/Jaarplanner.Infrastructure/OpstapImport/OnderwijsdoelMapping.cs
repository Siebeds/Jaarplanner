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
/// </list>
/// A row whose <c>validity.endDate</c> has passed is left out, with a reason.
/// </summary>
internal static partial class OnderwijsdoelMapping
{
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

        return (new Minimumdoel(rij.UniqueCode!, leeftijd, nr, omschrijving), null);
    }

    /// <summary>
    /// True when <paramref name="waarde"/> has the shape of a minimumdoel ref (<c>K-</c>, <c>4-</c> or <c>6-</c> and a
    /// dotted number). The source uses it to refuse a read with a row it cannot identify (E1-12 round 2).
    /// </summary>
    public static bool IsWelgevormdeRef(string? waarde) => UniqueCodeVorm().IsMatch(waarde ?? string.Empty);

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
