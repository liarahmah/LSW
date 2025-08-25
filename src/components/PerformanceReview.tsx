import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { projectId } from '../utils/supabase/info'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, TrendingDown, Calendar, Clock, Award, Target } from 'lucide-react'

export function PerformanceReview({ user, session }) {
  const [performanceData, setPerformanceData] = useState([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('week')
  const [stats, setStats] = useState({
    overallAverage: 0,
    totalSubmissions: 0,
    bestDay: null,
    worstDay: null,
    trend: 'stable',
    consistencyScore: 0
  })

  useEffect(() => {
    if (user) {
      fetchPerformanceData()
    }
  }, [user, timeRange])

  const fetchPerformanceData = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-8cffd493/performance/${user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        const rawData = data.performance || []
        setPerformanceData(rawData)
        calculateStats(rawData)
      }
    } catch (error) {
      console.error('Error fetching performance data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (data) => {
    if (data.length === 0) return

    // Filter data based on time range
    const now = new Date()
    const filteredData = data.filter(item => {
      const itemDate = new Date(item.timestamp)
      const daysDiff = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24))
      
      switch (timeRange) {
        case 'week': return daysDiff <= 7
        case 'month': return daysDiff <= 30
        case 'quarter': return daysDiff <= 90
        default: return true
      }
    })

    if (filteredData.length === 0) return

    // Calculate overall average
    const overallAverage = filteredData.reduce((sum, item) => sum + item.completionRate, 0) / filteredData.length

    // Group by day for daily averages
    const dailyData = {}
    filteredData.forEach(item => {
      if (!dailyData[item.date]) {
        dailyData[item.date] = []
      }
      dailyData[item.date].push(item.completionRate)
    })

    const dailyAverages = Object.entries(dailyData).map(([date, rates]) => ({
      date,
      average: rates.reduce((sum, rate) => sum + rate, 0) / rates.length
    }))

    // Find best and worst days
    const bestDay = dailyAverages.reduce((best, current) => 
      current.average > best.average ? current : best
    )
    const worstDay = dailyAverages.reduce((worst, current) => 
      current.average < worst.average ? current : worst
    )

    // Calculate trend
    const recentData = dailyAverages.slice(-7) // Last 7 days
    const earlierData = dailyAverages.slice(-14, -7) // Previous 7 days
    
    let trend = 'stable'
    if (recentData.length > 0 && earlierData.length > 0) {
      const recentAvg = recentData.reduce((sum, day) => sum + day.average, 0) / recentData.length
      const earlierAvg = earlierData.reduce((sum, day) => sum + day.average, 0) / earlierData.length
      
      if (recentAvg > earlierAvg + 5) trend = 'improving'
      else if (recentAvg < earlierAvg - 5) trend = 'declining'
    }

    // Calculate consistency score (lower standard deviation = higher consistency)
    const standardDeviation = Math.sqrt(
      dailyAverages.reduce((sum, day) => sum + Math.pow(day.average - overallAverage, 2), 0) / dailyAverages.length
    )
    const consistencyScore = Math.max(0, 100 - standardDeviation)

    setStats({
      overallAverage: Math.round(overallAverage),
      totalSubmissions: filteredData.length,
      bestDay,
      worstDay,
      trend,
      consistencyScore: Math.round(consistencyScore)
    })
  }

  const getChartData = () => {
    const now = new Date()
    const filtered = performanceData.filter(item => {
      const itemDate = new Date(item.timestamp)
      const daysDiff = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24))
      
      switch (timeRange) {
        case 'week': return daysDiff <= 7
        case 'month': return daysDiff <= 30
        case 'quarter': return daysDiff <= 90
        default: return true
      }
    })

    // Group by day
    const dailyData = {}
    filtered.forEach(item => {
      if (!dailyData[item.date]) {
        dailyData[item.date] = { completions: [], total: 0 }
      }
      dailyData[item.date].completions.push(item.completionRate)
      dailyData[item.date].total++
    })

    return Object.entries(dailyData)
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: date,
        average: Math.round(data.completions.reduce((sum, rate) => sum + rate, 0) / data.completions.length),
        submissions: data.total
      }))
      .sort((a, b) => new Date(a.fullDate) - new Date(b.fullDate))
  }

  const getHourlyData = () => {
    const now = new Date()
    const filtered = performanceData.filter(item => {
      const itemDate = new Date(item.timestamp)
      const daysDiff = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24))
      return daysDiff <= 7 // Last week only
    })

    const hourlyData = {}
    for (let hour = 0; hour < 24; hour++) {
      hourlyData[hour] = []
    }

    filtered.forEach(item => {
      hourlyData[item.hour].push(item.completionRate)
    })

    return Object.entries(hourlyData)
      .map(([hour, rates]) => ({
        hour: `${hour}:00`,
        average: rates.length > 0 ? Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length) : 0,
        submissions: rates.length
      }))
      .filter(item => item.submissions > 0)
  }

  const getPerformanceGrade = (score) => {
    if (score >= 90) return { grade: 'A', color: 'bg-green-500', description: 'Excellent' }
    if (score >= 80) return { grade: 'B', color: 'bg-blue-500', description: 'Good' }
    if (score >= 70) return { grade: 'C', color: 'bg-yellow-500', description: 'Average' }
    if (score >= 60) return { grade: 'D', color: 'bg-orange-500', description: 'Below Average' }
    return { grade: 'F', color: 'bg-red-500', description: 'Needs Improvement' }
  }

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-600" />
      default: return <TrendingUp className="h-4 w-4 text-gray-600" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const grade = getPerformanceGrade(stats.overallAverage)
  const chartData = getChartData()
  const hourlyData = getHourlyData()

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Performance Review</CardTitle>
              <CardDescription>
                Detailed analysis of your work performance and completion rates
              </CardDescription>
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last Week</SelectItem>
                <SelectItem value="month">Last Month</SelectItem>
                <SelectItem value="quarter">Last Quarter</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Grade</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className={`w-8 h-8 rounded-full ${grade.color} flex items-center justify-center text-white font-bold`}>
                {grade.grade}
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.overallAverage}%</div>
                <p className="text-xs text-muted-foreground">{grade.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance Trend</CardTitle>
            {getTrendIcon(stats.trend)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{stats.trend}</div>
            <p className="text-xs text-muted-foreground">
              Based on recent submissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consistency Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.consistencyScore}%</div>
            <Progress value={stats.consistencyScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSubmissions}</div>
            <p className="text-xs text-muted-foreground">
              In selected period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Best and Worst Performance */}
      {stats.bestDay && stats.worstDay && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-green-600">Best Performance Day</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {Math.round(stats.bestDay.average)}%
              </div>
              <p className="text-sm text-muted-foreground">
                {new Date(stats.bestDay.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-orange-600">Lowest Performance Day</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {Math.round(stats.worstDay.average)}%
              </div>
              <p className="text-sm text-muted-foreground">
                {new Date(stats.worstDay.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Performance Charts */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Performance Trend</CardTitle>
            <CardDescription>
              Average completion rates over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip 
                    formatter={(value) => [`${value}%`, 'Completion Rate']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="average" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hourly Performance */}
      {hourlyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Hourly Performance Pattern</CardTitle>
            <CardDescription>
              Performance by hour of day (last 7 days)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip 
                    formatter={(value) => [`${value}%`, 'Avg Completion Rate']}
                  />
                  <Bar dataKey="average" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data Message */}
      {performanceData.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">
              No performance data available yet. Complete some checklists to see your performance review.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}