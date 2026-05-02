#!/usr/bin/env python
"""Run a SQL migration file against the Supabase Postgres database.

Usage:
    python scripts/run_migration.py migrations/001_chat_conversations.sql

Reads SUPABASE_URL + SUPABASE_DB_PASSWORD from .env. The DB host is derived
from the Supabase project ref in the URL (osaeeokjtglkgcpaiztq → db.osaeeokjtglkgcpaiztq.supabase.co).
"""
import os
import sys
import re
from pathlib import Path
from dotenv import load_dotenv
import psycopg2


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: run_migration.py <path-to-sql-file>")
        sys.exit(1)

    sql_path = Path(sys.argv[1]).resolve()
    if not sql_path.exists():
        print(f"file not found: {sql_path}")
        sys.exit(1)

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")

    url = os.environ.get("SUPABASE_URL", "")
    pw = os.environ.get("SUPABASE_DB_PASSWORD")
    if not url or not pw:
        print("SUPABASE_URL and SUPABASE_DB_PASSWORD must be set in .env")
        sys.exit(1)

    m = re.match(r"https://([a-z0-9]+)\.supabase\.co", url)
    if not m:
        print(f"could not parse project ref out of {url}")
        sys.exit(1)
    project_ref = m.group(1)

    sql = sql_path.read_text()
    print(f"running {sql_path.name}")
    print("-" * 60)
    print(sql)
    print("-" * 60)

    # Try the most common pooler regions in order. Supabase pooler hostnames
    # follow `aws-0-<region>.pooler.supabase.com` and require user
    # `postgres.<project_ref>`.
    regions = [
        "us-east-1",
        "us-east-2",
        "us-west-1",
        "us-west-2",
        "eu-central-1",
        "eu-west-1",
        "ap-southeast-1",
        "ap-southeast-2",
        "ap-northeast-1",
        "ap-south-1",
    ]
    last_err: Exception | None = None
    for region in regions:
        host = f"aws-0-{region}.pooler.supabase.com"
        try:
            conn = psycopg2.connect(
                host=host,
                port=6543,
                user=f"postgres.{project_ref}",
                password=pw,
                dbname="postgres",
                sslmode="require",
                connect_timeout=4,
            )
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.close()
            print(f"migration applied via {host}")
            return
        except Exception as e:
            last_err = e
            print(f"  {region}: {type(e).__name__}: {str(e).strip()[:120]}")

    print()
    print("could not connect via any known pooler region.")
    print("please paste the SQL above into the Supabase SQL editor manually.")
    if last_err:
        raise last_err


if __name__ == "__main__":
    main()
