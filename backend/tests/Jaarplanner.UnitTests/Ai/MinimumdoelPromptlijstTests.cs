using Jaarplanner.Application.Ai;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.UnitTests.Ai;

/// <summary>
/// The candidate minimumdoel list of the thema-level prompts (FB-053): grouped per mijlpaal and per decreed ordering,
/// one line per goal, and byte-identical for the same goals whatever order they arrive in.
/// </summary>
public sealed class MinimumdoelPromptlijstTests
{
    private const string Nl = "\n";

    private static IReadOnlyList<Minimumdoel> Doelen() =>
    [
        new Minimumdoel("4-1.1.1", "4-", "1.1.1", "De leerlingen lezen vlot.", "Nederlands", "Lezen"),
        new Minimumdoel("K-2.1.1", "K-", "2.1.1", "De kleuters kunnen tot tien tellen.", "Wiskunde", "Getallen", "Tellen"),
        new Minimumdoel("K-1.1.2", "K-", "1.1.2", "De kleuters herkennen een klank\nin een woord.", "Nederlands", "Lezen", "Vlot en vloeiend lezen"),
        new Minimumdoel("K-9.9.9", "K-", "9.9.9", "Een doel zonder ordening."),
        new Minimumdoel("K-1.1.1", "K-", "1.1.1", "De kleuters kunnen rijm herkennen.", "Nederlands", "Lezen", "Vlot en vloeiend lezen"),
        new Minimumdoel("6-1.1.1", "6-", "1.1.1", "De leerlingen lezen kritisch.", "Nederlands", "Lezen"),
    ];

    [Fact]
    public void Schrijft_de_verwachte_lijst()
    {
        var verwacht = string.Join(Nl,
        [
            "# Beschikbare minimumdoelen",
            "",
            "## Mijlpaal K-",
            "",
            "### Nederlands > Lezen > Vlot en vloeiend lezen",
            "- K-1.1.1: De kleuters kunnen rijm herkennen.",
            "- K-1.1.2: De kleuters herkennen een klank in een woord.",
            "",
            "### Wiskunde > Getallen > Tellen",
            "- K-2.1.1: De kleuters kunnen tot tien tellen.",
            "",
            "### (zonder ordening)",
            "- K-9.9.9: Een doel zonder ordening.",
            "",
            "## Mijlpaal 4-",
            "",
            "### Nederlands > Lezen",
            "- 4-1.1.1: De leerlingen lezen vlot.",
            "",
            "## Mijlpaal 6-",
            "",
            "### Nederlands > Lezen",
            "- 6-1.1.1: De leerlingen lezen kritisch.",
        ]) + Nl;

        Assert.Equal(verwacht, MinimumdoelPromptlijst.Bouw(Doelen()));
    }

    [Fact]
    public void Is_byte_gelijk_ongeacht_de_volgorde_en_dubbels()
    {
        var omgekeerd = Doelen().Reverse().Concat(Doelen().Take(2)).ToList();

        Assert.Equal(MinimumdoelPromptlijst.Bouw(Doelen()), MinimumdoelPromptlijst.Bouw(omgekeerd));
    }

    [Fact]
    public void Een_lege_lijst_zegt_dat()
    {
        Assert.Equal($"# Beschikbare minimumdoelen{Nl}{Nl}- (geen minimumdoelen aangeleverd){Nl}", MinimumdoelPromptlijst.Bouw([]));
    }
}
