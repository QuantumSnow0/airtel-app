# Fix: Auto-Reply Delay Issue

## Problem

Edge Functions have execution time limits (60-300 seconds), so a 2-minute delay inside the webhook function might not complete. The function returns immediately, and the async delay might be terminated.

## Solution Options

### Option 1: Use Supabase Database Functions with pg_cron (Recommended)

Create a database function that processes pending auto-replies, and schedule it to run every minute.

### Option 2: Reduce Delay Time

Change delay to 30 seconds (within Edge Function limits) instead of 2 minutes.

### Option 3: Use Supabase Edge Functions with Queue

Store messages that need auto-reply in a queue table, and have a separate scheduled function process them.

## Recommended: Option 2 (Quick Fix)

The simplest fix is to reduce the delay to 30 seconds, which is well within Edge Function limits and still feels natural.
