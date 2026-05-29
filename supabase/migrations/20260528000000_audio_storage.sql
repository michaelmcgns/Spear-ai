-- ============================================================
-- Audio uploads bucket for direct browser → Supabase uploads
-- Bypasses Vercel's 4.5 MB serverless body-size limit.
-- ============================================================

-- Create the bucket (private by default)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-uploads',
  'audio-uploads',
  false,
  104857600,  -- 100 MB per file
  ARRAY['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/webm', 'video/mp4', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload their own files
CREATE POLICY "users can upload audio" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audio-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Authenticated users can read their own files
CREATE POLICY "users can read own audio" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'audio-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Authenticated users can delete their own files
CREATE POLICY "users can delete own audio" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'audio-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Service role can access all files (for server-side download → AssemblyAI)
CREATE POLICY "service role can access all audio" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'audio-uploads');
