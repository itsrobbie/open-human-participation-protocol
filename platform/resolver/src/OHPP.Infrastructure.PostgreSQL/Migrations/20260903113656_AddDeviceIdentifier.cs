using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OHPP.Infrastructure.PostgreSQL.Migrations
{
    /// <inheritdoc />
    public partial class AddDeviceIdentifier : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DeviceIdentifier",
                table: "devices",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_devices_UserId_DeviceIdentifier",
                table: "devices",
                columns: new[] { "UserId", "DeviceIdentifier" },
                unique: true,
                filter: "\"DeviceIdentifier\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_devices_UserId_DeviceIdentifier",
                table: "devices");

            migrationBuilder.DropColumn(
                name: "DeviceIdentifier",
                table: "devices");
        }
    }
}
