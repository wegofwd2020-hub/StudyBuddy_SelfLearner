"""usage_event — server-side metering of managed generations (ADR-005 D6, Phase 2)

Append-only token/cost record, one row per managed generation (the BYOK path is
NOT metered — we don't pay for those tokens; ADR-005). Scoped by account_id and
cascades with `account`, so a purge clears a user's usage automatically. The
current-window total is read as an aggregate over (account_id, ts) — a materialised
rollup is a later optimisation, not needed at this scale. No key material, no
content — counts + a cost estimate only.

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-30
"""

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE usage_event (
            id            bigserial PRIMARY KEY,
            account_id    uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
            ts            timestamptz NOT NULL DEFAULT now(),
            provider      text NOT NULL,
            model         text NOT NULL,
            input_tokens  integer NOT NULL,
            output_tokens integer NOT NULL,
            cost_micros   bigint NOT NULL,
            job_id        uuid NOT NULL
        )
        """
    )
    # The hot read is "sum this account's usage since <window start>".
    op.execute("CREATE INDEX usage_event_account_ts_idx ON usage_event (account_id, ts)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS usage_event")
