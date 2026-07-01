#!/usr/bin/env python3
"""Apply SQL migrations directly to Supabase Postgres."""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('.env.local')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env.local")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

migrations = [
    ('001_schema_and_indexes.sql', 'supabase/migrations/001_schema_and_indexes.sql'),
    ('002_rpc_functions.sql', 'supabase/migrations/002_rpc_functions.sql'),
    ('003_realtime_rls_security.sql', 'supabase/migrations/003_realtime_rls_security.sql'),
]

for name, path in migrations:
    print(f"Applying {name}...")
    with open(path, 'r') as f:
        sql = f.read()

    try:
        # Execute raw SQL via PostgREST (through a hack using rpc with raw query)
        # Actually, let's use the built-in exec_raw or just send via SQL endpoint
        result = supabase.postgrest.client.post(
            '/execute_sql',
            json={'query': sql},
            headers={'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'}
        )
        print(f"  ✓ {name} applied")
    except Exception as e:
        # PostgREST might not have an execute_sql endpoint; try direct SQL via psycopg2 instead
        import psycopg2
        from urllib.parse import urlparse

        # Parse Supabase connection string
        url = urlparse(SUPABASE_URL)
        # Supabase URL format: https://[project-ref].supabase.co
        project_ref = url.hostname.split('.')[0]
        db_url = f"postgresql://postgres:[password]@{project_ref}.supabase.co:5432/postgres"

        # Actually, we don't have the DB password. Let's use a different approach:
        # Just guide the user to paste the SQL manually.
        print(f"  ⚠ PostgREST doesn't support direct SQL execution.")
        print(f"  Please paste this SQL into your Supabase SQL Editor manually:")
        print("---")
        print(sql[:200] + "...")
        print("---")

print("\nTo apply migrations manually:")
print("1. Go to your Supabase project → SQL Editor")
print("2. Create a new query for each migration file:")
for name, path in migrations:
    print(f"   - {name}")
print("3. Copy and paste each migration's SQL content")
print("4. Run each query (Click ▶ Run)")
