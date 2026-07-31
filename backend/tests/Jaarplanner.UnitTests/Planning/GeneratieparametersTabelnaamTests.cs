using Jaarplanner.Domain.Planning;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.Planning;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// Binds the one hand-written table name in <see cref="EfJaarplanOpslag"/> to the mapping it mirrors (E3-04, FR-5.4).
/// <para>
/// The concurrent-insert recovery decides whether a <c>23505</c> is "another request created this class's settings
/// first" by matching <c>PostgresException.TableName</c> against a constant. If the table is ever renamed in
/// <c>GeneratieparametersConfiguration</c> and the constant is not, nothing fails to compile and nothing fails at
/// startup: the race simply stops being recognised, and a request that should have reloaded the winning row 500s
/// instead — the exact outcome that recovery exists to prevent. That silent failure mode is why the doc comment there
/// refuses to key on an EF-generated index name, and it applies just as much to the table name it chose instead.
/// </para>
/// <para>
/// No database: building the model opens no connection.
/// </para>
/// </summary>
public class GeneratieparametersTabelnaamTests
{
    [Fact]
    public void Recovery_constant_matches_the_mapped_table()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=model_only;Username=x;Password=x")
            .Options;
        using var context = new AppDbContext(options);

        var tabel = context.Model.FindEntityType(typeof(Generatieparameters))!.GetTableName();

        Assert.Equal(EfJaarplanOpslag.ParametersTabel, tabel);
    }
}
