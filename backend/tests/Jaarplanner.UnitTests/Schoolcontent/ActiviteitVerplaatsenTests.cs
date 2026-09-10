using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// Pins the move verb E4-08 adds (FR-7.2): an activiteit changes subthema while keeping its identity, its
/// attributes and every <see cref="DoelKoppeling"/> it carries.
/// <para>
/// The interesting assertions are not that the move works but <b>what survives it</b> and <b>what it refuses</b>.
/// Before this verb existed the only route was delete-and-retype, which loses the hoek, the verwachte uitkomsten
/// and every manual link; a test that only checked the new parent would pass on an implementation that dropped
/// all three. And the age boundary (owner ruling, 2026-08-30: same leeftijd required, any thema allowed) is a
/// domain invariant rather than a UI rule, so it is pinned here and its refusal is pinned as non-destructive.
/// </para>
/// <para>
/// <b>Two of these tests asserted the opposite until 2026-08-30</b>, and they are rewritten rather than removed.
/// The 2026-08-05 ruling let a move cross a leeftijd, because a subthema then named a klas as well and two ages
/// inside one graadklas were the differentiation the model existed for. When the klas left the entity
/// (Art. IX.2), crossing a leeftijd stopped being "the same class, its other half" and became "a class that is
/// not this one", so the owner ruled the crossing out. What was permitted is now refused, on the same fixture.
/// </para>
/// </summary>
public class ActiviteitVerplaatsenTests
{
    private static readonly Guid Klas = Guid.NewGuid();
    private static readonly Guid AndereKlas = Guid.NewGuid();

    private static Activiteit MetVolleInhoud(Subthema subthema)
    {
        var activiteit = subthema.VoegActiviteitToe(
            "Waterproef",
            ActiviteitType.Experiment,
            hoek: "ontdektafel",
            verwachteUitkomsten: "kind benoemt drijven en zinken");

        activiteit.VoegDoelkoppelingToe(new DoelKoppeling("NL-001", KoppelingStatus.Manueel));
        activiteit.VoegDoelkoppelingToe(new DoelKoppeling("WO-014", KoppelingStatus.Aanvaard));
        return activiteit;
    }

    [Fact]
    public void Verplaatsen_naar_een_subthema_van_een_ander_thema_behoudt_alles_wat_hertypen_zou_verliezen()
    {
        var bronThema = new Thema("Water", duurWeken: 4);
        var doelThema = new Thema("Lucht", duurWeken: 4);
        var bron = bronThema.VoegSubthemaToe("De plas", duurWeken: 2, leeftijd: "K3");
        var doel = doelThema.VoegSubthemaToe("De wind", duurWeken: 2, leeftijd: "K3");
        var activiteit = MetVolleInhoud(bron);
        var id = activiteit.Id;

        bron.VerplaatsActiviteitNaar(activiteit, doel);

        Assert.Empty(bron.Activiteiten);
        Assert.Same(activiteit, Assert.Single(doel.Activiteiten));
        Assert.Equal(doel.Id, activiteit.SubthemaId);

        // Identity and everything delete-and-retype loses.
        Assert.Equal(id, activiteit.Id);
        Assert.Equal("Waterproef", activiteit.Naam);
        Assert.Equal(ActiviteitType.Experiment, activiteit.ActiviteitType);
        Assert.Equal("ontdektafel", activiteit.Hoek);
        Assert.Equal("kind benoemt drijven en zinken", activiteit.VerwachteUitkomsten);
        Assert.Equal(
            [("NL-001", KoppelingStatus.Manueel), ("WO-014", KoppelingStatus.Aanvaard)],
            activiteit.Doelkoppelingen.Select(k => (k.LeerplandoelCode, k.Status)));
    }

    [Fact]
    public void Verplaatsen_binnen_hetzelfde_thema_naar_dezelfde_leeftijd_mag()
    {
        // The ordinary case the guard must not catch: one thema, one age, two subthema's. A guard written as
        // "the destination must differ in something" would refuse this, so it is pinned apart from the
        // cross-thema move above.
        var thema = new Thema("Water", duurWeken: 4);
        var bron = thema.VoegSubthemaToe("De plas", duurWeken: 2, leeftijd: "K3");
        var doel = thema.VoegSubthemaToe("De wolk", duurWeken: 2, leeftijd: "K3");
        var activiteit = MetVolleInhoud(bron);

        bron.VerplaatsActiviteitNaar(activiteit, doel);

        Assert.Equal(doel.Id, activiteit.SubthemaId);
    }

    /// <summary>
    /// <b>A move to a subthema at another age is refused</b> (owner ruling, 2026-08-30). This is the guard that
    /// replaced the class guard, and it is not the same rule under a new name: it refuses one thing the old one
    /// allowed (a graadklas moving an activiteit between its own two ages) and catches one thing the old one had
    /// no way to see (content landing at an age no class in this school teaches).
    /// <para>
    /// The refusal is pinned as <b>non-destructive</b>, which is the half a screen depends on: a rejected move
    /// must leave the activiteit where it was, with its links, rather than detach it and then throw. The
    /// aggregate mutates only after both guards, and this is what says so.
    /// </para>
    /// </summary>
    [Fact]
    public void Verplaatsen_naar_een_andere_leeftijd_wordt_geweigerd()
    {
        var thema = new Thema("Water", duurWeken: 4);
        var bron = thema.VoegSubthemaToe("De plas", duurWeken: 2, leeftijd: "K3");
        var doel = thema.VoegSubthemaToe("De plas", duurWeken: 2, leeftijd: "L1");
        var activiteit = MetVolleInhoud(bron);

        var fout = Assert.Throws<ArgumentException>(() => bron.VerplaatsActiviteitNaar(activiteit, doel));
        Assert.Equal("Een activiteit kan alleen verhuizen naar een subthema van dezelfde leeftijd.", fout.Message);

        // Nothing moved, and nothing was lost on the way: same parent, same links.
        Assert.Same(activiteit, Assert.Single(bron.Activiteiten));
        Assert.Empty(doel.Activiteiten);
        Assert.Equal(bron.Id, activiteit.SubthemaId);
        Assert.Equal(
            [("NL-001", KoppelingStatus.Manueel), ("WO-014", KoppelingStatus.Aanvaard)],
            activiteit.Doelkoppelingen.Select(k => (k.LeerplandoelCode, k.Status)));
    }

    [Fact]
    public void Verplaatsen_naar_hetzelfde_subthema_wordt_geweigerd()
    {
        var thema = new Thema("Water", duurWeken: 4);
        var bron = thema.VoegSubthemaToe("De plas", duurWeken: 2, leeftijd: "K3");
        var activiteit = MetVolleInhoud(bron);

        Assert.Throws<ArgumentException>(() => bron.VerplaatsActiviteitNaar(activiteit, bron));
        Assert.Same(activiteit, Assert.Single(bron.Activiteiten));
    }

    [Fact]
    public void Elke_weigering_is_een_hele_nederlandse_zin_zonder_parameternaam()
    {
        // The guard for a defect an integration test found in the first draft: `ArgumentException(message,
        // paramName)` appends "(Parameter 'doelSubthema')" to `Message`, the service forwards `Message` as the
        // 400's detail, and the form renders that detail verbatim. So the paramName overload writes English into
        // a Dutch sentence on a teacher's screen (Art. II.3), which is E1-14's round-4 MAJOR one screen over.
        //
        // The property is asserted over the refusals **as a set** rather than sentence by sentence, so a reword
        // cannot slip past it.
        //
        // **It does not cover a refusal added later**, and an earlier version of this comment claimed it did
        // (round 2, MINOR 7). The list below is hand-written, so a third refusal is covered only if someone adds
        // a third line, which is exactly what that claim told the next author was unnecessary. Stated plainly
        // instead: today's coverage is total, tomorrow's needs a line.
        //
        // **There are two refusals again.** The class refusal went with the class scope on 2026-08-30, and the
        // owner replaced it the same day with the leeftijd refusal below (Art. IX.2). The set shape was kept
        // through the hours it held a single entry precisely so that restoring the second cost one line here.
        var thema = new Thema("Water", duurWeken: 4);
        var bron = thema.VoegSubthemaToe("De plas", duurWeken: 2, leeftijd: "K3");
        var andereLeeftijd = thema.VoegSubthemaToe("De plas", duurWeken: 2, leeftijd: "L1");
        var activiteit = MetVolleInhoud(bron);

        var weigeringen = new[]
        {
            Assert.Throws<ArgumentException>(() => bron.VerplaatsActiviteitNaar(activiteit, bron)),
            Assert.Throws<ArgumentException>(() => bron.VerplaatsActiviteitNaar(activiteit, andereLeeftijd)),
        };

        Assert.All(weigeringen, fout =>
        {
            Assert.DoesNotContain("Parameter", fout.Message, StringComparison.Ordinal);
            Assert.Null(fout.ParamName);
            Assert.EndsWith(".", fout.Message, StringComparison.Ordinal);
            // No em dash in anything a teacher reads (Art. II.5, product-wide since 2026-07-29).
            Assert.DoesNotContain('—', fout.Message);
        });
    }

    [Fact]
    public void Een_activiteit_van_een_ander_subthema_is_een_programmeerfout_geen_gebruikersfout()
    {
        // InvalidOperationException rather than ArgumentException on purpose: the service catches the argument
        // exceptions and turns them into a Dutch 400 a teacher reads, and this case is neither reachable from
        // the API nor actionable by a teacher (Art. II.3).
        var thema = new Thema("Water", duurWeken: 4);
        var bron = thema.VoegSubthemaToe("De plas", duurWeken: 2, leeftijd: "K3");
        var vreemd = thema.VoegSubthemaToe("De wolk", duurWeken: 2, leeftijd: "K3");
        var doel = thema.VoegSubthemaToe("De wind", duurWeken: 2, leeftijd: "K3");
        var activiteit = MetVolleInhoud(vreemd);

        Assert.Throws<InvalidOperationException>(() => bron.VerplaatsActiviteitNaar(activiteit, doel));
    }
}
