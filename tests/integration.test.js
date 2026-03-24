const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Course = require('../models/Course');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Grade = require('../models/Grade');
const Rubric = require('../models/Rubric');
const Group = require('../models/Group');

describe('Integration Tests', () => {
  let instructorToken, studentToken, adminToken;
  let instructor, student, admin, course, assignment, rubric;

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
    await Group.deleteMany({});

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
  });

  describe('Complete Assignment Workflow', () => {
    test('Should handle end-to-end assignment lifecycle', async () => {
      // 1. Create rubric
      const rubricResponse = await request(app)
        .post('/api/rubrics')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          title: 'Integration Test Rubric',
          description: 'Rubric for integration testing',
          course: course._id,
          totalPoints: 100,
          criteria: [
            {
              title: 'Content Quality',
              description: 'Quality of the content',
              weight: 60,
              levels: [
                { name: 'Excellent', description: 'Outstanding content', points: 60 },
                { name: 'Good', description: 'Good content', points: 50 },
                { name: 'Fair', description: 'Fair content', points: 40 }
              ]
            },
            {
              title: 'Presentation',
              description: 'Quality of presentation',
              weight: 40,
              levels: [
                { name: 'Excellent', description: 'Outstanding presentation', points: 40 },
                { name: 'Good', description: 'Good presentation', points: 30 },
                { name: 'Fair', description: 'Fair presentation', points: 20 }
              ]
            }
          ]
        })
        .expect(201);

      rubric = rubricResponse.body;

      // 2. Create assignment
      const assignmentResponse = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          title: 'Integration Test Assignment',
          description: 'Assignment for integration testing',
          instructions: 'Complete this assignment for testing',
          course: course._id,
          type: 'mixed',
          submissionTypes: ['text', 'file', 'code'],
          points: 100,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          rubric: rubric._id,
          plagiarismDetection: {
            enabled: true,
            sensitivity: 'medium',
            checkAgainstInternet: true,
            checkAgainstPeers: true
          }
        })
        .expect(201);

      assignment = assignmentResponse.body;

      // 3. Enroll student in course
      course.enrolledStudents.push({
        student: student._id,
        enrolledAt: new Date(),
        progress: 0,
        lastAccessed: new Date()
      });
      await course.save();

      // 4. Publish assignment
      await request(app)
        .post(`/api/assignments/${assignment._id}/publish`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .expect(200);

      // 5. Student views assignment
      const viewResponse = await request(app)
        .get(`/api/assignments/${assignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(viewResponse.body.assignment.title).toBe('Integration Test Assignment');
      expect(viewResponse.body.canSubmit).toBe(true);

      // 6. Student creates draft submission
      const draftResponse = await request(app)
        .post(`/api/submissions/assignment/${assignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          text: 'This is my draft submission',
          code: JSON.stringify([{
            language: 'javascript',
            code: 'console.log("Hello, World!");',
            filename: 'hello.js'
          }]),
          links: JSON.stringify([{
            title: 'Reference',
            url: 'https://example.com',
            description: 'Reference material'
          }])
        })
        .expect(201);

      const submission = draftResponse.body;
      expect(submission.status).toBe('draft');
      expect(submission.content.text).toBe('This is my draft submission');
      expect(submission.content.code).toHaveLength(1);
      expect(submission.content.links).toHaveLength(1);

      // 7. Student updates draft
      await request(app)
        .put(`/api/submissions/${submission._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          text: 'This is my updated draft submission'
        })
        .expect(200);

      // 8. Student submits assignment
      await request(app)
        .post(`/api/submissions/${submission._id}/submit`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      // 9. Instructor views submissions
      const submissionsResponse = await request(app)
        .get(`/api/assignments/${assignment._id}/submissions`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .expect(200);

      expect(submissionsResponse.body.submissions).toHaveLength(1);
      expect(submissionsResponse.body.stats.total).toBe(1);
      expect(submissionsResponse.body.stats.submitted).toBe(1);

      // 10. Instructor grades submission
      const gradeResponse = await request(app)
        .post(`/api/grading/submission/${submission._id}`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          rubricScores: JSON.stringify([
            {
              criterion: rubric.criteria[0]._id,
              level: rubric.criteria[0].levels[0]._id,
              score: 60,
              feedback: 'Excellent content quality'
            },
            {
              criterion: rubric.criteria[1]._id,
              level: rubric.criteria[1].levels[1]._id,
              score: 30,
              feedback: 'Good presentation'
            }
          ]),
          overallFeedback: 'Overall excellent work! Keep up the good effort.',
          strengths: JSON.stringify(['Clear and concise writing', 'Good examples']),
          improvements: JSON.stringify(['Add more citations', 'Improve formatting']),
          nextSteps: JSON.stringify(['Practice more complex problems', 'Review style guidelines']),
          releaseImmediately: false
        })
        .expect(201);

      const grade = gradeResponse.body;
      expect(grade.scores.earned).toBe(90);
      expect(grade.scores.percentage).toBe(90);
      expect(grade.feedback.overall).toContain('excellent work');

      // 11. Student tries to view grade (should not see it yet)
      const studentGradeResponse = await request(app)
        .get(`/api/grading/submission/${submission._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(studentGradeResponse.body.grade).toBeNull();

      // 12. Instructor releases grade
      await request(app)
        .post(`/api/grading/${grade._id}/release`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .expect(200);

      // 13. Student views released grade
      const releasedGradeResponse = await request(app)
        .get(`/api/grading/submission/${submission._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(releasedGradeResponse.body.grade).not.toBeNull();
      expect(releasedGradeResponse.body.grade.scores.earned).toBe(90);

      // 14. Verify assignment analytics
      const analyticsResponse = await request(app)
        .get(`/api/assignments/${assignment._id}/analytics`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .expect(200);

      expect(analyticsResponse.body.totalSubmissions).toBe(1);
      expect(analyticsResponse.body.gradedCount).toBe(1);
      expect(analyticsResponse.body.averageGrade).toBe(90);
    });

    test('Should handle group assignment workflow', async () => {
      // Create group assignment
      const groupAssignment = new Assignment({
        title: 'Group Test Assignment',
        description: 'Group assignment for testing',
        instructions: 'Complete this assignment as a group',
        course: course._id,
        instructor: instructor._id,
        type: 'file',
        submissionTypes: ['file'],
        points: 100,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        groupAssignment: {
          enabled: true,
          minGroupSize: 2,
          maxGroupSize: 3,
          allowSelfGrouping: true
        }
      });
      await groupAssignment.save();

      // Create additional student for group
      const student2 = new User({
        username: 'student2',
        email: 'student2@test.com',
        password: 'password123',
        firstName: 'Student',
        lastName: 'Two',
        role: 'student'
      });
      await student2.save();

      // Enroll both students
      course.enrolledStudents.push(
        { student: student._id, enrolledAt: new Date(), progress: 0, lastAccessed: new Date() },
        { student: student2._id, enrolledAt: new Date(), progress: 0, lastAccessed: new Date() }
      );
      await course.save();

      // Get student2 token
      const student2Res = await request(app)
        .post('/api/users/login')
        .send({ email: 'student2@test.com', password: 'password123' });
      const student2Token = student2Res.body.token;

      // Create group
      const groupResponse = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          name: 'Test Group',
          description: 'Group for testing',
          course: course._id,
          assignment: groupAssignment._id,
          maxMembers: 3
        })
        .expect(201);

      const group = groupResponse.body;
      expect(group.name).toBe('Test Group');
      expect(group.members).toHaveLength(1);

      // Add second member to group
      await request(app)
        .post(`/api/groups/${group._id}/members`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          studentId: student2._id,
          role: 'member'
        })
        .expect(200);

      // Submit group assignment
      await request(app)
        .post(`/api/submissions/assignment/${groupAssignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('files', Buffer.from('Group submission content'), 'group-submission.txt')
        .field('text', 'Group submission content')
        .expect(201);

      // Verify group submission
      const submissions = await Submission.find({ assignment: groupAssignment._id });
      expect(submissions).toHaveLength(1);
      expect(submissions[0].group.toString()).toBe(group._id.toString());
    });

    test('Should handle late submission workflow', async () => {
      // Create assignment with late submission allowed
      const lateAssignment = new Assignment({
        title: 'Late Submission Test',
        description: 'Test late submissions',
        instructions: 'Submit this assignment',
        course: course._id,
        instructor: instructor._id,
        type: 'text',
        submissionTypes: ['text'],
        points: 100,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        lateSubmissionAllowed: true,
        latePenalty: 10,
        lateDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
      });
      await lateAssignment.save();

      // Enroll student
      course.enrolledStudents.push({
        student: student._id,
        enrolledAt: new Date(),
        progress: 0,
        lastAccessed: new Date()
      });
      await course.save();

      // Submit late
      const submissionResponse = await request(app)
        .post(`/api/submissions/assignment/${lateAssignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ text: 'Late submission content' })
        .expect(201);

      const submission = submissionResponse.body;
      expect(submission.isLate).toBe(true);
      expect(submission.latePenaltyApplied).toBe(10);

      // Grade with late penalty
      const gradeResponse = await request(app)
        .post(`/api/grading/submission/${submission._id}`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          rubricScores: JSON.stringify([{
            criterion: new mongoose.Types.ObjectId(),
            level: new mongoose.Types.ObjectId(),
            score: 100,
            feedback: 'Good work'
          }])
        })
        .expect(201);

      const grade = gradeResponse.body;
      expect(grade.scores.earned).toBe(90); // 100 - 10 penalty
    });
  });

  describe('Permission and Access Control', () => {
    test('Should enforce proper access controls', async () => {
      // Create assignment
      const assignmentResponse = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          title: 'Access Control Test',
          description: 'Test access controls',
          course: course._id,
          type: 'text',
          points: 100,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        })
        .expect(201);

      const testAssignment = assignmentResponse.body;

      // Enroll student
      course.enrolledStudents.push({
        student: student._id,
        enrolledAt: new Date(),
        progress: 0,
        lastAccessed: new Date()
      });
      await course.save();

      // Student should not access instructor endpoints
      await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Student Assignment',
          course: course._id,
          type: 'text',
          points: 50
        })
        .expect(403);

      // Student should not modify assignment
      await request(app)
        .put(`/api/assignments/${testAssignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ title: 'Modified by student' })
        .expect(403);

      // Student should not delete assignment
      await request(app)
        .delete(`/api/assignments/${testAssignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);

      // Student should not access other student's submissions
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

      // Enroll other student
      course.enrolledStudents.push({
        student: otherStudent._id,
        enrolledAt: new Date(),
        progress: 0,
        lastAccessed: new Date()
      });
      await course.save();

      // Create submission by other student
      const otherSubmission = await request(app)
        .post(`/api/submissions/assignment/${testAssignment._id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ text: 'Other student submission' });

      // First student should not access other's submission
      await request(app)
        .get(`/api/submissions/${otherSubmission.body._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);

      // Admin should have access to everything
      await request(app)
        .get(`/api/assignments/${testAssignment._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app)
        .get(`/api/submissions/${otherSubmission.body._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Data Validation and Error Handling', () => {
    test('Should validate assignment data properly', async () => {
      // Test missing required fields
      await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          description: 'Missing title'
        })
        .expect(400);

      // Test invalid data types
      await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          title: 'Invalid Assignment',
          description: 'Test',
          course: course._id,
          type: 'invalid_type',
          points: 'not_a_number',
          dueDate: 'invalid_date'
        })
        .expect(400);

      // Test valid assignment
      await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          title: 'Valid Assignment',
          description: 'Valid description',
          course: course._id,
          type: 'text',
          points: 100,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        })
        .expect(201);
    });

    test('Should handle file upload validation', async () => {
      // Create assignment
      const assignmentResponse = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          title: 'File Upload Test',
          description: 'Test file uploads',
          course: course._id,
          type: 'file',
          submissionTypes: ['file'],
          maxFileSize: 1024 * 1024, // 1MB
          maxFiles: 2,
          points: 100,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        })
        .expect(201);

      const testAssignment = assignmentResponse.body;

      // Enroll student
      course.enrolledStudents.push({
        student: student._id,
        enrolledAt: new Date(),
        progress: 0,
        lastAccessed: new Date()
      });
      await course.save();

      // Test oversized file
      const largeBuffer = Buffer.alloc(2 * 1024 * 1024); // 2MB
      await request(app)
        .post(`/api/submissions/assignment/${testAssignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('files', largeBuffer, 'large.txt')
        .expect(400);

      // Test too many files
      await request(app)
        .post(`/api/submissions/assignment/${testAssignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('files', Buffer.from('file1'), 'file1.txt')
        .attach('files', Buffer.from('file2'), 'file2.txt')
        .attach('files', Buffer.from('file3'), 'file3.txt')
        .expect(400);

      // Test valid file upload
      await request(app)
        .post(`/api/submissions/assignment/${testAssignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('files', Buffer.from('valid content'), 'valid.txt')
        .expect(201);
    });
  });

  describe('System Integration', () => {
    test('Should integrate with existing course system', async () => {
      // Verify assignment appears in course
      await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          title: 'Course Integration Test',
          description: 'Test course integration',
          course: course._id,
          type: 'text',
          points: 100,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        })
        .expect(201);

      // Check course assignments
      const courseWithAssignments = await Course.findById(course._id).populate('assignments');
      expect(courseWithAssignments.assignments).toHaveLength(1);
      expect(courseWithAssignments.assignments[0].title).toBe('Course Integration Test');
    });

    test('Should maintain user progress tracking', async () => {
      // Create assignment
      const assignmentResponse = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          title: 'Progress Tracking Test',
          description: 'Test progress tracking',
          course: course._id,
          type: 'text',
          points: 100,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        })
        .expect(201);

      const testAssignment = assignmentResponse.body;

      // Enroll student
      course.enrolledStudents.push({
        student: student._id,
        enrolledAt: new Date(),
        progress: 0,
        lastAccessed: new Date()
      });
      await course.save();

      // Submit assignment
      await request(app)
        .post(`/api/submissions/assignment/${testAssignment._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ text: 'Progress test submission' })
        .expect(201);

      // Grade assignment
      const gradeResponse = await request(app)
        .post(`/api/grading/submission/`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          rubricScores: JSON.stringify([{
            criterion: new mongoose.Types.ObjectId(),
            level: new mongoose.Types.ObjectId(),
            score: 85,
            feedback: 'Good work'
          }])
        });

      // Verify student record is updated
      const updatedStudent = await User.findById(student._id);
      expect(updatedStudent.enrolledStudents).toHaveLength(1);
    });
  });
});
