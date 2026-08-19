using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// E9-07 (FR-3.2): a class carries the Op.stap jaar/fase codes it teaches, so a goal picker can stop offering an L3
/// teacher kleuterdoelen.
/// <para>
/// These pin the <b>rule</b> rather than the projection, because the point of shipping the fasen on
/// <c>KlasWeergave</c> was to keep one server-side answer to "what does this class teach?" — the same
/// <see cref="Jaarfasen.VoorLeerjaar"/> that <c>Dekkingsbereik.EigenJaarFase</c> measures against. A second copy in
/// TypeScript is what this exists to prevent.
/// </para>
/// </summary>
public sealed class KlasJaarFasenTests
{
    [Fact]
    public void Een_leerjaar_levert_precies_zijn_eigen_fase()
    {
        Assert.Equal(["L3"], Jaarfasen.VoorLeerjaar(3));
        Assert.Equal(["L1"], Jaarfasen.VoorLeerjaar(1));
        Assert.Equal(["L6"], Jaarfasen.VoorLeerjaar(6));
    }

    /// <summary>
    /// <b>A kleutergroep yields all three kleuter codes, not one.</b> <c>Klas.Leerjaar</c> is <c>0</c> and cannot say
    /// which kleuterjaar, so this is the widest honest answer rather than a guess. E5-02's ruling of 2026-08-04 is the
    /// precedent for what a screen does with it: let the teacher narrow within the set.
    /// </summary>
    [Fact]
    public void Een_kleutergroep_levert_alle_drie_de_kleuterjaren()
    {
        Assert.Equal(["JK", "K2", "K3"], Jaarfasen.VoorLeerjaar(0));
    }

    /// <summary>
    /// <b>Null means "cannot be derived", never "teaches nothing"</b> — the unresolved graadklas/menggroep case
    /// (Art. XIV). <c>KlasBeheerService</c> maps it to an empty list, and the contract on <c>KlasWeergave.JaarFasen</c>
    /// says a caller must widen its scope rather than narrow to nothing: a picker narrowed to an empty set would make
    /// every leerplandoel unreachable, which is worse than the unscoped search E9-07 exists to replace.
    /// </summary>
    [Fact]
    public void Een_onafleidbaar_leerjaar_levert_null_en_niet_een_lege_lijst()
    {
        Assert.Null(Jaarfasen.VoorLeerjaar(7));
        Assert.Null(Jaarfasen.VoorLeerjaar(-1));
    }
}
