using Jaarplanner.Infrastructure.Persistence;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// Pins the ordering of Op.stap discipline numbers (antagonist finding 5, E1-16).
/// <para>
/// <see cref="Discipline.Nummer"/> is a string because of the 9.x nested split (Art. VII.0), so an ordinal sort
/// produces 1, 10, 11, 2, 3. The Art. VII.0 authoritative list runs to 11, so that is what a full import would
/// have shown a teacher in the Doelen filter.
/// </para>
/// </summary>
public class DisciplinenummerVergelijkerTests
{
    /// <summary>The whole Art. VII.0 list, sorted from a deliberately scrambled input.</summary>
    [Fact]
    public void Sorteert_de_officiele_lijst_op_nummer()
    {
        string[] gehusseld = ["9.3", "11", "2", "10", "1", "9.1", "7", "9.2", "3", "8", "6", "4", "5"];

        var gesorteerd = gehusseld.OrderBy(n => n, DisciplinenummerVergelijker.Instantie).ToArray();

        Assert.Equal(
            ["1", "2", "3", "4", "5", "6", "7", "8", "9.1", "9.2", "9.3", "10", "11"],
            gesorteerd);
    }

    /// <summary>The two comparisons an ordinal sort gets wrong, asserted directly.</summary>
    [Theory]
    [InlineData("2", "10")]
    [InlineData("9.2", "10")]
    [InlineData("9.1", "9.2")]
    // A bare parent sorts before its own children, so a future "9" row would land above 9.1.
    [InlineData("9", "9.1")]
    public void Kleiner_nummer_komt_eerst(string eerste, string tweede)
    {
        Assert.True(DisciplinenummerVergelijker.Instantie.Compare(eerste, tweede) < 0);
        Assert.True(DisciplinenummerVergelijker.Instantie.Compare(tweede, eerste) > 0);
    }

    /// <summary>
    /// A non-numeric segment falls back to an ordinal comparison rather than throwing, and sorts after the
    /// numeric ones so the official list stays contiguous. Op.stap is still rolling out (Art. III.3), so an
    /// unexpected value must degrade to a deterministic order instead of an exception on a read path.
    /// </summary>
    [Fact]
    public void Onverwachte_waarde_sorteert_deterministisch_achteraan()
    {
        string[] gehusseld = ["9.x", "10", "9.1", "onbekend", "2"];

        var gesorteerd = gehusseld.OrderBy(n => n, DisciplinenummerVergelijker.Instantie).ToArray();

        Assert.Equal(["2", "9.1", "9.x", "10", "onbekend"], gesorteerd);
    }

    [Fact]
    public void Gelijke_nummers_zijn_gelijk()
    {
        Assert.Equal(0, DisciplinenummerVergelijker.Instantie.Compare("9.2", "9.2"));
        Assert.Equal(0, DisciplinenummerVergelijker.Instantie.Compare(null, null));
    }
}
