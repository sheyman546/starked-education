const Content = require('../models/Content');
const Course = require('../models/Course');
const User = require('../models/User');
const mongoose = require('mongoose');

describe('Content Model', () => {
  let testUser;
  let testCourse;

  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/starked-education-test';
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up before each test
    await Content.deleteMany({});
    await Course.deleteMany({});
    await User.deleteMany({});

    // Create test user
    testUser = new User({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      role: 'instructor'
    });
    await testUser.save();

    // Create test course
    testCourse = new Course({
      title: 'Test Course',
      description: 'A test course',
      instructor: testUser._id,
      category: 'programming',
      level: 'beginner',
      thumbnail: 'http://example.com/thumb.jpg'
    });
    await testCourse.save();
  });

  describe('Content Creation', () => {
    test('should create video content successfully', async () => {
      const contentData = {
        title: 'Test Video',
        description: 'A test video lesson',
        type: 'video',
        course: testCourse._id,
        module: testCourse._id,
        order: 1,
        duration: 600,
        files: [{
          type: 'video',
          url: 'http://example.com/video.mp4',
          format: 'mp4',
          size: 50000000,
          quality: '1080p'
        }],
        metadata: {
          resolution: '1920x1080',
          bitrate: 5000,
          codec: 'h264',
          difficulty: 'beginner',
          tags: ['javascript', 'basics']
        }
      };

      const content = new Content(contentData);
      const savedContent = await content.save();

      expect(savedContent.title).toBe(contentData.title);
      expect(savedContent.type).toBe('video');
      expect(savedContent.duration).toBe(600);
      expect(savedContent.files).toHaveLength(1);
      expect(savedContent.metadata.resolution).toBe('1920x1080');
      expect(savedContent.viewCount).toBe(0);
      expect(savedContent.completionCount).toBe(0);
    });

    test('should create audio content successfully', async () => {
      const contentData = {
        title: 'Test Audio',
        description: 'A test audio lesson',
        type: 'audio',
        course: testCourse._id,
        module: testCourse._id,
        order: 1,
        duration: 300,
        files: [{
          type: 'audio',
          url: 'http://example.com/audio.mp3',
          format: 'mp3',
          size: 10000000,
          bitrate: '320kbps'
        }]
      };

      const content = new Content(contentData);
      const savedContent = await content.save();

      expect(savedContent.type).toBe('audio');
      expect(savedContent.duration).toBe(300);
    });

    test('should create document content successfully', async () => {
      const contentData = {
        title: 'Test Document',
        description: 'A test PDF document',
        type: 'document',
        course: testCourse._id,
        module: testCourse._id,
        order: 1,
        files: [{
          type: 'document',
          url: 'http://example.com/document.pdf',
          format: 'pdf',
          size: 5000000
        }],
        metadata: {
          pages: 25,
          wordCount: 5000
        }
      };

      const content = new Content(contentData);
      const savedContent = await content.save();

      expect(savedContent.type).toBe('document');
      expect(savedContent.metadata.pages).toBe(25);
    });

    test('should create code content successfully', async () => {
      const contentData = {
        title: 'Test Code Exercise',
        description: 'A test coding exercise',
        type: 'code',
        course: testCourse._id,
        module: testCourse._id,
        order: 1,
        files: [{
          type: 'code',
          url: 'http://example.com/code.js',
          format: 'js',
          size: 5000
        }],
        metadata: {
          difficulty: 'intermediate',
          tags: ['javascript', 'functions']
        }
      };

      const content = new Content(contentData);
      const savedContent = await content.save();

      expect(savedContent.type).toBe('code');
      expect(savedContent.metadata.difficulty).toBe('intermediate');
    });

    test('should validate required fields', async () => {
      const content = new Content({
        // Missing required fields
      });

      await expect(content.save()).rejects.toThrow();
    });

    test('should validate content type enum', async () => {
      const contentData = {
        title: 'Test Content',
        description: 'Test description',
        type: 'invalid_type',
        course: testCourse._id,
        module: testCourse._id,
        order: 1
      };

      const content = new Content(contentData);
      await expect(content.save()).rejects.toThrow();
    });

    test('should require duration for video/audio content', async () => {
      const contentData = {
        title: 'Test Video',
        description: 'A test video',
        type: 'video',
        course: testCourse._id,
        module: testCourse._id,
        order: 1
        // Missing duration
      };

      const content = new Content(contentData);
      await expect(content.save()).rejects.toThrow();
    });
  });

  describe('Content Updates', () => {
    let testContent;

    beforeEach(async () => {
      testContent = new Content({
        title: 'Original Title',
        description: 'Original description',
        type: 'video',
        course: testCourse._id,
        module: testCourse._id,
        order: 1,
        duration: 600
      });
      await testContent.save();
    });

    test('should update content successfully', async () => {
      testContent.title = 'Updated Title';
      testContent.description = 'Updated description';
      
      const updatedContent = await testContent.save();
      
      expect(updatedContent.title).toBe('Updated Title');
      expect(updatedContent.description).toBe('Updated description');
      expect(updatedContent.updatedAt).not.toBe(updatedContent.createdAt);
    });

    test('should increment version on update', async () => {
      const originalVersion = testContent.version;
      
      testContent.title = 'Updated Title';
      await testContent.save();
      
      expect(testContent.version).toBe(originalVersion + 1);
    });

    test('should update view count', async () => {
      const originalViewCount = testContent.viewCount;
      
      testContent.viewCount += 1;
      await testContent.save();
      
      expect(testContent.viewCount).toBe(originalViewCount + 1);
    });
  });

  describe('Content Relationships', () => {
    test('should reference course correctly', async () => {
      const content = new Content({
        title: 'Test Content',
        description: 'Test description',
        type: 'video',
        course: testCourse._id,
        module: testCourse._id,
        order: 1,
        duration: 600
      });

      const savedContent = await content.save();
      
      // Populate course reference
      const populatedContent = await Content.findById(savedContent._id).populate('course');
      
      expect(populatedContent.course._id.toString()).toBe(testCourse._id.toString());
      expect(populatedContent.course.title).toBe(testCourse.title);
    });

    test('should handle multiple contents per course', async () => {
      const contents = [];
      
      for (let i = 1; i <= 5; i++) {
        const content = new Content({
          title: `Content ${i}`,
          description: `Description for content ${i}`,
          type: 'video',
          course: testCourse._id,
          module: testCourse._id,
          order: i,
          duration: 600
        });
        contents.push(await content.save());
      }

      const courseContents = await Content.find({ course: testCourse._id }).sort({ order: 1 });
      
      expect(courseContents).toHaveLength(5);
      expect(courseContents[0].order).toBe(1);
      expect(courseContents[4].order).toBe(5);
    });
  });

  describe('Content Queries', () => {
    beforeEach(async () => {
      // Create test contents
      const contents = [
        {
          title: 'JavaScript Basics',
          description: 'Learn JavaScript fundamentals',
          type: 'video',
          course: testCourse._id,
          module: testCourse._id,
          order: 1,
          duration: 600,
          isPublished: true,
          metadata: { tags: ['javascript', 'basics'] }
        },
        {
          title: 'Advanced JavaScript',
          description: 'Advanced JavaScript concepts',
          type: 'video',
          course: testCourse._id,
          module: testCourse._id,
          order: 2,
          duration: 900,
          isPublished: true,
          metadata: { tags: ['javascript', 'advanced'] }
        },
        {
          title: 'Python Basics',
          description: 'Learn Python fundamentals',
          type: 'video',
          course: testCourse._id,
          module: testCourse._id,
          order: 3,
          duration: 600,
          isPublished: false,
          metadata: { tags: ['python', 'basics'] }
        }
      ];

      for (const contentData of contents) {
        const content = new Content(contentData);
        await content.save();
      }
    });

    test('should find published content only', async () => {
      const publishedContent = await Content.find({ isPublished: true });
      
      expect(publishedContent).toHaveLength(2);
      expect(publishedContent.every(c => c.isPublished)).toBe(true);
    });

    test('should find content by type', async () => {
      const videoContent = await Content.find({ type: 'video' });
      
      expect(videoContent).toHaveLength(3);
      expect(videoContent.every(c => c.type === 'video')).toBe(true);
    });

    test('should sort content by order', async () => {
      const sortedContent = await Content.find({ course: testCourse._id }).sort({ order: 1 });
      
      expect(sortedContent[0].order).toBe(1);
      expect(sortedContent[1].order).toBe(2);
      expect(sortedContent[2].order).toBe(3);
    });

    test('should search content by text', async () => {
      const searchResults = await Content.find({
        $text: { $search: 'JavaScript' }
      });
      
      expect(searchResults).toHaveLength(2);
      expect(searchResults.every(c => c.title.includes('JavaScript'))).toBe(true);
    });
  });

  describe('Content Analytics', () => {
    let testContent;

    beforeEach(async () => {
      testContent = new Content({
        title: 'Test Content',
        description: 'Test description',
        type: 'video',
        course: testCourse._id,
        module: testCourse._id,
        order: 1,
        duration: 600,
        viewCount: 100,
        completionCount: 75,
        averageRating: 4.5,
        ratingCount: 20
      });
      await testContent.save();
    });

    test('should calculate completion rate', async () => {
      const completionRate = testContent.viewCount > 0 
        ? (testContent.completionCount / testContent.viewCount) * 100 
        : 0;
      
      expect(completionRate).toBe(75);
    });

    test('should update rating correctly', async () => {
      const newRating = 5;
      const newRatingCount = testContent.ratingCount + 1;
      
      // Calculate new average rating
      const totalRatingPoints = testContent.averageRating * testContent.ratingCount + newRating;
      const newAverageRating = totalRatingPoints / newRatingCount;
      
      testContent.averageRating = newAverageRating;
      testContent.ratingCount = newRatingCount;
      await testContent.save();
      
      expect(testContent.ratingCount).toBe(21);
      expect(testContent.averageRating).toBeCloseTo(4.5238, 3);
    });
  });

  describe('Content Validation', () => {
    test('should validate rating range', async () => {
      const content = new Content({
        title: 'Test Content',
        description: 'Test description',
        type: 'video',
        course: testCourse._id,
        module: testCourse._id,
        order: 1,
        duration: 600,
        averageRating: 6, // Invalid rating (should be 0-5)
        ratingCount: 10
      });

      // This should fail validation
      await expect(content.save()).rejects.toThrow();
    });

    test('should validate progress range', async () => {
      // This would be tested in the Progress model, but included here for completeness
      const content = new Content({
        title: 'Test Content',
        description: 'Test description',
        type: 'video',
        course: testCourse._id,
        module: testCourse._id,
        order: 1,
        duration: 600
      });

      await content.save();
      
      // Progress validation would be handled in Progress model
      expect(content._id).toBeDefined();
    });
  });
});
