import json
import tempfile
import unittest
from pathlib import Path

from scripts.release.build_public_release import build_release


class PublicReleaseTest(unittest.TestCase):
    def test_release_points_to_immutable_catalog_and_existing_history(self):
        with tempfile.TemporaryDirectory() as temporary:
            public = Path(temporary) / "public"
            (public / "data" / "nyse").mkdir(parents=True)
            (public / "data" / "nyse" / "demo.json").write_text('{"backtestData": []}', encoding="utf-8")
            (public / "nav.json").write_text(json.dumps({"nav": [{"symbol": "DEMO", "market": "NYSE", "dataPaths": ["data/nyse/demo.json"]}, {"symbol": "MISSING", "dataPaths": ["data/nyse/missing.json"]}]}), encoding="utf-8")

            result = build_release(public, "test-release", "2026-10-13T00:00:00Z")

            self.assertEqual(result["manifest"]["instrumentCount"], 2)
            self.assertEqual(result["catalog"]["instruments"][0]["dataPath"], "data/nyse/demo.json")
            pointer = json.loads((public / "releases" / "v1" / "current.json").read_text(encoding="utf-8"))
            self.assertEqual(pointer["manifestKey"], "releases/v1/releases/test-release/manifest.json")

