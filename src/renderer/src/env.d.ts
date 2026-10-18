import type { TangerineApi } from '@shared/api'

declare global {
  interface Window {
    tangerine: TangerineApi
  }
}
export {}
