import React from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle } from 'lucide-react';

const ContentNavigation = ({ content, courseContent, onPrevious, onNext, progress }) => {
  const currentIndex = courseContent?.findIndex(c => c._id === content._id);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === courseContent?.length - 1;
  const isCompleted = progress >= 95;

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

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex items-center justify-between">
        {/* Previous Button */}
        <button
          onClick={onPrevious}
          disabled={isFirst}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            isFirst
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous</span>
        </button>

        {/* Content Progress Indicator */}
        <div className="flex-1 mx-4">
          <div className="flex items-center justify-center space-x-2">
            {courseContent?.map((item, index) => (
              <React.Fragment key={item._id}>
                <button
                  onClick={() => {
                    if (index !== currentIndex) {
                      // Navigate to this content
                      if (index < currentIndex) {
                        onPrevious();
                      } else {
                        onNext();
                      }
                    }
                  }}
                  className={`flex items-center space-x-1 px-2 py-1 rounded text-sm transition-colors ${
                    index === currentIndex
                      ? 'bg-blue-100 text-blue-700'
                      : index < currentIndex
                      ? 'bg-green-50 text-green-700 hover:bg-green-100'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                  title={item.title}
                >
                  <span className="text-xs">
                    {getContentIcon(item.type)}
                  </span>
                  <span className="hidden sm:inline">
                    {index + 1}
                  </span>
                  {index < currentIndex && (
                    <CheckCircle2 className="w-3 h-3" />
                  )}
                  {index === currentIndex && !isCompleted && (
                    <Circle className="w-3 h-3" />
                  )}
                </button>
                
                {index < courseContent.length - 1 && (
                  <div className="w-4 h-0.5 bg-gray-300" />
                )}
              </React.Fragment>
            ))}
          </div>
          
          {/* Current Content Info */}
          <div className="text-center mt-3">
            <p className="text-sm text-gray-600">
              Lesson {currentIndex + 1} of {courseContent?.length}
            </p>
            <p className="text-xs text-gray-500 truncate max-w-xs mx-auto">
              {content.title}
            </p>
          </div>
        </div>

        {/* Next Button */}
        <button
          onClick={onNext}
          disabled={isLast}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            isLast
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <span>{isLast ? 'Complete' : 'Next'}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>Course Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default ContentNavigation;
