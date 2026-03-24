const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Course = require('../models/Course');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Grade = require('../models/Grade');
const Rubric = require('../models/Rubric');

describe('Assignment System Tests', () => {
  let instructorToken, studentToken, adminToken;
  let instructor, student, admin, course, assignment, rubric;

  beforeAll(async () => {
    // Connect to test database
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

    student = new User({
      username: 'student',
      email: 'student@test.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'Student',
      role: 'student'
    });
    await student.save();

    admin = new User({
      username: 'admin',
      email: 'admin@test.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'Admin',
      role: 'admin'
    });
    await admin.save();

    // Get tokens
    const instructorRes = await request(app)
      .post('/api/users/login')
      .send({ email: 'instructor@test.com', password: 'password123' });
    instructorToken = instructorRes.body.token;

    const studentRes = await request(app)
      .post('/api/users/login')
      .send({ email: 'student@test.com', password: 'password123' });
    studentToken = studentRes.body.token;

    const adminRes = await request(app)
      .post('/api/users/login')
      .send({ email: 'admin@test.com', password: 'password123' });
    adminToken = adminRes.body.token;

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

    // Create test rubric
    rubric = new Rubric({
      title: 'Test Rubric',
      description: 'Test Rubric Description',
      course: course._id,
      instructor: instructor._id,
      totalPoints: 100,
      criteria: [
        {
          title: 'Content',
          description: 'Quality of content',
          weight: 50,
          levels: [
            { name: 'Excellent', description: 'Outstanding work', points: 50 },
            { name: 'Good', description: 'Good work', points: 40 },
            { name: 'Fair', description: 'Fair work', points: 30 }
          ]
        },
        {
          title: 'Presentation',
          description: 'Quality of presentation',
          weight: 50,
          levels: [
            { name: 'Excellent', description: 'Outstanding presentation', points: 50 },
            { name: 'Good', description: 'Good presentation', points: 40 },
            { name: 'Fair', description: 'Fair presentation', points: 30 }
          ]
        }
      ]
    });
    await rubric.save();
  });

  describe('Assignment Management', () => {
    test('Instructor should create assignment', async () => {
      const assignmentData = {
        title: 'Test Assignment',
        description: 'Test Description',
        instructions: 'Test Instructions',
        course: course._id,
        type: 'text',
        submissionTypes: ['text', 'file'],
        points: 100,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        rubric: rubric._id
      };

      const response = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send(assignmentData)
        .expect(201);

      expect(response.body.title).toBe(assignmentData.title);
      expect(response.body.instructor._id).toBe(instructor._id.toString());
      assignment = response.body;
    });

    test('Student should not create assignment', async () => {
      const assignmentData = {
        title: 'Test Assignment',
        description: 'Test Description',
        course: course._id,
        type: 'text',
        points: 100
      };

      await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(assignmentData)
        .expect(403);
    });

    test('Instructor should get course assignments', async () => {
      const response = await request(app)
        .get(`/api/assignments/course/${course._id}`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .expect(200);

      expect(response.body.assignments).toHaveLength(1);
      expect(response.body.assignments[0].title).toBe('Test Assignment');
    });

    test('Instructor should get assignment details', async () => {
      const response = await request(app)
        .get(`/api/assignments/${assignment._id}`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .expect(200);

      expect(response.body.assignment.title).toBe('Test Assignment');
    });

    test('Instructor should update assignment', async () => {
      const updateData = { title: 'Updated Assignment' };

      const response = await request(app)
        .put(`/api/assignments/${assignment._id}`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.title).toBe('Updated Assignment');
    });

    test('Student should not update assignment', async () => {
      const updateData = { title: 'Updated Assignment' };

      await request(app)
        .put(`/api/assignments/${assignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(updateData)
        .expect(403);
    });

    test('Instructor should publish assignment', async () => {
      await request(app)
        .post(`/api/assignments/${assignment._id}/publish`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .expect(200);
    });
  });

  describe('Submission Management', () => {
    beforeEach(async () => {
      // Enroll student in course
      course.enrolledStudents.push({
        student: student._id,
        enrolledAt: new Date(),
        progress: 0,
        lastAccessed: new Date()
      });
      await course.save();
    });

    test('Student should create submission', async () => {
      const submissionData = {
        text: 'This is my submission content'
      };

      const response = await request(app)
        .post(`/api/submissions/assignment/${assignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(submissionData)
        .expect(201);

      expect(response.body.content.text).toBe(submissionData.text);
      expect(response.body.student._id).toBe(student._id.toString());
    });

    test('Student should update draft submission', async () => {
      // Create initial submission
      const createResponse = await request(app)
        .post(`/api/submissions/assignment/${assignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ text: 'Initial content' });

      const submissionId = createResponse.body._id;

      // Update submission
      const updateData = { text: 'Updated content' };
      const response = await request(app)
        .put(`/api/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.content.text).toBe('Updated content');
    });

    test('Student should submit assignment', async () => {
      // Create draft
      const createResponse = await request(app)
        .post(`/api/submissions/assignment/${assignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ text: 'My submission' });

      // Submit it
      const response = await request(app)
        .post(`/api/submissions/${createResponse.body._id}/submit`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.message).toBe('Submission submitted successfully');
    });

    test('Student should get own submissions', async () => {
      await request(app)
        .post(`/api/submissions/assignment/${assignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ text: 'My submission' });

      const response = await request(app)
        .get('/api/submissions/student')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.submissions).toHaveLength(1);
    });

    test('Student should not access other submissions', async () => {
      // Create another student and submission
      const otherStudent = new User({
        username: 'otherstudent',
        email: 'other@test.com',
        password: 'password123',
        firstName: 'Other',
        lastName: 'Student',
        role: 'student'
      });
      await otherStudent.save();

      const otherToken = (await request(app)
        .post('/api/users/login')
        .send({ email: 'other@test.com', password: 'password123' })).body.token;

      const otherSubmission = await request(app)
        .post(`/api/submissions/assignment/${assignment._id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ text: 'Other submission' });

      // Try to access other student's submission
      await request(app)
        .get(`/api/submissions/${otherSubmission.body._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });
  });

  describe('Grading System', () => {
    let submission;

    beforeEach(async () => {
      // Create submission for grading
      const submissionResponse = await request(app)
        .post(`/api/submissions/assignment/${assignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ text: 'My submission for grading' });

      submission = submissionResponse.body;
    });

    test('Instructor should create grade', async () => {
      const gradeData = {
        rubricScores: JSON.stringify([
          {
            criterion: rubric.criteria[0]._id,
            level: rubric.criteria[0].levels[0]._id,
            score: 50,
            feedback: 'Excellent work'
          },
          {
            criterion: rubric.criteria[1]._id,
            level: rubric.criteria[1].levels[1]._id,
            score: 40,
            feedback: 'Good presentation'
          }
        ]),
        overallFeedback: 'Overall great work!',
        strengths: JSON.stringify(['Clear content', 'Good structure']),
        improvements: JSON.stringify(['Add more examples']),
        nextSteps: JSON.stringify(['Practice more'])
      };

      const response = await request(app)
        .post(`/api/grading/submission/${submission._id}`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .send(gradeData)
        .expect(201);

      expect(response.body.scores.earned).toBe(90);
      expect(response.body.scores.percentage).toBe(90);
      expect(response.body.feedback.overall).toBe('Overall great work!');
    });

    test('Instructor should update grade', async () => {
      // Create initial grade
      const initialGrade = await request(app)
        .post(`/api/grading/submission/${submission._id}`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          rubricScores: JSON.stringify([{
            criterion: rubric.criteria[0]._id,
            level: rubric.criteria[0].levels[0]._id,
            score: 50,
            feedback: 'Good'
          }])
        });

      // Update grade
      const updateData = {
        rubricScores: JSON.stringify([{
          criterion: rubric.criteria[0]._id,
          level: rubric.criteria[0].levels[1]._id,
          score: 40,
          feedback: 'Updated feedback'
        }])
      };

      const response = await request(app)
        .put(`/api/grading/${initialGrade.body._id}`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.scores.earned).toBe(40);
    });

    test('Instructor should apply penalty', async () => {
      // Create grade
      const gradeResponse = await request(app)
        .post(`/api/grading/submission/${submission._id}`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          rubricScores: JSON.stringify([{
            criterion: rubric.criteria[0]._id,
            level: rubric.criteria[0].levels[0]._id,
            score: 50,
            feedback: 'Good'
          }])
        });

      const gradeId = gradeResponse.body._id;

      // Apply penalty
      const penaltyData = {
        type: 'late',
        amount: 10,
        reason: 'Submitted late'
      };

      const response = await request(app)
        .post(`/api/grading/${gradeId}/penalty`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .send(penaltyData)
        .expect(200);

      expect(response.body.grade.scores.earned).toBe(40); // 50 - 10 penalty
    });

    test('Instructor should release grade', async () => {
      // Create grade
      const gradeResponse = await request(app)
        .post(`/api/grading/submission/${submission._id}`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          rubricScores: JSON.stringify([{
            criterion: rubric.criteria[0]._id,
            level: rubric.criteria[0].levels[0]._id,
            score: 50,
            feedback: 'Good'
          }])
        });

      const gradeId = gradeResponse.body._id;

      // Release grade
      await request(app)
        .post(`/api/grading/${gradeId}/release`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .expect(200);
    });

    test('Student should not see unreleased grade', async () => {
      // Create grade (not released)
      await request(app)
        .post(`/api/grading/submission/${submission._id}`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          rubricScores: JSON.stringify([{
            criterion: rubric.criteria[0]._id,
            level: rubric.criteria[0].levels[0]._id,
            score: 50,
            feedback: 'Good'
          }])
        });

      // Student tries to view grade
      const response = await request(app)
        .get(`/api/grading/submission/${submission._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.grade).toBeNull();
    });

    test('Student should see released grade', async () => {
      // Create and release grade
      const gradeResponse = await request(app)
        .post(`/api/grading/submission/${submission._id}`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          rubricScores: JSON.stringify([{
            criterion: rubric.criteria[0]._id,
            level: rubric.criteria[0].levels[0]._id,
            score: 50,
            feedback: 'Good'
          }]),
          releaseImmediately: true
        });

      // Student views grade
      const response = await request(app)
        .get(`/api/grading/submission/${submission._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.grade).not.toBeNull();
      expect(response.body.grade.scores.earned).toBe(50);
    });
  });

  describe('Rubric Management', () => {
    test('Instructor should create rubric', async () => {
      const rubricData = {
        title: 'New Rubric',
        description: 'New rubric description',
        course: course._id,
        totalPoints: 100,
        criteria: [
          {
            title: 'Criterion 1',
            description: 'First criterion',
            weight: 100,
            levels: [
              { name: 'Excellent', description: 'Excellent work', points: 100 },
              { name: 'Good', description: 'Good work', points: 80 }
            ]
          }
        ]
      };

      const response = await request(app)
        .post('/api/rubrics')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send(rubricData)
        .expect(201);

      expect(response.body.title).toBe('New Rubric');
      expect(response.body.criteria).toHaveLength(1);
    });

    test('Student should not create rubric', async () => {
      const rubricData = {
        title: 'Student Rubric',
        course: course._id,
        totalPoints: 100,
        criteria: []
      };

      await request(app)
        .post('/api/rubrics')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(rubricData)
        .expect(403);
    });

    test('Instructor should duplicate rubric', async () => {
      const duplicateData = {
        title: 'Duplicated Rubric',
        courseId: course._id
      };

      const response = await request(app)
        .post(`/api/rubrics/${rubric._id}/duplicate`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .send(duplicateData)
        .expect(201);

      expect(response.body.title).toBe('Duplicated Rubric');
      expect(response.body.criteria).toHaveLength(2); // Same as original
    });
  });

  describe('File Upload Tests', () => {
    test('Student should upload file with submission', async () => {
      const response = await request(app)
        .post(`/api/submissions/assignment/${assignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('files', Buffer.from('test file content'), 'test.txt')
        .field('text', 'Submission with file')
        .expect(201);

      expect(response.body.content.files).toHaveLength(1);
      expect(response.body.content.files[0].originalName).toBe('test.txt');
    });

    test('Should reject oversized file', async () => {
      // Create large buffer (over 50MB limit)
      const largeBuffer = Buffer.alloc(60 * 1024 * 1024); // 60MB

      await request(app)
        .post(`/api/submissions/assignment/${assignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('files', largeBuffer, 'large.txt')
        .expect(400);
    });

    test('Should reject invalid file type', async () => {
      await request(app)
        .post(`/api/submissions/assignment/${assignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('files', Buffer.from('test'), 'invalid.exe')
        .expect(400);
    });
  });

  describe('Analytics Tests', () => {
    beforeEach(async () => {
      // Create multiple submissions and grades for analytics
      for (let i = 0; i < 5; i++) {
        const student = new User({
          username: `student${i}`,
          email: `student${i}@test.com`,
          password: 'password123',
          firstName: `Student${i}`,
          lastName: 'Test',
          role: 'student'
        });
        await student.save();

        const token = (await request(app)
          .post('/api/users/login')
          .send({ email: `student${i}@test.com`, password: 'password123' })).body.token;

        // Create submission
        const submissionResponse = await request(app)
          .post(`/api/submissions/assignment/${assignment._id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ text: `Submission ${i}` });

        // Create grade
        await request(app)
          .post(`/api/grading/submission/${submissionResponse.body._id}`)
          .set('Authorization', `Bearer ${instructorToken}`)
          .send({
            rubricScores: JSON.stringify([{
              criterion: rubric.criteria[0]._id,
              level: rubric.criteria[0].levels[0]._id,
              score: 50 + i * 10, // Varying scores
              feedback: 'Good'
            }])
          });
      }
    });

    test('Instructor should get assignment analytics', async () => {
      const response = await request(app)
        .get(`/api/assignments/${assignment._id}/analytics`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .expect(200);

      expect(response.body.totalSubmissions).toBe(5);
      expect(response.body.gradedCount).toBe(5);
      expect(response.body.averageGrade).toBeGreaterThan(0);
      expect(response.body.gradeDistribution).toBeDefined();
    });

    test('Instructor should get grading analytics', async () => {
      const response = await request(app)
        .get(`/api/grading/assignment/${assignment._id}/analytics`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .expect(200);

      expect(response.body.average).toBeGreaterThan(0);
      expect(response.body.distribution).toBeDefined();
      expect(response.body.gradingProgress).toBeDefined();
    });
  });
});
