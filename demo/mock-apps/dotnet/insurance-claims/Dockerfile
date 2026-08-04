FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY Directory.Build.props .
COPY sdks/dotnet/src/OHPP.Protocol/ sdks/dotnet/src/OHPP.Protocol/
COPY sdks/dotnet/src/OHPP.Sdk/ sdks/dotnet/src/OHPP.Sdk/
COPY demo/mock-apps/dotnet/insurance-claims/src/ demo/mock-apps/dotnet/insurance-claims/src/
WORKDIR /src/demo/mock-apps/dotnet/insurance-claims/src/InsuranceClaims.Presentation
RUN dotnet restore
RUN dotnet publish -c Release -o /app
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
EXPOSE 5020
ENV ASPNETCORE_URLS=http://+:5020
ENTRYPOINT ["dotnet", "InsuranceClaims.Presentation.dll"]
