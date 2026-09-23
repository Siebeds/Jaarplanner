using Jaarplanner.Application.Kat.Chat;

namespace Jaarplanner.UnitTests.Kat.Chat;

/// <summary>How a typed name finds a thema, subthema or activiteit (FB-031), and the handleiding the chat ships with.</summary>
public sealed class NaamzoekerEnHandleidingTests
{
    private sealed record Ding(Guid Id, string Naam);

    private static readonly Ding Herfst = new(Guid.NewGuid(), "Herfst");
    private static readonly Ding Herfstbladeren = new(Guid.NewGuid(), "Herfstbladeren");
    private static readonly Ding Egel = new(Guid.NewGuid(), "De egel in de herfst");
    private static readonly Ding Cafe = new(Guid.NewGuid(), "Op café");

    private static List<Ding> Vind(string term) =>
        Naamzoeker.Vind(term, [Herfst, Herfstbladeren, Egel, Cafe], d => d.Id, d => d.Naam);

    [Theory]
    [InlineData("herfst")]
    [InlineData(" HERFST ")]
    [InlineData("'Herfst'")]
    public void Een_exacte_naam_wint_van_namen_die_ze_bevatten(string term) => Assert.Equal([Herfst], Vind(term));

    [Fact]
    public void Een_deel_van_de_naam_vindt_wat_het_bevat() => Assert.Equal([Egel], Vind("egel"));

    [Fact]
    public void Een_term_die_de_naam_als_woorden_bevat_vindt_die_naam() =>
        Assert.Equal([Herfstbladeren], Vind("het thema herfstbladeren"));

    [Fact]
    public void Alle_woorden_van_de_term_in_de_naam() => Assert.Equal([Egel], Vind("egel herfst de in"));

    [Fact]
    public void Accenten_tellen_niet() => Assert.Equal([Cafe], Vind("op cafe"));

    [Fact]
    public void Een_id_vindt_precies_dat_ding() => Assert.Equal([Egel], Vind(Egel.Id.ToString()));

    [Fact]
    public void Niets_passends_is_leeg() => Assert.Empty(Vind("ruimtevaart"));

    [Fact]
    public void De_ingebouwde_handleiding_heeft_de_hoofdstukken_die_de_chat_nodig_heeft()
    {
        var handleiding = Handleiding.Standaard;

        Assert.Contains("Een algemene fiche plannen", handleiding.Hoofdstukken);
        Assert.Contains("Waarom een doel niet gedekt is", handleiding.Hoofdstukken);
        Assert.Contains("Met Chuck praten", handleiding.Hoofdstukken);
        Assert.Equal(handleiding.Hoofdstukken.Count, handleiding.Hoofdstukken.Distinct(StringComparer.OrdinalIgnoreCase).Count());
        Assert.DoesNotContain("\r", handleiding.Tekst);
    }

    [Fact]
    public void De_handleiding_heeft_geen_gedachtestreepjes() =>
        Assert.DoesNotContain("—", Handleiding.Standaard.Tekst);
}
