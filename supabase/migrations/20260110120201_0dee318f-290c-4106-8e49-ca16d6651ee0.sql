-- Create storage bucket for training images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'training-images', 
  'training-images', 
  false,
  5242880,  -- 5MB limit per image
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for training-images bucket
CREATE POLICY "Anyone can upload training images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'training-images');

CREATE POLICY "Anyone can read training images"
ON storage.objects FOR SELECT
USING (bucket_id = 'training-images');

CREATE POLICY "Anyone can delete training images"
ON storage.objects FOR DELETE
USING (bucket_id = 'training-images');

-- Create table to track individual uploaded images
CREATE TABLE IF NOT EXISTS public.uploaded_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES public.training_batches(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  label TEXT NOT NULL CHECK (label IN ('normal', 'defect')),
  file_size INTEGER,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.uploaded_images ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow public read on uploaded_images"
ON public.uploaded_images FOR SELECT
USING (true);

CREATE POLICY "Allow public insert on uploaded_images"
ON public.uploaded_images FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public delete on uploaded_images"
ON public.uploaded_images FOR DELETE
USING (true);