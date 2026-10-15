import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode; onError?: () => void }, { err?: Error }> {
  state: { err?: Error } = {};
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { console.error('[GLOBA]', err); this.props.onError?.(); }
  render() {
    if (!this.state.err) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="card pad stack" style={{ maxWidth: 460 }} role="alert">
          <h2>Something went off course</h2>
          <p className="muted">Your saved places and itineraries are stored safely in this browser. Reloading usually fixes this.</p>
          <code className="small muted" style={{ wordBreak: 'break-word' }}>{this.state.err.message}</code>
          <div className="row"><button className="btn primary" onClick={() => location.reload()}>Reload</button>
            <button className="btn" onClick={() => this.setState({ err: undefined })}>Try again</button></div>
        </div>
      </div>
    );
  }
}
