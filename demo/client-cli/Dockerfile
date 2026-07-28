FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy the root Directory.Build.props (shared TFM, nullable, etc.)
COPY Directory.Build.props .

# Copy protocol/SDK projects (dependencies)
COPY sdks/dotnet/src/OHPP.Protocol/ sdks/dotnet/src/OHPP.Protocol/
COPY sdks/dotnet/src/OHPP.Sdk/ sdks/dotnet/src/OHPP.Sdk/

# Copy CLI projects
COPY demo/client-cli/src/ demo/client-cli/src/

# Restore and build
WORKDIR /src/demo/client-cli/src/OHPP.Cli.Presentation
RUN dotnet restore
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/runtime:8.0
WORKDIR /app
COPY --from=build /app .

# Config persisted via volume mount at /root/.ohpp
VOLUME ["/root/.ohpp"]

ENTRYPOINT ["dotnet", "OHPP.Cli.Presentation.dll"]
