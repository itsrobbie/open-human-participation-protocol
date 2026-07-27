using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OHPP.Infrastructure.PostgreSQL.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "app_registrations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    AppId = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    AppName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    AppIcon = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    AccessToken = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    ResolverBaseUrl = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    RegisteredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    RevokedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_app_registrations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "devices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    DeviceType = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PublicKey = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    KeyAlgorithm = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    DeviceToken = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    RegisteredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LastSeenAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_devices", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "participation_records",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    AppRegistrationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    AppId = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    AppName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ActionSummary = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    Type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Category = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    DecisionPayload = table.Column<string>(type: "text", nullable: true),
                    AttestationPayload = table.Column<string>(type: "text", nullable: true),
                    ResolutionMethod = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    ResolvingDeviceId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ResolvedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_participation_records", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pending_requests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AppRegistrationId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    RequestPayload = table.Column<string>(type: "text", nullable: false),
                    AppId = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ActionSummary = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    Type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ResolvedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pending_requests", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "registration_challenges",
                columns: table => new
                {
                    ChallengeId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    RequesterAppId = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    IsCompleted = table.Column<bool>(type: "boolean", nullable: false),
                    AppName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    AppIcon = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    CallbackPath = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_registration_challenges", x => x.ChallengeId);
                });

            migrationBuilder.CreateTable(
                name: "signing_keys",
                columns: table => new
                {
                    KeyId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Algorithm = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    PublicKeyPem = table.Column<string>(type: "text", nullable: false),
                    PrivateKeyPem = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    RetiredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_signing_keys", x => x.KeyId);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ExternalId = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LastLoginAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_app_registrations_AccessToken",
                table: "app_registrations",
                column: "AccessToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_app_registrations_UserId_AppId_RevokedAt",
                table: "app_registrations",
                columns: new[] { "UserId", "AppId", "RevokedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_devices_DeviceToken",
                table: "devices",
                column: "DeviceToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_devices_UserId_IsActive",
                table: "devices",
                columns: new[] { "UserId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_participation_records_RequestId",
                table: "participation_records",
                column: "RequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_participation_records_UserId_CreatedAt",
                table: "participation_records",
                columns: new[] { "UserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_pending_requests_AppRegistrationId_Status",
                table: "pending_requests",
                columns: new[] { "AppRegistrationId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_pending_requests_Status_ExpiresAt",
                table: "pending_requests",
                columns: new[] { "Status", "ExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_pending_requests_UserId_Status",
                table: "pending_requests",
                columns: new[] { "UserId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_registration_challenges_UserId_IsCompleted",
                table: "registration_challenges",
                columns: new[] { "UserId", "IsCompleted" });

            migrationBuilder.CreateIndex(
                name: "IX_signing_keys_IsActive",
                table: "signing_keys",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_users_Email",
                table: "users",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_users_ExternalId",
                table: "users",
                column: "ExternalId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "app_registrations");

            migrationBuilder.DropTable(
                name: "devices");

            migrationBuilder.DropTable(
                name: "participation_records");

            migrationBuilder.DropTable(
                name: "pending_requests");

            migrationBuilder.DropTable(
                name: "registration_challenges");

            migrationBuilder.DropTable(
                name: "signing_keys");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
