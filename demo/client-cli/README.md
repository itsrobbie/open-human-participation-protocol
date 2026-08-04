# CLI attester simulator

This command-line program is a development simulator for the OHPP Attester role. It is not the full Client App planned for iOS and Android. It exists to exercise device registration, Resolver delivery, human response collection, ES256 signing, and attestation submission without a mobile build.

## Run it

Start the development stack, register a device in Portal, and copy the device token. Then run:

```text
make cli
```

On the first run, enter:

- Device token: the token shown after device registration in Portal
- Resolver URL: `http://resolver:8080`

Use the Docker-internal Resolver URL because the simulator runs in a container. The host URL `http://localhost:5050` points back to the simulator container and will not reach the Resolver.

The simulator registers its public key, fetches requests that are already pending, and then listens for new requests over server-sent events. For Select requests, enter the displayed option number. For other supported requests, enter the requested value. The simulator signs and submits the resulting attestation.

Stop it with Ctrl+C. Its token and ES256 key pair are stored in the `cli_config` Docker volume, so `make cli` reconnects with the same device identity on the next run.

## Reset its identity

Run:

```text
make cli-reset
```

This deletes only `/root/.ohpp/cli-config.json` from the CLI configuration volume. It does not delete the World database. The next `make cli` run asks for a token and generates a new key pair. Revoke the old device in Portal if it should no longer be trusted.

## Limits

The simulator is terminal-only and is intended for development. It does not provide mobile secure storage, push notifications, biometric confirmation, rich request rendering, or production device lifecycle behavior. Those belong to the planned Client App.
