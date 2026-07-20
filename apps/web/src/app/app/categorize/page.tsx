import { isAiConfigured } from '../settings/actions'
import { CategorizeReview } from './_components/categorize-review'

export const metadata = { title: 'Categorise' }

export default async function CategorizePage() {
  const aiConfigured = await isAiConfigured()

  return (
    <div className="flex flex-col gap-6 px-5 py-5 lg:px-8 lg:py-7">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Categorise</h1>
        <p className="text-muted-foreground text-sm">
          Suggestions for your uncategorised transactions — learned from your own history, and
          {aiConfigured ? ' topped up by AI' : ' AI when you enable it in Settings'}. Review, tweak,
          then apply.
        </p>
      </div>
      <CategorizeReview aiConfigured={aiConfigured} />
    </div>
  )
}
