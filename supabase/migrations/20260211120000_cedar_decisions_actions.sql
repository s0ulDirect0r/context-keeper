-- Cedar: Decisions and Actions
-- Decisions are living hypotheses grounded in pearl evidence.
-- Actions are concrete next steps with full lineage to their parent decision.

-- ── Decisions ──────────────────────────────────────────────────────

CREATE TABLE decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_id UUID NOT NULL REFERENCES summaries(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  reasoning TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')) DEFAULT 'low',
  status TEXT NOT NULL CHECK (status IN ('emerging', 'active', 'resolved', 'revised')) DEFAULT 'emerging',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX decisions_user_id_idx ON decisions(user_id);
CREATE INDEX decisions_summary_id_idx ON decisions(summary_id);

ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own decisions" ON decisions FOR SELECT
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can insert own decisions" ON decisions FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update own decisions" ON decisions FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can delete own decisions" ON decisions FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- ── Decision-Pearl evidence links ─────────────────────────────────

CREATE TABLE decision_pearls (
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  pearl_id UUID NOT NULL REFERENCES pearls(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL CHECK (relationship IN ('supports', 'contradicts')),
  PRIMARY KEY (decision_id, pearl_id)
);

ALTER TABLE decision_pearls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own decision_pearls" ON decision_pearls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM decisions
      WHERE decisions.id = decision_pearls.decision_id
        AND decisions.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "Users can insert own decision_pearls" ON decision_pearls FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM decisions
      WHERE decisions.id = decision_pearls.decision_id
        AND decisions.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "Users can delete own decision_pearls" ON decision_pearls FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM decisions
      WHERE decisions.id = decision_pearls.decision_id
        AND decisions.user_id = (SELECT auth.uid())
    )
  );

-- ── Actions ───────────────────────────────────────────────────────

CREATE TABLE actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  context_card JSONB,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'done')) DEFAULT 'pending',
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX actions_user_id_idx ON actions(user_id);
CREATE INDEX actions_decision_id_idx ON actions(decision_id);

ALTER TABLE actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own actions" ON actions FOR SELECT
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can insert own actions" ON actions FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update own actions" ON actions FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can delete own actions" ON actions FOR DELETE
  USING ((SELECT auth.uid()) = user_id);
