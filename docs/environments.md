# Environments

| Environment | Frontend                | Backend                         | Database                         | Purpose                      |
| ----------- | ----------------------- | ------------------------------- | -------------------------------- | ---------------------------- |
| Local       | localhost:5173          | localhost:3000                  | Dedicated dev Supabase or memory | Development                  |
| Preview     | Explicit Vercel preview | Explicit shared preview Railway | Non-production database          | Review                       |
| Production  | Vercel HTTPS            | Railway HTTPS/WSS               | Dedicated Supabase               | Public fictional-credit demo |
| Test        | Playwright local        | Local isolated server           | CI PostgreSQL service            | Disposable automated tests   |

Never set TEST_DATABASE_URL to production. No wildcard *.vercel.app CORS.
Each allowed preview URL must be explicitly listed in server CORS_ORIGIN.
Production requires DATABASE_URL and CORS_ORIGIN. DATABASE_SSL_CA_FILE enables the
official Supabase CA. DIRECT_URL is for the controlled migration step.
Frontend receives only public VITE_API_URL/VITE_WS_URL (and optional public repository URL).
Secrets live in ignored local env files or platform secret stores. Never publish env exports.
