-- Migration 003: Add location tag column to postcards
alter table public.postcards
  add column if not exists location text;
