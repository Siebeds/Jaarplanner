using Jaarplanner.Application.AiMatching.Response;

namespace Jaarplanner.Application.Activiteitdoelen;

/// <summary>A proposal the validator kept.</summary>
public sealed record GekeurdDoelvoorstel(string Code, string Motivatie);

/// <summary>What survives validation, and how many items were dropped.</summary>
public sealed record ActiviteitDoelsuggestiePlan(IReadOnlyList<GekeurdDoelvoorstel> Voorstellen, int AantalOvergeslagen);

/// <summary>
/// Keeps only what ADR-0052 D3 allows of a readable answer, item by item, in the model's order: a candidate code, not on
/// the activiteit already, not mentioned before, and no more than the maximum. A pure function.
/// </summary>
public static class ActiviteitDoelsuggestieValidator
{
    /// <summary>Validates <paramref name="antwoord"/> against <paramref name="context"/>.</summary>
    public static ActiviteitDoelsuggestiePlan Keur(ActiviteitDoelsuggestieContext context, DoelMatchParseResultaat antwoord)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(antwoord);
        if (!antwoord.IsGeldig)
        {
            throw new ArgumentException("Only a readable answer can be validated.", nameof(antwoord));
        }

        var kandidaten = context.Kandidaten.Select(d => d.Code).ToHashSet(StringComparer.Ordinal);
        var bezet = context.NietVoorstellen.ToHashSet(StringComparer.Ordinal);
        var gehouden = new List<GekeurdDoelvoorstel>();
        var overgeslagen = 0;
        foreach (var suggestie in antwoord.Suggesties)
        {
            if (!kandidaten.Contains(suggestie.Code)
                || !bezet.Add(suggestie.Code)
                || gehouden.Count >= context.MaxVoorstellen)
            {
                overgeslagen++;
                continue;
            }

            gehouden.Add(new GekeurdDoelvoorstel(suggestie.Code, suggestie.Motivatie));
        }

        return new ActiviteitDoelsuggestiePlan(gehouden, overgeslagen);
    }
}
