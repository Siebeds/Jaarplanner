using Jaarplanner.Application.Kat.Chat;

namespace Jaarplanner.UnitTests.Kat.Chat;

/// <summary>The chat turn's contract (FB-031, ADR-0066, Art. IV.5): what is accepted, and that nothing else is.</summary>
public sealed class KatchatAntwoordParserTests
{
    private static readonly Handleiding Handleiding = new("# H\n\n## De agenda\n\nTekst.\n\n## Het jaarplan\n\nTekst.\n");

    private static Katbesluit Parse(string inhoud) => KatchatAntwoordParser.Parse(inhoud, Handleiding);

    [Fact]
    public void Een_uitleg_houdt_alleen_de_hoofdstukken_die_de_handleiding_heeft()
    {
        var besluit = Parse("""{"soort":"uitleg","antwoord":" Zo werkt het. ","hoofdstukken":["de agenda","Verzonnen","De agenda"]}""");

        Assert.Equal(Katbesluitsoort.Uitleg, besluit.Soort);
        Assert.Equal("Zo werkt het.", besluit.Uitleg);
        Assert.Equal(["De agenda"], besluit.Hoofdstukken);
    }

    [Theory]
    [InlineData("""{"soort":"uitleg","antwoord":"Zo.","hoofdstukken":[]}""")]
    [InlineData("""{"soort":"uitleg","antwoord":"Zo."}""")]
    [InlineData("""{"soort":"uitleg","antwoord":"Zo.","hoofdstukken":["Niet in de handleiding"]}""")]
    public void Een_uitleg_zonder_hoofdstuk_uit_de_handleiding_is_onbekend(string inhoud) =>
        Assert.Equal(Katbesluitsoort.Onbekend, Parse(inhoud).Soort);

    [Fact]
    public void Een_opzoeking_draagt_haar_termen()
    {
        var besluit = Parse("""
            ```json
            {"Soort":"Opzoeking","Opzoeking":{"Vraag":"doelInThema","Doel":" G-WO-01 ","Thema":"Herfst","extra":1}}
            ```
            """);

        Assert.Equal(Katbesluitsoort.Opzoeking, besluit.Soort);
        Assert.Equal(new Katopzoeking(Katvraag.DoelInThema, Doel: "G-WO-01", Thema: "Herfst"), besluit.Opzoeking);
    }

    [Fact]
    public void Onbekend_is_onbekend() => Assert.Equal(Katbesluitsoort.Onbekend, Parse("""{"soort":"onbekend"}""").Soort);

    [Theory]
    [InlineData("")]
    [InlineData("geen json")]
    [InlineData("[]")]
    [InlineData("""{"soort":"iets anders"}""")]
    [InlineData("""{"soort":"uitleg","hoofdstukken":["De agenda"]}""")]
    [InlineData("""{"soort":"opzoeking"}""")]
    [InlineData("""{"soort":"opzoeking","opzoeking":{"vraag":"bestaatNiet","doel":"x"}}""")]
    [InlineData("""{"soort":"opzoeking","opzoeking":{"vraag":"1","doel":"x"}}""")]
    [InlineData("""{"soort":"opzoeking","opzoeking":{"vraag":"doelInThema","doel":"x"}}""")]
    [InlineData("""{"soort":"opzoeking","opzoeking":{"vraag":"activiteitInSubthema","activiteit":"a","subthema":"  "}}""")]
    public void Al_de_rest_mislukt(string inhoud) => Assert.Equal(Katbesluitsoort.Mislukt, Parse(inhoud).Soort);

    [Fact]
    public void Een_te_lange_uitleg_mislukt()
    {
        var lang = new string('a', KatchatPromptBuilder.MaxUitlegLengte + 1);

        Assert.Equal(Katbesluitsoort.Mislukt, Parse($$"""{"soort":"uitleg","antwoord":"{{lang}}","hoofdstukken":["De agenda"]}""").Soort);
    }

    [Fact]
    public void Een_te_lange_term_mislukt()
    {
        var lang = new string('a', Katopzoeking.MaxTermLengte + 1);

        Assert.Equal(Katbesluitsoort.Mislukt, Parse($$$"""{"soort":"opzoeking","opzoeking":{"vraag":"waarGebruikt","doel":"{{{lang}}}"}}""").Soort);
    }
}
