import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { MessageSquare, Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { progressAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const NotesPanel = ({ contentId }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [newNote, setNewNote] = useState({ text: '', timestamp: 0 });
  const textareaRef = useRef(null);

  // Get content progress (includes notes)
  const { data: progressData, isLoading } = useQuery(
    ['content-progress', contentId],
    () => progressAPI.getContentProgress(contentId),
    {
      enabled: !!contentId && !!user,
    }
  );

  // Add note mutation
  const addNoteMutation = useMutation(
    (noteData) => progressAPI.addNote(contentId, noteData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['content-progress', contentId]);
        setIsAddingNote(false);
        setNewNote({ text: '', timestamp: 0 });
        toast.success('Note added successfully');
      },
      onError: (error) => {
        toast.error('Failed to add note');
        console.error('Add note error:', error);
      },
    }
  );

  // Delete note mutation
  const deleteNoteMutation = useMutation(
    ({ noteIndex }) => {
      // In a real implementation, this would call a delete note API
      // For now, we'll simulate it
      return Promise.resolve();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['content-progress', contentId]);
        toast.success('Note deleted successfully');
      },
      onError: (error) => {
        toast.error('Failed to delete note');
        console.error('Delete note error:', error);
      },
    }
  );

  // Handle add note
  const handleAddNote = () => {
    if (!newNote.text.trim()) {
      toast.error('Please enter a note');
      return;
    }

    addNoteMutation.mutate(newNote);
  };

  // Handle delete note
  const handleDeleteNote = (noteIndex) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      deleteNoteMutation.mutate({ noteIndex });
    }
  };

  // Handle edit note
  const handleEditNote = (note, index) => {
    setEditingNote({ ...note, index });
  };

  // Handle save edited note
  const handleSaveEdit = () => {
    if (!editingNote.text.trim()) {
      toast.error('Please enter a note');
      return;
    }

    // In a real implementation, this would call an update note API
    queryClient.invalidateQueries(['content-progress', contentId]);
    setEditingNote(null);
    toast.success('Note updated successfully');
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (timestamp === 0) return 'General';
    const minutes = Math.floor(timestamp / 60);
    const seconds = Math.floor(timestamp % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Jump to timestamp (for video/audio content)
  const jumpToTimestamp = (timestamp) => {
    if (timestamp === 0) return;
    
    // In a real implementation, this would communicate with the video/audio player
    console.log('Jump to timestamp:', timestamp);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const notes = progressData?.notes || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900 flex items-center space-x-2">
          <MessageSquare className="w-4 h-4" />
          <span>Notes ({notes.length})</span>
        </h3>
        <button
          onClick={() => setIsAddingNote(true)}
          className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
          title="Add note"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Add Note Form */}
      {isAddingNote && (
        <div className="border border-blue-200 rounded-lg p-3 bg-blue-50">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timestamp (optional)
              </label>
              <input
                type="text"
                placeholder="0:00"
                value={newNote.timestamp > 0 ? formatTimestamp(newNote.timestamp) : ''}
                onChange={(e) => {
                  const parts = e.target.value.split(':');
                  if (parts.length === 2) {
                    const minutes = parseInt(parts[0]) || 0;
                    const seconds = parseInt(parts[1]) || 0;
                    setNewNote({ ...newNote, timestamp: minutes * 60 + seconds });
                  }
                }}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note
              </label>
              <textarea
                ref={textareaRef}
                value={newNote.text}
                onChange={(e) => setNewNote({ ...newNote, text: e.target.value })}
                placeholder="Enter your note here..."
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                autoFocus
              />
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={handleAddNote}
                disabled={addNoteMutation.isLoading}
                className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Save className="w-3 h-3" />
                <span>Save</span>
              </button>
              <button
                onClick={() => {
                  setIsAddingNote(false);
                  setNewNote({ text: '', timestamp: 0 });
                }}
                className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {notes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No notes yet. Add your first note!</p>
          </div>
        ) : (
          notes.map((note, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
            >
              {editingNote?.index === index ? (
                // Edit mode
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Note
                    </label>
                    <textarea
                      value={editingNote.text}
                      onChange={(e) => setEditingNote({ ...editingNote, text: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={3}
                      autoFocus
                    />
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={handleSaveEdit}
                      className="flex items-center space-x-1 px-2 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                      <Save className="w-3 h-3" />
                      <span>Save</span>
                    </button>
                    <button
                      onClick={() => setEditingNote(null)}
                      className="px-2 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // View mode
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        {note.timestamp > 0 && (
                          <button
                            onClick={() => jumpToTimestamp(note.timestamp)}
                            className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                            title="Jump to timestamp"
                          >
                            {formatTimestamp(note.timestamp)}
                          </button>
                        )}
                        <span className="text-xs text-gray-500">
                          {formatDate(note.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {note.text}
                      </p>
                    </div>
                    
                    <div className="flex space-x-1 ml-2">
                      <button
                        onClick={() => handleEditNote(note, index)}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="Edit note"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(index)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete note"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotesPanel;
