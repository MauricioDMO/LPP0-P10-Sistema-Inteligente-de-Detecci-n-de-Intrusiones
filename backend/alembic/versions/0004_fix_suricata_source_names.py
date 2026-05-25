"""fix suricata source names

Revision ID: 0004_fix_suricata_source_names
Revises: 0003_create_suricata_management
Create Date: 2026-05-23 22:45:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_fix_suricata_source_names"
down_revision: str | None = "0003_create_suricata_management"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE suricata_sources
            SET source_name = 'abuse.ch/urlhaus',
                display_name = 'abuse.ch URLhaus',
                description = 'URLhaus malware URL rules'
            WHERE source_name = 'abuse.ch/threatfox'
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE suricata_sources
            SET source_name = 'abuse.ch/sslbl-blacklist',
                display_name = 'abuse.ch SSLBL Blacklist',
                description = 'SSL certificate blacklist rules'
            WHERE source_name = 'abuse.ch/sslbl-c2'
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE suricata_sources
            SET source_name = 'abuse.ch/threatfox',
                display_name = 'abuse.ch ThreatFox',
                description = 'IOC rules from ThreatFox'
            WHERE source_name = 'abuse.ch/urlhaus'
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE suricata_sources
            SET source_name = 'abuse.ch/sslbl-c2',
                display_name = 'abuse.ch SSLBL C2',
                description = 'SSL botnet C2 rules'
            WHERE source_name = 'abuse.ch/sslbl-blacklist'
            """
        )
    )
