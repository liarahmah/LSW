import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { Alert, AlertDescription } from './ui/alert'
import { projectId } from '../utils/supabase/info'
import { CheckCircle, Clock, AlertCircle } from 'lucide-react'

export function ChecklistManager({ user, session }) {
  const [checklists, setChecklists] = useState([])
  const [responses, setResponses] = useState({})
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [currentHour] = useState(new Date().getHours())

  useEffect(() => {
    if (user) {
      fetchChecklists()
    }
  }, [user])

  const fetchChecklists = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-8cffd493/checklist/${user.role}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        setChecklists(data.checklists || [])
        
        // Initialize responses
        const initialResponses = {}
        data.checklists?.forEach(item => {
          initialResponses[item.id] = { completed: false, notes: '' }
        })
        setResponses(initialResponses)
      }
    } catch (error) {
      console.error('Error fetching checklists:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResponseChange = (itemId, field, value) => {
    setResponses(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setMessage('')

    try {
      const responseArray = Object.entries(responses).map(([itemId, response]) => ({
        itemId,
        completed: response.completed,
        notes: response.notes
      }))

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-8cffd493/checklist/submit`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            checklistId: `${user.role}_${new Date().toISOString().split('T')[0]}_${currentHour}`,
            responses: responseArray,
            notes
          })
        }
      )

      if (response.ok) {
        setMessage('Checklist submitted successfully!')
        
        // Reset form
        const resetResponses = {}
        checklists.forEach(item => {
          resetResponses[item.id] = { completed: false, notes: '' }
        })
        setResponses(resetResponses)
        setNotes('')
      } else {
        const errorData = await response.json()
        setMessage(errorData.error || 'Failed to submit checklist')
      }
    } catch (error) {
      console.error('Error submitting checklist:', error)
      setMessage('An error occurred while submitting')
    } finally {
      setSubmitting(false)
    }
  }

  const getCompletionRate = () => {
    const completed = Object.values(responses).filter(r => r.completed).length
    return checklists.length > 0 ? Math.round((completed / checklists.length) * 100) : 0
  }

  const isHourlyTask = (frequency) => frequency === 'hourly'
  const isDailyTask = (frequency) => frequency === 'daily'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Daily Checklist - {user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
            <Badge variant="outline" className="ml-2">
              Hour {currentHour}:00
            </Badge>
          </CardTitle>
          <CardDescription>
            Complete your {user.role} checklist for this hour. Current completion: {getCompletionRate()}%
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <div className="flex items-center space-x-1">
              <Clock className="h-4 w-4" />
              <span>Hourly Tasks</span>
            </div>
            <div className="flex items-center space-x-1">
              <CheckCircle className="h-4 w-4" />
              <span>Daily Tasks</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {message && (
        <Alert variant={message.includes('successfully') ? 'default' : 'destructive'}>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {/* Checklist Items */}
      <div className="space-y-4">
        {checklists.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No checklist items found for your role.</p>
            </CardContent>
          </Card>
        ) : (
          checklists.map((item) => (
            <Card key={item.id} className={responses[item.id]?.completed ? 'bg-green-50 border-green-200' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id={item.id}
                      checked={responses[item.id]?.completed || false}
                      onCheckedChange={(checked) => 
                        handleResponseChange(item.id, 'completed', checked)
                      }
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor={item.id}
                        className={`text-sm font-medium cursor-pointer ${
                          responses[item.id]?.completed ? 'line-through text-muted-foreground' : ''
                        }`}
                      >
                        {item.task}
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={isHourlyTask(item.frequency) ? 'default' : 'secondary'}>
                      {item.frequency}
                    </Badge>
                    {isHourlyTask(item.frequency) && (
                      <Clock className="h-4 w-4 text-orange-500" />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Add notes or comments for this task..."
                  value={responses[item.id]?.notes || ''}
                  onChange={(e) => handleResponseChange(item.id, 'notes', e.target.value)}
                  className="min-h-20"
                />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* General Notes */}
      <Card>
        <CardHeader>
          <CardTitle>General Notes</CardTitle>
          <CardDescription>
            Add any additional notes or observations for this submission
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Enter general notes about your shift, observations, or any other relevant information..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-24"
          />
        </CardContent>
      </Card>

      {/* Submit Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Completion Rate: {getCompletionRate()}% ({Object.values(responses).filter(r => r.completed).length}/{checklists.length} tasks)
            </div>
            <Button 
              onClick={handleSubmit}
              disabled={submitting || checklists.length === 0}
              size="lg"
            >
              {submitting ? 'Submitting...' : 'Submit Checklist'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}