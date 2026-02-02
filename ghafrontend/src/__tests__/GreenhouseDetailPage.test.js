import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@testing-library/jest-dom';

jest.mock('../pbClient', () => {
  const mockGetOne = jest.fn();
  const mockUpdate = jest.fn();
  const collectionReturn = {
    getOne: mockGetOne,
    update: mockUpdate,
  };
  return {
    pb: {
      collection: () => collectionReturn,
    },
    __getMockGetOne: () => mockGetOne,
    __getMockUpdate: () => mockUpdate,
  };
});

import { __getMockGetOne, __getMockUpdate } from '../pbClient';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user123' },
  }),
}));

jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import GreenhouseDetailPage from '../pages/GreenhouseDetailPage';

function renderDetailPage(id = 'gh1') {
  return render(
    <MemoryRouter initialEntries={[`/greenhouse/${id}`]}>
      <Routes>
        <Route path="/greenhouse/:id" element={<GreenhouseDetailPage />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe = () => {};
    disconnect = () => {};
    unobserve = () => {};
  };
});

describe('GreenhouseDetailPage', () => {
  let mockGetOne;

  beforeEach(() => {
    mockGetOne = __getMockGetOne();
    mockGetOne.mockClear();
  });

  test('shows loading state initially', () => {
    mockGetOne.mockImplementation(() => new Promise(() => {}));
    renderDetailPage();
    expect(screen.getByText(/Loading greenhouse details/i)).toBeInTheDocument();
  });

  test('shows greenhouse title and order when loaded', async () => {
    mockGetOne.mockResolvedValue({
      id: 'gh1',
      title: 'My Greenhouse',
      description: 'A test greenhouse',
      order: 0,
      grafanadata: [],
    });

    renderDetailPage();
    await waitFor(() => {
      expect(screen.getByText('My Greenhouse')).toBeInTheDocument();
    });

    expect(screen.getByText(/Order: 0/)).toBeInTheDocument();
    expect(screen.getByText(/A test greenhouse/)).toBeInTheDocument();
  });

  test('shows Back to Greenhouses button', async () => {
    mockGetOne.mockResolvedValue({
      id: 'gh1',
      title: 'Test',
      description: '',
      order: 0,
      grafanadata: [],
    });

    renderDetailPage();
    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Back to Greenhouses/i })).toBeInTheDocument();
  });

  test('shows Details and Grafana Panels sections', async () => {
    mockGetOne.mockResolvedValue({
      id: 'gh1',
      title: 'GH',
      description: '',
      order: 0,
      grafanadata: [],
    });

    renderDetailPage();
    await waitFor(() => {
      expect(screen.getByText('GH')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Grafana Panels' })).toBeInTheDocument();
  });

  test('shows no panels message when grafanadata is empty', async () => {
    mockGetOne.mockResolvedValue({
      id: 'gh1',
      title: 'Empty',
      description: '',
      order: 0,
      grafanadata: [],
    });

    renderDetailPage();
    await waitFor(() => {
      expect(screen.getByText('Empty')).toBeInTheDocument();
    });

    expect(screen.getByText(/No Grafana panels added yet/i)).toBeInTheDocument();
  });

  test('renders panel iframe when grafanadata has URL', async () => {
    mockGetOne.mockResolvedValueOnce({
      id: 'gh1',
      title: 'With Panel',
      description: '',
      order: 0,
      grafanadata: [
        {
          grafanaURL: 'https://grafana.example.com/d-solo/abc?panelId=1',
          panel_width: 800,
          panel_height: 400,
        },
      ],
    });

    renderDetailPage();
    await waitFor(() => {
      expect(screen.getByText('With Panel')).toBeInTheDocument();
    });

    const iframe = screen.getByTitle('panel-0');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute(
      'src',
      'https://grafana.example.com/d-solo/abc?panelId=1'
    );
  });

  test('calls getOne with id', async () => {
    mockGetOne.mockResolvedValue({
      id: 'gh1',
      title: 'GH',
      description: '',
      order: 0,
      grafanadata: [],
    });

    renderDetailPage('gh1');
    await waitFor(() => {
      expect(screen.getByText('GH')).toBeInTheDocument();
    });

    expect(mockGetOne).toHaveBeenCalledWith('gh1');
  });

  test('edit form has Title and Description inputs and Save button', async () => {
    mockGetOne.mockResolvedValue({
      id: 'gh1',
      title: 'Original',
      description: 'Original desc',
      order: 0,
      grafanadata: [],
    });

    renderDetailPage('gh1');
    await waitFor(() => expect(screen.getByText('Original')).toBeInTheDocument());

    const editBtn = screen.getByRole('button', { name: 'Edit' });
    await userEvent.click(editBtn);

    await waitFor(() => expect(screen.getByLabelText(/Title/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/Title/i)).toHaveValue('Original');
    expect(screen.getByLabelText(/Description \(max 100 characters\)/i)).toHaveValue('Original desc');
    expect(screen.getByRole('button', { name: /^Save$/i })).toBeInTheDocument();
  });
});
