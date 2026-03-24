# Assignment Submission and Grading System

A comprehensive assignment submission and grading system built for the Starred Education platform. This system handles various submission types, supports instructor grading workflows, provides detailed feedback to students, and includes plagiarism detection capabilities.

## 🎯 Features

### Assignment Management
- ✅ Multiple assignment types (text, file, code, video, audio, mixed)
- ✅ Flexible submission requirements and deadlines
- ✅ Late submission policies and penalties
- ✅ Draft saving and auto-save functionality
- ✅ Assignment publishing and visibility controls
- ✅ Group assignment support

### Submission System
- ✅ Multi-format file uploads with validation
- ✅ Rich text editor for written submissions
- ✅ Code editor with syntax highlighting
- ✅ Video and audio submission support
- ✅ External link submissions
- ✅ Real-time auto-save functionality
- ✅ Submission history and tracking

### Grading Workflow
- ✅ Rubric-based grading system
- ✅ Inline commenting and annotations
- ✅ Grade calculation and weighting
- ✅ Bulk grading operations
- ✅ Grade moderation and appeals
- ✅ Scheduled grade release
- ✅ Audio and visual feedback support

### Plagiarism Detection
- ✅ Automatic plagiarism checking
- ✅ Internet and peer comparison
- ✅ Configurable sensitivity levels
- ✅ Detailed similarity reports
- ✅ Source attribution and flagged sections

### Analytics and Reporting
- ✅ Assignment performance analytics
- ✅ Grade distribution statistics
- ✅ Submission timeline tracking
- ✅ Class performance metrics
- ✅ Individual student progress

## 📁 Project Structure

```
starked-education/
├── models/                     # Database models
│   ├── Assignment.js           # Assignment definition model
│   ├── Submission.js          # Student submission model
│   ├── Grade.js               # Grade and feedback model
│   ├── Rubric.js              # Grading rubric model
│   └── Group.js               # Group assignment model
├── routes/                     # API routes
│   ├── assignments.js         # Assignment management endpoints
│   ├── submissions.js         # Submission handling endpoints
│   ├── grading.js             # Grading workflow endpoints
│   └── rubrics.js            # Rubric management endpoints
├── services/                   # Business logic services
│   └── plagiarismService.js   # Plagiarism detection service
├── client/src/                 # Frontend components
│   ├── components/
│   │   ├── AssignmentSubmission/
│   │   │   └── AssignmentSubmission.jsx
│   │   └── GradingInterface/
│   │       └── GradingInterface.jsx
│   └── services/
│       ├── assignmentService.js
│       ├── submissionService.js
│       ├── gradingService.js
│       └── rubricService.js
└── tests/                      # Test suite
    ├── assignment.test.js     # Assignment system tests
    ├── plagiarism.test.js     # Plagiarism detection tests
    ├── concurrent.test.js     # Concurrent operation tests
    └── integration.test.js    # End-to-end integration tests
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/sheyman546/starked-education.git
   cd starked-education
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd client && npm install && cd ..
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start MongoDB**
   ```bash
   mongod
   ```

5. **Start development servers**
   ```bash
   # Backend server (port 5000)
   npm run dev

   # Frontend (port 3000) - in new terminal
   cd client && npm start
   ```

## 📖 API Documentation

### Assignment Management

#### Get Course Assignments
```http
GET /api/assignments/course/:courseId
Authorization: Bearer <token>
```

#### Create Assignment
```http
POST /api/assignments
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Assignment Title",
  "description": "Assignment description",
  "instructions": "Assignment instructions",
  "course": "courseId",
  "type": "text|file|code|video|audio|mixed",
  "submissionTypes": ["text", "file"],
  "points": 100,
  "dueDate": "2024-01-15T23:59:59Z",
  "rubric": "rubricId"
}
```

#### Update Assignment
```http
PUT /api/assignments/:assignmentId
Authorization: Bearer <token>
Content-Type: application/json
```

#### Delete Assignment
```http
DELETE /api/assignments/:assignmentId
Authorization: Bearer <token>
```

### Submission Management

#### Create/Update Submission
```http
POST /api/submissions/assignment/:assignmentId
Authorization: Bearer <token>
Content-Type: multipart/form-data

text=Submission content
code=[{"language": "javascript", "code": "console.log('hello')"}]
links=[{"title": "Reference", "url": "https://example.com"}]
files=@file.txt
```

#### Submit Assignment
```http
POST /api/submissions/:submissionId/submit
Authorization: Bearer <token>
```

#### Get Student Submissions
```http
GET /api/submissions/student
Authorization: Bearer <token>
```

### Grading System

#### Create Grade
```http
POST /api/grading/submission/:submissionId
Authorization: Bearer <token>
Content-Type: multipart/form-data

rubricScores=[{"criterion": "id", "level": "id", "score": 85, "feedback": "Good work"}]
overallFeedback=Overall feedback
strengths=["Clear writing", "Good examples"]
improvements=["Add more detail"]
nextSteps=["Practice advanced topics"]
```

#### Update Grade
```http
PUT /api/grading/:gradeId
Authorization: Bearer <token>
```

#### Release Grade
```http
POST /api/grading/:gradeId/release
Authorization: Bearer <token>
```

#### Bulk Operations
```http
POST /api/grading/bulk
Authorization: Bearer <token>
Content-Type: application/json

{
  "submissionIds": ["id1", "id2"],
  "action": "release|apply-penalty|apply-bonus",
  "data": {
    "penaltyType": "late",
    "penaltyAmount": 10,
    "penaltyReason": "Late submission"
  }
}
```

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Test Coverage Areas
- ✅ Assignment management workflows
- ✅ Submission creation and validation
- ✅ Grading operations and calculations
- ✅ Plagiarism detection functionality
- ✅ File upload and processing
- ✅ Concurrent operations handling
- ✅ Permission and access control
- ✅ Data validation and error handling
- ✅ End-to-end integration scenarios

## 🔧 Configuration

### Environment Variables

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/starked-education
MONGODB_TEST_URI=mongodb://localhost:27017/starked-education-test

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key

# Client URL
CLIENT_URL=http://localhost:3000

# File Upload Configuration
MAX_FILE_SIZE=52428800  # 50MB
MAX_FILES=5

# Plagiarism Detection
PLAGIARISM_API_KEY=your-plagiarism-api-key
PLAGIARISM_API_URL=https://api.plagiarismcheck.org/v1

# AWS S3 (for file storage)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=starked-education-files
```

## 📊 Database Schema

### Assignment Model
```javascript
{
  title: String,
  description: String,
  instructions: String,
  course: ObjectId,
  instructor: ObjectId,
  type: String, // text, file, code, video, audio, mixed
  submissionTypes: [String],
  allowedFileTypes: [String],
  maxFileSize: Number,
  maxFiles: Number,
  rubric: ObjectId,
  points: Number,
  dueDate: Date,
  lateSubmissionAllowed: Boolean,
  latePenalty: Number,
  plagiarismDetection: Object,
  groupAssignment: Object,
  isPublished: Boolean
}
```

### Submission Model
```javascript
{
  assignment: ObjectId,
  student: ObjectId,
  group: ObjectId,
  status: String, // draft, submitted, graded, returned
  content: {
    text: String,
    files: [Object],
    code: [Object],
    links: [Object],
    video: [Object],
    audio: [Object]
  },
  submissionDate: Date,
  isLate: Boolean,
  plagiarism: Object,
  grade: ObjectId
}
```

### Grade Model
```javascript
{
  submission: ObjectId,
  assignment: ObjectId,
  student: ObjectId,
  grader: ObjectId,
  status: String,
  scores: {
    total: Number,
    earned: Number,
    percentage: Number,
    weighted: Number
  },
  rubricResults: [Object],
  feedback: Object,
  penalties: [Object],
  bonuses: [Object],
  release: Object
}
```

## 🔒 Security

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (student, instructor, admin)
- Resource ownership validation
- API rate limiting

### Data Protection
- Input validation and sanitization
- File type and size validation
- SQL injection prevention
- XSS protection
- CORS configuration

### File Security
- Virus scanning integration
- Secure file storage
- Access control for file downloads
- Temporary file cleanup

## 📈 Performance

### Optimization Features
- Database indexing for queries
- File compression and caching
- Lazy loading for large datasets
- Pagination for API responses
- Background job processing

### Scalability
- Horizontal scaling support
- Load balancing ready
- Database connection pooling
- CDN integration for media files

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style
- Write tests for new features
- Update documentation
- Ensure all tests pass
- Use meaningful commit messages

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/sheyman546/starked-education/issues) page
2. Create a new issue with detailed information
3. Join our [Discord](https://discord.gg/starked-education) community
4. Email us at support@starked-education.com

## 🙏 Acknowledgments

- [React](https://reactjs.org/) for the frontend framework
- [Node.js](https://nodejs.org/) for the backend runtime
- [MongoDB](https://www.mongodb.com/) for the database
- [Multer](https://github.com/expressjs/multer) for file uploads
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) for code editing
- [React Dropzone](https://react-dropzone.js.org/) for file uploads
- [Tailwind CSS](https://tailwindcss.com/) for styling

## 📊 Project Status

- ✅ Backend API complete
- ✅ Frontend components complete
- ✅ Plagiarism detection integrated
- ✅ Testing suite comprehensive
- ✅ Documentation complete
- ✅ Security measures implemented
- 🚀 Ready for production deployment

---

## 🎯 Acceptance Criteria Met

- ✅ Students can submit various assignment types (text, files, code, video, audio)
- ✅ Instructors can grade efficiently with rubrics
- ✅ Plagiarism detection works effectively
- ✅ Feedback is timely and helpful
- ✅ System handles large file uploads
- ✅ Draft saving and auto-save functionality
- ✅ Late submission policies and penalties
- ✅ Group assignment support
- ✅ Grade release scheduling
- ✅ Comprehensive analytics and reporting
- ✅ Bulk grading operations
- ✅ Peer review system support
- ✅ Mobile-responsive interface
- ✅ Accessibility compliance

---

**Built with ❤️ for the education community**
