import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from 'react-modal';
import AddGreenhouseModal from '../AddGreenhouseModal';

beforeAll(() => {
  Modal.setAppElement(document.body);
});

describe('AddGreenhouseModal', () => {
  test('calls onSave with data when valid', async () => {
    const user = userEvent;
    const onSave = jest.fn();
    const onClose = jest.fn();

    render(<AddGreenhouseModal open={true} onClose={onClose} onSave={onSave} initial={{}} />);

    const dialog = screen.getByRole('dialog', { hidden: true });
    const titleInput = within(dialog).getByLabelText(/Title/i);
    const grafanaInput = within(dialog).getByPlaceholderText(/Paste iframe tag or src URL/i);
    const saveBtn = within(dialog).getByRole('button', { name: /save/i, hidden: true });

    await user.type(titleInput, 'My GH');
    await user.type(grafanaInput, 'https://example.com/panel?panelId=1');
    await user.click(saveBtn);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'My GH',
        grafanadata: expect.arrayContaining([
          expect.objectContaining({
            grafanaURL: expect.stringContaining('https://example.com/panel'),
            panel_width: 350,
            panel_height: 200,
          }),
        ]),
      })
    );
  });

  test('shows validation error when title is empty', async () => {
    const user = userEvent;
    const onSave = jest.fn();

    render(<AddGreenhouseModal open={true} onClose={jest.fn()} onSave={onSave} initial={{}} />);

    const dialog = screen.getByRole('dialog', { hidden: true });
    const saveBtn = within(dialog).getByRole('button', { name: /save/i, hidden: true });
    await user.click(saveBtn);

    expect(within(dialog).getByText(/Title is required/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  test('edit mode shows initial values and Edit greenhouse header', () => {
    const initial = {
      id: 'gh1',
      title: 'Existing GH',
      description: 'A description',
      order: 1,
      grafanadata: [{ grafanaURL: 'https://grafana.example.com/panel' }],
    };

    render(
      <AddGreenhouseModal
        open={true}
        onClose={jest.fn()}
        onSave={jest.fn()}
        initial={initial}
        availableOrders={[0, 1, 2]}
      />
    );

    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(screen.getByText('Edit greenhouse')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Title/i)).toHaveValue('Existing GH');
    expect(within(dialog).getByLabelText(/Description \(max 100 characters\)/i)).toHaveValue('A description');
    expect(within(dialog).getByDisplayValue('1')).toBeInTheDocument();
    const grafanaInput = within(dialog).getByPlaceholderText(/Paste iframe tag or src URL/i);
    expect(grafanaInput).toHaveValue('https://grafana.example.com/panel');
  });

  test('shows invalid URL error when Grafana URL does not normalize', async () => {
    const user = userEvent;
    const onSave = jest.fn();

    render(<AddGreenhouseModal open={true} onClose={jest.fn()} onSave={onSave} initial={{}} />);

    const dialog = screen.getByRole('dialog', { hidden: true });
    const titleInput = within(dialog).getByLabelText(/Title/i);
    const grafanaInput = within(dialog).getByPlaceholderText(/Paste iframe tag or src URL/i);
    await user.type(titleInput, 'My GH');
    await user.type(grafanaInput, 'not-a-valid-url');
    await user.click(within(dialog).getByRole('button', { name: /save/i, hidden: true }));

    expect(within(dialog).getByText(/Invalid URL\. Paste the iframe src or a full URL\./i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  test('Cancel button calls onClose', async () => {
    const user = userEvent;
    const onClose = jest.fn();

    render(<AddGreenhouseModal open={true} onClose={onClose} onSave={jest.fn()} initial={{}} />);

    const dialog = screen.getByRole('dialog', { hidden: true });
    await user.click(within(dialog).getByRole('button', { name: /cancel/i, hidden: true }));

    expect(onClose).toHaveBeenCalled();
  });

  test('description textarea has maxLength 100 and label mentions max 100 characters', () => {
    render(<AddGreenhouseModal open={true} onClose={jest.fn()} onSave={jest.fn()} initial={{}} />);

    const dialog = screen.getByRole('dialog', { hidden: true });
    const descField = within(dialog).getByLabelText(/Description \(max 100 characters\)/i);
    expect(descField).toHaveAttribute('maxlength', '100');
  });
});
