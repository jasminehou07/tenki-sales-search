from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


PACKAGE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGE_DIR))

from sales_event_model import discover_data_directories, discover_parquet_files


class FolderDiscoveryTest(unittest.TestCase):
    def test_numbered_batches_are_discovered_without_duplicate_genres(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            for name in ["genre-sales", "genre-sales2", "genre-sales3", "genre-sales-backup"]:
                (root / name).mkdir()

            (root / "genre-sales" / "100.parquet").touch()
            (root / "genre-sales2" / "100.parquet").touch()
            (root / "genre-sales2" / "200.parquet").touch()
            (root / "genre-sales3" / "300.parquet").touch()
            (root / "genre-sales-backup" / "400.parquet").touch()

            directories = discover_data_directories(root, "genre-sales")
            files = discover_parquet_files(root, "genre-sales")

            self.assertEqual([path.name for path in directories], ["genre-sales", "genre-sales2", "genre-sales3"])
            self.assertEqual([path.name for path in files], ["100.parquet", "200.parquet", "300.parquet"])
            self.assertEqual(files[0].parent.name, "genre-sales")

    def test_consolidated_unsuffixed_folder_works_alone(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            consolidated = root / "genre-ranking"
            consolidated.mkdir()
            (consolidated / "101.parquet").touch()
            (consolidated / "202.parquet").touch()

            files = discover_parquet_files(root, "genre-ranking")

            self.assertEqual([path.name for path in files], ["101.parquet", "202.parquet"])


if __name__ == "__main__":
    unittest.main()
