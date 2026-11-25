"""Make a volume with a plain REST call.

    uv run python notebooks/platform/four_ways/rest.py --profile <profile> \
        --catalog llmops_dev --schema <your schema>

You write the URL, the JSON body and the error handling yourself. Authentication is
still borrowed from the SDK's unified auth: Config(...).authenticate() returns the
headers for whatever credential the profile holds (OAuth, a token, GitHub OIDC).
"""

import argparse

import requests
from databricks.sdk.core import Config


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", required=True)
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema", required=True)
    args = parser.parse_args()

    config = Config(profile=args.profile)
    response = requests.post(
        f"{config.host}/api/2.1/unity-catalog/volumes",
        headers=config.authenticate(),
        json={
            "catalog_name": args.catalog,
            "schema_name": args.schema,
            "name": "platform_demo_rest",
            "volume_type": "MANAGED",
            "comment": "Platform lecture: made with a REST call",
        },
        timeout=30,
    )
    # Run it twice: the second call answers with an "already exists" error.
    # Deciding what that means (fail? adopt?) is your code's job.
    print(response.status_code, response.json())


if __name__ == "__main__":
    main()
