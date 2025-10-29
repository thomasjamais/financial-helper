import { Kysely, sql } from 'kysely'
import { readdir, readFile } from 'fs/promises'
import { basename, extname } from 'path'

function getMigrationsDirUrl(): URL {
  return new URL('../migrations/', import.meta.url)
}

function extractVersion(filename: string): string {
  const name = basename(filename)
  const dotless = name.replace(extname(name), '')
  const idx = dotless.indexOf('_')
  return idx > 0 ? dotless.slice(0, idx) : dotless
}

export async function runMigrations(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table if not exists schema_migrations(
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `.execute(db)

  const appliedRows = await sql<{ version: string }>`
    select version from schema_migrations
  `.execute(db)
  const applied = new Set(appliedRows.rows.map((r) => r.version))

  const dirUrl = getMigrationsDirUrl()
  const entries = await readdir(dirUrl, { withFileTypes: true })
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.sql'))
    .map((e) => e.name)
    .sort()

  for (const file of files) {
    const version = extractVersion(file)
    if (applied.has(version)) continue
    const sqlContent = await readFile(new URL(file, dirUrl), 'utf8')
    await sql.raw(sqlContent).execute(db)
    await sql`insert into schema_migrations(version) values (${version})`.execute(
      db,
    )
  }
}
