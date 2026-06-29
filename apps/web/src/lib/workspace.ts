import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// cache() deduplicates calls within a single server request
// Multiple layouts/pages calling this will only hit the DB once
export const getWorkspaceForUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  const { data: memberData } = await admin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single()

  if (!memberData?.workspace_id) return null

  const { data: ws } = await admin
    .from('workspaces')
    .select('id, name, slug')
    .eq('id', memberData.workspace_id)
    .single()

  return {
    user,
    workspace: ws ?? { id: memberData.workspace_id, name: 'My Workspace', slug: '' },
  }
})
