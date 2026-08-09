# Deployment and Testing Guide

This guide walks you through setting up, testing, and deploying CoBuy in local and production environments.

---

## 1. Environment Variables Config

Create a `.env.local` file in the root of the project using the values defined in `.env.example`:

```properties
# Supabase project URLs and tokens
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App URL for redirection (OAuth callbacks & invites)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# SMTP Credentials for Invitation Mailing (e.g. Gmail App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM_NAME=CoBuy App
```

---

## 2. Database Initialization (Supabase)

To initialize your database schema, tables, triggers, indexes, and Row Level Security rules:

1. Create a new project in the [Supabase Dashboard](https://supabase.com).
2. Navigate to the **SQL Editor** tab.
3. Open the file `supabase/migrations/20260807000000_initial_schema.sql`.
4. Copy the entire script, paste it into the Supabase SQL editor, and press **Run**.
5. Enable SMTP inside **Authentication** -> **Providers** -> **SMTP** if using custom mailing credentials.

---

## 3. Running Unit Tests

CoBuy includes a native unit test suite testing cost allocation, remainder rounding splits, historical membership windows, and Greedy Settlement algorithm transactions.

Run the tests using `tsx` (TypeScript Execute):

```bash
npx tsx src/infrastructure/services/__tests__/runner.ts
```

The script runs isolated mock tests and prints a colored summary in the console.

---

## 4. Production Build & Local Launch

Verify that everything builds and run the Next.js server locally:

```bash
# 1. Install dependencies
npm install

# 2. Compile and run build
npm run build

# 3. Start local production server
npm run start
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

---

## 5. Hosting Deployment (Vercel)

The easiest way to host CoBuy is on the Vercel Platform:

1. Import the repository into your Vercel Dashboard.
2. Set the Environment Variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, etc.) in the Vercel project settings.
3. Vercel automatically detects Next.js, builds the Turbopack production bundle, and provisions HTTPS SSL endpoints.
4. Set the redirect URL in Supabase Auth to match your Vercel production domain.
