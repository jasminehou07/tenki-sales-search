"""Portable paths and raw-folder discovery for dashboard data preparation."""

from __future__ import annotations

import os
import re
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


def configured_path(name: str, default: Path) -> Path:
    value = os.environ.get(name)
    return Path(value).expanduser().resolve() if value else default.resolve()


DASHBOARD_ROOT = configured_path("TENKI_DASHBOARD_ROOT", REPOSITORY_ROOT)
WORK_ROOT = configured_path("TENKI_WORK_DIR", REPOSITORY_ROOT.parent / "work")
RAW_DATA_ROOT = configured_path("TENKI_RAW_DATA_DIR", REPOSITORY_ROOT / "data-links")


def _folder_sort_key(path: Path, base_name: str) -> tuple[int, str]:
    suffix = path.name[len(base_name) :]
    return (int(suffix) if suffix else 1, path.name)


def discover_partitioned_parquet(base_name: str) -> list[Path]:
    """Find one parquet per filename across consolidated or numbered folders."""
    pattern = re.compile(rf"^{re.escape(base_name)}(?:[1-9]\d*)?$")
    directories = [
        path
        for path in RAW_DATA_ROOT.iterdir()
        if path.is_dir() and pattern.fullmatch(path.name)
    ] if RAW_DATA_ROOT.is_dir() else []
    directories.sort(key=lambda path: _folder_sort_key(path, base_name))

    selected: dict[str, Path] = {}
    seen_paths: set[Path] = set()
    for directory in directories:
        for path in sorted(directory.glob("*.parquet")):
            resolved = path.resolve()
            if resolved in seen_paths:
                continue
            seen_paths.add(resolved)
            selected.setdefault(path.name.casefold(), path)

    files = sorted(selected.values(), key=lambda path: (path.name.casefold(), str(path)))
    if not files:
        raise FileNotFoundError(
            f"No parquet files found in {base_name}, {base_name}2, ... under {RAW_DATA_ROOT}"
        )
    return files
