import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import LoginForm from '../../src/components/auth/LoginForm'
import StoreList from '../../src/components/stores/StoreList'
import CreateStoreForm from '../../src/components/stores/CreateStoreForm'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn()
}))

// Mock fetch globally
global.fetch = jest.fn()

const mockPush = jest.fn()
const mockRouter = {
  push: mockPush,
  replace: jest.fn(),
  back: jest.fn()
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(useRouter as jest.MockedFunction<typeof useRouter>).mockReturnValue(mockRouter)
  ;(global.fetch as jest.MockedFunction<typeof fetch>).mockClear()
})

describe('LoginForm Component', () => {
  test('renders login form elements', () => {
    render(<LoginForm />)
    
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  test('shows validation errors for empty fields', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    await user.click(submitButton)
    
    expect(screen.getByText(/username is required/i)).toBeInTheDocument()
    expect(screen.getByText(/password is required/i)).toBeInTheDocument()
  })

  test('submits form with valid credentials', async () => {
    const user = userEvent.setup()
    
    ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    } as Response)
    
    render(<LoginForm />)
    
    const usernameInput = screen.getByLabelText(/username/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    await user.type(usernameInput, 'admin')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'password123' })
      })
    })
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/dashboard')
    })
  })

  test('shows error message for invalid credentials', async () => {
    const user = userEvent.setup()
    
    ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid credentials' })
    } as Response)
    
    render(<LoginForm />)
    
    const usernameInput = screen.getByLabelText(/username/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    await user.type(usernameInput, 'admin')
    await user.type(passwordInput, 'wrongpassword')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })
  })

  test('toggles password visibility', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement
    const toggleButton = screen.getByRole('button', { name: /toggle password visibility/i })
    
    expect(passwordInput.type).toBe('password')
    
    await user.click(toggleButton)
    expect(passwordInput.type).toBe('text')
    
    await user.click(toggleButton)
    expect(passwordInput.type).toBe('password')
  })

  test('disables form during submission', async () => {
    const user = userEvent.setup()
    
    // Make fetch hang to simulate loading state
    ;(global.fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(
      () => new Promise(() => {}) // Never resolves
    )
    
    render(<LoginForm />)
    
    const usernameInput = screen.getByLabelText(/username/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    await user.type(usernameInput, 'admin')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(submitButton).toBeDisabled()
      expect(screen.getByText(/signing in/i)).toBeInTheDocument()
    })
  })
})

describe('StoreList Component', () => {
  const mockStores = [
    {
      id: 'store-1',
      name: 'Test Store 1',
      email: 'store1@test.com',
      qr_codes_count: 5,
      active_qr_codes: 3,
      total_verifications: 100,
      sync_status: 'synced',
      online_status: 'online',
      performance_score: 95,
      created_at: '2023-01-01T00:00:00Z'
    },
    {
      id: 'store-2',
      name: 'Test Store 2',
      email: 'store2@test.com',
      qr_codes_count: 2,
      active_qr_codes: 1,
      total_verifications: 50,
      sync_status: 'pending',
      online_status: 'offline',
      performance_score: 75,
      created_at: '2023-01-02T00:00:00Z'
    }
  ]

  test('renders store list with data', async () => {
    ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStores
    } as Response)
    
    render(<StoreList />)
    
    await waitFor(() => {
      expect(screen.getByText('Test Store 1')).toBeInTheDocument()
      expect(screen.getByText('Test Store 2')).toBeInTheDocument()
      expect(screen.getByText('store1@test.com')).toBeInTheDocument()
      expect(screen.getByText('store2@test.com')).toBeInTheDocument()
    })
  })

  test('shows loading state initially', () => {
    ;(global.fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(
      () => new Promise(() => {}) // Never resolves
    )
    
    render(<StoreList />)
    
    expect(screen.getByText(/loading stores/i)).toBeInTheDocument()
  })

  test('shows error state when fetch fails', async () => {
    ;(global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
      new Error('Network error')
    )
    
    render(<StoreList />)
    
    await waitFor(() => {
      expect(screen.getByText(/failed to load stores/i)).toBeInTheDocument()
    })
  })

  test('filters stores by search term', async () => {
    const user = userEvent.setup()
    
    ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStores
    } as Response)
    
    render(<StoreList />)
    
    await waitFor(() => {
      expect(screen.getByText('Test Store 1')).toBeInTheDocument()
      expect(screen.getByText('Test Store 2')).toBeInTheDocument()
    })
    
    const searchInput = screen.getByPlaceholderText(/search stores/i)
    await user.type(searchInput, 'Store 1')
    
    expect(screen.getByText('Test Store 1')).toBeInTheDocument()
    expect(screen.queryByText('Test Store 2')).not.toBeInTheDocument()
  })

  test('filters stores by status', async () => {
    const user = userEvent.setup()
    
    ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockStores
    } as Response)
    
    render(<StoreList />)
    
    await waitFor(() => {
      expect(screen.getByText('Test Store 1')).toBeInTheDocument()
      expect(screen.getByText('Test Store 2')).toBeInTheDocument()
    })
    
    const statusFilter = screen.getByDisplayValue(/all statuses/i)
    await user.selectOptions(statusFilter, 'online')
    
    expect(screen.getByText('Test Store 1')).toBeInTheDocument()
    expect(screen.queryByText('Test Store 2')).not.toBeInTheDocument()
  })

  test('navigates to create store page', async () => {
    const user = userEvent.setup()
    
    ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => []
    } as Response)
    
    render(<StoreList />)
    
    const createButton = screen.getByRole('button', { name: /create store/i })
    await user.click(createButton)
    
    expect(mockPush).toHaveBeenCalledWith('/admin/stores/create')
  })
})

describe('CreateStoreForm Component', () => {
  test('renders form fields', () => {
    render(<CreateStoreForm />)
    
    expect(screen.getByLabelText(/store name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/physical address/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create store/i })).toBeInTheDocument()
  })

  test('shows validation errors for required fields', async () => {
    const user = userEvent.setup()
    render(<CreateStoreForm />)
    
    const submitButton = screen.getByRole('button', { name: /create store/i })
    await user.click(submitButton)
    
    expect(screen.getByText(/store name is required/i)).toBeInTheDocument()
    expect(screen.getByText(/email is required/i)).toBeInTheDocument()
  })

  test('validates email format', async () => {
    const user = userEvent.setup()
    render(<CreateStoreForm />)
    
    const nameInput = screen.getByLabelText(/store name/i)
    const emailInput = screen.getByLabelText(/email address/i)
    const submitButton = screen.getByRole('button', { name: /create store/i })
    
    await user.type(nameInput, 'Test Store')
    await user.type(emailInput, 'invalid-email')
    await user.click(submitButton)
    
    expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument()
  })

  test('validates Swedish phone number format', async () => {
    const user = userEvent.setup()
    render(<CreateStoreForm />)
    
    const nameInput = screen.getByLabelText(/store name/i)
    const emailInput = screen.getByLabelText(/email address/i)
    const phoneInput = screen.getByLabelText(/phone number/i)
    const submitButton = screen.getByRole('button', { name: /create store/i })
    
    await user.type(nameInput, 'Test Store')
    await user.type(emailInput, 'test@example.com')
    await user.type(phoneInput, '123-456-7890') // Invalid Swedish format
    await user.click(submitButton)
    
    expect(screen.getByText(/please enter a valid swedish phone number/i)).toBeInTheDocument()
  })

  test('formats phone number while typing', async () => {
    const user = userEvent.setup()
    render(<CreateStoreForm />)
    
    const phoneInput = screen.getByLabelText(/phone number/i) as HTMLInputElement
    
    await user.type(phoneInput, '+46701234567')
    
    expect(phoneInput.value).toBe('+46 70 123 45 67')
  })

  test('submits form with valid data', async () => {
    const user = userEvent.setup()
    
    ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'store-123', name: 'Test Store' })
    } as Response)
    
    render(<CreateStoreForm />)
    
    const nameInput = screen.getByLabelText(/store name/i)
    const emailInput = screen.getByLabelText(/email address/i)
    const phoneInput = screen.getByLabelText(/phone number/i)
    const addressInput = screen.getByLabelText(/physical address/i)
    const submitButton = screen.getByRole('button', { name: /create store/i })
    
    await user.type(nameInput, 'Test Store')
    await user.type(emailInput, 'test@example.com')
    await user.type(phoneInput, '+46701234567')
    await user.type(addressInput, '123 Test Street, Stockholm, 12345')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Store',
          email: 'test@example.com',
          phone_number: '+46 70 123 45 67',
          physical_address: '123 Test Street, Stockholm, 12345'
        })
      })
    })
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/stores/store-123')
    })
  })

  test('shows error for duplicate email', async () => {
    const user = userEvent.setup()
    
    ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ message: 'Email already exists' })
    } as Response)
    
    render(<CreateStoreForm />)
    
    const nameInput = screen.getByLabelText(/store name/i)
    const emailInput = screen.getByLabelText(/email address/i)
    const submitButton = screen.getByRole('button', { name: /create store/i })
    
    await user.type(nameInput, 'Test Store')
    await user.type(emailInput, 'existing@example.com')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/a store with this email already exists/i)).toBeInTheDocument()
    })
  })

  test('disables form during submission', async () => {
    const user = userEvent.setup()
    
    ;(global.fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(
      () => new Promise(() => {}) // Never resolves
    )
    
    render(<CreateStoreForm />)
    
    const nameInput = screen.getByLabelText(/store name/i)
    const emailInput = screen.getByLabelText(/email address/i)
    const submitButton = screen.getByRole('button', { name: /create store/i })
    
    await user.type(nameInput, 'Test Store')
    await user.type(emailInput, 'test@example.com')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(submitButton).toBeDisabled()
      expect(screen.getByText(/creating/i)).toBeInTheDocument()
    })
  })

  test('navigates back to stores list on cancel', async () => {
    const user = userEvent.setup()
    render(<CreateStoreForm />)
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)
    
    expect(mockPush).toHaveBeenCalledWith('/admin/stores')
  })
})