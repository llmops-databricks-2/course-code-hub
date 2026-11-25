"""Make a volume with the Python SDK.

    uv run python notebooks/platform/four_ways/sdk.py --profile <profile> \
        --catalog llmops_dev --schema <your schema>

Typed calls, retries on transient errors, pagination and typed exceptions come with it.
What it does not give you is state: whether the volume should exist is still your
code's decision, so the script looks it up before it creates.
"""

import argparse

from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound
from databricks.sdk.service.catalog import VolumeType


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", required=True)
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    args = parser.parse_args()

    w = WorkspaceClient(profile=args.profile)
    full_name = f"{args.catalog}.{args.schema}.platform_demo_sdk"
    try:
        volume = w.volumes.read(full_name)
        print(f"exists: {volume.full_name}")
    except NotFound:
        volume = w.volumes.create(
            catalog_name=args.catalog,
            schema_name=args.schema,
            name="platform_demo_sdk",
            volume_type=VolumeType.MANAGED,
            comment="Platform lecture: made with the Python SDK",
        )
        print(f"created: {volume.full_name}")


if __name__ == "__main__":
    main()
