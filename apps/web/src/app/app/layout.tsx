import { getAppSettings } from '@repo/database'
import { createLogger } from '@repo/logger'
import type { ReactNode } from 'react'
import { prepareEmbeddedDatabase } from '@/lib/workspace'
import { AppSidebar } from './_components/app-sidebar'
import { DatabaseRecovery } from './_components/database-recovery'
import { Onboarding } from './_components/onboarding/onboarding'
import { isWorkspaceEmpty } from './_lib/seed'
import { countUncategorised } from './categorize/_lib/count'
import { listDatabaseSnapshots } from './settings/snapshot-actions'

const log = createLogger('database')

// Every /app page reads data from the embedded database at request time. This
// is a local-only build with no auth, so nothing reads cookies/headers and Next
// would otherwise try to statically prerender these routes at build time and hit
// the DB (ECONNREFUSED). Force dynamic rendering for the whole segment.
export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Open + migrate the embedded (desktop) database before rendering any page. If
  // that fails, every page would crash into the generic error boundary, so render
  // a recovery screen instead. It offers the latest snapshot, plus a reset when
  // the data dir is corrupt. A failed migration is a bug on our side and gets no
  // reset (see DatabaseRecovery), but it is still logged with its detail.
  const dbStatus = await prepareEmbeddedDatabase()
  if (!dbStatus.ok) {
    log.error('Embedded database failed to open', {
      corrupt: dbStatus.corrupt,
      detail: dbStatus.detail,
    })
    const { snapshots } = await listDatabaseSnapshots()
    const latest = snapshots[0]
    return (
      <main className="min-h-screen">
        <DatabaseRecovery
          kind={dbStatus.corrupt ? 'corrupt' : 'update-failed'}
          latestSnapshot={latest ? { name: latest.name, createdAt: latest.createdAt } : null}
        />
      </main>
    )
  }

  // First run: once the DB is healthy but before the app is set up, show the
  // welcome tour (choose demo data vs a clean slate) in place of everything else.
  // The flag lives in the single-row app_settings blob, so it survives restarts.
  // Guarded on an empty workspace too, so an install that predates the flag but
  // already has data is never interrupted (and can't hit demo-seed conflicts).
  if (!(await getAppSettings()).onboardingCompleted && (await isWorkspaceEmpty())) {
    return (
      <main className="min-h-screen">
        <Onboarding />
      </main>
    )
  }

  const uncategorised = await countUncategorised()

  return (
    <div className="flex min-h-screen">
      <AppSidebar uncategorised={uncategorised} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
