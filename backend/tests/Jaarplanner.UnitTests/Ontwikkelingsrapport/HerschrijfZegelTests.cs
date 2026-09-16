using Jaarplanner.Application.Ontwikkelingsrapport;
using Jaarplanner.Infrastructure.Ontwikkelingsrapport;
using Microsoft.AspNetCore.DataProtection;

namespace Jaarplanner.UnitTests.Ontwikkelingsrapport;

/// <summary>
/// <see cref="HerschrijfZegel"/>: the server's word that it proposed this very text, for this very field and for the
/// text that stood there, a short while ago (FB-004, ADR-0035 §3.5 D13). Everything a browser could claim on its own
/// has to fail here, because that is the whole reason the seal exists: <c>aanvaard</c> and <c>geweigerd</c> are the
/// server's finding, not a request's word.
/// </summary>
public sealed class HerschrijfZegelTests
{
    private static readonly Guid Kind = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid AnderKind = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid Rapportdoel = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Herschrijfdoel Doel = new(Kind, 1, Rapportdoel);
    private const string Bron = "Zij tekent graag.";
    private const string Voorstel = "Zij tekent graag en vertelt er honderduit over.";

    private readonly VasteTijd _tijd = new(new DateTimeOffset(2026, 9, 16, 9, 0, 0, TimeSpan.Zero));
    private readonly HerschrijfZegel _zegel;

    public HerschrijfZegelTests() => _zegel = new HerschrijfZegel(new EphemeralDataProtectionProvider(), _tijd);

    private string Onderteken(Herschrijfdoel? doel = null) => _zegel.Onderteken(doel ?? Doel, Bron, Voorstel);

    // --- Accepting: the seal has to cover the text that is about to be stored. ---

    [Fact]
    public void Herkent_zijn_eigen_voorstel() => Assert.True(_zegel.DektVoorstel(Doel, Voorstel, Onderteken()));

    [Fact]
    public void Een_aangepast_voorstel_dekt_het_zegel_niet_meer()
    {
        // This is what makes an edited proposal `manueel`: the teacher shaped the text, so the server does not call it
        // an accepted rewrite.
        Assert.False(_zegel.DektVoorstel(Doel, Voorstel + " Zij deelt ook graag.", Onderteken()));
    }

    [Fact]
    public void De_brontekst_is_geen_aanvaard_voorstel() => Assert.False(_zegel.DektVoorstel(Doel, Bron, Onderteken()));

    // --- Rejecting: the seal has to cover the text the proposal was made for. ---

    [Fact]
    public void Herkent_de_tekst_waarvoor_het_voorstel_gemaakt_werd() =>
        Assert.True(_zegel.DektBrontekst(Doel, Bron, Onderteken()));

    [Fact]
    public void Een_tekst_die_intussen_veranderde_draagt_het_zegel_niet()
    {
        // The mark belongs to the text the proposal was for. She kept typing, or a co-teacher wrote over it: there is
        // nothing left for the rejection to land on.
        Assert.False(_zegel.DektBrontekst(Doel, "Zij tekent graag en speelt graag buiten.", Onderteken()));
        Assert.False(_zegel.DektBrontekst(Doel, null, Onderteken()));
    }

    [Fact]
    public void Het_voorstel_is_niet_de_brontekst() => Assert.False(_zegel.DektBrontekst(Doel, Voorstel, Onderteken()));

    // --- What the seal is bound to. ---

    [Fact]
    public void Een_zegel_van_een_ander_kind_klopt_niet()
    {
        var zegel = Onderteken();
        var anderKind = Doel with { LeerlingId = AnderKind };

        Assert.False(_zegel.DektVoorstel(anderKind, Voorstel, zegel));
        Assert.False(_zegel.DektBrontekst(anderKind, Bron, zegel));
    }

    [Fact]
    public void Een_zegel_van_een_ander_moment_of_rapportdoel_klopt_niet()
    {
        var zegel = Onderteken();

        Assert.False(_zegel.DektVoorstel(Doel with { Moment = 2 }, Voorstel, zegel));
        Assert.False(_zegel.DektVoorstel(Doel with { RapportdoelId = Guid.NewGuid() }, Voorstel, zegel));
        Assert.False(_zegel.DektVoorstel(Doel with { RapportdoelId = null }, Voorstel, zegel));
        Assert.False(_zegel.DektBrontekst(Doel with { Moment = 2 }, Bron, zegel));
    }

    [Fact]
    public void Het_besluit_en_een_rapportdoel_delen_geen_zegel()
    {
        var besluitdoel = Doel with { RapportdoelId = null };
        var zegel = Onderteken(besluitdoel);

        Assert.True(_zegel.DektVoorstel(besluitdoel, Voorstel, zegel));
        Assert.False(_zegel.DektVoorstel(Doel, Voorstel, zegel));
    }

    [Fact]
    public void Een_zegel_verloopt()
    {
        var zegel = Onderteken();

        _tijd.Nu = _tijd.Nu.Add(HerschrijfZegel.Geldigheidsduur).AddSeconds(1);

        Assert.False(_zegel.DektVoorstel(Doel, Voorstel, zegel));
        Assert.False(_zegel.DektBrontekst(Doel, Bron, zegel));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("geen zegel")]
    [InlineData("QUJD")]
    public void Wat_nooit_een_zegel_was_klopt_niet(string? zegel)
    {
        Assert.False(_zegel.DektVoorstel(Doel, Voorstel, zegel));
        Assert.False(_zegel.DektBrontekst(Doel, Bron, zegel));
    }

    [Fact]
    public void Een_zegel_van_een_andere_sleutelring_klopt_niet()
    {
        var andere = new HerschrijfZegel(new EphemeralDataProtectionProvider(), _tijd);

        Assert.False(_zegel.DektVoorstel(Doel, Voorstel, andere.Onderteken(Doel, Bron, Voorstel)));
    }

    [Fact]
    public void De_zegel_draagt_geen_van_beide_teksten_mee()
    {
        // A seal that leaks tells no one what was proposed: it holds two hashes, and Data Protection encrypts even those.
        var zegel = Onderteken();

        Assert.DoesNotContain("tekent", zegel, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("honderduit", zegel, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(Kind.ToString("D"), zegel, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>A clock the test moves by hand.</summary>
    private sealed class VasteTijd(DateTimeOffset nu) : TimeProvider
    {
        public DateTimeOffset Nu { get; set; } = nu;

        public override DateTimeOffset GetUtcNow() => Nu;
    }
}
