import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { ArrowLeft, BookOpen, Bookmark, MessageSquare, Settings, Share2, Download } from 'lucide-react';
import toast from 'react-hot-toast';

// Content type components
import VideoPlayer from './VideoPlayer';
import AudioPlayer from './AudioPlayer';
import DocumentViewer from './DocumentViewer';
import CodeEditor from './CodeEditor';

// Other components
import NotesPanel from './NotesPanel';
import BookmarksPanel from './BookmarksPanel';
import DiscussionPanel from './DiscussionPanel';
import ContentNavigation from './ContentNavigation';

import { contentAPI, progressAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const ContentPlayer = () => {
  const { contentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState('content');
  const [progress, setProgress] = useState(0);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Get content details
  const { data: content, isLoading, error } = useQuery(
    ['content', contentId],
    () => contentAPI.getContent(contentId),
    {
      enabled: !!contentId,
      onError: (error) => {
        toast.error('Failed to load content');
        console.error('Content loading error:', error);
      },
    }
  );

  // Get course content for navigation
  const { data: courseContent } = useQuery(
    ['course-content', content?.course],
    () => contentAPI.getCourseContent(content?.course),
    {
      enabled: !!content?.course,
    }
  );

  // Handle progress update
  const handleProgressUpdate = (newProgress) => {
    setProgress(newProgress);
  };

  // Handle content completion
  const handleCompletion = () => {
    setIsCompleted(true);
    toast.success('🎉 Congratulations! You completed this lesson.');
  };

  // Handle navigation to next content
  const handleNextContent = () => {
    if (!courseContent) return;
    
    const currentIndex = courseContent.findIndex(c => c._id === contentId);
    if (currentIndex < courseContent.length - 1) {
      const nextContent = courseContent[currentIndex + 1];
      navigate(`/app/player/${nextContent._id}`);
    } else {
      toast.success('You\'ve completed all content in this module!');
      navigate(`/app/course/${content.course}`);
    }
  };

  // Handle navigation to previous content
  const handlePreviousContent = () => {
    if (!courseContent) return;
    
    const currentIndex = courseContent.findIndex(c => c._id === contentId);
    if (currentIndex > 0) {
      const previousContent = courseContent[currentIndex - 1];
      navigate(`/app/player/${previousContent._id}`);
    }
  };

  // Render content based on type
  const renderContent = () => {
    if (!content) return null;

    switch (content.type) {
      case 'video':
        return (
          <VideoPlayer
            content={content}
            onProgressUpdate={handleProgressUpdate}
            onComplete={handleCompletion}
          />
        );
      case 'audio':
        return (
          <AudioPlayer
            content={content}
            onProgressUpdate={handleProgressUpdate}
            onComplete={handleCompletion}
          />
        );
      case 'document':
        return (
          <DocumentViewer
            content={content}
            onProgressUpdate={handleProgressUpdate}
            onComplete={handleCompletion}
          />
        );
      case 'code':
        return (
          <CodeEditor
            content={content}
            onProgressUpdate={handleProgressUpdate}
            onComplete={handleCompletion}
          />
        );
      case 'text':
      case 'interactive':
        return (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{content.title}</h2>
            <div className="prose max-w-none">
              {/* In a real implementation, this would render rich text content */}
              <p>{content.description}</p>
              {content.metadata?.content && (
                <div dangerouslySetInnerHTML={{ __html: content.metadata.content }} />
              )}
            </div>
            
            {/* Progress tracking for text content */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                    <span>Reading Progress</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <button
                  onClick={handleCompletion}
                  className="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Mark as Complete
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{content.title}</h2>
            <p className="text-gray-600">Content type '{content.type}' is not yet supported.</p>
          </div>
        );
    }
  };

  // Get content icon based on type
  const getContentIcon = (type) => {
    switch (type) {
      case 'video':
        return '🎥';
      case 'audio':
        return '🎧';
      case 'document':
        return '📄';
      case 'code':
        return '💻';
      case 'text':
        return '📖';
      case 'interactive':
        return '🎮';
      default:
        return '📚';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Content Not Found</h2>
          <p className="text-gray-600 mb-6">The content you're looking for doesn't exist or you don't have access to it.</p>
          <button
            onClick={() => navigate('/app/dashboard')}
            className="btn-primary"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getContentIcon(content.type)}</span>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900 truncate max-w-md">
                    {content.title}
                  </h1>
                  <p className="text-sm text-gray-600">
                    {content.type.charAt(0).toUpperCase() + content.type.slice(1)} • {content.duration ? `${Math.floor(content.duration / 60)} min` : 'Self-paced'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Progress indicator */}
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-gray-100 rounded-lg">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <span className="text-sm text-gray-700">{Math.round(progress)}% Complete</span>
              </div>

              {/* Action buttons */}
              <button
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Share"
              >
                <Share2 className="w-5 h-5" />
              </button>
              
              <button
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors sm:hidden"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {/* Content Navigation */}
            {courseContent && courseContent.length > 1 && (
              <ContentNavigation
                content={content}
                courseContent={courseContent}
                onPrevious={handlePreviousContent}
                onNext={handleNextContent}
                progress={progress}
              />
            )}

            {/* Content Player */}
            <div className="mb-6">
              {renderContent()}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block space-y-6">
              {/* Tabs */}
              <div className="bg-white rounded-lg shadow">
                <div className="border-b border-gray-200">
                  <nav className="flex space-x-8 px-4" aria-label="Tabs">
                    {[
                      { id: 'content', label: 'Content', icon: BookOpen },
                      { id: 'notes', label: 'Notes', icon: MessageSquare },
                      { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`${
                          activeTab === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
                      >
                        <tab.icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </nav>
                </div>

                <div className="p-4">
                  {activeTab === 'content' && (
                    <div className="space-y-4">
                      <h3 className="font-medium text-gray-900">Lesson Info</h3>
                      <div className="space-y-2 text-sm text-gray-600">
                        <p><strong>Type:</strong> {content.type}</p>
                        <p><strong>Duration:</strong> {content.duration ? `${Math.floor(content.duration / 60)} minutes` : 'Self-paced'}</p>
                        <p><strong>Level:</strong> {content.metadata?.difficulty || 'All levels'}</p>
                        {content.metadata?.tags && (
                          <div>
                            <strong>Tags:</strong>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {content.metadata.tags.map((tag, index) => (
                                <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'notes' && (
                    <NotesPanel contentId={contentId} />
                  )}

                  {activeTab === 'bookmarks' && (
                    <BookmarksPanel contentId={contentId} />
                  )}
                </div>
              </div>

              {/* Course Progress */}
              {courseContent && (
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-medium text-gray-900 mb-4">Course Progress</h3>
                  <div className="space-y-2">
                    {courseContent.map((item, index) => (
                      <div
                        key={item._id}
                        className={`p-2 rounded cursor-pointer transition-colors ${
                          item._id === contentId
                            ? 'bg-blue-50 border border-blue-200'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => navigate(`/app/player/${item._id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {index + 1}. {item.title}
                          </span>
                          <span className="text-xs text-gray-500">
                            {item.type.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Sidebar (as slide-out panel) */}
            {showSidebar && (
              <div className="fixed inset-0 z-50 lg:hidden">
                <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowSidebar(false)} />
                <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-xl">
                  <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Lesson Options</h2>
                  </div>
                  <div className="p-4">
                    <NotesPanel contentId={contentId} />
                    <BookmarksPanel contentId={contentId} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentPlayer;
