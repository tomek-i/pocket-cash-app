// Vendored shadcn primitives live in ./components/ui (excluded from linting).
export * from './components/ui/alert-dialog'
export * from './components/ui/avatar'
export * from './components/ui/badge'
export * from './components/ui/button'
export * from './components/ui/card'
export * from './components/ui/dialog'
export * from './components/ui/dropdown-menu'
export * from './components/ui/input'
export * from './components/ui/label'
export * from './components/ui/select'
export * from './components/ui/separator'

// Custom / composite components live directly in ./components (and are linted).
// Add their re-exports below as you build them.

export { cn } from './lib/cn'
