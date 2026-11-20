-- Allow common bank-statement and office document formats in the private bucket.
-- The bucket remains private and all object access remains owner-folder + MFA RLS protected.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg','image/png','image/webp','image/gif',
  'application/pdf','text/plain','text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf','text/rtf',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.text',
  'audio/mpeg','audio/mp4','audio/wav','audio/webm','audio/ogg',
  'video/mp4','video/webm','video/quicktime'
]::text[]
WHERE id = 'private-assets';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'private-assets') THEN
    RAISE EXCEPTION 'Required private-assets bucket does not exist';
  END IF;
END $$;
