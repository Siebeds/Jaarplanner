using Jaarplanner.Domain.Planning;
using Jaarplanner.Infrastructure.Planning;
using Microsoft.Extensions.Configuration;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// E3-05: the planningsblok grid. These tests exist to prove the story's actual acceptance criterion —
/// "the block unit is <b>configurable behind a seam</b>; default is <b>documented, not compiled-in</b>"
/// (ADR-0013, Art. IX.3/XIV) — and to pin the constitution's hard prohibition on assuming months.
/// </summary>
public sealed class PlanningsblokIndelingTests
{
    // A realistic Belgian school year: 1 Sept 2026 → 30 June 2027, straddling two calendar years.
    private static readonly DateOnly Start = new(2026, 9, 1);
    private static readonly DateOnly Eind = new(2027, 6, 30);

    [Fact]
    public void Standaard_indeling_gebruikt_de_geratificeerde_twee_tier_cadans()
    {
        var indeling = new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions());

        // The documented default (directie 2026-07-14): themaperiode 5 wk (midpoint of 4–6), subthema 2 wk.
        Assert.Contains("themaperiode 5 wk", indeling.Omschrijving);
        Assert.Contains("subthemaperiode 2 wk", indeling.Omschrijving);

        var themaperiodes = indeling.Blokken(Schooljaar(), Planningsblokniveau.Themaperiode);
        var subthemaperiodes = indeling.Blokken(Schooljaar(), Planningsblokniveau.Subthemaperiode);

        Assert.True(subthemaperiodes.Count > themaperiodes.Count);
        Assert.All(themaperiodes, b => Assert.Equal(Planningsblokniveau.Themaperiode, b.Niveau));
        Assert.All(subthemaperiodes, b => Assert.Equal(Planningsblokniveau.Subthemaperiode, b.Niveau));
    }

    /// <summary>
    /// <b>The regression that mattered most.</b> The first implementation chopped a target-length block off
    /// the front of each teaching stretch and left the remainder as its own block, which on this very fixture
    /// produced three <b>1-week</b> "themaperioden" (14–20 dec, 8–14 feb, 29 mrt–4 apr) — outside the 4–6 week
    /// range directie ratified on 2026-07-14. No test asserted block duration, so it passed.
    /// </summary>
    [Fact]
    public void Elke_themaperiode_valt_binnen_de_geratificeerde_vier_tot_zes_weken()
    {
        var blokken = new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions())
            .Blokken(Schooljaar(), Planningsblokniveau.Themaperiode);

        Assert.NotEmpty(blokken);
        foreach (var blok in blokken)
        {
            Assert.InRange(blok.AantalDagen, 4 * 7, 6 * 7);
        }
    }

    /// <summary>
    /// The fine tier subdivides the coarse one: every subthemaperiode lies entirely within exactly one
    /// themaperiode and names it via <c>OuderOrdinaal</c>. Previously the two tiers were independent chops of
    /// the year, so a subthemaperiode could straddle a themaperiode boundary — which would make E3-08's "zoom
    /// into this period" incoherent. The old test only asserted the fine tier had *more* blocks, which is a
    /// strictly weaker claim and was true even while the nesting property was false.
    /// </summary>
    [Fact]
    public void Elke_subthemaperiode_ligt_in_precies_een_themaperiode()
    {
        var indeling = new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions());
        var schooljaar = Schooljaar();

        var grof = indeling.Blokken(schooljaar, Planningsblokniveau.Themaperiode);
        var fijn = indeling.Blokken(schooljaar, Planningsblokniveau.Subthemaperiode);

        foreach (var sub in fijn)
        {
            var ouders = grof.Where(t => t.Omvat(sub)).ToList();
            Assert.Single(ouders);
            Assert.Equal(ouders[0].Ordinaal, sub.OuderOrdinaal);
        }

        // And together they tile each coarse block exactly — no gap, no overlap.
        foreach (var themaperiode in grof)
        {
            var kinderen = fijn.Where(s => s.OuderOrdinaal == themaperiode.Ordinaal).ToList();
            Assert.NotEmpty(kinderen);
            Assert.Equal(themaperiode.Start, kinderen[0].Start);
            Assert.Equal(themaperiode.Eind, kinderen[^1].Eind);
            Assert.Equal(themaperiode.AantalDagen, kinderen.Sum(k => k.AantalDagen));
        }
    }

    /// <summary>
    /// Pins the honest contract about <c>Ordinaal</c>: it is a display position, <b>not</b> a key that
    /// survives a vacation edit. Moving one vacation reshapes the grid, so the same ordinal can denote a
    /// different stretch of the year. The type previously claimed the opposite. Persisted placements must key
    /// on <c>Start</c>, and re-anchoring after a vacation edit is an explicit E3-07 concern.
    /// </summary>
    [Fact]
    public void Ordinaal_is_geen_stabiele_sleutel_over_vakantiewijzigingen()
    {
        var indeling = new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions());

        var origineel = indeling.Blokken(Schooljaar(), Planningsblokniveau.Themaperiode);

        // Shift only the kerstvakantie one week earlier; the teaching stretches around it change length.
        var gewijzigd = new Schooljaar("2026-2027", Start, Eind);
        gewijzigd.VoegVakantieToe(new Schoolvakantie("Herfstvakantie", new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 8)));
        gewijzigd.VoegVakantieToe(new Schoolvakantie("Kerstvakantie", new DateOnly(2026, 12, 14), new DateOnly(2026, 12, 27)));
        gewijzigd.VoegVakantieToe(new Schoolvakantie("Krokusvakantie", new DateOnly(2027, 2, 15), new DateOnly(2027, 2, 21)));
        gewijzigd.VoegVakantieToe(new Schoolvakantie("Paasvakantie", new DateOnly(2027, 4, 5), new DateOnly(2027, 4, 18)));

        var na = indeling.Blokken(gewijzigd, Planningsblokniveau.Themaperiode);

        // At least one ordinal now denotes a different stretch of the year. Asserted generally rather than at
        // a hand-picked ordinal: even distribution leaves the blocks *before* the edited vacation untouched,
        // so only later ordinals move — which is precisely why a spot-check would be a fragile way to state
        // the property.
        var verschoven = origineel
            .Where(voor => na.Any(nu => nu.Ordinaal == voor.Ordinaal && nu.Start != voor.Start))
            .ToList();

        Assert.NotEmpty(verschoven);

        // Identity is (niveau, start), so a shifted ordinal is correctly a *different* block.
        foreach (var voor in verschoven)
        {
            Assert.NotEqual(voor, na.Single(nu => nu.Ordinaal == voor.Ordinaal));
        }
    }

    /// <summary>
    /// Two blocks with the same tier and start date are the same block, whatever their ordinal — the
    /// documented identity. Previously <c>Planningsblok</c> was a record whose synthesised equality compared
    /// all four properties, contradicting its own doc.
    /// </summary>
    [Fact]
    public void Identiteit_is_niveau_plus_startdatum()
    {
        var a = new Planningsblok(Planningsblokniveau.Themaperiode, 3, Start, Start.AddDays(30));
        var b = new Planningsblok(Planningsblokniveau.Themaperiode, 7, Start, Start.AddDays(20));
        var c = new Planningsblok(Planningsblokniveau.Subthemaperiode, 3, Start, Start.AddDays(30));

        Assert.Equal(a, b);
        Assert.Equal(a.GetHashCode(), b.GetHashCode());
        Assert.NotEqual(a, c); // different tier
    }

    /// <summary>
    /// The documented known limit (Art. XIV, open): a teaching stretch too short to hold a full themaperiode
    /// yields one short block rather than being silently dropped or merged across the vacation. Asserted so
    /// the behaviour is visible and deliberate instead of incidental.
    /// </summary>
    [Fact]
    public void Te_korte_lesperiode_levert_een_kort_blok()
    {
        // A 12-day school "year" — far shorter than one themaperiode.
        var kort = new Schooljaar("2026-2027", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 12));

        var blokken = new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions())
            .Blokken(kort, Planningsblokniveau.Themaperiode);

        var blok = Assert.Single(blokken);
        Assert.Equal(12, blok.AantalDagen);
        Assert.Equal(1, blok.Ordinaal);
    }

    [Fact]
    public void Subthemaperiode_langer_dan_themaperiode_wordt_geweigerd()
    {
        var fout = Assert.Throws<ArgumentException>(() =>
            new GeconfigureerdePlanningsblokIndeling(
                new PlanningsblokOptions { ThemaperiodeWeken = 2, SubthemaperiodeWeken = 5 }));

        Assert.Contains(PlanningsblokOptions.SectionName, fout.Message);
    }

    /// <summary>
    /// The heart of the seam: the same code yields a different grain purely from configuration. If this
    /// passes, the ratified default is a configured outcome rather than a compiled-in decision — which is
    /// exactly what ADR-0013 requires so a later directie change is a config edit, not a refactor.
    /// </summary>
    [Fact]
    public void Grain_volgt_configuratie_zonder_codewijziging()
    {
        var vijfWeken = new GeconfigureerdePlanningsblokIndeling(
            new PlanningsblokOptions { ThemaperiodeWeken = 5 });
        var drieWeken = new GeconfigureerdePlanningsblokIndeling(
            new PlanningsblokOptions { ThemaperiodeWeken = 3 });

        var metVijf = vijfWeken.Blokken(Schooljaar(), Planningsblokniveau.Themaperiode);
        var metDrie = drieWeken.Blokken(Schooljaar(), Planningsblokniveau.Themaperiode);

        // A shorter themaperiode must produce more blocks over the same year.
        Assert.True(metDrie.Count > metVijf.Count);
        Assert.Contains("themaperiode 3 wk", drieWeken.Omschrijving);
    }

    /// <summary>
    /// Blocks never span a vacation, so their spans are uneven — the concrete reason the grid cannot be a
    /// month sequence. A themaperiode interrupted by the kerstvakantie is not one period a teacher can plan
    /// a thema into.
    /// </summary>
    [Fact]
    public void Blokken_lopen_nooit_door_een_vakantie()
    {
        var schooljaar = Schooljaar();
        var indeling = new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions());

        var blokken = indeling.Blokken(schooljaar, Planningsblokniveau.Themaperiode);

        foreach (var vakantie in schooljaar.Vakanties)
        {
            Assert.DoesNotContain(blokken, b => b.Bevat(vakantie.Start) || b.Bevat(vakantie.Eind));
        }

        // Every day inside a block is a teaching day.
        foreach (var blok in blokken)
        {
            Assert.True(schooljaar.IsLesdag(blok.Start), $"blok {blok.Ordinaal} start op een vakantiedag");
            Assert.True(schooljaar.IsLesdag(blok.Eind), $"blok {blok.Ordinaal} eindigt op een vakantiedag");
        }
    }

    [Fact]
    public void Blokken_blijven_binnen_het_schooljaar_en_zijn_opeenvolgend()
    {
        var schooljaar = Schooljaar();
        var blokken = new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions())
            .Blokken(schooljaar, Planningsblokniveau.Themaperiode);

        Assert.NotEmpty(blokken);
        Assert.Equal(schooljaar.Start, blokken[0].Start);
        Assert.Equal(schooljaar.Eind, blokken[^1].Eind);

        // Ordinals are 1-based and gapless, and blocks are in chronological order.
        Assert.Equal(Enumerable.Range(1, blokken.Count), blokken.Select(b => b.Ordinaal));
        for (var i = 1; i < blokken.Count; i++)
        {
            Assert.True(blokken[i].Start > blokken[i - 1].Eind);
        }
    }

    /// <summary>
    /// Proves the grain travels as <b>configuration</b>, not merely as constructor arguments: the options are
    /// bound from a real <see cref="IConfiguration"/> using the section path and property names a deployer
    /// would write in <c>appsettings.json</c>. Without this, a wrong section path would ship silently and the
    /// grain would be un-overridable in practice — the object-level tests above would still pass. Mirrors
    /// <c>OpstapImportDisciplineSelectieTests</c>, the precedent this seam is modelled on.
    /// </summary>
    [Fact]
    public void Grain_wordt_gebonden_uit_de_configuratiesectie()
    {
        var configuratie = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [$"{PlanningsblokOptions.SectionName}:ThemaperiodeWeken"] = "4",
                [$"{PlanningsblokOptions.SectionName}:SubthemaperiodeWeken"] = "1",
            })
            .Build();

        var opties = new PlanningsblokOptions();
        configuratie.GetSection(PlanningsblokOptions.SectionName).Bind(opties);

        Assert.Equal(4, opties.ThemaperiodeWeken);
        Assert.Equal(1, opties.SubthemaperiodeWeken);

        var indeling = new GeconfigureerdePlanningsblokIndeling(opties);
        Assert.Contains("themaperiode 4 wk", indeling.Omschrijving);
        Assert.Contains("subthemaperiode 1 wk", indeling.Omschrijving);
    }

    /// <summary>
    /// The section path in <c>appsettings.json</c> must be exactly the one the options class declares —
    /// finding 4 was that no such section existed at all, so nothing caught a mismatch.
    /// </summary>
    [Fact]
    public void Sectienaam_is_de_verwachte_configuratiesleutel()
    {
        Assert.Equal("Planning:Blokindeling", PlanningsblokOptions.SectionName);
    }

    [Fact]
    public void Onbruikbare_configuratie_wordt_geweigerd()
    {
        var fout = Assert.Throws<ArgumentException>(() =>
            new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions { ThemaperiodeWeken = 0 }));

        // The message must point at the config section, since that is where the fix lives.
        Assert.Contains(PlanningsblokOptions.SectionName, fout.Message);
    }

    /// <summary>
    /// Guards Art. IX.3's prohibition structurally: no tier may be named after a calendar unit. If someone
    /// later adds a <c>Maand</c> member, this fails.
    /// </summary>
    [Fact]
    public void Geen_enkel_niveau_is_een_kalendereenheid()
    {
        var namen = Enum.GetNames<Planningsblokniveau>();

        Assert.Equal(["Themaperiode", "Subthemaperiode"], namen);
        Assert.DoesNotContain("Maand", namen);
    }

    /// <summary>A Belgian school year with the four standard vacations.</summary>
    private static Schooljaar Schooljaar()
    {
        var schooljaar = new Schooljaar("2026-2027", Start, Eind);
        schooljaar.VoegVakantieToe(new Schoolvakantie("Herfstvakantie", new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 8)));
        schooljaar.VoegVakantieToe(new Schoolvakantie("Kerstvakantie", new DateOnly(2026, 12, 21), new DateOnly(2027, 1, 3)));
        schooljaar.VoegVakantieToe(new Schoolvakantie("Krokusvakantie", new DateOnly(2027, 2, 15), new DateOnly(2027, 2, 21)));
        schooljaar.VoegVakantieToe(new Schoolvakantie("Paasvakantie", new DateOnly(2027, 4, 5), new DateOnly(2027, 4, 18)));
        return schooljaar;
    }
}
