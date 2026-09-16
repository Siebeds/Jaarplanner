using Jaarplanner.Application.Ontwikkelingsrapport;
using Jaarplanner.Infrastructure.Ontwikkelingsrapport;
using Microsoft.AspNetCore.DataProtection;

namespace Jaarplanner.UnitTests.Ontwikkelingsrapport;

/// <summary>
/// <see cref="HerschrijfZegel"/>: the server's word that it proposed this very text for this very field a short while
/// ago (FB-004, ADR-0035 §3.5 D13). Everything a browser could claim on its own has to fail here, because that is the
/// whole reason the seal exists: <c>aanvaard</c> and <c>geweigerd</c> are the server's finding, not a request's word.
/// </summary>
public sealed class HerschrijfZegelTests
{
    private static readonly Guid Kind = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid AnderKind = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid Rapportdoel = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Herschrijfdoel Doel = new(Kind, 1, Rapportdoel);
    private const string Voorstel = "Zij tekent graag en vertelt er honderduit over.";

    private readonly VasteTijd _tijd = new(new DateTimeOffset(2026, 9, 16, 9, 0, 0, TimeSpan.Zero));
    private readonly HerschrijfZegel _zegel;

    public HerschrijfZegelTests() => _zegel = new HerschrijfZegel(new EphemeralDataProtectionProvider(), _tijd);

    [Fact]
    public void Herkent_zijn_eigen_zegel_over_dezelfde_tekst() =>
        Assert.True(_zegel.Klopt(Doel, Voorstel, _zegel.Onderteken(Doel, Voorstel)));

    [Fact]
    public void Een_aangepast_voorstel_klopt_niet_meer()
    {
        // This is what makes an edited proposal `manueel`: the teacher shaped the text, so the server does not call it
        // an accepted rewrite.
        var zegel = _zegel.Onderteken(Doel, Voorstel);

        Assert.False(_zegel.Klopt(Doel, Voorstel + " Zij deelt ook graag.", zegel));
    }

    [Fact]
    public void Een_zegel_van_een_ander_kind_klopt_niet()
    {
        var zegel = _zegel.Onderteken(Doel, Voorstel);

        Assert.False(_zegel.Klopt(Doel with { LeerlingId = AnderKind }, Voorstel, zegel));
    }

    [Fact]
    public void Een_zegel_van_een_ander_moment_of_rapportdoel_klopt_niet()
    {
        var zegel = _zegel.Onderteken(Doel, Voorstel);

        Assert.False(_zegel.Klopt(Doel with { Moment = 2 }, Voorstel, zegel));
        Assert.False(_zegel.Klopt(Doel with { RapportdoelId = Guid.NewGuid() }, Voorstel, zegel));
        Assert.False(_zegel.Klopt(Doel with { RapportdoelId = null }, Voorstel, zegel));
    }

    [Fact]
    public void Het_besluit_en_een_rapportdoel_delen_geen_zegel()
    {
        var besluitdoel = Doel with { RapportdoelId = null };
        var zegel = _zegel.Onderteken(besluitdoel, Voorstel);

        Assert.True(_zegel.Klopt(besluitdoel, Voorstel, zegel));
        Assert.False(_zegel.Klopt(Doel, Voorstel, zegel));
    }

    [Fact]
    public void Een_zegel_verloopt()
    {
        var zegel = _zegel.Onderteken(Doel, Voorstel);

        _tijd.Nu = _tijd.Nu.Add(HerschrijfZegel.Geldigheidsduur).AddSeconds(1);

        Assert.False(_zegel.Klopt(Doel, Voorstel, zegel));
        Assert.False(_zegel.Klopt(Doel, null, zegel));
    }

    [Fact]
    public void Een_weigering_bewijst_het_doel_zonder_de_tekst_mee_te_sturen()
    {
        // A rejection may send no text: none of the proposal is ever stored, so the seal alone has to carry the proof.
        var zegel = _zegel.Onderteken(Doel, Voorstel);

        Assert.True(_zegel.Klopt(Doel, null, zegel));
        Assert.False(_zegel.Klopt(Doel with { LeerlingId = AnderKind }, null, zegel));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("geen zegel")]
    [InlineData("QUJD")]
    public void Wat_nooit_een_zegel_was_klopt_niet(string zegel) => Assert.False(_zegel.Klopt(Doel, Voorstel, zegel));

    [Fact]
    public void Een_zegel_van_een_andere_sleutelring_klopt_niet()
    {
        var andere = new HerschrijfZegel(new EphemeralDataProtectionProvider(), _tijd);

        Assert.False(_zegel.Klopt(Doel, Voorstel, andere.Onderteken(Doel, Voorstel)));
    }

    [Fact]
    public void De_zegel_draagt_de_tekst_niet_mee()
    {
        // A seal that leaks tells no one what was proposed: it holds a hash, and Data Protection encrypts even that.
        var zegel = _zegel.Onderteken(Doel, Voorstel);

        Assert.DoesNotContain("tekent", zegel, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(Kind.ToString("D"), zegel, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>A clock the test moves by hand.</summary>
    private sealed class VasteTijd(DateTimeOffset nu) : TimeProvider
    {
        public DateTimeOffset Nu { get; set; } = nu;

        public override DateTimeOffset GetUtcNow() => Nu;
    }
}
