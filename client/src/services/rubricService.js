import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

class RubricService {
  async getCourseRubrics(courseId, params = {}) {
    const response = await axios.get(`${API_BASE_URL}/rubrics/course/${courseId}`, {
      params
    });
    return response;
  }

  async getRubricTemplates(params = {}) {
    const response = await axios.get(`${API_BASE_URL}/rubrics/templates`, {
      params
    });
    return response;
  }

  async getRubric(rubricId) {
    const response = await axios.get(`${API_BASE_URL}/rubrics/${rubricId}`);
    return response;
  }

  async createRubric(rubricData) {
    const response = await axios.post(`${API_BASE_URL}/rubrics`, rubricData);
    return response;
  }

  async updateRubric(rubricId, rubricData) {
    const response = await axios.put(`${API_BASE_URL}/rubrics/${rubricId}`, rubricData);
    return response;
  }

  async deleteRubric(rubricId) {
    const response = await axios.delete(`${API_BASE_URL}/rubrics/${rubricId}`);
    return response;
  }

  async duplicateRubric(rubricId, duplicateData) {
    const response = await axios.post(`${API_BASE_URL}/rubrics/${rubricId}/duplicate`, duplicateData);
    return response;
  }

  async makeTemplate(rubricId, templateData) {
    const response = await axios.post(`${API_BASE_URL}/rubrics/${rubricId}/make-template`, templateData);
    return response;
  }

  async getTemplateCategories() {
    const response = await axios.get(`${API_BASE_URL}/rubrics/categories`);
    return response;
  }
}

export default new RubricService();
