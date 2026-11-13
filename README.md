# Kalma Capital Admin

The admin app is a separate React/Vite deployment. It uses the shared backend session cookie and requires an `admin` or `super_admin` account; client-side role data is not used as authorization.

## Local development

1. Start the backend with a configured MongoDB connection.
2. Set `ADMIN_URL=http://localhost:5173` in the backend environment.
3. Configure `ADMIN_EMAIL` and `ADMIN_PASSWORD` as backend-only secrets. Do not put credentials in this app's `.env`, source, or Git.
4. Copy `.env.example` to `.env` and set `VITE_API_URL` to the backend origin.
5. Run `npm ci`, then `npm run dev`.

The backend bootstraps the configured admin account when it starts. Rotate credentials that have been shared in chat or otherwise exposed before using them.

## Deployment

- Deploy `admin/` as a separate hosting project with this directory as its root.
- Production API requests use the same-origin `/api` rewrite in `vercel.json`; do not set `VITE_API_URL` in the Vercel project. This keeps the session cookie first-party on mobile browsers.
- Set `ADMIN_URL` to the exact production admin origin in the backend deployment. Add other required browser origins to `CORS_ORIGINS` only when necessary.
- Configure admin email and password only in the backend deployment's secret environment settings.
- Use HTTPS for both apps so the backend's HttpOnly session cookie can be used securely.

## Operational behavior

- Users, wallets, transactions, support, and verification requests are loaded from authenticated backend endpoints. Select a user's name to open a read-only profile with their account details, wallet, recent transactions, verification history, support summaries, investment plans, and savings goals.
- Wallets and transactions are read-only in this UI.
- KYC decisions require staff to confirm that evidence was checked through the approved verification process, include a reviewer note, and are saved with an audit event. Identity evidence is not stored in this app.
- Support status changes require a staff note and are saved with an audit event.
- Customer profiles include a separate account-freeze control. Freezing requires a reason, invalidates existing sessions, and blocks future sign-in and authenticated API use. Restoring access also requires a reason and the customer must sign in again; wallet balances and existing plans are not changed.
- Customer profiles include a transaction-access control. Restricting access requires a reason and confirmation; affected customers can still sign in, view their accounts, and contact support, while new deposits, withdrawals, bank-account changes, and investment actions are blocked. Existing balances and plans are preserved, payment settlement callbacks continue, and each change is added to the activity log. Requests already in progress when the restriction is applied may still complete, so staff should review any pending withdrawals separately.
- The activity log shows recent staff actions. Settings that are not backed by a real backend feature are not presented as configurable controls.
