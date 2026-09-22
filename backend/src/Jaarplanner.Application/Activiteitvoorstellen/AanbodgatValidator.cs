using System.Globalization;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Activiteitvoorstellen;

/// <summary>An activiteit the validator kept, with the subthema it goes under and the moment it proposes.</summary>
/// <param name="SubthemaId">The subthema of the thema, at the klas's leeftijd, it belongs under.</param>
/// <param name="Activiteit">Its content, exactly as the asked-for flow carries it.</param>
/// <param name="Voorkeur">
/// The day and hour the model proposed, or <c>null</c> when it named none, named a day it was not offered (ADR-0062
/// D2) or wrote either in a form that is not a date or an hour. <b>A preference, not a moment:</b> whether the school
/// can give it is <c>Vrijmoment</c>'s question, which keeps the day and corrects the hour (ADR-0062 D1).
/// </param>
public sealed record AanbodgatPlan(
    Guid SubthemaId,
    ActiviteitPlan Activiteit,
    (DateOnly Datum, TimeOnly Begin)? Voorkeur);

/// <summary>What survives validation, and how many items were dropped (for the log).</summary>
public sealed record AanbodgatVoorstelplan(IReadOnlyList<AanbodgatPlan> Voorstellen, int AantalOvergeslagen);

/// <summary>
/// Keeps only what ADR-0060 allows of a readable answer, item by item, and drops the rest. A pure function, so every
/// rule is a unit test.
/// <para>
/// <b>The candidate goals are the aanbod-gat's, not a subthema's subdoelen</b> (D1, superseding ADR-0056 D6 here). A
/// code the model invented, or one that is in the prognose after all, is not a goal it was sent, so it is dropped; an
/// item left with no goal is dropped whole (Art. IV.4). <b>A minimumdoel cannot get in</b> (G6): the gap is built from
/// leerplandoelen, so no minimumdoel ref is ever a candidate.
/// </para>
/// <para>
/// <b>A subthema it did not get is not a place it may choose.</b> An item naming an unknown key is dropped rather than
/// pushed into the first subthema: which subthema an activiteit belongs under is a pedagogical choice, and guessing it
/// would be the tool deciding (Art. IV.1).
/// </para>
/// </summary>
public static class AanbodgatValidator
{
    /// <summary>The date form the prompt asks for and this reads back: ISO, so nothing depends on a culture.</summary>
    private const string Datumvorm = "yyyy-MM-dd";

    /// <summary>
    /// The hour forms accepted. <c>HH:mm</c> is what the prompt asks for; the others are what a model writes anyway,
    /// and reading them is cheaper than losing the choice of day over a missing zero.
    /// </summary>
    private static readonly string[] Uurvormen = ["HH:mm", "H:mm", "HH:mm:ss", "H.mm", "HH.mm"];

    /// <summary>Validates <paramref name="antwoord"/> against <paramref name="context"/>.</summary>
    public static AanbodgatVoorstelplan Keur(AanbodgatContext context, ActiviteitvoorstelParseResultaat antwoord)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(antwoord);
        if (!antwoord.IsGeldig)
        {
            throw new ArgumentException("Only a readable answer can be validated.", nameof(antwoord));
        }

        var gatdoelen = context.Gatdoelen.Select(d => d.Code).ToHashSet(StringComparer.Ordinal);
        var subthemas = context.Subthemas.ToDictionary(s => s.Sleutel, s => s, StringComparer.OrdinalIgnoreCase);
        var vragen = context.Subthemas
            .SelectMany(s => s.Onderzoeksvragen.Select(v => (s.Sleutel, Vraag: v)))
            .ToDictionary(p => (p.Sleutel, p.Vraag.Sleutel), p => p.Vraag.Id, SleutelparenGelijk.Instance);
        var bezetteNamen = context.Subthemas
            .SelectMany(s => s.BestaandeActiviteiten.Select(a => a.Naam.Trim()))
            .Concat(context.GeweigerdeNamen.Select(n => n.Trim()))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var gehouden = new List<AanbodgatPlan>();
        var overgeslagen = 0;
        foreach (var kandidaat in antwoord.Activiteiten)
        {
            var codes = kandidaat.Doelen.Where(gatdoelen.Contains).Distinct(StringComparer.Ordinal).ToList();
            if (gehouden.Count == context.Aantal
                || kandidaat.Subthema is not { } sleutel
                || !subthemas.TryGetValue(sleutel, out var subthema)
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
            gehouden.Add(new AanbodgatPlan(
                subthema.Id,
                new ActiviteitPlan(
                    naam,
                    ActiviteitvoorstelValidator.LeesSoort(kandidaat.Soort),
                    uitkomsten,
                    kandidaat.LengteInLesuren.Value,
                    // An onderzoeksvraag of another subthema is not this activiteit's to answer, so the pair has to
                    // match, not just the vraag key.
                    kandidaat.Onderzoeksvraag is { } vraagSleutel
                    && vragen.TryGetValue((subthema.Sleutel, vraagSleutel), out var vraagId)
                        ? vraagId
                        : null,
                    codes,
                    motivatie),
                LeesVoorkeur(context, kandidaat)));
        }

        return new AanbodgatVoorstelplan(gehouden, overgeslagen);
    }

    /// <summary>
    /// The day and hour the model proposed, or <c>null</c> (ADR-0062 M1, D2).
    /// <para>
    /// <b>A bad moment never drops the activiteit</b> (D1): the content is good whatever the model got wrong about the
    /// timetable, so an unreadable date, an unreadable hour or a day that was not offered simply leaves the preference
    /// empty and the tool places it as it did before ADR-0062.
    /// </para>
    /// </summary>
    private static (DateOnly Datum, TimeOnly Begin)? LeesVoorkeur(AanbodgatContext context, RuweActiviteit kandidaat)
    {
        if (kandidaat.Dag is not { } dag
            || !DateOnly.TryParseExact(dag, Datumvorm, CultureInfo.InvariantCulture, DateTimeStyles.None, out var datum)
            || !context.Dagen.Any(d => d.Datum == datum))
        {
            return null;
        }

        // The hour is optional even with a day: "this Tuesday" is a choice worth keeping, and the tool then takes the
        // first free moment of that Tuesday.
        return kandidaat.Beginuur is { } uur
            && TimeOnly.TryParseExact(uur, Uurvormen, CultureInfo.InvariantCulture, DateTimeStyles.None, out var begin)
                ? (datum, begin)
                : (datum, TimeOnly.MinValue);
    }

    /// <summary>Compares a (subthema key, onderzoeksvraag key) pair the way the model writes them: case-insensitively.</summary>
    private sealed class SleutelparenGelijk : IEqualityComparer<(string Subthema, string Vraag)>
    {
        public static readonly SleutelparenGelijk Instance = new();

        public bool Equals((string Subthema, string Vraag) x, (string Subthema, string Vraag) y) =>
            StringComparer.OrdinalIgnoreCase.Equals(x.Subthema, y.Subthema)
            && StringComparer.OrdinalIgnoreCase.Equals(x.Vraag, y.Vraag);

        public int GetHashCode((string Subthema, string Vraag) obj) =>
            HashCode.Combine(
                StringComparer.OrdinalIgnoreCase.GetHashCode(obj.Subthema),
                StringComparer.OrdinalIgnoreCase.GetHashCode(obj.Vraag));
    }
}
