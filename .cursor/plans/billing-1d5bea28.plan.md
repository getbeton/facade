<!-- 1d5bea28-d18c-45a8-92bd-0d522a7d8199 d5d75f21-53bc-4779-99ad-86d670260999 -->
# Billing System Implementation Plan

## Core Architecture

**Billing Model**: Pre-payment for image generations using Stripe Checkout Sessions (one-time payments)

**Free Tier Logic**:

- Users who provide their own OpenAI API key (per-collection) → unlimited free generations for that collection
- Users without API key → 5 free generations (account-wide), then must pay before generating

**Payment Entity**: Continue using Stripe Checkout Sessions for one-time purchases. Each generation batch is a separate purchase.

**Tracking**: Two-tier approach:

- `payments` table: Tracks billing transactions
- `generation_logs` table: Tracks individual generation attempts with collection/item attribution

---

## Database Schema Changes

### Migration: Add Free Tier Tracking & Generation Logs

**File**: `supabase/migrations/20241125000002_add_billing_and_tracking.sql`

**Changes**:

1. **Add to `profiles` table**:

   - `free_generations_used` (INTEGER DEFAULT 0): Tracks how many free generations used
   - `stripe_customer_id` (already exists): Link to Stripe customer for payment history

2. **Create `generation_logs` table**:

   - `id` (UUID): Primary key
   - `user_id` (UUID): References profiles
   - `collection_id` (UUID): References collections (our DB UUID)
   - `webflow_collection_id` (TEXT): The actual Webflow collection ID
   - `webflow_item_id` (TEXT): The Webflow CMS item ID
   - `item_name` (TEXT): Item name for easy reference
   - `payment_id` (UUID): References payments (NULL if free tier used or own API key)
   - `status` (TEXT): 'pending', 'processing', 'completed', 'failed'
   - `is_free_tier` (BOOLEAN): Whether this used free tier
   - `uses_own_api_key` (BOOLEAN): Whether user used their own OpenAI key
   - `error_message` (TEXT): Error details if failed
   - `cost_cents` (INTEGER): Cost charged (0 if free)
   - `started_at` (TIMESTAMP)
   - `completed_at` (TIMESTAMP)
   - `created_at` (TIMESTAMP)

3. **Update `payments` table**:

   - Add `generation_logs_count` (INTEGER): Number of generation_logs linked to this payment
   - Rename `items_count` to `purchased_count` for clarity
   - Keep existing `items_completed` and `items_failed`

4. **Indexes**:

   - `idx_generation_logs_user_id`
   - `idx_generation_logs_collection_id`
   - `idx_generation_logs_payment_id`
   - `idx_generation_logs_created_at`

5. **RLS Policies**:

   - Users can view their own generation_logs
   - Service role can insert/update generation_logs

---

## Backend Implementation

### 1. Update Stripe Library (`lib/stripe.ts`)

**Add function**: `getUserFreeTierStatus(userId: string)`

- Query profiles table for `free_generations_used`
- Return remaining free generations (5 - used)

**Add function**: `incrementFreeTierUsage(userId: string, count: number)`

- Update `profiles.free_generations_used`
- Called after successful generation

**Update**: `createCheckoutSession()`

- Add metadata: `itemIds` (JSON string array)
- This allows webhook to create generation_logs in pending state

### 2. New API Route: Check Billing Status

**File**: `app/api/billing/check-status/route.ts`

**Purpose**: Pre-flight check before generation to determine if payment needed

**Logic**:

1. Authenticate user
2. Get collection from DB (decrypt to check if OpenAI key exists)
3. If collection has OpenAI API key → return `{ requiresPayment: false, reason: 'own_api_key' }`
4. Check user's `free_generations_used`
5. Calculate: `requestedItems - remainingFree`
6. If `remainingFree >= requestedItems` → return `{ requiresPayment: false, reason: 'free_tier', remainingAfter: X }`
7. If payment needed → return `{ requiresPayment: true, itemsToCharge: X, amountCents: Y }`

**Response Type**:

```typescript
{
  requiresPayment: boolean
  reason?: 'own_api_key' | 'free_tier'
  remainingFreeGenerations?: number
  itemsToCharge?: number
  amountCents?: number
}
```

### 3. Update Generation Route (`app/api/generate-images/route.ts`)

**Add Pre-Generation Validation**:

1. Check if generation is authorized:

   - If own API key → proceed
   - If free tier available → proceed and mark for free tier tracking
   - If paid → verify payment exists and is valid

**Add Generation Logging**:

- Before processing each item: Create `generation_logs` entry with status='pending'
- During processing: Update status='processing'
- After success: Update status='completed', set `completed_at`
- On failure: Update status='failed', set `error_message`

**Update Function Signature**:

- Accept optional `paymentId` in request body
- If `paymentId` provided, verify payment exists and has correct `items_count`

**Track Free Tier Usage**:

- At start: Determine how many items will use free tier
- At end: Call `incrementFreeTierUsage()` to update user's counter

### 4. Update Stripe Webhook (`app/api/webhooks/stripe/route.ts`)

**Existing**: Already creates payment record on `checkout.session.completed`

**Add**: Create placeholder `generation_logs` entries

- Extract `itemIds` from session metadata
- For each itemId, create generation_log with:
  - `payment_id`: the newly created payment ID
  - `status`: 'pending'
  - `is_free_tier`: false
  - `uses_own_api_key`: false
  - `cost_cents`: PRICE_PER_IMAGE_CENTS

**Update**: Add `stripe_customer_id` to user's profile

- Extract `session.customer` (Stripe Customer ID)
- Update `profiles.stripe_customer_id` for future reference

### 5. Update Checkout Creation (`app/api/stripe/create-checkout/route.ts`)

**Add to Request Body**:

- `itemIds`: Array of Webflow item IDs to be generated

**Add to Session Metadata**:

- Store `itemIds` as JSON string
- Store `collectionDbId` (our DB UUID) separate from `collectionId` (Webflow ID)

**Validation**:

- Ensure itemIds.length matches itemsCount

---

## Frontend Implementation

### 1. Update Collection Items Page (`components/collection-items.tsx`)

**Add UI Elements**:

- Checkbox column for selecting items
- "Generate Selected" button
- Display user's remaining free generations
- Payment modal/flow

**Add State**:

- `selectedItemIds`: Array of selected item IDs
- `billingStatus`: Result from `/api/billing/check-status`
- `generationInProgress`: Boolean flag

**Generation Flow**:

1. User selects items (or selects all)
2. User clicks "Generate Selected"
3. Call `/api/billing/check-status` with collectionId and itemIds
4. If `requiresPayment: false`:

   - Show confirmation: "This will use X free generations" or "Using your OpenAI key"
   - Proceed to generation

5. If `requiresPayment: true`:

   - Show payment summary: "Pay $X for Y generations"
   - On confirm, call `/api/stripe/create-checkout` with itemIds
   - Redirect to Stripe Checkout

6. After payment success (redirect back from Stripe):

   - Show success message
   - Automatically trigger generation with paymentId

**Free Tier Display**:

- Badge/text showing: "X free generations remaining"
- Update after each generation

### 2. Payment Success Page (`app/dashboard/payment/success/page.tsx`)

**Currently**: Already exists, shows payment success

**Update**:

- Extract `session_id` from URL
- Call `/api/payment-status` to get payment details and collection info
- Auto-trigger generation by calling `/api/generate-images` with:
  - `collectionId`: from payment metadata
  - `itemIds`: from payment metadata
  - `paymentId`: from payment record
- Show real-time generation progress (already implemented via streaming)

### 3. New API Route: Payment Status (`app/api/payment-status/route.ts`)

**Currently**: Exists but may need updates

**Ensure Returns**:

- Payment details (amount, items_count, collection_name)
- Collection ID (both DB UUID and Webflow ID)
- Item IDs (from payment metadata)
- Payment verification (status must be 'pending' or 'processing')

---

## Environment Variables

**Required**:

- `STRIPE_SECRET_KEY` (already set)
- `STRIPE_WEBHOOK_SECRET` (already set)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (if showing Stripe elements in future)
- `SUPABASE_SERVICE_ROLE_KEY` (already set)
- `ENCRYPTION_KEY` (already set)

**Note**: All Stripe private keys remain on backend only. Frontend only receives checkout URLs.

---

## Testing Checklist

1. **Free Tier User (No API Key)**:

   - New user generates 5 items → should complete without payment
   - Same user tries 6th item → should require payment
   - User pays for 1 → generation completes
   - Check `profiles.free_generations_used = 5`

2. **Own API Key User**:

   - User adds collection with OpenAI key
   - User generates 100 items → no payment required
   - Check no payment records created
   - Check `uses_own_api_key = true` in generation_logs

3. **Paid User (No Free Tier Left)**:

   - User with 5 generations already used
   - User selects 10 items → should pay for 10
   - User pays → redirected to success page
   - Generation auto-triggers
   - Check payment.status = 'completed'
   - Check 10 generation_logs linked to payment_id

4. **Mixed Scenario**:

   - User has 2 free generations left
   - User selects 5 items
   - Should pay for 3 items only
   - Generation uses 2 free (is_free_tier=true) + 3 paid

5. **Error Handling**:

   - User closes Stripe checkout → no payment, no generation
   - Payment succeeds but generation fails → payment exists, generation_logs show failures
   - Network error during generation → retry mechanism

---

## Security Considerations

1. **Stripe Keys**: Never expose `STRIPE_SECRET_KEY` to frontend
2. **Payment Verification**: Always verify payment exists and belongs to user before generation
3. **Rate Limiting**: Consider adding rate limits to prevent abuse of free tier
4. **Idempotency**: Webhook already has idempotency check via `stripe_payment_intent_id`
5. **API Key Encryption**: Continue using AES-256-GCM for stored API keys
6. **RLS Policies**: Ensure users can only access their own generation logs and payments

---

## Key Files to Modify

1. `supabase/migrations/20241125000002_add_billing_and_tracking.sql` (NEW)
2. `lib/stripe.ts` (UPDATE - add free tier functions)
3. `lib/types.ts` (UPDATE - add GenerationLog interface)
4. `app/api/billing/check-status/route.ts` (NEW)
5. `app/api/generate-images/route.ts` (UPDATE - add logging & validation)
6. `app/api/stripe/create-checkout/route.ts` (UPDATE - add itemIds)
7. `app/api/webhooks/stripe/route.ts` (UPDATE - create generation_logs)
8. `app/api/payment-status/route.ts` (UPDATE - return itemIds)
9. `components/collection-items.tsx` (UPDATE - add selection & payment flow)
10. `app/dashboard/payment/success/page.tsx` (UPDATE - auto-trigger generation)

---

## Implementation Order

1. Database migration (schema foundation)
2. Backend utilities (stripe.ts free tier functions)
3. Billing check API (pre-flight validation)
4. Update webhook (payment + generation_logs creation)
5. Update generation route (logging & validation)
6. Frontend UI (item selection)
7. Payment flow integration (checkout with itemIds)
8. Success page automation
9. Testing & debugging
10. Run `npm run build` to verify compilation

### To-dos

- [ ] Create database migration for billing tracking and generation logs
- [ ] Add free tier tracking functions to stripe.ts library
- [ ] Create billing check-status API endpoint
- [ ] Update Stripe webhook to create generation_logs on payment
- [ ] Add payment verification and logging to generate-images route
- [ ] Add item selection UI to collection-items component
- [ ] Update checkout creation to include itemIds metadata
- [ ] Auto-trigger generation from payment success page
- [ ] Add TypeScript interfaces for billing and generation logs
- [ ] Run npm build and test complete billing flow