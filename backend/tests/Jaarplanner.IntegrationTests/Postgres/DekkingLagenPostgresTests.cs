using Jaarplanner.Application.Dekking;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Dekking;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The four-layer coverage link query against <b>real PostgreSQL</b> (E5-01, Art. V.1/V.6).
/// <para>
/// <b>Why real Postgres and not the EF in-memory provider, demonstrated rather than argued.</b> The four reads are
/// subqueries over <i>owned collections</i> nested up to three levels deep (thema → subthema → activiteit →
/// doelkoppeling). The in-memory provider evaluates that in LINQ, so it says nothing about whether Npgsql can
/// translate it, and a failed translation throws at runtime rather than at build time.
/// <para>
/// <b>This test earned its place on its first run.</b> <c>EfDekkingOpslag</c> was first written as ONE query —
/// <c>.Concat()</c> over the four branches with a single <c>Distinct()</c>, translated to one SQL UNION. That is
/// not translatable: EF throws <i>"Unable to translate set operation after client projection has been applied"</i>,
/// because each branch already projects into a <c>DekkendeKoppeling</c>. Four of these five tests failed on it. The
/// union therefore moved client-side, following what <c>LeerplandoelenQuery.HaalKoppelingenAsync</c> already does
/// for these same four layers. Had the query been covered only by the in-memory provider it would have passed CI
/// and thrown the first time a teacher opened a dekkingsoverzicht.
/// </para>
/// <para>
/// This is precisely the carry-forward the E2-06 antagonist attached to this story — it asked for a Postgres test
/// of the "UNION of owned subqueries" translation when the coverage queries were written — and it is the same class
/// of gap that hid FK violations here for two whole epics.
/// </para>
/// <para>
/// <b>What each test proves is a rule, not a row count.</b> The layer set and its per-class scoping are an owner
/// ruling (2026-08-03), and the whole point of the ruling is that it is not derivable from the code — so each layer
/// gets a test that fails if that layer is dropped, and the scoping gets a test that fails if the klas filter is
/// removed.
/// </para>
/// </summary>
public sealed class DekkingLagenPostgresTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("dekking");
    }

    public async Task DisposeAsync()
    {
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    [PostgresFact]
    public async Task Alle_vier_de_lagen_dekken_en_worden_echt_door_Postgres_geleverd()
    {
        // One thema carrying a DIFFERENT code in each of the four layers, so a dropped layer shows up as a missing
        // code rather than being masked by another layer carrying the same one.
        var (klasId, themaId) = await ZetOpAsync(async (context, klas, thema) =>
        {
            thema.VoegThemadoelToe(new DoelKoppeling("L1-THEMADOEL", KoppelingStatus.Aanvaard, "anchor"));
            thema.VoegThemadoelToe(new DoelKoppeling("L1-TWEEDE", KoppelingStatus.Aanvaard, "anchor"));
            // Accepted the way a teacher accepts: the domain refuses a suggestion that does not START as
            // voorgesteld (Art. IV.1/IV.2), so arranging one straight to aanvaard is not merely inconvenient, it is
            // a state the application cannot produce. Going through WijzigStatus keeps the fixture honest.
            thema.VoegDoelsuggestieToe(new DoelKoppeling("L2-SUGGESTIE", KoppelingStatus.Voorgesteld, "past"))
                .WijzigStatus(KoppelingStatus.Aanvaard);

            var subthema = thema.VoegSubthemaToe("Bladeren", 2, klas.Id, "5");
            subthema.VoegSubdoelToe("5", new DoelKoppeling("L3-SUBDOEL", KoppelingStatus.Aanvaard));

            var activiteit = subthema.VoegActiviteitToe("Bladeren zoeken", ActiviteitType.Waarneming);
            activiteit.VoegDoelkoppelingToe(new DoelKoppeling("L4-ACTIVITEIT", KoppelingStatus.Manueel));

            await context.SaveChangesAsync();
        });

        await using var leescontext = _db.MaakContext();
        var opslag = new EfDekkingOpslag(leescontext);

        // Every layer has to survive translation to real SQL. When this was one UNION instead of four reads, this
        // line threw rather than returning a wrong answer, which is the whole reason the test exists.
        var koppelingen = await opslag.HaalDekkendeKoppelingenAsync(klasId, [themaId]);

        Assert.Equal(
            ["L1-THEMADOEL", "L1-TWEEDE", "L2-SUGGESTIE", "L3-SUBDOEL", "L4-ACTIVITEIT"],
            koppelingen.Select(k => k.LeerplandoelCode).OrderBy(c => c, StringComparer.Ordinal));

        // The thema name travels with every row: Art. V.4 wants the overview exportable as PROOF, and a proof has
        // to name what covers the goal.
        Assert.All(koppelingen, k => Assert.False(string.IsNullOrWhiteSpace(k.ThemaNaam)));
    }

    [PostgresFact]
    public async Task Alleen_aanvaarde_en_manuele_koppelingen_dekken()
    {
        var (klasId, themaId) = await ZetOpAsync(async (context, klas, thema) =>
        {
            thema.VoegThemadoelToe(new DoelKoppeling("TELT-AANVAARD", KoppelingStatus.Aanvaard, "anchor"));
            thema.VoegThemadoelToe(new DoelKoppeling("TELT-MANUEEL", KoppelingStatus.Manueel, "anchor"));

            // A voorgesteld suggestion would let the AI grant dekking (Art. IV.1); a geweigerd link never counted.
            thema.VoegDoelsuggestieToe(new DoelKoppeling("TELT-NIET-VOORGESTELD", KoppelingStatus.Voorgesteld, "?"));
            thema.VoegDoelsuggestieToe(new DoelKoppeling("TELT-NIET-GEWEIGERD", KoppelingStatus.Voorgesteld, "nee"))
                .WijzigStatus(KoppelingStatus.Geweigerd);

            var subthema = thema.VoegSubthemaToe("Bladeren", 2, klas.Id, "5");
            subthema.VoegSubdoelToe("5", new DoelKoppeling("TELT-NIET-SUBDOEL", KoppelingStatus.Voorgesteld));

            var activiteit = subthema.VoegActiviteitToe("Bladeren zoeken", ActiviteitType.Waarneming);
            activiteit.VoegDoelkoppelingToe(new DoelKoppeling("TELT-NIET-ACT", KoppelingStatus.Geweigerd));

            await context.SaveChangesAsync();
        });

        await using var leescontext = _db.MaakContext();
        var koppelingen = await new EfDekkingOpslag(leescontext)
            .HaalDekkendeKoppelingenAsync(klasId, [themaId]);

        // The status filter is applied in ALL FOUR layers, which is what the four negatives above pin: an inline
        // predicate repeated four times is exactly the kind of thing that gets added to three of them.
        Assert.Equal(
            ["TELT-AANVAARD", "TELT-MANUEEL"],
            koppelingen.Select(k => k.LeerplandoelCode).OrderBy(c => c, StringComparer.Ordinal));
    }

    [PostgresFact]
    public async Task Een_subthema_van_een_andere_klas_dekt_niet()
    {
        // The load-bearing half of the owner's ruling. Both classes place the same school-wide thema, but the
        // subthema (and therefore its subdoel and activiteit) belongs to class B. Class A must not be credited with
        // it: Art. IX.2 scopes Subthema/Subdoel/Activiteit per klas and leeftijd, so that content is taught to B's
        // pupils, not A's. Without the KlasId filter this test fails and every class silently inherits every other
        // class's coverage.
        Guid klasAId = Guid.Empty;
        Guid themaId = Guid.Empty;

        await using (var context = _db.MaakContext())
        {
            await ZorgVoorDoelenAsync(
                context,
                ["SCHOOLBREED", "VAN-KLAS-B-SUBDOEL", "VAN-KLAS-B-ACTIVITEIT"]);

            // Schooljaar.Naam is varchar(32), so the uniquifier is a SHORT slice of a GUID rather than a whole
            // one: a full 32-char suffix overflowed the column and Postgres refused the insert with 22001. The
            // in-memory provider enforces no length at all and would have accepted it.
            var schooljaar = new Schooljaar(
                $"2026-2027-{Guid.NewGuid():N}"[..20],
                new DateOnly(2026, 9, 1),
                new DateOnly(2027, 6, 30));
            var klasA = schooljaar.VoegKlasToe($"K3A-{Guid.NewGuid():N}", leerjaar: 0);
            var klasB = schooljaar.VoegKlasToe($"K3B-{Guid.NewGuid():N}", leerjaar: 0);
            context.Schooljaren.Add(schooljaar);

            var thema = new Thema($"Herfst-{Guid.NewGuid():N}", duurWeken: 5);
            thema.VoegThemadoelToe(new DoelKoppeling("SCHOOLBREED", KoppelingStatus.Aanvaard, "anchor"));

            var subthemaVanB = thema.VoegSubthemaToe("Bladeren", 2, klasB.Id, "5");
            subthemaVanB.VoegSubdoelToe("5", new DoelKoppeling("VAN-KLAS-B-SUBDOEL", KoppelingStatus.Aanvaard));

            var activiteitVanB = subthemaVanB.VoegActiviteitToe("Bladeren zoeken", ActiviteitType.Waarneming);
            activiteitVanB.VoegDoelkoppelingToe(
                new DoelKoppeling("VAN-KLAS-B-ACTIVITEIT", KoppelingStatus.Aanvaard));

            context.Themas.Add(thema);
            await context.SaveChangesAsync();

            klasAId = klasA.Id;
            themaId = thema.Id;
        }

        await using var leescontext = _db.MaakContext();
        var koppelingen = await new EfDekkingOpslag(leescontext)
            .HaalDekkendeKoppelingenAsync(klasAId, [themaId]);

        // A gets the school-wide themadoel and NOTHING of B's class-scoped content.
        Assert.Equal(["SCHOOLBREED"], koppelingen.Select(k => k.LeerplandoelCode));
    }

    [PostgresFact]
    public async Task Een_niet_geplaatst_thema_dekt_niet()
    {
        // Art. V.1's "placed in the plan": the query is only ever asked about placed thema's, so a thema the class
        // did not place must not leak in through a layer that forgot the thema filter.
        var (klasId, _) = await ZetOpAsync(async (context, klas, thema) =>
        {
            thema.VoegThemadoelToe(new DoelKoppeling("NIET-GEPLAATST", KoppelingStatus.Aanvaard, "anchor"));

            var subthema = thema.VoegSubthemaToe("Bladeren", 2, klas.Id, "5");
            subthema.VoegSubdoelToe("5", new DoelKoppeling("OOK-NIET", KoppelingStatus.Aanvaard));

            await context.SaveChangesAsync();
        });

        await using var leescontext = _db.MaakContext();

        // Asked about a thema id that exists nowhere: the answer is empty, not everything.
        var koppelingen = await new EfDekkingOpslag(leescontext)
            .HaalDekkendeKoppelingenAsync(klasId, [Guid.NewGuid()]);

        Assert.Empty(koppelingen);
    }

    [PostgresFact]
    public async Task Een_ingetrokken_doel_blijft_in_de_noemer_en_draagt_zijn_vlag()
    {
        // NietMeerInOpstap = a re-import found the goal gone from Op.stap while school content still linked to it,
        // so it was flagged and KEPT (Art. III.4). Dropping such a goal from the denominator would shrink the total
        // and raise the percentage, which is the one direction a coverage figure must never move on its own.
        //
        // Asserted here rather than in the unit tests because Leerplandoel exposes no public mutator for the flag
        // (Art. III.1) — it is set the way the sanctioned import path sets it, through EF property metadata.
        await using (var context = _db.MaakContext())
        {
            await ZorgVoorDoelenAsync(context, ["NOG-IN-OPSTAP", "INGETROKKEN"]);

            var ingetrokken = await context.Leerplandoelen.SingleAsync(l => l.Code == "INGETROKKEN");
            context.Entry(ingetrokken).Property(l => l.NietMeerInOpstap).CurrentValue = true;
            await context.SaveChangesAsync();
        }

        await using var leescontext = _db.MaakContext();
        var doelen = await new EfDekkingOpslag(leescontext).HaalLeerplandoelenAsync();

        var vlag = doelen.Single(d => d.Code == "INGETROKKEN");
        Assert.True(vlag.NietMeerInOpstap);
        Assert.False(doelen.Single(d => d.Code == "NOG-IN-OPSTAP").NietMeerInOpstap);

        // Both are present: the withdrawn one is flagged, never filtered.
        Assert.Equal(2, doelen.Count(d => d.Code is "NOG-IN-OPSTAP" or "INGETROKKEN"));
    }

    [PostgresFact]
    public async Task De_jaarfase_seam_filtert_echt_en_is_dus_geen_decoratie()
    {
        // The denominator scope is an OPEN Art. XIV decision and every caller passes null today. The seam is tested
        // anyway, deliberately: a parameter accepted and ignored is discovered to be decorative on the day someone
        // finally needs it, which is the worst possible moment. Ordinal and case-sensitive on purpose — the jaarFase
        // code form (JK/K2/K3 vs 1K/2K/3K) is itself unresolved, so a mismatch should surface rather than be folded
        // away.
        await using (var context = _db.MaakContext())
        {
            await ZorgVoorDoelenAsync(context, ["FASE-K3"], jaarFase: "K3");
            await ZorgVoorDoelenAsync(context, ["FASE-L6"], jaarFase: "L6");
        }

        await using var leescontext = _db.MaakContext();
        var opslag = new EfDekkingOpslag(leescontext);

        var alles = await opslag.HaalLeerplandoelenAsync();
        Assert.Contains(alles, d => d.Code == "FASE-K3");
        Assert.Contains(alles, d => d.Code == "FASE-L6");

        var alleenK3 = await opslag.HaalLeerplandoelenAsync(["K3"]);
        Assert.Contains(alleenK3, d => d.Code == "FASE-K3");
        Assert.DoesNotContain(alleenK3, d => d.Code == "FASE-L6");

        // An empty collection means "no scope", not "nothing in scope" — otherwise a caller handing over an empty
        // filter would silently report 0 out of 0, which is a coverage figure that looks perfect.
        var leegIsGeenScope = await opslag.HaalLeerplandoelenAsync([]);
        Assert.Contains(leegIsGeenScope, d => d.Code == "FASE-L6");
    }

    [PostgresFact]
    public async Task De_kandidaatlezing_levert_alle_vier_de_lagen_met_hun_beslisstatus()
    {
        // The gap-analyse's own read (E5-05). Four layers again, and the two things that make it different from the
        // covering read above are both asserted here: an UNDECIDED link comes back (flagged, not filtered), and a
        // REJECTED one does not come back at all.
        //
        // The thema is deliberately never placed in a plan, which is the other difference: this read takes no thema
        // ids, because "the thema carrying this goal is in no period" is one of the four things E5-05 must be able to
        // say and a query narrowed to placed thema's could never say it.
        var (klasId, _) = await ZetOpAsync(async (context, klas, thema) =>
        {
            thema.VoegThemadoelToe(new DoelKoppeling("KAND-THEMADOEL", KoppelingStatus.Aanvaard, "anchor"));
            thema.VoegDoelsuggestieToe(new DoelKoppeling("KAND-SUGGESTIE", KoppelingStatus.Voorgesteld, "past"));
            thema.VoegDoelsuggestieToe(new DoelKoppeling("KAND-GEWEIGERD", KoppelingStatus.Voorgesteld, "nee"))
                .WijzigStatus(KoppelingStatus.Geweigerd);

            var subthema = thema.VoegSubthemaToe("Bladeren", 2, klas.Id, "5");
            subthema.VoegSubdoelToe("5", new DoelKoppeling("KAND-SUBDOEL", KoppelingStatus.Manueel));

            var activiteit = subthema.VoegActiviteitToe("Bladeren zoeken", ActiviteitType.Waarneming);
            activiteit.VoegDoelkoppelingToe(new DoelKoppeling("KAND-ACTIVITEIT", KoppelingStatus.Voorgesteld));

            await context.SaveChangesAsync();
        });

        await using var leescontext = _db.MaakContext();
        var kandidaten = await new EfDekkingOpslag(leescontext).HaalKandidaatKoppelingenAsync(klasId);

        Assert.Equal(
            ["KAND-ACTIVITEIT", "KAND-SUBDOEL", "KAND-SUGGESTIE", "KAND-THEMADOEL"],
            kandidaten.Select(k => k.LeerplandoelCode).OrderBy(c => c, StringComparer.Ordinal));

        // The flag decides which of the four causes a doel gets, so a read that returned every row with the same
        // value would still satisfy the assertion above while making three of the four causes unreachable.
        Assert.True(kandidaten.Single(k => k.LeerplandoelCode == "KAND-THEMADOEL").IsBeslist);
        Assert.True(kandidaten.Single(k => k.LeerplandoelCode == "KAND-SUBDOEL").IsBeslist);
        Assert.False(kandidaten.Single(k => k.LeerplandoelCode == "KAND-SUGGESTIE").IsBeslist);
        Assert.False(kandidaten.Single(k => k.LeerplandoelCode == "KAND-ACTIVITEIT").IsBeslist);
    }

    [PostgresFact]
    public async Task Een_subthema_van_een_andere_klas_is_ook_geen_kandidaat()
    {
        // The owner ruling of 2026-08-03 scopes layers 3 and 4 per class, and the gap-analyse has to honour it for
        // the same reason coverage does: naming class B's subthema as the route to closing class A's gap would send a
        // teacher to content that is not theirs to plan.
        //
        // Written as its own test rather than folded into the one above because the failure it guards is a MISSING
        // filter, and a fixture with only one class cannot distinguish a filter that works from one that is absent.
        await using var context = _db.MaakContext();

        await ZorgVoorDoelenAsync(context, ["KAND-THEMADOEL", "KAND-SUBDOEL"]);

        var schooljaar = new Schooljaar(
            $"2026-2027-{Guid.NewGuid():N}"[..20],
            new DateOnly(2026, 9, 1),
            new DateOnly(2027, 6, 30));
        var klasA = schooljaar.VoegKlasToe($"A-{Guid.NewGuid():N}", leerjaar: 0);
        var klasB = schooljaar.VoegKlasToe($"B-{Guid.NewGuid():N}", leerjaar: 0);
        context.Schooljaren.Add(schooljaar);

        var thema = new Thema($"Herfst-{Guid.NewGuid():N}", duurWeken: 5);
        thema.VoegThemadoelToe(new DoelKoppeling("KAND-THEMADOEL", KoppelingStatus.Aanvaard, "anchor"));

        var subthemaVanB = thema.VoegSubthemaToe("Bladeren", 2, klasB.Id, "5");
        subthemaVanB.VoegSubdoelToe("5", new DoelKoppeling("KAND-SUBDOEL", KoppelingStatus.Aanvaard));

        context.Themas.Add(thema);
        await context.SaveChangesAsync();

        await using var leescontext = _db.MaakContext();
        var kandidaten = await new EfDekkingOpslag(leescontext).HaalKandidaatKoppelingenAsync(klasA.Id);

        // A gets the school-wide themadoel and nothing of B's class-scoped content.
        Assert.Equal(["KAND-THEMADOEL"], kandidaten.Select(k => k.LeerplandoelCode));
    }

    [PostgresFact]
    public async Task De_besliste_kandidaten_zeggen_hetzelfde_als_de_dekkende_lezing()
    {
        // THE PIN BETWEEN THE TWO READS, and the reason it is worth a test of its own is that nothing in the code
        // makes it true: the four-layer, four-status predicate is written out EIGHT times across the two methods,
        // because EF cannot translate a call to a shared one (E1-17).
        //
        // What breaks if they drift: DekkingService concludes "WachtOpBeslissing" by finding a decided link on a
        // thema standing in the plan, and that is only sound because a decided link on an ACCEPTED placement would
        // already have made the goal covered by the other read. A layer present in one query and missing from the
        // other turns that into a doel reported as one click from covered while the click does nothing.
        var (klasId, themaId) = await ZetOpAsync(async (context, klas, thema) =>
        {
            thema.VoegThemadoelToe(new DoelKoppeling("KAND-THEMADOEL", KoppelingStatus.Aanvaard, "anchor"));
            thema.VoegDoelsuggestieToe(new DoelKoppeling("KAND-SUGGESTIE", KoppelingStatus.Voorgesteld, "past"))
                .WijzigStatus(KoppelingStatus.Aanvaard);

            var subthema = thema.VoegSubthemaToe("Bladeren", 2, klas.Id, "5");
            subthema.VoegSubdoelToe("5", new DoelKoppeling("KAND-SUBDOEL", KoppelingStatus.Manueel));

            var activiteit = subthema.VoegActiviteitToe("Bladeren zoeken", ActiviteitType.Waarneming);
            activiteit.VoegDoelkoppelingToe(new DoelKoppeling("KAND-ACTIVITEIT", KoppelingStatus.Manueel));

            // An undecided one, so the two reads genuinely have to differ somewhere. Without it this test would pass
            // for a candidate read that simply forgot to include voorgesteld links at all.
            thema.VoegDoelsuggestieToe(new DoelKoppeling("KAND-GEWEIGERD", KoppelingStatus.Voorgesteld, "?"));

            await context.SaveChangesAsync();
        });

        await using var leescontext = _db.MaakContext();
        var opslag = new EfDekkingOpslag(leescontext);

        var dekkend = await opslag.HaalDekkendeKoppelingenAsync(klasId, [themaId]);
        var kandidaten = await opslag.HaalKandidaatKoppelingenAsync(klasId);

        Assert.Equal(
            dekkend
                .Select(k => (k.LeerplandoelCode, k.ThemaNaam))
                .OrderBy(p => p.LeerplandoelCode, StringComparer.Ordinal),
            kandidaten
                .Where(k => k.IsBeslist)
                .Select(k => (k.LeerplandoelCode, k.ThemaNaam))
                .OrderBy(p => p.LeerplandoelCode, StringComparer.Ordinal));

        // And the undecided one is present on the candidate side only, which is what makes the equality above an
        // assertion about the DECIDED subset rather than about two identical queries.
        Assert.Contains(kandidaten, k => k.LeerplandoelCode == "KAND-GEWEIGERD" && !k.IsBeslist);
        Assert.DoesNotContain(dekkend, k => k.LeerplandoelCode == "KAND-GEWEIGERD");
    }

    /// <summary>
    /// Arranges a school year with one class and one thema, runs the caller's arrangement against a real database,
    /// and returns the ids. Names are suffixed with a GUID because the schooljaar name carries a case-insensitive
    /// unique index.
    /// </summary>
    private async Task<(Guid KlasId, Guid ThemaId)> ZetOpAsync(
        Func<AppDbContext, Klas, Thema, Task> arrangeer)
    {
        await using var context = _db.MaakContext();

        // Every code any of these tests links to. The FK from doelkoppelingen to leerplandoelen is Restrict, so the
        // goals have to exist first — which is itself something the in-memory provider does not enforce.
        await ZorgVoorDoelenAsync(
            context,
            [
                "L1-THEMADOEL", "L1-TWEEDE", "L2-SUGGESTIE", "L3-SUBDOEL", "L4-ACTIVITEIT",
                "TELT-AANVAARD", "TELT-MANUEEL", "TELT-NIET-VOORGESTELD", "TELT-NIET-GEWEIGERD",
                "TELT-NIET-SUBDOEL", "TELT-NIET-ACT", "NIET-GEPLAATST", "OOK-NIET",
                "KAND-THEMADOEL", "KAND-SUGGESTIE", "KAND-SUBDOEL", "KAND-ACTIVITEIT", "KAND-GEWEIGERD",
            ]);

        // Truncated to fit Schooljaar.Naam's varchar(32) — see the note in the other arrangement.
        var schooljaar = new Schooljaar(
            $"2026-2027-{Guid.NewGuid():N}"[..20],
            new DateOnly(2026, 9, 1),
            new DateOnly(2027, 6, 30));
        var klas = schooljaar.VoegKlasToe($"K3-{Guid.NewGuid():N}", leerjaar: 0);
        context.Schooljaren.Add(schooljaar);

        var thema = new Thema($"Herfst-{Guid.NewGuid():N}", duurWeken: 5);
        context.Themas.Add(thema);

        await arrangeer(context, klas, thema);

        return (klas.Id, thema.Id);
    }

    private static async Task ZorgVoorDoelenAsync(
        AppDbContext context,
        IEnumerable<string> codes,
        string jaarFase = "K3")
    {
        foreach (var code in codes)
        {
            if (!await context.Leerplandoelen.AnyAsync(l => l.Code == code))
            {
                context.Leerplandoelen.Add(new Leerplandoel(
                    code,
                    Doelsoort.Gemeenschappelijk,
                    jaarFase,
                    "Natuur",
                    "Levende natuur",
                    "9.1",
                    tekst: $"Tekst van {code}"));
            }
        }

        await context.SaveChangesAsync();
    }
}
