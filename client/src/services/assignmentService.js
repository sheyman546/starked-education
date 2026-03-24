import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

class AssignmentService {
  async getAssignments(courseId, params = {}) {
    const response = await axios.get(`${API_BASE_URL}/assignments/course/${courseId}`, {
      params
    });
    return response;
  }

  async getAssignment(assignmentId) {
    const response = await axios.get(`${API_BASE_URL}/assignments/${assignmentId}`);
    return response;
  }

  async createAssignment(assignmentData) {
    const response = await axios.post(`${API_BASE_URL}/assignments`, assignmentData);
    return response;
  }

  async updateAssignment(assignmentId, assignmentData) {
    const response = await axios.put(`${API_BASE_URL}/assignments/${assignmentId}`, assignmentData);
    return response;
  }

  async deleteAssignment(assignmentId) {
    const response = await axios.delete(`${API_BASE_URL}/assignments/${assignmentId}`);
    return response;
  }

  async publishAssignment(assignmentId) {
    const response = await axios.post(`${API_BASE_URL}/assignments/${assignmentId}/publish`);
    return response;
  }

  async getAssignmentSubmissions(assignmentId, params = {}) {
    const response = await axios.get(`${API_BASE_URL}/assignments/${assignmentId}/submissions`, {
      params
    });
    return response;
  }

  async getAssignmentAnalytics(assignmentId) {
    const response = await axios.get(`${API_BASE_URL}/assignments/${assignmentId}/analytics`);
    return response;
  }
}

export default new AssignmentService();
