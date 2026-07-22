import { Card, CardContent } from '@repo/ui'
import { resetAndSeedDemo } from '../_lib/seed-actions'
import { AiSettings } from './_components/ai-settings'
import { DangerAction } from './_components/danger-action'
import { DataBackup } from './_components/data-backup'
import { GeneralSettings } from './_components/general-settings'
import { ImportData } from './_components/import-data'
import {
  clearAllTransactions,
  getAiConfig,
  getAiKeyStatus,
  getSettings,
  resetAllData,
} from './actions'

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const settings = await getSettings()
  const [aiConfig, aiKeyStatus] = await Promise.all([getAiConfig(), getAiKeyStatus()])

  return (
    <div className="flex flex-col gap-8 px-5 py-5 lg:px-8 lg:py-7">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Workspace preferences and data management.</p>
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg">General</h2>
          <p className="text-muted-foreground text-sm">Defaults applied across the app.</p>
        </div>
        <Card>
          <CardContent className="p-5">
            <GeneralSettings settings={settings} />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg">AI</h2>
          <p className="text-muted-foreground text-sm">
            Optional. Power auto-categorising, insights and the tax helper with a local model or
            your own cloud key. Off by default — nothing is sent anywhere until you turn it on.
          </p>
        </div>
        <Card>
          <CardContent className="p-5">
            <AiSettings
              config={{ ...aiConfig, anthropicApiKey: undefined }}
              keyStatus={aiKeyStatus}
            />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg">Backup</h2>
          <p className="text-muted-foreground text-sm">
            Export everything to a file. Your data lives on this device — keep a backup so it&apos;s
            safe across updates and machines. Restoring a backup lives in the Danger zone below.
          </p>
        </div>
        <Card>
          <CardContent className="p-5">
            <DataBackup />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-destructive text-lg">Danger zone</h2>
          <p className="text-muted-foreground text-sm">
            Destructive actions. Each requires typing a confirmation phrase.
          </p>
        </div>
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col gap-5 p-5">
            <ImportData />
            <div className="h-px bg-border" />
            <DangerAction
              title="Clear all transactions"
              description="Removes every imported transaction and import batch. Banks, accounts, mappings, categories and tags are kept — useful before re-importing."
              buttonLabel="Clear transactions"
              confirmPhrase="CLEAR"
              action={clearAllTransactions}
            />
            <div className="h-px bg-border" />
            <DangerAction
              title="Reset all data"
              description="Deletes ALL banks, accounts, transactions, mappings, categories, tags and subscriptions in this workspace."
              buttonLabel="Reset everything"
              confirmPhrase="RESET"
              action={resetAllData}
            />
            <div className="h-px bg-border" />
            <DangerAction
              title="Reset & load demo data"
              description="Deletes everything, then loads a realistic sample dataset — two accounts, categories and a few months of transactions — so you can explore the app."
              buttonLabel="Reset & load demo"
              confirmPhrase="DEMO"
              action={resetAndSeedDemo}
              successTemplate="Loaded demo data — {n} transactions."
            />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
