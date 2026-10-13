# Read-only learning preview

Deployment on 2026-10-13: https://maxlie-blog.vercel.app
Vercel deployment: dpl_DuRHzv6homLHmJYbSPNeLtMys7QV (READY).
Project: prj_4k9SSP4h0ofxnbUS6sPwT72OclDI.

The deployment is a read-only preview published to the production alias. Set BLOG_READ_ONLY_PREVIEW=1 to enable it. Builds migrate a new schema-only database under data/preview.db. Never import learner data into this database. File tracing bundles the schema-only database and content; the runtime opens an ephemeral copy. Password/session checks deny all Studio access while this flag is enabled, so no attempts or learning logs can be submitted or retained. Streak tiles show unavailable, not a fabricated value.

Read lessons at /learning/daily; pick archived dates with ?date=YYYY-MM-DD. Submit work in ChatGPT until persistent storage is connected. The source includes packets for October 10 through 13.

Vercel Deployment Protection remains enabled. Automatic approval rejected disabling SSO protection. Deployment status is READY, but authenticated fetch verification was blocked by a Vercel connection 403. Do not claim page or submission end-to-end verification. The current Vercel Git connection cannot access maxlie12/blog; the source was deployed through the source-file API. Repo pushes do not automatically redeploy yet.

For the writable application: provision separate Turso preview/production databases, apply repository migrations deliberately, set Turso credentials and Studio secrets server-side, and remove BLOG_READ_ONLY_PREVIEW. Do not migrate any ephemeral preview records; there are none. See VERCEL-TURSO.md.
