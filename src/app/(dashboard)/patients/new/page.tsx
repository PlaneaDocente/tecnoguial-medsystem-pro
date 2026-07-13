'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, User, Phone, MapPin, Heart, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function NewPatientPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    birth_date: '',
    gender: '',
    curp: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    emergency_contact: '',
    emergency_phone: '',
    blood_type: '',
    weight: '',
    height: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const validateForm = (): string | null => {
    if (!formData.first_name.trim()) return 'El nombre es obligatorio';
    if (!formData.last_name.trim()) return 'Los apellidos son obligatorios';
    if (!formData.phone.trim()) return 'El teléfono es obligatorio';
    if (formData.birth_date) {
      const birthDate = new Date(formData.birth_date);
      const today = new Date();
      if (birthDate > today) return 'La fecha de nacimiento no puede ser futura';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      return 'El correo electrónico no es válido';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    if (!user) {
      toast.error('Debes iniciar sesión');
      return;
    }

    setLoading(true);

    try {
      // Payload 100% compatible: solo columnas que existen en tu tabla actual
      const payload: Record<string, any> = {
        user_id: user.id,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        phone: formData.phone.trim()
      };

      if (formData.birth_date) payload.birth_date = formData.birth_date;
      if (formData.gender) payload.gender = formData.gender;
      if (formData.curp.trim()) payload.curp = formData.curp.trim();
      if (formData.email.trim()) payload.email = formData.email.trim();
      if (formData.address.trim()) payload.address = formData.address.trim();
      if (formData.city.trim()) payload.city = formData.city.trim();
      if (formData.state.trim()) payload.state = formData.state.trim();
      if (formData.zip_code.trim()) payload.zip_code = formData.zip_code.trim();
      if (formData.emergency_contact.trim()) payload.emergency_contact = formData.emergency_contact.trim();
      if (formData.emergency_phone.trim()) payload.emergency_phone = formData.emergency_phone.trim();
      if (formData.blood_type && formData.blood_type !== 'unknown') payload.blood_type = formData.blood_type;
      if (formData.weight) payload.weight = parseFloat(formData.weight);
      if (formData.height) payload.height = parseFloat(formData.height);

      const { data, error: insertError } = await supabase
        .from('patients')
        .insert(payload)
        .select()
        .maybeSingle();

      if (insertError) {
        console.error('Supabase insert error:', insertError);
        throw new Error(insertError.message || 'Error al guardar en la base de datos');
      }

      if (!data) {
        throw new Error('No se recibió confirmación del servidor');
      }

      toast.success('Paciente registrado exitosamente');
      router.push(`/patients/${data.id}`);
    } catch (err: any) {
      console.error('Error creating patient:', err);
      const errorMsg = err?.message || 'Error al registrar el paciente.';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/patients" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nuevo Paciente</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Registra un nuevo paciente en el sistema</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Datos Personales</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Nombre *</Label>
              <Input id="first_name" name="first_name" value={formData.first_name} onChange={handleChange} required placeholder="Juan" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Apellidos *</Label>
              <Input id="last_name" name="last_name" value={formData.last_name} onChange={handleChange} required placeholder="Pérez García" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birth_date">Fecha de Nacimiento</Label>
              <Input id="birth_date" name="birth_date" type="date" value={formData.birth_date} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Género</Label>
              <select id="gender" name="gender" value={formData.gender} onChange={handleChange} className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">Seleccionar</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="curp">CURP / DNI</Label>
              <Input id="curp" name="curp" value={formData.curp} onChange={handleChange} placeholder="XAXX010101HNEXXXX" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blood_type">Tipo de Sangre</Label>
              <select id="blood_type" name="blood_type" value={formData.blood_type} onChange={handleChange} className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="unknown">Desconocido</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Phone className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Información de Contacto</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono *</Label>
              <Input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} required placeholder="55 1234 5678" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="juan@email.com" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <MapPin className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Dirección</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Dirección Completa</Label>
              <Input id="address" name="address" value={formData.address} onChange={handleChange} placeholder="Calle, número, colonia" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Ciudad</Label>
              <Input id="city" name="city" value={formData.city} onChange={handleChange} placeholder="Ciudad de México" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">Estado</Label>
              <Input id="state" name="state" value={formData.state} onChange={handleChange} placeholder="CDMX" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip_code">Código Postal</Label>
              <Input id="zip_code" name="zip_code" value={formData.zip_code} onChange={handleChange} placeholder="06600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Heart className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Contacto de Emergencia</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emergency_contact">Nombre del Contacto</Label>
              <Input id="emergency_contact" name="emergency_contact" value={formData.emergency_contact} onChange={handleChange} placeholder="María Pérez" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergency_phone">Teléfono de Emergencia</Label>
              <Input id="emergency_phone" name="emergency_phone" type="tel" value={formData.emergency_phone} onChange={handleChange} placeholder="55 9999 8888" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <User className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Información Médica</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weight">Peso (kg)</Label>
              <Input id="weight" name="weight" type="number" step="0.1" min="0" value={formData.weight} onChange={handleChange} placeholder="70.5" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">Altura (cm)</Label>
              <Input id="height" name="height" type="number" step="1" min="0" value={formData.height} onChange={handleChange} placeholder="170" />
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-4 pb-8">
          <Link href="/patients">
            <Button variant="outline" type="button">Cancelar</Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Guardando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                Guardar Paciente
              </span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}