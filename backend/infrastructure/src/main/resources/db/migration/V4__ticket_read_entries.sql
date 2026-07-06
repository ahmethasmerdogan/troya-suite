-- F4 — Ch 2 bilet girdileri (fare breakdown / FOP / FOID / tour code / endorsement)
-- read model'de jsonb olarak taşınır; kaynak doğruluk event store'daki TicketIssued.entries.
ALTER TABLE ticket_read ADD COLUMN IF NOT EXISTS entries JSONB;
