-- Migration: 20260328000002_holes_penalties_gir.sql
-- Ticket: THEA-132
-- Add penalties and green-in-regulation (gir) columns to the holes table.

ALTER TABLE public.holes ADD COLUMN IF NOT EXISTS penalties int NOT NULL DEFAULT 0;
ALTER TABLE public.holes ADD COLUMN IF NOT EXISTS gir boolean;
