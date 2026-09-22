-- Sovereign Immutability and Gap-Free Hash Chain Triggers for Financial Ledgers
-- Defense-in-Depth v2.1 Architecture

-- 1. Function enforcing gap-free sequence and cryptographic continuity
CREATE OR REPLACE FUNCTION verify_financial_ledger_chain_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_last_hash TEXT;
  v_last_seq BIGINT;
BEGIN
  -- Fetch the most recent committed record by monotonic sequence
  SELECT record_hash, ledger_seq INTO v_last_hash, v_last_seq
  FROM financial_ledgers
  WHERE id <> NEW.id
  ORDER BY ledger_seq DESC
  LIMIT 1;

  IF NOT FOUND THEN
    -- Genesis record verification
    IF NEW.ledger_seq IS NOT NULL AND NEW.ledger_seq <> 1 THEN
      RAISE EXCEPTION 'GENESIS_LEDGER_SEQ_MUST_BE_1';
    END IF;
    IF NEW.previous_hash IS NOT NULL AND NEW.previous_hash <> '0000000000000000000000000000000000000000000000000000000000000000' THEN
      RAISE EXCEPTION 'GENESIS_PREV_HASH_MUST_BE_ZEROES';
    END IF;
  ELSE
    -- 1. Monotonic gap-free sequence validation
    IF NEW.ledger_seq IS NOT NULL AND v_last_seq IS NOT NULL AND NEW.ledger_seq <> v_last_seq + 1 THEN
      RAISE EXCEPTION 'CRITICAL_LEDGER_SEQUENCE_GAP: Expected seq %, but got %', v_last_seq + 1, NEW.ledger_seq;
    END IF;
    -- 2. Cryptographic lineage continuity validation
    IF NEW.previous_hash IS NOT NULL AND v_last_hash IS NOT NULL AND NEW.previous_hash IS DISTINCT FROM v_last_hash THEN
      RAISE EXCEPTION 'CRITICAL_HASH_CHAIN_INTEGRITY_VIOLATION: Expected prev_hash %, but got %', v_last_hash, NEW.previous_hash;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Function enforcing immutability on financial records
CREATE OR REPLACE FUNCTION enforce_financial_ledger_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'CRITICAL_SECURITY_VIOLATION: Hard deletion of financial records is prohibited';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        -- Allow updating soft-delete and sync flags, but strictly prohibit modifying financial amounts, sequence, or hash lineage
        IF NEW.amount IS DISTINCT FROM OLD.amount OR
           NEW.ledger_seq IS DISTINCT FROM OLD.ledger_seq OR
           NEW.record_hash IS DISTINCT FROM OLD.record_hash OR
           NEW.previous_hash IS DISTINCT FROM OLD.previous_hash OR
           NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION 'CRITICAL_SECURITY_VIOLATION: Tampering with immutable ledger fields is prohibited';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach triggers to snake_case tables safely
DO $$
DECLARE
    t_name text;
    chain_tables text[] := ARRAY['financial_ledgers'];
    immutable_tables text[] := ARRAY[
      'financial_ledgers',
      'supplier_invoices',
      'custody_expense_items',
      'custody_settlements',
      'hospitality_expenses',
      'supplier_payments',
      'worker_expense_claims'
    ];
BEGIN
    -- Gap-free and hash chain integrity trigger
    FOREACH t_name IN ARRAY chain_tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = t_name) THEN
            EXECUTE 'DROP TRIGGER IF EXISTS trg_verify_financial_ledger_chain ON "' || t_name || '"';
            EXECUTE 'CREATE TRIGGER trg_verify_financial_ledger_chain BEFORE INSERT ON "' || t_name || '" FOR EACH ROW EXECUTE FUNCTION verify_financial_ledger_chain_integrity()';
        END IF;
    END LOOP;

    -- Immutability trigger
    FOREACH t_name IN ARRAY immutable_tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = t_name) THEN
            EXECUTE 'DROP TRIGGER IF EXISTS trg_enforce_financial_ledger_immutability ON "' || t_name || '"';
            EXECUTE 'CREATE TRIGGER trg_enforce_financial_ledger_immutability BEFORE UPDATE OR DELETE ON "' || t_name || '" FOR EACH ROW EXECUTE FUNCTION enforce_financial_ledger_immutability()';
        END IF;
    END LOOP;
END;
$$;
