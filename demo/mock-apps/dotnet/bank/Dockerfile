FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy root build props
COPY Directory.Build.props .

# Copy SDK dependencies
COPY sdks/dotnet/src/OHPP.Protocol/ sdks/dotnet/src/OHPP.Protocol/
COPY sdks/dotnet/src/OHPP.Sdk/ sdks/dotnet/src/OHPP.Sdk/

# Copy bank projects
COPY demo/mock-apps/dotnet/bank/src/ demo/mock-apps/dotnet/bank/src/

# Restore and publish
WORKDIR /src/demo/mock-apps/dotnet/bank/src/Bank.Presentation
RUN dotnet restore
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
EXPOSE 5010
ENV ASPNETCORE_URLS=http://+:5010
ENTRYPOINT ["dotnet", "Bank.Presentation.dll"]
