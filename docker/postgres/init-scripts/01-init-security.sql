-- ==============================================================================
-- Al-Saada Enterprise PostgreSQL Security & Extensions Initializer
-- ==============================================================================

-- Enable essential cryptographic & UUID extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Al-Saada PostgreSQL Extensions Initialized Successfully.';
END $$;
