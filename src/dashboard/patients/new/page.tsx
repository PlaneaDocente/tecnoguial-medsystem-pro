'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Save,
  User,
  Phone,
  MapPin,
  Heart,
  Shield,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function NewPatientPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    // Personal Data
    first_name: '',
    last_name: '',
    birth_date: '',
    gender: '',
    curp: '',
    email: '',
    phone: '',
    phone_alt: '',
    // Address
    address: '',
    city: '',
    state: '',
    zip_code: '',
    // Emergency
    emergency_contact: '',
    emergency_phone: '',
    // Medical
    blood_type: '',
    weight: '',
    height: '',
    // Insurance
    insurance_company: '',
    insurance_policy: '',
    insurance_expiry: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!user) {
      setError('Debes iniciar sesión');
      setLoading(false);
      return;
    }

    try {
      const { data, error: insertError } = await supabase
        .from('patients')
        .insert({
          user_id: user.id,
          first_name: formData.first_name,
          last_name: formData.last_name,
          birth_date: formData.birth_date || null,
          gender: formData.gender || null,
          curp: formData.curp || null,
          email: formData.email || null,
          phone: formData.phone,
          phone_alt: formData.phone_alt || null,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          zip_code: formData.zip_code || null,
          emergency_contact: formData.emergency_contact || null,
          emergency_phone: formData.emergency_phone || null,
          blood_type: formData.blood_type || 'unknown',
          weight: formData.weight ? parseFloat(formData.weight) : null,
          height: formData.height ? parseFloat(formData.height) : null,
          insurance_company: formData.insurance_company || null,
          insurance_policy: formData.insurance_policy || null,
          insurance_expiry: formData.insurance_expiry || null,
          status: 'active'
        })
        .select()
        .maybeSingle();

      if (insertError) throw insertError;

      toast.success('Paciente registrado exitosamente');
      router.push(`/patients/${data?.id}`);
    } catch (err) {
      console.error('Error creating patient:', err);
      setError('Error al registrar el paciente. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/patients"
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nuevo Paciente</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Registra un nuevo paciente en el sistema
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Data */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Datos Personales</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Nombre *</Label>
              <Input
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
                placeholder="Juan"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Apellidos *</Label>
              <Input
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
                placeholder="Pérez García"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birth_date">Fecha de Nacimiento</Label>
              <Input
                id="birth_date"
                name="birth_date"
                type="date"
                value={formData.birth_date}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Género</Label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Seleccionar</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
                <option value="other">Otro</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="curp">CURP / DNI</Label>
              <Input
                id="curp"
                name="curp"
                value={formData.curp}
                onChange={handleChange}
                placeholder="XAXX010101HNEXXXX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="blood_type">Tipo de Sangre</Label>
              <select
                id="blood_type"
                name="blood_type"
                value={formData.blood_type}
                onChange={handleChange}
                className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
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

        {/* Contact */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Phone className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Información de Contacto</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono *</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                required
                placeholder="55 1234 5678"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_alt">Teléfono Alternativo</Label>
              <Input
                id="phone_alt"
                name="phone_alt"
                type="tel"
                value={formData.phone_alt}
                onChange={handleChange}
                placeholder="55 8765 4321"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="juan@email.com"
              />
            </div>
          </div>
        </Card>

        {/* Address */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <MapPin className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Dirección</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Dirección Completa</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Calle, número, colonia"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">Ciudad</Label>
              <Input
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Ciudad de México"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">Estado</Label>
              <Input
                id="state"
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="CDMX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zip_code">Código Postal</Label>
              <Input
                id="zip_code"
                name="zip_code"
                value={formData.zip_code}
                onChange={handleChange}
                placeholder="06600"
              />
            </div>
          </div>
        </Card>

        {/* Emergency Contact */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Heart className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Contacto de Emergencia</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emergency_contact">Nombre del Contacto</Label>
              <Input
                id="emergency_contact"
                name="emergency_contact"
                value={formData.emergency_contact}
                onChange={handleChange}
                placeholder="María Pérez"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergency_phone">Teléfono de Emergencia</Label>
              <Input
                id="emergency_phone"
                name="emergency_phone"
                type="tel"
                value={formData.emergency_phone}
                onChange={handleChange}
                placeholder="55 9999 8888"
              />
            </div>
          </div>
        </Card>

        {/* Medical Info */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Información Médica y Seguro</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weight">Peso (kg)</Label>
              <Input
                id="weight"
                name="weight"
                type="number"
                step="0.1"
                value={formData.weight}
                onChange={handleChange}
                placeholder="70.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="height">Altura (cm)</Label>
              <Input
                id="height"
                name="height"
                type="number"
                step="1"
                value={formData.height}
                onChange={handleChange}
                placeholder="170"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="insurance_company">Compañía de Seguro</Label>
              <Input
                id="insurance_company"
                name="insurance_company"
                value={formData.insurance_company}
                onChange={handleChange}
                placeholder="AXA"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="insurance_policy">Número de Póliza</Label>
              <Input
                id="insurance_policy"
                name="insurance_policy"
                value={formData.insurance_policy}
                onChange={handleChange}
                placeholder="123456789"
              />
            </div>
          </div>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Link href="/patients">
            <Button variant="outline" type="button">
              Cancelar
            </Button>
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
