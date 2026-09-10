import type { Tag } from '@repo/database'
import { Badge } from '@repo/ui'

/**
 * How a tag looks, in one place.
 *
 * Tags carry a colour and were rendered with it once applied but as plain text
 * in every picker, so the list you chose from looked nothing like the result.
 * Both readings live here now: a pill where a tag is displayed as a value, and a
 * swatch where it is one line in a menu.
 *
 * A tag with no colour falls back to the neutral badge, which is what an
 * uncoloured tag has always looked like.
 */

export type TagLike = Pick<Tag, 'id' | 'name' | 'color'>

/** A tag shown as a value: the applied-tag badge. */
export function TagPill({ tag }: { tag: TagLike }) {
  return (
    <Badge
      variant="secondary"
      style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
    >
      {tag.name}
    </Badge>
  )
}

/**
 * A tag shown as a choice: a colour dot beside the name.
 *
 * A dot rather than a full pill, because these sit in menu rows next to a
 * checkbox and a row of pills reads as a jumble. The colour is the part that has
 * to match what you get.
 */
export function TagSwatch({ tag }: { tag: TagLike }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full border"
        style={
          tag.color
            ? { backgroundColor: tag.color, borderColor: tag.color }
            : { borderColor: 'var(--color-border)' }
        }
      />
      <span className="truncate">{tag.name}</span>
    </span>
  )
}
