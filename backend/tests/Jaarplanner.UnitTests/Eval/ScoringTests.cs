using Jaarplanner.Eval;

namespace Jaarplanner.UnitTests.Eval;

/// <summary>How the eval runner scores an answer against the gold set (TB-004).</summary>
public sealed class ScoringTests
{
    /// <summary>
    /// The ticket's second criterion: a code outside the candidate list counts as a wrong answer and never as a hit,
    /// even when that same code is in the gold set (the model could not have seen it, so it guessed).
    /// </summary>
    [Fact]
    public void Een_code_buiten_de_kandidaten_telt_als_fout_en_nooit_als_treffer()
    {
        var score = Scoring.Score(
            gouden: ["A", "B"],
            kandidaatCodes: ["A", "C"],
            voorgesteld: ["A", "B", "C", "X"]);

        Assert.Equal(["A", "C"], score.Gekozen);
        Assert.Equal(["B", "X"], score.Onbekend);
        Assert.Equal(["A"], score.Treffers);
        Assert.Equal(["B"], score.Gemist);
        Assert.Equal(["C"], score.Extra);
        Assert.Equal(4, score.AantalVoorgesteld);
        Assert.Equal(0.25, score.Precisie);
        Assert.Equal(0.5, score.Recall);
        Assert.Equal(1, score.GoudenInKandidaten);
        Assert.Equal(0.5, score.KandidaatRecall);
    }

    /// <summary>Codes compare ordinally, as production compares a code the AI supplies: <c>a</c> is not <c>A</c>.</summary>
    [Fact]
    public void Een_code_met_andere_hoofdletters_is_onbekend()
    {
        var score = Scoring.Score(gouden: ["A"], kandidaatCodes: ["A"], voorgesteld: ["a"]);

        Assert.Empty(score.Treffers);
        Assert.Equal(["a"], score.Onbekend);
    }

    [Fact]
    public void Een_dubbel_voorstel_telt_een_keer()
    {
        var score = Scoring.Score(gouden: ["A"], kandidaatCodes: ["A"], voorgesteld: ["A", "A"]);

        Assert.Equal(1, score.AantalVoorgesteld);
        Assert.Equal(1.0, score.Precisie);
    }

    [Fact]
    public void Zonder_voorstel_is_er_geen_precisie_en_is_de_recall_nul()
    {
        var score = Scoring.Score(gouden: ["A", "B"], kandidaatCodes: ["A", "B"], voorgesteld: []);

        Assert.Null(score.Precisie);
        Assert.Equal(0.0, score.Recall);
        Assert.Equal(1.0, score.KandidaatRecall);
    }

    [Fact]
    public void Gouden_codes_worden_getrimd_en_ontdubbeld()
    {
        var score = Scoring.Score(gouden: [" A ", "A", ""], kandidaatCodes: ["A"], voorgesteld: ["A"]);

        Assert.Equal(["A"], score.Gouden);
        Assert.Equal(1.0, score.Recall);
    }
}
