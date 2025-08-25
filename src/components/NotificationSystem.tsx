import React, { useState, useEffect } from 'react'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Alert, AlertDescription } from './ui/alert'
import { Bell, Clock, CheckCircle, X } from 'lucide-react'

export function NotificationSystem({ user }) {
  const [notifications, setNotifications] = useState([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [permissionGranted, setPermissionGranted] = useState(false)

  useEffect(() => {
    // Update current time every minute
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    // Check for notification permission
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        setPermissionGranted(true)
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          setPermissionGranted(permission === 'granted')
        })
      }
    }

    return () => clearInterval(timeInterval)
  }, [])

  useEffect(() => {
    if (user) {
      checkForHourlyNotifications()
    }
  }, [user, currentTime])

  const checkForHourlyNotifications = () => {
    const now = new Date()
    const minutes = now.getMinutes()
    const hour = now.getHours()

    // Trigger notification at the start of each hour (first 5 minutes)
    if (minutes <= 5) {
      const notificationId = `hourly_${hour}_${now.toDateString()}`
      
      // Check if we already have this notification
      const existingNotification = notifications.find(n => n.id === notificationId)
      if (!existingNotification) {
        const newNotification = {
          id: notificationId,
          type: 'hourly_checklist',
          title: 'Hourly Checklist Due',
          message: `Time to complete your ${user.role} checklist for hour ${hour}:00`,
          timestamp: now.toISOString(),
          priority: 'high',
          dismissed: false
        }

        setNotifications(prev => [...prev, newNotification])

        // Show browser notification if permission granted
        if (permissionGranted) {
          new Notification(newNotification.title, {
            body: newNotification.message,
            icon: '/favicon.ico',
            badge: '/favicon.ico'
          })
        }
      }
    }

    // Add reminder notifications for overdue checklists
    if (minutes === 30) { // 30 minutes past the hour
      const reminderNotificationId = `reminder_${hour}_${now.toDateString()}`
      
      const existingReminder = notifications.find(n => n.id === reminderNotificationId)
      if (!existingReminder) {
        const reminderNotification = {
          id: reminderNotificationId,
          type: 'reminder',
          title: 'Checklist Reminder',
          message: `Don't forget to complete your checklist for hour ${hour}:00`,
          timestamp: now.toISOString(),
          priority: 'medium',
          dismissed: false
        }

        setNotifications(prev => [...prev, reminderNotification])

        if (permissionGranted) {
          new Notification(reminderNotification.title, {
            body: reminderNotification.message,
            icon: '/favicon.ico',
            badge: '/favicon.ico'
          })
        }
      }
    }
  }

  const dismissNotification = (notificationId) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, dismissed: true } : n
      )
    )
  }

  const clearAllNotifications = () => {
    setNotifications(prev => prev.map(n => ({ ...n, dismissed: true })))
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'destructive'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'default'
    }
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'hourly_checklist': return <Clock className="h-4 w-4" />
      case 'reminder': return <Bell className="h-4 w-4" />
      case 'completed': return <CheckCircle className="h-4 w-4" />
      default: return <Bell className="h-4 w-4" />
    }
  }

  const activeNotifications = notifications.filter(n => !n.dismissed)
  const recentNotifications = notifications
    .filter(n => {
      const notificationTime = new Date(n.timestamp)
      const hoursDiff = (currentTime - notificationTime) / (1000 * 60 * 60)
      return hoursDiff <= 24 // Show notifications from last 24 hours
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

  if (activeNotifications.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {activeNotifications.map((notification) => (
        <Alert key={notification.id} className="shadow-lg border-l-4 border-l-blue-500">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2">
              {getNotificationIcon(notification.type)}
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-medium text-sm">{notification.title}</span>
                  <Badge variant={getPriorityColor(notification.priority)} className="text-xs">
                    {notification.priority}
                  </Badge>
                </div>
                <AlertDescription className="text-xs">
                  {notification.message}
                </AlertDescription>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(notification.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dismissNotification(notification.id)}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </Alert>
      ))}
      
      {activeNotifications.length > 1 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllNotifications}
            className="text-xs"
          >
            Clear All
          </Button>
        </div>
      )}
    </div>
  )
}