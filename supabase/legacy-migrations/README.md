# Legacy SQL reference

These unapplied source files are kept outside `migrations` to prevent duplicate version IDs and duplicate schema creation.

The four provider availability/completion/schedule scripts are already consolidated in `../migrations/20261103090000_provider_workspace_prerequisites.sql`.
The old provisioning draft shares a timestamp with the deployed customer reschedule migration. It is retained here for review, not automatically applied.

Do not copy these files back into the migration directory or run them against the current database. Future schema changes need a new migration version.
