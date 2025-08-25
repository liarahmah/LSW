import { Hono } from 'npm:hono'
import { cors } from 'npm:hono/cors'
import { logger } from 'npm:hono/logger'
import { createClient } from 'npm:@supabase/supabase-js@2'
import * as kv from './kv_store.tsx'

const app = new Hono()

app.use('*', cors())
app.use('*', logger(console.log))

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// Sign up route
app.post('/make-server-8cffd493/signup', async (c) => {
  try {
    const { email, password, name, role } = await c.req.json()
    
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role: role || 'employee' },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    })

    if (error) {
      console.log('Signup error:', error)
      return c.json({ error: error.message }, 400)
    }

    // Store user profile in KV store
    await kv.set(`user:${data.user.id}`, {
      id: data.user.id,
      email,
      name,
      role: role || 'employee',
      created_at: new Date().toISOString()
    })

    return c.json({ user: data.user })
  } catch (error) {
    console.log('Signup process error:', error)
    return c.json({ error: 'Failed to create user' }, 500)
  }
})

// Get user profile
app.get('/make-server-8cffd493/profile', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1]
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)
    
    if (!user?.id) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const profile = await kv.get(`user:${user.id}`)
    return c.json({ profile })
  } catch (error) {
    console.log('Profile fetch error:', error)
    return c.json({ error: 'Failed to fetch profile' }, 500)
  }
})

// Get checklist templates for role
app.get('/make-server-8cffd493/checklist/:role', async (c) => {
  try {
    const role = c.req.param('role')
    const checklists = await kv.get(`checklist_template:${role}`)
    
    if (!checklists) {
      // Initialize default checklists for roles
      const defaultChecklists = {
        admin: [
          { id: '1', task: 'Review system performance metrics', frequency: 'hourly' },
          { id: '2', task: 'Check security alerts', frequency: 'hourly' },
          { id: '3', task: 'Monitor user activity', frequency: 'daily' },
          { id: '4', task: 'Backup verification', frequency: 'daily' }
        ],
        supervisor: [
          { id: '1', task: 'Team attendance check', frequency: 'hourly' },
          { id: '2', task: 'Review team performance', frequency: 'hourly' },
          { id: '3', task: 'Check pending approvals', frequency: 'hourly' },
          { id: '4', task: 'Safety inspection', frequency: 'daily' }
        ],
        employee: [
          { id: '1', task: 'Equipment safety check', frequency: 'hourly' },
          { id: '2', task: 'Work area cleanliness', frequency: 'hourly' },
          { id: '3', task: 'Task completion status', frequency: 'hourly' },
          { id: '4', task: 'Report any issues', frequency: 'daily' }
        ]
      }
      
      await kv.set(`checklist_template:${role}`, defaultChecklists[role] || defaultChecklists.employee)
      return c.json({ checklists: defaultChecklists[role] || defaultChecklists.employee })
    }
    
    return c.json({ checklists })
  } catch (error) {
    console.log('Checklist fetch error:', error)
    return c.json({ error: 'Failed to fetch checklists' }, 500)
  }
})

// Submit checklist response
app.post('/make-server-8cffd493/checklist/submit', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1]
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)
    
    if (!user?.id) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const { checklistId, responses, notes } = await c.req.json()
    const timestamp = new Date().toISOString()
    const submissionId = `${user.id}_${Date.now()}`
    
    const submission = {
      id: submissionId,
      userId: user.id,
      checklistId,
      responses,
      notes,
      timestamp,
      date: timestamp.split('T')[0],
      hour: new Date().getHours()
    }
    
    await kv.set(`checklist_submission:${submissionId}`, submission)
    
    // Update performance metrics
    const completionRate = responses.filter(r => r.completed).length / responses.length * 100
    await kv.set(`performance:${user.id}:${timestamp.split('T')[0]}:${new Date().getHours()}`, {
      userId: user.id,
      date: timestamp.split('T')[0],
      hour: new Date().getHours(),
      completionRate,
      timestamp
    })
    
    return c.json({ success: true, submissionId })
  } catch (error) {
    console.log('Checklist submission error:', error)
    return c.json({ error: 'Failed to submit checklist' }, 500)
  }
})

// Submit issue
app.post('/make-server-8cffd493/issues', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1]
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)
    
    if (!user?.id) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const { title, description, priority, category } = await c.req.json()
    const issueId = `issue_${Date.now()}`
    
    const issue = {
      id: issueId,
      userId: user.id,
      title,
      description,
      priority: priority || 'medium',
      category: category || 'general',
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    await kv.set(`issue:${issueId}`, issue)
    
    return c.json({ success: true, issue })
  } catch (error) {
    console.log('Issue submission error:', error)
    return c.json({ error: 'Failed to submit issue' }, 500)
  }
})

// Get user issues
app.get('/make-server-8cffd493/issues', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1]
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)
    
    if (!user?.id) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const issues = await kv.getByPrefix('issue:')
    const userIssues = issues.filter(issue => issue.value.userId === user.id)
    
    return c.json({ issues: userIssues.map(i => i.value) })
  } catch (error) {
    console.log('Issues fetch error:', error)
    return c.json({ error: 'Failed to fetch issues' }, 500)
  }
})

// Get performance data
app.get('/make-server-8cffd493/performance/:userId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1]
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)
    
    if (!user?.id) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = c.req.param('userId')
    const performanceData = await kv.getByPrefix(`performance:${userId}`)
    
    const sortedData = performanceData
      .map(p => p.value)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    
    return c.json({ performance: sortedData })
  } catch (error) {
    console.log('Performance fetch error:', error)
    return c.json({ error: 'Failed to fetch performance data' }, 500)
  }
})

// Get all users (admin only)
app.get('/make-server-8cffd493/users', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1]
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)
    
    if (!user?.id) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const currentUser = await kv.get(`user:${user.id}`)
    if (currentUser?.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403)
    }

    const users = await kv.getByPrefix('user:')
    return c.json({ users: users.map(u => u.value) })
  } catch (error) {
    console.log('Users fetch error:', error)
    return c.json({ error: 'Failed to fetch users' }, 500)
  }
})

Deno.serve(app.fetch)