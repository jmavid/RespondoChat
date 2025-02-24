import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { File, Trash2, AlertCircle, CheckCircle, Clock, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { processDocument } from '../../lib/embeddings';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf'
];

export function DocumentList() {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({});
  const [viewUrls, setViewUrls] = useState({});

  // Subscribe to document status changes
  useEffect(() => {
    const subscription = supabase
      .channel('document_status_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'documents',
        filter: `status=eq.completed`
      }, (payload) => {
        // Update the document status in the UI
        console.log('Received payload:', payload);  // Verifica que el evento se recibe

        setDocuments(prev => prev.map(doc => 
          doc.id === payload.new.id ? { ...doc, status: 'completed' } : doc
        ));
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    fetchDocuments();
    subscribeToDocuments();
  }, []);

  useEffect(() => {
    // Get signed URLs for all documents
    const getSignedUrls = async () => {
      const urls = {};
      for (const doc of documents) {
        try {
          const { data: { signedUrl }, error } = await supabase.storage
            .from('documents')
            .createSignedUrl(doc.storage_path, 3600); // 1 hour expiration

          if (error) throw error;
          urls[doc.id] = signedUrl;
        } catch (error) {
          console.error('Error getting signed URL:', error);
        }
      }
      setViewUrls(urls);
    };

    if (documents.length > 0) {
      getSignedUrls();
    }
  }, [documents]);

  const subscribeToDocuments = () => {
    const subscription = supabase
      .channel('documents_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'documents'
      }, () => {
        fetchDocuments();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setError('Error loading documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploadError(null);
    setLoading(true);

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(t('documents.errors.sizeLimit'));
      setLoading(false);
      event.target.value = '';
      return;
    }

    // Validate file type
    const fileExtension = file.name.split('.').pop().toLowerCase();
    const isAllowedType = ALLOWED_TYPES.some(type =>
      file.type === type ||
      type.endsWith(fileExtension)
    );

    if (!isAllowedType) {
      setUploadError(t('documents.errors.invalidType'));
      setLoading(false);
      event.target.value = '';
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create a unique filename
      const fileName = `${uuidv4()}.${fileExtension}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload file to storage
      const { error: uploadError, data } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (progress) => {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            setUploadProgress(prev => ({
              ...prev,
              [fileName]: percent
            }));
          }
        });

      if (uploadError) {
        console.error('Storage error:', uploadError);
        throw new Error(t('documents.errors.uploadError'));
      }

      // Create document record
      const { data: documentData, error: insertError } = await supabase
        .from('documents')
        .insert([{
          name: file.name,
          type: fileExtension.toLowerCase(),
          size: file.size,
          storage_path: filePath,
          created_by: user.id,
          status: 'pending'
        }], { returning: true })
        .select()
        .single();

      if (insertError) {
        console.error('Database error:', insertError);
        // If database insert fails, clean up the uploaded file
        await supabase.storage
          .from('documents')
          .remove([filePath]);
        throw new Error(t('documents.errors.uploadError'));
      }

      // Start document processing
      processDocument(documentData.id).catch(error => {
        console.error('Error processing document:', error);
      });

      // Refresh the document list
      setUploadProgress(prev => ({ ...prev, [fileName]: null }));
      await fetchDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      setUploadError(error.message || t('documents.errors.uploadError'));
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const handleDelete = async (id, storagePath) => {
    try {
      if (!window.confirm(t('documents.confirmDelete'))) {
        return;
      }


      setError(null);
      setLoading(true);

      // Delete file from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([storagePath]);

      if (storageError) {
        console.error('Storage error:', storageError);
        throw new Error(t('documents.errors.deleteError'));
      }

      // Delete document record
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Database error:', deleteError);
        throw new Error(t('documents.errors.deleteError'));
      }

      // Refresh the document list
      await fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      setError(error.message || t('documents.errors.deleteError'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return (
          <div className="flex items-center gap-2 text-green-500">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{t('documents.status.completed')}</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2 text-red-500">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{t('documents.status.error')}</span>
          </div>
        );
      case 'processing':
        return (
          <div className="flex items-center gap-2 text-blue-500">
            <Clock className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">{t('documents.status.processing')}</span>
          </div>
        );
      case 'pending':
        return (
          <div className="flex items-center gap-2 text-gray-500">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-medium">{t('documents.status.pending')}</span>
          </div>
        );
      default:
        return null;
    }
  };

  const renderStatus = (doc) => {
    if (uploadProgress[doc.name] !== undefined) {
      return (
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-blue-600">
              {t('documents.status.uploading')}
            </span>
            <span className="text-sm font-medium text-blue-600">
              {uploadProgress[doc.name]}%
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-300 relative"
              style={{ width: `${uploadProgress[doc.name]}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>
        </div>
      );
    }

    return getStatusIcon(doc.status);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t('documents.title')}</h1>
        <label className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors cursor-pointer">
          <Upload className="w-5 h-5" />
          {t('documents.upload')}
          <input
            type="file"
            className="hidden"
            accept=".txt,.doc,.docx,.pdf,.ppt,.pptx"
            onChange={handleFileUpload}
            disabled={loading}
          />
        </label>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {uploadError && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {uploadError}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('documents.name')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('documents.type')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('documents.size')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('documents.status.title')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('documents.createdAt')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('documents.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center">
                    {t('documents.noDocuments')}
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <File className="w-5 h-5 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900">
                          <a
                            href={viewUrls[doc.id]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-600 hover:underline"
                            onClick={(e) => {
                              if (!viewUrls[doc.id]) {
                                e.preventDefault();
                              }
                            }}
                          >
                            {doc.name}
                          </a>
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500">
                        {doc.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500">
                        {(doc.size / 1024).toFixed(2)} KB
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {renderStatus(doc)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(doc.id, doc.storage_path);
                        }}
                        className="text-red-600 hover:text-red-900 p-2 rounded-full hover:bg-red-50 transition-colors"
                        disabled={loading}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}