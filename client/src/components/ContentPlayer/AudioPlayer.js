import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from 'react-query';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, RotateCcw, Headphones } from 'lucide-react';
import { progressAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const AudioPlayer = ({ content, onProgressUpdate, onComplete }) => {
  const audioRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showTranscript, setShowTranscript] = useState(false);
  
  const { user } = useAuth();

  // Get content progress
  const { data: progressData } = useQuery(
    ['content-progress', content._id],
    () => progressAPI.getContentProgress(content._id),
    {
      enabled: !!content._id && !!user,
      onSuccess: (data) => {
        if (data.lastPosition && audioRef.current) {
          audioRef.current.currentTime = data.lastPosition;
        }
      },
    }
  );

  // Get transcript
  const { data: transcriptData } = useQuery(
    ['content-transcript', content._id],
    async () => {
      const transcriptFile = content.files.find(f => f.type === 'transcript');
      if (transcriptFile) {
        const response = await fetch(transcriptFile.url);
        return response.json();
      }
      return null;
    },
    {
      enabled: !!content.files.find(f => f.type === 'transcript'),
    }
  );

  // Available playback speeds
  const playbackSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  // Format time helper
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Update progress to server
  const updateProgress = useCallback(async () => {
    if (!audioRef.current || !user) return;
    
    const currentTime = audioRef.current.currentTime;
    const progress = (currentTime / duration) * 100;
    
    try {
      await progressAPI.updateContentProgress(content._id, {
        progress: Math.min(progress, 100),
        lastPosition: currentTime,
        watchTime: 5, // 5 seconds interval
      });
      
      if (onProgressUpdate) {
        onProgressUpdate(progress);
      }
      
      // Check if audio is completed
      if (progress >= 95 && progressData?.status !== 'completed') {
        await progressAPI.markContentCompleted(content._id);
        if (onComplete) {
          onComplete();
        }
      }
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  }, [content._id, duration, user, onProgressUpdate, onComplete, progressData?.status]);

  // Handle play/pause
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Handle volume change
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  // Handle mute toggle
  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Handle seek
  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  // Handle playback speed change
  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  // Skip forward/backward
  const skip = (seconds) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
    }
  };

  // Restart audio
  const restart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  // Jump to transcript timestamp
  const jumpToTimestamp = (timestamp) => {
    if (audioRef.current) {
      audioRef.current.currentTime = timestamp;
    }
  };

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      updateProgress();
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [updateProgress]);

  // Progress tracking interval
  useEffect(() => {
    if (isPlaying) {
      progressIntervalRef.current = setInterval(updateProgress, 5000); // Update every 5 seconds
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, updateProgress]);

  // Get audio URL
  const getAudioUrl = () => {
    const audioFile = content.files.find(f => f.type === 'audio');
    return audioFile?.url || '';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Audio Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{content.title}</h3>
            <p className="text-gray-600 mt-1">{content.description}</p>
          </div>
          <div className="flex items-center space-x-2">
            <Headphones className="w-5 h-5 text-gray-400" />
            <span className="text-gray-600">{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Audio Player */}
      <audio
        ref={audioRef}
        src={getAudioUrl()}
        className="hidden"
      />

      {/* Visual Audio Player */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-8 mb-6">
        {/* Waveform Visualization (simplified) */}
        <div className="h-32 flex items-center justify-center mb-6">
          <div className="flex items-end space-x-1 h-24">
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={i}
                className="bg-white/30 rounded-full w-1 transition-all duration-100"
                style={{
                  height: isPlaying 
                    ? `${Math.random() * 100}%` 
                    : '20%',
                  animation: isPlaying ? 'pulse 1s infinite' : 'none'
                }}
              />
            ))}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="relative h-2 bg-white/30 rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-white transition-all duration-100"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
            <input
              type="range"
              min="0"
              max={duration}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-white">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-center space-x-6">
          {/* Skip Back */}
          <button
            onClick={() => skip(-15)}
            className="text-white hover:text-gray-300 transition-colors"
          >
            <SkipBack className="w-6 h-6" />
          </button>

          {/* Restart */}
          <button
            onClick={restart}
            className="text-white hover:text-gray-300 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="bg-white/20 backdrop-blur-sm rounded-full p-3 hover:bg-white/30 transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 text-white" />
            ) : (
              <Play className="w-8 h-8 text-white ml-1" />
            )}
          </button>

          {/* Skip Forward */}
          <button
            onClick={() => skip(15)}
            className="text-white hover:text-gray-300 transition-colors"
          >
            <SkipForward className="w-6 h-6" />
          </button>

          {/* Volume */}
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleMute}
              className="text-white hover:text-gray-300 transition-colors"
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 h-1 bg-white/30 rounded-full appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Playback Speed */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Playback Speed
        </label>
        <div className="flex space-x-2">
          {playbackSpeeds.map((speed) => (
            <button
              key={speed}
              onClick={() => handleSpeedChange(speed)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                playbackSpeed === speed
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      {/* Transcript Toggle */}
      {transcriptData && (
        <div className="mb-6">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
          >
            <span>{showTranscript ? 'Hide' : 'Show'} Transcript</span>
          </button>
        </div>
      )}

      {/* Transcript */}
      {showTranscript && transcriptData && (
        <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
          <h4 className="font-medium text-gray-900 mb-4">Transcript</h4>
          <div className="space-y-4">
            {transcriptData.segments?.map((segment, index) => (
              <div
                key={index}
                className="flex space-x-4 cursor-pointer hover:bg-gray-50 p-2 rounded"
                onClick={() => jumpToTimestamp(segment.start)}
              >
                <span className="text-sm text-gray-500 min-w-[60px]">
                  {formatTime(segment.start)}
                </span>
                <p className="text-gray-700">{segment.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;
