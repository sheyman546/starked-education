import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from 'react-query';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { progressAPI, mediaAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const VideoPlayer = ({ content, onProgressUpdate, onComplete }) => {
  const videoRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const [quality, setQuality] = useState('auto');
  const [showSettings, setShowSettings] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [selectedSubtitle, setSelectedSubtitle] = useState('en');
  
  const { user } = useAuth();

  // Get content progress
  const { data: progressData } = useQuery(
    ['content-progress', content._id],
    () => progressAPI.getContentProgress(content._id),
    {
      enabled: !!content._id && !!user,
      onSuccess: (data) => {
        if (data.lastPosition && videoRef.current) {
          videoRef.current.currentTime = data.lastPosition;
        }
      },
    }
  );

  // Available playback speeds
  const playbackSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  // Available qualities
  const qualities = [
    { label: 'Auto', value: 'auto' },
    { label: '1080p', value: '1080p' },
    { label: '720p', value: '720p' },
    { label: '480p', value: '480p' },
    { label: '360p', value: '360p' },
  ];

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
    if (!videoRef.current || !user) return;
    
    const currentTime = videoRef.current.currentTime;
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
      
      // Check if video is completed
      if (progress >= 95 && !progressData?.status === 'completed') {
        await progressAPI.markContentCompleted(content._id);
        if (onComplete) {
          onComplete();
        }
        toast.success('Lesson completed!');
      }
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  }, [content._id, duration, user, onProgressUpdate, onComplete, progressData?.status]);

  // Handle play/pause
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Handle volume change
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  // Handle mute toggle
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Handle seek
  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  // Handle fullscreen
  const toggleFullscreen = () => {
    const container = videoRef.current?.parentElement;
    if (!container) return;

    if (!isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  // Handle playback speed change
  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSettings(false);
  };

  // Handle quality change
  const handleQualityChange = (newQuality) => {
    setQuality(newQuality);
    // In a real implementation, this would switch video sources
    setShowSettings(false);
  };

  // Skip forward/backward
  const skip = (seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
    }
  };

  // Restart video
  const restart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  // Show/hide controls on mouse movement
  const handleMouseMove = () => {
    setShowControls(true);
    setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      
      // Update buffered progress
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        setBuffered((bufferedEnd / video.duration) * 100);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      // Mark as completed if watched enough
      updateProgress();
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
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

  // Get video URL based on quality
  const getVideoUrl = () => {
    const videoFile = content.files.find(f => f.type === 'video');
    if (!videoFile) return '';
    
    // In a real implementation, this would select different quality files
    return videoFile.url;
  };

  return (
    <div 
      className="relative w-full bg-black rounded-lg overflow-hidden group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="w-full h-full"
        src={getVideoUrl()}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      >
        {subtitlesEnabled && content.files.find(f => f.type === 'subtitle') && (
          <track
            kind="subtitles"
            src={content.files.find(f => f.type === 'subtitle').url}
            srcLang={selectedSubtitle}
            label="Subtitles"
            default
          />
        )}
      </video>

      {/* Controls Overlay */}
      <div className={`absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Center Play/Pause Button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={togglePlay}
            className="bg-white/20 backdrop-blur-sm rounded-full p-4 hover:bg-white/30 transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 text-white" />
            ) : (
              <Play className="w-8 h-8 text-white ml-1" />
            )}
          </button>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="relative h-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-red-600 transition-all duration-100"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
              <div
                className="absolute left-0 top-0 h-full bg-white/50 transition-all duration-100"
                style={{ width: `${buffered}%` }}
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
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Skip Back */}
              <button
                onClick={() => skip(-10)}
                className="text-white hover:text-gray-300 transition-colors"
              >
                <SkipBack className="w-5 h-5" />
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
                className="text-white hover:text-gray-300 transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6" />
                )}
              </button>

              {/* Skip Forward */}
              <button
                onClick={() => skip(10)}
                className="text-white hover:text-gray-300 transition-colors"
              >
                <SkipForward className="w-5 h-5" />
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

              {/* Time */}
              <span className="text-white text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center space-x-4">
              {/* Settings */}
              <div className="relative">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-white hover:text-gray-300 transition-colors"
                >
                  <Settings className="w-5 h-5" />
                </button>

                {/* Settings Dropdown */}
                {showSettings && (
                  <div className="absolute right-0 bottom-8 bg-gray-900 rounded-lg p-4 min-w-[200px] shadow-xl">
                    {/* Playback Speed */}
                    <div className="mb-4">
                      <h4 className="text-white text-sm font-medium mb-2">Speed</h4>
                      <div className="space-y-1">
                        {playbackSpeeds.map((speed) => (
                          <button
                            key={speed}
                            onClick={() => handleSpeedChange(speed)}
                            className={`w-full text-left px-2 py-1 rounded text-sm transition-colors ${
                              playbackSpeed === speed
                                ? 'bg-red-600 text-white'
                                : 'text-gray-300 hover:bg-gray-800'
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quality */}
                    <div>
                      <h4 className="text-white text-sm font-medium mb-2">Quality</h4>
                      <div className="space-y-1">
                        {qualities.map((q) => (
                          <button
                            key={q.value}
                            onClick={() => handleQualityChange(q.value)}
                            className={`w-full text-left px-2 py-1 rounded text-sm transition-colors ${
                              quality === q.value
                                ? 'bg-red-600 text-white'
                                : 'text-gray-300 hover:bg-gray-800'
                            }`}
                          >
                            {q.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Subtitles */}
              {content.files.find(f => f.type === 'subtitle') && (
                <button
                  onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
                  className={`text-white hover:text-gray-300 transition-colors ${subtitlesEnabled ? 'text-red-500' : ''}`}
                >
                  CC
                </button>
              )}

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="text-white hover:text-gray-300 transition-colors"
              >
                {isFullscreen ? (
                  <Minimize className="w-5 h-5" />
                ) : (
                  <Maximize className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
