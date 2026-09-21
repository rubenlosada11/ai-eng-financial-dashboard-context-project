import { Component, type ReactNode } from 'react'

interface ChartsErrorBoundaryProps {
  children: ReactNode
}

interface ChartsErrorBoundaryState {
  hasError: boolean
}

// The charts are lazy-loaded: if their chunk fails to load, keep the header and KPIs alive.
export class ChartsErrorBoundary extends Component<
  ChartsErrorBoundaryProps,
  ChartsErrorBoundaryState
> {
  state: ChartsErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ChartsErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-foreground xl:col-span-2"
        >
          Charts could not be loaded. Reload the page to try again.
        </div>
      )
    }
    return this.props.children
  }
}
