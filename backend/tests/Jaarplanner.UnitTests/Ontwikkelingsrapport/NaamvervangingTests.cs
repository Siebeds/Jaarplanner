using Jaarplanner.Application.Ontwikkelingsrapport;

namespace Jaarplanner.UnitTests.Ontwikkelingsrapport;

/// <summary>
/// <see cref="Naamvervanging"/>: what leaves the server when a teacher asks the AI to rewrite a rapporttekst (FB-004,
/// R21, R25, ADR-0035 §3.5 D14). The rule that earns most of these tests is D14's: the match follows the capitals of
/// the stored name, so an ordinary word that is also a first name survives in lower case.
/// <para>All names here are made up, as everywhere in this repo.</para>
/// </summary>
public sealed class NaamvervangingTests
{
    private static readonly string[] Klas = ["Roos", "Proefmans", "Staf", "Voorbeeld"];

    [Fact]
    public void Maskeert_elke_naam_van_de_klas_en_laat_hetzelfde_woord_in_kleine_letters_staan()
    {
        var masker = Naamvervanging.Maskeer("Roos tekende deze periode vaak een roos en speelde graag met Staf.", Klas);

        Assert.Equal("#NAAM1# tekende deze periode vaak een roos en speelde graag met #NAAM2#.", masker.Tekst);
        Assert.Equal("Roos", masker.Plaatshouders["#NAAM1#"]);
        Assert.Equal("Staf", masker.Plaatshouders["#NAAM2#"]);
    }

    [Fact]
    public void Hetzelfde_kind_twee_keer_krijgt_een_plaatshouder()
    {
        var masker = Naamvervanging.Maskeer("Roos speelt graag. Roos vertelt veel.", Klas);

        Assert.Equal("#NAAM1# speelt graag. #NAAM1# vertelt veel.", masker.Tekst);
        Assert.Single(masker.Plaatshouders);
    }

    [Theory]
    // A name is a whole word: punctuation, a possessive apostrophe and a hyphen all end one.
    [InlineData("Roos, Staf en ik.", "#NAAM1#, #NAAM2# en ik.")]
    [InlineData("Dat is Roos' jas.", "Dat is #NAAM1#' jas.")]
    [InlineData("(Roos)", "(#NAAM1#)")]
    // ... but a longer word that merely starts or ends with a name is not that name.
    [InlineData("Rooske speelt.", "Rooske speelt.")]
    [InlineData("Een grootstaf.", "Een grootstaf.")]
    public void Vervangt_alleen_hele_woorden(string tekst, string verwacht) =>
        Assert.Equal(verwacht, Naamvervanging.Maskeer(tekst, Klas).Tekst);

    [Fact]
    public void Een_zin_die_met_de_naam_in_hoofdletters_begint_wordt_wel_vervangen()
    {
        // D14 costs a word here, not a name: "Roos" capitalised is treated as the child.
        var masker = Naamvervanging.Maskeer("Roos is een mooie bloem.", Klas);

        Assert.Equal("#NAAM1# is een mooie bloem.", masker.Tekst);
    }

    [Fact]
    public void De_langste_naam_wint_van_een_naam_die_erin_zit()
    {
        var masker = Naamvervanging.Maskeer("Ik zag Van den Berg met Berg.", ["Berg", "Van den Berg"]);

        Assert.Equal("#NAAM1# met #NAAM2#.", masker.Tekst["Ik zag ".Length..]);
        Assert.Equal("Van den Berg", masker.Plaatshouders["#NAAM1#"]);
        Assert.Equal("Berg", masker.Plaatshouders["#NAAM2#"]);
    }

    [Fact]
    public void Een_tekst_zonder_naam_van_de_klas_gaat_ongewijzigd_en_zonder_plaatshouders()
    {
        var masker = Naamvervanging.Maskeer("Het kind speelt graag buiten.", Klas);

        Assert.Equal("Het kind speelt graag buiten.", masker.Tekst);
        Assert.Empty(masker.Plaatshouders);
    }

    [Fact]
    public void Een_klas_zonder_namen_verandert_niets()
    {
        var masker = Naamvervanging.Maskeer("Roos speelt.", ["", "   "]);

        Assert.Equal("Roos speelt.", masker.Tekst);
        Assert.Empty(masker.Plaatshouders);
    }

    [Fact]
    public void Herstel_zet_precies_terug_wat_gemaskeerd_werd()
    {
        const string origineel = "Roos tekende vaak een roos en speelde met Staf Voorbeeld.";
        var masker = Naamvervanging.Maskeer(origineel, Klas);

        Assert.Equal(origineel, Naamvervanging.Herstel(masker.Tekst, masker.Plaatshouders));
    }

    [Fact]
    public void Herstel_werkt_ook_als_het_model_de_plaatshouders_verplaatste()
    {
        var masker = Naamvervanging.Maskeer("Roos speelde met Staf.", Klas);

        Assert.Equal(
            "Staf en Roos speelden samen.",
            Naamvervanging.Herstel("#NAAM2# en #NAAM1# speelden samen.", masker.Plaatshouders));
    }

    [Fact]
    public void Heeft_precies_deze_aanvaardt_dezelfde_plaatshouders_in_een_andere_volgorde_en_aantal()
    {
        var masker = Naamvervanging.Maskeer("Roos speelde met Staf. Roos vertelde erover.", Klas);

        // Two sentences joined into one: the repeat is gone, both children are still named.
        Assert.True(Naamvervanging.HeeftPreciesDeze("#NAAM2# en #NAAM1# speelden en vertelden.", masker.Plaatshouders));
    }

    [Fact]
    public void Heeft_precies_deze_weigert_een_verdwenen_naam()
    {
        var masker = Naamvervanging.Maskeer("Roos speelde met Staf.", Klas);

        Assert.False(Naamvervanging.HeeftPreciesDeze("#NAAM1# speelde met een vriendje.", masker.Plaatshouders));
    }

    [Fact]
    public void Heeft_precies_deze_weigert_een_verzonnen_plaatshouder()
    {
        var masker = Naamvervanging.Maskeer("Roos speelde.", Klas);

        Assert.False(Naamvervanging.HeeftPreciesDeze("#NAAM1# speelde met #NAAM9#.", masker.Plaatshouders));
    }

    [Fact]
    public void Een_plaatshouder_die_de_leerkracht_zelf_typte_blijft_van_haar()
    {
        // Vanishingly rare, but the cost of getting it wrong is a child's name put where she wrote a token. Her own
        // token is mapped to itself, and the names get numbers above it.
        var masker = Naamvervanging.Maskeer("Roos schreef #NAAM1# op het bord.", Klas);

        Assert.Equal("#NAAM2# schreef #NAAM1# op het bord.", masker.Tekst);
        Assert.Equal("#NAAM1#", masker.Plaatshouders["#NAAM1#"]);
        Assert.Equal("Roos", masker.Plaatshouders["#NAAM2#"]);
        Assert.Equal("Roos schreef #NAAM1# op het bord.", Naamvervanging.Herstel(masker.Tekst, masker.Plaatshouders));
        Assert.True(Naamvervanging.HeeftPreciesDeze(masker.Tekst, masker.Plaatshouders));
    }

    [Fact]
    public void Een_zelf_getypte_plaatshouder_zonder_naam_van_de_klas_telt_ook_mee()
    {
        var masker = Naamvervanging.Maskeer("Het kind schreef #NAAM3# op het bord.", Klas);

        Assert.Equal("Het kind schreef #NAAM3# op het bord.", masker.Tekst);
        Assert.True(Naamvervanging.HeeftPreciesDeze(masker.Tekst, masker.Plaatshouders));
        Assert.False(Naamvervanging.HeeftPreciesDeze("Het kind schreef niets op het bord.", masker.Plaatshouders));
    }

    [Fact]
    public void Heeft_precies_deze_weigert_een_plaatshouder_in_een_tekst_die_er_geen_kreeg()
    {
        var masker = Naamvervanging.Maskeer("Het kind speelt graag buiten.", Klas);

        Assert.True(Naamvervanging.HeeftPreciesDeze("Het kind speelt graag buiten.", masker.Plaatshouders));
        Assert.False(Naamvervanging.HeeftPreciesDeze("#NAAM1# speelt graag buiten.", masker.Plaatshouders));
    }
}
