const axios = require('axios');
const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');

class PlagiarismService {
  constructor() {
    this.apiKey = process.env.PLAGIARISM_API_KEY;
    this.apiUrl = process.env.PLAGIARISM_API_URL || 'https://api.plagiarismcheck.org/v1';
    this.enabled = !!this.apiKey;
  }

  async checkSubmission(submissionId) {
    if (!this.enabled) {
      console.warn('Plagiarism detection not enabled - missing API key');
      return this.mockCheck(submissionId);
    }

    try {
      const submission = await Submission.findById(submissionId)
        .populate('assignment')
        .populate('student');

      if (!submission) {
        throw new Error('Submission not found');
      }

      const assignment = submission.assignment;
      
      // Skip if plagiarism detection is disabled for this assignment
      if (!assignment.plagiarismDetection.enabled) {
        return;
      }

      // Prepare content for checking
      const content = this.extractContent(submission);
      
      if (!content || content.trim().length < 50) {
        // Too little content to check
        await Submission.findByIdAndUpdate(submissionId, {
          'plagiarism.status': 'completed',
          'plagiarism.score': 0,
          'plagiarism.report': {
            sources: [],
            flaggedSections: []
          }
        });
        return;
      }

      // Call plagiarism detection API
      const result = await this.callPlagiarismAPI(content, {
        sensitivity: assignment.plagiarismDetection.sensitivity,
        checkInternet: assignment.plagiarismDetection.checkAgainstInternet,
        checkPeers: assignment.plagiarismDetection.checkAgainstPeers,
        courseId: assignment.course,
        assignmentId: assignment._id
      });

      // Update submission with results
      await Submission.findByIdAndUpdate(submissionId, {
        'plagiarism.checked': true,
        'plagiarism.status': 'completed',
        'plagiarism.score': result.score,
        'plagiarism.report': result.report
      });

      // Flag submission if score is high
      if (result.score > 75) {
        await Submission.findByIdAndUpdate(submissionId, {
          status: 'flagged'
        });
      }

    } catch (error) {
      console.error('Error checking plagiarism:', error);
      await Submission.findByIdAndUpdate(submissionId, {
        'plagiarism.status': 'error'
      });
    }
  }

  extractContent(submission) {
    let content = '';

    // Add text content
    if (submission.content.text) {
      content += submission.content.text + ' ';
    }

    // Add code content (may not be useful for plagiarism but include anyway)
    if (submission.content.code && submission.content.code.length > 0) {
      submission.content.code.forEach(codeBlock => {
        content += codeBlock.code + ' ';
      });
    }

    // For file submissions, we would need to extract text from files
    // This is a simplified version - in production, you'd use file parsers
    if (submission.content.files && submission.content.files.length > 0) {
      // Add placeholder for file content extraction
      content += '[FILE CONTENTS] ';
    }

    return content.trim();
  }

  async callPlagiarismAPI(content, options = {}) {
    try {
      const response = await axios.post(`${this.apiUrl}/check`, {
        text: content,
        sensitivity: options.sensitivity || 'medium',
        check_internet: options.checkInternet !== false,
        check_peers: options.checkPeers !== false,
        course_id: options.courseId,
        assignment_id: options.assignmentId
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        score: response.data.similarity_score,
        report: {
          sources: response.data.sources || [],
          flaggedSections: response.data.flagged_sections || []
        }
      };

    } catch (error) {
      if (error.response && error.response.status === 429) {
        // Rate limited - queue for later
        throw new Error('Rate limit exceeded, please try again later');
      }
      throw error;
    }
  }

  async mockCheck(submissionId) {
    // Mock implementation for development/testing
    const submission = await Submission.findById(submissionId)
      .populate('assignment');

    if (!submission) {
      throw new Error('Submission not found');
    }

    // Generate mock plagiarism score based on content length
    const content = this.extractContent(submission);
    const contentLength = content.length;
    
    // Mock score calculation (longer content gets higher scores)
    let mockScore = Math.min(95, Math.max(5, (contentLength / 1000) * 15 + Math.random() * 20));
    
    // Add some mock sources if score is significant
    const mockSources = mockScore > 30 ? [
      {
        url: 'https://example.com/source1',
        similarity: Math.round(mockScore * 0.8),
        words: Math.round(contentLength * 0.3)
      },
      {
        url: 'https://example.com/source2',
        similarity: Math.round(mockScore * 0.6),
        words: Math.round(contentLength * 0.2)
      }
    ] : [];

    const mockFlaggedSections = mockScore > 50 ? [
      {
        text: content.substring(0, Math.min(100, content.length)),
        similarity: Math.round(mockScore * 0.9),
        source: 'https://example.com/source1'
      }
    ] : [];

    await Submission.findByIdAndUpdate(submissionId, {
      'plagiarism.checked': true,
      'plagiarism.status': 'completed',
      'plagiarism.score': Math.round(mockScore),
      'plagiarism.report': {
        sources: mockSources,
        flaggedSections: mockFlaggedSections
      }
    });

    // Flag if high score
    if (mockScore > 75) {
      await Submission.findByIdAndUpdate(submissionId, {
        status: 'flagged'
      });
    }
  }

  async getPeerComparisons(submissionId) {
    try {
      const submission = await Submission.findById(submissionId)
        .populate('assignment');

      if (!submission) {
        throw new Error('Submission not found');
      }

      // Get other submissions for the same assignment
      const peerSubmissions = await Submission.find({
        assignment: submission.assignment._id,
        _id: { $ne: submission._id },
        status: 'submitted'
      }).populate('student', 'firstName lastName');

      const comparisons = [];

      for (const peer of peerSubmissions) {
        const peerContent = this.extractContent(peer);
        const currentContent = this.extractContent(submission);
        
        // Simple similarity calculation (in production, use more sophisticated algorithms)
        const similarity = this.calculateSimilarity(currentContent, peerContent);
        
        if (similarity > 30) { // Only include significant similarities
          comparisons.push({
            studentId: peer.student._id,
            studentName: `${peer.student.firstName} ${peer.student.lastName}`,
            similarity: Math.round(similarity),
            submissionId: peer._id
          });
        }
      }

      // Sort by similarity (highest first)
      comparisons.sort((a, b) => b.similarity - a.similarity);

      return comparisons.slice(0, 10); // Return top 10 matches

    } catch (error) {
      console.error('Error getting peer comparisons:', error);
      return [];
    }
  }

  calculateSimilarity(text1, text2) {
    // Simple similarity calculation using common words
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    const similarity = (intersection.size / union.size) * 100;
    
    return Math.round(similarity * 100) / 100;
  }

  async generateReport(submissionId) {
    try {
      const submission = await Submission.findById(submissionId)
        .populate('assignment')
        .populate('student');

      if (!submission) {
        throw new Error('Submission not found');
      }

      const peerComparisons = await this.getPeerComparisons(submissionId);

      return {
        submission: {
          id: submission._id,
          student: `${submission.student.firstName} ${submission.student.lastName}`,
          assignment: submission.assignment.title,
          submittedAt: submission.submissionDate
        },
        plagiarism: {
          score: submission.plagiarism.score,
          status: submission.plagiarism.status,
          checked: submission.plagiarism.checked
        },
        sources: submission.plagiarism.report?.sources || [],
        flaggedSections: submission.plagiarism.report?.flaggedSections || [],
        peerComparisons,
        recommendations: this.getRecommendations(submission.plagiarism.score, peerComparisons)
      };

    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  }

  getRecommendations(score, peerComparisons) {
    const recommendations = [];

    if (score > 75) {
      recommendations.push({
        type: 'high_risk',
        message: 'High similarity detected. Manual review recommended.',
        priority: 'high'
      });
    } else if (score > 50) {
      recommendations.push({
        type: 'medium_risk',
        message: 'Moderate similarity detected. Consider reviewing.',
        priority: 'medium'
      });
    }

    if (peerComparisons.length > 0 && peerComparisons[0].similarity > 60) {
      recommendations.push({
        type: 'peer_similarity',
        message: `High similarity with another student's submission (${peerComparisons[0].similarity}%).`,
        priority: 'high'
      });
    }

    if (score < 20) {
      recommendations.push({
        type: 'low_risk',
        message: 'Low similarity detected. Original work appears authentic.',
        priority: 'low'
      });
    }

    return recommendations;
  }

  async batchCheck(assignmentId) {
    try {
      const submissions = await Submission.find({
        assignment: assignmentId,
        status: 'submitted',
        'plagiarism.status': { $in: ['pending', null] }
      });

      const results = [];

      for (const submission of submissions) {
        try {
          await this.checkSubmission(submission._id);
          results.push({
            submissionId: submission._id,
            status: 'completed'
          });
        } catch (error) {
          results.push({
            submissionId: submission._id,
            status: 'error',
            error: error.message
          });
        }
      }

      return results;

    } catch (error) {
      console.error('Error in batch plagiarism check:', error);
      throw error;
    }
  }
}

module.exports = new PlagiarismService();
