import dotenv from 'dotenv';
// Deployment environment wins; .env.local takes precedence over .env for CLI scripts.
dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ path: '.env', quiet: true });
