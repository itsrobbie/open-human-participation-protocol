"""
Idempotent GlitchTip dev seed (U7.1).

Runs inside the GlitchTip image via `manage.py shell < seed.py`. Creates a fixed
dev organization + project + project key so the app's crash DSN is a known,
stable value (no manual clicking, survives `make clean`). Dev-only; never used
in production.

Deterministic DSN produced:
    http://<OHPP_GLITCHTIP_PUBLIC_KEY>@localhost:8000/<project_id>

The public key is fixed below so CRASH_DSN can be wired ahead of time. All
operations are idempotent - safe to re-run on every stack start.
"""
import os

from django.apps import apps
from django.contrib.auth import get_user_model

# Resolve models by label (version-robust; app module paths differ across
# GlitchTip releases, so avoid direct imports).
Organization = apps.get_model("organizations_ext", "Organization")
Project = apps.get_model("projects", "Project")
ProjectKey = apps.get_model("projects", "ProjectKey")

# Fixed dev-only values (mirrors the well-known dev credentials used elsewhere).
DEV_EMAIL = os.environ.get("OHPP_GLITCHTIP_SEED_EMAIL", "dev@ohpp.local")
DEV_PASSWORD = os.environ.get("OHPP_GLITCHTIP_SEED_PASSWORD", "OhppDevPass123!")
ORG_NAME = "OHPP Dev"
PROJECT_NAME = "ohpp-client"
# Fixed UUID so the DSN is deterministic across rebuilds. GlitchTip stores the
# project key public key as a UUID; the DSN uses its 32-char hex (dashless) form.
PUBLIC_KEY = os.environ.get(
    "OHPP_GLITCHTIP_PUBLIC_KEY", "0bbc1e00-c11e-4000-8000-000000000001"
)

User = get_user_model()

# 1. Dev user (org owner).
user = User.objects.filter(email=DEV_EMAIL).first()
if user is None:
    user = User.objects.create_user(email=DEV_EMAIL, password=DEV_PASSWORD)
    print(f"[seed] created user {DEV_EMAIL}")
else:
    print(f"[seed] user {DEV_EMAIL} already exists")

# 2. Organization owned by the dev user.
org = Organization.objects.filter(name=ORG_NAME).first()
if org is None:
    org = Organization.objects.create(name=ORG_NAME)
    org.add_user(user)
    print(f"[seed] created organization '{ORG_NAME}'")
else:
    print(f"[seed] organization '{ORG_NAME}' already exists")

# 3. Project.
project = Project.objects.filter(organization=org, name=PROJECT_NAME).first()
if project is None:
    project = Project.objects.create(organization=org, name=PROJECT_NAME)
    print(f"[seed] created project '{PROJECT_NAME}' (id={project.id})")
else:
    print(f"[seed] project '{PROJECT_NAME}' already exists (id={project.id})")

# 4. Project key (DSN) with a fixed public key for a deterministic DSN.
key = ProjectKey.objects.filter(project=project, public_key=PUBLIC_KEY).first()
if key is None:
    # Reuse an auto-created key if present, otherwise create one, then pin the
    # public key so the DSN is stable.
    key = ProjectKey.objects.filter(project=project).first()
    if key is None:
        key = ProjectKey.objects.create(project=project, public_key=PUBLIC_KEY)
    else:
        key.public_key = PUBLIC_KEY
        key.save(update_fields=["public_key"])
    print(f"[seed] pinned project key public_key={PUBLIC_KEY}")
else:
    print(f"[seed] project key already pinned public_key={PUBLIC_KEY}")

print(
    f"[seed] DONE. DSN = http://{PUBLIC_KEY}@localhost:8000/{project.id}"
)
