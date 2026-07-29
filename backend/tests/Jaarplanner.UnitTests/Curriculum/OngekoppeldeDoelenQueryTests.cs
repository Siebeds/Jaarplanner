using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// Pins the E2-06 "ongekoppelde doelen" gap query (FR-4.4, Art. V) through the real EF Core mapping via
/// <see cref="OngekoppeldeDoelenQuery"/>. The load-bearing behaviour: a leerplandoel counts as linked
/// only when it carries a <c>DoelKoppeling</c> with status <c>aanvaard</c>/<c>manueel</c> — a merely
/// <c>voorgesteld</c> (or <c>geweigerd</c>) suggestion leaves it in the gap list — and the list is
/// recomputed from the current link state, so accepting a suggestion removes its doel (the "updates as
/// links change" of FR-4.4). Uses the EF Core in-memory provider (same choice as the other query tests).
/// </summary>
public sealed class OngekoppeldeDoelenQueryTests
{
    private static DbContextOptions<AppDbContext> Options(string db) =>
        new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(db).Options;

    private static Leerplandoel Leerdoel(string code, string domein = "Natuur", string subdomein = "Levend") =>
        new(code, Doelsoort.Minimumdoel, "K3", domein, subdomein, disciplineNummer: "9", tekst: $"Doel {code}");

    [Fact]
    public async Task Alleen_aanvaard_en_manueel_tellen_als_gekoppeld_voorgesteld_en_geweigerd_niet()
    {
        var options = Options($"e2_06_{Guid.NewGuid():N}");

        await using (var ctx = new AppDbContext(options))
        {
            // Five leerplandoelen; each will get a different link state.
            ctx.Leerplandoelen.AddRange(
                Leerdoel("A-AANVAARD"),
                Leerdoel("B-MANUEEL"),
                Leerdoel("C-VOORGESTELD"),
                Leerdoel("D-GEWEIGERD"),
                Leerdoel("E-ONGEKOPPELD"));

            // One thema carrying four thema-level doelsuggesties, one per status.
            var thema = new Thema("Herfst", duurWeken: 4);
            thema.VoegDoelsuggestieToe(new DoelKoppeling("A-AANVAARD", KoppelingStatus.Voorgesteld, "m"));
            thema.VoegDoelsuggestieToe(new DoelKoppeling("B-MANUEEL", KoppelingStatus.Voorgesteld, "m"));
            thema.VoegDoelsuggestieToe(new DoelKoppeling("C-VOORGESTELD", KoppelingStatus.Voorgesteld, "m"));
            thema.VoegDoelsuggestieToe(new DoelKoppeling("D-GEWEIGERD", KoppelingStatus.Voorgesteld, "m"));

            // Teacher decisions (E2-05): accept A, adjust B to manueel, reject D — C stays voorgesteld.
            thema.Doelsuggesties.Single(k => k.LeerplandoelCode == "A-AANVAARD").WijzigStatus(KoppelingStatus.Aanvaard);
            thema.Doelsuggesties.Single(k => k.LeerplandoelCode == "B-MANUEEL").WijzigStatus(KoppelingStatus.Manueel);
            thema.Doelsuggesties.Single(k => k.LeerplandoelCode == "D-GEWEIGERD").WijzigStatus(KoppelingStatus.Geweigerd);

            ctx.Themas.Add(thema);
            await ctx.SaveChangesAsync();
        }

        await using (var ctx = new AppDbContext(options))
        {
            var query = new OngekoppeldeDoelenQuery(ctx);
            var ongekoppeld = await query.HaalOngekoppeldeDoelenAsync();

            // Gekoppeld: A (aanvaard) + B (manueel). Ongekoppeld: C (voorgesteld), D (geweigerd), E (none).
            var codes = ongekoppeld.Select(d => d.Code).ToList();
            Assert.Equal(new[] { "C-VOORGESTELD", "D-GEWEIGERD", "E-ONGEKOPPELD" }, codes);
            // The view carries the browse context needed by the frontend badge/list.
            Assert.All(ongekoppeld, d => Assert.Equal(Doelsoort.Minimumdoel, d.Doelsoort));
        }
    }

    [Fact]
    public async Task Koppeling_via_themadoel_subdoel_of_activiteit_telt_ook_mee()
    {
        var options = Options($"e2_06_{Guid.NewGuid():N}");
        var klasId = Guid.NewGuid();

        await using (var ctx = new AppDbContext(options))
        {
            ctx.Leerplandoelen.AddRange(
                Leerdoel("VIA-THEMADOEL"),
                Leerdoel("VIA-SUBDOEL"),
                Leerdoel("VIA-ACTIVITEIT"),
                Leerdoel("BLIJFT-OVER"));

            // A Klas lives in a Schooljaar (Art. IX.3 containment, E3-01).
            var schooljaar = TestSchooljaar.Maak();
            schooljaar.VoegKlasToe("L3", leerjaar: 3);
            ctx.Schooljaren.Add(schooljaar);

            var thema = new Thema("Water", duurWeken: 5);

            // A curated themadoel (aanvaard).
            thema.VoegThemadoelToe(new DoelKoppeling("VIA-THEMADOEL", KoppelingStatus.Aanvaard, "anchor"));

            // A subthema with a manueel subdoel and an aanvaard activiteit link.
            var subthema = thema.VoegSubthemaToe("Regen", duurWeken: 2, klasId, "K3");
            subthema.VoegSubdoelToe("K3", new DoelKoppeling("VIA-SUBDOEL", KoppelingStatus.Manueel));
            var activiteit = subthema.VoegActiviteitToe("Regenmeter", ActiviteitType.Onderzoek);
            activiteit.VoegDoelkoppelingToe(new DoelKoppeling("VIA-ACTIVITEIT", KoppelingStatus.Aanvaard, "meten"));

            ctx.Themas.Add(thema);
            await ctx.SaveChangesAsync();
        }

        await using (var ctx = new AppDbContext(options))
        {
            var query = new OngekoppeldeDoelenQuery(ctx);
            var ongekoppeld = await query.HaalOngekoppeldeDoelenAsync();

            // Only the doel linked via nothing survives; the three real links (themadoel/subdoel/activiteit) drop out.
            Assert.Equal(new[] { "BLIJFT-OVER" }, ongekoppeld.Select(d => d.Code).ToArray());
        }
    }

    [Fact]
    public async Task Lege_school_geeft_alle_leerplandoelen_terug_gesorteerd()
    {
        var options = Options($"e2_06_{Guid.NewGuid():N}");

        await using (var ctx = new AppDbContext(options))
        {
            // Out-of-order insert to prove the (domein, subdomein, code) ordering.
            ctx.Leerplandoelen.AddRange(
                Leerdoel("Z1", domein: "Wiskunde", subdomein: "Getallen"),
                Leerdoel("A1", domein: "Natuur", subdomein: "Levend"),
                Leerdoel("A2", domein: "Natuur", subdomein: "Levend"));
            await ctx.SaveChangesAsync();
        }

        await using (var ctx = new AppDbContext(options))
        {
            var query = new OngekoppeldeDoelenQuery(ctx);
            var ongekoppeld = await query.HaalOngekoppeldeDoelenAsync();

            Assert.Equal(new[] { "A1", "A2", "Z1" }, ongekoppeld.Select(d => d.Code).ToArray());
        }
    }
}
