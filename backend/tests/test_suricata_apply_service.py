import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.suricata_apply_service import is_missing_offline_cache_error, is_transient_source_fetch_error


class SuricataApplyServiceTests(unittest.TestCase):
    def test_detects_missing_offline_cache_error(self):
        output = "Can't proceed offline, source https://example/rules.tar.gz has not yet been downloaded."

        self.assertTrue(is_missing_offline_cache_error(output))

    def test_ignores_other_suricata_update_errors(self):
        output = "Error parsing rule at line 12"

        self.assertFalse(is_missing_offline_cache_error(output))

    def test_detects_transient_source_fetch_error(self):
        self.assertTrue(is_transient_source_fetch_error("Failed to copy file: The read operation timed out"))

    def test_ignores_non_fetch_error_as_transient(self):
        self.assertFalse(is_transient_source_fetch_error("Error parsing rule at line 12"))


if __name__ == "__main__":
    unittest.main()
