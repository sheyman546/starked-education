const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Course = require('../models/Course');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const plagiarismService = require('../services/plagiarismService');

describe('Plagiarism Detection Tests', () => {
  let instructorToken, studentToken, student2Token;
  let instructor, student1, student2, course, assignment;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/starked-education-test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up database
    await User.deleteMany({});
    await Course.deleteMany({});
    await Assignment.deleteMany({});
    await Submission.deleteMany({});

    // Create test users
    instructor = new User({
      username: 'instructor',
      email: 'instructor@test.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'Instructor',
      role: 'instructor'
    });
    await instructor.save();

    student1 = new User({
      username: 'student1',
      email: 'student1@test.com',
      password: 'password123',
      firstName: 'Student',
      lastName: 'One',
      role: 'student'
    });
    await student1.save();

    student2 = new User({
      username: 'student2',
      email: 'student2@test.com',
      password: 'password123',
      firstName: 'Student',
      lastName: 'Two',
      role: 'student'
    });
    await student2.save();

    // Get tokens
    const instructorRes = await request(app)
      .post('/api/users/login')
      .send({ email: 'instructor@test.com', password: 'password123' });
    instructorToken = instructorRes.body.token;

    const student1Res = await request(app)
      .post('/api/users/login')
      .send({ email: 'student1@test.com', password: 'password123' });
    studentToken = student1Res.body.token;

    const student2Res = await request(app)
      .post('/api/users/login')
      .send({ email: 'student2@test.com', password: 'password123' });
    student2Token = student2Res.body.token;

    // Create test course
    course = new Course({
      title: 'Test Course',
      description: 'Test Description',
      instructor: instructor._id,
      category: 'programming',
      level: 'beginner',
      thumbnail: 'test.jpg'
    });
    await course.save();

    // Create test assignment with plagiarism detection
    assignment = new Assignment({
      title: 'Test Assignment',
      description: 'Test Description',
      instructions: 'Test Instructions',
      course: course._id,
      instructor: instructor._id,
      type: 'text',
      submissionTypes: ['text'],
      points: 100,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      plagiarismDetection: {
        enabled: true,
        sensitivity: 'medium',
        checkAgainstInternet: true,
        checkAgainstPeers: true
      }
    });
    await assignment.save();
  });

  describe('Plagiarism Service', () => {
    test('Should extract content from submission', () => {
      const testSubmission = {
        content: {
          text: 'This is a test submission with some content.',
          code: [{ code: 'console.log("hello world");' }],
          files: [{ filename: 'test.txt' }]
        }
      };

      const content = plagiarismService.extractContent(testSubmission);
      expect(content).toContain('This is a test submission');
      expect(content).toContain('console.log("hello world");');
    });

    test('Should calculate similarity between texts', () => {
      const text1 = 'The quick brown fox jumps over the lazy dog';
      const text2 = 'The quick brown cat jumps over the lazy dog';
      const text3 = 'Completely different text content here';

      const similarity1 = plagiarismService.calculateSimilarity(text1, text2);
      const similarity2 = plagiarismService.calculateSimilarity(text1, text3);

      expect(similarity1).toBeGreaterThan(similarity2);
      expect(similarity1).toBeGreaterThan(50); // Should be quite similar
      expect(similarity2).toBeLessThan(20); // Should be quite different
    });

    test('Should handle empty content', () => {
      const emptySubmission = {
        content: {
          text: '',
          code: [],
          files: []
        }
      };

      const content = plagiarismService.extractContent(emptySubmission);
      expect(content).toBe('');
    });
  });

  describe('Plagiarism Detection Integration', () => {
    test('Should trigger plagiarism check on submission', async () => {
      // Enroll student
      course.enrolledStudents.push({
        student: student1._id,
        enrolledAt: new Date(),
        progress: 0,
        lastAccessed: new Date()
      });
      await course.save();

      // Submit assignment
      const submissionResponse = await request(app)
        .post(`/api/submissions/assignment/${assignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ text: 'This is my original submission content for testing.' })
        .expect(201);

      const submission = submissionResponse.body;
      
      // Check that plagiarism status is set to pending
      expect(submission.plagiarism.status).toBe('pending');
      expect(submission.plagiarism.checked).toBe(false);
    });

    test('Should flag submission with high similarity', async () => {
      // Enroll both students
      course.enrolledStudents.push(
        { student: student1._id, enrolledAt: new Date(), progress: 0, lastAccessed: new Date() },
        { student: student2._id, enrolledAt: new Date(), progress: 0, lastAccessed: new Date() }
      );
      await course.save();

      const similarText = 'This is a very similar text content that should trigger plagiarism detection because it contains many common words and phrases.';
      
      // First student submits
      await request(app)
        .post(`/api/submissions/assignment/${assignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ text: similarText });

      // Second student submits similar content
      const submission2Response = await request(app)
        .post(`/api/submissions/assignment/${assignment._id}`)
        .set('Authorization', `Bearer ${student2Token}`)
        .send({ text: similarText });

      // Manually trigger plagiarism check for testing
      await plagiarismService.checkSubmission(submission2Response.body._id);

      // Check the updated submission
      const updatedSubmission = await Submission.findById(submission2Response.body._id);
      expect(updatedSubmission.plagiarism.checked).toBe(true);
      expect(updatedSubmission.plagiarism.status).toBe('completed');
      expect(updatedSubmission.plagiarism.score).toBeGreaterThan(0);
    });

    test('Should get peer comparisons', async () => {
      // Enroll both students
      course.enrolledStudents.push(
        { student: student1._id, enrolledAt: new Date(), progress: 0, lastAccessed: new Date() },
        { student: student2._id, enrolledAt: new Date(), progress: 0, lastAccessed: new Date() }
      );
      await course.save();

      const baseText = 'The quick brown fox jumps over the lazy dog in the forest.';
      const similarText = 'The quick brown cat jumps over the lazy dog in the forest.';
      
      // First student submits
      const submission1Response = await request(app)
        .post(`/api/submissions/assignment/${assignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ text: baseText });

      // Second student submits similar content
      const submission2Response = await request(app)
        .post(`/api/submissions/assignment/${assignment._id}`)
        .set('Authorization', `Bearer ${student2Token}`)
        .send({ text: similarText });

      // Get peer comparisons
      const comparisons = await plagiarismService.getPeerComparisons(submission2Response.body._id);
      
      expect(comparisons).toBeDefined();
      expect(Array.isArray(comparisons)).toBe(true);
    });

    test('Should generate plagiarism report', async () => {
      // Enroll student
      course.enrolledStudents.push({
        student: student1._id,
        enrolledAt: new Date(),
        progress: 0,
        lastAccessed: new Date()
      });
      await course.save();

      // Submit assignment
      const submissionResponse = await request(app)
        .post(`/api/submissions/assignment/${assignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ text: 'Test content for plagiarism report generation.' });

      const submissionId = submissionResponse.body._id;

      // Manually set plagiarism results for testing
      await Submission.findByIdAndUpdate(submissionId, {
        'plagiarism.checked': true,
        'plagiarism.status': 'completed',
        'plagiarism.score': 85,
        'plagiarism.report': {
          sources: [
            { url: 'https://example.com/source1', similarity: 80, words: 25 },
            { url: 'https://example.com/source2', similarity: 60, words: 15 }
          ],
          flaggedSections: [
            { text: 'Test content for plagiarism', similarity: 90, source: 'https://example.com/source1' }
          ]
        }
      });

      // Generate report
      const report = await plagiarismService.generateReport(submissionId);
      
      expect(report).toBeDefined();
      expect(report.plagiarism.score).toBe(85);
      expect(report.sources).toHaveLength(2);
      expect(report.flaggedSections).toHaveLength(1);
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    test('Should handle batch plagiarism checking', async () => {
      // Enroll multiple students
      for (let i = 0; i < 3; i++) {
        course.enrolledStudents.push({
          student: new mongoose.Types.ObjectId(),
          enrolledAt: new Date(),
          progress: 0,
          lastAccessed: new Date()
        });
      }
      await course.save();

      // Create multiple submissions
      const submissions = [];
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post(`/api/submissions/assignment/${assignment._id}`)
          .set('Authorization', `Bearer ${studentToken}`)
          .send({ text: `Submission content ${i}` });
        submissions.push(response.body);
      }

      // Perform batch check
      const results = await plagiarismService.batchCheck(assignment._id);
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.status === 'completed')).toBe(true);
    });
  });

  describe('Plagiarism Detection Edge Cases', () => {
    test('Should handle very short submissions', async () => {
      // Enroll student
      course.enrolledStudents.push({
        student: student1._id,
        enrolledAt: new Date(),
        progress: 0,
        lastAccessed: new Date()
      });
      await course.save();

      // Submit very short content
      const submissionResponse = await request(app)
        .post(`/api/submissions/assignment/${assignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ text: 'Short' });

      // Manually trigger check
      await plagiarismService.checkSubmission(submissionResponse.body._id);

      const updatedSubmission = await Submission.findById(submissionResponse.body._id);
      expect(updatedSubmission.plagiarism.checked).toBe(true);
      expect(updatedSubmission.plagiarism.score).toBe(0); // Should be 0 for too short content
    });

    test('Should handle code submissions differently', async () => {
      // Create assignment that accepts code
      const codeAssignment = new Assignment({
        title: 'Code Assignment',
        description: 'Test Description',
        instructions: 'Test Instructions',
        course: course._id,
        instructor: instructor._id,
        type: 'code',
        submissionTypes: ['code'],
        points: 100,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        plagiarismDetection: {
          enabled: true,
          sensitivity: 'high',
          checkAgainstInternet: true,
          checkAgainstPeers: true
        }
      });
      await codeAssignment.save();

      // Enroll student
      course.enrolledStudents.push({
        student: student1._id,
        enrolledAt: new Date(),
        progress: 0,
        lastAccessed: new Date()
      });
      await course.save();

      // Submit code
      const submissionResponse = await request(app)
        .post(`/api/submissions/assignment/${codeAssignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ 
          code: JSON.stringify([{
            language: 'javascript',
            code: 'function hello() { console.log("Hello, World!"); }'
          }])
        });

      // Check that content extraction includes code
      const content = plagiarismService.extractContent(submissionResponse.body);
      expect(content).toContain('function hello()');
      expect(content).toContain('console.log');
    });

    test('Should handle plagiarism service errors gracefully', async () => {
      // Mock plagiarism service to throw error
      const originalCheck = plagiarismService.checkSubmission;
      plagiarismService.checkSubmission = jest.fn().mockRejectedValue(new Error('API Error'));

      // Enroll student
      course.enrolledStudents.push({
        student: student1._id,
        enrolledAt: new Date(),
        progress: 0,
        lastAccessed: new Date()
      });
      await course.save();

      // Submit assignment
      const submissionResponse = await request(app)
        .post(`/api/submissions/assignment/${assignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ text: 'Test content' });

      // Try to check plagiarism
      await expect(plagiarismService.checkSubmission(submissionResponse.body._id))
        .rejects.toThrow('API Error');

      // Restore original function
      plagiarismService.checkSubmission = originalCheck;
    });
  });
});
