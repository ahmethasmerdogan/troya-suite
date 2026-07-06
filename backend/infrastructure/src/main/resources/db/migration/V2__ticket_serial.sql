-- Bilet seri numarası kaynağı (Faz 1). 9 haneli serial; mod-7 check digit kod tarafında eklenir.
CREATE SEQUENCE IF NOT EXISTS ticket_serial START 700000001;
