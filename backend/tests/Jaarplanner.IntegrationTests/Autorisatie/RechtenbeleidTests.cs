using System.Security.Claims;
using Jaarplanner.Api.Infrastructure;
using Jaarplanner.Api.Infrastructure.Authenticatie;
using Jaarplanner.Api.Infrastructure.Autorisatie;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.IntegrationTests.Autorisatie;

/// <summary>
/// The Api half of the rights matrix (E6-02, ADR-0011 §2): every §3 row is a named policy that also requires a
/// signed-in person, and the one handler turns a principal plus a resource into the matrix's answer. What each row
/// allows is pinned in <c>RechtenmatrixTests</c>; this pins that the policies and the handler deliver it.
/// </summary>
public sealed class RechtenbeleidTests : IClassFixture<JaarplannerApiFactory>
{
    private static readonly Guid An = Guid.Parse("a0000000-0000-4000-8000-000000000001");

    private readonly JaarplannerApiFactory _factory;

    public RechtenbeleidTests(JaarplannerApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Elke_rij_van_de_matrix_is_een_beleid_dat_ook_een_aanmelding_eist()
    {
        var provider = _factory.Services.GetRequiredService<IAuthorizationPolicyProvider>();

        foreach (var rij in Rechtenmatrix.Rijen)
        {
            var beleid = await provider.GetPolicyAsync(rij.Beleid);

            Assert.NotNull(beleid);
            // A policy of its own replaces the fallback, so it must deny an anonymous caller itself (Aanmelding.cs).
            Assert.Contains(beleid!.Requirements, r => r is DenyAnonymousAuthorizationRequirement);
            Assert.Contains(beleid.Requirements, r => r is MatrixVereiste v && v.Rij == rij);
        }
    }

    [Fact]
    public void Het_curriculumbeheerbeleid_is_de_opstaprij_van_de_matrix()
    {
        Assert.Equal(CurriculumbeheerAutorisatie.Beleid, Rechtenmatrix.Curriculumbeheer.Beleid);
        Assert.Equal(Kolom.Geen, Rechtenmatrix.Curriculumbeheer.Kolommen);
    }

    // --- The handler: who the principal is, which resource it passes, and directie passing every row. ---

    [Fact]
    public async Task Zonder_gebruiker_in_de_aanmelding_mag_niets_ook_niet_als_directie()
    {
        var handler = new MatrixHandler(new VasteRechten(Directie()));

        var context = await BeoordeelAsync(handler, Rechtenmatrix.ThemaBewerken, new ClaimsPrincipal(new ClaimsIdentity()), bron: null);

        Assert.False(context.HasSucceeded);
    }

    [Fact]
    public async Task Directie_mag_elke_rij_ook_via_een_attribuut()
    {
        var handler = new MatrixHandler(new VasteRechten(Directie()));

        foreach (var rij in Rechtenmatrix.Rijen)
        {
            var context = await BeoordeelAsync(handler, rij, Principal(), new DefaultHttpContext());
            Assert.True(context.HasSucceeded, rij.Beleid);
        }
    }

    [Fact]
    public async Task Een_leeftijdsrij_geeft_de_bron_door_aan_de_matrix()
    {
        var handler = new MatrixHandler(new VasteRechten(new Rechten(An, false, false, ["K3"], [], [])));

        var eigen = await BeoordeelAsync(handler, Rechtenmatrix.SubthemaBeheren, Principal(), new Leeftijdsinhoud("K3"));
        var andere = await BeoordeelAsync(handler, Rechtenmatrix.SubthemaBeheren, Principal(), new Leeftijdsinhoud("L1"));

        Assert.True(eigen.HasSucceeded);
        Assert.False(andere.HasSucceeded);
    }

    [Fact]
    public async Task Een_bronrij_als_attribuut_laat_een_hoofdleerkracht_niet_door()
    {
        // The resource is then the HttpContext, which no resource-based column matches: a mistake fails closed.
        var handler = new MatrixHandler(new VasteRechten(new Rechten(An, false, false, ["K3"], ["K3"], [])));

        var context = await BeoordeelAsync(handler, Rechtenmatrix.SubthemaBeheren, Principal(), new DefaultHttpContext());

        Assert.False(context.HasSucceeded);
    }

    [Fact]
    public async Task De_maker_wordt_herkend_aan_de_gebruiker_in_de_aanmelding()
    {
        var handler = new MatrixHandler(new VasteRechten(Rechten.Geen(An)));
        var eigen = new Activiteitbron(Guid.NewGuid(), "K3", MakerId: An, HeeftDoelkoppelingen: false);

        var context = await BeoordeelAsync(handler, Rechtenmatrix.ActiviteitVerwijderen, Principal(), eigen);

        Assert.True(context.HasSucceeded);
    }

    [Fact]
    public async Task De_klasplanning_van_een_eigen_klas_mag_die_van_een_andere_niet()
    {
        var klas = Guid.NewGuid();
        var handler = new MatrixHandler(new VasteRechten(new Rechten(An, false, false, [], [], [klas])));

        var eigen = await BeoordeelAsync(handler, Rechtenmatrix.KlasplanningBewerken, Principal(), new Klasplanning(klas));
        var andere = await BeoordeelAsync(handler, Rechtenmatrix.KlasplanningBewerken, Principal(), new Klasplanning(Guid.NewGuid()));

        Assert.True(eigen.HasSucceeded);
        Assert.False(andere.HasSucceeded);
    }

    [Fact]
    public async Task MagAsync_beantwoordt_een_bronrij_via_de_geregistreerde_beleiden()
    {
        // Through the real IAuthorizationService, so the name resolves to the registered policy. The default test
        // identity is directie, so the answer is yes, for any row and any resource.
        await using var scope = _factory.Services.CreateAsyncScope();
        var autorisatie = scope.ServiceProvider.GetRequiredService<IAuthorizationService>();
        var directie = Aanmelding.MaakPrincipal(
            new GebruikerWeergave(TestAuthenticatie.StandaardGebruikerId, "Test", "test@jaarplanner.local", IsDirectie: true),
            TestAuthenticatie.Schema);

        Assert.True(await autorisatie.MagAsync(directie, new Leeftijdsinhoud("L6"), Rechtenmatrix.Beleid.SubthemaBeheren));
        Assert.False(await autorisatie.MagAsync(
            new ClaimsPrincipal(new ClaimsIdentity()), new Leeftijdsinhoud("L6"), Rechtenmatrix.Beleid.SubthemaBeheren));
    }

    private static Rechten Directie() => new(An, isDirectie: true, heeftThemabeheer: false, [], [], []);

    private static ClaimsPrincipal Principal() =>
        Aanmelding.MaakPrincipal(new GebruikerWeergave(An, "An", "an@school.be", IsDirectie: false), "Test");

    private static async Task<AuthorizationHandlerContext> BeoordeelAsync(
        MatrixHandler handler, Matrixrij rij, ClaimsPrincipal principal, object? bron)
    {
        var vereiste = new MatrixVereiste(rij);
        var context = new AuthorizationHandlerContext([vereiste], principal, bron);
        await handler.HandleAsync(context);
        return context;
    }

    private sealed class VasteRechten : IRechtenService
    {
        private readonly Rechten _rechten;

        public VasteRechten(Rechten rechten) => _rechten = rechten;

        public Task<Rechten> HaalRechtenOpAsync(Guid gebruikerId, CancellationToken cancellationToken = default) =>
            Task.FromResult(_rechten);
    }
}
