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

    # Supabase pooler hostnames are now sharded across `aws-0-*` and
    # `aws-1-*` clusters. We try both shards plus port 5432/6543 across the
    # most common regions until one accepts our tenant. Direct host
    # (db.<ref>.supabase.co) is tried first when DNS resolves.
    candidates: list[tuple[str, int, str]] = [
        # Direct host — fastest when DNS resolves
        (f"db.{project_ref}.supabase.co", 5432, "postgres"),
    ]
    for shard in ("aws-1", "aws-0"):
        for region in (
            "us-east-2", "us-east-1", "us-west-1", "us-west-2",
            "eu-central-1", "eu-west-1",
            "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-south-1",
        ):
            for port in (5432, 6543):
                candidates.append(
                    (f"{shard}-{region}.pooler.supabase.com", port,
                     f"postgres.{project_ref}"),
                )

    last_err: Exception | None = None
    for host, port, user in candidates:
        try:
            conn = psycopg2.connect(
                host=host, port=port, user=user,
                password=pw, dbname="postgres",
                sslmode="require", connect_timeout=4,
            )
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.close()
            print(f"migration applied via {host}:{port} as {user}")
            return
        except Exception as e:
            last_err = e
            msg = str(e).strip().splitlines()[0][:120]
            print(f"  {host}:{port} -> {type(e).__name__}: {msg}")

    print()
    print("could not connect via any known pooler region.")
    print("please paste the SQL above into the Supabase SQL editor manually.")
    if last_err:
        raise last_err


if __name__ == "__main__":
    main()
