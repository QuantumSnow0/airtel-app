# Database Schema Documentation

## Table: `leads`

This table stores lead information for Airtel Router installations.

### Table Structure

| Column Name | Type | Constraints | Description |
|------------|------|-------------|-------------|
| `id` | `uuid` | PRIMARY KEY, NOT NULL, DEFAULT `gen_random_uuid()` | Unique identifier for each lead |
| `created_at` | `timestamp with time zone` | NULL, DEFAULT `now()` | Timestamp when the lead was created |
| `customer_name` | `text` | NOT NULL | Name of the customer |
| `airtel_number` | `text` | NOT NULL | Customer's Airtel phone number |
| `alternate_number` | `text` | NOT NULL | Customer's alternate phone number |
| `email` | `text` | NOT NULL | Customer's email address |
| `preferred_package` | `text` | NOT NULL | The package the customer prefers |
| `installation_town` | `text` | NOT NULL | Town where installation will occur |
| `delivery_landmark` | `text` | NOT NULL | Landmark for delivery location |
| `visit_date` | `date` | NOT NULL | Scheduled visit date |
| `visit_time` | `text` | NOT NULL | Scheduled visit time |
| `agent_type` | `text` | NOT NULL | Type of agent handling the lead |
| `enterprise_cp` | `text` | NOT NULL | Enterprise contact person |
| `agent_name` | `text` | NOT NULL | Name of the assigned agent |
| `agent_mobile` | `text` | NOT NULL | Mobile number of the agent |
| `lead_type` | `text` | NOT NULL | Type/category of the lead |
| `connection_type` | `text` | NOT NULL | Type of connection (e.g., fiber, wireless) |
| `ms_forms_response_id` | `integer` | NULL | Microsoft Forms response ID (if applicable) |
| `ms_forms_submitted_at` | `timestamp with time zone` | NULL | Timestamp when submitted to MS Forms |
| `submission_status` | `text` | NULL, DEFAULT `'pending'` | Status of form submission |

### Constraints

- **Primary Key**: `id`
- **Check Constraint**: `submission_status` must be one of:
  - `'pending'`
  - `'submitted'`
  - `'failed'`

### Indexes

1. **`idx_leads_created_at`**: B-tree index on `created_at` (descending) - for sorting by creation date
2. **`idx_leads_submission_status`**: B-tree index on `submission_status` - for filtering by status

### SQL Schema

```sql
CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NULL DEFAULT now(),
  customer_name text NOT NULL,
  airtel_number text NOT NULL,
  alternate_number text NOT NULL,
  email text NOT NULL,
  preferred_package text NOT NULL,
  installation_town text NOT NULL,
  delivery_landmark text NOT NULL,
  visit_date date NOT NULL,
  visit_time text NOT NULL,
  agent_type text NOT NULL,
  enterprise_cp text NOT NULL,
  agent_name text NOT NULL,
  agent_mobile text NOT NULL,
  lead_type text NOT NULL,
  connection_type text NOT NULL,
  ms_forms_response_id integer NULL,
  ms_forms_submitted_at timestamp with time zone NULL,
  submission_status text NULL DEFAULT 'pending'::text,
  CONSTRAINT leads_pkey PRIMARY KEY (id),
  CONSTRAINT leads_submission_status_check CHECK (
    (submission_status = ANY (
      ARRAY['pending'::text, 'submitted'::text, 'failed'::text]
    ))
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_leads_created_at 
ON public.leads USING btree (created_at DESC) 
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_leads_submission_status 
ON public.leads USING btree (submission_status) 
TABLESPACE pg_default;
```

### Notes

- The table uses UUIDs for primary keys
- Submission status has three possible states: `pending`, `submitted`, `failed`
- Indexes are optimized for common queries (sorting by date, filtering by status)
- Integration with Microsoft Forms is supported via `ms_forms_response_id` and `ms_forms_submitted_at`



