// PROTOTYPE route (ticket #6). Loads the prototype lazily and behind an error boundary so a
// failure in it (e.g. Skia) shows its stack here instead of breaking the whole tab bar.
import { Component, type ReactNode } from 'react';
import { ScrollView, Text } from 'react-native';

function ErrorText({ err }: { err: unknown }) {
  const e = err as Error;
  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 80 }}>
      <Text selectable style={{ fontFamily: 'monospace', fontSize: 11 }}>
        {String(e?.stack ?? e)}
      </Text>
    </ScrollView>
  );
}

class Boundary extends Component<{ children: ReactNode }, { err: unknown }> {
  state = { err: null as unknown };
  static getDerivedStateFromError(err: unknown) {
    return { err };
  }
  componentDidCatch(err: Error) {
    console.error('[proto] render failed:', err?.stack ?? err);
  }
  render() {
    return this.state.err ? <ErrorText err={this.state.err} /> : this.props.children;
  }
}

export default function PrototypePageRenderingRoute() {
  let Screen: React.ComponentType;
  try {
    Screen = require('@/prototype/page-rendering/screen').default;
  } catch (e) {
    console.error('[proto] failed to load prototype:', (e as Error)?.stack ?? e);
    return <ErrorText err={e} />;
  }
  return (
    <Boundary>
      <Screen />
    </Boundary>
  );
}
