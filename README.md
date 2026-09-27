# Subscription Auditor

Next.js browser app that reads CSV or text-based PDF statements locally and estimates recurring monthly or annual debits. Files are never sent to an API. The sample button allows a public demo without personal financial data.

## Run

From the workspace root run `pnpm install`, `pnpm --filter subscription-auditor test`, then `pnpm --filter subscription-auditor dev` and open `http://127.0.0.1:3011`.

## Input format

CSV headers should include a date, description or merchant, and amount or debit column. Negative amounts are treated as charges. A positive `debit` column is also supported. Accepted dates: ISO `YYYY-MM-DD` and European `DD.MM.YYYY`, `DD/MM/YYYY`, or `DD-MM-YYYY`. PDFs require selectable text in a simple row layout; scanned PDFs need OCR and may not parse. Review detected transactions before acting.

## Deployment

Run `pnpm --filter subscription-auditor build` and `pnpm --filter subscription-auditor start` on a Node host. It can be exposed through a Cloudflare tunnel for testing. A Quick Tunnel does not provide production uptime. No provider API keys are required. Keep the page under HTTPS because it handles private statement data in the browser.

## Limits

The detector groups normalized merchant names and looks for repeated intervals of 25–35 days or 350–380 days. It can miss variable billing dates or give false positives for regular non-subscription purchases. It intentionally does not offer guessed cancellation links.
