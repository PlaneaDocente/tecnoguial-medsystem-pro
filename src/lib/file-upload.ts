'use client';

import { supabase } from '@/integrations/supabase/client';

export interface UploadResult {
  url: string;
  path: string;
  error?: string;
}

export async function uploadPatientFile(
  patientId: string,
  file: File,
  category: 'laboratory' | 'imaging' | 'clinical' | 'prescription' | 'other',
  uploadedBy: string,
  notes?: string
): Promise<{ success: boolean; fileUrl?: string; error?: string }> {
  try {
    // Generate unique filename
    const ext = file.name.split('.').pop();
    const filename = `${patientId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('patient-files')
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('patient-files')
      .getPublicUrl(filename);

    // Save file record in database
    const { error: dbError } = await supabase
      .from('patient_files')
      .insert({
        patient_id: patientId,
        file_name: file.name,
        file_type: file.type,
        file_url: urlData.publicUrl,
        storage_path: filename,
        file_category: category,
        file_size: file.size,
        notes: notes,
        uploaded_by: uploadedBy,
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return { success: false, error: dbError.message };
    }

    return { success: true, fileUrl: urlData.publicUrl };
  } catch (error: any) {
    console.error('Upload failed:', error);
    return { success: false, error: error.message };
  }
}

export async function deletePatientFile(fileId: string, storagePath: string): Promise<boolean> {
  try {
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('patient-files')
      .remove([storagePath]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('patient_files')
      .delete()
      .eq('id', fileId);

    if (dbError) {
      console.error('Database delete error:', dbError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Delete failed:', error);
    return false;
  }
}

export async function getPatientFiles(patientId: string) {
  const { data, error } = await supabase
    .from('patient_files')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching files:', error);
    return [];
  }

  return data || [];
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getFileIcon(fileType: string): string {
  if (fileType.includes('pdf')) return 'pdf';
  if (fileType.includes('image')) return 'image';
  if (fileType.includes('word') || fileType.includes('document')) return 'doc';
  return 'file';
}
