'use client';

import { useEffect, useState, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Settings,
  User,
  Bell,
  Palette,
  Download,
  Save,
  Camera,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import type { ClinicSettings } from '@/lib/types';

// Tipo extendido del perfil para campos opcionales que pueden existir en la tabla
// pero que aún no están en los tipos generados de @/lib/types
type ExtendedProfile = {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  phone?: string | null;
  specialty?: string | null;
  license_number?: string | null;
  bio?: string | null;
};

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<ClinicSettings | null>(null);

  // Usamos el perfil como ExtendedProfile para acceder a campos opcionales sin errores de tipo
  const extendedProfile = profile as ExtendedProfile | null;

  const [profileData, setProfileData] = useState({
    full_name: '',
    phone: '',
    specialty: '',
    license_number: '',
    bio: ''
  });

  const [activeTab, setActiveTab] = useState('profile');
  const [clinicData, setClinicData] = useState({
    clinic_name: '',
    address: '',
    phone: '',
    email: '',
    tax_id: ''
  });

  const [notifications, setNotifications] = useState({
    email: true,
    reminders: true
  });

  const { theme, setTheme } = useTheme();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (extendedProfile) {
      setAvatarUrl(extendedProfile.avatar_url || null);
      setProfileData({
        full_name: extendedProfile.full_name || '',
        phone: extendedProfile.phone || '',
        specialty: extendedProfile.specialty || '',
        license_number: extendedProfile.license_number || '',
        bio: extendedProfile.bio || ''
      });
      fetchClinicSettings();
    }
  }, [extendedProfile]);

  const fetchClinicSettings = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('clinic_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setSettings(data);
        setClinicData({
          clinic_name: data.clinic_name || '',
          address: data.clinic_address || '',
          phone: data.clinic_phone || '',
          email: data.clinic_email || '',
          tax_id: data.clinic_rfc || ''
        });
        if (data.notification_prefs) {
          setNotifications(data.notification_prefs as typeof notifications);
        }
        if (data.theme) {
          setTheme(data.theme);
        }
      }
    } catch (err: any) {
      console.error('Error fetching clinic settings:', err);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('La imagen no debe pasar de 2MB'); return; }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error: profErr } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', user.id);
      if (profErr) throw profErr;
      setAvatarUrl(urlData.publicUrl);
      toast.success('Foto actualizada');
    } catch (err: any) {
      toast.error(err?.message || 'Error al subir la foto');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleThemeChange = async (newTheme: string) => {
    setTheme(newTheme);
    if (!user) return;
    try {
      const { data: existing } = await supabase
        .from('clinic_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (existing) {
        await supabase.from('clinic_settings').update({ theme: newTheme }).eq('user_id', user.id);
      } else {
        await supabase.from('clinic_settings').insert({ user_id: user.id, theme: newTheme });
      }
    } catch (err) {
      console.error('Error guardando tema:', err);
    }
  };

  const handleProfileSave = async () => {
    if (!user) {
      toast.error('Debes iniciar sesión');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          phone: profileData.phone,
          specialty: profileData.specialty,
          license_number: profileData.license_number,
          bio: profileData.bio,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast.success('Perfil actualizado correctamente');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      const msg = err?.message || 'Error al actualizar perfil';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClinicSave = async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    try {
      const payload = {
        clinic_name: clinicData.clinic_name || null,
        clinic_address: clinicData.address || null,
        clinic_phone: clinicData.phone || null,
        clinic_email: clinicData.email || null,
        clinic_rfc: clinicData.tax_id || null,
        notification_prefs: notifications,
        theme: theme || 'system'
      };

      if (settings) {
        const { error: updateError } = await supabase
          .from('clinic_settings')
          .update(payload)
          .eq('user_id', user.id);
        
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('clinic_settings').insert({
          user_id: user.id,
          ...payload
        });
        
        if (insertError) throw insertError;
      }
      
      toast.success('Configuración guardada');
    } catch (err: any) {
      console.error('Error saving clinic settings:', err);
      const msg = err?.message || 'Error al guardar';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!user) return;

    try {
      const [{ data: patients }, { data: consultations }] = await Promise.all([
        supabase.from('patients').select('*').eq('user_id', user.id),
        supabase.from('consultations').select('*').eq('user_id', user.id)
      ]);

      const exportData = {
        exportDate: new Date().toISOString(),
        patients: patients || [],
        consultations: consultations || []
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medsystem-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Datos exportados exitosamente');
    } catch (err: any) {
      console.error('Error exporting data:', err);
      toast.error(err?.message || 'Error al exportar');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configuración</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Gestiona tu perfil y preferencias del sistema
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <Card className="p-4">
            <nav className="space-y-1">
              {[
                { id: 'profile', label: 'Perfil', icon: User },
                { id: 'clinic', label: 'Consultorio', icon: Settings },
                { id: 'notifications', label: 'Notificaciones', icon: Bell },
                { id: 'appearance', label: 'Apariencia', icon: Palette },
                { id: 'data', label: 'Datos', icon: Download }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    activeTab === item.id
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </nav>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-6">
          {activeTab === 'profile' && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <User className="w-5 h-5" />
              Perfil Profesional
            </h3>

            <div className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="relative">
                  {(avatarUrl || extendedProfile?.avatar_url) ? (
                    <img
                      src={avatarUrl || extendedProfile?.avatar_url || ''}
                      alt="Foto de perfil"
                      className="w-24 h-24 rounded-full object-cover border"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                      {extendedProfile?.full_name?.charAt(0) || 'U'}
                    </div>
                  )}
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-white dark:bg-slate-800 rounded-full border shadow flex items-center justify-center hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Foto de perfil</p>
                  <p className="text-xs text-slate-400">JPG o PNG. Máximo 2MB</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre Completo</Label>
                  <Input
                    value={profileData.full_name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    value={profileData.phone}
                    onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Especialidad</Label>
                  <Input
                    value={profileData.specialty}
                    onChange={(e) => setProfileData(prev => ({ ...prev, specialty: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número de Cédula</Label>
                  <Input
                    value={profileData.license_number}
                    onChange={(e) => setProfileData(prev => ({ ...prev, license_number: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Biografía</Label>
                <textarea
                  value={profileData.bio}
                  onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg min-h-[100px]"
                  placeholder="Cuéntanos sobre ti..."
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleProfileSave} disabled={loading} className="gap-2">
                  <Save className="w-4 h-4" />
                  Guardar Perfil
                </Button>
              </div>
            </div>
          </Card>
          )}

          {activeTab === 'clinic' && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Datos del Consultorio
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre del Consultorio</Label>
                <Input
                  value={clinicData.clinic_name}
                  onChange={(e) => setClinicData(prev => ({ ...prev, clinic_name: e.target.value }))}
                  placeholder="Centro Médico..."
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={clinicData.phone}
                  onChange={(e) => setClinicData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="55 1234 5678"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={clinicData.email}
                  onChange={(e) => setClinicData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="contacto@consultorio.com"
                />
              </div>
              <div className="space-y-2">
                <Label>RFC / Tax ID</Label>
                <Input
                  value={clinicData.tax_id}
                  onChange={(e) => setClinicData(prev => ({ ...prev, tax_id: e.target.value }))}
                  placeholder="XAXX010101000"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Dirección</Label>
                <Input
                  value={clinicData.address}
                  onChange={(e) => setClinicData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Calle, número, colonia, ciudad"
                />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <Button onClick={handleClinicSave} disabled={loading} className="gap-2">
                <Save className="w-4 h-4" />
                Guardar
              </Button>
            </div>
          </Card>
          )}

          {activeTab === 'notifications' && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notificaciones
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Notificaciones por Email</p>
                  <p className="text-sm text-slate-500">Recibe actualizaciones importantes por correo</p>
                </div>
                <Switch
                  checked={notifications.email}
                  onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, email: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Recordatorios de Citas</p>
                  <p className="text-sm text-slate-500">Recibe recordatorios antes de tus citas</p>
                </div>
                <Switch
                  checked={notifications.reminders}
                  onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, reminders: checked }))}
                />
              </div>
            </div>
          </Card>
          )}

          {activeTab === 'appearance' && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Apariencia
            </h3>

            <div className="space-y-4">
              <div>
                <Label className="mb-3 block">Tema</Label>
                <div className="flex gap-3">
                  {[
                    { value: 'light', label: 'Claro' },
                    { value: 'dark', label: 'Oscuro' },
                    { value: 'system', label: 'Sistema' }
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => handleThemeChange(option.value)}
                      className={`px-4 py-2 rounded-lg border ${
                        theme === option.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
          )}

          {activeTab === 'data' && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Download className="w-5 h-5" />
              Gestión de Datos
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Exportar Datos</p>
                  <p className="text-sm text-slate-500">Descarga todos tus datos en formato JSON</p>
                </div>
                <Button variant="outline" onClick={handleExport} className="gap-2">
                  <Download className="w-4 h-4" />
                  Exportar
                </Button>
              </div>
            </div>
          </Card>
          )}
        </div>
      </div>
    </div>
  );
}