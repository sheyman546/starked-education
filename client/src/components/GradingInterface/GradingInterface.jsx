import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  FileText, 
  Download, 
  Upload, 
  Save, 
  Send, 
  AlertCircle,
  CheckCircle,
  Plus,
  Minus,
  Star,
  MessageSquare,
  Eye,
  EyeOff
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import gradingService from '../../services/gradingService';
import submissionService from '../../services/submissionService';

const GradingInterface = () => {
  const { submissionId } = useParams();
  
  const [submission, setSubmission] = useState(null);
  const [grade, setGrade] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [rubric, setRubric] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [releasing, setReleasing] = useState(false);
  
  const [gradeData, setGradeData] = useState({
    rubricScores: [],
    overallFeedback: '',
    strengths: [],
    improvements: [],
    nextSteps: [],
    releaseImmediately: false
  });

  const [attachments, setAttachments] = useState([]);

  useEffect(() => {
    fetchSubmissionData();
  }, [submissionId]);

  const fetchSubmissionData = async () => {
    try {
      const response = await gradingService.getSubmissionGrade(submissionId);
      const { submission: subData, grade: gradeData } = response.data;
      
      setSubmission(subData);
      setAssignment(subData.assignment);
      setGrade(gradeData);
      
      if (gradeData) {
        setGradeData({
          rubricScores: gradeData.rubricResults || [],
          overallFeedback: gradeData.feedback?.overall || '',
          strengths: gradeData.feedback?.strengths || [],
          improvements: gradeData.feedback?.improvements || [],
          nextSteps: gradeData.feedback?.nextSteps || [],
          releaseImmediately: false
        });
        setAttachments(gradeData.feedback?.attachments || []);
      }
      
      // Fetch rubric if available
      if (subData.assignment.rubric) {
        // Would need to implement rubric service call
        // const rubricResponse = await rubricService.getRubric(subData.assignment.rubric);
        // setRubric(rubricResponse.data);
      }
    } catch (error) {
      toast.error('Failed to load submission data');
      console.error('Error fetching submission data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateRubricScore = (criterionId, levelId, score, feedback) => {
    setGradeData(prev => ({
      ...prev,
      rubricScores: prev.rubricScores.map(scoreItem =>
        scoreItem.criterion === criterionId
          ? { ...scoreItem, level: levelId, score, feedback }
          : scoreItem
      )
    }));
  };

  const addArrayItem = (field) => {
    setGradeData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const updateArrayItem = (field, index, value) => {
    setGradeData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }));
  };

  const removeArrayItem = (field, index) => {
    setGradeData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setAttachments(prev => [
      ...prev,
      ...files.map(file => ({
        file,
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 'document',
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      }))
    ]);
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const calculateTotalScore = () => {
    return gradeData.rubricScores.reduce((total, score) => total + (score.score || 0), 0);
  };

  const calculatePercentage = () => {
    const total = calculateTotalScore();
    const maxPoints = assignment?.points || 1;
    return Math.round((total / maxPoints) * 100);
  };

  const getLetterGrade = () => {
    const percentage = calculatePercentage();
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };

  const saveGrade = async () => {
    try {
      setSaving(true);
      
      const formData = new FormData();
      formData.append('rubricScores', JSON.stringify(gradeData.rubricScores));
      formData.append('overallFeedback', gradeData.overallFeedback);
      formData.append('strengths', JSON.stringify(gradeData.strengths));
      formData.append('improvements', JSON.stringify(gradeData.improvements));
      formData.append('nextSteps', JSON.stringify(gradeData.nextSteps));
      formData.append('releaseImmediately', gradeData.releaseImmediately);
      
      // Add attachments
      attachments.forEach(attachment => {
        if (attachment.file) {
          formData.append('attachments', attachment.file);
        }
      });

      if (grade) {
        const response = await gradingService.updateGrade(grade._id, formData);
        setGrade(response.data);
      } else {
        const response = await gradingService.createGrade(submissionId, formData);
        setGrade(response.data);
      }
      
      toast.success('Grade saved successfully');
    } catch (error) {
      toast.error('Failed to save grade');
      console.error('Error saving grade:', error);
    } finally {
      setSaving(false);
    }
  };

  const releaseGrade = async () => {
    try {
      setReleasing(true);
      await gradingService.releaseGrade(grade._id);
      setGrade(prev => ({ ...prev, release: { released: true, releasedAt: new Date() } }));
      toast.success('Grade released to student');
    } catch (error) {
      toast.error('Failed to release grade');
      console.error('Error releasing grade:', error);
    } finally {
      setReleasing(false);
    }
  };

  const downloadFile = async (file) => {
    try {
      const response = await submissionService.downloadFile(submissionId, file.filename);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.originalName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download file');
      console.error('Error downloading file:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Submission Not Found</h2>
          <p className="text-gray-600">The submission you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const totalScore = calculateTotalScore();
  const percentage = calculatePercentage();
  const letterGrade = getLetterGrade();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Submission Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Submission Header */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {assignment?.title}
                </h1>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>Student: {submission.student?.firstName} {submission.student?.lastName}</span>
                  <span>Submitted: {format(new Date(submission.submissionDate), 'MMM dd, yyyy HH:mm')}</span>
                  {submission.isLate && (
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs">
                      Late
                    </span>
                  )}
                </div>
              </div>
              
              {/* Grade Summary */}
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{totalScore}/{assignment?.points}</div>
                <div className="text-lg text-gray-600">{percentage}%</div>
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  percentage >= 90 ? 'bg-green-100 text-green-800' :
                  percentage >= 80 ? 'bg-blue-100 text-blue-800' :
                  percentage >= 70 ? 'bg-yellow-100 text-yellow-800' :
                  percentage >= 60 ? 'bg-orange-100 text-orange-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  Grade: {letterGrade}
                </div>
              </div>
            </div>
          </div>

          {/* Submission Content */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Submission Content</h2>
            
            {/* Text Content */}
            {submission.content?.text && (
              <div className="mb-6">
                <h3 className="font-medium text-gray-700 mb-2">Text Content</h3>
                <div className="p-4 bg-gray-50 rounded-lg whitespace-pre-wrap">
                  {submission.content.text}
                </div>
              </div>
            )}

            {/* Files */}
            {submission.content?.files && submission.content.files.length > 0 && (
              <div className="mb-6">
                <h3 className="font-medium text-gray-700 mb-2">Submitted Files</h3>
                <div className="space-y-2">
                  {submission.content.files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{file.originalName}</p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => downloadFile(file)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Download className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Code Blocks */}
            {submission.content?.code && submission.content.code.length > 0 && (
              <div className="mb-6">
                <h3 className="font-medium text-gray-700 mb-2">Code Submission</h3>
                {submission.content.code.map((codeBlock, index) => (
                  <div key={index} className="mb-4">
                    <div className="text-sm text-gray-600 mb-2">
                      {codeBlock.filename || `Code Block ${index + 1}`} ({codeBlock.language})
                    </div>
                    <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto">
                      <code>{codeBlock.code}</code>
                    </pre>
                  </div>
                ))}
              </div>
            )}

            {/* Links */}
            {submission.content?.links && submission.content.links.length > 0 && (
              <div className="mb-6">
                <h3 className="font-medium text-gray-700 mb-2">External Links</h3>
                <div className="space-y-2">
                  {submission.content.links.map((link, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {link.title || link.url}
                      </a>
                      {link.description && (
                        <p className="text-sm text-gray-600 mt-1">{link.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Grading Panel */}
        <div className="space-y-6">
          {/* Rubric Grading */}
          {rubric && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Rubric Grading</h2>
              <div className="space-y-4">
                {rubric.criteria.map((criterion) => (
                  <div key={criterion._id} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">{criterion.title}</h3>
                    <p className="text-sm text-gray-600 mb-3">{criterion.description}</p>
                    
                    <div className="space-y-2">
                      {criterion.levels.map((level) => (
                        <label key={level._id} className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name={`criterion-${criterion._id}`}
                            checked={gradeData.rubricScores.some(score => 
                              score.criterion === criterion._id && score.level === level._id
                            )}
                            onChange={() => updateRubricScore(criterion._id, level._id, level.points, '')}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{level.name}</span>
                              <span className="text-sm text-gray-600">{level.points} pts</span>
                            </div>
                            <p className="text-sm text-gray-600">{level.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    
                    <textarea
                      placeholder="Feedback for this criterion..."
                      value={gradeData.rubricScores.find(score => score.criterion === criterion._id)?.feedback || ''}
                      onChange={(e) => {
                        const currentScore = gradeData.rubricScores.find(score => score.criterion === criterion._id);
                        if (currentScore) {
                          updateRubricScore(criterion._id, currentScore.level, currentScore.score, e.target.value);
                        }
                      }}
                      className="w-full mt-3 px-3 py-2 border border-gray-300 rounded-lg resize-none"
                      rows="2"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overall Feedback */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Overall Feedback</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Feedback Comments
              </label>
              <textarea
                value={gradeData.overallFeedback}
                onChange={(e) => setGradeData(prev => ({ ...prev, overallFeedback: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                rows="4"
                placeholder="Provide overall feedback to the student..."
              />
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Strengths
                </label>
                <button
                  onClick={() => addArrayItem('strengths')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {gradeData.strengths.map((strength, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={strength}
                    onChange={(e) => updateArrayItem('strengths', index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="What the student did well..."
                  />
                  <button
                    onClick={() => removeArrayItem('strengths', index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Areas for Improvement
                </label>
                <button
                  onClick={() => addArrayItem('improvements')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {gradeData.improvements.map((improvement, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={improvement}
                    onChange={(e) => updateArrayItem('improvements', index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="What could be improved..."
                  />
                  <button
                    onClick={() => removeArrayItem('improvements', index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Next Steps
                </label>
                <button
                  onClick={() => addArrayItem('nextSteps')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {gradeData.nextSteps.map((step, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={step}
                    onChange={(e) => updateArrayItem('nextSteps', index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="What to work on next..."
                  />
                  <button
                    onClick={() => removeArrayItem('nextSteps', index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Attachments */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Attachments</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add Files
              </label>
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                accept="image/*,.pdf,.doc,.docx"
              />
            </div>

            {attachments.map((attachment, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2">
                <div className="flex items-center gap-3">
                  {attachment.type === 'image' && attachment.preview ? (
                    <img src={attachment.preview} alt="" className="h-10 w-10 object-cover rounded" />
                  ) : (
                    <FileText className="h-5 w-5 text-gray-400" />
                  )}
                  <span className="text-sm font-medium text-gray-900">{attachment.name}</span>
                </div>
                <button
                  onClick={() => removeAttachment(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Minus className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="releaseImmediately"
                  checked={gradeData.releaseImmediately}
                  onChange={(e) => setGradeData(prev => ({ ...prev, releaseImmediately: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="releaseImmediately" className="text-sm text-gray-700">
                  Release grade to student immediately
                </label>
              </div>

              <button
                onClick={saveGrade}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Grade'}
              </button>

              {grade && !grade.release.released && (
                <button
                  onClick={releaseGrade}
                  disabled={releasing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {releasing ? 'Releasing...' : 'Release Grade'}
                </button>
              )}

              {grade && grade.release.released && (
                <div className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg">
                  <Eye className="h-4 w-4" />
                  Grade Released
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GradingInterface;
