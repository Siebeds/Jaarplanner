using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Activiteitvoorstellen;

/// <summary>An activiteit the validator kept, ready to store as a proposal.</summary>
public sealed record ActiviteitPlan(
    string Naam,
    ActiviteitType? ActiviteitType,
    string VerwachteUitkomsten,
    int LengteInLesuren,
    Guid? OnderzoeksvraagId,
    IReadOnlyList<string> LeerplandoelCodes,
    string Motivatie);

/// <summary>What survives validation, and how many items were dropped (for the result line and the log).</summary>
public sealed record ActiviteitvoorstelPlan(IReadOnlyList<ActiviteitPlan> Activiteiten, int AantalOvergeslagen);

/// <summary>
/// Keeps only what ADR-0054 D3, D5, D6 and D7 allow of a readable answer, item by item, and drops the rest. A pure
/// function, so every rule is a unit test. The first item with a name wins; a later one with the same name is dropped,
/// and so is every item past <see cref="ActiviteitvoorstelContext.Aantal"/>.
/// </summary>
public static class ActiviteitvoorstelValidator
{
    /// <summary>Validates <paramref name="antwoord"/> against <paramref name="context"/>.</summary>
    public static ActiviteitvoorstelPlan Keur(ActiviteitvoorstelContext context, ActiviteitvoorstelParseResultaat antwoord)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(antwoord);
        if (!antwoord.IsGeldig)
        {
            throw new ArgumentException("Only a readable answer can be validated.", nameof(antwoord));
        }

        var subdoelen = context.Subdoelen.Select(d => d.Code).ToHashSet(StringComparer.Ordinal);
        var vragen = context.Onderzoeksvragen.ToDictionary(v => v.Sleutel, v => v.Id, StringComparer.OrdinalIgnoreCase);
        var bezetteNamen = context.BestaandeActiviteiten.Select(a => a.Naam.Trim())
            .Concat(context.GeweigerdeNamen.Select(n => n.Trim()))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var gehouden = new List<ActiviteitPlan>();
        var overgeslagen = 0;
        foreach (var kandidaat in antwoord.Activiteiten)
        {
            var codes = kandidaat.Doelen.Where(subdoelen.Contains).Distinct(StringComparer.Ordinal).ToList();
            if (gehouden.Count == context.Aantal
                || kandidaat.Naam is not { Length: <= Activiteitvoorstel.MaxNaamlengte } naam
                || kandidaat.VerwachteUitkomsten is not { Length: <= Activiteitvoorstel.MaxUitkomstlengte } uitkomsten
                || kandidaat.Motivatie is not { } motivatie
                || kandidaat.LengteInLesuren is not (>= Activiteitvoorstel.MinLesuren and <= Activiteitvoorstel.MaxLesuren)
                || codes.Count == 0
                || bezetteNamen.Contains(naam))
            {
                overgeslagen++;
                continue;
            }

            bezetteNamen.Add(naam);
            gehouden.Add(new ActiviteitPlan(
                naam,
                LeesSoort(kandidaat.Soort),
                uitkomsten,
                kandidaat.LengteInLesuren.Value,
                kandidaat.Onderzoeksvraag is { } sleutel && vragen.TryGetValue(sleutel, out var vraagId) ? vraagId : null,
                codes,
                motivatie));
        }

        return new ActiviteitvoorstelPlan(gehouden, overgeslagen);
    }

    /// <summary>A soort by its enum name, without regard to case; anything else is none (D7, FB-050).</summary>
    public static ActiviteitType? LeesSoort(string? soort) =>
        soort is not null
        && !int.TryParse(soort, out _)
        && Enum.TryParse<ActiviteitType>(soort, ignoreCase: true, out var gelezen)
        && Enum.IsDefined(gelezen)
            ? gelezen
            : null;
}
