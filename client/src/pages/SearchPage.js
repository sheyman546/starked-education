import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { Search, Filter, BookOpen, Clock, Star, Users, TrendingUp } from 'lucide-react';
import { contentAPI, searchAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import toast from 'react-hot-toast';

const SearchPage = () => {
  const { user } = useAuth();
  const { isOnline } = useOffline();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [filters, setFilters] = useState({
    type: '',
    category: '',
    level: '',
    duration: '',
    rating: ''
  });
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load search history from localStorage
  useEffect(() => {
    const history = localStorage.getItem('searchHistory');
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
  }, []);

  // Search content
  const { data: searchResults, isLoading, error } = useQuery(
    ['search-content', debouncedQuery, filters],
    () => {
      if (searchType === 'all') {
        return searchAPI.searchContent(debouncedQuery, filters);
      } else {
        return contentAPI.searchContent(debouncedQuery, filters);
      }
    },
    {
      enabled: !!debouncedQuery && debouncedQuery.length >= 2,
      onError: (error) => {
        toast.error('Search failed. Please try again.');
        console.error('Search error:', error);
      },
    }
  );

  // Get popular courses
  const { data: popularCourses } = useQuery(
    'popular-courses',
    searchAPI.getPopularCourses,
    {
      enabled: !debouncedQuery || debouncedQuery.length < 2,
    }
  );

  // Get trending content
  const { data: trendingContent } = useQuery(
    'trending-content',
    searchAPI.getTrendingContent,
    {
      enabled: !debouncedQuery || debouncedQuery.length < 2,
    }
  );

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Add to search history
      const newHistory = [searchQuery, ...searchHistory.filter(h => h !== searchQuery)].slice(0, 10);
      setSearchHistory(newHistory);
      localStorage.setItem('searchHistory', JSON.stringify(newHistory));
    }
  };

  // Handle filter change
  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      type: '',
      category: '',
      level: '',
      duration: '',
      rating: ''
    });
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return 'Self-paced';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Get content icon
  const getContentIcon = (type) => {
    switch (type) {
      case 'video': return '🎥';
      case 'audio': return '🎧';
      case 'document': return '📄';
      case 'code': return '💻';
      case 'text': return '📖';
      case 'interactive': return '🎮';
      default: return '📚';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Search Content</h1>
          
          {/* Search Form */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for courses, lessons, or topics..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Search
              </button>
            </div>
          </form>

          {/* Search Type Toggle */}
          <div className="flex items-center space-x-4 mb-6">
            <label className="text-sm font-medium text-gray-700">Search in:</label>
            <div className="flex space-x-2">
              <button
                onClick={() => setSearchType('all')}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  searchType === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                All Content
              </button>
              <button
                onClick={() => setSearchType('courses')}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  searchType === 'courses'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Courses Only
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900 flex items-center space-x-2">
                <Filter className="w-4 h-4" />
                <span>Filters</span>
              </h3>
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Clear all
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Content Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content Type
                </label>
                <select
                  value={filters.type}
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="video">Video</option>
                  <option value="audio">Audio</option>
                  <option value="document">Document</option>
                  <option value="code">Code</option>
                  <option value="text">Text</option>
                  <option value="interactive">Interactive</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Categories</option>
                  <option value="programming">Programming</option>
                  <option value="design">Design</option>
                  <option value="business">Business</option>
                  <option value="marketing">Marketing</option>
                  <option value="data-science">Data Science</option>
                  <option value="languages">Languages</option>
                </select>
              </div>

              {/* Level Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Level
                </label>
                <select
                  value={filters.level}
                  onChange={(e) => handleFilterChange('level', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Levels</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              {/* Duration Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration
                </label>
                <select
                  value={filters.duration}
                  onChange={(e) => handleFilterChange('duration', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Any Duration</option>
                  <option value="short">Under 30 min</option>
                  <option value="medium">30-60 min</option>
                  <option value="long">Over 1 hour</option>
                </select>
              </div>

              {/* Rating Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rating
                </label>
                <select
                  value={filters.rating}
                  onChange={(e) => handleFilterChange('rating', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Any Rating</option>
                  <option value="4">4+ Stars</option>
                  <option value="3">3+ Stars</option>
                  <option value="2">2+ Stars</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Search History */}
        {searchHistory.length > 0 && !debouncedQuery && (
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Searches</h3>
            <div className="flex flex-wrap gap-2">
              {searchHistory.map((term, index) => (
                <button
                  key={index}
                  onClick={() => setSearchQuery(term)}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        {debouncedQuery && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Search Results
                {searchResults && (
                  <span className="text-sm font-normal text-gray-600 ml-2">
                    ({searchResults.content?.length || 0} results)
                  </span>
                )}
              </h2>
              {!isOnline && (
                <div className="text-sm text-orange-600">
                  Searching offline content only
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Search failed. Please try again.</p>
              </div>
            ) : searchResults?.content?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {searchResults.content.map((content) => (
                  <div key={content._id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl">{getContentIcon(content.type)}</span>
                          <span className="text-sm text-gray-500 capitalize">{content.type}</span>
                        </div>
                        {content.averageRating > 0 && (
                          <div className="flex items-center space-x-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                            <span className="text-sm text-gray-600">{content.averageRating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>

                      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                        {content.title}
                      </h3>

                      <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                        {content.description}
                      </p>

                      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{formatDuration(content.duration)}</span>
                        </div>
                        {content.viewCount > 0 && (
                          <div className="flex items-center space-x-1">
                            <Users className="w-4 h-4" />
                            <span>{content.viewCount}</span>
                          </div>
                        )}
                      </div>

                      {content.metadata?.tags && (
                        <div className="flex flex-wrap gap-1 mb-4">
                          {content.metadata.tags.slice(0, 3).map((tag, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => {
                          // Navigate to content player
                          window.location.href = `/app/player/${content._id}`;
                        }}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Start Learning
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
                <p className="text-gray-600 mb-4">
                  Try adjusting your search terms or filters
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    clearFilters();
                  }}
                  className="text-blue-600 hover:text-blue-700"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>
        )}

        {/* Popular Content (when not searching) */}
        {!debouncedQuery && (
          <div>
            {/* Popular Courses */}
            {popularCourses?.length > 0 && (
              <div className="mb-12">
                <div className="flex items-center space-x-2 mb-6">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                  <h2 className="text-xl font-semibold text-gray-900">Popular Courses</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {popularCourses.map((course) => (
                    <div key={course._id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-sm text-gray-500 capitalize">{course.category}</span>
                          <div className="flex items-center space-x-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                            <span className="text-sm text-gray-600">{course.rating.average.toFixed(1)}</span>
                          </div>
                        </div>

                        <h3 className="font-semibold text-gray-900 mb-2">{course.title}</h3>
                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{course.description}</p>

                        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                          <span>{course.enrolledStudents} students</span>
                          <span>{course.totalLessons} lessons</span>
                        </div>

                        <button
                          onClick={() => {
                            window.location.href = `/course/${course._id}`;
                          }}
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          View Course
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trending Content */}
            {trendingContent?.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-6">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  <h2 className="text-xl font-semibold text-gray-900">Trending Content</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {trendingContent.map((content) => (
                    <div key={content._id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-4">
                      <div className="flex items-center space-x-2 mb-3">
                        <span className="text-xl">{getContentIcon(content.type)}</span>
                        <span className="text-xs text-gray-500 capitalize">{content.type}</span>
                      </div>

                      <h4 className="font-medium text-gray-900 mb-2 line-clamp-2 text-sm">
                        {content.title}
                      </h4>

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{formatDuration(content.duration)}</span>
                        <span>{content.viewCount} views</span>
                      </div>

                      <button
                        onClick={() => {
                          window.location.href = `/app/player/${content._id}`;
                        }}
                        className="w-full mt-3 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      >
                        Watch
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
