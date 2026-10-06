import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// RTL's automatic cleanup relies on a global afterEach, which does not exist
// when Vitest runs without `globals: true`. Register it explicitly so each test
// starts with an empty document.
afterEach(() => {
  cleanup();
});
