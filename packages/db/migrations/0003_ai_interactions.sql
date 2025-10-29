-- AI interaction logging
create table if not exists ai_interactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  repo_owner text not null,
  repo_name text not null,
  agent_role text not null,
  direction text not null check (direction in ('user','assistant','system','event')),
  correlation_id text not null,
  issue_number integer,
  pr_number integer,
  content text not null,
  metadata jsonb not null default '{}',
  tags text[] not null default '{}'
);

create index if not exists idx_ai_interactions_created_at on ai_interactions(created_at);
create index if not exists idx_ai_interactions_correlation on ai_interactions(correlation_id);
create index if not exists idx_ai_interactions_repo on ai_interactions(repo_owner, repo_name);
create index if not exists idx_ai_interactions_issue on ai_interactions(issue_number);
create index if not exists idx_ai_interactions_pr on ai_interactions(pr_number);
