import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Bookmark, Plus, Trash2, ExternalLink, Clock } from 'lucide-react';
import { progressAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const BookmarksPanel = ({ contentId }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddingBookmark, setIsAddingBookmark] = useState(false);
  const [newBookmark, setNewBookmark] = useState({ timestamp: 0, title: '', note: '' });

  // Get content progress (includes bookmarks)
  const { data: progressData, isLoading } = useQuery(
    ['content-progress', contentId],
    () => progressAPI.getContentProgress(contentId),
    {
      enabled: !!contentId && !!user,
    }
  );

  // Add bookmark mutation
  const addBookmarkMutation = useMutation(
    (bookmarkData) => progressAPI.addBookmark(contentId, bookmarkData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['content-progress', contentId]);
        setIsAddingBookmark(false);
        setNewBookmark({ timestamp: 0, title: '', note: '' });
        toast.success('Bookmark added successfully');
      },
      onError: (error) => {
        toast.error('Failed to add bookmark');
        console.error('Add bookmark error:', error);
      },
    }
  );

  // Delete bookmark mutation
  const deleteBookmarkMutation = useMutation(
    ({ bookmarkIndex }) => {
      // In a real implementation, this would call a delete bookmark API
      return Promise.resolve();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['content-progress', contentId]);
        toast.success('Bookmark deleted successfully');
      },
      onError: (error) => {
        toast.error('Failed to delete bookmark');
        console.error('Delete bookmark error:', error);
      },
    }
  );

  // Handle add bookmark
  const handleAddBookmark = () => {
    if (!newBookmark.title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    addBookmarkMutation.mutate(newBookmark);
  };

  // Handle delete bookmark
  const handleDeleteBookmark = (bookmarkIndex) => {
    if (window.confirm('Are you sure you want to delete this bookmark?')) {
      deleteBookmarkMutation.mutate({ bookmarkIndex });
    }
  };

  // Jump to timestamp
  const jumpToTimestamp = (timestamp) => {
    if (timestamp === 0) return;
    
    // In a real implementation, this would communicate with the video/audio player
    console.log('Jump to timestamp:', timestamp);
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (timestamp === 0) return 'Start';
    const minutes = Math.floor(timestamp / 60);
    const seconds = Math.floor(timestamp % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const bookmarks = progressData?.bookmarks || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900 flex items-center space-x-2">
          <Bookmark className="w-4 h-4" />
          <span>Bookmarks ({bookmarks.length})</span>
        </h3>
        <button
          onClick={() => setIsAddingBookmark(true)}
          className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
          title="Add bookmark"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Add Bookmark Form */}
      {isAddingBookmark && (
        <div className="border border-blue-200 rounded-lg p-3 bg-blue-50">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timestamp
              </label>
              <input
                type="text"
                placeholder="0:00"
                value={newBookmark.timestamp > 0 ? formatTimestamp(newBookmark.timestamp) : ''}
                onChange={(e) => {
                  const parts = e.target.value.split(':');
                  if (parts.length === 2) {
                    const minutes = parseInt(parts[0]) || 0;
                    const seconds = parseInt(parts[1]) || 0;
                    setNewBookmark({ ...newBookmark, timestamp: minutes * 60 + seconds });
                  }
                }}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={newBookmark.title}
                onChange={(e) => setNewBookmark({ ...newBookmark, title: e.target.value })}
                placeholder="Enter bookmark title..."
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note (optional)
              </label>
              <textarea
                value={newBookmark.note}
                onChange={(e) => setNewBookmark({ ...newBookmark, note: e.target.value })}
                placeholder="Add a note about this bookmark..."
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
              />
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={handleAddBookmark}
                disabled={addBookmarkMutation.isLoading}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Add Bookmark
              </button>
              <button
                onClick={() => {
                  setIsAddingBookmark(false);
                  setNewBookmark({ timestamp: 0, title: '', note: '' });
                }}
                className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bookmarks List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {bookmarks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Bookmark className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No bookmarks yet. Add your first bookmark!</p>
          </div>
        ) : (
          bookmarks.map((bookmark, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    {bookmark.timestamp > 0 && (
                      <button
                        onClick={() => jumpToTimestamp(bookmark.timestamp)}
                        className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                        title="Jump to timestamp"
                      >
                        <Clock className="w-3 h-3" />
                        <span>{formatTimestamp(bookmark.timestamp)}</span>
                      </button>
                    )}
                    <span className="text-xs text-gray-500">
                      {formatDate(bookmark.createdAt)}
                    </span>
                  </div>
                  
                  <h4 className="text-sm font-medium text-gray-900 mb-1">
                    {bookmark.title}
                  </h4>
                  
                  {bookmark.note && (
                    <p className="text-xs text-gray-600 whitespace-pre-wrap">
                      {bookmark.note}
                    </p>
                  )}
                </div>
                
                <div className="flex space-x-1 ml-2">
                  {bookmark.timestamp > 0 && (
                    <button
                      onClick={() => jumpToTimestamp(bookmark.timestamp)}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded transition-colors"
                      title="Jump to timestamp"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteBookmark(index)}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete bookmark"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default BookmarksPanel;
