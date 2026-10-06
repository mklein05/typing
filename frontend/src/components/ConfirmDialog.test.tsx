import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import ConfirmDialog from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing while closed', () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="Prestige?"
        message="Reset."
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows the title and message when open', () => {
    render(
      <ConfirmDialog
        open
        title="Prestige?"
        message="You will reset."
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Prestige?')).toBeDefined();
    expect(screen.getByText('You will reset.')).toBeDefined();
  });

  it('calls onConfirm from the confirm button', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="T"
        message="M"
        confirmLabel="Yes"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    );
    fireEvent.click(screen.getByText('Yes'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel from the cancel button', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="T"
        message="M"
        cancelLabel="No"
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText('No'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel on Escape', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="T" message="M" onConfirm={() => {}} onCancel={onCancel} />
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
