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
});
