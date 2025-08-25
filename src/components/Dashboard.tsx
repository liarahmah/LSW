import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { projectId } from '../utils/supabase/info'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { CheckCircle, Clock, AlertTriangle, TrendingUp } from 'lucide-react'

export function Dashboard({ user, session }) {
  const [stats, setStats] = useState({
    todayCompletionRate: 0,
    weeklyAverage: 0,
    pendingChecklists: 0,
    openIssues: 0
  })
  const [performanceData, setPerformanceData] = useState([])
  const [recentIssues, setRecentIssues] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && session) {
      fetchDashboardData()
    }
  }, [user, session])

  const fetchDashboardData = async () => {
    try {
      // Fetch performance data
      const performanceResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-8cffd493/performance/${user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (performanceResponse.ok) {
        const performanceData = await performanceResponse.json()
        setPerformanceData(performanceData.performance || [])
        
        // Calculate stats
        const today = new Date().toISOString().split('T')[0]
        const todayData = performanceData.performance?.filter(p => p.date === today) || []
        const todayAvg = todayData.length > 0 
          ? todayData.reduce((sum, p) => sum + p.completionRate, 0) / todayData.length 
          : 0

        // Calculate weekly average
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        const weekData = performanceData.performance?.filter(p => 
          new Date(p.date) >= weekAgo
        ) || []
        const weeklyAvg = weekData.length > 0 
          ? weekData.reduce((sum, p) => sum + p.completionRate, 0) / weekData.length 
          : 0

        setStats(prev => ({
          ...prev,
          todayCompletionRate: Math.round(todayAvg),
          weeklyAverage: Math.round(weeklyAvg)
        }))
      }

      // Fetch issues
      const issuesResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-8cffd493/issues`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (issuesResponse.ok) {
        const issuesData = await issuesResponse.json()
        const openIssues = issuesData.issues?.filter(issue => issue.status === 'open') || []
        setRecentIssues(issuesData.issues?.slice(0, 5) || [])
        setStats(prev => ({
          ...prev,
          openIssues: openIssues.length
        }))
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'destructive'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'default'
    }
  }

  const formatChartData = () => {
    const dailyData = {}
    performanceData.forEach(p => {
      if (!dailyData[p.date]) {
        dailyData[p.date] = { date: p.date, completions: [], total: 0 }
      }
      dailyData[p.date].completions.push(p.completionRate)
      dailyData[p.date].total++
    })

    return Object.values(dailyData)
      .map(day => ({
        date: day.date,
        avgCompletion: day.completions.length > 0 
          ? Math.round(day.completions.reduce((sum, rate) => sum + rate, 0) / day.completions.length)
          : 0
      }))
      .slice(-7) // Last 7 days
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Completion</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayCompletionRate}%</div>
            <Progress value={stats.todayCompletionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Average</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.weeklyAverage}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Last 7 days performance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingChecklists}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Due this hour
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.openIssues}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Require attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Trend</CardTitle>
          <CardDescription>
            Daily completion rates for the past week
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={formatChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avgCompletion" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Issues */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Issues</CardTitle>
          <CardDescription>
            Latest issues you've submitted
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentIssues.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No issues submitted yet
            </p>
          ) : (
            <div className="space-y-4">
              {recentIssues.map((issue) => (
                <div key={issue.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">{issue.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {issue.description?.substring(0, 100)}...
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(issue.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={getPriorityColor(issue.priority)}>
                      {issue.priority}
                    </Badge>
                    <Badge variant="outline">
                      {issue.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}