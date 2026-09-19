PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS providers (
    slug TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    official_homepage TEXT NOT NULL,
    parser_version TEXT NOT NULL DEFAULT '1',
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_slug TEXT NOT NULL REFERENCES providers(slug),
    source_url TEXT NOT NULL,
    source_type TEXT NOT NULL,
    content_sha256 TEXT NOT NULL,
    published_at TEXT,
    fetched_at TEXT NOT NULL,
    local_path TEXT,
    status TEXT NOT NULL DEFAULT 'fetched'
        CHECK (status IN ('fetched', 'parsed', 'rejected', 'superseded')),
    metadata_json TEXT NOT NULL DEFAULT '{}',
    UNIQUE (provider_slug, source_url, content_sha256)
);

CREATE INDEX IF NOT EXISTS idx_source_documents_provider_fetched
    ON source_documents (provider_slug, fetched_at DESC);

CREATE TABLE IF NOT EXISTS distribution_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_slug TEXT NOT NULL REFERENCES providers(slug),
    ticker TEXT NOT NULL,
    fund_name TEXT,
    distribution_per_share TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    declared_date TEXT NOT NULL,
    ex_date TEXT NOT NULL,
    record_date TEXT,
    payable_date TEXT,
    frequency TEXT,
    roc_percent TEXT,
    source_document_id INTEGER NOT NULL REFERENCES source_documents(id),
    official_url TEXT NOT NULL,
    verification_status TEXT NOT NULL DEFAULT 'detected'
        CHECK (verification_status IN (
            'detected', 'official', 'cross_checked', 'needs_review', 'rejected'
        )),
    event_key TEXT NOT NULL UNIQUE,
    collected_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_distribution_events_ticker_ex_date
    ON distribution_events (ticker, ex_date DESC);

CREATE INDEX IF NOT EXISTS idx_distribution_events_provider_declared
    ON distribution_events (provider_slug, declared_date DESC);

CREATE TABLE IF NOT EXISTS validation_findings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_document_id INTEGER NOT NULL REFERENCES source_documents(id),
    event_id INTEGER REFERENCES distribution_events(id),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
    code TEXT NOT NULL,
    message TEXT NOT NULL,
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_validation_findings_open
    ON validation_findings (resolved_at, severity, created_at DESC);

CREATE TABLE IF NOT EXISTS pipeline_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_slug TEXT REFERENCES providers(slug),
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'warning', 'failed')),
    discovered_count INTEGER NOT NULL DEFAULT 0,
    parsed_count INTEGER NOT NULL DEFAULT 0,
    accepted_count INTEGER NOT NULL DEFAULT 0,
    rejected_count INTEGER NOT NULL DEFAULT 0,
    report_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS pipeline_run_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    provider_slug TEXT,
    status TEXT NOT NULL CHECK (status IN ('success', 'warning', 'failed', 'skipped')),
    retryable INTEGER NOT NULL DEFAULT 0 CHECK (retryable IN (0, 1)),
    message TEXT NOT NULL DEFAULT '',
    details_json TEXT NOT NULL DEFAULT '{}',
    started_at TEXT NOT NULL,
    finished_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pipeline_run_steps_run
    ON pipeline_run_steps (run_id, id);

CREATE TABLE IF NOT EXISTS content_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    content_key TEXT NOT NULL,
    ticker TEXT,
    topic TEXT NOT NULL,
    published_at TEXT NOT NULL,
    views INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
    likes INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0),
    comments INTEGER NOT NULL DEFAULT 0 CHECK (comments >= 0),
    clicks INTEGER NOT NULL DEFAULT 0 CHECK (clicks >= 0),
    subscribers INTEGER NOT NULL DEFAULT 0 CHECK (subscribers >= 0),
    watch_minutes REAL NOT NULL DEFAULT 0 CHECK (watch_minutes >= 0),
    production_minutes REAL NOT NULL DEFAULT 0 CHECK (production_minutes >= 0),
    imported_at TEXT NOT NULL,
    UNIQUE (platform, content_key)
);

CREATE INDEX IF NOT EXISTS idx_content_performance_topic_date
    ON content_performance (topic, published_at DESC);

-- Reconciliation is deliberately separate from the collection ledger.  A
-- detected difference must never mutate the legacy public data automatically.
CREATE TABLE IF NOT EXISTS public_data_reconciliation_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES distribution_events(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    ex_date TEXT NOT NULL,
    data_path TEXT,
    status TEXT NOT NULL CHECK (status IN (
        'matched', 'missing_data_file', 'missing_date', 'amount_mismatch',
        'expected_only', 'needs_review', 'approved', 'rejected', 'applied'
    )),
    comparison_json TEXT NOT NULL DEFAULT '{}',
    proposed_patch_json TEXT NOT NULL DEFAULT '{}',
    reviewed_by TEXT,
    reviewed_at TEXT,
    applied_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_public_data_reconciliation_status
    ON public_data_reconciliation_reviews (status, updated_at DESC);

PRAGMA user_version = 4;
