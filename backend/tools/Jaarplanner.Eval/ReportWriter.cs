using System.Globalization;
using System.Text;
using Jaarplanner.Application.Ai;

namespace Jaarplanner.Eval;

/// <summary>
/// Writes an <see cref="EvalRapport"/> as markdown, in Dutch: it is addressed to the owner (Art. II.6, clause 1).
/// Precision and recall are micro-averages over all cases of a variant and model, so a case with many gold codes
/// weighs more than one with few.
/// </summary>
public static class ReportWriter
{
    private static readonly CultureInfo Nl = CultureInfo.GetCultureInfo("nl-BE");

    /// <summary>The report as markdown.</summary>
    public static string Write(EvalRapport rapport)
    {
        ArgumentNullException.ThrowIfNull(rapport);
        var sb = new StringBuilder();

        sb.AppendLine("# Evaluatie van de AI-doelsuggesties per subthema");
        sb.AppendLine();
        sb.AppendLine($"- Gestart: {rapport.Gestart.ToLocalTime().ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture)}");
        sb.AppendLine($"- Evalset: {rapport.AantalGevallen} gevallen" +
            (string.IsNullOrWhiteSpace(rapport.Omschrijving) ? string.Empty : $". {rapport.Omschrijving}"));
        if (!string.IsNullOrWhiteSpace(rapport.OpstapVersie))
        {
            sb.AppendLine($"- Op.stap-versie van de gouden codes: {rapport.OpstapVersie}");
        }

        sb.AppendLine($"- Doelen in de prompt: {(rapport.Weergave == DoelWeergave.Compact ? "compact" : "volledig")}, " +
            $"hoogstens {rapport.MaxSuggesties} suggesties per subthema");
        sb.AppendLine();

        WriteSummary(sb, rapport);
        WriteRetrieval(sb, rapport);
        WriteWarnings(sb, rapport);
        WritePerCase(sb, rapport);

        return sb.ToString();
    }

    private static void WriteSummary(StringBuilder sb, EvalRapport rapport)
    {
        sb.AppendLine("## Samenvatting");
        sb.AppendLine();
        sb.AppendLine("- **Precisie:** het deel van de voorgestelde codes dat in de gouden set staat. Een code buiten de " +
            "kandidatenlijst telt als fout.");
        sb.AppendLine("- **Recall:** het deel van de gouden codes dat voorgesteld werd.");
        sb.AppendLine("- **Bij de kandidaten:** het deel van de gouden codes dat in de kandidatenlijst stond. Hoger kan de " +
            "recall niet. Een geval waarvoor geen kandidaten gevonden konden worden, telt hier en in \"Kandidaten (gem.)\" " +
            "niet mee; het staat bij Fouten.");
        sb.AppendLine("- **Tokens, kost en latency** tellen elke aanroep die een antwoord kreeg, ook een ongeldig antwoord. " +
            "De latency is die van de laatste poging, zonder wachttijd na een 429.");
        sb.AppendLine();
        sb.AppendLine("| Variant | Model | Gevallen | Fouten | Precisie | Recall | Bij de kandidaten | Kandidaten (gem.) | " +
            "Invoertokens | Waarvan gecachet | Uitvoertokens | Kost chat | Latency p50 | Latency p95 |");
        sb.AppendLine("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");

        foreach (var variant in rapport.Varianten)
        {
            // Only cases where the candidates were found: the same rule as the retrieval table, so that "Bij de
            // kandidaten" means one thing in the whole report.
            var metingen = rapport.Kandidaten.Where(k => k.Variant == variant && k.Fout is null).ToList();
            foreach (var model in rapport.Modellen)
            {
                var rows = rapport.Resultaten.Where(r => r.Variant == variant && r.Model == model).ToList();
                if (rows.Count == 0)
                {
                    continue;
                }

                var hits = rows.Sum(r => r.Score.Treffers.Count);
                var proposed = rows.Sum(r => r.Score.AantalVoorgesteld);
                var gold = rows.Sum(r => r.Score.Gouden.Count);
                var durations = rows.Where(r => r.Beantwoord).Select(r => r.Duur).ToList();

                sb.AppendLine(string.Join(" | ",
                    $"| {Cell(variant)}",
                    Cell(model),
                    rows.Count.ToString(Nl),
                    rows.Count(r => r.Fout is not null).ToString(Nl),
                    Percent(proposed == 0 ? null : (double)hits / proposed),
                    Percent(gold == 0 ? null : (double)hits / gold),
                    Percent(CandidateRecall(metingen)),
                    metingen.Count == 0 ? "-" : metingen.Average(m => m.AantalKandidaten).ToString("0", Nl),
                    TokenSum(rows, u => u.InputTokens),
                    TokenSum(rows, u => u.CachedInputTokens),
                    TokenSum(rows, u => u.OutputTokens),
                    ChatCost(rows, rapport.Prijzen.GetValueOrDefault(model)),
                    Seconds(Percentile(durations, 0.50)),
                    $"{Seconds(Percentile(durations, 0.95))} |"));
            }
        }

        sb.AppendLine();
    }

    private static void WriteRetrieval(StringBuilder sb, EvalRapport rapport)
    {
        var withEmbeddings = rapport.Kandidaten.Where(k => k.EmbeddingModel is not null).ToList();
        if (withEmbeddings.Count == 0)
        {
            return;
        }

        sb.AppendLine("## Retrieval");
        sb.AppendLine();
        sb.AppendLine("| Variant | Embeddingmodel | Tokens | Kost | Fouten | Bij de kandidaten |");
        sb.AppendLine("| --- | --- | ---: | ---: | ---: | ---: |");
        foreach (var group in withEmbeddings.GroupBy(k => (k.Variant, k.EmbeddingModel)))
        {
            // Tokens and cost count every case, a failed one included (it was paid for); the retrieval figure counts
            // only cases where retrieval ran, so a failing embedding call does not read as a retrieval miss.
            var tokens = group.Sum(k => k.EmbeddingTokens);
            var price = rapport.Prijzen.GetValueOrDefault(group.Key.EmbeddingModel!);
            var cost = price?.Input is { } input ? Amount(tokens * input / 1_000_000m) : "onbekend";
            var failed = group.Count(k => k.Fout is not null);
            sb.AppendLine($"| {Cell(group.Key.Variant)} | {Cell(group.Key.EmbeddingModel!)} | {tokens.ToString("N0", Nl)} | " +
                $"{cost} | {failed.ToString(Nl)} | {Percent(CandidateRecall(group.Where(k => k.Fout is null).ToList()))} |");
        }

        sb.AppendLine();
        sb.AppendLine("De eerste run maakt de embeddings van de catalogus en is daardoor duurder; latere runs lezen ze uit " +
            "de cache. Een geval dat faalde, telt mee in tokens en kost, niet in \"Bij de kandidaten\".");
        sb.AppendLine();
    }

    private static void WriteWarnings(StringBuilder sb, EvalRapport rapport)
    {
        var firstVariant = rapport.Varianten[0];
        var outsideJaarfase = rapport.Kandidaten
            .Where(k => k.Variant == firstVariant && k.Fout is null && k.EmbeddingModel is null
                && k.GoudenInKandidaten < k.AantalGouden)
            .ToList();
        var failed = rapport.Kandidaten.Where(k => k.Fout is not null).ToList();
        if (outsideJaarfase.Count == 0 && failed.Count == 0)
        {
            return;
        }

        sb.AppendLine("## Waarschuwingen");
        sb.AppendLine();
        foreach (var k in outsideJaarfase)
        {
            sb.AppendLine($"- Geval `{k.GevalId}`: {k.AantalGouden - k.GoudenInKandidaten} van de {k.AantalGouden} gouden " +
                $"codes horen niet bij jaarfase {k.Leeftijd}, of staan niet in de catalogus.");
        }

        foreach (var k in failed)
        {
            sb.AppendLine($"- Geval `{k.GevalId}` in {k.Variant}: geen kandidaten ({Cell(k.Fout!)}).");
        }

        sb.AppendLine();
    }

    private static void WritePerCase(StringBuilder sb, EvalRapport rapport)
    {
        sb.AppendLine("## Per geval");
        foreach (var variant in rapport.Varianten)
        {
            foreach (var model in rapport.Modellen)
            {
                var rows = rapport.Resultaten.Where(r => r.Variant == variant && r.Model == model).ToList();
                if (rows.Count == 0)
                {
                    continue;
                }

                sb.AppendLine();
                sb.AppendLine($"### {variant} · {model}");
                sb.AppendLine();
                sb.AppendLine("| Geval | Kandidaten | Gouden | Treffers | Gemist | Extra | Onbekende codes | Tokens in / uit | Duur | Fout |");
                sb.AppendLine("| --- | ---: | ---: | --- | --- | --- | --- | ---: | ---: | --- |");
                foreach (var r in rows)
                {
                    var tokens = r.Verbruik is null
                        ? "-"
                        : $"{r.Verbruik.InputTokens.ToString("N0", Nl)} / {r.Verbruik.OutputTokens.ToString("N0", Nl)}";
                    sb.AppendLine($"| `{Cell(r.GevalId)}` | {r.Score.AantalKandidaten.ToString(Nl)} | " +
                        $"{r.Score.Gouden.Count.ToString(Nl)} | {CodeList(r.Score.Treffers)} | {CodeList(r.Score.Gemist)} | " +
                        $"{CodeList(r.Score.Extra)} | {CodeList(r.Score.Onbekend)} | {tokens} | " +
                        $"{(r.Beantwoord ? Seconds(r.Duur) : "-")} | {(r.Fout is null ? string.Empty : Cell(r.Fout))} |");
                }
            }
        }
    }

    private static double? CandidateRecall(IReadOnlyCollection<KandidaatMeting> metingen)
    {
        var gold = metingen.Sum(m => m.AantalGouden);
        return gold == 0 ? null : (double)metingen.Sum(m => m.GoudenInKandidaten) / gold;
    }

    private static string TokenSum(IReadOnlyCollection<GevalResultaat> rows, Func<AiUsage, int> field)
    {
        var withUsage = rows.Where(r => r.Verbruik is not null).ToList();
        return withUsage.Count == 0 ? "-" : withUsage.Sum(r => field(r.Verbruik!)).ToString("N0", Nl);
    }

    // Every call that got a response was billed, a rejected answer included, so every one counts. The cost is shown
    // only when each of them reported its usage and the price list knows the model: a partial sum would understate the
    // cost and read as a real figure.
    private static string ChatCost(IReadOnlyCollection<GevalResultaat> rows, ModelPrice? price)
    {
        var answered = rows.Where(r => r.Beantwoord).ToList();
        if (price?.Input is not { } input || price.Output is not { } output
            || answered.Count == 0 || answered.Any(r => r.Verbruik is null))
        {
            return "onbekend";
        }

        var cached = price.CachedInput ?? input;
        var total = answered.Sum(r =>
            (r.Verbruik!.InputTokens - r.Verbruik.CachedInputTokens) * input
            + r.Verbruik.CachedInputTokens * cached
            + r.Verbruik.OutputTokens * output) / 1_000_000m;
        return Amount(total);
    }

    private static TimeSpan? Percentile(IReadOnlyList<TimeSpan> durations, double p)
    {
        if (durations.Count == 0)
        {
            return null;
        }

        var sorted = durations.Order().ToList();
        var index = Math.Clamp((int)Math.Ceiling(p * sorted.Count) - 1, 0, sorted.Count - 1);
        return sorted[index];
    }

    private static string Percent(double? value) =>
        value is null ? "-" : (value.Value * 100).ToString("0", Nl) + "%";

    private static string Seconds(TimeSpan? duration) =>
        duration is null ? "-" : duration.Value.TotalSeconds.ToString("0.0", Nl) + " s";

    private static string Amount(decimal amount) => amount.ToString("0.0000", Nl);

    private static string CodeList(IReadOnlyList<string> codes) =>
        codes.Count == 0 ? string.Empty : string.Join(", ", codes.Select(c => $"`{Cell(c)}`"));

    private static string Cell(string text) => text.Replace("|", "\\|").Replace("\r", " ").Replace("\n", " ");
}
