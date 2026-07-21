"""Portable paths shared by the recovered dashboard model scripts."""

from __future__ import annotations

import os
import shutil
from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


def configured_path(name: str, default: Path) -> Path:
    value = os.environ.get(name)
    return Path(value).expanduser().resolve() if value else default.resolve()


DASHBOARD_ROOT = configured_path("TENKI_DASHBOARD_ROOT", REPOSITORY_ROOT)
WORK_ROOT = configured_path("TENKI_WORK_DIR", REPOSITORY_ROOT.parent / "work")
RAW_DATA_ROOT = configured_path("TENKI_RAW_DATA_DIR", REPOSITORY_ROOT / "data-links")


def duckdb_binary() -> Path:
    configured = os.environ.get("TENKI_DUCKDB_BIN")
    discovered = shutil.which("duckdb")
    if configured:
        return Path(configured).expanduser().resolve()
    if discovered:
        return Path(discovered).resolve()
    return Path("duckdb")
