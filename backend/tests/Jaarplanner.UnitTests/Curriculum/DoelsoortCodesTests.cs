using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// Pins the single-source doelsoort code mapping (Art. III.3, VII.1): every enum value has the
/// official Op.stap short code, parsing is case-insensitive, and unknown codes fail loudly.
/// </summary>
public class DoelsoortCodesTests
{
    [Theory]
    [InlineData(Doelsoort.Minimumdoel, "MD")]
    [InlineData(Doelsoort.Gemeenschappelijk, "G")]
    [InlineData(Doelsoort.Verdieping, "+")]
    [InlineData(Doelsoort.Precurriculum, "P")]
    [InlineData(Doelsoort.Specifiek, "S")]
    [InlineData(Doelsoort.AnderstaligeNieuwkomers, "A")]
    public void ToCode_returns_the_official_short_code(Doelsoort doelsoort, string expected)
    {
        Assert.Equal(expected, doelsoort.ToCode());
    }

    [Theory]
    [InlineData("MD", Doelsoort.Minimumdoel)]
    [InlineData("md", Doelsoort.Minimumdoel)]
    [InlineData(" + ", Doelsoort.Verdieping)]
    [InlineData("A", Doelsoort.AnderstaligeNieuwkomers)]
    public void FromCode_parses_case_insensitively_and_trims(string code, Doelsoort expected)
    {
        Assert.Equal(expected, DoelsoortCodes.FromCode(code));
    }

    [Fact]
    public void Every_enum_value_round_trips_through_code()
    {
        foreach (var doelsoort in Enum.GetValues<Doelsoort>())
        {
            Assert.Equal(doelsoort, DoelsoortCodes.FromCode(doelsoort.ToCode()));
        }
    }

    [Fact]
    public void FromCode_throws_on_an_unknown_code()
    {
        Assert.Throws<ArgumentException>(() => DoelsoortCodes.FromCode("ZZ"));
    }

    [Theory]
    [InlineData("MD", true, Doelsoort.Minimumdoel)]
    [InlineData("zz", false, default(Doelsoort))]
    [InlineData("", false, default(Doelsoort))]
    [InlineData(null, false, default(Doelsoort))]
    public void TryFromCode_reports_success_and_value(string? code, bool expectedOk, Doelsoort expected)
    {
        var ok = DoelsoortCodes.TryFromCode(code, out var doelsoort);

        Assert.Equal(expectedOk, ok);
        if (expectedOk)
        {
            Assert.Equal(expected, doelsoort);
        }
    }
}
