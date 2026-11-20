import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep diagnostics in the browser console without exposing internals to users.
    console.error('SOOULL application render error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-error-fallback">
          <section className="app-error-card" role="alert" aria-live="assertive">
            <div className="app-error-mark" aria-hidden="true">S</div>
            <h1>SOOULL needs to reload.</h1>
            <p>Something interrupted this screen. Your saved account records are not deleted. Reload the app to try again.</p>
            <button type="button" onClick={() => window.location.reload()}>Reload SOOULL</button>
          </section>
        </main>
      )
    }
    return this.props.children
  }
}
