import { App } from 'octokit'

async function main() {
  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_PRIVATE_KEY
  const repoSlug = process.env.REPO_SLUG // "owner/repo"
  const labels = (process.env.ISSUE_LABELS || 'Ready').split(',')
  if (!appId || !privateKey || !repoSlug) {
    throw new Error(
      'Missing GITHUB_APP_ID / GITHUB_PRIVATE_KEY / REPO_SLUG env vars',
    )
  }
  const [owner, repo] = repoSlug.split('/')

  const app = new App({ appId: Number(appId), privateKey })
  const { data: installations } = await app.octokit.request(
    'GET /app/installations',
  )
  const installation =
    installations.find(
      (i) => (i.account?.login || '').toLowerCase() === owner.toLowerCase(),
    ) || installations[0]
  if (!installation)
    throw new Error('GitHub App is not installed on the target repo/org')

  const octokit = await app.getInstallationOctokit(installation.id)
  const { data: issues } = await octokit.request(
    'GET /repos/{owner}/{repo}/issues',
    {
      owner,
      repo,
      state: 'open',
      labels: labels.join(','),
    },
  )

  console.log(
    `Agent online. Repo=${repoSlug}. Ready-labeled issues=${issues.length}`,
  )
  // keep the process alive so ECS shows heartbeats
  setInterval(() => console.log('heartbeat', new Date().toISOString()), 15000)
}

main().catch((e) => {
  console.error('BOOT ERROR:', e)
  process.exit(1)
})
