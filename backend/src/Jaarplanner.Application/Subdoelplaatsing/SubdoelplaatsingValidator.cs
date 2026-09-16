using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Subdoelplaatsing;

/// <summary>A goal to place in an existing subthema, as the validator kept it.</summary>
public sealed record PlaatsingInBestaand(string Code, Guid SubthemaId, string Motivatie);

/// <summary>A goal to place in a new subthema, as the validator kept it.</summary>
public sealed record PlaatsingInNieuw(string Code, string Motivatie);

/// <summary>A new subthema the validator kept, with at least one goal.</summary>
public sealed record NieuwSubthemaPlan(string Naam, string Onderzoeksvraag, int DuurWeken, string Motivatie, IReadOnlyList<PlaatsingInNieuw> Doelen);

/// <summary>What survives validation, and how much was dropped (for the result line and the log).</summary>
public sealed record SubdoelplaatsingPlan(
    IReadOnlyList<PlaatsingInBestaand> InBestaand,
    IReadOnlyList<NieuwSubthemaPlan> Nieuw,
    int AantalOvergeslagen);

/// <summary>
/// Keeps only what ADR-0050 D1, D3 and D7 allow of a readable answer, item by item, and drops the rest. A pure function,
/// so every rule is a unit test. The first valid mention of a goal wins; a later one is dropped.
/// </summary>
public static class SubdoelplaatsingValidator
{
    /// <summary>Validates <paramref name="antwoord"/> against <paramref name="context"/>.</summary>
    public static SubdoelplaatsingPlan Keur(SubdoelplaatsingContext context, SubdoelplaatsingParseResultaat antwoord)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(antwoord);
        if (!antwoord.IsGeldig)
        {
            throw new ArgumentException("Only a readable answer can be validated.", nameof(antwoord));
        }

        var overgeslagen = 0;
        var open = context.OpenDoelen.Select(d => d.Code).ToHashSet(StringComparer.Ordinal);
        var bestaand = context.Subthemas.ToDictionary(s => s.Sleutel, StringComparer.OrdinalIgnoreCase);
        var geweigerd = context.GeweigerdePlaatsingen.Select(g => (g.Code, g.SubthemaId)).ToHashSet();
        var bezetteNamen = context.Subthemas.Select(s => s.Naam)
            .Concat(context.GeweigerdeNamen)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        // The new subthema's first, so a placement can tell a known key from an invented one.
        var nieuw = new Dictionary<string, RuwNieuwSubthema>(StringComparer.OrdinalIgnoreCase);
        foreach (var kandidaat in antwoord.NieuweSubthemas)
        {
            if (kandidaat.Sleutel is null
                || kandidaat.Naam is null
                || kandidaat.Onderzoeksvraag is null
                || kandidaat.Motivatie is null
                || kandidaat.Naam.Length > Subthemavoorstel.MaxNaamlengte
                || kandidaat.DuurWeken is not (>= Subthemavoorstel.MinDuurWeken and <= Subthemavoorstel.MaxDuurWeken)
                || bestaand.ContainsKey(kandidaat.Sleutel)
                || nieuw.ContainsKey(kandidaat.Sleutel)
                || bezetteNamen.Contains(kandidaat.Naam)
                || nieuw.Count == SubdoelplaatsingPromptBuilder.MaxNieuweSubthemas)
            {
                overgeslagen++;
                continue;
            }

            nieuw.Add(kandidaat.Sleutel, kandidaat);
            bezetteNamen.Add(kandidaat.Naam);
        }

        var inBestaand = new List<PlaatsingInBestaand>();
        var perNieuw = nieuw.Keys.ToDictionary(k => k, _ => new List<PlaatsingInNieuw>(), StringComparer.OrdinalIgnoreCase);
        var geplaatst = new HashSet<string>(StringComparer.Ordinal);
        foreach (var plaatsing in antwoord.Plaatsingen)
        {
            if (plaatsing.Code is not { } code
                || plaatsing.Subthema is not { } sleutel
                || plaatsing.Motivatie is not { } motivatie
                || !open.Contains(code)
                || geplaatst.Contains(code))
            {
                overgeslagen++;
                continue;
            }

            if (bestaand.TryGetValue(sleutel, out var subthema) && !geweigerd.Contains((code, subthema.Id)))
            {
                inBestaand.Add(new PlaatsingInBestaand(code, subthema.Id, motivatie));
                geplaatst.Add(code);
            }
            else if (perNieuw.TryGetValue(sleutel, out var doelen))
            {
                doelen.Add(new PlaatsingInNieuw(code, motivatie));
                geplaatst.Add(code);
            }
            else
            {
                overgeslagen++;
            }
        }

        var plannen = new List<NieuwSubthemaPlan>();
        foreach (var (sleutel, kandidaat) in nieuw)
        {
            if (perNieuw[sleutel].Count == 0)
            {
                overgeslagen++;
                continue;
            }

            plannen.Add(new NieuwSubthemaPlan(
                kandidaat.Naam!, kandidaat.Onderzoeksvraag!, kandidaat.DuurWeken!.Value, kandidaat.Motivatie!, perNieuw[sleutel]));
        }

        return new SubdoelplaatsingPlan(inBestaand, plannen, overgeslagen);
    }
}
