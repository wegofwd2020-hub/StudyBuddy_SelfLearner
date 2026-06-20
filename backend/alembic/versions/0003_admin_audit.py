"""admin_audit — persistent super-admin action trail (ADR-020 D5 / O2)

Upgrades the structlog-only audit to a durable, queryable table. Records the
actor, action and target of every mutating admin action — actor + action +
target + timestamp only, NEVER secrets or content (D5/D6). Deliberately has NO
foreign key to `account`: the trail must survive a target account's deletion.

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-20
"""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE admin_audit (
            id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            actor_sub    text NOT NULL,
            actor_email  text,
            action       text NOT NULL,
            target_sub   text,
            created_at   timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    # Newest-first listing is the common read.
    op.execute("CREATE INDEX admin_audit_created_at_idx ON admin_audit (created_at DESC, id DESC)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS admin_audit")
