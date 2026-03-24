import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/auth/login';
    }
    
    // Handle 403 Forbidden - insufficient permissions
    if (error.response?.status === 403) {
      console.error('Access forbidden:', error.response.data.error);
    }
    
    // Handle 500 Server Error
    if (error.response?.status === 500) {
      console.error('Server error:', error.response.data.error);
    }
    
    return Promise.reject(error);
  }
);

// API Service methods
export const authAPI = {
  login: (credentials) => api.post('/users/login', credentials),
  register: (userData) => api.post('/users/register', userData),
  getProfile: () => api.get('/users/profile'),
  updateProfile: (userData) => api.put('/users/profile', userData),
  changePassword: (passwordData) => api.put('/users/password', passwordData),
  enrollCourse: (courseId) => api.post(`/users/enroll/${courseId}`),
  getEnrolledCourses: () => api.get('/users/enrolled'),
  getCompletedCourses: () => api.get('/users/completed'),
  getDashboard: () => api.get('/users/dashboard'),
  updateCourseProgress: (courseId, progress) => api.put(`/users/progress/${courseId}`, { progress }),
};

export const contentAPI = {
  getCourseContent: (courseId, moduleId) => {
    const params = moduleId ? { moduleId } : {};
    return api.get(`/content/course/${courseId}`, { params });
  },
  getContent: (contentId) => api.get(`/content/${contentId}`),
  createContent: (contentData) => api.post('/content', contentData),
  updateContent: (contentId, contentData) => api.put(`/content/${contentId}`, contentData),
  deleteContent: (contentId) => api.delete(`/content/${contentId}`),
  searchContent: (query, filters = {}) => {
    const params = { ...filters };
    return api.get(`/content/search/${query}`, { params });
  },
  getContentStats: (courseId) => api.get(`/content/stats/${courseId}`),
};

export const mediaAPI = {
  getVideo: (filename) => api.get(`/media/video/${filename}`, { responseType: 'blob' }),
  getAudio: (filename) => api.get(`/media/audio/${filename}`, { responseType: 'blob' }),
  getDocument: (filename) => api.get(`/media/document/${filename}`, { responseType: 'blob' }),
  getImage: (filename) => api.get(`/media/image/${filename}`, { responseType: 'blob' }),
  getSubtitle: (filename) => api.get(`/media/subtitle/${filename}`),
  getTranscript: (filename) => api.get(`/media/transcript/${filename}`),
  getHLSPlaylist: (contentId, quality) => api.get(`/media/hls/${contentId}/${quality}`),
  uploadChunk: (chunkData) => api.post('/media/upload/chunk', chunkData),
};

export const progressAPI = {
  getCourseProgress: (courseId) => api.get(`/progress/course/${courseId}`),
  getContentProgress: (contentId) => api.get(`/progress/content/${contentId}`),
  updateContentProgress: (contentId, progressData) => api.put(`/progress/content/${contentId}`, progressData),
  markContentCompleted: (contentId) => api.post(`/progress/content/${contentId}/complete`),
  addNote: (contentId, noteData) => api.post(`/progress/content/${contentId}/notes`, noteData),
  addBookmark: (contentId, bookmarkData) => api.post(`/progress/content/${contentId}/bookmarks`, bookmarkData),
  getBookmarks: () => api.get('/progress/bookmarks'),
  getStats: () => api.get('/progress/stats'),
};

export const courseAPI = {
  getCourses: (filters = {}) => {
    const params = { ...filters };
    return api.get('/courses', { params });
  },
  getCourse: (courseId) => api.get(`/courses/${courseId}`),
  createCourse: (courseData) => api.post('/courses', courseData),
  updateCourse: (courseId, courseData) => api.put(`/courses/${courseId}`, courseData),
  deleteCourse: (courseId) => api.delete(`/courses/${courseId}`),
  getCourseModules: (courseId) => api.get(`/courses/${courseId}/modules`),
  createModule: (courseId, moduleData) => api.post(`/courses/${courseId}/modules`, moduleData),
  updateModule: (moduleId, moduleData) => api.put(`/modules/${moduleId}`, moduleData),
  deleteModule: (moduleId) => api.delete(`/modules/${moduleId}`),
};

export const analyticsAPI = {
  getContentAnalytics: (contentId) => api.get(`/analytics/content/${contentId}`),
  getCourseAnalytics: (courseId) => api.get(`/analytics/course/${courseId}`),
  getPlatformAnalytics: (period) => api.get('/analytics/platform', { params: { period } }),
  getLearningAnalytics: (period) => api.get('/analytics/learning', { params: { period } }),
};

export const searchAPI = {
  searchCourses: (query, filters = {}) => {
    const params = { query, ...filters };
    return api.get('/search/courses', { params });
  },
  searchContent: (query, filters = {}) => {
    const params = { query, ...filters };
    return api.get('/search/content', { params });
  },
  getPopularCourses: () => api.get('/search/popular/courses'),
  getTrendingContent: () => api.get('/search/trending/content'),
};

// Utility function for file uploads
export const uploadFile = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  return api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
      if (onProgress) onProgress(progress);
    },
  });
};

// Utility function for chunked uploads (for large files)
export const uploadLargeFile = async (file, chunkSize = 1024 * 1024, onProgress) => {
  const chunks = Math.ceil(file.size / chunkSize);
  const fileId = `${file.name}-${Date.now()}`;
  
  for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    
    const chunkData = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(chunk);
    });
    
    await mediaAPI.uploadChunk({
      fileName: file.name,
      chunkIndex,
      totalChunks: chunks,
      chunkData,
      contentType: file.type,
    });
    
    if (onProgress) {
      onProgress(((chunkIndex + 1) / chunks) * 100);
    }
  }
};

export default api;
