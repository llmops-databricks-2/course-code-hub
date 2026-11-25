"""Build the App source snapshot from the canonical project files."""

from pathlib import Path
from shutil import copy2, copytree, rmtree

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "app_deployment"
FILES = ("pyproject.toml", "uv.lock", "project_config.yml", "README.md")
DIRECTORIES = ("src", "prompts")


def main() -> None:
    DESTINATION.mkdir(exist_ok=True)
    for name in FILES:
        copy2(ROOT / name, DESTINATION / name)
    version_file = ROOT / "version.txt"
    if version_file.exists():
        copy2(version_file, DESTINATION / "version.txt")
    elif (DESTINATION / "version.txt").exists():
        (DESTINATION / "version.txt").unlink()
    for name in DIRECTORIES:
        target = DESTINATION / name
        if target.exists():
            rmtree(target)
        copytree(
            ROOT / name,
            target,
            ignore=lambda _, names: {
                name
                for name in names
                if name == "__pycache__" or name.endswith((".pyc", ".egg-info"))
            },
        )


if __name__ == "__main__":
    main()
