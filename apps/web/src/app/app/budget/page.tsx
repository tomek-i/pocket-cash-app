import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui'
import { Pencil, PiggyBank, Plus, Trash2 } from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { prepareEmbeddedDatabase } from '@/lib/workspace'
import { ConfirmDeleteDialog } from '../banks/[bankId]/_components/confirm-delete-dialog'
import { BucketPlanner } from './_components/bucket-planner'
import { CategoryAssignmentDialog } from './_components/category-assignment-dialog'
import { IncomeDialog } from './_components/income-dialog'
import { PresetPicker } from './_components/preset-picker'
import { deleteBudgetIncome, getBudgetPlan } from './actions'

export const metadata = { title: 'Budget' }

export default async function BudgetPage() {
  // The layout's DB prep does not gate this page's queries (they render
  // concurrently), so wait for the embedded database before reading from it.
  await prepareEmbeddedDatabase()
  const plan = await getBudgetPlan()
  const { currency } = plan
  // Remount the dials whenever the saved split changes, so a preset or an added
  // bucket replaces whatever the dials were holding.
  const plannerKey = plan.buckets.map((b) => `${b.type}:${b.share}`).join(',')

  return (
    <div className="flex flex-col gap-6 px-5 py-5 lg:px-8 lg:py-7">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Budget</h1>
        <p className="text-muted-foreground text-sm">
          Set a target split of your monthly income and see what each part can cost.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Monthly income</CardTitle>
            <CardDescription>Net amounts, entered by hand.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {plan.incomes.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Add each income that lands in a month: salaries, and rent from an investment
                property.
              </p>
            ) : (
              <ul className="grid list-none gap-1 p-0">
                {plan.incomes.map((income) => (
                  <li
                    key={income.id}
                    className="flex items-center justify-between gap-2 rounded-lg py-1"
                  >
                    <span className="min-w-0 truncate text-sm">{income.name}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="mr-1 font-medium text-sm tabular-nums">
                        {formatMoney(income.amount, currency)}
                      </span>
                      <IncomeDialog
                        income={income}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label={`Edit ${income.name}`}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        }
                      />
                      <ConfirmDeleteDialog
                        action={deleteBudgetIncome}
                        hidden={{ id: income.id }}
                        title={`Delete “${income.name}”?`}
                        description="The bucket caps shrink by this amount."
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label={`Delete ${income.name}`}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        }
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <IncomeDialog
              trigger={
                <Button variant="outline" size="sm" className="w-fit gap-1">
                  <Plus className="size-3.5" />
                  Add income
                </Button>
              }
            />
            <div className="flex items-baseline justify-between border-t pt-3">
              <span className="text-muted-foreground text-sm">Total</span>
              <span className="font-semibold text-lg tabular-nums">
                {formatMoney(plan.totalIncome, currency)}
                <span className="font-normal text-muted-foreground text-sm"> / month</span>
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="grid min-w-0 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Preset</CardTitle>
            </CardHeader>
            <CardContent>
              <PresetPicker current={plan.preset} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Buckets</CardTitle>
              <CardDescription>
                Drag a dial and the others make room, so the split always adds up to 100%.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {plan.buckets.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <PiggyBank className="size-6" />
                  </div>
                  <p className="text-muted-foreground text-sm">
                    No plan yet. Pick a preset above to start.
                  </p>
                </div>
              ) : (
                <BucketPlanner
                  key={plannerKey}
                  buckets={plan.buckets}
                  availableTypes={plan.availableTypes}
                  categories={plan.categories}
                  totalIncome={plan.totalIncome}
                  currency={currency}
                />
              )}
            </CardContent>
          </Card>

          {plan.buckets.length > 0 && plan.unbudgeted.length > 0 ? (
            <Card className="border-chart-3/50 bg-chart-3/5">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">
                    Unbudgeted: {plan.unbudgeted.length}{' '}
                    {plan.unbudgeted.length === 1 ? 'category is' : 'categories are'} not in any
                    bucket
                  </p>
                  <p className="line-clamp-2 text-muted-foreground text-sm">
                    {plan.unbudgeted.map((category) => category.name).join(', ')}
                  </p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    Put each in a bucket, or mark income and transfers as Not spending.
                  </p>
                </div>
                <CategoryAssignmentDialog
                  categories={plan.categories}
                  buckets={plan.buckets}
                  unbudgetedOnly
                  trigger={
                    <Button variant="outline" size="sm">
                      Assign
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
