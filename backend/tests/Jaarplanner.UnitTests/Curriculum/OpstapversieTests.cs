using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// The record of an applied curriculum import (E1-21, ADR-0032 decision 6). A version is a number, never
/// <c>latest</c>, and because it ends up in a request path to KOV nothing but digits and dots may pass.
/// </summary>
public sealed class OpstapversieTests
{
    [Theory]
    [InlineData("1.2")]
    [InlineData("1.0")]
    [InlineData("10.3.1")]
    [InlineData(" 1.2 ")]
    [InlineData("2")]
    public void Een_genummerde_versie_is_geldig(string versie) => Assert.True(Opstapversie.IsGeldigeVersie(versie));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("latest")]
    [InlineData("1.")]
    [InlineData(".1")]
    [InlineData("1..2")]
    [InlineData("1.2/x")]
    [InlineData("1.2.3.4.5")]
    [InlineData("1a")]
    [InlineData("1234.1")]
    public void Al_de_rest_is_geen_versie(string? versie) => Assert.False(Opstapversie.IsGeldigeVersie(versie));

    [Fact]
    public void Latest_kan_niet_vastgelegd_worden() =>
        Assert.Throws<ArgumentException>(() => new Opstapversie("latest", "hash", DateTimeOffset.UnixEpoch));

    [Fact]
    public void Een_versie_wordt_vastgelegd_zoals_ze_is()
    {
        var versie = new Opstapversie(" 1.2 ", " 8f47 ", DateTimeOffset.UnixEpoch);

        Assert.Equal(("1.2", "8f47"), (versie.Versie, versie.Hash));
    }
}
