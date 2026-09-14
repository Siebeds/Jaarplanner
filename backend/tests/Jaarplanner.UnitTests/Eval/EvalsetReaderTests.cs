using Jaarplanner.Eval;

namespace Jaarplanner.UnitTests.Eval;

/// <summary>Reading and checking an evalset (TB-004).</summary>
public sealed class EvalsetLezerTests
{
    private const string GeldigGeval =
        """
        {"id":"g1","thema":{"naam":"Water"},"subthema":{"naam":"Plassen","leeftijd":"K3"},"goudenCodes":["W-01"]}
        """;

    /// <summary>The fictional example committed in the repo stays readable, so the README's format is not a lie.</summary>
    [Fact]
    public void Het_voorbeeld_in_de_repo_is_een_geldige_evalset()
    {
        var evalset = EvalsetLezer.LeesBestand(Path.Combine(AppContext.BaseDirectory, "Eval", "voorbeeld-evalset.json"));

        Assert.Equal(2, evalset.Gevallen.Count);
        var bakker = evalset.Gevallen[0];
        Assert.Equal("voorbeeld-k3-bakker", bakker.Id);
        Assert.Equal("K3", bakker.Subthema.Leeftijd);
        Assert.Equal(2, bakker.Subthema.Activiteiten!.Count);
        Assert.Equal(["VB-WIS-K3-01", "VB-NED-K3-02"], bakker.GoudenCodes);
    }

    [Fact]
    public void Een_minimale_evalset_wordt_gelezen()
    {
        var evalset = EvalsetLezer.Lees($$"""{"formaatversie":1,"gevallen":[{{GeldigGeval}}]}""");

        var geval = Assert.Single(evalset.Gevallen);
        Assert.Equal("Water", geval.Thema.Naam);
        Assert.Equal(["W-01"], geval.GoudenCodes);
    }

    [Theory]
    [InlineData("niet eens json")]
    [InlineData("""{"gevallen":[]}""")]
    [InlineData("""{"formaatversie":2,"gevallen":[{"id":"g1","thema":{"naam":"W"},"subthema":{"naam":"P","leeftijd":"K3"},"goudenCodes":["A"]}]}""")]
    [InlineData("""{"gevallen":[{"id":"g1","thema":{"naam":"W"},"subthema":{"naam":"P","leeftijd":"K3"},"goudenCodes":[]}]}""")]
    [InlineData("""{"gevallen":[{"id":"g1","thema":{"naam":"W"},"subthema":{"naam":"P","leeftijd":" "},"goudenCodes":["A"]}]}""")]
    [InlineData("""{"gevallen":[{"id":"g1","thema":{"naam":"W"},"goudenCodes":["A"]}]}""")]
    public void Een_onbruikbare_evalset_wordt_geweigerd(string json)
    {
        Assert.Throws<EvalsetFout>(() => EvalsetLezer.Lees(json));
    }

    [Fact]
    public void Een_dubbel_geval_id_wordt_geweigerd()
    {
        var fout = Assert.Throws<EvalsetFout>(() =>
            EvalsetLezer.Lees($$"""{"gevallen":[{{GeldigGeval}},{{GeldigGeval}}]}"""));

        Assert.Contains("g1", fout.Message);
    }
}
