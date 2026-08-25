using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// A class's own jaar/fase, and what it does to the coverage denominator (owner ruling, 2026-08-25).
/// <para>
/// <b>The defect these exist for, measured:</b> "K3 groen" has <c>Leerjaar = 0</c>, which says "een kleutergroep" and
/// not which one, so <c>Jaarfasen.VoorLeerjaar</c> answered JK, K2 <i>and</i> K3 and the class was held to 1288
/// leerplandoelen where 554 are its own. That is the figure the onderwijsinspectie reads, off by more than a factor
/// two. Recording the year removes the guess rather than making it, which is why this does not contradict the E5-02
/// ruling of 2026-08-04: that one forbade guessing, and a school stating the year is not a guess.
/// </para>
/// </summary>
public sealed class KlasJaarfaseTests
{
    private static readonly Guid Schooljaar = Guid.NewGuid();

    [Fact]
    public void Een_kleutergroep_zonder_jaarfase_wordt_nog_tegen_alle_drie_gemeten()
    {
        var klas = new Klas(Schooljaar, "K3 groen", leerjaar: 0);

        Assert.Null(klas.Jaarfase);

        // Unchanged on purpose: a class nobody has told us about keeps the widest honest answer, so nothing
        // regresses on a plan already being taught.
        Assert.Equal(["JK", "K2", "K3"], Jaarfasen.VoorKlas(klas.Leerjaar, klas.Jaarfase));
    }

    [Fact]
    public void Een_kleutergroep_met_een_jaarfase_wordt_tegen_dat_ene_jaar_gemeten()
    {
        var klas = new Klas(Schooljaar, "K3 groen", leerjaar: 0, jaarfase: "K3");

        Assert.Equal("K3", klas.Jaarfase);
        Assert.Equal(["K3"], Jaarfasen.VoorKlas(klas.Leerjaar, klas.Jaarfase));
    }

    [Fact]
    public void Een_leeg_veld_betekent_niet_gezegd_en_niet_lege_string()
    {
        var klas = new Klas(Schooljaar, "K3 groen", leerjaar: 0, jaarfase: "   ");

        // Stored as null, not "": otherwise `IsBekend("")` is the only thing between a form that submits an empty
        // field and a coverage denominator of zero.
        Assert.Null(klas.Jaarfase);
        Assert.Equal(["JK", "K2", "K3"], Jaarfasen.VoorKlas(klas.Leerjaar, klas.Jaarfase));
    }

    [Fact]
    public void Een_jaarfase_die_het_leerjaar_tegenspreekt_wordt_geweigerd()
    {
        var fout = Assert.Throws<ArgumentException>(() => new Klas(Schooljaar, "L3", leerjaar: 3, jaarfase: "K2"));

        // Two answers for one class is how a denominator starts depending on which one a reader picked.
        Assert.Contains("hoort niet bij leerjaar 3", fout.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Een_jaarfase_die_bij_het_leerjaar_hoort_mag()
    {
        var klas = new Klas(Schooljaar, "L3", leerjaar: 3, jaarfase: "L3");

        Assert.Equal("L3", klas.Jaarfase);
        Assert.Equal(["L3"], Jaarfasen.VoorKlas(klas.Leerjaar, klas.Jaarfase));
    }

    [Fact]
    public void Een_onbekende_code_wordt_geweigerd()
    {
        var fout = Assert.Throws<ArgumentException>(() => new Klas(Schooljaar, "K3 groen", leerjaar: 0, jaarfase: "K9"));

        Assert.Contains("geen bekende jaar/fase", fout.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Een_fase_van_een_P_doel_is_geen_klasjaar()
    {
        // `Fase 1` is a legal `Leerplandoel.JaarFase` (Art. VII.1 column F allows a fase for P/S) and is NOT a legal
        // thing for a class to claim: a class teaches a jaar, never a route fase. Those two vocabularies overlapping
        // is what let a kleuterklas link three `Fase 1` doelen that could never count for it.
        Assert.False(Jaarfasen.IsBekend("Fase 1"));
        Assert.Throws<ArgumentException>(() => new Klas(Schooljaar, "K3 groen", leerjaar: 0, jaarfase: "Fase 1"));
    }

    [Fact]
    public void Wijzigen_kan_de_jaarfase_zetten_en_weer_weghalen()
    {
        var klas = new Klas(Schooljaar, "K3 groen", leerjaar: 0);

        klas.Wijzig("K3 groen", 0, "K3");
        Assert.Equal("K3", klas.Jaarfase);

        klas.Wijzig("K3 groen", 0, null);
        Assert.Null(klas.Jaarfase);
    }

    [Fact]
    public void Een_graadklas_krijgt_nog_altijd_geen_antwoord()
    {
        // Leerjaar 7 maps to nothing, and no jaar/fase is recorded, so this refuses rather than guesses and
        // DekkingService widens to the whole curriculum and says it did. The graadklas half is still Art. XIV's.
        Assert.Null(Jaarfasen.VoorKlas(7, null));
    }
}
