import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import XpBadge from './XpBadge';

// Defaults in the component: size 34, stroke 3 -> side 31, perimeter 124.
const PERIMETER = 4 * (34 - 3);

function progressRect(container: HTMLElement): SVGRectElement {
  const rects = container.querySelectorAll('rect');
  return rects[1] as SVGRectElement;
}

describe('XpBadge', () => {
  it('shows the level without a prestige numeral at zero', () => {
    const { container } = render(<XpBadge level={7} prestige={0} pct={0} />);
    expect(screen.getByText('7')).toBeDefined();
    expect(container.textContent).toBe('7');
  });

  it('shows the prestige numeral alongside the level', () => {
    render(<XpBadge level={12} prestige={4} pct={50} />);
    expect(screen.getByText('IV')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();
  });

  it('maps the progress percentage onto the outline offset', () => {
    const { container } = render(<XpBadge level={1} pct={50} />);
    expect(Number(progressRect(container).getAttribute('stroke-dashoffset'))).toBe(PERIMETER / 2);
  });

  it('clamps the percentage into 0..100', () => {
    const over = render(<XpBadge level={1} pct={150} />);
    expect(Number(progressRect(over.container).getAttribute('stroke-dashoffset'))).toBe(0);

    const under = render(<XpBadge level={1} pct={-20} />);
    expect(Number(progressRect(under.container).getAttribute('stroke-dashoffset'))).toBe(PERIMETER);
  });
});
