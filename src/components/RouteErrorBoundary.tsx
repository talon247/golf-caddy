import { Component, type ReactNode } from 'react'
import * as Sentry from '@sentry/react'
import { Link } from 'react-router-dom'

interface Props {
  routeName?: string
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-bold text-[#1a1a1a]">
            Something went wrong
          </h2>
          {this.props.routeName && (
            <p className="text-sm text-gray-500">
              Error loading {this.props.routeName}
            </p>
          )}
          <p className="text-sm text-gray-600">
            An unexpected error occurred. You can try again or go back to the home screen.
          </p>
          <div className="space-y-3 pt-2">
            <button
              onClick={this.handleReset}
              className="w-full bg-[#2d5a27] text-white rounded-xl py-4 text-lg font-bold min-h-[56px] active:scale-95 transition-transform"
            >
              Try Again
            </button>
            <Link
              to="/"
              onClick={this.handleReset}
              className="block w-full border border-[#2d5a27] text-[#2d5a27] rounded-xl py-4 text-lg font-bold min-h-[56px] active:scale-95 transition-transform"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    )
  }
}
