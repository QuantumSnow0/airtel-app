# Discussion

## Understanding: `leads_paused` Table

### Key Points I Understand:

1. **Purpose**: Temporary holding table for form submissions when the system is in "paused" mode
   - **Clarification**: Data IS still transmitted to Microsoft Forms even when paused
   - The pause only affects which database table stores the data (`leads` vs `leads_paused`)
   - Preserves all customer information safely

2. **Control Mechanism**: 
   - Uses `app_settings` table with `is_paused` boolean flag
   - `is_paused = false` → submissions go to `leads` table (normal)
   - `is_paused = true` → submissions go to `leads_paused` table (paused)
   - Fail-safe: defaults to `false` if settings unavailable

3. **Table Structure**: 
   - Identical structure to `leads` table
   - Same columns: customer info, package, location, agent data, MS Forms tracking fields

4. **Data Transfer Process**:
   - Manual transfer via `/api/paused-leads` POST endpoint
   - Checks for duplicates before transferring
   - Currently leaves leads in `leads_paused` after transfer (for audit trail)
   - Transfer happens in `src/app/api/paused-leads/route.ts`

5. **Use Cases**:
   - Microsoft Forms maintenance periods
   - Capacity management (too many leads at once)
   - Quality control (review before processing)

6. **API Endpoints**:
   - `/api/paused-leads` (GET: fetch paused leads, POST: transfer to leads)
   - `/api/pause-toggle` (GET: check status, POST: update pause status)

7. **Submission Flow**:
   - Controlled in `src/app/api/submit/route.ts` (lines 123-132)
   - Checks `app_settings.is_paused` to determine target table
   - **Important**: MS Forms submission still happens regardless of pause status
   - Pause only controls database storage location, not MS Forms submission

---

## Discussion Points

### Requirement: Resubmit Unique Customer Data to MS Forms

**Goal**: Resubmit unique customer data to MS Forms and add them to the leads table without showing as duplicates in the app.

**Requirements**:

1. **New Table Creation**:
   - Create a new table (similar to `leads_paused`) to store unique customer records
   - This table will hold the 59 unique customers (or selected subset) from duplicate analysis
   - Structure should match `leads` table for easy transfer

2. **Manual Resubmission Workflow**:
   - Ability to resubmit records one by one (manual control)
   - When a record is resubmitted:
     - Submit to Microsoft Forms
     - Insert into `leads` table
     - Should NOT show as duplicate in the app

3. **Key Considerations**:
   - Need to ensure records don't trigger duplicate detection when added to `leads`
   - May need to modify duplicate detection logic OR
   - May need to generate new IDs or modify certain fields to avoid duplicate matching
   - Need API endpoint(s) to:
     - Copy unique customers to the new table
     - Fetch records from the new table
     - Resubmit individual records (one by one) to MS Forms and leads table

4. **Questions to Consider**:
   - What should the new table be called? (e.g., `leads_resubmit`, `leads_pending_resubmit`)
   - Should we copy all 59 unique customers or allow selection?
   - How to prevent duplicate detection? (new IDs, modified timestamps, etc.)
   - Should the resubmission process update the original duplicate records or create new ones?

### Analysis: Can We Bypass Duplicate Detection by Changing IDs?

**Answer: No, changing IDs alone won't work.**

**Why:**
- The duplicate detection logic (`checkDuplicateStatus`) compares **data fields**, not IDs
- The ID is only used to skip comparing a lead with itself (`if (currentLead.id === otherLead.id) continue;`)
- Duplicate detection checks these fields:
  - `customer_name`
  - `airtel_number`
  - `alternate_number`
  - `email`
  - `preferred_package`
  - `installation_town`
  - `delivery_landmark`
  - `agent_type`, `enterprise_cp`, `agent_name`, `agent_mobile`
  - `lead_type`, `connection_type`

**Options to Bypass Duplicate Detection:**

1. **Modify a field slightly** (e.g., add suffix to customer_name like " - Resubmitted")
   - Pros: Simple, doesn't require code changes
   - Cons: Changes the actual customer data

2. **Add a flag field** (e.g., `is_resubmitted` or `bypass_duplicate_check`)
   - Pros: Preserves original data, clean solution
   - Cons: Requires modifying duplicate detection logic to check this flag

3. **Modify duplicate detection logic** to exclude certain records
   - Pros: Most flexible
   - Cons: Requires code changes to `checkDuplicateStatus` function

4. **Use a different approach**: Mark original duplicates as "resolved" or "merged"
   - Pros: Clean data management
   - Cons: More complex workflow

**Recommendation**: Option 2 (add flag) or Option 3 (modify detection logic) would be cleanest.

### Decision: Use Option 2 - Add Flag Field

**Chosen Approach**: Add a flag field to bypass duplicate detection.

**Implementation Plan**:

1. **Database Changes**:
   - Add `bypass_duplicate_check BOOLEAN DEFAULT false` field to `leads` table
   - Create new table `leads_resubmit` (same structure as `leads` table)
   - This table will store unique customers ready for resubmission

2. **Modify Duplicate Detection Logic**:
   - Update `checkDuplicateStatus` function in `app/(tabs)/home.tsx`
   - Skip duplicate checking if `bypass_duplicate_check === true`
   - Logic: If a lead has `bypass_duplicate_check = true`, don't mark it as duplicate (or don't check it against others)

3. **Create New Table: `leads_resubmit`**:
   - Structure: Same as `leads` table
   - Purpose: Hold unique customer records ready for resubmission
   - Fields: All fields from `leads` table

4. **API Endpoints Needed**:
   - `POST /api/resubmit-leads/copy` - Copy unique customers to `leads_resubmit` table
   - `GET /api/resubmit-leads` - Fetch all records from `leads_resubmit` table
   - `POST /api/resubmit-leads/submit` - Resubmit a single record:
     - Submit to Microsoft Forms
     - Insert into `leads` table with `bypass_duplicate_check = true`
     - Optionally remove from `leads_resubmit` after successful submission

5. **Workflow**:
   ```
   Step 1: Copy unique customers → leads_resubmit table
   Step 2: Admin reviews records in leads_resubmit
   Step 3: Admin selects one record to resubmit
   Step 4: API submits to MS Forms + inserts into leads with bypass_duplicate_check=true
   Step 5: Record doesn't show as duplicate in app
   ```

6. **Key Implementation Details**:
   - When inserting into `leads`, set `bypass_duplicate_check = true`
   - Generate new UUID for the new record (don't reuse original ID)
   - **IMPORTANT - Timestamp Handling**:
     - Set `created_at` to **current timestamp** (when resubmitted), NOT the original `created_at` from `leads_resubmit`
     - This makes the resubmitted record appear as if it was just created
   - **MS Forms Submission**:
     - Submit to MS Forms at the **current time** (when resubmit happens)
     - `ms_forms_submitted_at` will be set to current timestamp by the submission process
     - The original `created_at` from `leads_resubmit` is ignored - only the resubmission time matters
   - Clear `ms_forms_response_id` (will be set by new submission)
   - Set `submission_status = 'pending'` initially (will update to 'submitted' after MS Forms submission)

**Summary**: When resubmitting, treat it as a brand new submission happening right now, regardless of when the original record was created in `leads_resubmit`.

### SQL Migration File Created

✅ **File**: `docs/database-schema-resubmit-leads.sql`

This SQL file includes:
1. Adds `bypass_duplicate_check` column to `leads` table
2. Creates `leads_resubmit` table with same structure as `leads` table
3. Sets up indexes
4. **DISABLES RLS for privacy** - other app users won't see this data

**Privacy Approach**:
- RLS is disabled on `leads_resubmit` table
- Access this table ONLY via API endpoints using **SERVICE ROLE KEY**
- NEVER query this table from the app client (React Native app)
- This ensures other app users cannot see or access this data
- Only backend API (with service role key) can access it

**Next Step**: Run this SQL in your Supabase SQL Editor to create the table and add the column.

**Important**: When creating API endpoints, use service role key (not anon key) to access `leads_resubmit` table.

### Progress Status

✅ **Completed:**
- [x] SQL migration file created
- [x] Table `leads_resubmit` created in database
- [x] Column `bypass_duplicate_check` added to `leads` table
- [x] RLS disabled for privacy
- [x] Duplicate detection logic updated (bypass flag implemented)
- [x] 59 unique customers copied to `leads_resubmit` table

**Next Steps:**
1. ✅ **Copy unique customers to `leads_resubmit` table** - DONE
2. ✅ **Modify duplicate detection logic** - DONE
3. **Create admin UI**
   - Cursor prompt ready: `docs/cursor-prompt-admin-resubmit.md`
   - Use this prompt in your frontend Cursor to create `app/admin/resubmit.tsx`
   - The UI will handle MS Forms submission from the frontend
   - Will need to create Supabase Edge Function or API endpoint for:
     - Fetching records from `leads_resubmit` (using service role key)
     - Resubmitting to MS Forms and inserting into `leads` table with `bypass_duplicate_check = true`

---

