import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    from app.notifier import _format_buffer_message, _format_message
except ModuleNotFoundError as exc:
    if exc.name != "sqlalchemy":
        raise
    _format_buffer_message = None
    _format_message = None


class NotifierTests(unittest.TestCase):
    @unittest.skipIf(_format_message is None, "sqlalchemy is not installed")
    def test_format_message_escapes_telegram_html(self):
        message = _format_message(
            {
                "event_type": "alert",
                "alert": {"signature": "ET MALWARE [test] <bad> & sample"},
                "src_ip": "10.0.0.1",
                "dest_ip": "1.2.3.4",
            }
        )

        self.assertIn("&lt;bad&gt; &amp; sample", message)
        self.assertIn("<code>10.0.0.1</code>", message)

    @unittest.skipIf(_format_buffer_message is None, "sqlalchemy is not installed")
    def test_format_buffer_message_uses_nested_eve_event(self):
        message = _format_buffer_message(
            [
                {
                    "suricata": {
                        "eve": {
                            "event_type": "alert",
                            "alert": {"signature": "Rule <one>"},
                            "src_ip": "10.0.0.2",
                            "dest_ip": "1.2.3.5",
                        }
                    }
                }
            ],
            "UTC",
        )

        self.assertIn("Rule &lt;one&gt;", message)
        self.assertIn("<code>10.0.0.2</code>", message)


if __name__ == "__main__":
    unittest.main()
