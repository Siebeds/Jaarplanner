using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// A class's leeftijd: the only level it states, and what it decides.
/// <para>
/// <b>The defect these exist for, measured:</b> "K3 groen" had <c>Leerjaar = 0</c>, which says "een kleutergroep" and
/// not which one, so <c>Jaarfasen.VoorLeerjaar</c> answered JK, K2 <i>and</i> K3 and the class was held to 1288
/// leerplandoelen where 554 are its own. That is the figure the onderwijsinspectie reads, off by more than a factor
/// two. The 2026-08-25 ruling added a jaar/fase beside the ordinal to remove the guess.
/// </para>
/// <para>
/// <b>On 2026-08-30 the owner asked why a class was coupled to a leerjaar at all, and the derivation was reversed.</b>
/// The school states the leeftijd; <c>Klas.Leerjaar</c> follows from it. Two consequences run through every test
/// below. The two values can no longer contradict each other, so the test that pinned that refusal is now a test
/// that the contradiction is unconstructible. And blank stopped being a legal state: "the school has not said" was
/// the normal condition of every class before the field existed, and it is now a refusal, because a class with no
/// leeftijd would have no subthema's either (Art. IX.2).
/// </para>
/// </summary>
public sealed class KlasJaarfaseTests
{
    private static readonly Guid Schooljaar = Guid.NewGuid();

    [Fact]
    public void Een_kleuterklas_noemt_haar_eigen_jaar_en_wordt_daartegen_gemeten()
    {
        var klas = new Klas(Schooljaar, "K3 groen", "K3");

        Assert.Equal("K3", klas.Jaarfase);
        Assert.Equal(["K3"], Jaarfasen.VoorKlas(klas.Leerjaar, klas.Jaarfase));

        // And the ordinal follows from it rather than being stated beside it.
        Assert.Equal(0, klas.Leerjaar);
    }

    [Theory]
    [InlineData("JK", 0)]
    [InlineData("K2", 0)]
    [InlineData("K3", 0)]
    [InlineData("L1", 1)]
    [InlineData("L3", 3)]
    [InlineData("L6", 6)]
    public void Het_leerjaar_wordt_afgeleid_uit_de_leeftijd(string leeftijd, int leerjaar)
    {
        var klas = new Klas(Schooljaar, "Een klas", leeftijd);

        Assert.Equal(leerjaar, klas.Leerjaar);
        Assert.Equal(leeftijd, klas.Jaarfase);
        Assert.Equal([leeftijd], Jaarfasen.VoorKlas(klas.Leerjaar, klas.Jaarfase));
    }

    /// <summary>
    /// The 2026-08-25 refusal, inverted. There used to be a test that a jaar/fase contradicting the leerjaar was
    /// rejected, because two answers for one class is how a denominator starts depending on which one a reader
    /// picked. A caller can no longer state both, so the property is now asserted as unconstructible: whatever
    /// leeftijd goes in, the ordinal that comes out agrees with it.
    /// </summary>
    [Theory]
    [InlineData("JK")]
    [InlineData("K3")]
    [InlineData("L2")]
    [InlineData("L6")]
    public void Leerjaar_en_leeftijd_kunnen_elkaar_niet_meer_tegenspreken(string leeftijd)
    {
        var klas = new Klas(Schooljaar, "Een klas", leeftijd);

        Assert.Equal(leeftijd, Jaarfasen.VoorKlas(klas.Leerjaar, klas.Jaarfase)!.Single());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Een_klas_zonder_leeftijd_wordt_geweigerd(string? leeftijd)
    {
        // Blank used to be stored as null and mean "not said". It is a refusal now: the leeftijd is what hands a
        // class its subthema's and activiteiten (Art. IX.2), so a class without one holds nothing.
        var fout = Assert.Throws<ArgumentException>(() => new Klas(Schooljaar, "K3 groen", leeftijd!));

        Assert.Contains("Kies een leeftijd", fout.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Een_onbekende_code_wordt_geweigerd()
    {
        var fout = Assert.Throws<ArgumentException>(() => new Klas(Schooljaar, "K3 groen", "K9"));

        Assert.Contains("geen bekende leeftijd", fout.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Een_fase_van_een_P_doel_is_geen_klasjaar()
    {
        // `Fase 1` is a legal `Leerplandoel.JaarFase` (Art. VII.1 column F allows a fase for P/S) and is NOT a legal
        // thing for a class to claim: a class teaches a jaar, never a route fase. Those two vocabularies overlapping
        // is what let a kleuterklas link three `Fase 1` doelen that could never count for it.
        Assert.False(Jaarfasen.IsBekend("Fase 1"));
        Assert.Throws<ArgumentException>(() => new Klas(Schooljaar, "K3 groen", "Fase 1"));
    }

    [Fact]
    public void Wijzigen_verzet_de_leeftijd_en_het_leerjaar_samen()
    {
        var klas = new Klas(Schooljaar, "K3 groen", "K3");

        klas.Wijzig("L1 rood", "L1");

        Assert.Equal("L1", klas.Jaarfase);
        Assert.Equal(1, klas.Leerjaar);

        // And it cannot be cleared, for the same reason it cannot be omitted at construction.
        Assert.Throws<ArgumentException>(() => klas.Wijzig("L1 rood", "  "));
        Assert.Equal("L1", klas.Jaarfase);
    }

    /// <summary>
    /// The fallback that keeps rows written before the leeftijd was required from measuring against nothing. It is
    /// no longer reachable through the domain — every <c>Klas</c> now states a leeftijd — so it is asserted against
    /// <c>Jaarfasen</c> directly, which is where those rows are read.
    /// </summary>
    [Fact]
    public void Een_oude_rij_zonder_leeftijd_valt_terug_op_het_ordinaal()
    {
        Assert.Equal(["JK", "K2", "K3"], Jaarfasen.VoorKlas(0, null));
        Assert.Equal(["L3"], Jaarfasen.VoorKlas(3, null));
    }

    [Fact]
    public void Een_graadklas_krijgt_nog_altijd_geen_antwoord()
    {
        // Leerjaar 7 maps to nothing, and no jaar/fase is recorded, so this refuses rather than guesses and
        // DekkingService widens to the whole curriculum and says it did. The graadklas half is still Art. XIV's,
        // and the 2026-08-30 amendment did not touch it: one leeftijd per klas cannot express a menggroep either.
        Assert.Null(Jaarfasen.VoorKlas(7, null));
    }
}
