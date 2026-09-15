using Jaarplanner.Domain.Ontwikkelingsrapport;
// The type shares its name with its namespace (Art. IX.4 names it); this test namespace of that name would shadow it.
using Rapportentiteit = Jaarplanner.Domain.Ontwikkelingsrapport.Ontwikkelingsrapport;

namespace Jaarplanner.UnitTests.Ontwikkelingsrapport;

/// <summary>
/// The report of one child at one moment (FB-003, Art. IX.4, ADR-0035 §3.1): three moments, a row per rapportdoel only
/// while it holds a star or a text (so D1 can ask for rows), a typed text is <c>manueel</c>, and no fault quotes a text.
/// </summary>
public sealed class OntwikkelingsrapportTests
{
    private static readonly Guid Kind = Guid.NewGuid();
    private static readonly Guid Luisteren = Guid.NewGuid();
    private static readonly Guid Groen = Guid.NewGuid();

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    public void Er_zijn_drie_momenten(int moment)
    {
        Assert.Equal(moment, new Rapportentiteit(Kind, moment).Moment);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(4)]
    [InlineData(-1)]
    public void Een_ander_moment_wordt_geweigerd(int moment)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new Rapportentiteit(Kind, moment));
    }

    [Fact]
    public void Een_rapport_hoort_bij_een_kind()
    {
        Assert.Throws<ArgumentException>(() => new Rapportentiteit(Guid.Empty, 1));
    }

    [Fact]
    public void Een_nieuw_rapport_is_leeg()
    {
        var rapport = new Rapportentiteit(Kind, 1);

        Assert.Empty(rapport.Beoordelingen);
        Assert.Null(rapport.Besluit);
        Assert.Null(rapport.BesluitStatus);
    }

    [Fact]
    public void Een_ster_zonder_tekst_is_een_beoordeling_zonder_tekststatus()
    {
        var rapport = new Rapportentiteit(Kind, 1);

        var rij = rapport.ZetBeoordeling(Luisteren, Groen, tekst: null);

        Assert.NotNull(rij);
        Assert.Equal(Groen, rij.GradatieId);
        Assert.Null(rij.Tekst);
        Assert.Null(rij.TekstStatus);
        Assert.Same(rij, Assert.Single(rapport.Beoordelingen));
    }

    [Fact]
    public void Een_getypte_tekst_is_manueel_en_wordt_getrimd()
    {
        var rapport = new Rapportentiteit(Kind, 1);

        var rij = rapport.ZetBeoordeling(Luisteren, gradatieId: null, "  Vertelt graag over thuis.\n");

        Assert.Equal("Vertelt graag over thuis.", rij!.Tekst);
        Assert.Equal(Tekststatus.Manueel, rij.TekstStatus);
        Assert.Null(rij.GradatieId);
    }

    [Fact]
    public void Een_tweede_keer_hetzelfde_rapportdoel_zetten_wijzigt_de_ene_rij()
    {
        var rapport = new Rapportentiteit(Kind, 2);
        rapport.ZetBeoordeling(Luisteren, Groen, "Luistert goed.");

        var rij = rapport.ZetBeoordeling(Luisteren, gradatieId: null, "Luistert goed.");

        Assert.Same(rij, Assert.Single(rapport.Beoordelingen));
        Assert.Null(rij!.GradatieId);
        Assert.Equal("Luistert goed.", rij.Tekst);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Geen_ster_en_geen_tekst_is_geen_rij(string? tekst)
    {
        var rapport = new Rapportentiteit(Kind, 1);

        Assert.Null(rapport.ZetBeoordeling(Luisteren, gradatieId: null, tekst));
        Assert.Empty(rapport.Beoordelingen);
    }

    [Fact]
    public void Ster_en_tekst_wissen_haalt_de_rij_weg_zodat_het_rapport_de_ster_niet_meer_gebruikt()
    {
        var rapport = new Rapportentiteit(Kind, 1);
        rapport.ZetBeoordeling(Luisteren, Groen, "Luistert goed.");

        Assert.Null(rapport.ZetBeoordeling(Luisteren, gradatieId: null, tekst: " "));
        Assert.Empty(rapport.Beoordelingen);
    }

    [Fact]
    public void De_tekst_wissen_wist_ook_de_tekststatus_en_laat_de_ster_staan()
    {
        var rapport = new Rapportentiteit(Kind, 1);
        rapport.ZetBeoordeling(Luisteren, Groen, "Luistert goed.");

        var rij = rapport.ZetBeoordeling(Luisteren, Groen, tekst: null);

        Assert.Equal(Groen, rij!.GradatieId);
        Assert.Null(rij.Tekst);
        Assert.Null(rij.TekstStatus);
    }

    [Fact]
    public void Een_leeg_id_wordt_geweigerd()
    {
        var rapport = new Rapportentiteit(Kind, 1);

        Assert.Throws<ArgumentException>(() => rapport.ZetBeoordeling(Guid.Empty, Groen, "Tekst"));
        Assert.Throws<ArgumentException>(() => rapport.ZetBeoordeling(Luisteren, Guid.Empty, "Tekst"));
        Assert.Empty(rapport.Beoordelingen);
    }

    [Fact]
    public void Een_te_lange_tekst_wordt_geweigerd_zonder_de_tekst_te_noemen()
    {
        var rapport = new Rapportentiteit(Kind, 1);
        var tekst = "Verzonnen zin. " + new string('x', Rapportentiteit.MaxTekstLengte);

        var fout = Assert.Throws<ArgumentException>(() => rapport.ZetBeoordeling(Luisteren, Groen, tekst));

        Assert.DoesNotContain("Verzonnen", fout.Message, StringComparison.Ordinal);
        Assert.Empty(rapport.Beoordelingen);
    }

    [Fact]
    public void Een_tekst_van_de_maximale_lengte_past()
    {
        var rapport = new Rapportentiteit(Kind, 1);

        var rij = rapport.ZetBeoordeling(Luisteren, gradatieId: null, new string('x', Rapportentiteit.MaxTekstLengte));

        Assert.Equal(Rapportentiteit.MaxTekstLengte, rij!.Tekst!.Length);
    }

    [Fact]
    public void Een_getypt_besluit_is_manueel_en_blank_wist_het()
    {
        var rapport = new Rapportentiteit(Kind, 3);

        rapport.ZetBesluit(" Een fijn jaar. ");
        Assert.Equal("Een fijn jaar.", rapport.Besluit);
        Assert.Equal(Tekststatus.Manueel, rapport.BesluitStatus);

        rapport.ZetBesluit("\n");
        Assert.Null(rapport.Besluit);
        Assert.Null(rapport.BesluitStatus);
    }

    [Fact]
    public void Een_te_lang_besluit_wordt_geweigerd_en_het_oude_blijft()
    {
        var rapport = new Rapportentiteit(Kind, 1);
        rapport.ZetBesluit("Een fijn jaar.");

        var fout = Assert.Throws<ArgumentException>(() =>
            rapport.ZetBesluit("Verzonnen " + new string('x', Rapportentiteit.MaxBesluitLengte)));

        Assert.DoesNotContain("Verzonnen", fout.Message, StringComparison.Ordinal);
        Assert.Equal("Een fijn jaar.", rapport.Besluit);
    }

    [Fact]
    public void Er_is_een_moment_1_tot_3_en_geen_ander()
    {
        Assert.False(Evaluatiemoment.IsGeldig(0));
        Assert.True(Evaluatiemoment.IsGeldig(Evaluatiemoment.Eerste));
        Assert.True(Evaluatiemoment.IsGeldig(Evaluatiemoment.Laatste));
        Assert.False(Evaluatiemoment.IsGeldig(4));
    }
}
