using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OHPP.Infrastructure.PostgreSQL.Migrations
{
    /// <inheritdoc />
    public partial class AddRulesAndNotificationPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "notification_preferences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    AppId = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    PushEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    SoundEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    BadgeEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notification_preferences", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "participation_rules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    AppId = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    AuthLevel = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    AutoRespondEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    AutoRespondOption = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    AutoRespondValue = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_participation_rules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "rule_conditions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RuleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Field = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Operator = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Value = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rule_conditions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_rule_conditions_participation_rules_RuleId",
                        column: x => x.RuleId,
                        principalTable: "participation_rules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_notification_preferences_UserId_AppId",
                table: "notification_preferences",
                columns: new[] { "UserId", "AppId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_participation_rules_UserId_Priority",
                table: "participation_rules",
                columns: new[] { "UserId", "Priority" });

            migrationBuilder.CreateIndex(
                name: "IX_rule_conditions_RuleId",
                table: "rule_conditions",
                column: "RuleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "notification_preferences");

            migrationBuilder.DropTable(
                name: "rule_conditions");

            migrationBuilder.DropTable(
                name: "participation_rules");
        }
    }
}
