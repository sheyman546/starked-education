import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

class GradingService {
  async getSubmissionGrade(submissionId) {
    const response = await axios.get(`${API_BASE_URL}/grading/submission/${submissionId}`);
    return response;
  }

  async createGrade(submissionId, gradeData) {
    const response = await axios.post(
      `${API_BASE_URL}/grading/submission/${submissionId}`,
      gradeData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    return response;
  }

  async updateGrade(gradeId, gradeData) {
    const response = await axios.put(
      `${API_BASE_URL}/grading/${gradeId}`,
      gradeData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    return response;
  }

  async applyPenalty(gradeId, penaltyData) {
    const response = await axios.post(`${API_BASE_URL}/grading/${gradeId}/penalty`, penaltyData);
    return response;
  }

  async applyBonus(gradeId, bonusData) {
    const response = await axios.post(`${API_BASE_URL}/grading/${gradeId}/bonus`, bonusData);
    return response;
  }

  async releaseGrade(gradeId) {
    const response = await axios.post(`${API_BASE_URL}/grading/${gradeId}/release`);
    return response;
  }

  async scheduleGradeRelease(gradeId, releaseDate) {
    const response = await axios.post(`${API_BASE_URL}/grading/${gradeId}/schedule-release`, {
      releaseDate
    });
    return response;
  }

  async bulkGrading(operationData) {
    const response = await axios.post(`${API_BASE_URL}/grading/bulk`, operationData);
    return response;
  }

  async getGradingAnalytics(assignmentId) {
    const response = await axios.get(`${API_BASE_URL}/grading/assignment/${assignmentId}/analytics`);
    return response;
  }
}

export default new GradingService();
