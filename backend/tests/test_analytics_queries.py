import unittest

from app.analytics.queries import blocked_event_filter, blocked_signature_filter, event_search_filters


class AnalyticsQueriesTests(unittest.TestCase):
    def test_blocked_signature_filter_matches_all_blocking_sources(self):
        query = blocked_signature_filter()

        should = query["bool"]["should"]
        patterns = [item["wildcard"]["suricata.eve.alert.signature.keyword"]["value"] for item in should]

        self.assertEqual(query["bool"]["minimum_should_match"], 1)
        self.assertIn("*BLOQUEO*", patterns)
        self.assertIn("*BLOCKED*", patterns)
        self.assertIn("*SURICATA-LIST block*", patterns)

    def test_blocked_signature_filter_can_use_text_field(self):
        query = blocked_signature_filter(keyword=False)

        fields = [next(iter(item["wildcard"].keys())) for item in query["bool"]["should"]]

        self.assertEqual(set(fields), {"suricata.eve.alert.signature"})

    def test_event_search_filters_builds_investigation_filters(self):
        filters = event_search_filters(
            event_type="tls",
            only_blocked=True,
            source_ip="10.0.0.2",
            destination_ip="142.250.1.1",
            domain="youtube.com",
            signature="BLOCKED",
            severity=2,
        )

        self.assertIn({"term": {"suricata.eve.event_type": "tls"}}, filters)
        self.assertIn({"term": {"source.ip.keyword": "10.0.0.2"}}, filters)
        self.assertIn({"term": {"destination.ip.keyword": "142.250.1.1"}}, filters)
        self.assertIn({"term": {"suricata.eve.alert.severity": 2}}, filters)
        self.assertTrue(any("suricata.eve.alert.signature.keyword" in item.get("wildcard", {}) for item in filters[-2]["bool"]["should"]))

    def test_blocked_event_filter_includes_policy_rule_ids(self):
        query = blocked_event_filter([(1, 1500001)])

        should = query["bool"]["should"]

        self.assertEqual(query["bool"]["minimum_should_match"], 1)
        self.assertGreaterEqual(len(should), 3)
        self.assertEqual(should[0]["bool"]["minimum_should_match"], 1)


if __name__ == "__main__":
    unittest.main()
