'use client';

import { useEffect, useState } from 'react';
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
  Shield,
  Download,
  Upload,
  Save,
  Camera
} from 'lucide-react';
import { toast } from 'sonner';
import type { ClinicSettings } from '@/lib/types';

export default function SettingsPage() {
  const { user, profile, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<ClinicSettings | null>(null);

  const [profileData, setProfileData] = useState({
    full_name: '',
    phone: '',
    specialty: '',
    license_number: '',
    bio: ''
  });

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

  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  useEffect(() => {
    if (profile) {
      setProfileData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        specialty: profile.specialty || '',
        license_number: (profile as any).license_number || '',
        bio: (profile as any).bio || ''
      });
      fetchClinicSettings();
    }
  }, [profile]);

  const fetchClinicSettings = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('clinic_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setSettings(data);
      setClinicData({
        clinic_name: data.clinic_name || '',
        address: data.address || '',
        phone: data.phone || '',
        email: data.email || '',
        tax_id: data.tax_id || ''
      });
      if (data.notification_prefs) {
        setNotifications(data.notification_prefs);
      }
      if (data.theme) {
        setTheme(data.theme);
      }
    }
  };

  const handleProfileSave = async () => {
    setLoading(true);
    try {
      await updateProfile(profileData);
      toast.success('Perfil actualizado correctamente');
    } catch (error) {
      toast.error('Error al actualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleClinicSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (settings) {
        await supabase
          .from('clinic_settings')
          .update({
            clinic_name: clinicData.clinic_name,
            address: clinicData.address,
            phone: clinicData.phone,
            email: clinicData.email,
            tax_id: clinicData.tax_id,
            notification_prefs: notifications,
            theme
          })
          .eq('user_id', user.id);
      } else {
        await supabase.from('clinic_settings').insert({
          user_id: user.id,
          clinic_name: clinicData.clinic_name,
          address: clinicData.address,
          phone: clinicData.phone,
          email: clinicData.email,
          tax_id: clinicData.tax_id,
          notification_prefs: notifications,
          theme
        });
      }
      toast.success('Configuración guardada');
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!user) return;
    toast.success('Preparando exportación de datos...');

    try {
      const { data: patients } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', user.id);

      const { data: consultations } = await supabase
        .from('consultations')
        .select('*')
        .eq('user_id', user.id);

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
    } catch (error) {
      toast.error('Error al exportar');
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
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
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </nav>
          </Card>
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Profile Settings */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <User className="w-5 h-5" />
              Perfil Profesional
            </h3>

            <div className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                    {profile?.full_name?.charAt(0) || 'U'}
                  </div>
                  <button className="absolute bottom-0 right-0 w-8 h-8 bg-white dark:bg-slate-800 rounded-full border shadow flex items-center justify-center">
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

          {/* Clinic Settings */}
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

          {/* Notifications */}
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

          {/* Appearance */}
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
                      onClick={() => setTheme(option.value as typeof theme)}
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

          {/* Data */}
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
        </div>
      </div>
    </div>
  );
}
