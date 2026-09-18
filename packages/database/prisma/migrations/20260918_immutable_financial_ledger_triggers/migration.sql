CREATE OR REPLACE FUNCTION enforce_financial_ledger_integrity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'CRITICAL_SECURITY_VIOLATION';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.amount IS DISTINCT FROM OLD.amount OR
           NEW.worker_id IS DISTINCT FROM OLD.worker_id OR
           NEW.created_at IS DISTINCT FROM OLD.created_at OR
           NEW.current_hash IS DISTINCT FROM OLD.current_hash OR
           NEW.prev_hash IS DISTINCT FROM OLD.prev_hash THEN
            RAISE EXCEPTION 'CRITICAL_SECURITY_VIOLATION';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- We execute DROP and CREATE inside a DO block to avoid errors if the tables do not exist yet.
DO $$
DECLARE
    t_name text;
    tables text[] := ARRAY['AttendanceRecord', 'PayrollTransaction', 'WorkerAdvance', 'CustodyTransaction', 'ExpenseRecord', 'SupplierInvoice'];
BEGIN
    FOREACH t_name IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = t_name) THEN
            EXECUTE 'DROP TRIGGER IF EXISTS enforce_financial_ledger_integrity_trg ON "' || t_name || '"';
            EXECUTE 'CREATE TRIGGER enforce_financial_ledger_integrity_trg BEFORE UPDATE OR DELETE ON "' || t_name || '" FOR EACH ROW EXECUTE FUNCTION enforce_financial_ledger_integrity()';
        END IF;
    END LOOP;
END;
$$;
