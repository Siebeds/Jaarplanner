using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// The mapping from a class's <c>Leerjaar</c> onto Op.stap jaar/fase codes (E5-02, owner ruling 2026-08-04).
/// <para>
/// Small enough to look obvious and load-bearing enough to test: it decides the denominator of every coverage figure
/// the school will ever show an onderwijsinspectie. An off-by-one here measures L3 against L4 silently, because both
/// answers are well-formed.
/// </para>
/// </summary>
public sealed class JaarfasenTests
{
    [Fact]
    public void Leerjaar_nul_is_een_kleutergroep_en_levert_alle_drie_de_kleutercodes()
    {
        // Widest honest answer: Klas.Leerjaar cannot say WHICH kleuterjaar a group is, so narrowing to one would be
        // a guess. Deliberately not null: a kleutergroep can be measured, just not narrowly.
        Assert.Equal(["JK", "K2", "K3"], Jaarfasen.VoorLeerjaar(0));
    }

    [Theory]
    [InlineData(1, "L1")]
    [InlineData(2, "L2")]
    [InlineData(3, "L3")]
    [InlineData(4, "L4")]
    [InlineData(5, "L5")]
    [InlineData(6, "L6")]
    public void Elk_leerjaar_van_het_lager_levert_precies_zijn_eigen_code(int leerjaar, string verwacht)
    {
        // Every one enumerated rather than sampled, because the failure mode is an off-by-one at one end of a range
        // and a spot check of the middle cannot see it.
        Assert.Equal([verwacht], Jaarfasen.VoorLeerjaar(leerjaar));
    }

    [Theory]
    [InlineData(7)]
    [InlineData(13)]
    [InlineData(-1)]
    [InlineData(int.MaxValue)]
    [InlineData(int.MinValue)]
    public void Een_leerjaar_buiten_het_basisonderwijs_levert_null_en_niet_een_lege_lijst(int leerjaar)
    {
        // The distinction this asserts is the whole point of the null. An EMPTY list means "the whole curriculum" to
        // IDekkingOpslag.HaalLeerplandoelenAsync, so returning one here would silently widen the scope while claiming
        // a class-specific one; and a caller that read it as "no goals" would report a class with nothing left to
        // cover. Null forces the caller to choose, and DekkingService chooses to widen and say so.
        Assert.Null(Jaarfasen.VoorLeerjaar(leerjaar));
    }

    [Fact]
    public void De_codes_zijn_de_geruilde_canonieke_vorm_en_niet_de_lerarenvorm()
    {
        // The owner ruled the canonical form on 2026-08-03: JK/K2/K3 + L1-L6, with the import normalising the other
        // ordering. Teacher vocabulary is 1K/2K/3K (Art. XIII glossary), and comparison downstream is ORDINAL, so
        // "3K" would match nothing while looking right in a code review.
        Assert.Equal(["JK", "K2", "K3"], Jaarfasen.Kleuter);
        Assert.Equal(["L1", "L2", "L3", "L4", "L5", "L6"], Jaarfasen.Lager);
    }
}
