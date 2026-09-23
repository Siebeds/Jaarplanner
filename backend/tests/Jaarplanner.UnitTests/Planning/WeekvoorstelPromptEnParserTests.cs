using Jaarplanner.Application.Kat;
using Jaarplanner.Application.Planning.Weekvoorstel;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>The weekvoorstel's prompt and the reading of its answer (FB-027, ADR-0067 W2, Art. IV.4, IV.5).</summary>
public sealed class WeekvoorstelPromptEnParserTests
{
    private static readonly DateOnly Maandag = new(2026, 9, 28);
    private static readonly DateOnly Dinsdag = new(2026, 9, 29);

    [Fact]
    public void De_prompt_noemt_de_kandidaten_bij_hun_sleutel_en_de_dagen_met_hun_vrije_momenten()
    {
        var kandidaat = new Weekkandidaat(
            "A1", Guid.NewGuid(), "Bladeren stempelen", ActiviteitType.Experiment, "Ze drukken bladeren in klei.", 2,
            "Bladeren", new HashSet<DateOnly> { Dinsdag });
        var dagen = new[]
        {
            new Schooldagvenster(Maandag, Uren(Maandag), [new Tijdvak(new TimeOnly(8, 30), new TimeOnly(15, 30))]),
            new Schooldagvenster(Dinsdag, Uren(Dinsdag), [new Tijdvak(new TimeOnly(13, 15), new TimeOnly(14, 0))]),
        };

        var verzoek = WeekvoorstelPromptBuilder.Bouw(new WeekvoorstelContext("K3", [kandidaat], dagen));

        Assert.Contains("A1: Bladeren stempelen", verzoek.UserPrompt, StringComparison.Ordinal);
        Assert.Contains("Subthema: Bladeren", verzoek.UserPrompt, StringComparison.Ordinal);
        Assert.Contains("Lengte: 2 lesuren", verzoek.UserPrompt, StringComparison.Ordinal);
        Assert.Contains("Kan op: 2026-09-29", verzoek.UserPrompt, StringComparison.Ordinal);
        Assert.Contains("2026-09-29 (dinsdag), vrij: 08:30-12:00, 14:00-15:30", verzoek.UserPrompt, StringComparison.Ordinal);

        // A full day is left out rather than listed.
        Assert.DoesNotContain("2026-09-28 (", verzoek.UserPrompt, StringComparison.Ordinal);

        // No database id reaches the model.
        Assert.DoesNotContain(kandidaat.ActiviteitId.ToString(), verzoek.UserPrompt, StringComparison.Ordinal);
    }

    [Fact]
    public void Het_contract_vraagt_een_dag_en_een_motivatie_en_geen_uur()
    {
        var systeem = WeekvoorstelPromptBuilder.SystemPrompt;

        Assert.Contains("\"activiteit\"", systeem, StringComparison.Ordinal);
        Assert.Contains("\"dag\"", systeem, StringComparison.Ordinal);
        Assert.Contains("\"motivatie\"", systeem, StringComparison.Ordinal);
        Assert.DoesNotContain("\"beginuur\"", systeem, StringComparison.Ordinal);
        Assert.Contains("Het uur kies je niet", systeem, StringComparison.Ordinal);
    }

    [Fact]
    public void Een_geldig_antwoord_wordt_gelezen_ook_in_een_codeblok()
    {
        var resultaat = WeekvoorstelResponseParser.Parse(
            "```json\n{\"activiteiten\": [{\"activiteit\": \" A1 \", \"dag\": \"2026-09-29\", \"motivatie\": \"Past.\"}]}\n```");

        Assert.True(resultaat.IsGeldig);
        Assert.Equal([new RuweWeekkeuze("A1", "2026-09-29", "Past.")], resultaat.Keuzes);
    }

    [Fact]
    public void Een_lege_lijst_is_een_geldig_antwoord()
    {
        var resultaat = WeekvoorstelResponseParser.Parse("{\"activiteiten\": []}");

        Assert.True(resultaat.IsGeldig);
        Assert.Empty(resultaat.Keuzes);
    }

    [Theory]
    [InlineData("")]
    [InlineData("geen json")]
    [InlineData("[]")]
    [InlineData("{\"activiteiten\": [null]}")]
    public void Een_onleesbaar_antwoord_wordt_als_geheel_geweigerd(string inhoud)
    {
        var resultaat = WeekvoorstelResponseParser.Parse(inhoud);

        Assert.False(resultaat.IsGeldig);
        Assert.NotNull(resultaat.Fout);
    }

    private static Schooldaguren Uren(DateOnly dag) =>
        new(dag.DayOfWeek, new TimeOnly(8, 30), new TimeOnly(15, 30), new TimeOnly(12, 0), new TimeOnly(13, 15));
}
