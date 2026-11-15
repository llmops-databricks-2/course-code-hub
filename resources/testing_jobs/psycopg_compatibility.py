# Databricks notebook source
"""Compare Psycopg binary wheels without crashing the notebook process."""
import importlib.metadata
import json
import os
import platform
import subprocess
import sys
import tempfile
from pathlib import Path

print(json.dumps({
    "machine": platform.machine(),
    "python": platform.python_version(),
    "platform": platform.platform(),
    "installed_psycopg": importlib.metadata.version("psycopg"),
    "installed_binary": importlib.metadata.version("psycopg-binary"),
}))

probe = """
import json
import platform
import psycopg
from pathlib import Path
print(json.dumps({
    'version': psycopg.__version__,
    'machine': platform.machine(),
    'implementation': psycopg.pq.__impl__,
    'libpq': psycopg.pq.version(),
    'libraries': sorted({line.split()[-1] for line in Path('/proc/self/maps').read_text().splitlines() if any(name in line for name in ('libssl', 'libcrypto', 'libpq'))}),
}), flush=True)
"""
results = []
for label, code in (("installed_psycopg", probe), ("installed_agent", "from arxiv_curator.agent import ArxivAgent; print('agent import succeeded')")):
    result = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, timeout=60)
    results.append({"version": label, "returncode": result.returncode,
                    "stdout": result.stdout, "stderr": result.stderr[-2000:]})
for version in ("3.3.2", "3.3.9"):
    with tempfile.TemporaryDirectory() as target:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "--quiet", "--no-deps",
             "--only-binary=:all:", "--target", target,
             f"psycopg=={version}", f"psycopg-binary=={version}"],
            check=True, capture_output=True, text=True,
        )
        result = subprocess.run(
            [sys.executable, "-c", probe],
            env={**os.environ, "PYTHONPATH": target},
            capture_output=True, text=True, timeout=60,
        )
        results.append({"version": version, "returncode": result.returncode,
                        "stdout": result.stdout, "stderr": result.stderr[-2000:]})
        result = subprocess.run(
            [sys.executable, "-c", "from arxiv_curator.agent import ArxivAgent; print('agent import succeeded')"],
            env={**os.environ, "PYTHONPATH": target},
            capture_output=True, text=True, timeout=60,
        )
        results.append({"version": f"{version} agent", "returncode": result.returncode,
                        "stdout": result.stdout, "stderr": result.stderr[-2000:]})
print(json.dumps(results))
dbutils.notebook.exit(json.dumps(results))
