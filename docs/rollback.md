# Rollback

Promote the last known-good Vercel deployment. Roll back Railway to the previous image
only if it remains compatible with the current schema. Verify health, REST and WSS afterward.
Do not automatically reverse database migrations or reset production data.
Prefer additive expand/contract migrations; a failed migration blocks rollout and requires
inspection of the migration journal and schema before retry. Destructive changes need an
explicit backup/restore and compatibility plan approved before deployment.
Confirm actual Supabase plan backup/PITR availability in the dashboard before relying on it;
do not assume the free plan provides recovery guarantees. No paid backup service is added.
