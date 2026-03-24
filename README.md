# Starred Education - Course Content Delivery System

A comprehensive course content delivery system that supports multimedia content, interactive lessons, and progressive learning paths with offline capabilities.

## 🎯 Features

### Content Management Backend
- ✅ Content storage and retrieval API
- ✅ Media file management system
- ✅ Content versioning and updates
- ✅ Access control for premium content
- ✅ Content analytics tracking
- ✅ CDN integration support

### Frontend Content Player
- ✅ Video player with adaptive streaming
- ✅ Interactive lesson components
- ✅ Document viewer (PDF, presentations)
- ✅ Code editor for programming courses
- ✅ Quiz and assessment integration
- ✅ Progress tracking UI

### Learning Features
- ✅ Bookmark and note-taking system
- ✅ Offline content caching (IndexedDB)
- ✅ Adjustable playback speed
- ✅ Subtitle and transcript support
- ✅ Content search functionality
- ✅ Learning path navigation

### Content Types Support
- ✅ Video lessons (multiple formats)
- ✅ Audio lectures and podcasts
- ✅ Interactive text content
- ✅ Code examples and exercises
- ✅ Downloadable resources
- ✅ External link integration

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

2. **Install backend dependencies**
   ```bash
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd client
   npm install
   cd ..
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Start MongoDB**
   ```bash
   # Make sure MongoDB is running on your system
   mongod
   ```

6. **Start the development servers**
   ```bash
   # Start backend server (port 5000)
   npm run dev

   # In a new terminal, start frontend (port 3000)
   cd client
   npm start
   ```

7. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000/api

## 📁 Project Structure

```
starked-education/
├── models/                 # Database models
│   ├── Content.js          # Content model
│   ├── Course.js           # Course model
│   ├── Module.js           # Module model
│   ├── Progress.js         # Progress tracking model
│   └── User.js             # User model
├── routes/                 # API routes
│   ├── content.js          # Content management routes
│   ├── media.js            # Media streaming routes
│   ├── progress.js         # Progress tracking routes
│   ├── users.js            # User management routes
│   └── analytics.js        # Analytics routes
├── middleware/             # Express middleware
│   └── auth.js             # Authentication middleware
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   │   └── ContentPlayer/  # Content player components
│   │   ├── contexts/       # React contexts
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── utils/          # Utility functions
│   └── public/
├── tests/                  # Test files
├── media/                  # Media file storage
│   ├── videos/
│   ├── audio/
│   ├── documents/
│   └── images/
├── package.json
├── server.js               # Server entry point
└── README.md
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/starked-education

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key

# Client URL
CLIENT_URL=http://localhost:3000

# AWS S3 Configuration (for media storage)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=starked-education-media

# CDN Configuration
CDN_URL=https://cdn.your-domain.com

# Redis Configuration (for caching)
REDIS_URL=redis://localhost:6379
```

## 🎮 Usage

### For Students

1. **Register/Login**: Create an account or login to access courses
2. **Browse Courses**: Explore available courses and content
3. **Enroll**: Enroll in courses to track progress
4. **Learn**: Access video, audio, documents, and interactive content
5. **Track Progress**: Monitor your learning progress and achievements
6. **Take Notes**: Add notes and bookmarks while learning
7. **Offline Access**: Download content for offline learning

### For Instructors

1. **Create Courses**: Design and create comprehensive courses
2. **Upload Content**: Add various content types (video, audio, documents, code)
3. **Organize Modules**: Structure content into logical modules
4. **Track Analytics**: Monitor student engagement and progress
5. **Manage Access**: Control premium content access
6. **Interact**: Engage with students through discussions and feedback

### For Administrators

1. **User Management**: Manage users, roles, and permissions
2. **Content Moderation**: Review and approve content
3. **Platform Analytics**: Monitor platform usage and performance
4. **System Configuration**: Configure system settings and integrations

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

### Test Coverage

The test suite covers:
- API endpoints and routes
- Database models and validation
- Authentication and authorization
- Content management
- Progress tracking
- Media streaming
- Error handling

## 📊 Content Types

### Video Content
- Multiple format support (MP4, WebM, AVI)
- Adaptive streaming with HLS
- Quality selection (360p, 480p, 720p, 1080p)
- Subtitle support (VTT, SRT)
- Playback speed control
- Progress tracking and bookmarking

### Audio Content
- Format support (MP3, WAV, AAC)
- Chapter navigation
- Transcript integration
- Speed control
- Background playback

### Document Content
- PDF viewer with annotations
- Presentation viewer
- Text content with markdown
- Downloadable resources
- Page tracking

### Code Content
- Interactive code editor
- Multiple language support
- Real-time execution
- Syntax highlighting
- Code completion
- Version control integration

## 🔄 Offline Functionality

### IndexedDB Storage
- Content metadata caching
- File storage for offline access
- Progress synchronization
- Note and bookmark storage
- Conflict resolution

### Sync Mechanism
- Automatic sync when online
- Queue management for offline actions
- Conflict resolution strategies
- Progress restoration

## 📈 Analytics

### Content Analytics
- View counts and completion rates
- Engagement metrics
- Drop-off points
- Performance insights

### Learning Analytics
- Progress tracking
- Learning patterns
- Time spent analysis
- Achievement tracking

### Platform Analytics
- User engagement
- Course popularity
- System performance
- Revenue tracking

## 🔒 Security

### Authentication
- JWT-based authentication
- Role-based access control
- Password hashing with bcrypt
- Session management

### Content Protection
- Premium content access control
- File encryption
- Secure streaming
- Rate limiting

### Data Protection
- Input validation
- SQL injection prevention
- XSS protection
- CORS configuration

## 🚀 Deployment

### Production Setup

1. **Environment Setup**
   ```bash
   export NODE_ENV=production
   export MONGODB_URI=mongodb://your-production-db
   ```

2. **Build Frontend**
   ```bash
   cd client
   npm run build
   ```

3. **Start Production Server**
   ```bash
   npm start
   ```

### Docker Deployment

```bash
# Build Docker image
docker build -t starked-education .

# Run container
docker run -p 5000:5000 starked-education
```

### Cloud Deployment

The application is designed to work with:
- **AWS**: EC2, S3, CloudFront, RDS
- **Google Cloud**: Compute Engine, Cloud Storage, Cloud SQL
- **Azure**: Virtual Machines, Blob Storage, SQL Database
- **Heroku**: Easy deployment with Procfile
- **Vercel**: Frontend deployment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style
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
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [HLS.js](https://hls-js.com/) for video streaming
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) for code editing

## 📊 Project Status

- ✅ Backend API complete
- ✅ Frontend content player complete
- ✅ Offline functionality implemented
- ✅ Testing suite comprehensive
- ✅ Documentation complete
- 🚀 Ready for production deployment

---

**Built with ❤️ for the education community**
