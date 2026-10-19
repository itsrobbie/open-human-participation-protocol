#!/usr/bin/env python3
"""Generate Keycloak client redirectUris/webOrigins for all tenant stacks (U9).

Single source of truth: ports come from scripts/stack-derive.sh, NOT hand-kept
lists. Each realm export's app client gets redirectUris/webOrigins covering EVERY
tenant stack id in [0, MAX_STACKS): the browser hits its tenant's banded host
port and shared Keycloak matches it. Onboarding a tenant is additive (all ports
already present); zero hand-editing. Idempotent.

This edits ONLY the redirectUris/webOrigins array lines in place, preserving the
repo's compact JSON formatting (a full reserialize would reflow every line).
Each realm export keeps these two arrays on single lines, which this relies on.

Keycloak realm/issuer names are NOT suffixed per tenant (shared-realms model);
only these browser-facing URIs enumerate ports.

Run: scripts/gen-keycloak-redirects.py          (rewrite in place)
     scripts/gen-keycloak-redirects.py --check   (exit 1 if any file would change)

No em dashes.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DERIVE = REPO / "scripts" / "stack-derive.sh"
MAX_STACKS = 16

# Realm export -> the OHPP_PORT_* vars whose host ports are valid redirect targets
# for that realm's app client. The portal realm serves portal + resolver swagger.
REALM_PORT_VARS = {
    "platform/resolver/keycloak/realm-bank-export.json": ["OHPP_PORT_BANK"],
    "platform/resolver/keycloak/realm-insurance-export.json": ["OHPP_PORT_INSURANCE"],
    "platform/resolver/keycloak/realm-pizza-export.json": ["OHPP_PORT_PIZZA"],
    "platform/resolver/keycloak/realm-marketplace-export.json": ["OHPP_PORT_MARKETPLACE"],
    "platform/resolver/keycloak/realm-export.json": ["OHPP_PORT_PORTAL", "OHPP_PORT_RESOLVER_HTTP"],
}


def derive_port(stack_id, var):
    out = subprocess.run(
        [str(DERIVE)],
        env={"STACK_ID": str(stack_id), "PATH": "/usr/bin:/bin"},
        capture_output=True, text=True, check=True,
    ).stdout
    for line in out.splitlines():
        if line.startswith(var + "="):
            return int(line.split("=", 1)[1])
    raise KeyError(f"{var} not emitted by stack-derive.sh")


def ports_for(vars_):
    seen, ordered = set(), []
    for stack_id in range(MAX_STACKS):
        for var in vars_:
            p = derive_port(stack_id, var)
            if p not in seen:
                seen.add(p)
                ordered.append(p)
    return ordered


def main():
    check = "--check" in sys.argv
    any_change = False
    for rel, vars_ in REALM_PORT_VARS.items():
        path = REPO / rel
        text = path.read_text()
        ports = ports_for(vars_)
        redirect = json.dumps([f"http://localhost:{p}/*" for p in ports])
        origins = json.dumps([f"http://localhost:{p}" for p in ports])

        # Replace the value of the redirectUris / webOrigins keys only, keeping
        # the key's leading whitespace and the trailing comma. The arrays are on
        # single lines in these exports.
        new = re.sub(r'("redirectUris":\s*)\[[^\]]*\]', lambda m: m.group(1) + redirect, text)
        new = re.sub(r'("webOrigins":\s*)\[[^\]]*\]', lambda m: m.group(1) + origins, new)

        # Validate the result still parses as JSON before touching disk.
        json.loads(new)

        if new != text:
            any_change = True
            if check:
                print(f"would change: {rel}")
            else:
                path.write_text(new)
                print(f"updated: {rel} ({len(ports)} ports)")
        elif not check:
            print(f"unchanged: {rel}")
    if check and any_change:
        sys.exit(1)


if __name__ == "__main__":
    main()
