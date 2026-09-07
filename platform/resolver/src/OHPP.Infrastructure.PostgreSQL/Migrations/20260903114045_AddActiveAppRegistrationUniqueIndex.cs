using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OHPP.Infrastructure.PostgreSQL.Migrations
{
    /// <inheritdoc />
    public partial class AddActiveAppRegistrationUniqueIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_app_registrations_UserId_AppId",
                table: "app_registrations",
                columns: new[] { "UserId", "AppId" },
                unique: true,
                filter: "\"RevokedAt\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_app_registrations_UserId_AppId",
                table: "app_registrations");
        }
    }
}
