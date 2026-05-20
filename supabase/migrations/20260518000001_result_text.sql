-- Add result_text column to store the original result string from CSV/PDF
-- e.g. "Back-TH2, TH3, TH4AB (All Cleared)", "Pass(G)", "Fail"
alter table public.results
  add column if not exists result_text text;
