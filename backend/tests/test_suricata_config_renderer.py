import unittest
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.suricata_config_renderer import render_suricata_config, validate_custom_rule_text


def override(gid: int, sid: int, action: str, enabled: bool = True):
    return SimpleNamespace(gid=gid, sid=sid, action=action, enabled=enabled)


def custom_rule(rule_text: str, enabled: bool = True, validation_status: str = "valid"):
    return SimpleNamespace(rule_text=rule_text, enabled=enabled, validation_status=validation_status)


class RenderSuricataConfigTests(unittest.TestCase):
    def test_renders_overrides_into_expected_files(self):
        rendered = render_suricata_config(
            [
                override(1, 2034647, "enable"),
                override(1, 2027758, "disable"),
                override(1, 2019401, "drop"),
                override(1, 2019402, "reject"),
                override(1, 2019403, "alert"),
                override(1, 2019404, "drop", enabled=False),
            ],
            [],
        )

        self.assertEqual(rendered.enable_conf, "1:2034647\n")
        self.assertEqual(rendered.disable_conf, "1:2027758\n")
        self.assertEqual(rendered.drop_conf, "1:2019401\n1:2019402\n")
        self.assertEqual(rendered.modify_conf, "")

    def test_renders_only_enabled_valid_custom_rules(self):
        valid_rule = 'alert icmp any any -> any any (msg:"PING"; sid:1000001; rev:1;)'
        rendered = render_suricata_config(
            [],
            [
                custom_rule(valid_rule),
                custom_rule('alert icmp any any -> any any (msg:"OFF"; sid:1000002; rev:1;)', enabled=False),
                custom_rule('alert icmp any any -> any any (msg:"BAD"; sid:1000003; rev:1;)', validation_status="invalid"),
            ],
        )

        self.assertEqual(rendered.local_rules, f"{valid_rule}\n")


class ValidateCustomRuleTextTests(unittest.TestCase):
    def test_accepts_valid_rule(self):
        status, error = validate_custom_rule_text('alert icmp any any -> any any (msg:"PING"; sid:1000001; rev:1;)')

        self.assertEqual(status, "valid")
        self.assertIsNone(error)

    def test_rejects_missing_required_fields(self):
        cases = [
            ('alert icmp any any -> any any (msg:"PING"; rev:1;)', "sid:"),
            ('alert icmp any any -> any any (msg:"PING"; sid:1000001;)', "rev:"),
            ("alert icmp any any -> any any (sid:1000001; rev:1;)", "msg:"),
        ]

        for rule_text, expected_fragment in cases:
            with self.subTest(rule_text=rule_text):
                status, error = validate_custom_rule_text(rule_text)
                self.assertEqual(status, "invalid")
                self.assertIn(expected_fragment, error or "")

    def test_rejects_invalid_structure(self):
        cases = [
            "log icmp any any -> any any (msg:\"PING\"; sid:1000001; rev:1;)",
            'alert icmp any any any any (msg:"PING"; sid:1000001; rev:1;)',
            'alert icmp any any -> any any msg:"PING"; sid:1000001; rev:1;',
        ]

        for rule_text in cases:
            with self.subTest(rule_text=rule_text):
                status, error = validate_custom_rule_text(rule_text)
                self.assertEqual(status, "invalid")
                self.assertIsNotNone(error)


if __name__ == "__main__":
    unittest.main()
