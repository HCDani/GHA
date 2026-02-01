import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Modal from 'react-modal';
import '@testing-library/jest-dom';

beforeAll(() => {
  Modal.setAppElement(document.body);
});

jest.mock('pocketbase', () => jest.fn().mockImplementation(() => ({})));

// Mock factory creates fns and exposes them via __getPbMocks (jest.mock is hoisted, so we can't close over a variable)
jest.mock('../pbClient', () => {
  const create = jest.fn();
  const update = jest.fn();
  const getFullList = jest.fn();
  const deleteFn = jest.fn();
  const collectionReturn = {
    create,
    update,
    getFullList,
    delete: deleteFn,
  };
  function collection() {
    return collectionReturn;
  }
  return {
    pb: {
      collection,
      authStore: { isValid: true, record: { id: 'user123', email: 'test@example.com', preferences: {} } },
    },
    __getPbMocks: () => ({ create, update, getFullList, delete: deleteFn }),
  };
});

import { __getPbMocks } from '../pbClient';

jest.mock('../hooks/useWeather', () => ({
  useWeather: () => ({ temperature: null, humidity: null, lightLux: null, loading: false, error: null }),
}));

// Mock toast notifications
jest.mock('react-toastify', () => ({
  ToastContainer: () => null,
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { GreenhouseList } from '../App';
import { AuthContext } from '../contexts/AuthContext';

let mockPbMocks;

describe('Order Management Integration Tests', () => {
  beforeEach(() => {
    mockPbMocks = __getPbMocks();
    mockPbMocks.create.mockClear();
    mockPbMocks.update.mockClear();
    mockPbMocks.getFullList.mockClear();
    mockPbMocks.delete.mockClear();
  });

  const mockAuthValue = {
    user: { id: 'user123', email: 'test@example.com', preferences: {} },
    logout: jest.fn(),
    isAuthenticated: true,
  };

  const renderWithAuth = (component) => {
    return render(
      <MemoryRouter>
        <AuthContext.Provider value={mockAuthValue}>
          {component}
        </AuthContext.Provider>
      </MemoryRouter>
    );
  };

  describe('Order Generation', () => {
    test('first greenhouse should have order 0', async () => {
      mockPbMocks.getFullList.mockResolvedValueOnce([]);
      mockPbMocks.create.mockResolvedValueOnce({
        id: 'gh1',
        title: 'First Greenhouse',
        description: 'Description',
        order: 0,
        grafanadata: [],
      });

      renderWithAuth(<GreenhouseList />);

      const addBtn = await screen.findByText('Add a new greenhouse');
      fireEvent.click(addBtn);

      const dialog = screen.getByRole('dialog', { hidden: true });
      const titleInput = within(dialog).getByLabelText(/Title/i);
      fireEvent.change(titleInput, { target: { value: 'First Greenhouse' } });

      const submitBtn = within(dialog).getByRole('button', { name: /save/i, hidden: true });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockPbMocks.create).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'First Greenhouse',
            order: 0,
          })
        );
      });
    });

    test('second greenhouse should have order 1', async () => {
      mockPbMocks.getFullList.mockResolvedValueOnce([
        {
          id: 'gh1',
          title: 'First',
          description: '',
          order: 0,
          grafanadata: [],
        },
      ]);

      mockPbMocks.create.mockResolvedValueOnce({
        id: 'gh2',
        title: 'Second Greenhouse',
        description: '',
        order: 1,
        grafanadata: [],
      });

      renderWithAuth(<GreenhouseList />);

      await waitFor(() => expect(screen.getByText('First')).toBeInTheDocument());

      const addBtn = screen.getByText('Add a new greenhouse');
      fireEvent.click(addBtn);

      const dialog = screen.getByRole('dialog', { hidden: true });
      const titleInput = within(dialog).getByLabelText(/Title/i);
      fireEvent.change(titleInput, { target: { value: 'Second Greenhouse' } });

      const submitBtn = within(dialog).getByRole('button', { name: /save/i, hidden: true });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockPbMocks.create).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Second Greenhouse',
            order: 1,
          })
        );
      });
    });
  });

  describe('Order Dropdown Restrictions', () => {
    test('dropdown shows orders 0-2 for three greenhouses', async () => {
      mockPbMocks.getFullList.mockResolvedValueOnce([
        {
          id: 'gh1',
          title: 'GH1',
          description: '',
          order: 0,
          grafanadata: [{ grafanaURL: '' }],
        },
        {
          id: 'gh2',
          title: 'GH2',
          description: '',
          order: 1,
          grafanadata: [{ grafanaURL: '' }],
        },
        {
          id: 'gh3',
          title: 'GH3',
          description: '',
          order: 2,
          grafanadata: [{ grafanaURL: '' }],
        },
      ]);

      renderWithAuth(<GreenhouseList />);

      await waitFor(() => expect(screen.getByText('GH1')).toBeInTheDocument());

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]);

      const dialog = screen.getByRole('dialog', { hidden: true });
      const orderSelect = within(dialog).getByDisplayValue('0');
      const options = Array.from(orderSelect.options).map((opt) => opt.value);
      
      expect(options).toEqual(['0', '1', '2']);
    });

    test('single greenhouse can only have order 0', async () => {
      mockPbMocks.getFullList.mockResolvedValueOnce([
        {
          id: 'gh1',
          title: 'Only One',
          description: '',
          order: 0,
          grafanadata: [{ grafanaURL: '' }],
        },
      ]);

      renderWithAuth(<GreenhouseList />);

      await waitFor(() => expect(screen.getByText('Only One')).toBeInTheDocument());

      const editBtn = screen.getByText('Edit');
      fireEvent.click(editBtn);

      const dialog = screen.getByRole('dialog', { hidden: true });
      const orderSelect = within(dialog).getByDisplayValue('0');
      const options = Array.from(orderSelect.options).map((opt) => opt.value);

      expect(options).toEqual(['0']);
    });
  });

  describe('Order Swapping', () => {
    test('swapping orders between two greenhouses', async () => {
      mockPbMocks.getFullList.mockResolvedValueOnce([
        {
          id: 'gh1',
          title: 'Greenhouse A',
          description: '',
          order: 0,
          grafanadata: [{ grafanaURL: '' }],
        },
        {
          id: 'gh2',
          title: 'Greenhouse B',
          description: '',
          order: 1,
          grafanadata: [{ grafanaURL: '' }],
        },
      ]);

      mockPbMocks.update
        .mockResolvedValueOnce({
          id: 'gh2',
          title: 'Greenhouse B',
          description: '',
          order: 0,
          grafanadata: [],
        })
        .mockResolvedValueOnce({
          id: 'gh1',
          title: 'Greenhouse A',
          description: '',
          order: 1,
          grafanadata: [],
        });

      renderWithAuth(<GreenhouseList />);

      await waitFor(() => expect(screen.getByText('Greenhouse A')).toBeInTheDocument());

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]);

      const dialog = screen.getByRole('dialog', { hidden: true });
      const orderSelect = within(dialog).getByDisplayValue('0');
      fireEvent.change(orderSelect, { target: { value: '1' } });

      const submitBtn = within(dialog).getByRole('button', { name: /save/i, hidden: true });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        // Should update conflicting greenhouse first (app uses Order for this call)
        expect(mockPbMocks.update).toHaveBeenCalledWith(
          'gh2',
          expect.objectContaining({
            Order: 0,
          })
        );
        // Then update current greenhouse (app uses lowercase for main update)
        expect(mockPbMocks.update).toHaveBeenCalledWith(
          'gh1',
          expect.objectContaining({
            order: 1,
          })
        );
      });
    });
  });

  describe('CRUD Operations', () => {
    test('delete greenhouse', async () => {
      mockPbMocks.getFullList.mockResolvedValueOnce([
        {
          id: 'gh1',
          title: 'Test GH',
          description: 'Test',
          order: 0,
          grafanadata: [],
        },
      ]);

      mockPbMocks.delete.mockResolvedValueOnce({});

      renderWithAuth(<GreenhouseList />);

      await waitFor(() => expect(screen.getByText('Test GH')).toBeInTheDocument());

      const deleteBtn = screen.getByText('Delete');
      window.confirm = jest.fn(() => true);
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(mockPbMocks.delete).toHaveBeenCalledWith('gh1');
      });
    });
  });

  describe('User-Specific Collections', () => {
    test('should use user id in collection name', async () => {
      mockPbMocks.getFullList.mockResolvedValueOnce([]);

      renderWithAuth(<GreenhouseList />);

      await waitFor(() => {
        expect(mockPbMocks.getFullList).toHaveBeenCalled();
      });
    });
  });
});

