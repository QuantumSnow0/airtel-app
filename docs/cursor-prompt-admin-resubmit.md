# Cursor Prompt: Create Admin Resubmit Page (Next.js)

Copy and paste this prompt into your Next.js frontend Cursor:

---

Create a new admin page at `app/admin/resubmit/page.tsx` (or `pages/admin/resubmit.tsx` if using Pages Router) for managing lead resubmissions to Microsoft Forms and the leads table.

## Requirements:

1. **Page Structure**:
   - Use Next.js App Router (create at `app/admin/resubmit/page.tsx`) or Pages Router (`pages/admin/resubmit.tsx`)
   - Use React Server Components or Client Components as appropriate
   - Use standard HTML/CSS or Tailwind CSS (match your existing Next.js app style)
   - Create a clean admin interface

2. **Data Fetching**:
   - Create an API route at `app/api/resubmit-leads/route.ts` (or `pages/api/resubmit-leads.ts`)
   - Fetch all records from `leads_resubmit` table using Supabase
   - **IMPORTANT**: Use SERVICE ROLE KEY in the API route (not anon key) since RLS is disabled on `leads_resubmit`
   - Display records in a table format
   - Show: customer_name, airtel_number, alternate_number, email, preferred_package, installation_town, visit_date, visit_time

3. **UI Components**:
   - Table/list of records from `leads_resubmit` table
   - Each record should have a "Resubmit" button
   - Show loading states during operations
   - Show success/error messages (use toast notifications or alert components)
   - Add a refresh button to reload the list
   - Show total count of records

4. **Resubmit Functionality**:
   Create an API route at `app/api/resubmit-leads/submit/route.ts` (or `pages/api/resubmit-leads/submit.ts`)
   
   When user clicks "Resubmit" on a record:
   - Call the API endpoint with the record ID
   - API should:
     - Fetch the record from `leads_resubmit` table
     - Submit the lead data to Microsoft Forms (use the same MS Forms submission logic from your existing codebase)
     - After successful MS Forms submission:
       - Insert the record into `leads` table with:
         - `bypass_duplicate_check = true`
         - `created_at = NOW()` (current timestamp, not the original)
         - `ms_forms_response_id` = the response ID from MS Forms
         - `ms_forms_submitted_at = NOW()` (current timestamp)
         - `submission_status = 'submitted'`
         - Generate a new UUID for the id (don't reuse the original)
         - Copy all other fields from the `leads_resubmit` record
     - Optionally: Remove the record from `leads_resubmit` table after successful resubmission (or mark it as submitted)
   - Show success message with MS Forms response ID
   - Show error message if submission fails
   - Refresh the list after successful resubmission

5. **Microsoft Forms Integration**:
   - Use the same MS Forms submission endpoint/function that your app currently uses
   - The submission should happen at the current time (when resubmit button is clicked)
   - Handle the response and update the record accordingly
   - The API route should handle the MS Forms submission server-side

6. **Styling**:
   - Match your existing Next.js admin/app design style
   - Use Tailwind CSS or your existing CSS framework
   - Make it responsive and user-friendly
   - Use appropriate colors for actions (primary button color, error red, etc.)

7. **Error Handling**:
   - Handle network errors
   - Handle MS Forms submission failures
   - Handle database errors
   - Show user-friendly error messages

8. **Additional Features** (optional but recommended):
   - Search/filter functionality
   - Sort by date, name, etc.
   - Pagination if there are many records
   - Show which records have been resubmitted (if you keep them in the table)
   - Confirmation dialog before resubmitting

## API Routes Needed:

### 1. GET `/api/resubmit-leads`
Fetch all records from `leads_resubmit` table:
```typescript
// app/api/resubmit-leads/route.ts
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key
  );
  
  const { data, error } = await supabase
    .from('leads_resubmit')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  
  return Response.json({ leads: data, count: data.length });
}
```

### 2. POST `/api/resubmit-leads/submit`
Resubmit a single record:
```typescript
// app/api/resubmit-leads/submit/route.ts
export async function POST(request: Request) {
  const { leadId } = await request.json();
  
  // 1. Fetch record from leads_resubmit
  // 2. Submit to MS Forms
  // 3. Insert into leads table with bypass_duplicate_check = true
  // 4. Optionally delete from leads_resubmit
  // 5. Return success/error
}
```

## Technical Notes:

- The `leads_resubmit` table has RLS disabled, so you MUST use service role key in API routes
- The `leads` table now has a `bypass_duplicate_check` column (boolean)
- When inserting into `leads`, set `bypass_duplicate_check = true` so it won't show as duplicate
- The `created_at` timestamp should be the current time, not the original from `leads_resubmit`
- MS Forms submission should happen at the current time
- Generate new UUID for the new record in `leads` table

## Example Data Structure:

The record from `leads_resubmit` will have all the same fields as `leads`:
- customer_name, airtel_number, alternate_number, email
- preferred_package, installation_town, delivery_landmark
- visit_date, visit_time
- agent_type, enterprise_cp, agent_name, agent_mobile
- lead_type, connection_type
- etc.

## Environment Variables Needed:

Make sure you have:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (for API routes to access leads_resubmit)

Create a clean, functional admin interface that allows one-by-one resubmission of leads with proper error handling and user feedback.
