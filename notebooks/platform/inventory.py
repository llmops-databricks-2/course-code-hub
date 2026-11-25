"""What would you lose if the workspace disappeared tomorrow?

On 2 November 2026 the course's first workspace was closed, mid-cohort. Everything
that was made by code was made again in a new workspace in a day; everything made by
hand had to be found and remade by hand. This script lists what your identity owns
in the workspace and marks what your bundle declares, so you see the difference.

    databricks bundle summary -t dev --output json --profile <profile> > summary.json
    uv run python notebooks/platform/inventory.py --profile <profile> \
        --catalog llmops_dev --schema <your schema> --bundle-summary summary.json
"""

import argparse
import json
from pathlib import Path

from databricks.sdk import WorkspaceClient


def bundle_names(summary_path: Path) -> set[str]:
    """The names of every resource the deployed bundle declares."""
    summary = json.loads(summary_path.read_text())
    names: set[str] = set()
    for resources in summary.get("resources", {}).values():
        for resource in resources.values():
            names.add(resource.get("name", ""))
    return names


def owned(w: WorkspaceClient, me: str, catalog: str, schema: str) -> list[tuple[str, str]]:
    """(kind, name) of what this identity created or owns."""
    found = [
        ("job", j.settings.name) for j in w.jobs.list() if j.creator_user_name == me and j.settings
    ]
    found += [("app", a.name) for a in w.apps.list() if a.creator == me]
    found += [("serving endpoint", e.name) for e in w.serving_endpoints.list() if e.creator == me]
    found += [("table", t.name) for t in w.tables.list(catalog, schema)]
    found += [("volume", v.name) for v in w.volumes.list(catalog, schema)]
    return [(kind, name) for kind, name in found if name]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", required=True)
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--bundle-summary", type=Path, required=True)
    args = parser.parse_args()

    w = WorkspaceClient(profile=args.profile)
    me = w.current_user.me().user_name or ""
    declared = bundle_names(args.bundle_summary)
    for kind, name in sorted(owned(w, me, args.catalog, args.schema)):
        # Tables a job writes are not declared, but the job that rebuilds them is.
        where = "in code" if name in declared else "by hand, or data a job makes"
        print(f"{kind:17} {name:50} {where}")


if __name__ == "__main__":
    main()
