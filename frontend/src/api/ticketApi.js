import { TICKET_API, getAuthHeaders } from '../config';

/**
 * Helper function to safely parse JSON response
 * @param {Response} response - Fetch response
 * @returns {Promise<Object>} Parsed JSON or error message
 */
const safeJsonParse = async (response) => {
  try {
    const text = await response.text();
    // Check if response is HTML (common when backend is down)
    if (text.trim().toLowerCase().startsWith('<!doctype') || text.trim().toLowerCase().startsWith('<html')) {
      throw new Error('Backend server is not available. Please ensure the API server is running.');
    }
    return JSON.parse(text);
  } catch (error) {
    if (error.message.includes('Backend server')) {
      throw error;
    }
    throw new Error('Invalid response from server. Expected JSON but received: ' + (text?.substring(0, 100) || 'empty response'));
  }
};

/**
 * Ticket API Service
 * Handles all ticket-related API calls
 */

export const ticketApi = {
  /**
   * Create a new ticket
   * @param {Object} ticketData - Ticket creation data
   * @returns {Promise<Object>} Created ticket
   */
  createTicket: async (ticketData) => {
    try {
      const response = await fetch(TICKET_API.CREATE, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(ticketData)
      });

      if (!response.ok) {
        const error = await safeJsonParse(response);
        throw new Error(error.detail || error.message || 'Failed to create ticket');
      }

      return await safeJsonParse(response);
    } catch (error) {
      console.error('Create ticket error:', error);
      throw error;
    }
  },

  /**
   * Get all tickets (with filters)
   * @param {Object} params - Filter parameters (status, priority, page, limit)
   * @returns {Promise<Object>} Tickets list with pagination
   */
  getTickets: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.status && params.status.length > 0) {
        params.status.forEach(s => queryParams.append('status', s));
      }
      if (params.priority && params.priority.length > 0) {
        params.priority.forEach(p => queryParams.append('priority', p));
      }
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);

      // TICKET_API.LIST already has trailing slash, just append query params
      const url = `${TICKET_API.LIST}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Tickets API endpoint not found. Backend may not be configured properly.');
        }
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        }
        const errorData = await safeJsonParse(response);
        throw new Error(errorData.detail || errorData.message || 'Failed to fetch tickets');
      }

      return await safeJsonParse(response);
    } catch (error) {
      console.error('Get tickets error:', error);
      throw error;
    }
  },

  /**
   * Get user's own tickets
   * @param {Object} params - Pagination parameters
   * @returns {Promise<Object>} User's tickets
   */
  getMyTickets: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);

      const url = `${TICKET_API.MY_TICKETS}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch your tickets');
      }

      return await response.json();
    } catch (error) {
      console.error('Get my tickets error:', error);
      throw error;
    }
  },

  /**
   * Get single ticket by ID
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<Object>} Ticket details
   */
  getTicket: async (ticketId) => {
    try {
      const response = await fetch(TICKET_API.GET_TICKET(ticketId), {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch ticket');
      }

      return await response.json();
    } catch (error) {
      console.error('Get ticket error:', error);
      throw error;
    }
  },

  /**
   * Update ticket
   * @param {string} ticketId - Ticket ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated ticket
   */
  updateTicket: async (ticketId, updateData) => {
    try {
      const response = await fetch(TICKET_API.UPDATE_TICKET(ticketId), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update ticket');
      }

      return await response.json();
    } catch (error) {
      console.error('Update ticket error:', error);
      throw error;
    }
  },

  /**
   * Delete ticket
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<void>}
   */
  deleteTicket: async (ticketId) => {
    try {
      const response = await fetch(TICKET_API.DELETE_TICKET(ticketId), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to delete ticket');
      }
    } catch (error) {
      console.error('Delete ticket error:', error);
      throw error;
    }
  },

  /**
   * Add response/comment to ticket
   * @param {string} ticketId - Ticket ID
   * @param {string} message - Response message
   * @param {boolean} internal - Whether internal comment
   * @returns {Promise<Object>} Updated ticket
   */
  addResponse: async (ticketId, message, internal = false) => {
    try {
      const response = await fetch(TICKET_API.ADD_RESPONSE(ticketId), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ message, internal })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to add response');
      }

      return await response.json();
    } catch (error) {
      console.error('Add response error:', error);
      throw error;
    }
  },

  /**
   * Update ticket status
   * @param {string} ticketId - Ticket ID
   * @param {string} newStatus - New status (open, in_progress, resolved, closed)
   * @returns {Promise<Object>} Updated ticket
   */
  updateStatus: async (ticketId, newStatus) => {
    try {
      const response = await fetch(TICKET_API.UPDATE_STATUS(ticketId), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(newStatus)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update status');
      }

      return await response.json();
    } catch (error) {
      console.error('Update status error:', error);
      throw error;
    }
  },

  /**
   * Get ticket statistics (support team only)
   * @returns {Promise<Object>} Ticket statistics
   */
  getStats: async () => {
    try {
      const response = await fetch(TICKET_API.STATS, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Ticket statistics API endpoint not found.');
        }
        const errorData = await safeJsonParse(response);
        throw new Error(errorData.detail || errorData.message || 'Failed to fetch ticket statistics');
      }

      return await safeJsonParse(response);
    } catch (error) {
      console.error('Get stats error:', error);
      throw error;
    }
  }
};

export default ticketApi;
