import React from 'react';
import { render } from '@testing-library/react';

// Render helper that avoids React.StrictMode double invocation in tests needing stable effects
export function renderNoStrict(ui, options) {
  return render(ui, { ...options });
}
