import sys
import asyncio
import unittest
import uuid
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.suricata_list_service import normalize_list_value, preview_generated_rules, sync_profile_list_rules, validate_list_entry


def entry(list_type: str, entry_type: str, value: str, action: str, direction: str = "destination", enabled: bool = True, notify_enabled: bool = False):
    return SimpleNamespace(
        id=uuid.uuid4(),
        list_type=list_type,
        entry_type=entry_type,
        value=value,
        action=action,
        direction=direction,
        enabled=enabled,
        notify_enabled=notify_enabled,
        generated_rule_ids=[],
        created_at=datetime.now(timezone.utc),
    )


class FakeScalarResult:
    def __init__(self, entries):
        self.entries = entries

    def all(self):
        return self.entries


class FakeResult:
    def __init__(self, entries):
        self.entries = entries

    def scalars(self):
        return FakeScalarResult(self.entries)


class FakeSession:
    def __init__(self, entries):
        self.entries = entries
        self.added = []

    async def execute(self, _statement):
        return FakeResult(self.entries)

    def add(self, item):
        self.added.append(item)

    async def flush(self):
        pass


class SuricataListServiceTests(unittest.TestCase):
    def test_normalizes_domain_ip_and_cidr(self):
        self.assertEqual(normalize_list_value("domain", "https://Example.COM/path"), "example.com")
        self.assertEqual(normalize_list_value("ip", " 1.2.3.4 "), "1.2.3.4")
        self.assertEqual(normalize_list_value("cidr", "10.0.0.1/24"), "10.0.0.0/24")

    def test_rejects_invalid_action_for_list_type(self):
        with self.assertRaises(ValueError):
            validate_list_entry("allow", "domain", "example.com", "destination", "drop")
        with self.assertRaises(ValueError):
            validate_list_entry("block", "domain", "example.com", "destination", "pass")

    def test_generates_domain_rules_for_all_protocols(self):
        rules = preview_generated_rules([entry("block", "domain", "example.com", "drop")])

        self.assertEqual(len(rules), 3)
        self.assertIn("drop dns", rules[0][1])
        self.assertIn("drop tls", rules[1][1])
        self.assertIn("drop http", rules[2][1])

    def test_generates_both_directions_for_ip(self):
        rules = preview_generated_rules([entry("allow", "ip", "1.2.3.4", "pass", direction="both")])

        self.assertEqual(len(rules), 2)
        self.assertIn("pass ip any any -> 1.2.3.4 any", rules[0][1])
        self.assertIn("pass ip 1.2.3.4 any -> any any", rules[1][1])

    def test_sync_profile_list_rules_copies_notification_preference(self):
        profile_id = uuid.uuid4()
        session = FakeSession([entry("block", "domain", "example.com", "drop", notify_enabled=True)])

        asyncio.run(sync_profile_list_rules(session, profile_id))

        self.assertEqual(len(session.added), 3)
        self.assertTrue(all(rule.notify_enabled for rule in session.added))


if __name__ == "__main__":
    unittest.main()
