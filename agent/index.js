import { App } from 'octokit'

async function getInstallationForRepo(app, owner, repo) {
  // Robust repo-specific installation lookup
  const { data } = await app.octokit.request(
    'GET /repos/{owner}/{repo}/installation',
    { owner, repo },
  )
  return data.id
}

async function main() {
  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_PRIVATE_KEY
  const repoSlug = process.env.REPO_SLUG // "owner/repo"
  const wanted = (process.env.ISSUE_LABELS || 'Ready')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (!appId || !privateKey || !repoSlug) {
    throw new Error(
      'Missing GITHUB_APP_ID / GITHUB_PRIVATE_KEY / REPO_SLUG env vars',
    )
  }
  const [owner, repo] = repoSlug.split('/')

  const app = new App({ appId: Number(appId), privateKey })
  const installationId = await getInstallationForRepo(app, owner, repo)
  const octokit = await app.getInstallationOctokit(installationId)

  // OR over labels: fetch per label, merge & de-dupe
  const seen = new Set()
  const issues = []
  for (const label of wanted) {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/issues', {
      owner,
      repo,
      state: 'open',
      labels: label,
      per_page: 100,
    })
    for (const it of data) {
      if (!seen.has(it.id)) {
        seen.add(it.id)
        issues.push(it)
      }
    }
  }

  console.log(
    `Agent online. Repo=${repoSlug}. Labels(OR)=[${wanted.join(', ')}]. Candidates=${issues.length}`,
  )
  setInterval(() => console.log('heartbeat', new Date().toISOString()), 15000)
}

main().catch((e) => {
  console.error('BOOT ERROR:', e)
  process.exit(1)
})
