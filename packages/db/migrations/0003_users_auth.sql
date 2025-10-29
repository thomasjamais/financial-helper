-- Add authentication fields to users table
alter table users
  add column if not exists name text,
  add column if not exists is_active boolean not null default true,
  add column if not exists email_verified boolean not null default false,
  add column if not exists failed_login_attempts integer not null default 0,
  add column if not exists locked_until timestamptz,
  add column if not exists last_login_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_users_email on users(email);
create index if not exists idx_users_active on users(is_active);

-- Refresh tokens table for JWT refresh token rotation
create table if not exists refresh_tokens (
  id serial primary key,
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked boolean not null default false,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  ip_address text,
  user_agent text
);

create index if not exists idx_refresh_tokens_user_id on refresh_tokens(user_id);
create index if not exists idx_refresh_tokens_token_hash on refresh_tokens(token_hash);
create index if not exists idx_refresh_tokens_expires on refresh_tokens(expires_at);

-- Audit log for authentication events
create table if not exists auth_audit_log (
  id serial primary key,
  user_id uuid references users(id) on delete set null,
  email text not null,
  event_type text not null check (event_type in ('signup', 'signin', 'signout', 'refresh', 'failed_login', 'password_reset', 'account_locked')),
  ip_address text,
  user_agent text,
  correlation_id text,
  success boolean not null,
  failure_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_audit_log_user_id on auth_audit_log(user_id);
create index if not exists idx_auth_audit_log_email on auth_audit_log(email);
create index if not exists idx_auth_audit_log_event_type on auth_audit_log(event_type);
create index if not exists idx_auth_audit_log_created_at on auth_audit_log(created_at);

-- Function to update updated_at timestamp for users
create or replace function update_users_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_update_users_updated_at
  before update on users
  for each row
  execute function update_users_updated_at();
