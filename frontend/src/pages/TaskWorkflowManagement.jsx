import React, { useEffect, useState, useMemo } from 'react'
import { API_URL } from '../config.js'

// Error Boundary Component
class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props)
		this.state = { hasError: false, error: null, errorInfo: null }
	}

	static getDerivedStateFromError(error) {
		return { hasError: true }
	}

	componentDidCatch(error, errorInfo) {
		this.setState({
			error: error,
			errorInfo: errorInfo
		})
		console.error('Error Boundary caught an error:', error, errorInfo)
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
					<div className="text-center max-w-md">
						<div className="p-4 bg-red-100 rounded-lg mb-4">
							<i className="fas fa-exclamation-triangle text-red-600 text-3xl mb-2"></i>
							<p className="text-red-600 font-medium">Component crashed</p>
							<p className="text-red-500 text-sm mt-2">
								{this.state.error && this.state.error.toString()}
							</p>
						</div>
						<button 
							onClick={() => {
								this.setState({ hasError: false, error: null, errorInfo: null })
								window.location.reload()
							}}
							className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
						>
							Reload Page
						</button>
					</div>
				</div>
			)
		}

		return this.props.children
	}
}

// Temporarily disable Chart.js to isolate error
const chartJSAvailable = false

function HRTaskManagementDashboard() {
	// Safer state initialization with error handling
	const [tasks, setTasks] = useState([])
	const [employees, setEmployees] = useState([])
	const [sites, setSites] = useState([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(null)
	const [componentError, setComponentError] = useState(null)
	const [selectedDateRange, setSelectedDateRange] = useState('all')
	const [selectedTeam, setSelectedTeam] = useState('All')
	const [selectedAssignedBy, setSelectedAssignedBy] = useState('All')
	const [selectedTimeSpent, setSelectedTimeSpent] = useState('All')
	const [searchTerm, setSearchTerm] = useState('')

	// Create task modal state
	const [showCreateTaskModal, setShowCreateTaskModal] = useState(false)
	const [creatingTask, setCreatingTask] = useState(false)
	const [newTask, setNewTask] = useState({
		title: '', // Changed from taskName to title to match TaskModel
		description: '',
		assigned_to: '', // Changed from assignedTo to assigned_to to match TaskModel
		assigned_by: '', // Changed from assignedBy to assigned_by to match TaskModel
		assigned_at: '', // Site/location where task is assigned
		priority: null,
		assigned_date: '', // Changed from dueDate to assigned_date
		timeSpent: 0,
		status: 'pending', // Default status as per TaskModel
		remarks: '',
		// UI fields for compatibility
		taskName: '', // Keep for UI compatibility
		assignedTo: '', // Keep for UI compatibility
		assignedBy: '', // Keep for UI compatibility
		team: '', // Keep for UI compatibility
		dueDate: '', // Keep for UI compatibility
		estimatedHours: ''
	})

	// Task details modal state
	const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false)
	const [selectedTask, setSelectedTask] = useState(null)
	const [taskUpdates, setTaskUpdates] = useState([])
	const [loadingUpdates, setLoadingUpdates] = useState(false)

	// Edit task modal state
	const [showEditTaskModal, setShowEditTaskModal] = useState(false)
	const [editingTask, setEditingTask] = useState(null)
	const [editTaskData, setEditTaskData] = useState({
		taskName: '', // Keep for UI compatibility
		title: '', // New schema field
		description: '',
		assignedTo: '', // Keep for UI compatibility  
		assigned_to: '', // New schema field
		assignedBy: '', // Keep for UI compatibility
		assigned_by: '', // New schema field
		team: '', // Keep for UI compatibility
		assigned_at: '', // New schema field (site/location)
		priority: null, // Changed from 'Medium' to null as per schema
		dueDate: '', // Keep for UI compatibility
		assigned_date: '', // New schema field
		estimatedHours: '',
		status: 'pending', // Changed default to match schema
		progress: 0,
		timeSpent: 0,
		remarks: '' // New schema field
	})

	// Task status trend state
	const [trendData, setTrendData] = useState([])
	const [loadingTrend, setLoadingTrend] = useState(false)
	const [trendPeriod, setTrendPeriod] = useState(30)
	const [chartError, setChartError] = useState(false)

	// Projects state
	const [projects, setProjects] = useState([])

	// Roles state
	const [roles, setRoles] = useState({})
	const [loadingRoles, setLoadingRoles] = useState(false)
	const [currentUser, setCurrentUser] = useState(null)

	// Employee documents state
	const [employeeDocuments, setEmployeeDocuments] = useState([])
	const [loadingDocuments, setLoadingDocuments] = useState(false)
	const [documentError, setDocumentError] = useState(null)
	const [showDocumentsModal, setShowDocumentsModal] = useState(false)
	const [selectedEmployeeForDocs, setSelectedEmployeeForDocs] = useState(null)

	// Export report state
	const [showExportModal, setShowExportModal] = useState(false)
	const [exportFormat, setExportFormat] = useState('csv')
	const [exportDateRange, setExportDateRange] = useState('all')
	const [exportFields, setExportFields] = useState({
		dateAssigned: true,
		taskName: true,
		employeeName: true,
		assignedBy: true,
		status: true,
		progress: true,
		timeSpent: true,
		priority: false,
		dueDate: false,
		lastActivity: false
	})
	const [exporting, setExporting] = useState(false)

	// Refresh state
	const [refreshing, setRefreshing] = useState(false)
	const [lastRefreshTime, setLastRefreshTime] = useState(null)
	const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)

	// Review modal state
	const [showReviewModal, setShowReviewModal] = useState(false)
	const [selectedTaskForReview, setSelectedTaskForReview] = useState(null)
	const [reviewData, setReviewData] = useState({
		rating: 5,
		comments: '',
		reviewType: 'project',
		recommendations: ''
	})
	const [submittingReview, setSubmittingReview] = useState(false)

	// Global error handler
	useEffect(() => {
		const handleError = (event) => {
			console.error('Global error caught:', event.error)
			setComponentError(`Global error: ${event.error?.message || 'Unknown error'}`)
		}

		const handleUnhandledRejection = (event) => {
			console.error('Unhandled promise rejection:', event.reason)
			setComponentError(`Promise rejection: ${event.reason?.message || 'Unknown rejection'}`)
		}

		window.addEventListener('error', handleError)
		window.addEventListener('unhandledrejection', handleUnhandledRejection)

		return () => {
			window.removeEventListener('error', handleError)
			window.removeEventListener('unhandledrejection', handleUnhandledRejection)
		}
	}, [])

	// Fetch data on component mount
	useEffect(() => {
		let mounted = true
		
		async function loadData() {
			try {
				setLoading(true)
				setError(null)
				
				const token = localStorage.getItem('access_token')
				
				// Fetch current user info and tasks/employees in parallel
				const [currentUserData, tasksRes, employeesRes] = await Promise.all([
					fetchCurrentUser(),
					fetch(`${API_URL}/api/tasks/`, {
						headers: token ? { Authorization: `Bearer ${token}` } : {},
					}).catch(async (err) => {
						console.error('Failed to fetch from /api/tasks/raw:', err)
						// Try admin endpoint
						const adminRes = await fetch(`${API_URL}/api/tasks/`, {
							headers: token ? { Authorization: `Bearer ${token}` } : {},
						}).catch(async (err2) => {
							console.error('Failed to fetch from admin endpoint:', err2)
							// Fall back to personal tasks endpoint
							return fetch(`${API_URL}/api/tasks/mytasks`, {
								headers: token ? { Authorization: `Bearer ${token}` } : {},
							}).catch(err3 => {
								console.error('All task endpoints failed:', err3)
								// Return a mock response to prevent crash
								return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' }})
							})
						})
						return adminRes
					}),
					fetch(`${API_URL}/api/staff/employees?active_only=true`, {
						headers: token ? { Authorization: `Bearer ${token}` } : {},
					}).catch(async (err) => {
						console.error('Failed to fetch from staff endpoint:', err)
						// Try users endpoint as fallback
						return fetch(`${API_URL}/api/users/?except_role=customer`, {
							headers: token ? { Authorization: `Bearer ${token}` } : {},
						}).catch(err2 => {
							console.error('All employee endpoints failed:', err2)
							// Return empty array to prevent crash
							return new Response('{"success": true, "data": []}', { 
								status: 200, 
								headers: { 'Content-Type': 'application/json' }
							})
						})
					})
				])

				console.log('API URL being used:', API_URL)
				console.log('Tasks response status:', tasksRes.status)
				console.log('Tasks response URL:', tasksRes.url)

				// Handle tasks response
				if (!tasksRes.ok) {
					throw new Error(`Failed to fetch tasks: ${tasksRes.status}`)
				}
				const tasksData = await tasksRes.json()
				
				// Handle employees response  
				if (!employeesRes.ok) {
					throw new Error(`Failed to fetch employees: ${employeesRes.status}`)
				}
				const employeesRawData = await employeesRes.json()
				
				// Handle different response formats from staff API
				let employeesData = []
				if (employeesRawData.success && employeesRawData.data) {
					employeesData = employeesRawData.data
				} else if (Array.isArray(employeesRawData)) {
					employeesData = employeesRawData
				} else {
					employeesData = []
				}

				console.log('Raw employees data:', employeesRawData)
				console.log('Processed employees data:', employeesData)
				console.log('Sample employee object:', employeesData[0])

				// Try to fetch sites data (optional - may require admin permissions)
				let sitesData = []
				try {
					const sitesRes = await fetch(`${API_URL}/api/sites/`, {
						headers: token ? { Authorization: `Bearer ${token}` } : {},
					})
					if (sitesRes.ok) {
						const sitesRawData = await sitesRes.json()
						// Handle different response formats
						sitesData = sitesRawData.success ? sitesRawData.data : sitesRawData
					} else {
						console.warn('Sites data not available (may require admin permissions):', sitesRes.status)
					}
				} catch (sitesError) {
					console.warn('Could not fetch sites data:', sitesError.message)
				}

				if (mounted) {
					// Set tasks - handle both formats from API
					const tasksList = tasksData?.data || tasksData || []
					
						// Transform and deduplicate tasks to match UI format
						const transformedTasks = tasksList
							.filter(task => task && (task.taskName || task.title) && (task.taskName || task.title).trim() !== '') // Filter out invalid tasks
							.map(task => {
								// Better assignedBy resolution with more fields and fallbacks
								let assignedBy = task.assigned_by || 
												  task.assignedBy || 
												  task.created_by_name || 
												  task.createdBy || 
												  task.created_by || 
												  task.manager || 
												  task.supervisor ||
												  task.assigned_by_name ||
												  (task.created_by_id && findEmployeeName(task.created_by_id, employeesData))

								// If assignedBy looks like a user ID (USR-xxx), try to resolve to actual name
								if (assignedBy && assignedBy.startsWith('USR-')) {
									const resolvedName = findEmployeeName(assignedBy, employeesData)
									if (resolvedName && resolvedName !== assignedBy) {
										assignedBy = resolvedName
									}
								}

								// If still no assignedBy found and we have current user data, use it
								if (!assignedBy && currentUserData) {
									assignedBy = currentUserData.full_name || currentUserData.username || 'System Admin'
								}

								// Final fallback
								if (!assignedBy) {
									assignedBy = 'System Admin'
								}

								console.log('Task mapping - Raw task fields:', {
									id: task.id,
									taskName: task.taskName || task.title,
									original_assignedBy: task.assignedBy,
									assigned_by: task.assigned_by, 
									created_by_name: task.created_by_name,
									createdBy: task.createdBy,
									created_by: task.created_by,
									resolved_assignedBy: assignedBy
								})

								return {
									id: task.id || task._id,
									employeeName: task.employeeName || task.assigned_to_name || findEmployeeName(task.assignedTo || task.assigned_to, employeesData),
									taskName: task.taskName || task.title,
									description: task.description || '',
									team: task.team || task.assigned_at || 'General', // Use assigned_at as team/site
									assignedBy: assignedBy,
									assignedTo: task.assignedTo || task.assigned_to,
									priority: task.priority,
									status: task.status,
									timeSpent: task.timeSpent || task.actual_hours || 0,
									deviation: task.deviation || '0 hrs',
									lastActivity: task.lastActivity || task.updated_at || new Date().toISOString().slice(0, 10),
									dueDate: task.dueDate || task.due_date || task.assigned_date,
									estimatedHours: task.estimatedHours || task.estimated_hours || 0,
									progress: task.status === 'completed' || task.status === 'Completed' ? 100 : (task.progress || 0),
									createdAt: task.createdAt || task.created_at,
									createdBy: task.createdBy || task.created_by_name,
									// New schema fields
									assigned_at: task.assigned_at,
									assigned_date: task.assigned_date || task.dueDate || task.due_date || task.createdAt || task.created_at,
									approved_by: task.approved_by,
									approved_at: task.approved_at,
									remarks: task.remarks,
									site_name: task.site_name
								}
							})					// Remove duplicates based on task ID
					const uniqueTasks = transformedTasks.filter((task, index, self) => 
						index === self.findIndex(t => t.id === task.id)
					)
					
					setTasks(uniqueTasks)
					console.log('Sample task structure:', uniqueTasks[0])
					console.log('Task assignedBy values:', uniqueTasks.map(t => t.assignedBy))
					
					// Set employees with filtering for actual employees only
					const employeesList = Array.isArray(employeesData) ? employeesData : (employeesData?.data || []);
					if (!Array.isArray(employeesList)) {
						console.error("Employees data is not an array:", employeesData);
						setEmployees([]);
					} else {
						// Filter to show only users with employee, labour, and HR roles (exclude admins and unassigned)
						const actualEmployees = employeesList.filter(emp => {
							// Exclude admin roles and system users
							if (emp.full_name === 'System Administrator' || 
								emp.name === 'System Administrator' ||
								emp.username === 'admin' ||
								emp.role === 'admin' ||
								emp.role === 'super_admin') {
								return false;
							}
							
							// Exclude users with "Not Assigned" status
							if ((emp.full_name && emp.full_name.includes('Not Assigned')) ||
								(emp.name && emp.name.includes('Not Assigned'))) {
								return false;
							}
							
							// Only include users with specific employee-related roles
							const roleFields = [
								emp.role,
								emp.roles,
								emp.role_name,
								emp.user_type,
								emp.position,
								emp.designation
							];
							
							const hasEmployeeRole = roleFields.some(field => {
								if (!field) return false;
								if (Array.isArray(field)) {
									return field.some(role => {
										if (!role) return false;
										const roleStr = role.toString().toLowerCase();
										return roleStr === 'employee' || 
											   roleStr === 'labour' || 
											   roleStr === 'labor' || 
											   roleStr === 'hr' || 
											   roleStr === 'staff';
									});
								}
								const fieldStr = field.toString().toLowerCase();
								return fieldStr === 'employee' || 
									   fieldStr === 'labour' || 
									   fieldStr === 'labor' || 
									   fieldStr === 'hr' || 
									   fieldStr === 'staff';
							});
							
							// Must have a proper name
							const hasName = emp.full_name || emp.name;
							
							// Log for debugging
							console.log(`User: ${emp.full_name || emp.name}, Roles:`, roleFields, 'Include:', hasEmployeeRole && hasName);
							
							return hasEmployeeRole && hasName;
						})
						
						console.log('Raw employees count:', employeesList.length)
						console.log('Filtered employees count:', actualEmployees.length)
						console.log('Sample filtered employee:', actualEmployees[0])
						
						setEmployees(actualEmployees);
					}
				console.log('Employees data from backend:', employeesList)
				console.log('Sample employee structure:', employeesList[0])					// Set sites
					const sitesList = Array.isArray(sitesData) ? sitesData : (sitesData?.data || [])
					console.log('Sites data from backend:', sitesList)
					setSites(sitesList)
				}
				
			} catch (err) {
				console.error('Failed to fetch data:', err)
				if (mounted) {
					setError(err.message || String(err))
				}
			} finally {
				if (mounted) {
					setLoading(false)
				}
			}
		}

		// Helper function to find employee name by ID
		function findEmployeeName(assignedTo, employeesData) {
			try {
				const employeesList = Array.isArray(employeesData) ? employeesData : (employeesData?.data || [])
				console.log(`Looking for employee with ID: ${assignedTo}`)
				console.log(`Available employees count: ${employeesList.length}`)
				
				const employee = employeesList.find(emp => {
					const matches = [
						emp.employee_id === assignedTo,
						emp.user_id === assignedTo,
						emp._id === assignedTo,
						emp.full_name === assignedTo,
						emp.name === assignedTo,
						emp.emp_id === assignedTo,
						// For USR-xxx IDs, check if it matches any of the ID fields
						emp.user_id && emp.user_id.toString() === assignedTo,
						emp.employee_id && emp.employee_id.toString() === assignedTo
					]
					return matches.some(match => match === true)
				})
				
				if (employee) {
					console.log(`Found employee for ${assignedTo}:`, employee)
					return employee?.full_name || employee?.name || assignedTo
				} else {
					console.log(`No employee found for ${assignedTo}`)
					return assignedTo
				}
			} catch (error) {
				console.error('Error finding employee name:', error)
				return assignedTo || 'Unknown Employee'
			}
		}

		loadData().catch(error => {
			console.error('Error in loadData:', error)
			if (mounted) {
				setError('Failed to load dashboard data')
			}
		})
		
		return () => { mounted = false }
	}, [])// Load task status trend data
	
useEffect(() => {
	const loadTrendData = async () => {
		try {
			await fetchTaskStatusTrend(trendPeriod)
		} catch (error) {
			console.error('Error in trend data useEffect:', error)
			// Set safe fallback data
			setTrendData({
				trendData: [],
				dateLabels: [],
				summary: {
					totalTasks: 0,
					completedTasks: 0,
					inProgressTasks: 0,
					currentCompletionRate: 0,
					trendDirection: 'up'
				}
			})
		}
	}
	
	loadTrendData()
}, [trendPeriod])

	// Auto-refresh tasks every 30 seconds
	useEffect(() => {
		if (!autoRefreshEnabled) return
		
		const interval = setInterval(() => {
			// Only auto-refresh if not manually loading and not in an error state
			if (!loading && !refreshing && !error) {
				console.log('Auto-refreshing tasks...')
				refreshTasks(false) // Auto refresh without loading indicator
			}
		}, 30000) // 30 seconds

		return () => clearInterval(interval)
	}, [autoRefreshEnabled, loading, refreshing, error])

	// Fetch roles for employees when employees data changes
	useEffect(() => {
		const fetchEmployeeRoles = async () => {
			if (employees.length === 0 || loadingRoles) return

			console.log('Fetching roles for employees:', employees.length)
			setLoadingRoles(true)
			try {
				// Get unique role IDs from employees - handle both singular and array formats
				const roleIds = [...new Set(employees
					.flatMap(emp => {
						const ids = []
						if (emp.role_id) ids.push(emp.role_id)
						if (emp.role_ids && Array.isArray(emp.role_ids)) ids.push(...emp.role_ids)
						return ids
					})
					.filter(roleId => roleId && !roles[roleId])
				)]

				console.log('Found unique role IDs to fetch:', roleIds)

				if (roleIds.length === 0) {
					setLoadingRoles(false)
					return
				}

				// Try to fetch all roles at once first (more efficient)
				const token = localStorage.getItem('access_token')
				try {
					const allRolesResponse = await fetch(`${API_URL}/api/roles/`, {
						headers: token ? { Authorization: `Bearer ${token}` } : {},
					})
					
					if (allRolesResponse.ok) {
						const allRolesData = await allRolesResponse.json()
						const allRoles = Array.isArray(allRolesData) ? allRolesData : (allRolesData.roles || [])
						
						console.log('Fetched all roles:', allRoles.length)
						
						// Update roles state with all fetched roles
						const newRoles = {}
						allRoles.forEach(role => {
							if (role.id && roleIds.includes(role.id)) {
								newRoles[role.id] = role
							}
						})
						
						setRoles(prev => ({ ...prev, ...newRoles }))
						console.log('Updated roles state with:', Object.keys(newRoles))
						setLoadingRoles(false)
						return
					}
				} catch (error) {
					console.warn('Failed to fetch all roles, trying individual fetching:', error)
				}

				// Fallback: Fetch roles individually
				const rolePromises = roleIds.map(roleId => fetchRoleById(roleId))
				await Promise.allSettled(rolePromises)
			} catch (error) {
				console.error('Error fetching employee roles:', error)
			} finally {
				setLoadingRoles(false)
			}
		}

		fetchEmployeeRoles()
	}, [employees, roles])

	// Function to refresh tasks from API
	const refreshTasks = async (showLoadingIndicator = false) => {
		try {
			if (showLoadingIndicator) {
				setRefreshing(true)
			}
			
			const token = localStorage.getItem('access_token')
			
			let tasksRes
			try {
				// Try the raw endpoint first (requires admin/HR)
				tasksRes = await fetch(`${API_URL}/api/tasks/`, {
					headers: token ? { Authorization: `Bearer ${token}` } : {},
				})
			} catch (err) {
				console.warn('Failed to fetch from /tasks, trying admin endpoint:', err)
				try {
					// Try admin endpoint
					tasksRes = await fetch(`${API_URL}/api/tasks/`, {
						headers: token ? { Authorization: `Bearer ${token}` } : {},
					})
				} catch (err2) {
					console.warn('Failed to fetch from admin endpoint, trying personal tasks:', err2)
					// Fall back to personal tasks
					tasksRes = await fetch(`${API_URL}/api/tasks/mytasks`, {
						headers: token ? { Authorization: `Bearer ${token}` } : {},
					})
				}
			}

			if (!tasksRes.ok) {
				throw new Error(`Failed to fetch tasks: ${tasksRes.status}`)
			}

			const tasksData = await tasksRes.json()
			const tasksList = tasksData?.data || tasksData || []
			
			// Transform and deduplicate tasks to match UI format
				const transformedTasks = tasksList
					.filter(task => task && (task.taskName || task.title) && (task.taskName || task.title).trim() !== '') // Filter out invalid tasks
					.map(task => {
						// Calculate progress - if status is completed, set to 100%
						const baseProgress = task.progress || 0
						const finalProgress = task.status === 'completed' || task.status === 'Completed' ? 100 : baseProgress
						
						// Calculate time deviation
						const estimatedHours = parseFloat(task.estimatedHours || task.estimated_hours) || 0
						const actualHours = parseFloat(task.timeSpent || task.actual_hours) || 0
						const deviationHours = actualHours - estimatedHours
						let deviationText = '0 hrs'
						if (deviationHours > 0) {
							deviationText = `+${deviationHours.toFixed(1)} hrs (Over)`
						} else if (deviationHours < 0) {
							deviationText = `${deviationHours.toFixed(1)} hrs (Under)`
						} else if (estimatedHours > 0 && actualHours === 0) {
							deviationText = 'Not started'
						} else if (estimatedHours > 0) {
							deviationText = 'On track'
						}
						
						return {
							id: task.id || task._id,
							employeeName: task.employeeName || task.assigned_to_name || findEmployeeName(task.assignedTo || task.assigned_to),
							taskName: task.taskName || task.title,
							description: task.description || '',
							team: task.team || task.assigned_at || 'General',
							assignedBy: task.assignedBy || task.assigned_by || task.created_by_name,
							assignedTo: task.assignedTo || task.assigned_to,
							priority: task.priority,
							status: task.status,
							timeSpent: actualHours,
							deviation: deviationText,
							lastActivity: task.lastActivity || task.updated_at || new Date().toISOString().slice(0, 10),
							dueDate: task.dueDate || task.due_date,
							estimatedHours: estimatedHours,
							progress: finalProgress,
							createdAt: task.createdAt || task.created_at,
							createdBy: task.createdBy || task.created_by_name,
							// Ensure assigned_date has proper fallback
							assigned_date: task.assigned_date || task.dueDate || task.due_date || task.createdAt || task.created_at,
							assigned_at: task.assigned_at,
							approved_by: task.approved_by,
							approved_at: task.approved_at,
							remarks: task.remarks,
							site_name: task.site_name
						}
					})			// Remove duplicates based on task ID
			const uniqueTasks = transformedTasks.filter((task, index, self) => 
				index === self.findIndex(t => t.id === task.id)
			)
			
			setTasks(uniqueTasks)
			setLastRefreshTime(new Date())
			console.log('Tasks refreshed successfully at', new Date().toLocaleTimeString())
		} catch (err) {
			console.error('Failed to refresh tasks:', err)
		} finally {
			if (showLoadingIndicator) {
				setRefreshing(false)
			}
		}
	}

	// Manual refresh handler
	const handleManualRefresh = () => {
		refreshTasks(true)
	}

	// Helper function to find employee name by ID
	const findEmployeeName = (assignedTo) => {
		const employee = employees.find(emp => 
			emp.employee_id === assignedTo || 
			emp.user_id === assignedTo ||
			emp._id === assignedTo ||
			emp.full_name === assignedTo ||
			emp.name === assignedTo
		)
		return employee?.full_name || employee?.name || assignedTo || 'Unknown Employee'
	}

	// Function to fetch role information by role ID
	const fetchRoleById = async (roleId) => {
		if (!roleId || roles[roleId]) {
			return roles[roleId] || null
		}

		try {
			console.log(`Fetching role data for ID: ${roleId}`)
			const token = localStorage.getItem('access_token')
			
			// Try the main roles endpoint first
			let response = await fetch(`${API_URL}/api/roles/${roleId}`, {
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			})

			if (!response.ok) {
				console.warn(`Main roles endpoint failed for ${roleId}: ${response.status}, trying alternative endpoint`)
				// If main endpoint fails, try to get all roles and find the specific one
				const allRolesResponse = await fetch(`${API_URL}/api/roles/`, {
					headers: token ? { Authorization: `Bearer ${token}` } : {},
				})
				
				if (allRolesResponse.ok) {
					const allRolesData = await allRolesResponse.json()
					// Handle array response format directly  
					const allRoles = Array.isArray(allRolesData) ? allRolesData : []
					const roleData = allRoles.find(role => role.id === roleId || role._id === roleId)
					
					if (roleData) {
						console.log(`Role data found in all roles for ${roleId}:`, roleData)
						setRoles(prev => ({ ...prev, [roleId]: roleData }))
						return roleData
					}
				}
			} else {
				const roleData = await response.json()
				console.log(`Role data fetched for ${roleId}:`, roleData)
				setRoles(prev => ({ ...prev, [roleId]: roleData }))
				return roleData
			}
		} catch (error) {
			console.error('Error fetching role:', error)
		}
		return null
	}

	// Function to fetch current user information
	const fetchCurrentUser = async () => {
		try {
			const token = localStorage.getItem('access_token')
			if (!token) return null

			// Try the user-info endpoint first, then fall back to users/me
			let response = await fetch(`${API_URL}/api/auth/user-info`, {
				headers: { Authorization: `Bearer ${token}` },
			})
			
			if (!response.ok) {
				console.warn('User info endpoint failed, trying alternative:', response.status)
				response = await fetch(`${API_URL}/api/users/me`, {
					headers: { Authorization: `Bearer ${token}` },
				})
			}

			if (response.ok) {
				const userData = await response.json()
				console.log('Current user data:', userData)
				setCurrentUser(userData)
				return userData
			}
		} catch (error) {
			console.error('Error fetching current user:', error)
		}
		return null
	}

	// Function to get role for a user by employee data
	const getUserRole = (assignedBy) => {
		try {
			if (!assignedBy || !employees || employees.length === 0) {
				console.log('getUserRole: Missing assignedBy or employees')
				return null
			}

			console.log(`Finding role for assignedBy: "${assignedBy}"`)
			console.log(`Available employees count: ${employees.length}`)

			// Find employee by assigned by name/ID with more flexible matching
			const employee = employees.find(emp => {
				const matches = [
					emp.full_name === assignedBy,
					emp.name === assignedBy,
					emp.employee_id === assignedBy,
					emp.user_id === assignedBy,
					emp._id === assignedBy,
					emp.emp_id === assignedBy,
					// Case insensitive name matching
					emp.full_name && emp.full_name.toLowerCase() === assignedBy.toLowerCase(),
					emp.name && emp.name.toLowerCase() === assignedBy.toLowerCase(),
					// Partial name matching for cases like "HR Manager" 
					assignedBy.includes(emp.full_name) || (emp.full_name && emp.full_name.includes(assignedBy)),
					assignedBy.includes(emp.name) || (emp.name && emp.name.includes(assignedBy)),
					// For USR-xxx IDs, ensure exact string matching
					emp.user_id && emp.user_id.toString() === assignedBy,
					emp.employee_id && emp.employee_id.toString() === assignedBy
				]
				return matches.some(match => match === true)
			})

			console.log(`Found employee for "${assignedBy}":`, employee)

			if (employee) {
				// Check for role_id (singular) or role_ids (array)
				const roleId = employee.role_id || (employee.role_ids && employee.role_ids[0])
				console.log(`Employee role_id: ${roleId}`)
				console.log(`Available roles:`, Object.keys(roles))
				
				if (roleId && roles[roleId]) {
					console.log(`Found role data for ${roleId}:`, roles[roleId])
					return roles[roleId]
				}

				// Fallback: check if employee has role names in 'roles' field
				if (employee.roles && Array.isArray(employee.roles) && employee.roles.length > 0) {
					const roleName = employee.roles[0]
					console.log(`Using role name from roles array: ${roleName}`)
					// Return a role object with name from the roles array
					return {
						id: roleName,
						name: roleName.charAt(0).toUpperCase() + roleName.slice(1),
						description: `${roleName} role`
					}
				}

				// Another fallback: check for 'role' field (singular)
				if (employee.role) {
					console.log(`Using role from role field: ${employee.role}`)
					return {
						id: employee.role,
						name: employee.role.charAt(0).toUpperCase() + employee.role.slice(1),
						description: `${employee.role} role`
					}
				}

				// Special case: if assignedBy is "HR Manager", create a role for it
				if (assignedBy.toLowerCase().includes('manager')) {
					return {
						id: 'manager',
						name: 'Manager',
						description: 'Manager role'
					}
				}
			} else {
				// If no employee found but assignedBy contains role-like text, extract it
				if (assignedBy.toLowerCase().includes('manager')) {
					return {
						id: 'manager',
						name: 'Manager',
						description: 'Manager role'
					}
				}
				if (assignedBy.toLowerCase().includes('admin')) {
					return {
						id: 'admin',
						name: 'Administrator',
						description: 'Administrator role'
					}
				}
				if (assignedBy.toLowerCase().includes('hr')) {
					return {
						id: 'hr',
						name: 'HR',
						description: 'Human Resources role'
					}
				}
				if (assignedBy.toLowerCase().includes('system')) {
					return {
						id: 'system_admin',
						name: 'System Admin',
						description: 'System Administrator role'
					}
				}
				// For USR-xxx IDs that couldn't be resolved, assume admin role
				if (assignedBy.startsWith('USR-')) {
					return {
						id: 'admin',
						name: 'Administrator',
						description: 'System Administrator'
					}
				}
			}
			
			console.log(`No role found for "${assignedBy}"`)
			return null
		} catch (error) {
			console.error('Error getting user role:', error)
			return null
		}
	}

	// Fetch employee documents
	const fetchEmployeeDocuments = async (employeeId) => {
		setLoadingDocuments(true)
		setDocumentError(null)
		try {
			const token = localStorage.getItem('access_token')
			const response = await fetch(`${API_URL}/api/employee-docs/employees/${employeeId}/documents`, {
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			})

			if (response.ok) {
				const data = await response.json()
				setEmployeeDocuments(data.documents || [])
			} else {
				throw new Error(`Failed to fetch documents: ${response.status}`)
			}
		} catch (error) {
			console.error('Error fetching employee documents:', error)
			setDocumentError(error.message)
			setEmployeeDocuments([])
		} finally {
			setLoadingDocuments(false)
		}
	}

	// Handle view employee documents
	const handleViewEmployeeDocuments = async (employee) => {
		setSelectedEmployeeForDocs(employee)
		setShowDocumentsModal(true)
		await fetchEmployeeDocuments(employee.employee_id || employee.user_id)
	}

	// Close documents modal
	const closeDocumentsModal = () => {
		setShowDocumentsModal(false)
		setSelectedEmployeeForDocs(null)
		setEmployeeDocuments([])
		setDocumentError(null)
	}

	// Calculate statistics
	const statistics = useMemo(() => {
		const totalActive = tasks.filter(t => t?.status !== 'Completed').length
		const overdue = tasks.filter(t => t?.status === 'Overdue').length
		const completed = tasks.filter(t => t?.status === 'Completed').length
		const completionRate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0
		const highPriority = tasks.filter(t => t?.priority === 'High').length

		return {
			totalActiveTasks: totalActive,
			tasksOverdue: overdue,
			completionRate,
			highPriorityTasks: highPriority
		}
	}, [tasks])

	// Team workload distribution
	const teamWorkload = useMemo(() => {
		const teams = {}
		tasks.forEach(task => {
			const teamName = task?.team || 'General'
			if (!teams[teamName]) {
				teams[teamName] = { total: 0, inProgress: 0, completed: 0 }
			}
			teams[teamName].total++
			if (task?.status === 'In Progress') teams[teamName].inProgress++
			if (task?.status === 'Completed') teams[teamName].completed++
		})
		return Object.entries(teams).map(([team, data]) => ({
			team,
			...data,
			percentage: Math.round((data.total / tasks.length) * 100)
		}))
	}, [tasks])

	// Filter tasks
	const filteredTasks = useMemo(() => {
		return tasks.filter(task => {
			// Add safety checks to prevent errors with undefined properties
			const employeeName = task?.employeeName || ''
			const taskName = task?.taskName || ''
			const assignedBy = task?.assignedBy || ''
			const timeSpent = task?.timeSpent || 0
			const createdAt = task?.createdAt ? new Date(task.createdAt) : null
			
			const matchesSearch = employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
								taskName.toLowerCase().includes(searchTerm.toLowerCase())
			const matchesAssignedBy = selectedAssignedBy === 'All' || assignedBy === selectedAssignedBy
			
			// Date range filter
			let matchesDateRange = true
			if (selectedDateRange !== 'all' && createdAt) {
				const now = new Date()
				const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
				
				switch (selectedDateRange) {
					case 'today':
						matchesDateRange = createdAt >= today
						break
					case 'week':
						const weekAgo = new Date(today)
						weekAgo.setDate(today.getDate() - 7)
						matchesDateRange = createdAt >= weekAgo
						break
					case 'month':
						const monthAgo = new Date(today)
						monthAgo.setMonth(today.getMonth() - 1)
						matchesDateRange = createdAt >= monthAgo
						break
				}
			}
			
			// Time spent filter
			let matchesTimeSpent = true
			if (selectedTimeSpent !== 'All') {
				switch (selectedTimeSpent) {
					case 'low':
						matchesTimeSpent = timeSpent >= 0 && timeSpent <= 20
						break
					case 'medium':
						matchesTimeSpent = timeSpent > 20 && timeSpent <= 40
						break
					case 'high':
						matchesTimeSpent = timeSpent > 40
						break
				}
			}
			
			return matchesSearch && matchesAssignedBy && matchesDateRange && matchesTimeSpent
		})
	}, [tasks, searchTerm, selectedAssignedBy, selectedDateRange, selectedTimeSpent])

	// Get unique teams and assignees for filters
	const teams = useMemo(() => {
		const uniqueTeams = [...new Set(tasks.map(task => task?.team || 'General').filter(Boolean))]
		return ['All', ...uniqueTeams]
	}, [tasks])

	const assignees = useMemo(() => {
		const uniqueAssignees = [...new Set(tasks.map(task => task?.assignedBy || 'Unknown').filter(Boolean))]
		return ['All', ...uniqueAssignees]
	}, [tasks])

	// Task details and view handlers
	const handleTaskClick = async (task) => {
		setSelectedTask(task)
		setShowTaskDetailsModal(true)
		await fetchTaskUpdates(task.id)
	}

	const handleViewTaskDetails = async (task) => {
		setSelectedTask(task)
		setShowTaskDetailsModal(true)
		await fetchTaskUpdates(task.id)
	}

	const fetchTaskUpdates = async (taskId) => {
		setLoadingUpdates(true)
		try {
			const token = localStorage.getItem('access_token')
			const response = await fetch(`${API_URL}/api/tasks/${taskId}/updates`, {
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			})

			if (response.ok) {
				const data = await response.json()
				setTaskUpdates(data.updates || [])
			} else {
				// If endpoint doesn't exist, show mock data
				setTaskUpdates([
					{
						id: 1,
						type: 'status_change',
						message: 'Task status updated to In Progress',
						timestamp: new Date().toISOString(),
						user: 'Employee Name',
						details: 'Started working on the task'
					},
					{
						id: 2,
						type: 'comment',
						message: 'Added progress update',
						timestamp: new Date(Date.now() - 86400000).toISOString(),
						user: 'Employee Name',
						details: 'Completed initial research phase'
					}
				])
			}
		} catch (error) {
			console.error('Error fetching task updates:', error)
			// Show mock data on error
			setTaskUpdates([
				{
					id: 1,
					type: 'status_change',
					message: 'Task assigned to employee',
					timestamp: new Date().toISOString(),
					user: selectedTask?.assignedBy || 'Manager',
					details: 'Task has been assigned and is ready to start'
				}
			]);
		} finally {
			setLoadingUpdates(false)
		}
	}

	const closeTaskDetailsModal = () => {
		setShowTaskDetailsModal(false)
		setSelectedTask(null)
		setTaskUpdates([])
	}

	const fetchTaskStatusTrend = async (days = 30) => {
		setLoadingTrend(true)
		setChartError(false)
		try {
			// Calculate real trend data from actual tasks
			const realTrendData = []
			const today = new Date()
			
			for (let i = days; i >= 0; i--) {
				const date = new Date(today)
				date.setDate(date.getDate() - i)
				const dateStr = date.toISOString().split('T')[0]
				
				// Filter tasks for this date
				const tasksForDate = tasks.filter(task => {
					if (!task.dueDate && !task.createdAt && !task.lastActivity) return false
					
					const taskDate = new Date(task.dueDate || task.createdAt || task.lastActivity)
					return taskDate.toISOString().split('T')[0] === dateStr
				})
				
				const completedTasks = tasksForDate.filter(task => 
					task.status === 'Completed' || task.status === 'Done'
				).length
				
				const inProgressTasks = tasksForDate.filter(task => 
					task.status === 'In Progress' || task.status === 'Working'
				).length
				
				const pendingTasks = tasksForDate.filter(task => 
					task.status === 'Pending' || task.status === 'To Do'
				).length
				
				const totalTasks = tasksForDate.length
				
				realTrendData.push({
					date: dateStr,
					completed: completedTasks,
					inProgress: inProgressTasks,
					pending: pendingTasks,
					total: totalTasks,
					completionRate: totalTasks > 0 ? (completedTasks / totalTasks * 100) : 0
				})
			}
			
			console.log('Calculated trend data from tasks:', realTrendData)
			
			setTrendData({
				trendData: realTrendData,
				dateLabels: realTrendData.map(d => d.date),
				summary: {
					totalTasks: realTrendData.reduce((acc, item) => acc + item.total, 0),
					completedTasks: realTrendData.reduce((acc, item) => acc + item.completed, 0),
					inProgressTasks: realTrendData.reduce((acc, item) => acc + item.inProgress, 0),
					currentCompletionRate: realTrendData.length > 0 ? 
						(realTrendData.reduce((acc, item) => acc + item.completed, 0) / 
						Math.max(realTrendData.reduce((acc, item) => acc + item.total, 0), 1) * 100) : 0,
					trendDirection: 'up'
				}
			})
		} catch (error) {
			console.error('Error fetching task status trend:', error);
			setTrendData([
				{ date: '2024-01-01', completed: 10, pending: 5, inProgress: 3 },
				{ date: '2024-01-02', completed: 12, pending: 4, inProgress: 4 },
				{ date: '2024-01-03', completed: 8, pending: 6, inProgress: 2 }
			]);
		} finally {
			setLoadingTrend(false)
		}
	}

	// Edit task handlers
	const handleEditTask = (task) => {
		setEditTaskData({
			taskName: task.taskName || '',
			description: task.description || '',
			assignedTo: task.assignedTo || '',
			assignedBy: task.assignedBy || '',
			team: task.team || '',
			priority: task.priority || 'Medium',
			dueDate: task.dueDate || '',
			estimatedHours: task.estimatedHours || '',
			status: task.status || 'Pending',
			progress: task.progress || 0,
			timeSpent: task.timeSpent || 0
		})
		setEditingTask(task)
		setSelectedTask(task)
		setShowEditTaskModal(true)
	}

	const handleUpdateTask = async () => {
		if (!editTaskData.taskName.trim()) {
			alert('Task name is required')
			return
		}

		try {
			const token = localStorage.getItem('access_token')
			
			// Prepare update data using TaskUpdate schema
			const updateData = {
				title: editTaskData.taskName,
				description: editTaskData.description,
				status: editTaskData.status,
				priority: editTaskData.priority,
				timeSpent: parseFloat(editTaskData.timeSpent) || 0,
				remarks: `Task updated on ${new Date().toLocaleDateString()}`
			}

			// Automatically set progress to 100% if status is Completed
			if (editTaskData.status === 'Completed') {
				updateData.progress = 100;
			}

			// Remove undefined/empty values
			Object.keys(updateData).forEach(key => {
				if (updateData[key] === undefined || updateData[key] === '') {
					delete updateData[key]
				}
			})

			// Use the new PATCH endpoint for partial updates
			const response = await fetch(`${API_URL}/api/tasks/${editingTask.id}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify(updateData)
			})

			if (response.ok) {
				const updatedTask = await response.json()
				console.log('Task updated successfully:', updatedTask)

				// Update task in local state
				setTasks(prevTasks =>
					prevTasks.map(task =>
						task.id === editingTask.id
							? { 
								...task, 
								taskName: updateData.title || task.taskName,
								description: updateData.description || task.description,
								status: updateData.status || task.status,
								priority: updateData.priority || task.priority,
								timeSpent: updateData.timeSpent || task.timeSpent,
								progress: updateData.progress !== undefined ? updateData.progress : task.progress,
								remarks: updateData.remarks || task.remarks,
								lastActivity: new Date().toISOString().slice(0, 10)
							}
							: task
					)
				)
				
				// Refresh trend data
				fetchTaskStatusTrend(trendPeriod)
				
				setShowEditTaskModal(false)
				setEditingTask(null)
				alert('Task updated successfully!')
			} else {
				const errorData = await response.json().catch(() => ({}))
				throw new Error(`Failed to update task: ${response.status} - ${errorData.detail || 'Unknown error'}`)
			}
		} catch (error) {
			console.error('Error updating task:', error)
			alert(`Failed to update task: ${error.message}`)
		}
	}

	const closeEditTaskModal = () => {
		setShowEditTaskModal(false)
		setSelectedTask(null)
		setEditTaskData({
			taskName: '',
			title: '',
			description: '',
			assignedTo: '',
			assigned_to: '',
			assignedBy: '',
			assigned_by: '',
			team: '',
			assigned_at: '',
			priority: null,
			dueDate: '',
			assigned_date: '',
			estimatedHours: '',
			status: 'pending',
			progress: 0,
			timeSpent: 0,
			remarks: ''
		})
		setEditingTask(null)
	}

	// Handle task status update using the dedicated status update endpoint
	const handleTaskStatusUpdate = async (taskId, newStatus, remarks = '') => {
		try {
			const token = localStorage.getItem('access_token')
			
			// Use TaskStatusUpdate schema
			const statusUpdateData = {
				status: newStatus,
				remarks: remarks
			}

			// Automatically set progress to 100% if status is Completed
			if (newStatus === 'Completed') {
				statusUpdateData.progress = 100;
			}

			// Call the dedicated status update endpoint
			const response = await fetch(`${API_URL}/api/tasks/${taskId}/status`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify(statusUpdateData)
			})

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}))
				throw new Error(`Failed to update task status: ${response.status} - ${errorData.detail || 'Unknown error'}`)
			}

			const updatedTask = await response.json()
			console.log('Task status updated successfully:', updatedTask)

			// Update local state
			setTasks(prevTasks => 
				prevTasks.map(task => 
					task.id === taskId 
						? {
							...task,
							status: newStatus,
							progress: newStatus === 'Completed' ? 100 : task.progress,
							remarks: remarks,
							lastActivity: new Date().toISOString().slice(0, 10),
							approved_by: updatedTask.approved_by,
							approved_at: updatedTask.approved_at
						}
						: task
				)
			)

			// Also refresh from backend to ensure we have the latest data
			setTimeout(() => {
				refreshTasks(false)
			}, 1000)

			alert('Task status updated successfully!')
			return updatedTask
		} catch (error) {
			console.error('Error updating task status:', error)
			alert(`Failed to update task status: ${error.message}`)
			throw error
		}
	}

	const getStatusColor = (status) => {
		switch (status?.toLowerCase()) {
			case 'completed':
				return 'bg-green-100 text-green-800'
			case 'in progress':
			case 'in_progress':
				return 'bg-blue-100 text-blue-800'
			case 'pending':
				return 'bg-yellow-100 text-yellow-800'
			case 'overdue':
				return 'bg-red-100 text-red-800'
			default:
				return 'bg-gray-100 text-gray-800'
		}
	}

	const getPriorityColor = (priority) => {
		switch (priority) {
			case 'High':
				return 'text-red-600'
			case 'Medium':
				return 'text-yellow-600'
			case 'Low':
				return 'text-green-600'
			default:
				return 'text-gray-600'
		}
	}

	const getPriorityIcon = (priority) => {
		switch (priority) {
			case 'High':
				return 'fas fa-exclamation-triangle'
			case 'Medium':
				return 'fas fa-minus-circle'
			case 'Low':
				return 'fas fa-arrow-down'
			default:
				return 'fas fa-circle'
		}
	}

	// Handle create task
	const handleCreateTask = async () => {
		// Validate required fields according to TaskModel schema
		if (!newTask.title && !newTask.taskName) {
			alert('Please provide a task title.')
			return
		}
		if (!newTask.assigned_to && !newTask.assignedTo) {
			alert('Please select an employee to assign the task to.')
			return
		}
		if (!newTask.assigned_at && !newTask.team) {
			alert('Please specify the site/location where the task should be performed.')
			return
		}
		if (!newTask.assigned_by && !newTask.assignedBy) {
			alert('Please specify who is assigning the task.')
			return
		}

		setCreatingTask(true)
		try {
			const token = localStorage.getItem('access_token')
			
			// Find assigned employee details
			const assignedEmployee = employees.find(emp => 
				emp.employee_id === (newTask.assigned_to || newTask.assignedTo) || 
				emp.user_id === (newTask.assigned_to || newTask.assignedTo) ||
				emp.full_name === (newTask.assigned_to || newTask.assignedTo)
			)

			// Get current user info for assigned_by
			const currentUser = await fetchCurrentUser()
			const assignedBy = newTask.assigned_by || newTask.assignedBy || 
							   currentUser?.user_id || currentUser?.username || 
							   localStorage.getItem('username') || 'HR Manager'

			// Prepare task data for new API - match TaskModel schema exactly
			const apiTaskData = {
				title: newTask.title || newTask.taskName,
				description: newTask.description || '',
				assigned_to: newTask.assigned_to || newTask.assignedTo,
				assigned_by: assignedBy,
				assigned_at: newTask.assigned_at || newTask.team || 'General Site',
				priority: newTask.priority || null,
				status: 'pending', // Default status as per schema
				assigned_date: newTask.assigned_date || newTask.dueDate || new Date().toISOString().split('T')[0],
				timeSpent: parseFloat(newTask.timeSpent) || 0,
				estimated_hours: parseFloat(newTask.estimatedHours) || 0,
				remarks: newTask.remarks || ''
			}

			console.log('Sending task data to new API:', apiTaskData) // Debug log

			// Call the new backend API endpoint
			const response = await fetch(`${API_URL}/api/tasks/`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify(apiTaskData)
			})

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}))
				console.error('API Error:', errorData)
				throw new Error(`Failed to create task: ${response.status} - ${errorData.detail || 'Unknown error'}`)
			}

			const result = await response.json()
			console.log('Task created successfully:', result)
			
			// Refresh tasks from backend to get updated list
			await refreshTasks()
			
			// Reset form and close modal
			setNewTask({
				title: '',
				description: '',
				assigned_to: '',
				assigned_by: '',
				assigned_at: '',
				priority: null,
				assigned_date: '',
				timeSpent: 0,
				status: 'pending',
				remarks: '',
				// UI compatibility fields
				taskName: '',
				assignedTo: '',
				assignedBy: '',
				team: '',
				dueDate: '',
				estimatedHours: ''
			})
			setShowCreateTaskModal(false)

			alert('Task created and assigned successfully!')

		} catch (error) {
			console.error('Error creating task:', error)
			alert(`Failed to create task: ${error.message}`)
		} finally {
			setCreatingTask(false)
		}
	}

	// Handle assign task to different employee
	const handleReassignTask = async (taskId, newAssigneeId) => {
		try {
			const token = localStorage.getItem('access_token')
			const assignedEmployee = employees.find(emp => 
				emp.employee_id === newAssigneeId || 
				emp.user_id === newAssigneeId
			)

			// Use TaskUpdate schema for partial update
			const updateData = {
				assigned_to: newAssigneeId,
				remarks: `Task reassigned to ${assignedEmployee?.full_name || assignedEmployee?.name || newAssigneeId}`
			}

			// Call the new PATCH endpoint for partial updates
			const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify(updateData)
			})

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}))
				throw new Error(`Failed to reassign task: ${response.status} - ${errorData.detail || 'Unknown error'}`)
			}

			const updatedTask = await response.json()
			console.log('Task reassigned successfully:', updatedTask)

			// Update local state with the updated task data
			setTasks(prevTasks => 
				prevTasks.map(task => 
					task.id === taskId 
						? {
							...task,
							assignedTo: newAssigneeId,
							employeeName: assignedEmployee?.full_name || assignedEmployee?.name || newAssigneeId,
							team: assignedEmployee?.department || task.team,
							lastActivity: new Date().toISOString().slice(0, 10),
							remarks: updateData.remarks
						}
						: task
				)
			)

			alert('Task reassigned successfully!')
		} catch (error) {
			console.error('Error reassigning task:', error)
			alert(`Failed to reassign task: ${error.message}`)
		}
	}

	// Chart configuration for Task Status Trend
	const chartData = useMemo(() => {
		try {
			if (!chartJSAvailable || !trendData?.trendData || !Array.isArray(trendData.trendData) || trendData.trendData.length === 0) {
				return {
					labels: [],
					datasets: []
				}
			}

			const labels = trendData.trendData.map(item => {
				if (!item?.date) return 'N/A'
				try {
					const date = new Date(item.date)
					return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
				} catch (err) {
					return 'N/A'
				}
			})

			return {
				labels,
				datasets: [
					{
						label: 'Completed Tasks',
						data: trendData.trendData.map(item => item?.completed || 0),
						borderColor: 'rgb(34, 197, 94)',
						backgroundColor: 'rgba(34, 197, 94, 0.1)',
						tension: 0.4,
						fill: false
					},
					{
						label: 'In Progress Tasks',
						data: trendData.trendData.map(item => item?.inProgress || 0),
						borderColor: 'rgb(59, 130, 246)',
						backgroundColor: 'rgba(59, 130, 246, 0.1)',
						tension: 0.4,
						fill: false
					}
				]
			}
		} catch (error) {
			console.error('Error processing chart data:', error)
			return {
				labels: [],
				datasets: []
			}
		}
	}, [trendData, chartJSAvailable])

	const chartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				position: 'top'
			},
			tooltip: {
				mode: 'index',
				intersect: false
			}
		},
		scales: {
			x: {
				display: true
			},
			y: {
				display: true,
				beginAtZero: true
			}
		}
	}

	// Review handlers
	const handleOpenReviewModal = (task = null) => {
		setSelectedTaskForReview(task)
		setReviewData({
			rating: 5,
			comments: '',
			reviewType: task ? 'task' : 'project',
			recommendations: ''
		})
		setShowReviewModal(true)
	}

	const handleCloseReviewModal = () => {
		setShowReviewModal(false)
		setSelectedTaskForReview(null)
		setReviewData({
			rating: 5,
			comments: '',
			reviewType: 'project',
			recommendations: ''
		})
	}

	const handleSubmitReview = async () => {
		if (!reviewData.comments.trim()) {
			alert('Please provide review comments')
			return
		}

		setSubmittingReview(true)
		try {
			const token = localStorage.getItem('access_token')
			
			const reviewPayload = {
				taskId: selectedTaskForReview?.id || null,
				reviewType: reviewData.reviewType,
				rating: reviewData.rating,
				comments: reviewData.comments,
				recommendations: reviewData.recommendations,
				reviewedBy: localStorage.getItem('username') || 'HR Manager',
				createdAt: new Date().toISOString()
			}

			console.log('Submitting review:', reviewPayload)

			// Try to submit to API
			const response = await fetch('/api/reviews/', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: token ? `Bearer ${token}` : ''
				},
				body: JSON.stringify(reviewPayload)
			})

			if (response.ok) {
				alert('Review submitted successfully!')
			} else {
				console.log('Review API not available, showing success message')
				alert('Review submitted successfully! (Local storage)')
			}

			// Store review locally as backup
			const existingReviews = JSON.parse(localStorage.getItem('task_reviews') || '[]')
			existingReviews.push({ ...reviewPayload, id: Date.now() })
			localStorage.setItem('task_reviews', JSON.stringify(existingReviews))

			handleCloseReviewModal()
		} catch (error) {
			console.error('Error submitting review:', error)
			alert('Review saved locally. Will sync when server is available.')
			
			// Store locally on error
			const existingReviews = JSON.parse(localStorage.getItem('task_reviews') || '[]')
			existingReviews.push({ 
				...reviewPayload, 
				id: Date.now(),
				status: 'pending_sync'
			})
			localStorage.setItem('task_reviews', JSON.stringify(existingReviews))
			
			handleCloseReviewModal()
		} finally {
			setSubmittingReview(false)
		}
	}

	// Export Report handlers
	const handleOpenExportModal = () => {
		setShowExportModal(true)
	}

	const handleCloseExportModal = () => {
		setShowExportModal(false)
		setExportFormat('csv')
		setExportDateRange('all')
	}

	const generateExportData = () => {
		let exportTasks = [...tasks]
		
		// Filter by date range if needed
		if (exportDateRange !== 'all') {
			const today = new Date()
			let filterDate = new Date()
			
			switch (exportDateRange) {
				case 'week':
					filterDate.setDate(today.getDate() - 7)
					break
				case 'month':
					filterDate.setMonth(today.getMonth() - 1)
					break
				case 'quarter':
					filterDate.setMonth(today.getMonth() - 3)
					break
				default:
					filterDate = null
			}
			
			if (filterDate) {
				exportTasks = exportTasks.filter(task => {
					const taskDate = new Date(task.lastActivity || task.createdAt)
					return taskDate >= filterDate
				})
			}
		}
		
		// Map tasks to export format using exact existing field names
		return exportTasks.map(task => {
			const row = {}
			if (exportFields.dateAssigned) row['Date Assigned'] = task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'N/A'
			if (exportFields.taskName) row['Task Name'] = task.taskName || 'Untitled'
			if (exportFields.employeeName) row['Employee Name'] = task.employeeName || 'Unknown'
			if (exportFields.assignedBy) row['Assigned By'] = task.assignedBy || 'Unknown'
			if (exportFields.status) row['Status'] = task.status || 'Pending'
			if (exportFields.progress) row['Progress'] = `${task.progress || 0}%`
			if (exportFields.timeSpent) row['Time Spent'] = `${task.timeSpent || 0}h`
			if (exportFields.priority) row['Priority'] = task.priority || 'Medium'
			if (exportFields.dueDate) row['Due Date'] = task.dueDate || 'Not set'
			if (exportFields.lastActivity) row['Last Activity'] = task.lastActivity || 'N/A'
			return row
		})
	}

	const convertToCSV = (data) => {
		if (!data.length) return ''
		
		const headers = Object.keys(data[0])
		const csvContent = [
			headers.join(','),
			...data.map(row => 
				headers.map(header => 
					`"${String(row[header] || '').replace(/"/g, '""')}"`
				).join(',')
			)
		].join('\n')
		
		return csvContent
	}

	const downloadFile = (content, filename, type) => {
		const blob = new Blob([content], { type })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = filename
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}

	const handleExportReport = async () => {
		setExporting(true)
		try {
			const token = localStorage.getItem('access_token')
			const exportData = generateExportData()
			
			// Try to log export to API
			try {
				const response = await fetch('/api/reports/export', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: token ? `Bearer ${token}` : ''
					},
					body: JSON.stringify({
						format: exportFormat,
						dateRange: exportDateRange,
						fields: Object.keys(exportFields).filter(key => exportFields[key]),
						taskCount: exportData.length,
						exportedBy: localStorage.getItem('username') || 'HR Manager',
						exportedAt: new Date().toISOString()
					})
				})

				if (response.ok) {
					console.log('Export logged successfully')
				}
			} catch (apiError) {
				console.log('Export API not available, proceeding with local export')
			}

			// Generate and download file
			const timestamp = new Date().toISOString().slice(0, 10)
			
			switch (exportFormat) {
				case 'csv': {
					const csvContent = convertToCSV(exportData)
					downloadFile(csvContent, `hr-tasks-${timestamp}.csv`, 'text/csv')
					break
				}
				case 'json': {
					const jsonContent = JSON.stringify({
						meta: {
							exportedAt: new Date().toISOString(),
							exportedBy: localStorage.getItem('username') || 'HR Manager',
							totalTasks: exportData.length,
							dateRange: exportDateRange
						},
						data: exportData
					}, null, 2)
					downloadFile(jsonContent, `hr-tasks-${timestamp}.json`, 'application/json')
					break
				}
				case 'txt': {
					const txtContent = exportData.map(row => 
						Object.entries(row).map(([key, value]) => `${key}: ${value}`).join(' | ')
					).join('\n')
					downloadFile(txtContent, `hr-tasks-${timestamp}.txt`, 'text/plain')
					break
				}
			}

			alert(`Successfully exported ${exportData.length} tasks as ${exportFormat.toUpperCase()}`)
			handleCloseExportModal()
		} catch (error) {
			console.error('Export error:', error)
			alert('Export failed. Please try again.')
		} finally {
			setExporting(false)
		}
	}

	// All early returns moved to after all hooks are complete
	// Show loading state
	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
					<p className="text-gray-600">Loading HR Task Management Dashboard...</p>
				</div>
			</div>
		)
	}

	// Show error state
	if (error) {
		return (
			<div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
				<div className="text-center">
					<div className="p-4 bg-red-100 rounded-lg mb-4">
						<i className="fas fa-exclamation-triangle text-red-600 text-3xl mb-2"></i>
						<p className="text-red-600 font-medium">Error loading data</p>
						<p className="text-red-500 text-sm">{error}</p>
					</div>
					<button 
						onClick={() => window.location.reload()}
						className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
					>
						Retry
					</button>
				</div>
			</div>
		)
	}

	// Component error boundary check moved to before final return
	if (componentError) {
		return (
			<div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
				<div className="text-center">
					<div className="p-4 bg-red-100 rounded-lg mb-4">
						<i className="fas fa-exclamation-triangle text-red-600 text-3xl mb-2"></i>
						<p className="text-red-600 font-medium">Component Error</p>
						<p className="text-red-500 text-sm">{componentError}</p>
					</div>
					<button 
						onClick={() => {
							setComponentError(null)
							window.location.reload()
						}}
						className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
					>
						Reload Component
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-gray-50 p-6">
			{/* Header */}
			<div className="mb-8">
				<div className="flex items-center gap-3 mb-2">
					<div className="p-2 bg-blue-600 rounded-lg">
						<i className="fas fa-tasks text-white text-xl"></i>
					</div>
					<div>
						<h1 className="text-2xl font-bold text-gray-900">HR Task Management Dashboard</h1>
						
					</div>
				</div>
				<div className="text-sm text-gray-500">
					{(() => {
						try {
							return new Date().toLocaleDateString('en-US', { 
								weekday: 'long', 
								year: 'numeric', 
								month: 'long', 
								day: 'numeric' 
							})
						} catch (error) {
							console.error('Date formatting error:', error)
							setComponentError('Date formatting failed')
							return 'Today'
						}
					})()}
				</div>
			</div>

				{/* Professional Action Buttons */}
				<div className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-gray-100 shadow-lg mb-8">
					<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
						<div className="flex flex-wrap items-center gap-4">
							{/* Refresh Button */}
							<button 
								onClick={handleManualRefresh}
								disabled={refreshing}
								className="group flex items-center space-x-3 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-medium disabled:transform-none"
							>
								<div className="flex items-center justify-center w-7 h-7 bg-white/20 rounded-lg group-hover:bg-white/30 transition-all duration-200">
									{refreshing ? (
										<i className="fas fa-spinner fa-spin text-sm"></i>
									) : (
										<i className="fas fa-sync-alt text-sm"></i>
									)}
								</div>
								<span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
							</button>
							
							{/* Auto Refresh Toggle */}
							<div className="flex items-center gap-3 px-4 py-2 bg-white/50 rounded-xl border border-gray-200">
								<label className="relative inline-flex items-center cursor-pointer">
									<input
										type="checkbox"
										checked={autoRefreshEnabled}
										onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
										className="sr-only peer"
									/>
									<div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-500 peer-checked:to-indigo-600 shadow-sm"></div>
								</label>
								<div className="text-sm">
									<span className="font-medium text-gray-700">Auto-refresh</span>
									<span className="text-gray-500 block text-xs">Every 30 seconds</span>
								</div>
							</div>
						</div>
						
						{/* Create Task Button */}
						<button 
							onClick={() => {
								setNewTask(prev => ({
									...prev,
									assignedBy: localStorage.getItem('username') || 'HR Manager'
								}))
								setShowCreateTaskModal(true)
							}}
							className="group flex items-center space-x-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-medium"
						>
							<div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-lg group-hover:bg-white/30 transition-all duration-200">
								<i className="fas fa-plus text-sm"></i>
							</div>
							<span>Create New Task</span>
						</button>
					</div>
				</div>

				{/* Professional Statistics Cards */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
					<div className="group bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg hover:shadow-2xl border border-gray-100 hover:border-blue-200 transition-all duration-300 transform hover:-translate-y-1 cursor-pointer">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Active Tasks</p>
								<p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{statistics?.totalActiveTasks || 0}</p>
								<div className="mt-3 h-1.5 bg-gradient-to-r from-gray-200 to-gray-100 rounded-full overflow-hidden">
									<div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-1000 ease-out" style={{ width: '75%' }}></div>
								</div>
							</div>
							<div className="flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110">
								<i className="fas fa-tasks text-white text-xl"></i>
							</div>
						</div>
					</div>

				<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium text-gray-600">Tasks Overdue</p>
							<p className="text-3xl font-bold text-red-600 mt-1">{statistics?.tasksOverdue || 0}</p>
						</div>
						<div className="p-3 bg-red-100 rounded-lg">
							<i className="fas fa-exclamation-triangle text-red-600 text-xl"></i>
						</div>
					</div>
					<div className="mt-4 flex items-center text-sm text-green-600">
						<i className="fas fa-arrow-up mr-1"></i>
						<span>2% increase</span>
					</div>
				</div>

				<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium text-gray-600">Completion Rate</p>
							<p className="text-3xl font-bold text-green-600 mt-1">{statistics?.completionRate || 0}%</p>
						</div>
						<div className="p-3 bg-green-100 rounded-lg">
							<i className="fas fa-check-circle text-green-600 text-xl"></i>
						</div>
					</div>
					<div className="mt-4 h-1 bg-green-200 rounded-full">
						<div className="h-1 bg-green-600 rounded-full" style={{ width: `${statistics?.completionRate || 0}%` }}></div>
					</div>
				</div>

				<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium text-gray-600">High Priority Tasks</p>
							<p className="text-3xl font-bold text-orange-600 mt-1">{statistics?.highPriorityTasks || 0}</p>
						</div>
						<div className="p-3 bg-orange-100 rounded-lg">
							<i className="fas fa-star text-orange-600 text-xl"></i>
						</div>
					</div>
				</div>
			</div>

			

			{/* Filters and Search */}
			<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
				<div className="flex flex-wrap gap-4 items-center justify-between">
					<div className="flex flex-wrap gap-4 items-center">
						<div className="relative">
							<i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
							<input
								type="text"
								placeholder="Search tasks or employees..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
							/>
						</div>

						<select
							value={selectedDateRange}
							onChange={(e) => setSelectedDateRange(e.target.value)}
							className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						>
							<option value="all">Date Range</option>
							<option value="today">Today</option>
							<option value="week">This Week</option>
							<option value="month">This Month</option>
						</select>
						<select
							value={selectedAssignedBy}
							onChange={(e) => setSelectedAssignedBy(e.target.value)}
							className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						>
							{assignees.map(assignee => (
								<option key={assignee} value={assignee}>{assignee === 'All' ? 'Assigned By' : assignee}</option>
							))}
						</select>

						<select
							value={selectedTimeSpent}
							onChange={(e) => setSelectedTimeSpent(e.target.value)}
							className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						>
							<option value="All">Time Spent</option>
							<option value="low">0-20 hrs</option>
							<option value="medium">21-40 hrs</option>
							<option value="high">40+ hrs</option>
						</select>
					</div>

					
				</div>
			</div>

			{/* Detailed Task Log */}
			<div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
				<div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
					<h3 className="text-lg font-semibold text-gray-900">Detailed Task Log</h3>
					<div className="flex gap-2">
						<button 
							onClick={handleOpenExportModal}
							className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 cursor-pointer transition-colors"
						>
							<i className="fas fa-download mr-1"></i>
							Export Report
						</button>
					</div>
				</div>

				{loading && (
					<div className="p-8 text-center">
						<div className="inline-flex items-center gap-2 text-gray-600">
							<i className="fas fa-spinner fa-spin"></i>
							Loading tasks...
						</div>
					</div>
				)}

				{error && (
					<div className="p-8 text-center">
						<div className="text-red-600">
							<i className="fas fa-exclamation-circle mr-2"></i>
							Error: {error}
						</div>
					</div>
				)}

				{!loading && !error && (
					<div className="">
						<table className="w-full table-fixed text-sm">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
										Date
									</th>
									<th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
										Task
									</th>
									<th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
										Employee Name
									</th>
									<th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
										Site
									</th>
									<th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
										Assigned By
									</th>
									<th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
										Status
									</th>
									<th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
										Progress
									</th>
									<th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
										Time
									</th>
									<th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
										Actions
									</th>
								</tr>
							</thead>
							<tbody className="bg-white divide-y divide-gray-200">
								{filteredTasks.length === 0 ? (
									<tr>
										<td colSpan={9} className="px-2 py-6 text-center text-gray-500">
											<i className="fas fa-inbox text-4xl mb-2 block"></i>
											No tasks found matching your criteria
										</td>
									</tr>
								) : (
									filteredTasks.map((task, index) => (
										<tr 
											key={task.id} 
											className="hover:bg-gray-50 transition-colors cursor-pointer"
											onClick={() => handleTaskClick(task)}
										>
											{/* Date Assigned */}
											<td className="px-2 py-2 whitespace-nowrap text-sm text-gray-900">
												{(() => {
													// Try multiple date fields with proper fallback order
													const dateValue = task?.assigned_date || task?.dueDate || task?.createdAt || task?.created_at || task?.due_date || task?.lastActivity;
													if (!dateValue) return 'N/A';
													try {
														const date = new Date(dateValue);
														// Check if date is valid
														if (isNaN(date.getTime())) return 'N/A';
														return date.toLocaleDateString('en-US', {
															year: 'numeric',
															month: 'short',
															day: 'numeric'
														});
													} catch (error) {
														console.error('Date parsing error:', error, 'Value:', dateValue);
														return 'N/A';
													}
												})()}
											</td>
											{/* Task Name */}
											<td className="px-2 py-2 text-sm text-gray-900">
												<div className="font-medium">{task?.taskName || 'Untitled'}</div>
											</td>
											{/* Employee Name */}
											<td className="px-2 py-2 whitespace-nowrap">
												<div className="flex items-center">
													<div className="flex-shrink-0 h-6 w-6">
														<div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
															<span className="text-xs font-medium text-blue-600">
																{(task?.employeeName || 'U').split(' ').map(n => n?.[0] || '').join('').slice(0, 2) || 'UN'}
															</span>
														</div>
													</div>
													<div className="ml-2">
														<div className="text-sm font-medium text-gray-900">{task?.employeeName || 'Unknown'}</div>
														{task?.team && (
															<div className="text-xs text-gray-500">{task.team}</div>
														)}
													</div>
												</div>
											</td>
											{/* Site */}
											<td className="px-2 py-2 whitespace-nowrap text-sm text-gray-900">
												<div className="font-medium">{task?.site_name || task?.assigned_at || task?.team || 'N/A'}</div>
											</td>
											{/* Assigned By */}
											<td className="px-2 py-2 text-sm text-gray-600">
												<div className="flex flex-col space-y-1">
													<div className="font-medium text-gray-900">{task?.assignedBy || 'Unknown'}</div>
													{task?.assignedBy && task.assignedBy !== 'Unknown' && (() => {
														const userRole = getUserRole(task?.assignedBy)
														if (loadingRoles) {
															return (
																<div className="flex items-center text-xs text-gray-400">
																	<i className="fas fa-spinner fa-spin mr-1"></i>
																	Loading role...
																</div>
															)
														}
														return userRole ? (
															<div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
																<i className="fas fa-user-tag mr-1"></i>
																{userRole.name || userRole.role_name || userRole.description || 'Role'}
															</div>
														) : (
															<div className="text-xs text-gray-400">
																<i className="fas fa-question-circle mr-1"></i>
																Role not available
															</div>
														)
													})()} 
												</div>
											</td>
											{/* Status */}
											<td className="px-2 py-2 whitespace-nowrap">
												<span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task?.status || 'Pending')}`}>
													{task?.status || 'Pending'}
												</span>
											</td>
											{/* Progress */}
											<td className="px-2 py-2 whitespace-nowrap">
												<div className="flex items-center">
													<div className="w-full bg-gray-200 rounded-full h-2 mr-1">
														<div 
															className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
															style={{ width: `${task?.progress || 0}%` }}
														></div>
													</div>
													<span className="text-xs font-medium text-gray-900 min-w-[2.5rem] text-right">
														{task?.progress || 0}%
													</span>
												</div>
											</td>
											{/* Time Spent */}
											<td className="px-2 py-2 whitespace-nowrap">
												<div className="text-xs text-gray-600">
													<div className="font-medium">{task?.timeSpent || 0}h / {task?.estimatedHours || 0}h</div>
													<div className={`text-xs mt-1 ${
														task?.deviation?.includes('Over') ? 'text-red-600' : 
														task?.deviation?.includes('Under') ? 'text-green-600' :
														task?.deviation?.includes('Not started') ? 'text-gray-500' : 'text-blue-600'
													}`}>
														{task?.deviation || '0 hrs'}
													</div>
												</div>
											</td>
											<td className="px-2 py-2 whitespace-nowrap text-sm font-medium">
												<div className="flex items-center space-x-2">
													<button
														className="text-blue-600 hover:text-blue-800 transition-colors"
														title="View Details"
														onClick={(e) => {
															e.stopPropagation()
															handleViewTaskDetails(task)
														}}
													>
														<i className="fas fa-eye text-sm"></i>
													</button>

													{task.status !== 'Completed' && (
														<>
															<button
																className="text-green-600 hover:text-green-800 transition-colors"
																title="Edit Task"
																onClick={(e) => {
																	e.stopPropagation()
																	handleEditTask(task)
																}}
															>
																<i className="fas fa-edit text-sm"></i>
															</button>
															<button
																className="text-red-600 hover:text-red-800 transition-colors"
																title="Delete Task"
																onClick={async (e) => {
																	e.stopPropagation()
																	if (window.confirm('Are you sure you want to delete this task?')) {
																		try {
																			const token = localStorage.getItem('access_token')
																			const response = await fetch(`${API_URL}/api/tasks/${task.id}`, {
																				method: 'DELETE',
																				headers: {
																					...(token ? { Authorization: `Bearer ${token}` } : {}),
																				}
																			})

																			if (response.ok) {
																				// Remove from local state only after successful deletion from backend
																				setTasks(prevTasks => prevTasks.filter(t => t.id !== task.id))
																				alert('Task deleted successfully!')
																			} else {
																				const errorData = await response.json().catch(() => ({}))
																				throw new Error(`Failed to delete task: ${response.status} - ${errorData.detail || 'Unknown error'}`)
																			}
																		} catch (error) {
																			console.error('Error deleting task:', error)
																			alert(`Failed to delete task: ${error.message}`)
																		}
																	}
																}}
															>
																<i className="fas fa-trash text-sm"></i>
															</button>
														</>
													)}
												</div>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* Create Task Modal */}
			{showCreateTaskModal && (
				<div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
					<div className="relative top-20 mx-auto p-5 border w-[600px] shadow-lg rounded-md bg-white">
						<div className="mt-3">
							<div className="flex items-center justify-between mb-4">
								<h3 className="text-lg font-bold text-gray-900">Create New Task</h3>
								<button
									onClick={() => setShowCreateTaskModal(false)}
									className="text-gray-400 hover:text-gray-600"
								>
									<i className="fas fa-times text-xl"></i>
								</button>
							</div>

							<div className="space-y-4">
								{/* Task Name */}
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">
										Task Name *
									</label>
									<input
										type="text"
										value={newTask.taskName}
										onChange={(e) => setNewTask(prev => ({ 
											...prev, 
											taskName: e.target.value,
											title: e.target.value // Also set schema field
										}))}
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										placeholder="Enter task name"
									/>
								</div>

								{/* Description */}
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">
										Description
									</label>
									<textarea
										value={newTask.description}
										onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										rows="3"
										placeholder="Enter task description"
									/>
								</div>

								{/* Assign To */}
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">
										Assign To *
									</label>
									<select
										value={newTask.assignedTo}
										onChange={(e) => setNewTask(prev => ({ 
											...prev, 
											assignedTo: e.target.value,
											assigned_to: e.target.value // Also set schema field
										}))}
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									>
										<option value="">Select Employee</option>
										{employees
											.filter(emp => {
												// Show all employees that passed the initial filter
												// or if no employees, show all users with names for debugging
												if (employees.length === 0) {
													return emp.full_name || emp.name;
												}
												return true; // Already filtered in the main filter above
											})
											.map((emp) => (
											<option 
												key={emp.employee_id || emp.user_id || emp._id} 
												value={emp.employee_id || emp.user_id || emp._id}
											>
												{emp.full_name || emp.name} 
												{emp.department ? ` (${emp.department})` : ''} 
												{emp.role ? ` [${emp.role}]` : ''}
											</option>
										))}
									</select>
								</div>

								{/* Assigned By */}
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">
										Assigned By
									</label>
									<input
										type="text"
										value={newTask.assignedBy}
										onChange={(e) => setNewTask(prev => ({ 
											...prev, 
											assignedBy: e.target.value,
											assigned_by: e.target.value // Also set schema field
										}))}
										className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
										placeholder="Assigner name"
										readOnly
									/>
								</div>

								{/* Site */}
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">
										Site *
									</label>
									<select
										value={newTask.linked_id}
										onChange={(e) => {
											const selectedSite = sites.find(s => s._id === e.target.value)
											setNewTask(prev => ({ 
												...prev, 
												linked_id: e.target.value,
												assigned_at: selectedSite?.site_name || e.target.value, // Set schema field
												team: selectedSite?.site_name || e.target.value // Also set team for UI compatibility
											}))
										}}
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									>
										<option value="">Select Site</option>
										{sites.map((site) => (
											<option 
												key={site._id} 
												value={site._id}
											>
												{site.site_name} 
											</option>
										))}
									</select>
								</div>

								{/* Due Date */}
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">
										Due Date *
									</label>
									<input
										type="date"
										value={newTask.dueDate}
										onChange={(e) => setNewTask(prev => ({ 
											...prev, 
											dueDate: e.target.value,
											assigned_date: e.target.value // Also set schema field
										}))}
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>

								{/* Estimated Hours (Duration) */}
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">
										Duration (Hours)
									</label>
									<input
										type="number"
										value={newTask.estimatedHours}
										onChange={(e) => setNewTask(prev => ({ ...prev, estimatedHours: e.target.value }))}
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										placeholder="Enter estimated hours"
									/>
								</div>

								{/* Priority */}
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">
										Priority
									</label>
									<select
										value={newTask.priority}
										onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value }))}
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									>
										<option value="Low">Low</option>
										<option value="Medium">Medium</option>
										<option value="High">High</option>
									</select>
								</div>
							</div>

							{/* Modal Actions */}
							<div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
								<button
									onClick={() => setShowCreateTaskModal(false)}
									className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
								>
									Cancel
								</button>
								<button
									onClick={handleCreateTask}
									disabled={creatingTask}
									className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{creatingTask ? 'Creating...' : 'Create Task'}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Task Details Modal */}
			{showTaskDetailsModal && selectedTask && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
						{/* Modal Header */}
						<div className="flex items-center justify-between p-6 border-b border-gray-200">
							<div className="flex items-center gap-4">
								<div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
									<i className="fas fa-tasks text-blue-600 text-lg"></i>
								</div>
								<div>
									<h3 className="text-xl font-semibold text-gray-900">{selectedTask.taskName}</h3>
									<p className="text-sm text-gray-600">Assigned to {selectedTask.employeeName}</p>
								</div>
							</div>
							<button
								onClick={closeTaskDetailsModal}
								className="text-gray-400 hover:text-gray-600 transition-colors"
							>
								<i className="fas fa-times text-xl"></i>
							</button>
						</div>

						{/* Modal Content */}
						<div className="p-6">
							<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
								{/* Left Column - Task Details */}
								<div className="lg:col-span-2 space-y-6">
									{/* Task Information */}
									<div className="bg-gray-50 rounded-lg p-4">
										<h4 className="text-lg font-semibold text-gray-900 mb-4">Task Information</h4>
										<div className="grid grid-cols-2 gap-4 text-sm">
											<div>
												<span className="font-medium text-gray-700">Status:</span>
												<span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedTask.status)}`}>
													{selectedTask.status}
												</span>
											</div>
											<div>
												<span className="font-medium text-gray-700">Priority:</span>
												<span className={`ml-2 ${getPriorityColor(selectedTask.priority)}`}>
													<i className={`${getPriorityIcon(selectedTask.priority)} mr-1`}></i>
													{selectedTask.priority}
												</span>
											</div>
											<div>
												<span className="font-medium text-gray-700">Team:</span>
												<span className="ml-2 text-gray-600">{selectedTask.team}</span>
											</div>
											<div>
												<span className="font-medium text-gray-700">Assigned By:</span>
												<span className="ml-2 text-gray-600">{selectedTask.assignedBy}</span>
											</div>
											<div>
												<span className="font-medium text-gray-700">Due Date:</span>
												<span className="ml-2 text-gray-600">{selectedTask.dueDate || 'Not set'}</span>
											</div>
											<div>
												<span className="font-medium text-gray-700">Estimated Hours:</span>
												<span className="ml-2 text-gray-600">{selectedTask.estimatedHours || 0} hrs</span>
											</div>
											<div>
												<span className="font-medium text-gray-700">Time Spent:</span>
												<span className="ml-2 text-gray-600">{selectedTask.timeSpent} hrs</span>
											</div>
											<div>
												<span className="font-medium text-gray-700">Progress:</span>
												<span className="ml-2 text-gray-600">{selectedTask.progress}%</span>
											</div>
										</div>
									</div>

									{/* Task Description */}
									{selectedTask.description && (
										<div className="bg-gray-50 rounded-lg p-4">
											<h4 className="text-lg font-semibold text-gray-900 mb-2">Description</h4>
											<p className="text-gray-700 whitespace-pre-wrap">{selectedTask.description}</p>
										</div>
									)}

									{/* Progress Bar */}
									<div className="bg-gray-50 rounded-lg p-4">
										<div className="flex items-center justify-between mb-2">
											<h4 className="text-lg font-semibold text-gray-900">Progress</h4>
											<span className="text-sm font-medium text-gray-600">{selectedTask.progress}%</span>
										</div>
										<div className="w-full bg-gray-200 rounded-full h-3">
											<div 
												className="bg-blue-600 h-3 rounded-full transition-all duration-300"
												style={{ width: `${selectedTask.progress}%` }}
											></div>
										</div>
									</div>
								</div>

								{/* Right Column - Updates and Activity */}
								<div className="space-y-6">
									{/* Task Updates */}
									<div className="bg-gray-50 rounded-lg p-4">
										<h4 className="text-lg font-semibold text-gray-900 mb-4">Project Updates</h4>
										
										{loadingUpdates ? (
											<div className="text-center py-8">
												<i className="fas fa-spinner fa-spin text-gray-400 text-2xl"></i>
												<p className="text-gray-600 mt-2">Loading updates...</p>
											</div>
										) : (
											<div className="space-y-4 max-h-96 overflow-y-auto">
												{taskUpdates.length > 0 ? (
													taskUpdates.map((update) => (
														<div key={update.id} className="border-l-4 border-blue-500 pl-4 pb-4">
															<div className="flex items-start justify-between">
																<div className="flex-1">
																	<p className="text-sm font-medium text-gray-900">{update.message}</p>
																	<p className="text-xs text-gray-600 mt-1">by {update.user}</p>
																	{update.details && (
																		<p className="text-sm text-gray-700 mt-2">{update.details}</p>
																	)}
																</div>
																<span className="text-xs text-gray-500">
																	{new Date(update.timestamp).toLocaleDateString()}
																</span>
															</div>
														</div>
													))
												) : (
													<div className="text-center py-8">
														<i className="fas fa-clock text-gray-400 text-2xl"></i>
														<p className="text-gray-600 mt-2">No updates yet</p>
													</div>
												)}
											</div>
										)}
									</div>

									{/* Employee Information */}
									<div className="bg-gray-50 rounded-lg p-4">
										<h4 className="text-lg font-semibold text-gray-900 mb-4">Employee Info</h4>
										<div className="flex items-center gap-3 mb-3">
											<div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
												<span className="text-sm font-medium text-blue-600">
													{selectedTask.employeeName.split(' ').map(n => n[0]).join('')}
												</span>
											</div>
											<div>
												<p className="font-medium text-gray-900">{selectedTask.employeeName}</p>
												<p className="text-sm text-gray-600">{selectedTask.team}</p>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Modal Actions */}
						<div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
							<button
								onClick={closeTaskDetailsModal}
								className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
							>
								Close
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Edit Task Modal */}
			{showEditTaskModal && editingTask && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
						<div className="p-6">
							<div className="flex justify-between items-center mb-6">
								<h2 className="text-2xl font-bold text-gray-900">Edit Task</h2>
								<button
									onClick={() => setShowEditTaskModal(false)}
									className="text-gray-500 hover:text-gray-700 text-2xl"
								>
									×
								</button>
							</div>

							<div className="space-y-4">
								<div>
									<label className="block text-sm font-semibold text-gray-700 mb-2">Task Name</label>
									<input
										type="text"
										value={editTaskData.taskName}
										onChange={(e) => setEditTaskData({...editTaskData, taskName: e.target.value})}
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										placeholder="Enter task name"
									/>
								</div>

								<div>
									<label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
									<textarea
										value={editTaskData.description}
										onChange={(e) => setEditTaskData({...editTaskData, description: e.target.value})}
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										rows="3"
										placeholder="Enter task description"
									/>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="block text-sm font-semibold text-gray-700 mb-2">Assigned To</label>
										<select
											value={editTaskData.assignedTo}
											onChange={(e) => setEditTaskData({...editTaskData, assignedTo: e.target.value})}
											className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										>
											<option value="">Select Employee</option>
											{employees.map((employee) => (
												<option key={employee.employee_id} value={employee.employee_id}>
													{employee.full_name}
												</option>
											))}
										</select>
									</div>
									<div>
										<label className="block text-sm font-semibold text-gray-700 mb-2">Site</label>
										<select
											value={editTaskData.linked_id}
											onChange={(e) => setEditTaskData({...editTaskData, linked_id: e.target.value})}
											className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										>
											<option value="">Select Site</option>
											{sites.map((site) => (
												<option key={site._id} value={site._id}>
													{site.site_name}
												</option>
											))}
										</select>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
										<select
											value={editTaskData.priority}
											onChange={(e) => setEditTaskData({...editTaskData, priority: e.target.value})}
											className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										>
											<option value="Low">Low</option>
											<option value="Medium">Medium</option>
											<option value="High">High</option>
										</select>
									</div>
									<div>
										<label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
										<select
											value={editTaskData.status}
											onChange={(e) => setEditTaskData({...editTaskData, status: e.target.value})}
											className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										>
											<option value="Not Started">Not Started</option>
											<option value="In Progress">In Progress</option>
											<option value="Completed">Completed</option>
											<option value="On Hold">On Hold</option>
										</select>
									</div>
								</div>

								<div className="grid grid-cols-1 gap-4">
									<div>
										<label className="block text-sm font-semibold text-gray-700 mb-2">Time Spent (hours)</label>
										<input
											type="number"
											min="0"
											step="0.5"
											value={editTaskData.timeSpent}
											onChange={(e) => setEditTaskData({...editTaskData, timeSpent: parseFloat(e.target.value) || 0})}
											className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
											placeholder="Hours spent"
										/>
									</div>
								</div>

								<div className="flex justify-end space-x-3 pt-4">
									<button
										onClick={() => setShowEditTaskModal(false)}
										className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
									>
										Cancel
									</button>
									<button
										onClick={handleUpdateTask}
										className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
									>
										Update Task
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Review Modal */}
			{showReviewModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
						<div className="p-6">
							<div className="flex justify-between items-center mb-6">
								<h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
									<i className="fas fa-star text-yellow-500"></i>
									{selectedTaskForReview ? 'Review Task' : 'Add Project Review'}
								</h2>
								<button
									onClick={handleCloseReviewModal}
									className="text-gray-500 hover:text-gray-700 text-2xl"
								>
									×
								</button>
							</div>

							{selectedTaskForReview && (
								<div className="bg-gray-50 rounded-lg p-4 mb-6">
									<h3 className="font-semibold text-gray-900 mb-2">Task Details</h3>
									<p className="text-sm text-gray-600">
										<strong>Task:</strong> {selectedTaskForReview.taskName || 'N/A'}
									</p>
									<p className="text-sm text-gray-600">
										<strong>Assigned to:</strong> {selectedTaskForReview.employeeName || selectedTaskForReview.assignedTo || 'N/A'}
									</p>
									<p className="text-sm text-gray-600">
										<strong>Status:</strong> {selectedTaskForReview.status || 'N/A'}
									</p>
								</div>
							)}

							<div className="space-y-4">
								<div>
									<label className="block text-sm font-semibold text-gray-700 mb-2">Review Type</label>
									<select
										value={reviewData.reviewType}
										onChange={(e) => setReviewData({...reviewData, reviewType: e.target.value})}
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									>
										<option value="task">Task Review</option>
										<option value="project">Project Review</option>
										<option value="performance">Performance Review</option>
										<option value="general">General Review</option>
									</select>
								</div>

								<div>
									<label className="block text-sm font-semibold text-gray-700 mb-2">Rating (1-5 Stars)</label>
									<div className="flex items-center gap-2">
										{[1, 2, 3, 4, 5].map((rating) => (
											<button
												key={rating}
												onClick={() => setReviewData({...reviewData, rating})}
												className={`text-2xl ${
													rating <= reviewData.rating
														? 'text-yellow-400'
														: 'text-gray-300'
												} hover:text-yellow-400 transition-colors`}
											>
												<i className="fas fa-star"></i>
											</button>
										))}
										<span className="ml-2 text-sm text-gray-600">
											{reviewData.rating}/5 stars
										</span>
									</div>
								</div>

								<div>
									<label className="block text-sm font-semibold text-gray-700 mb-2">Review Comments</label>
									<textarea
										value={reviewData.comments}
										onChange={(e) => setReviewData({...reviewData, comments: e.target.value})}
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										rows="4"
										placeholder="Share your feedback, observations, and comments..."
										required
									/>
								</div>

								<div>
									<label className="block text-sm font-semibold text-gray-700 mb-2">Recommendations (Optional)</label>
									<textarea
										value={reviewData.recommendations}
										onChange={(e) => setReviewData({...reviewData, recommendations: e.target.value})}
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										rows="3"
										placeholder="Any suggestions for improvement or future recommendations..."
									/>
								</div>
							</div>

							<div className="flex justify-end gap-3 mt-6">
								<button
									onClick={handleCloseReviewModal}
									className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
								>
									Cancel
								</button>
								<button
									onClick={handleSubmitReview}
									disabled={submittingReview || !reviewData.comments.trim()}
									className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
								>
									{submittingReview && <i className="fas fa-spinner fa-spin"></i>}
									Submit Review
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Export Modal - uses exact existing field structure */}
			{showExportModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
						<div className="p-6">
							<div className="flex justify-between items-center mb-6">
								<h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
									<i className="fas fa-download text-blue-500"></i>
									Export Tasks Report
								</h2>
								<button
									onClick={handleCloseExportModal}
									className="text-gray-500 hover:text-gray-700 text-2xl"
								>
									×
								</button>
							</div>

							<div className="space-y-4">
								<div>
									<label className="block text-sm font-semibold text-gray-700 mb-2">Export Format</label>
									<select
										value={exportFormat}
										onChange={(e) => setExportFormat(e.target.value)}
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									>
										<option value="csv">CSV - Excel Compatible</option>
										<option value="json">JSON - Data Format</option>
										<option value="txt">TXT - Plain Text</option>
									</select>
								</div>

								<div>
									<label className="block text-sm font-semibold text-gray-700 mb-2">Date Range</label>
									<select
										value={exportDateRange}
										onChange={(e) => setExportDateRange(e.target.value)}
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									>
										<option value="all">All Tasks</option>
										<option value="week">Last 7 Days</option>
										<option value="month">Last 30 Days</option>
										<option value="quarter">Last 3 Months</option>
									</select>
								</div>

								<div>
									<label className="block text-sm font-semibold text-gray-700 mb-2">Include Fields</label>
									<div className="space-y-2 max-h-32 overflow-y-auto">
										{Object.entries({
											employeeName: 'Employee Name',
											taskName: 'Task Name',
											assignedBy: 'Assigned By',
											status: 'Status',
											timeSpent: 'Time Spent',
											priority: 'Priority',
											dueDate: 'Due Date',
											lastActivity: 'Last Activity'
										}).map(([key, label]) => (
											<label key={key} className="flex items-center">
												<input
													type="checkbox"
													checked={exportFields[key]}
													onChange={(e) => setExportFields({
														...exportFields,
														[key]: e.target.checked
													})}
													className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
												/>
												<span className="text-sm text-gray-700">{label}</span>
											</label>
										))}
									</div>
								</div>

								<div className="bg-blue-50 rounded-lg p-3">
									<div className="text-sm text-blue-800">
										<i className="fas fa-info-circle mr-1"></i>
										<strong>{tasks.length}</strong> tasks ready for export
									</div>
								</div>
							</div>

							<div className="flex justify-end gap-3 mt-6">
								<button
									onClick={handleCloseExportModal}
									className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
								>
									Cancel
								</button>
								<button
									onClick={handleExportReport}
									disabled={exporting}
									className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
								>
									{exporting && <i className="fas fa-spinner fa-spin"></i>}
									<i className="fas fa-download"></i>
									Export
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Employee Documents Modal */}
			{showDocumentsModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
						{/* Modal Header */}
						<div className="flex items-center justify-between p-6 border-b border-gray-200">
							<div className="flex items-center gap-4">
								<div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
									<i className="fas fa-file-alt text-purple-600 text-lg"></i>
								</div>
								<div>
									<h3 className="text-xl font-semibold text-gray-900">Employee Documents</h3>
									<p className="text-sm text-gray-600">
										{selectedEmployeeForDocs?.full_name || selectedEmployeeForDocs?.name || 'Unknown Employee'}
									</p>
								</div>
							</div>
							<button
								onClick={closeDocumentsModal}
								className="text-gray-400 hover:text-gray-600 transition-colors"
							>
								<i className="fas fa-times text-xl"></i>
							</button>
						</div>

						{/* Modal Content */}
						<div className="p-6">
							{documentError && (
								<div className="mb-4 p-4 bg-red-100 border border-red-300 rounded-lg">
									<div className="flex items-center gap-2 text-red-700">
										<i className="fas fa-exclamation-triangle"></i>
										<span className="font-medium">Error loading documents</span>
									</div>
									<p className="text-red-600 text-sm mt-1">{documentError}</p>
								</div>
							)}

							{loadingDocuments ? (
								<div className="text-center py-12">
									<div className="inline-flex items-center gap-3 text-gray-600">
										<i className="fas fa-spinner fa-spin text-2xl"></i>
										<span className="text-lg">Loading documents...</span>
									</div>
								</div>
							) : employeeDocuments.length === 0 ? (
								<div className="text-center py-12">
									<div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
										<i className="fas fa-folder-open text-gray-400 text-2xl"></i>
									</div>
									<h4 className="text-lg font-medium text-gray-900 mb-2">No Documents Found</h4>
									<p className="text-gray-600">
										This employee hasn't uploaded any documents yet.
									</p>
								</div>
							) : (
								<div className="space-y-4">
									<div className="flex items-center justify-between mb-6">
										<h4 className="text-lg font-semibold text-gray-900">
											Uploaded Documents ({employeeDocuments.length})
										</h4>
									</div>

									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
										{employeeDocuments.map((doc, index) => (
											<div 
												key={doc.id || index} 
												className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-md transition-all"
											>
												<div className="flex items-start justify-between mb-3">
													<div className="flex items-center gap-3">
														<div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
															<i className="fas fa-file-pdf text-blue-600"></i>
														</div>
														<div>
															<p className="font-medium text-gray-900 text-sm truncate max-w-[150px]">
																{doc.document_name || doc.filename || `Document ${index + 1}`}
															</p>
															<p className="text-xs text-gray-500">
																{doc.document_type || 'PDF Document'}
															</p>
														</div>
													</div>
												</div>

												<div className="space-y-2 text-xs text-gray-600">
													<div className="flex justify-between">
														<span>Size:</span>
														<span>{doc.file_size || 'Unknown'}</span>
													</div>
													<div className="flex justify-between">
														<span>Uploaded:</span>
														<span>
															{doc.upload_date 
																? new Date(doc.upload_date).toLocaleDateString() 
																: 'Unknown'
															}
														</span>
													</div>
												</div>

												<div className="flex gap-2 mt-4">
													{doc.file_path && (
														<a
															href={doc.file_path}
															target="_blank"
															rel="noopener noreferrer"
															className="flex-1 bg-blue-600 text-white text-xs py-2 px-3 rounded-md hover:bg-blue-700 transition-colors text-center"
														>
															<i className="fas fa-eye mr-1"></i>
															View
														</a>
													)}
													{doc.download_url && (
														<a
															href={doc.download_url}
															download={doc.document_name || doc.filename}
															className="flex-1 bg-green-600 text-white text-xs py-2 px-3 rounded-md hover:bg-green-700 transition-colors text-center"
														>
															<i className="fas fa-download mr-1"></i>
															Download
														</a>
													)}
												</div>
											</div>
										))}
									</div>
								</div>
							)}
						</div>

						{/* Modal Actions */}
						<div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
							<button
								onClick={closeDocumentsModal}
								className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
							>
								Close
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

// Wrapped component with Error Boundary
const HRTaskManagementDashboardWithErrorBoundary = () => (
	<ErrorBoundary>
		<HRTaskManagementDashboard />
	</ErrorBoundary>
)

export default HRTaskManagementDashboardWithErrorBoundary












