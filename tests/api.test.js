const request = require('supertest');
const app = require('../server');
const mongoose = require('mongoose');
const User = require('../models/User');
const Content = require('../models/Content');
const Course = require('../models/Course');

describe('API Tests', () => {
  let authToken;
  let testUser;
  let testCourse;
  let testContent;

  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/starked-education-test';
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    // Clean up database and close connection
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up before each test
    await User.deleteMany({});
    await Content.deleteMany({});
    await Course.deleteMany({});
  });

  describe('Authentication', () => {
    test('POST /api/users/register - should register a new user', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.username).toBe(userData.username);
    });

    test('POST /api/users/login - should login existing user', async () => {
      // First register a user
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User'
      };

      await request(app)
        .post('/api/users/register')
        .send(userData);

      // Then login
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/users/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(loginData.email);
      
      authToken = response.body.token;
      testUser = response.body.user;
    });

    test('POST /api/users/login - should fail with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'wrong@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });
  });

  describe('Content Management', () => {
    beforeEach(async () => {
      // Create and login a test user
      const userData = {
        username: 'instructor',
        email: 'instructor@example.com',
        password: 'password123',
        firstName: 'Instructor',
        lastName: 'User',
        role: 'instructor'
      };

      const registerResponse = await request(app)
        .post('/api/users/register')
        .send(userData);

      authToken = registerResponse.body.token;
      testUser = registerResponse.body.user;

      // Create a test course
      const courseData = {
        title: 'Test Course',
        description: 'A test course for testing',
        instructor: testUser.id,
        category: 'programming',
        level: 'beginner',
        thumbnail: 'http://example.com/thumbnail.jpg'
      };

      const courseResponse = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send(courseData);

      testCourse = courseResponse.body;
    });

    test('POST /api/content - should create new content', async () => {
      const contentData = {
        title: 'Test Video Lesson',
        description: 'A test video lesson',
        type: 'video',
        course: testCourse._id,
        module: testCourse._id, // Using course ID as module ID for simplicity
        order: 1,
        duration: 600,
        metadata: {
          resolution: '1080p',
          difficulty: 'beginner'
        }
      };

      const response = await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contentData)
        .expect(201);

      expect(response.body.title).toBe(contentData.title);
      expect(response.body.type).toBe(contentData.type);
      expect(response.body.course).toBe(contentData.course);
      
      testContent = response.body;
    });

    test('GET /api/content/:id - should get content by ID', async () => {
      // First create content
      const contentData = {
        title: 'Test Video Lesson',
        description: 'A test video lesson',
        type: 'video',
        course: testCourse._id,
        module: testCourse._id,
        order: 1,
        duration: 600
      };

      const createResponse = await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contentData);

      testContent = createResponse.body;

      // Then get it
      const response = await request(app)
        .get(`/api/content/${testContent._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body._id).toBe(testContent._id);
      expect(response.body.title).toBe(testContent.title);
    });

    test('PUT /api/content/:id - should update content', async () => {
      // First create content
      const contentData = {
        title: 'Test Video Lesson',
        description: 'A test video lesson',
        type: 'video',
        course: testCourse._id,
        module: testCourse._id,
        order: 1,
        duration: 600
      };

      const createResponse = await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contentData);

      testContent = createResponse.body;

      // Then update it
      const updateData = {
        title: 'Updated Video Lesson',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/content/${testContent._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.title).toBe(updateData.title);
      expect(response.body.description).toBe(updateData.description);
    });

    test('DELETE /api/content/:id - should delete content', async () => {
      // First create content
      const contentData = {
        title: 'Test Video Lesson',
        description: 'A test video lesson',
        type: 'video',
        course: testCourse._id,
        module: testCourse._id,
        order: 1,
        duration: 600
      };

      const createResponse = await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contentData);

      testContent = createResponse.body;

      // Then delete it
      await request(app)
        .delete(`/api/content/${testContent._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify it's deleted
      await request(app)
        .get(`/api/content/${testContent._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    test('GET /api/content/course/:courseId - should get course content', async () => {
      // Create multiple content items
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post('/api/content')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Test Lesson ${i}`,
            description: `Test lesson ${i} description`,
            type: 'video',
            course: testCourse._id,
            module: testCourse._id,
            order: i,
            duration: 600
          });
      }

      const response = await request(app)
        .get(`/api/content/course/${testCourse._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body[0].title).toBe('Test Lesson 1');
    });

    test('GET /api/content/search/:query - should search content', async () => {
      // Create searchable content
      await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'JavaScript Basics',
          description: 'Learn JavaScript programming',
          type: 'video',
          course: testCourse._id,
          module: testCourse._id,
          order: 1,
          duration: 600,
          metadata: {
            tags: ['javascript', 'programming']
          }
        });

      const response = await request(app)
        .get('/api/content/search/javascript')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.content).toHaveLength(1);
      expect(response.body.content[0].title).toBe('JavaScript Basics');
    });
  });

  describe('Progress Tracking', () => {
    beforeEach(async () => {
      // Create and login a test user
      const userData = {
        username: 'student',
        email: 'student@example.com',
        password: 'password123',
        firstName: 'Student',
        lastName: 'User',
        role: 'student'
      };

      const registerResponse = await request(app)
        .post('/api/users/register')
        .send(userData);

      authToken = registerResponse.body.token;
      testUser = registerResponse.body.user;

      // Create a test course and content
      const courseData = {
        title: 'Test Course',
        description: 'A test course for testing',
        instructor: testUser.id,
        category: 'programming',
        level: 'beginner',
        thumbnail: 'http://example.com/thumbnail.jpg'
      };

      const courseResponse = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send(courseData);

      testCourse = courseResponse.body;

      const contentData = {
        title: 'Test Video Lesson',
        description: 'A test video lesson',
        type: 'video',
        course: testCourse._id,
        module: testCourse._id,
        order: 1,
        duration: 600
      };

      const contentResponse = await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contentData);

      testContent = contentResponse.body;
    });

    test('PUT /api/progress/content/:contentId - should update progress', async () => {
      const progressData = {
        progress: 50,
        lastPosition: 300,
        watchTime: 60
      };

      const response = await request(app)
        .put(`/api/progress/content/${testContent._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(progressData)
        .expect(200);

      expect(response.body.progress).toBe(progressData.progress);
      expect(response.body.lastPosition).toBe(progressData.lastPosition);
    });

    test('POST /api/progress/content/:contentId/complete - should mark content as completed', async () => {
      const response = await request(app)
        .post(`/api/progress/content/${testContent._id}/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('completed');
      expect(response.body.progress).toBe(100);
    });

    test('POST /api/progress/content/:contentId/notes - should add note', async () => {
      const noteData = {
        timestamp: 120,
        text: 'This is an important point'
      };

      const response = await request(app)
        .post(`/api/progress/content/${testContent._id}/notes`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(noteData)
        .expect(200);

      expect(response.body.notes).toHaveLength(1);
      expect(response.body.notes[0].text).toBe(noteData.text);
      expect(response.body.notes[0].timestamp).toBe(noteData.timestamp);
    });

    test('POST /api/progress/content/:contentId/bookmarks - should add bookmark', async () => {
      const bookmarkData = {
        timestamp: 240,
        title: 'Important section',
        note: 'Review this later'
      };

      const response = await request(app)
        .post(`/api/progress/content/${testContent._id}/bookmarks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(bookmarkData)
        .expect(200);

      expect(response.body.bookmarks).toHaveLength(1);
      expect(response.body.bookmarks[0].title).toBe(bookmarkData.title);
      expect(response.body.bookmarks[0].timestamp).toBe(bookmarkData.timestamp);
    });
  });

  describe('Media Streaming', () => {
    test('GET /api/media/video/:filename - should stream video file', async () => {
      // This test would require actual video files in the media directory
      // For now, we'll test that the endpoint exists and handles missing files
      const response = await request(app)
        .get('/api/media/nonexistent.mp4')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('Video not found');
    });

    test('GET /api/media/audio/:filename - should stream audio file', async () => {
      const response = await request(app)
        .get('/api/media/nonexistent.mp3')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('Audio not found');
    });

    test('GET /api/media/document/:filename - should serve document', async () => {
      const response = await request(app)
        .get('/api/media/nonexistent.pdf')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('Document not found');
    });
  });

  describe('Analytics', () => {
    beforeEach(async () => {
      // Create instructor user
      const instructorData = {
        username: 'instructor',
        email: 'instructor@example.com',
        password: 'password123',
        firstName: 'Instructor',
        lastName: 'User',
        role: 'instructor'
      };

      const instructorResponse = await request(app)
        .post('/api/users/register')
        .send(instructorData);

      const instructorToken = instructorResponse.body.token;

      // Create course and content
      const courseData = {
        title: 'Test Course',
        description: 'A test course for testing',
        instructor: instructorResponse.body.user.id,
        category: 'programming',
        level: 'beginner',
        thumbnail: 'http://example.com/thumbnail.jpg'
      };

      const courseResponse = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send(courseData);

      testCourse = courseResponse.body;

      const contentData = {
        title: 'Test Video Lesson',
        description: 'A test video lesson',
        type: 'video',
        course: testCourse._id,
        module: testCourse._id,
        order: 1,
        duration: 600
      };

      const contentResponse = await request(app)
        .post('/api/content')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send(contentData);

      testContent = contentResponse.body;

      // Create student user
      const studentData = {
        username: 'student',
        email: 'student@example.com',
        password: 'password123',
        firstName: 'Student',
        lastName: 'User',
        role: 'student'
      };

      const studentResponse = await request(app)
        .post('/api/users/register')
        .send(studentData);

      authToken = studentResponse.body.token;
    });

    test('GET /api/analytics/content/:contentId - should get content analytics', async () => {
      // This should fail for student user
      await request(app)
        .get(`/api/analytics/content/${testContent._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });

    test('GET /api/analytics/learning - should get learning analytics', async () => {
      const response = await request(app)
        .get('/api/analytics/learning')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('userStats');
    });
  });

  describe('Error Handling', () => {
    test('GET /api/nonexistent - should return 404', async () => {
      await request(app)
        .get('/api/nonexistent')
        .expect(404);
    });

    test('POST /api/users/register - should validate required fields', async () => {
      const response = await request(app)
        .post('/api/users/register')
        .send({
          email: 'test@example.com'
          // Missing required fields
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    test('Protected routes should require authentication', async () => {
      await request(app)
        .get('/api/content')
        .expect(401);
    });
  });
});
