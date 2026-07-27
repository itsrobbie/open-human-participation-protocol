FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution and project files for layer caching
COPY Directory.Build.props ./
COPY platform/resolver/Resolver.sln ./platform/resolver/
COPY platform/resolver/src/OHPP.Domain.Shared/OHPP.Domain.Shared.csproj ./platform/resolver/src/OHPP.Domain.Shared/
COPY platform/resolver/src/OHPP.Domain.Auth/OHPP.Domain.Auth.csproj ./platform/resolver/src/OHPP.Domain.Auth/
COPY platform/resolver/src/OHPP.Domain.Registration/OHPP.Domain.Registration.csproj ./platform/resolver/src/OHPP.Domain.Registration/
COPY platform/resolver/src/OHPP.Domain.Participation/OHPP.Domain.Participation.csproj ./platform/resolver/src/OHPP.Domain.Participation/
COPY platform/resolver/src/OHPP.Domain.Attestation/OHPP.Domain.Attestation.csproj ./platform/resolver/src/OHPP.Domain.Attestation/
COPY platform/resolver/src/OHPP.Services.Shared/OHPP.Services.Shared.csproj ./platform/resolver/src/OHPP.Services.Shared/
COPY platform/resolver/src/OHPP.Services.Auth/OHPP.Services.Auth.csproj ./platform/resolver/src/OHPP.Services.Auth/
COPY platform/resolver/src/OHPP.Services.Registration/OHPP.Services.Registration.csproj ./platform/resolver/src/OHPP.Services.Registration/
COPY platform/resolver/src/OHPP.Services.Participation/OHPP.Services.Participation.csproj ./platform/resolver/src/OHPP.Services.Participation/
COPY platform/resolver/src/OHPP.Services.Attestation/OHPP.Services.Attestation.csproj ./platform/resolver/src/OHPP.Services.Attestation/
COPY platform/resolver/src/OHPP.Infrastructure.Firebase/OHPP.Infrastructure.Firebase.csproj ./platform/resolver/src/OHPP.Infrastructure.Firebase/
COPY platform/resolver/src/OHPP.Infrastructure.PostgreSQL/OHPP.Infrastructure.PostgreSQL.csproj ./platform/resolver/src/OHPP.Infrastructure.PostgreSQL/
COPY platform/resolver/src/OHPP.Infrastructure.DotNet/OHPP.Infrastructure.DotNet.csproj ./platform/resolver/src/OHPP.Infrastructure.DotNet/
COPY platform/resolver/src/OHPP.Infrastructure.Serilog/OHPP.Infrastructure.Serilog.csproj ./platform/resolver/src/OHPP.Infrastructure.Serilog/
COPY platform/resolver/src/OHPP.Infrastructure.OpenTelemetry/OHPP.Infrastructure.OpenTelemetry.csproj ./platform/resolver/src/OHPP.Infrastructure.OpenTelemetry/
COPY platform/resolver/src/OHPP.Infrastructure.Protocol.Local/OHPP.Infrastructure.Protocol.Local.csproj ./platform/resolver/src/OHPP.Infrastructure.Protocol.Local/
COPY platform/resolver/src/OHPP.Presentation.Api/OHPP.Presentation.Api.csproj ./platform/resolver/src/OHPP.Presentation.Api/
COPY sdks/dotnet/src/OHPP.Protocol/OHPP.Protocol.csproj ./sdks/dotnet/src/OHPP.Protocol/
COPY sdks/dotnet/src/OHPP.Sdk.Server/OHPP.Sdk.Server.csproj ./sdks/dotnet/src/OHPP.Sdk.Server/

RUN dotnet restore ./platform/resolver/src/OHPP.Presentation.Api/OHPP.Presentation.Api.csproj

# Copy all source and build
COPY . .
WORKDIR /src/platform/resolver
RUN dotnet publish src/OHPP.Presentation.Api/OHPP.Presentation.Api.csproj -c Release -o /app/publish --no-restore

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "OHPP.Presentation.Api.dll"]
