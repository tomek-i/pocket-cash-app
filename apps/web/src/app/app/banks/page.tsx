import { Button, Card } from '@repo/ui'
import { Landmark, Plus } from 'lucide-react'
import { BankCard } from './_components/bank-card'
import { BankDialog } from './_components/bank-dialog'
import { listBanks } from './actions'

export const metadata = { title: 'Banks' }

export default async function BanksPage() {
  const banks = await listBanks()

  return (
    <div className="flex flex-col gap-6 px-5 py-5 lg:px-8 lg:py-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Banks</h1>
          <p className="text-muted-foreground text-sm">Institutions you hold accounts with.</p>
        </div>
        <BankDialog
          trigger={
            <Button className="gap-2">
              <Plus className="size-4" />
              Add bank
            </Button>
          }
        />
      </div>

      {banks.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Landmark className="size-6" />
          </div>
          <div>
            <p className="font-medium">No banks yet</p>
            <p className="text-muted-foreground text-sm">
              Add your first institution to start tracking accounts.
            </p>
          </div>
          <BankDialog
            trigger={
              <Button className="gap-2">
                <Plus className="size-4" />
                Add bank
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {banks.map((bank) => (
            <BankCard key={bank.id} bank={bank} />
          ))}
        </div>
      )}
    </div>
  )
}
