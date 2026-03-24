const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Course = require('../models/Course');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Grade = require('../models/Grade');
const Rubric = require('../models/Rubric');

describe('Concurrent Operations Tests', () => {
  let instructorToken, studentTokens;
  let instructor, students, course, assignment;

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
    await Grade.deleteMany({});
    await Rubric.deleteMany({});

    // Create instructor
    instructor = new User({
      username: 'instructor',
      email: 'instructor@test.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'Instructor',
      role: 'instructor'
    });
    await instructor.save();

    const instructorRes = await request(app)
      .post('/api/users/login')
      .send({ email: 'instructor@test.com', password: 'password123' });
    instructorToken = instructorRes.body.token;

    // Create course
    course = new Course({
      title: 'Test Course',
      description: 'Test Description',
      instructor: instructor._id,
      category: 'programming',
      level: 'beginner',
      thumbnail: 'test.jpg'
    });
    await course.save();

    // Create assignment
    assignment = new Assignment({
      title: 'Concurrent Test Assignment',
      description: 'Test Description',
      instructions: 'Test Instructions',
      course: course._id,
      instructor: instructor._id,
      type: 'text',
      submissionTypes: ['text'],
      points: 100,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    await assignment.save();

    // Create multiple students
    students = [];
    studentTokens = [];
    for (let i = 0; i < 10; i++) {
      const student = new User({
        username: `student${i}`,
        email: `student${i}@test.com`,
        password: 'password123',
        firstName: `Student${i}`,
        lastName: 'Test',
        role: 'student'
      });
      await student.save();
      students.push(student);

      // Enroll student
      course.enrolledStudents.push({
        student: student._id,
        enrolledAt: new Date(),
        progress: 0,
        lastAccessed: new Date()
      });

      // Get student token
      const studentRes = await request(app)
        .post('/api/users/login')
        .send({ email: `student${i}@test.com`, password: 'password123' });
      studentTokens.push(studentRes.body.token);
    }
    await course.save();
  });

  describe('Concurrent Submissions', () => {
    test('Should handle multiple simultaneous submissions', async () => {
      const submissionPromises = studentTokens.map((token, index) =>
        request(app)
          .post(`/api/submissions/assignment/${assignment._id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ text: `Submission from student ${index}` })
      );

      const results = await Promise.all(submissionPromises);

      // All submissions should succeed
      results.forEach((result, index) => {
        expect(result.status).toBe(201);
        expect(result.body.content.text).toBe(`Submission from student ${index}`);
      });

      // Verify all submissions are in database
      const submissions = await Submission.find({ assignment: assignment._id });
      expect(submissions).toHaveLength(10);
    });

    test('Should handle concurrent draft saves', async () => {
      // Create initial drafts
      const draftPromises = studentTokens.map((token, index) =>
        request(app)
          .post(`/api/submissions/assignment/${assignment._id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ text: `Draft from student ${index}` })
      );

      const draftResults = await Promise.all(draftPromises);
      const submissionIds = draftResults.map(result => result.body._id);

      // Update all drafts concurrently
      const updatePromises = submissionIds.map((id, index) =>
        request(app)
          .put(`/api/submissions/${id}`)
          .set('Authorization', `Bearer ${studentTokens[index]}`)
          .send({ text: `Updated draft from student ${index}` })
      );

      const updateResults = await Promise.all(updatePromises);

      // All updates should succeed
      updateResults.forEach((result, index) => {
        expect(result.status).toBe(200);
        expect(result.body.content.text).toBe(`Updated draft from student ${index}`);
      });
    });

    test('Should handle concurrent submissions to same assignment', async () => {
      const concurrentSubmissions = 20;
      const promises = [];

      for (let i = 0; i < concurrentSubmissions; i++) {
        // Create new student for each submission
        const student = new User({
          username: `concurrent_student${i}`,
          email: `concurrent${i}@test.com`,
          password: 'password123',
          firstName: `Concurrent${i}`,
          lastName: 'Student',
          role: 'student'
        });
        await student.save();

        // Enroll student
        course.enrolledStudents.push({
          student: student._id,
          enrolledAt: new Date(),
          progress: 0,
          lastAccessed: new Date()
        });

        const studentRes = await request(app)
          .post('/api/users/login')
          .send({ email: `concurrent${i}@test.com`, password: 'password123' });

        promises.push(
          request(app)
            .post(`/api/submissions/assignment/${assignment._id}`)
            .set('Authorization', `Bearer ${studentRes.body.token}`)
            .send({ text: `Concurrent submission ${i}` })
        );
      }
      await course.save();

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.status).toBe(201);
      });

      // Verify count
      const submissions = await Submission.find({ assignment: assignment._id });
      expect(submissions).toHaveLength(concurrentSubmissions);
    });
  });

  describe('Concurrent Grading', () => {
    let submissions;

    beforeEach(async () => {
      // Create submissions for grading
      const submissionPromises = studentTokens.slice(0, 5).map((token, index) =>
        request(app)
          .post(`/api/submissions/assignment/${assignment._id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ text: `Submission ${index} for grading` })
      );

      const results = await Promise.all(submissionPromises);
      submissions = results.map(result => result.body);
    });

    test('Should handle concurrent grading operations', async () => {
      const gradingPromises = submissions.map((submission, index) =>
        request(app)
          .post(`/api/grading/submission/${submission._id}`)
          .set('Authorization', `Bearer ${instructorToken}`)
          .send({
            rubricScores: JSON.stringify([{
              criterion: new mongoose.Types.ObjectId(),
              level: new mongoose.Types.ObjectId(),
              score: 80 + index * 5,
              feedback: `Feedback for submission ${index}`
            }]),
            overallFeedback: `Overall feedback ${index}`,
            releaseImmediately: true
          })
      );

      const results = await Promise.all(gradingPromises);

      // All grading operations should succeed
      results.forEach((result, index) => {
        expect(result.status).toBe(201);
        expect(result.body.scores.earned).toBe(80 + index * 5);
      });

      // Verify all grades are in database
      const grades = await Grade.find({ assignment: assignment._id });
      expect(grades).toHaveLength(5);
    });

    test('Should handle concurrent grade updates', async () => {
      // Create initial grades
      const initialGradingPromises = submissions.map((submission, index) =>
        request(app)
          .post(`/api/grading/submission/${submission._id}`)
          .set('Authorization', `Bearer ${instructorToken}`)
          .send({
            rubricScores: JSON.stringify([{
              criterion: new mongoose.Types.ObjectId(),
              level: new mongoose.Types.ObjectId(),
              score: 70,
              feedback: 'Initial feedback'
            }])
          })
      );

      const initialResults = await Promise.all(initialGradingPromises);
      const gradeIds = initialResults.map(result => result.body._id);

      // Update all grades concurrently
      const updatePromises = gradeIds.map((gradeId, index) =>
        request(app)
          .put(`/api/grading/${gradeId}`)
          .set('Authorization', `Bearer ${instructorToken}`)
          .send({
            rubricScores: JSON.stringify([{
              criterion: new mongoose.Types.ObjectId(),
              level: new mongoose.Types.ObjectId(),
              score: 85 + index * 2,
              feedback: `Updated feedback ${index}`
            }])
          })
      );

      const updateResults = await Promise.all(updatePromises);

      // All updates should succeed
      updateResults.forEach((result, index) => {
        expect(result.status).toBe(200);
        expect(result.body.scores.earned).toBe(85 + index * 2);
      });
    });

    test('Should handle concurrent bulk operations', async () => {
      // Create grades for all submissions
      const gradeCreationPromises = submissions.map(submission =>
        request(app)
          .post(`/api/grading/submission/${submission._id}`)
          .set('Authorization', `Bearer ${instructorToken}`)
          .send({
            rubricScores: JSON.stringify([{
              criterion: new mongoose.Types.ObjectId(),
              level: new mongoose.Types.ObjectId(),
              score: 80,
              feedback: 'Good work'
            }])
          })
      );

      await Promise.all(gradeCreationPromises);

      // Perform bulk release operation
      const bulkReleasePromises = [
        request(app)
          .post('/api/grading/bulk')
          .set('Authorization', `Bearer ${instructorToken}`)
          .send({
            submissionIds: submissions.slice(0, 3).map(s => s._id),
            action: 'release'
          }),
        request(app)
          .post('/api/grading/bulk')
          .set('Authorization', `Bearer ${instructorToken}`)
          .send({
            submissionIds: submissions.slice(2, 5).map(s => s._id),
            action: 'release'
          })
      ];

      const results = await Promise.all(bulkReleasePromises);

      // Both operations should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.body.results).toHaveLength(3);
      });

      // Verify all grades are released
      const grades = await Grade.find({ assignment: assignment._id, 'release.released': true });
      expect(grades).toHaveLength(5);
    });
  });

  describe('Concurrent File Operations', () => {
    test('Should handle concurrent file uploads', async () => {
      const uploadPromises = studentTokens.slice(0, 5).map((token, index) =>
        request(app)
          .post(`/api/submissions/assignment/${assignment._id}`)
          .set('Authorization', `Bearer ${token}`)
          .attach('files', Buffer.from(`File content ${index}`), `file${index}.txt`)
          .field('text', `Submission ${index} with file`)
      );

      const results = await Promise.all(uploadPromises);

      // All uploads should succeed
      results.forEach((result, index) => {
        expect(result.status).toBe(201);
        expect(result.body.content.files).toHaveLength(1);
        expect(result.body.content.files[0].originalName).toBe(`file${index}.txt`);
      });
    });

    test('Should handle concurrent file downloads', async () => {
      // Create submissions with files
      const submissions = [];
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post(`/api/submissions/assignment/${assignment._id}`)
          .set('Authorization', `Bearer ${studentTokens[i]}`)
          .attach('files', Buffer.from(`File content ${i}`), `file${i}.txt`)
          .field('text', `Submission ${i}`);
        submissions.push(response.body);
      }

      // Download all files concurrently
      const downloadPromises = submissions.map((submission, index) =>
        request(app)
          .get(`/api/submissions/${submission._id}/download/file${index}.txt`)
          .set('Authorization', `Bearer ${instructorToken}`)
      );

      const results = await Promise.all(downloadPromises);

      // All downloads should succeed
      results.forEach((result, index) => {
        expect(result.status).toBe(200);
        expect(result.text).toBe(`File content ${index}`);
      });
    });
  });

  describe('Database Integrity Under Load', () => {
    test('Should maintain data consistency during high load', async () => {
      const operations = [];
      const operationCount = 100;

      // Mix of different operations
      for (let i = 0; i < operationCount; i++) {
        // Create submission
        operations.push(
          request(app)
            .post(`/api/submissions/assignment/${assignment._id}`)
            .set('Authorization', `Bearer ${studentTokens[i % studentTokens.length]}`)
            .send({ text: `High load submission ${i}` })
        );
      }

      const results = await Promise.all(operations);

      // All operations should succeed
      const successCount = results.filter(result => result.status === 201).length;
      expect(successCount).toBe(operationCount);

      // Verify database consistency
      const submissions = await Submission.find({ assignment: assignment._id });
      expect(submissions).toHaveLength(operationCount);

      // Verify each submission has correct data
      submissions.forEach((submission, index) => {
        expect(submission.content.text).toContain('High load submission');
        expect(submission.student).toBeDefined();
        expect(submission.assignment.toString()).toBe(assignment._id.toString());
      });
    });

    test('Should handle race conditions in assignment updates', async () => {
      // Create multiple update operations on the same assignment
      const updatePromises = [];
      for (let i = 0; i < 10; i++) {
        updatePromises.push(
          request(app)
            .put(`/api/assignments/${assignment._id}`)
            .set('Authorization', `Bearer ${instructorToken}`)
            .send({ description: `Updated description ${i}` })
        );
      }

      const results = await Promise.all(updatePromises);

      // At least one should succeed
      const successCount = results.filter(result => result.status === 200).length;
      expect(successCount).toBeGreaterThan(0);

      // Verify assignment integrity
      const updatedAssignment = await Assignment.findById(assignment._id);
      expect(updatedAssignment.description).toMatch(/Updated description \d+/);
    });
  });

  describe('Performance Under Load', () => {
    test('Should maintain reasonable response times under load', async () => {
      const startTime = Date.now();
      const requestCount = 50;

      const promises = [];
      for (let i = 0; i < requestCount; i++) {
        promises.push(
          request(app)
            .get(`/api/assignments/course/${course._id}`)
            .set('Authorization', `Bearer ${instructorToken}`)
        );
      }

      await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Average response time should be reasonable (less than 100ms per request)
      const averageTime = totalTime / requestCount;
      expect(averageTime).toBeLessThan(100);
    });

    test('Should handle memory usage during large operations', async () => {
      // Create many submissions with large content
      const largeContent = 'x'.repeat(10000); // 10KB per submission
      const promises = [];

      for (let i = 0; i < 20; i++) {
        promises.push(
          request(app)
            .post(`/api/submissions/assignment/${assignment._id}`)
            .set('Authorization', `Bearer ${studentTokens[i % studentTokens.length]}`)
            .send({ text: `${largeContent} ${i}` })
        );
      }

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.status).toBe(201);
        expect(result.body.content.text.length).toBeGreaterThan(10000);
      });
    });
  });
});
