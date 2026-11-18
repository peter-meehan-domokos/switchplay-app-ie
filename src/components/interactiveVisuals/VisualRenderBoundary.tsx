"use client";

import { Component, type ReactNode } from "react";

export default class VisualRenderBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? <p role="alert">Interactive visual unavailable. Your saved work is kept.</p> : this.props.children; }
}
