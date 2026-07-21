import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui'
import { ChevronsUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { prepareEmbeddedDatabase } from '@/lib/workspace'
import { AppSidebar } from './_components/app-sidebar'
import { DatabaseRecovery } from './_components/database-recovery'

// Every /app page reads data from the embedded database at request time. This
// is a local-only build with no auth, so nothing reads cookies/headers and Next
// would otherwise try to statically prerender these routes at build time and hit
// the DB (ECONNREFUSED). Force dynamic rendering for the whole segment.
export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Open + migrate the embedded (desktop) database before rendering any page. If
  // its data dir is corrupt the WASM Postgres can't boot; rather than letting every
  // page crash into the generic error boundary, we render a recovery screen that
  // offers a reset. A genuine (non-corrupt) init failure is rethrown as a real bug.
  const dbStatus = await prepareEmbeddedDatabase()
  if (!dbStatus.ok && !dbStatus.corrupt) {
    throw new Error(dbStatus.detail)
  }

  // const footer = (
  //   <div className="flex items-center gap-3 rounded-lg px-1 py-1">
  //     <Avatar className="size-8 rounded-lg">
  //       <AvatarImage src="/logo.png" alt="" className="object-contain" />
  //       <AvatarFallback className="rounded-lg bg-primary/15 text-primary">PC</AvatarFallback>
  //     </Avatar>
  //     <div className="min-w-0 flex-1 leading-tight">
  //       <p className="truncate font-medium text-sm">Local workspace</p>
  //       <p className="truncate text-muted-foreground text-xs">Single-user</p>
  //     </div>
  //     <ChevronsUpDown className="size-4 text-muted-foreground" />
  //   </div>
  // )

  return (
    <div className="flex min-h-screen">
      <AppSidebar footer={null} />
      <main className="min-w-0 flex-1">{dbStatus.ok ? children : <DatabaseRecovery />}</main>
    </div>
  )
}
