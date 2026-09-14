using Jaarplanner.Application.AiAuthoring;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Eval;

namespace Jaarplanner.UnitTests.Eval;

/// <summary>Small, fictional building blocks for the eval runner's tests (TB-004).</summary>
internal static class EvalTestData
{
    internal static Leerplandoel Doel(string code, string jaarFase, string tekst, string? voorbeelden = null) =>
        new(code, Doelsoort.Gemeenschappelijk, jaarFase, "Wereldoriëntatie", "Natuur", "9",
            tekst: tekst, voorbeelden: voorbeelden);

    /// <summary>Three K3 goals (two about water, one about sand) and one L1 goal.</summary>
    internal static IReadOnlyList<Leerplandoel> Catalogus() =>
    [
        Doel("W-01", "K3", "De kleuter onderzoekt water.", voorbeelden: "Gieten, schenken."),
        Doel("W-02", "K3", "De kleuter merkt wat drijft in water."),
        Doel("Z-01", "K3", "De kleuter bouwt met zand."),
        Doel("L-01", "L1", "De leerling leest een korte tekst."),
    ];

    internal static EvalGeval WaterGeval(params string[] gouden) => new()
    {
        Id = "k3-water",
        Thema = new ThemaOpbouwContext { Naam = "Water" },
        Subthema = new SubthemaOpbouwContext
        {
            Naam = "Plassen",
            Leeftijd = "K3",
            Onderzoeksvragen = [new OnderzoeksvraagOpbouwContext { Vraag = "Waar blijft het water?" }],
            Activiteiten =
            [
                new ActiviteitOpbouwContext
                {
                    Naam = "Watertafel",
                    Hoek = "Waterhoek",
                    VerwachteUitkomsten = "De kleuters gieten over en zien wat drijft.",
                },
            ],
        },
        GoudenCodes = gouden,
    };

    internal static EvalGeval ZandGeval(params string[] gouden) => new()
    {
        Id = "k3-zand",
        Thema = new ThemaOpbouwContext { Naam = "Zandbak" },
        Subthema = new SubthemaOpbouwContext
        {
            Naam = "Kastelen bouwen",
            Leeftijd = "K3",
            Activiteiten = [new ActiviteitOpbouwContext { Naam = "Zandkastelen" }],
        },
        GoudenCodes = gouden,
    };

    /// <summary>
    /// Embeds by keyword: a text about water points one way, a text about sand another, anything else in between.
    /// Enough to show that variant B ranks and cuts, with no network.
    /// </summary>
    internal sealed class FakeEmbedder : IEmbeddingClient
    {
        public string Model => "fake-embedding";

        public int AantalAanroepen { get; private set; }

        public Task<EmbeddingResult> EmbedAsync(IReadOnlyList<string> texts, CancellationToken cancellationToken)
        {
            AantalAanroepen++;
            var vectoren = texts
                .Select(t => t.Contains("water", StringComparison.OrdinalIgnoreCase) ? new[] { 1f, 0f }
                    : t.Contains("zand", StringComparison.OrdinalIgnoreCase) ? new[] { 0f, 1f }
                    : new[] { 0.5f, 0.5f })
                .ToList();
            return Task.FromResult(new EmbeddingResult(vectoren, texts.Count * 10));
        }
    }
}
