using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OHPP.Infrastructure.PostgreSQL.Migrations
{
    /// <inheritdoc />
    public partial class AddDevicePushToken : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PushToken",
                table: "devices",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PushToken",
                table: "devices");
        }
    }
}
