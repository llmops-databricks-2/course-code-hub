#!/usr/bin/env bash
# Make a volume with the Databricks CLI: one command, good for a terminal or a CI step.
#
#   bash notebooks/platform/four_ways/cli.sh <profile> llmops_dev <your schema>
set -euo pipefail
profile="$1" catalog="$2" schema="$3"

# Positional arguments: catalog, schema, name, type.
databricks volumes create "$catalog" "$schema" platform_demo_cli MANAGED \
  --comment "Platform lecture: made with the CLI" --profile "$profile"

# A second run fails with "already exists": the CLI, like REST, keeps no state.
databricks volumes read "$catalog.$schema.platform_demo_cli" --profile "$profile"
