import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

class SubmissionService {
  async getStudentSubmissions(params = {}) {
    const response = await axios.get(`${API_BASE_URL}/submissions/student`, {
      params
    });
    return response;
  }

  async getSubmission(submissionId) {
    const response = await axios.get(`${API_BASE_URL}/submissions/${submissionId}`);
    return response;
  }

  async createSubmission(assignmentId, formData) {
    const response = await axios.post(
      `${API_BASE_URL}/submissions/assignment/${assignmentId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    return response;
  }

  async updateSubmission(submissionId, formData) {
    const response = await axios.put(
      `${API_BASE_URL}/submissions/${submissionId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    return response;
  }

  async submitSubmission(submissionId) {
    const response = await axios.post(`${API_BASE_URL}/submissions/${submissionId}/submit`);
    return response;
  }

  async autoSave(submissionId, data) {
    const response = await axios.post(`${API_BASE_URL}/submissions/${submissionId}/auto-save`, data);
    return response;
  }

  async deleteSubmission(submissionId) {
    const response = await axios.delete(`${API_BASE_URL}/submissions/${submissionId}`);
    return response;
  }

  async downloadFile(submissionId, filename) {
    const response = await axios.get(
      `${API_BASE_URL}/submissions/${submissionId}/download/${filename}`,
      {
        responseType: 'blob'
      }
    );
    return response;
  }
}

export default new SubmissionService();
