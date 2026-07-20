import { Badge, Button, Card, CardContent } from '@repo/ui'
import { Pencil, Plus, Tag as TagIcon, Trash2 } from 'lucide-react'
import { ConfirmDeleteDialog } from '../banks/[bankId]/_components/confirm-delete-dialog'
import { TagDialog } from './_components/tag-dialog'
import { deleteTag, listTags } from './actions'

export const metadata = { title: 'Tags' }

export default async function TagsPage() {
  const tags = await listTags()

  return (
    <div className="flex flex-col gap-6 px-5 py-5 lg:px-8 lg:py-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Tags</h1>
          <p className="text-muted-foreground text-sm">
            Flexible labels you can add to transactions.
          </p>
        </div>
        <TagDialog
          trigger={
            <Button className="gap-2">
              <Plus className="size-4" />
              Add tag
            </Button>
          }
        />
      </div>

      {tags.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <TagIcon className="size-6" />
          </div>
          <div>
            <p className="font-medium">No tags yet</p>
            <p className="text-muted-foreground text-sm">
              Add tags to label transactions across categories.
            </p>
          </div>
          <TagDialog
            trigger={
              <Button className="gap-2">
                <Plus className="size-4" />
                Add tag
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-2">
          {tags.map((tag) => (
            <Card key={tag.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <Badge
                  variant="secondary"
                  className="gap-1.5"
                  style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: tag.color ?? 'currentColor' }}
                    aria-hidden
                  />
                  {tag.name}
                </Badge>
                <div className="flex shrink-0 items-center gap-1">
                  <TagDialog
                    tag={tag}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label="Edit tag">
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                  <ConfirmDeleteDialog
                    action={deleteTag}
                    hidden={{ id: tag.id }}
                    title={`Delete “${tag.name}”?`}
                    description="This removes the tag from all transactions."
                    trigger={
                      <Button variant="ghost" size="icon" aria-label="Delete tag">
                        <Trash2 className="size-4" />
                      </Button>
                    }
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
