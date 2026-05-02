import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTasks, 
  faCalendarAlt, 
  faCheckCircle, 
  faExclamationTriangle,
  faClock,
  faPlay,
  faPause,
  faStop,
  faPlus,
  faEdit,
  faTrash,
  faFilter,
  faSearch,
  faBullseye,
  faFlag,
  faUser,
  faComments,
  faChartLine
} from '@fortawesome/free-solid-svg-icons';
import { API_URL } from '../config.js';

const MyTasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedPriority, setSelectedPriority] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('list'); // list or card
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [timeTracking, setTimeTracking] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [recentlyUpdatedTasks, setRecentlyUpdatedTasks] = useState(new Set());



  useEffect(() => {
    // Clean up old localStorage entries
    const cleanupOldUpdates = () => {
      const recentUpdates = JSON.parse(localStorage.getItem('recentTaskUpdates') || '{}');
      const now = Date.now();
      const cleaned = {};
      
      Object.keys(recentUpdates).forEach(taskId => {
        const update = recentUpdates[taskId];
        // Keep entries younger than 5 minutes
        if (update && update.timestamp && (now - update.timestamp < 300000)) {
          cleaned[taskId] = update;
        }
      });
      
      localStorage.setItem('recentTaskUpdates', JSON.stringify(cleaned));
    };
    
    cleanupOldUpdates();
    fetchMyTasks();
  }, []);

  // Fetch tasks assigned to current user
  const fetchMyTasks = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('access_token');
      const currentUserData = JSON.parse(localStorage.getItem('user') || localStorage.getItem('user_data') || '{}');
      setCurrentUser(currentUserData);
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Use the existing mytasks endpoint  
      const tasksRes = await fetch(`${API_URL}/api/tasks/mytasks`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!tasksRes.ok) {
        throw new Error(`Failed to fetch tasks: ${tasksRes.status}`);
      }

      const tasksData = await tasksRes.json();
      console.log('Fetched my tasks data:', tasksData);
      console.log('Raw task statuses:', tasksData.map(t => ({ id: t.id, status: t.status, priority: t.priority })));

      // The endpoint returns List[TaskModel] directly
      if (Array.isArray(tasksData)) {
        // Transform tasks to match expected format
        const transformedTasks = tasksData.map(task => {
          const taskId = task.id || task._id;
          
          // Check for recent updates in memory and localStorage
          const existingTask = tasks.find(t => t.id === taskId);
          const wasRecentlyUpdated = recentlyUpdatedTasks.has(taskId);
          
          // Check localStorage for recent updates (survives refresh)
          const recentUpdates = JSON.parse(localStorage.getItem('recentTaskUpdates') || '{}');
          const storedUpdate = recentUpdates[taskId];
          const hasStoredUpdate = storedUpdate && (Date.now() - storedUpdate.timestamp < 300000); // 5 minutes
          
          // Normalize status to title case for consistent UI
          const normalizeStatus = (status) => {
            if (!status) return 'Pending';
            switch(status.toLowerCase()) {
              case 'pending': return 'Pending';
              case 'in progress': case 'in_progress': return 'In Progress';
              case 'completed': return 'Completed';
              case 'overdue': return 'Overdue';
              default: return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
            }
          };

          // Normalize priority to title case
          const normalizePriority = (priority) => {
            if (!priority) return 'Medium';
            switch(priority.toLowerCase()) {
              case 'high': return 'High';
              case 'medium': return 'Medium';
              case 'low': return 'Low';
              default: return priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
            }
          };

          let transformed = {
            id: taskId,
            taskName: task.title || task.task_name || 'Untitled Task',
            description: task.description || 'No description provided',
            assignedBy: task.created_by || 'System',
            priority: normalizePriority(task.priority),
            status: normalizeStatus(task.status),
            dueDate: task.due_date || task.assigned_date || task.created_at || '',
            estimatedHours: task.estimated_hours || 0,
            timeSpent: parseInt(task.time_spent) || 0,
            progress: parseInt(task.progress) || 0,
            team: task.team || 'General',
            comments: 0, // Can be enhanced later
            attachments: 0, // Can be enhanced later
            createdDate: task.created_at ? new Date(task.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            assignedTo: task.assigned_to_name || currentUserData.full_name || currentUserData.name
          };
          
          // Calculate time deviation
          const estimatedHours = parseFloat(transformed.estimatedHours) || 0;
          const actualHours = parseFloat(transformed.timeSpent) || 0;
          const deviationHours = actualHours - estimatedHours;
          let deviationText = '0 hrs';
          if (deviationHours > 0) {
            deviationText = `+${deviationHours.toFixed(1)} hrs (Over)`;
          } else if (deviationHours < 0) {
            deviationText = `${deviationHours.toFixed(1)} hrs (Under)`;
          } else if (estimatedHours > 0 && actualHours === 0) {
            deviationText = 'Not started';
          } else if (estimatedHours > 0) {
            deviationText = 'On track';
          }
          transformed.deviation = deviationText;
          
          // Ensure completed tasks always show 100% progress
          if (transformed.status === 'Completed' && transformed.progress !== 100) {
            transformed.progress = 100;
          }
          
          // Apply recent updates if available
          if (hasStoredUpdate) {
            transformed = {
              ...transformed,
              progress: storedUpdate.progress || transformed.progress,
              timeSpent: storedUpdate.timeSpent || transformed.timeSpent,
              status: storedUpdate.status || transformed.status,
              priority: storedUpdate.priority || transformed.priority,
              description: storedUpdate.description || transformed.description
            };
            console.log(`Applied stored update for task ${taskId} - Progress: ${transformed.progress}%`);
          } else if (wasRecentlyUpdated && existingTask) {
            transformed.progress = existingTask.progress;
            transformed.timeSpent = existingTask.timeSpent;
            console.log(`Preserved in-memory update for task ${taskId} - Progress: ${transformed.progress}%`);
          } else {
            console.log(`Task ${taskId} using backend data - Progress: ${transformed.progress}%`);
          }
          
          return transformed;
        });

        setTasks(transformedTasks);
        console.log('Transformed tasks:', transformedTasks);
        console.log('Final task statuses:', transformedTasks.map(t => ({ id: t.id, status: t.status, priority: t.priority })));
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err.message || 'Failed to fetch tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    // Normalize both selected status and task status for comparison
    const normalizeForComparison = (status) => {
      if (!status) return '';
      return status.toLowerCase().replace(/[^a-z]/g, '');
    };
    
    const matchesStatus = selectedStatus === 'All' || 
                         task.status === selectedStatus ||
                         normalizeForComparison(task.status) === normalizeForComparison(selectedStatus);
    const matchesPriority = selectedPriority === 'All' || task.priority === selectedPriority;
    const matchesSearch = task.taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Debug logging for first few tasks
    if (tasks.indexOf(task) < 3) {
      console.log(`Filter debug - Task ${task.id}:`, {
        taskStatus: task.status,
        selectedStatus,
        normalizedTaskStatus: normalizeForComparison(task.status),
        normalizedSelectedStatus: normalizeForComparison(selectedStatus),
        matchesStatus,
        matchesPriority,
        matchesSearch
      });
    }
    
    return matchesStatus && matchesPriority && matchesSearch;
  });

  // Get task statistics
  const taskStats = {
    total: tasks.length,
    pending: tasks.filter(t => {
      const status = (t.status || '').toLowerCase();
      return status === 'pending' || t.status === 'Pending';
    }).length,
    inProgress: tasks.filter(t => {
      const status = (t.status || '').toLowerCase().replace(/[^a-z]/g, '');
      return status === 'inprogress' || t.status === 'In Progress';
    }).length,
    completed: tasks.filter(t => {
      const status = (t.status || '').toLowerCase();
      return status === 'completed' || t.status === 'Completed';
    }).length,
    overdue: tasks.filter(t => {
      const status = (t.status || '').toLowerCase();
      return status === 'overdue' || t.status === 'Overdue';
    }).length
  };

  // Handle status update
  const handleStatusUpdate = async (taskId, newStatus) => {
    try {
      // Convert frontend status to backend format
      const backendStatus = newStatus.toLowerCase().replace(' ', '_');
      
      // Determine if progress should be set to 100% for completed tasks
      const shouldSetProgress100 = newStatus === 'Completed';
      const updateData = { status: backendStatus };
      if (shouldSetProgress100) {
        updateData.progress = 100;
      }
      
      // Update local state immediately for responsive UI
      setTasks(prev => prev.map(task => 
        task.id === taskId ? { 
          ...task, 
          status: newStatus,
          ...(shouldSetProgress100 ? { progress: 100 } : {})
        } : task
      ));
      
      // Persist to backend
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        // Revert local change if backend update fails
        console.error('Failed to update status on backend');
        fetchMyTasks(); // Refresh from backend
        throw new Error('Failed to update status');
      }
      
      console.log(`Task ${taskId} status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
      // Revert the optimistic update
      fetchMyTasks();
    }
  };

  // Handle task update
  const handleUpdateTask = async (taskId, updateData) => {
    try {
      setUpdating(true);
      const token = localStorage.getItem('access_token');
      
      console.log('Updating task:', taskId, 'with data:', updateData);
      
      // Convert frontend format to backend format
      const backendUpdateData = {
        ...updateData,
        status: updateData.status ? updateData.status.toLowerCase().replace(' ', '_') : undefined,
        priority: updateData.priority ? updateData.priority.toLowerCase() : undefined
      };
      
      const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(backendUpdateData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Update response:', result);
        
        // Use the response data if available, otherwise use our update data
        const backendData = result.data || result.task || {};
        console.log('Backend returned data:', backendData);
        
        const finalUpdateData = {
          ...updateData,
          // Always use our update data to ensure it shows correctly
          progress: parseInt(updateData.progress) || 0,
          timeSpent: parseInt(updateData.timeSpent) || 0,
          status: updateData.status,
          priority: updateData.priority,
          description: updateData.description
        };
        
        console.log('Final update data:', finalUpdateData);
        
        // Update the task in local state with final data
        setTasks(prev => {
          const updated = prev.map(task => {
            if (task.id === taskId) {
              const updatedTask = { 
                ...task, 
                ...finalUpdateData
              };
              console.log(`Task ${taskId} updated - Progress: ${task.progress} -> ${updatedTask.progress}`);
              return updatedTask;
            }
            return task;
          });
          return updated;
        });
        
        // Update selectedTask if it's the current task
        if (selectedTask && selectedTask.id === taskId) {
          setSelectedTask(prev => ({
            ...prev,
            ...finalUpdateData
          }));
        }
        
        // Track this task as recently updated
        setRecentlyUpdatedTasks(prev => new Set([...prev, taskId]));
        
        // Store updated task data in localStorage as backup
        const updatedTasksData = JSON.parse(localStorage.getItem('recentTaskUpdates') || '{}');
        updatedTasksData[taskId] = {
          ...finalUpdateData,
          timestamp: Date.now()
        };
        localStorage.setItem('recentTaskUpdates', JSON.stringify(updatedTasksData));
        
        // Clear the tracking after 30 seconds (increased time)
        setTimeout(() => {
          setRecentlyUpdatedTasks(prev => {
            const newSet = new Set(prev);
            newSet.delete(taskId);
            return newSet;
          });
          
          // Also clear from localStorage after some time
          const storedData = JSON.parse(localStorage.getItem('recentTaskUpdates') || '{}');
          delete storedData[taskId];
          localStorage.setItem('recentTaskUpdates', JSON.stringify(storedData));
        }, 30000);
        
        // Reset editing state
        setIsEditing(false);
        setEditingTask(null);
        
        // Show success message
        alert('Task updated successfully!');
        
      } else {
        const errorData = await response.json();
        console.error('Update failed:', errorData);
        throw new Error(errorData.detail || 'Failed to update task');
      }
    } catch (err) {
      console.error('Error updating task:', err);
      setError(`Failed to update task: ${err.message}`);
      alert(`Failed to update task: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  // Start editing task
  const startEditing = (task) => {
    console.log('Starting to edit task:', task);
    setIsEditing(true);
    setEditingTask({
      status: task.status || 'pending',
      priority: task.priority || 'Medium',
      progress: parseInt(task.progress) || 0,
      timeSpent: parseInt(task.timeSpent) || 0,
      description: task.description || ''
    });
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
    setEditingTask(null);
  };

  // Save task changes
  const saveTask = () => {
    if (selectedTask && editingTask) {
      // Ensure data types are correct before sending
      let updateData = {
        ...editingTask,
        progress: parseInt(editingTask.progress) || 0,
        timeSpent: parseInt(editingTask.timeSpent) || 0
      };
      
      // Automatically set progress to 100% if status is Completed
      if (editingTask.status === 'Completed') {
        updateData.progress = 100;
      }
      
      // Automatically set status to Completed if progress is 100%
      if (updateData.progress === 100 && updateData.status !== 'Completed') {
        updateData.status = 'Completed';
      }
      
      console.log('Saving task with data:', updateData);
      handleUpdateTask(selectedTask.id, updateData);
    }
  };

  // Handle time tracking
  const handleTimeTracking = (taskId, action) => {
    const currentTime = new Date().toLocaleTimeString();
    setTimeTracking(prev => ({
      ...prev,
      [taskId]: { action, time: currentTime }
    }));
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'High': return 'text-red-600 bg-red-100';
      case 'Medium': return 'text-yellow-600 bg-yellow-100';
      case 'Low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch(status) {
      case 'Completed': return 'text-green-600 bg-green-100';
      case 'In Progress': return 'text-blue-600 bg-blue-100';
      case 'Pending': return 'text-yellow-600 bg-yellow-100';
      case 'Overdue': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch(status) {
      case 'Completed': return faCheckCircle;
      case 'In Progress': return faClock;
      case 'Pending': return faExclamationTriangle;
      case 'Overdue': return faExclamationTriangle;
      default: return faClock;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="p-4 bg-red-100 rounded-lg mb-4 inline-block">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-600 text-3xl mb-2 block" />
            <p className="text-red-600 font-medium">Error loading tasks</p>
            <p className="text-red-500 text-sm">{error}</p>
          </div>
          <br />
          <button 
            onClick={fetchMyTasks}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-lg shadow-lg mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
              <FontAwesomeIcon icon={faTasks} className="text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">My Tasks</h1>
              <p className="text-blue-100 text-sm">Manage and track your assigned tasks</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={fetchMyTasks}
              disabled={loading}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <FontAwesomeIcon icon={loading ? faClock : faPlay} className="mr-2" />
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <div className="text-right">
              <p className="text-sm text-blue-100">Today</p>
              <p className="text-lg font-semibold">{new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Tasks</p>
              <p className="text-2xl font-bold text-gray-900">{taskStats.total}</p>
            </div>
            <FontAwesomeIcon icon={faTasks} className="text-2xl text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{taskStats.pending}</p>
            </div>
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl text-yellow-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-blue-600">{taskStats.inProgress}</p>
            </div>
            <FontAwesomeIcon icon={faClock} className="text-2xl text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{taskStats.completed}</p>
            </div>
            <FontAwesomeIcon icon={faCheckCircle} className="text-2xl text-green-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overdue</p>
              <p className="text-2xl font-bold text-red-600">{taskStats.overdue}</p>
            </div>
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl text-red-500" />
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative">
              <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
            </div>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Overdue">Overdue</option>
            </select>

            {/* Priority Filter */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Priority</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 rounded ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-2 rounded ${viewMode === 'card' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              Cards
            </button>
          </div>
        </div>
      </div>

      {/* Tasks Display */}
      {viewMode === 'list' ? (
        // List View
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                      <FontAwesomeIcon icon={faTasks} className="text-4xl mb-2 block mx-auto" />
                      <p className="text-lg font-medium mb-2">No tasks found</p>
                      <p className="text-sm">
                        {tasks.length === 0 
                          ? "You don't have any tasks assigned yet." 
                          : "No tasks match your current filter criteria."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => {
                    // Format due date properly
                    const formatDate = (dateString) => {
                      if (!dateString) return 'Not set';
                      try {
                        // Handle different date formats
                        let date;
                        if (dateString.includes('T')) {
                          // ISO format with time
                          date = new Date(dateString);
                        } else if (dateString.includes('-')) {
                          // YYYY-MM-DD format
                          date = new Date(dateString + 'T00:00:00');
                        } else {
                          // Try parsing as is
                          date = new Date(dateString);
                        }
                        
                        // Check if date is valid
                        if (isNaN(date.getTime())) {
                          return dateString; // Return original if can't parse
                        }
                        
                        return date.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        });
                      } catch (error) {
                        console.log('Date parsing error:', error, 'for date:', dateString);
                        return dateString; // fallback to original string if parsing fails
                      }
                    };
                    
                    return (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{task.taskName}</p>
                        <p className="text-xs text-gray-500">{task.description.substring(0, 50)}...</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{task.assignedBy}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                        <FontAwesomeIcon icon={faFlag} className="mr-1" />
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                        <FontAwesomeIcon icon={getStatusIcon(task.status)} className="mr-1" />
                        {task.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatDate(task.dueDate)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${task.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500">{task.progress}%</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="text-xs text-gray-600">
                        <div className="font-medium">{task.timeSpent}h / {task.estimatedHours}h</div>
                        <div className={`text-xs mt-1 ${
                          task.deviation?.includes('Over') ? 'text-red-600' : 
                          task.deviation?.includes('Under') ? 'text-green-600' :
                          task.deviation?.includes('Not started') ? 'text-gray-500' : 'text-blue-600'
                        }`}>
                          {task.deviation || '0 hrs'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {task.status === 'Pending' && (
                          <button
                            onClick={() => handleStatusUpdate(task.id, 'In Progress')}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <FontAwesomeIcon icon={faPlay} />
                          </button>
                        )}
                        {task.status === 'In Progress' && (
                          <>
                            <button
                              onClick={() => handleStatusUpdate(task.id, 'Completed')}
                              className="text-green-600 hover:text-green-800"
                            >
                              <FontAwesomeIcon icon={faCheckCircle} />
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(task.id, 'Pending')}
                              className="text-yellow-600 hover:text-yellow-800"
                            >
                              <FontAwesomeIcon icon={faPause} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => {setSelectedTask(task); setShowTaskModal(true);}}
                          className="text-gray-600 hover:text-gray-800"
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                      </div>
                    </td>
                  </tr>
                    );
                  }))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // Card View
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTasks.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <FontAwesomeIcon icon={faTasks} className="text-6xl text-gray-300 mb-4" />
              <p className="text-xl font-medium text-gray-600 mb-2">No tasks found</p>
              <p className="text-gray-500">
                {tasks.length === 0 
                  ? "You don't have any tasks assigned yet." 
                  : "No tasks match your current filter criteria."}
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => (
            <div key={task.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                  <FontAwesomeIcon icon={faFlag} className="mr-1" />
                  {task.priority}
                </span>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                  <FontAwesomeIcon icon={getStatusIcon(task.status)} className="mr-1" />
                  {task.status}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">{task.taskName}</h3>
              <p className="text-sm text-gray-600 mb-3">{task.description}</p>

              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Progress</span>
                  <span>{task.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${task.progress}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center">
                  <FontAwesomeIcon icon={faUser} className="mr-2" />
                  <span>Assigned by: {task.assignedBy}</span>
                </div>
                <div className="flex items-center">
                  <FontAwesomeIcon icon={faCalendarAlt} className="mr-2" />
                  <span>Due: {task.dueDate}</span>
                </div>
                <div className="flex items-center">
                  <FontAwesomeIcon icon={faClock} className="mr-2" />
                  <span>{task.timeSpent}h / {task.estimatedHours}h</span>
                </div>
                <div className="flex items-center">
                  <FontAwesomeIcon icon={faChartLine} className="mr-2" />
                  <span className={`${
                    task.deviation?.includes('Over') ? 'text-red-600' : 
                    task.deviation?.includes('Under') ? 'text-green-600' :
                    task.deviation?.includes('Not started') ? 'text-gray-500' : 'text-blue-600'
                  }`}>
                    {task.deviation || '0 hrs'}
                  </span>
                </div>
                {task.comments > 0 && (
                  <div className="flex items-center">
                    <FontAwesomeIcon icon={faComments} className="mr-2" />
                    <span>{task.comments} comments</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between">
                <div className="flex space-x-2">
                  {task.status === 'Pending' && (
                    <button
                      onClick={() => handleStatusUpdate(task.id, 'In Progress')}
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >
                      Start
                    </button>
                  )}
                  {task.status === 'In Progress' && (
                    <button
                      onClick={() => handleStatusUpdate(task.id, 'Completed')}
                      className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                    >
                      Complete
                    </button>
                  )}
                </div>
                <button
                  onClick={() => {setSelectedTask(task); setShowTaskModal(true);}}
                  className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200"
                >
                  Details
                </button>
              </div>
            </div>
          )))}
        </div>
      )}

      {/* Task Detail Modal */}
      {showTaskModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">{selectedTask.taskName}</h3>
                <div className="flex items-center space-x-3">
                  {!isEditing && (
                    <button
                      onClick={() => startEditing(selectedTask)}
                      className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowTaskModal(false);
                      cancelEditing();
                    }}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  {isEditing ? (
                    <textarea
                      value={editingTask?.description || selectedTask.description}
                      onChange={(e) => setEditingTask(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      rows="3"
                    />
                  ) : (
                    <p className="text-gray-900">{selectedTask.description}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(selectedTask.priority)}`}>
                      {selectedTask.priority}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    {isEditing ? (
                      <select
                        value={editingTask?.status || selectedTask.status}
                        onChange={(e) => {
                          const newStatus = e.target.value;
                          setEditingTask(prev => {
                            const updated = { ...prev, status: newStatus };
                            // Automatically set progress to 100% if status is Completed
                            if (newStatus === 'Completed') {
                              updated.progress = 100;
                            }
                            return updated;
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Overdue">Overdue</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedTask.status)}`}>
                        {selectedTask.status}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                    <p className="text-gray-900">{selectedTask.dueDate || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assigned By</label>
                    <p className="text-gray-900">{selectedTask.assignedBy}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Progress</label>
                  {isEditing ? (
                    <div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={editingTask?.progress || selectedTask.progress}
                        onChange={(e) => {
                          const newProgress = parseInt(e.target.value);
                          setEditingTask(prev => {
                            const updated = { ...prev, progress: newProgress };
                            // Automatically set status to Completed if progress reaches 100%
                            if (newProgress === 100 && updated.status !== 'Completed') {
                              updated.status = 'Completed';
                            }
                            // Reset status from Completed if progress drops below 100%
                            else if (newProgress < 100 && updated.status === 'Completed') {
                              updated.status = 'In Progress';
                            }
                            return updated;
                          });
                        }}
                        className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-sm text-gray-600">{editingTask?.progress || selectedTask.progress}%</span>
                    </div>
                  ) : (
                    <div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-blue-600 h-3 rounded-full transition-all"
                          style={{ width: `${selectedTask.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600">{selectedTask.progress}%</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time Spent</label>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editingTask?.timeSpent || selectedTask.timeSpent}
                        onChange={(e) => setEditingTask(prev => ({ ...prev, timeSpent: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        min="0"
                        step="0.5"
                      />
                    ) : (
                      <p className="text-gray-900">{selectedTask.timeSpent} hours</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Hours</label>
                    <p className="text-gray-900">{selectedTask.estimatedHours} hours</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time Deviation</label>
                  <p className={`text-sm font-medium ${
                    selectedTask.deviation?.includes('Over') ? 'text-red-600' : 
                    selectedTask.deviation?.includes('Under') ? 'text-green-600' :
                    selectedTask.deviation?.includes('Not started') ? 'text-gray-500' : 'text-blue-600'
                  }`}>
                    {selectedTask.deviation || 'No deviation data'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200 mt-6">
                {isEditing ? (
                  <>
                    <button
                      onClick={cancelEditing}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      disabled={updating}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveTask}
                      disabled={updating}
                      className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updating ? 'Updating...' : 'Save Changes'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setShowTaskModal(false);
                        cancelEditing();
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Close
                    </button>
                    <button 
                      onClick={() => startEditing(selectedTask)}
                      className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Edit Task
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyTasksPage;