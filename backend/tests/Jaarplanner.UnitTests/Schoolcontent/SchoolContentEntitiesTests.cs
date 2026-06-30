using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// Pins the autonomous school-content entities (Art. IX.2): construction/required fields, the
/// 2–3 themadoel bound, the human-in-the-loop <see cref="KoppelingStatus"/> (Art. IV.2), the
/// <see cref="ActiviteitType"/> validation, and — the core acceptance criterion — that the
/// class/age-scoped entities (<see cref="Subthema"/>/<see cref="Subdoel"/>/<see cref="Activiteit"/>)
/// cannot exist without their class/age scope while the school-scoped <see cref="Thema"/> carries
/// the school-wide attributes.
/// </summary>
public class SchoolContentEntitiesTests
{
    private static DoelKoppeling Voorstel(string code = "NL-001") =>
        new(code, KoppelingStatus.Voorgesteld, "past bij het thema");

    [Fact]
    public void Thema_is_school_scoped_and_holds_school_wide_vocabulary()
    {
        var thema = new Thema("Water", duurWeken: 5, invalshoeken: "natuur, techniek");
        thema.StelKernwoordenschatIn(["plas", "regen"]);
        thema.StelRijkeWoordenschatIn(["waterkringloop", "verdamping"]);

        Assert.Equal("Water", thema.Naam);
        Assert.Equal(5, thema.DuurWeken);
        Assert.Equal(["plas", "regen"], thema.Kernwoordenschat);
        Assert.Equal(["waterkringloop", "verdamping"], thema.RijkeWoordenschat);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Thema_requires_a_naam(string? naam)
    {
        Assert.Throws<ArgumentException>(() => new Thema(naam!, duurWeken: 4));
    }

    [Fact]
    public void Thema_requires_a_positive_duurWeken()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new Thema("Water", duurWeken: 0));
    }

    [Fact]
    public void Woordenschat_drops_blanks_and_trims()
    {
        var thema = new Thema("Water", duurWeken: 4);
        thema.StelKernwoordenschatIn(["  plas  ", "", "   ", "regen"]);
        Assert.Equal(["plas", "regen"], thema.Kernwoordenschat);
    }

    [Fact]
    public void Thema_anchors_two_to_three_themadoelen_and_rejects_a_fourth()
    {
        var thema = new Thema("Water", duurWeken: 4);

        thema.VoegThemadoelToe(Voorstel("A"));
        thema.VoegThemadoelToe(Voorstel("B"));
        thema.VoegThemadoelToe(Voorstel("C"));

        Assert.Equal(3, thema.Themadoelen.Count);
        Assert.Equal(Thema.MaxThemadoelen, thema.Themadoelen.Count);
        Assert.Throws<InvalidOperationException>(() => thema.VoegThemadoelToe(Voorstel("D")));
    }

    [Fact]
    public void Themadoel_links_through_its_koppeling_and_belongs_to_the_thema()
    {
        var thema = new Thema("Water", duurWeken: 4);
        var themadoel = thema.VoegThemadoelToe(Voorstel("NL-LEZ-001"));

        Assert.Equal(thema.Id, themadoel.ThemaId);
        Assert.Equal("NL-LEZ-001", themadoel.Koppeling.LeerplandoelCode);
        Assert.Equal(KoppelingStatus.Voorgesteld, themadoel.Koppeling.Status);
    }

    // --- Class/age scoping (the core acceptance criterion, Art. IX.2) ---

    [Fact]
    public void Subthema_is_class_and_age_scoped_and_requires_both()
    {
        var thema = new Thema("Water", duurWeken: 4);
        var klasId = Guid.NewGuid();

        var subthema = thema.VoegSubthemaToe("De plas", duurWeken: 2, klasId, leeftijd: "K3");

        Assert.Equal(klasId, subthema.KlasId);
        Assert.Equal("K3", subthema.Leeftijd);
        Assert.Equal(thema.Id, subthema.ThemaId);
    }

    [Fact]
    public void Subthema_cannot_exist_without_a_klas()
    {
        var thema = new Thema("Water", duurWeken: 4);
        Assert.Throws<ArgumentException>(() =>
            thema.VoegSubthemaToe("De plas", duurWeken: 2, klasId: Guid.Empty, leeftijd: "K3"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public void Subthema_cannot_exist_without_a_leeftijd(string? leeftijd)
    {
        var thema = new Thema("Water", duurWeken: 4);
        Assert.Throws<ArgumentException>(() =>
            thema.VoegSubthemaToe("De plas", duurWeken: 2, klasId: Guid.NewGuid(), leeftijd: leeftijd!));
    }

    [Fact]
    public void Subthema_carries_the_kennisrijk_driving_questions()
    {
        var thema = new Thema("Water", duurWeken: 4);
        var subthema = thema.VoegSubthemaToe("De plas", 2, Guid.NewGuid(), "K3");
        subthema.StelVraagstellingIn("Waar komt regen vandaan?", "Hoe ontstaat een plas?");

        Assert.Equal("Waar komt regen vandaan?", subthema.Probleemstelling);
        Assert.Equal("Hoe ontstaat een plas?", subthema.Onderzoeksvraag);
    }

    [Fact]
    public void Subdoel_is_per_subthema_and_age_and_links_through_its_koppeling()
    {
        var thema = new Thema("Water", duurWeken: 4);
        var subthema = thema.VoegSubthemaToe("De plas", 2, Guid.NewGuid(), "K3");
        var subdoel = subthema.VoegSubdoelToe("K3", Voorstel("WIS-001"));

        Assert.Equal(subthema.Id, subdoel.SubthemaId);
        Assert.Equal("K3", subdoel.Leeftijd);
        Assert.Equal("WIS-001", subdoel.Koppeling.LeerplandoelCode);
    }

    [Fact]
    public void Activiteit_is_owned_by_a_subthema_and_can_link_multiple_leerdoelen()
    {
        var thema = new Thema("Water", duurWeken: 4);
        var subthema = thema.VoegSubthemaToe("De plas", 2, Guid.NewGuid(), "K3");

        var activiteit = subthema.VoegActiviteitToe(
            "Waterproef", ActiviteitType.Experiment, hoek: "ontdektafel", verwachteUitkomsten: "kind benoemt drijven/zinken");
        activiteit.VoegDoelkoppelingToe(Voorstel("WT-001"));
        activiteit.VoegDoelkoppelingToe(new DoelKoppeling("WT-002", KoppelingStatus.Manueel));

        Assert.Equal(subthema.Id, activiteit.SubthemaId);
        Assert.Equal(ActiviteitType.Experiment, activiteit.ActiviteitType);
        Assert.Equal("ontdektafel", activiteit.Hoek);
        Assert.Equal(2, activiteit.Doelkoppelingen.Count);
    }

    [Fact]
    public void Activiteit_rejects_an_undefined_type()
    {
        var thema = new Thema("Water", duurWeken: 4);
        var subthema = thema.VoegSubthemaToe("De plas", 2, Guid.NewGuid(), "K3");
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            subthema.VoegActiviteitToe("X", (ActiviteitType)99));
    }

    // --- DoelKoppeling: human-in-the-loop status (Art. IV.2) ---

    [Fact]
    public void DoelKoppeling_requires_a_leerplandoel_code()
    {
        Assert.Throws<ArgumentException>(() => new DoelKoppeling("", KoppelingStatus.Manueel));
    }

    [Fact]
    public void DoelKoppeling_rejects_an_undefined_status()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new DoelKoppeling("NL-001", (KoppelingStatus)99));
    }

    [Fact]
    public void DoelKoppeling_records_a_teacher_decision_on_a_suggestion()
    {
        var koppeling = Voorstel();
        Assert.Equal(KoppelingStatus.Voorgesteld, koppeling.Status);

        koppeling.WijzigStatus(KoppelingStatus.Aanvaard);
        Assert.Equal(KoppelingStatus.Aanvaard, koppeling.Status);
    }

    [Fact]
    public void DoelKoppeling_exposes_the_four_human_in_the_loop_states()
    {
        // Art. IV.2: voorgesteld / aanvaard / geweigerd / manueel.
        Assert.Equal(
            new[] { "Voorgesteld", "Aanvaard", "Geweigerd", "Manueel" },
            Enum.GetNames<KoppelingStatus>());
    }
}
