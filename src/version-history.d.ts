import type { VersionHistory } from './types'

declare module '../version-history.json' {
  const value: VersionHistory[]
  export default value
}