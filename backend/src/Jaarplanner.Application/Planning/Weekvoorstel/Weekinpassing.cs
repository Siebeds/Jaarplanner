using System.Globalization;
using Jaarplanner.Application.Kat;

namespace Jaarplanner.Application.Planning.Weekvoorstel;

/// <summary>One proposed block, fitted: which activiteit, when, and why.</summary>
public sealed record IngepastBlok(Weekkandidaat Kandidaat, DateOnly Datum, TimeOnly Begin, TimeOnly Einde, string Motivatie);

/// <summary>What the fitting kept, what had no room anywhere, and how many picks were unusable.</summary>
/// <param name="Blokken">The blocks to store as proposals, in the model's order.</param>
/// <param name="PastNiet">The names of activiteiten the model picked that fit on no day of the week (D1).</param>
/// <param name="AantalOvergeslagen">Picks dropped as unusable: an unknown or repeated key, or no motivation (D4).</param>
public sealed record WeekinpassingResultaat(
    IReadOnlyList<IngepastBlok> Blokken,
    IReadOnlyList<string> PastNiet,
    int AantalOvergeslagen);

/// <summary>
/// Fits the model's picks into the week (FB-027, ADR-0067 W2, D1, D4). A pure function, so the rule that decides where a
/// block lands is a unit test that needs no AI.
/// <para>
/// <b>The model names the day, the tool the hour.</b> Each pick goes, in the model's order, on the first free quarter of
/// an hour of the day it named, with its own length, inside the schooluren, off the middagpauze and off everything
/// already there, including the blocks placed a moment ago. It is <see cref="Vrijmoment.Zoek"/>, the cat's rule, so the
/// two cannot disagree about when a day has room.
/// </para>
/// <para>
/// <b>A full day or a day outside the subthema is corrected, not dropped</b> (D1): the search walks on through the other
/// days the activiteit may go on. Only a pick with room on none of them is reported, by name.
/// </para>
/// </summary>
public static class Weekinpassing
{
    /// <summary>Fits <paramref name="keuzes"/> into <paramref name="context"/>'s days.</summary>
    public static WeekinpassingResultaat Pas(WeekvoorstelContext context, IReadOnlyList<RuweWeekkeuze> keuzes)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(keuzes);

        var kandidaten = context.Kandidaten.ToDictionary(k => k.Sleutel, StringComparer.OrdinalIgnoreCase);
        var bezet = context.Dagen.ToDictionary(d => d.Datum, d => d.Bezet.ToList());
        var gekozen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var blokken = new List<IngepastBlok>();
        var pastNiet = new List<string>();
        var overgeslagen = 0;

        foreach (var keuze in keuzes)
        {
            if (keuze.Activiteit is not { } sleutel
                || !kandidaten.TryGetValue(sleutel, out var kandidaat)
                || !gekozen.Add(sleutel)
                || keuze.Motivatie is not { } motivatie)
            {
                overgeslagen++;
                continue;
            }

            var dagen = context.Dagen
                .Where(d => kandidaat.Dagen.Contains(d.Datum))
                .Select(d => d with { Bezet = bezet[d.Datum] })
                .ToList();

            var voorkeur = LeesDag(keuze.Dag) is { } dag && kandidaat.Dagen.Contains(dag)
                ? (dag, TimeOnly.MinValue)
                : ((DateOnly, TimeOnly)?)null;

            if (Vrijmoment.Zoek(dagen, kandidaat.Minuten, voorkeur) is not { } moment)
            {
                pastNiet.Add(kandidaat.Naam);
                continue;
            }

            bezet[moment.Datum].Add(new Tijdvak(moment.Begin, moment.Einde));
            blokken.Add(new IngepastBlok(kandidaat, moment.Datum, moment.Begin, moment.Einde, motivatie));
        }

        return new WeekinpassingResultaat(blokken, pastNiet, overgeslagen);
    }

    private static DateOnly? LeesDag(string? dag) =>
        DateOnly.TryParseExact(dag, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var datum)
            ? datum
            : null;
}
