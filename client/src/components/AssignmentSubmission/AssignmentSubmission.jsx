import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Editor } from '@monaco-editor/react';
import { 
  Upload, 
  FileText, 
  Code, 
  Video, 
  Music, 
  Link, 
  Save, 
  Send, 
  Clock, 
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import assignmentService from '../../services/assignmentService';
import submissionService from '../../services/submissionService';

const AssignmentSubmission = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  
  const [assignment, setAssignment] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [content, setContent] = useState({
    text: '',
    files: [],
    code: [],
    links: []
  });

  const [autoSaveTimer, setAutoSaveTimer] = useState(null);

  useEffect(() => {
    fetchAssignment();
    fetchExistingSubmission();
  }, [assignmentId]);

  useEffect(() => {
    // Auto-save functionality
    if (assignment?.autoSaveEnabled && content.text) {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      
      const timer = setTimeout(() => {
        autoSave();
      }, 30000); // Auto-save after 30 seconds of inactivity
      
      setAutoSaveTimer(timer);
    }
    
    return () => {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
    };
  }, [content, assignment]);

  const fetchAssignment = async () => {
    try {
      const response = await assignmentService.getAssignment(assignmentId);
      setAssignment(response.data.assignment);
    } catch (error) {
      toast.error('Failed to load assignment');
      console.error('Error fetching assignment:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingSubmission = async () => {
    try {
      const response = await submissionService.getStudentSubmissions();
      const existingSubmission = response.data.submissions.find(
        sub => sub.assignment._id === assignmentId && sub.status === 'draft'
      );
      
      if (existingSubmission) {
        setSubmission(existingSubmission);
        setContent({
          text: existingSubmission.content?.text || '',
          files: existingSubmission.content?.files || [],
          code: existingSubmission.content?.code || [],
          links: existingSubmission.content?.links || []
        });
      }
    } catch (error) {
      console.error('Error fetching existing submission:', error);
    }
  };

  const autoSave = async () => {
    if (!submission) return;
    
    try {
      setSaving(true);
      await submissionService.autoSave(submission._id, { content });
      toast.success('Draft auto-saved');
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      const newFiles = acceptedFiles.map(file => ({
        file,
        id: Date.now() + Math.random(),
        name: file.name,
        size: file.size,
        type: file.type
      }));
      
      setContent(prev => ({
        ...prev,
        files: [...prev.files, ...newFiles]
      }));
    },
    accept: assignment?.allowedFileTypes?.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {}) || {
      'image/*': [],
      'application/pdf': [],
      'text/*': [],
      'application/msword': [],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': []
    },
    maxSize: assignment?.maxFileSize || 50 * 1024 * 1024,
    maxFiles: (assignment?.maxFiles || 5) - content.files.length
  });

  const removeFile = (fileId) => {
    setContent(prev => ({
      ...prev,
      files: prev.files.filter(f => f.id !== fileId)
    }));
  };

  const addCodeBlock = () => {
    setContent(prev => ({
      ...prev,
      code: [...prev.code, {
        id: Date.now(),
        language: 'javascript',
        code: ''
      }]
    }));
  };

  const updateCodeBlock = (id, field, value) => {
    setContent(prev => ({
      ...prev,
      code: prev.code.map(block => 
        block.id === id ? { ...block, [field]: value } : block
      )
    }));
  };

  const removeCodeBlock = (id) => {
    setContent(prev => ({
      ...prev,
      code: prev.code.filter(block => block.id !== id)
    }));
  };

  const addLink = () => {
    setContent(prev => ({
      ...prev,
      links: [...prev.links, {
        id: Date.now(),
        title: '',
        url: '',
        description: ''
      }]
    }));
  };

  const updateLink = (id, field, value) => {
    setContent(prev => ({
      ...prev,
      links: prev.links.map(link => 
        link.id === id ? { ...link, [field]: value } : link
      )
    }));
  };

  const removeLink = (id) => {
    setContent(prev => ({
      ...prev,
      links: prev.links.filter(link => link.id !== id)
    }));
  };

  const saveDraft = async () => {
    try {
      setSaving(true);
      
      const submissionData = new FormData();
      submissionData.append('text', content.text);
      submissionData.append('code', JSON.stringify(content.code));
      submissionData.append('links', JSON.stringify(content.links));
      
      // Add files
      content.files.forEach(fileObj => {
        submissionData.append('files', fileObj.file);
      });

      if (submission) {
        await submissionService.updateSubmission(submission._id, submissionData);
      } else {
        const response = await submissionService.createSubmission(assignmentId, submissionData);
        setSubmission(response.data);
      }
      
      toast.success('Draft saved successfully');
    } catch (error) {
      toast.error('Failed to save draft');
      console.error('Error saving draft:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      
      // Validate required content
      if (!content.text.trim() && content.files.length === 0 && 
          content.code.length === 0 && content.links.length === 0) {
        toast.error('Please add some content before submitting');
        return;
      }

      const submissionData = new FormData();
      submissionData.append('text', content.text);
      submissionData.append('code', JSON.stringify(content.code));
      submissionData.append('links', JSON.stringify(content.links));
      submissionData.append('submit', 'true');
      
      // Add files
      content.files.forEach(fileObj => {
        submissionData.append('files', fileObj.file);
      });

      if (submission) {
        await submissionService.updateSubmission(submission._id, submissionData);
        await submissionService.submitSubmission(submission._id);
      } else {
        await submissionService.createSubmission(assignmentId, submissionData);
      }
      
      toast.success('Assignment submitted successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Failed to submit assignment');
      console.error('Error submitting:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Assignment Not Found</h2>
          <p className="text-gray-600">The assignment you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const isOverdue = new Date() > new Date(assignment.dueDate);
  const canSubmit = !isOverdue || assignment.lateSubmissionAllowed;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Assignment Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{assignment.title}</h1>
            <p className="text-gray-600 mb-4">{assignment.description}</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            isOverdue 
              ? 'bg-red-100 text-red-800' 
              : 'bg-green-100 text-green-800'
          }`}>
            {isOverdue ? 'Overdue' : 'Open'}
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>Due: {format(new Date(assignment.dueDate), 'MMM dd, yyyy HH:mm')}</span>
          </div>
          <div>Points: {assignment.points}</div>
          {submission && (
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span>Draft saved</span>
            </div>
          )}
        </div>

        {assignment.instructions && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Instructions</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{assignment.instructions}</p>
          </div>
        )}
      </div>

      {/* Submission Types */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Submission Content</h2>
        
        {/* Text Submission */}
        {assignment.submissionTypes?.includes('text') && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Text Content
            </label>
            <textarea
              value={content.text}
              onChange={(e) => setContent(prev => ({ ...prev, text: e.target.value }))}
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your text submission here..."
            />
          </div>
        )}

        {/* File Upload */}
        {assignment.submissionTypes?.includes('file') && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              File Upload
            </label>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragActive 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">
                {isDragActive
                  ? 'Drop the files here...'
                  : 'Drag & drop files here, or click to select files'
                }
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Max {assignment.maxFileSize / 1024 / 1024}MB, {assignment.maxFiles} files
              </p>
            </div>
            
            {content.files.length > 0 && (
              <div className="mt-4 space-y-2">
                {content.files.map(file => (
                  <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Code Submission */}
        {assignment.submissionTypes?.includes('code') && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Code Submission
              </label>
              <button
                onClick={addCodeBlock}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Code Block
              </button>
            </div>
            
            {content.code.map((block, index) => (
              <div key={block.id} className="mb-4 p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <select
                    value={block.language}
                    onChange={(e) => updateCodeBlock(block.id, 'language', e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                    <option value="html">HTML</option>
                    <option value="css">CSS</option>
                  </select>
                  <button
                    onClick={() => removeCodeBlock(block.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
                <Editor
                  height="200px"
                  language={block.language}
                  value={block.code}
                  onChange={(value) => updateCodeBlock(block.id, 'code', value || '')}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Links */}
        {assignment.submissionTypes?.includes('link') && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                External Links
              </label>
              <button
                onClick={addLink}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Link
              </button>
            </div>
            
            {content.links.map(link => (
              <div key={link.id} className="mb-4 p-4 border border-gray-200 rounded-lg">
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <input
                    type="text"
                    placeholder="Link title"
                    value={link.title}
                    onChange={(e) => updateLink(link.id, 'title', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={link.url}
                    onChange={(e) => updateLink(link.id, 'url', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <textarea
                  placeholder="Description (optional)"
                  value={link.description}
                  onChange={(e) => updateLink(link.id, 'description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                  rows="2"
                />
                <button
                  onClick={() => removeLink(link.id)}
                  className="mt-2 text-red-500 hover:text-red-700 text-sm"
                >
                  Remove Link
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <button
          onClick={saveDraft}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Draft'}
        </button>
        
        <button
          onClick={handleSubmit}
          disabled={submitting || !canSubmit}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-white disabled:opacity-50 ${
            isOverdue 
              ? 'bg-orange-600 hover:bg-orange-700' 
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          <Send className="h-4 w-4" />
          {submitting 
            ? 'Submitting...' 
            : isOverdue 
              ? 'Submit Late' 
              : 'Submit Assignment'
          }
        </button>
      </div>

      {!canSubmit && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">
              This assignment is overdue and late submissions are not allowed.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignmentSubmission;
