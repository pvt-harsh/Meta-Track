import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error("Unhandled UI error:", error); }
  retry = () => this.setState({ failed: false });
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="auth-page">
        <div className="auth-card" role="alert">
          <h1>Something broke</h1>
          <p className="auth-sub">MetaTrack hit an unexpected problem. Your saved data is safe.</p>
          <button type="button" className="btn btn-primary btn-block" onClick={this.retry}>Try again</button>
          <div style={{ height: 10 }} />
          <button type="button" className="btn btn-block" onClick={() => window.location.assign("/")}>Back to homepage</button>
        </div>
      </div>
    );
  }
}
