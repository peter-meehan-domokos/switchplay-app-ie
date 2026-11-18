"use client";

import { Component, type ReactNode } from "react";

/** Any import, render or effect failure in onboarding disappears quietly; the application is never affected. */
export default class OnboardingErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}
