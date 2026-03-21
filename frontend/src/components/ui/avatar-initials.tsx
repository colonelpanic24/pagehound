import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  name: string
  photoUrl: string | null | undefined
  size?: 'sm' | 'lg'
  className?: string
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function AvatarWithInitials({ name, photoUrl, size = 'sm', className }: Props) {
  const [imgError, setImgError] = useState(false)

  const sizeClass = size === 'lg' ? 'h-20 w-20' : 'h-8 w-8'
  const textClass = size === 'lg' ? 'text-2xl' : 'text-xs'

  if (photoUrl && !imgError) {
    return (
      <img
        src={photoUrl}
        alt={name}
        onError={() => setImgError(true)}
        className={cn(sizeClass, 'rounded-full object-cover shrink-0', className)}
      />
    )
  }
  return (
    <div className={cn(sizeClass, 'rounded-full bg-muted flex items-center justify-center shrink-0', className)}>
      <span className={cn(textClass, 'font-medium text-muted-foreground')}>{initials(name)}</span>
    </div>
  )
}
