# Billing System Testing Protocol

This protocol documents the manual and automated tests to verify the Facade billing system, including Free Tier, Own API Key (BYOK), and Paid Generation flows.

## Prerequisites

1.  **Environment Variables**: Ensure `.env.local` contains:
    *   `NEXT_PUBLIC_SUPABASE_URL`
    *   `SUPABASE_SERVICE_ROLE_KEY` (for test data setup)
    *   `STRIPE_SECRET_KEY`
    *   `STRIPE_WEBHOOK_SECRET`
    *   `ENCRYPTION_KEY`
2.  **Server**: The Next.js server must be running locally:
    ```bash
    npm run dev
    ```
    (Runs on http://localhost:3000)

## Automated Test Script

We have provided a script `tests/test-billing-local.js` that automates the following checks:

1.  **Authentication**: Creates/Logs in a test user.
2.  **Data Setup**: Creates test collections (One with Own Key, One without).
3.  **Billing Checks**:
    *   Verifies **Free Tier** availability for new users.
    *   Verifies **Own API Key** bypasses billing.
    *   Verifies **Payment Requirement** when free tier is exceeded.
4.  **Checkout Flow**:
    *   Creates a Stripe Checkout Session.
5.  **Webhook Simulation**:
    *   Simulates a `checkout.session.completed` event from Stripe.
    *   Verifies `payments` table insertion.
    *   Verifies `generation_logs` creation.
6.  **Payment Verification**:
    *   Checks `/api/payment-status` reflects the successful payment.

### How to Run

1.  Start the app: `npm run dev`
2.  In a separate terminal, run:
    ```bash
    # Option A: If you have dotenv installed
    node tests/test-billing-local.js

    # Option B: Using Node.js built-in env loader (Node 20+)
    node --env-file=.env.local tests/test-billing-local.js
    ```

---

## Manual Testing Scenarios

If the automated script passes, you can perform these manual checks for UI verification.

### Scenario 1: Free Tier Experience
1.  Log in as a new user.
2.  Go to a collection without an OpenAI key.
3.  Select 5 items.
4.  Click "Check & Generate".
5.  **Expected**: Should show "Using free tier" and proceed to generation immediately.

### Scenario 2: Paid Experience
1.  Using the same user (now with 0 free generations).
2.  Select 1 item.
3.  Click "Check & Generate".
4.  **Expected**: Should show "Pay & Generate" button.
5.  Click button -> Redirect to Stripe.
6.  Complete payment (use Stripe Test Card: `4242...`).
7.  **Expected**: Redirect back to Success page, generation starts automatically.

### Scenario 3: BYOK Experience
1.  Add a collection *with* a valid OpenAI API Key.
2.  Select any number of items.
3.  Click "Check & Generate".
4.  **Expected**: Should show "Using your API key" and proceed immediately.

### Scenario 4: Error Handling
1.  Try to generate with a failed payment ID (requires manual API manipulation).
2.  Try to generate more items than paid for.

