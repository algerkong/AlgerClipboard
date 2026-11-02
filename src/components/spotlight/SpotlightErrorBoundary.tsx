import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** When this changes after an error, the boundary resets and retries. */
  resetKey?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render errors from plugin-provided data (e.g. malformed
 * footerHints or result fields) so a single bad plugin can't unmount the
 * whole Spotlight tree and leave an empty transparent window.
 */
export class SpotlightErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Spotlight render error:", error);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
