-- Ajoute un indicateur pour activer/désactiver le module CRM pour chaque client

alter table public.clients
  add column if not exists crm_actif boolean not null default true;


