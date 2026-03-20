import { useFormats, useLanguages } from '@/hooks/useLibrary'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { BookFilters } from '@/types'

interface Props {
  filters: BookFilters
  onChange: (f: BookFilters) => void
}

export function FilterSidebar({ filters, onChange }: Props) {
  const { formats } = useFormats()
  const { languages } = useLanguages()

  function toggleFormat(fmt: string) {
    onChange({ ...filters, format: filters.format === fmt ? undefined : fmt })
  }

  function toggleLanguage(lang: string) {
    onChange({ ...filters, language: filters.language === lang ? undefined : lang })
  }

  function setReadStatus(value: boolean | undefined) {
    onChange({ ...filters, is_read: value })
  }

  function clearAll() {
    onChange({})
  }

  const hasActiveFilters =
    filters.format !== undefined ||
    filters.language !== undefined ||
    filters.is_read !== undefined

  return (
    <aside className="w-56 shrink-0 flex flex-col gap-5">
      {/* Format */}
      {formats.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Format
          </h3>
          <div className="flex flex-col gap-1">
            {formats.map((fmt) => (
              <label
                key={fmt}
                className="flex items-center gap-2 text-sm cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={filters.format === fmt}
                  onChange={() => toggleFormat(fmt)}
                  className={cn(
                    'h-4 w-4 rounded border border-input accent-primary cursor-pointer'
                  )}
                />
                <span className="text-foreground group-hover:text-foreground/80 uppercase text-xs font-medium">
                  {fmt}
                </span>
              </label>
            ))}
          </div>
        </section>
      )}

      {/* Language */}
      {languages.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Language
          </h3>
          <div className="flex flex-col gap-1">
            {languages.map((lang) => (
              <label
                key={lang}
                className="flex items-center gap-2 text-sm cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={filters.language === lang}
                  onChange={() => toggleLanguage(lang)}
                  className="h-4 w-4 rounded border border-input accent-primary cursor-pointer"
                />
                <span className="text-foreground group-hover:text-foreground/80 capitalize">
                  {lang}
                </span>
              </label>
            ))}
          </div>
        </section>
      )}

      {/* Read status */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Read status
        </h3>
        <div className="flex flex-col gap-1">
          {(
            [
              { label: 'All', value: undefined },
              { label: 'Read', value: true },
              { label: 'Unread', value: false },
            ] as { label: string; value: boolean | undefined }[]
          ).map(({ label, value }) => (
            <label key={label} className="flex items-center gap-2 text-sm cursor-pointer group">
              <input
                type="radio"
                name="read-status"
                checked={filters.is_read === value}
                onChange={() => setReadStatus(value)}
                className="h-4 w-4 border border-input accent-primary cursor-pointer"
              />
              <span className="text-foreground group-hover:text-foreground/80">{label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Clear */}
      {hasActiveFilters && (
        <Button variant="outline" size="sm" onClick={clearAll} className="w-full">
          Clear all filters
        </Button>
      )}
    </aside>
  )
}
