'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { SignaturePad } from '@/components/ui/signature-pad';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  FileText,
  PenLine,
  AlertTriangle,
  Plus,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

type PrivacyNotice = {
  id: string;
  version: string;
  title: string;
  content: string;
  effective_date: string;
  is_active: boolean;
  content_hash: string | null;
  published_at: string;
};

type Consent = {
  id: string;
  patient_id: string;
  privacy_notice_id: string;
  consent_type: string;
  method: string;
  signer_name: string;
  signer_relationship: string;
  granted_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
  evidence_hash: string | null;
};

type PatientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  consent: Consent | null;
};

export default function ConsentsPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<PrivacyNotice | null>(null);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [search, setSearch] = useState('');

  // Publicar aviso
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [nVersion, setNVersion] = useState('');
  const [nTitle, setNTitle] = useState('Aviso de Privacidad');
  const [nContent, setNContent] = useState('');
  const [nDate, setNDate] = useState(new Date().toISOString().slice(0, 10));
  const [savingNotice, setSavingNotice] = useState(false);

  // Registrar consentimiento
  const [consentOpen, setConsentOpen] = useState(false);
  const [target, setTarget] = useState<PatientRow | null>(null);
  const [signerName, setSignerName] = useState('');
  const [relationship, setRelationship] = useState('titular');
  const [method, setMethod] = useState('presencial_firmado');
  const [consentType, setConsentType] = useState('datos_y_tratamiento');
  const [readConfirmed, setReadConfirmed] = useState(false);
  const [expressConsent, setExpressConsent] = useState(false);
  const [signature, setSignature] = useState('');
  const [padOpen, setPadOpen] = useState(false);
  const [consentNotes, setConsentNotes] = useState('');
  const [savingConsent, setSavingConsent] = useState(false);

  // Revocar
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<PatientRow | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [savingRevoke, setSavingRevoke] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: noticeData } = await supabase
        .from('privacy_notices')
        .select('*')
        .eq('is_active', true)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setNotice(noticeData || null);

      const { data: patientData, error: pErr } = await supabase
        .from('patients')
        .select('id, first_name, last_name')
        .eq('user_id', user.id)
        .order('last_name', { ascending: true });

      if (pErr) throw pErr;

      const { data: consentData } = await supabase
        .from('patient_consents')
        .select('*')
        .order('granted_at', { ascending: false });

      const byPatient = new Map<string, Consent>();
      (consentData || []).forEach((c: Consent) => {
        if (!byPatient.has(c.patient_id)) byPatient.set(c.patient_id, c);
      });

      setPatients(
        (patientData || []).map((p: any) => ({
          ...p,
          consent: byPatient.get(p.id) || null,
        }))
      );
    } catch (err: any) {
      console.error('Error loading consents:', err);
      toast.error(err?.message || 'Error al cargar consentimientos');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handlePublishNotice = async () => {
    if (!nVersion.trim() || !nContent.trim()) {
      toast.error('Versión y contenido son obligatorios');
      return;
    }
    setSavingNotice(true);
    try {
      if (notice) {
        const { error: deactErr } = await supabase
          .from('privacy_notices')
          .update({ is_active: false })
          .eq('id', notice.id);
        if (deactErr) throw deactErr;
      }

      const { error: insErr } = await supabase.from('privacy_notices').insert({
        version: nVersion.trim(),
        title: nTitle.trim() || 'Aviso de Privacidad',
        content: nContent.trim(),
        effective_date: nDate,
        is_active: true,
      });
      if (insErr) throw insErr;

      toast.success(`Aviso de privacidad v${nVersion.trim()} publicado`);
      setNoticeOpen(false);
      setNVersion('');
      setNContent('');
      fetchAll();
    } catch (err: any) {
      console.error('Error publishing notice:', err);
      toast.error(err?.message || 'Error al publicar el aviso');
    } finally {
      setSavingNotice(false);
    }
  };

  const openConsent = (p: PatientRow) => {
    setTarget(p);
    setSignerName(`${p.first_name || ''} ${p.last_name || ''}`.trim());
    setRelationship('titular');
    setMethod('presencial_firmado');
    setConsentType('datos_y_tratamiento');
    setReadConfirmed(false);
    setExpressConsent(false);
    setSignature('');
    setConsentNotes('');
    setConsentOpen(true);
  };

  const handleSaveConsent = async () => {
    if (!target || !notice) return;
    if (!signerName.trim()) {
      toast.error('Indica el nombre de quien otorga el consentimiento');
      return;
    }
    if (!readConfirmed || !expressConsent) {
      toast.error('Ambas confirmaciones son obligatorias');
      return;
    }
    if (method === 'presencial_firmado' && !signature) {
      toast.error('Captura la firma o cambia el método de registro');
      return;
    }

    setSavingConsent(true);
    try {
      const { error: insErr } = await supabase.from('patient_consents').insert({
        patient_id: target.id,
        privacy_notice_id: notice.id,
        consent_type: consentType,
        method,
        signer_name: signerName.trim(),
        signer_relationship: relationship,
        signature_data: signature || null,
        notes: consentNotes.trim() || null,
      });
      if (insErr) throw insErr;

      toast.success('Consentimiento registrado');
      setConsentOpen(false);
      fetchAll();
    } catch (err: any) {
      console.error('Error saving consent:', err);
      toast.error(err?.message || 'Error al registrar el consentimiento');
    } finally {
      setSavingConsent(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget?.consent) return;
    if (!revokeReason.trim()) {
      toast.error('Indica el motivo de la revocación');
      return;
    }
    setSavingRevoke(true);
    try {
      const { error: updErr } = await supabase
        .from('patient_consents')
        .update({
          revoked_at: new Date().toISOString(),
          revoked_reason: revokeReason.trim(),
        })
        .eq('id', revokeTarget.consent.id);
      if (updErr) throw updErr;

      toast.success('Consentimiento revocado');
      setRevokeOpen(false);
      setRevokeReason('');
      fetchAll();
    } catch (err: any) {
      console.error('Error revoking consent:', err);
      toast.error(err?.message || 'Error al revocar');
    } finally {
      setSavingRevoke(false);
    }
  };

  const filtered = patients.filter((p) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase().includes(q);
  });

  const withConsent = patients.filter((p) => p.consent && !p.consent.revoked_at).length;
  const revoked = patients.filter((p) => p.consent?.revoked_at).length;
  const missing = patients.length - withConsent - revoked;

  const statusBadge = (p: PatientRow) => {
    if (!p.consent) {
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 gap-1">
          <ShieldX className="w-3 h-3" /> Sin consentimiento
        </Badge>
      );
    }
    if (p.consent.revoked_at) {
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
          <ShieldAlert className="w-3 h-3" /> Revocado
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 gap-1">
        <ShieldCheck className="w-3 h-3" /> Vigente
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Consentimientos</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Aviso de privacidad y consentimiento informado de cada paciente
          </p>
        </div>
        <Button onClick={() => setNoticeOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          {notice ? 'Publicar nueva versión' : 'Publicar aviso de privacidad'}
        </Button>
      </div>

      {/* Aviso legal permanente */}
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
          <p className="font-medium">El texto legal debe validarlo un abogado</p>
          <p>
            Este módulo registra y conserva la evidencia (quién consintió, qué versión del aviso, cuándo y cómo),
            pero no redacta el contenido legal. El aviso de privacidad y el consentimiento informado deben ser
            elaborados o revisados por un abogado en protección de datos y derecho sanitario antes de usarse con pacientes reales.
          </p>
        </div>
      </div>

      {/* Estado del aviso */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Aviso de privacidad vigente</h2>
              {notice ? (
                <div className="mt-1 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                  <p>
                    <span className="font-medium">{notice.title}</span> — versión {notice.version}
                  </p>
                  <p>Vigente desde: {new Date(notice.effective_date + 'T00:00:00').toLocaleDateString('es-MX')}</p>
                  {notice.content_hash && (
                    <p className="font-mono text-xs">Hash SHA-256: {notice.content_hash.slice(0, 32)}...</p>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  No hay aviso publicado. Sin él no puedes registrar consentimientos.
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-2xl font-bold text-green-600">{withConsent}</p>
          <p className="text-sm text-slate-500">Con consentimiento vigente</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-bold text-red-600">{missing}</p>
          <p className="text-sm text-slate-500">Sin consentimiento</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-bold text-amber-600">{revoked}</p>
          <p className="text-sm text-slate-500">Revocados</p>
        </Card>
      </div>

      {/* Listado */}
      <Card className="p-6">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar paciente..."
            className="pl-10"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-slate-500 py-8">No hay pacientes que mostrar.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700 flex-wrap"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white">
                    {p.last_name}, {p.first_name}
                  </p>
                  {p.consent && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {p.consent.revoked_at
                        ? `Revocado el ${new Date(p.consent.revoked_at).toLocaleDateString('es-MX')}`
                        : `Otorgado el ${new Date(p.consent.granted_at).toLocaleDateString('es-MX')} por ${p.consent.signer_name}`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {statusBadge(p)}
                  {!p.consent || p.consent.revoked_at ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!notice}
                      onClick={() => openConsent(p)}
                      className="gap-2"
                    >
                      <PenLine className="w-4 h-4" />
                      Registrar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRevokeTarget(p);
                        setRevokeReason('');
                        setRevokeOpen(true);
                      }}
                    >
                      Revocar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal: publicar aviso */}
      <Dialog open={noticeOpen} onOpenChange={setNoticeOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Publicar aviso de privacidad</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-300">
              Pega aquí el texto que te haya entregado o validado tu abogado. Una vez publicado no podrá
              editarse: para cambiarlo se publica una nueva versión, y así queda registro de qué texto
              exacto aceptó cada paciente.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nversion">Versión *</Label>
                <Input id="nversion" value={nVersion} onChange={(e) => setNVersion(e.target.value)} placeholder="1.0" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ntitle">Título</Label>
                <Input id="ntitle" value={nTitle} onChange={(e) => setNTitle(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ndate">Fecha de entrada en vigor</Label>
              <Input id="ndate" type="date" value={nDate} onChange={(e) => setNDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ncontent">Texto del aviso *</Label>
              <textarea
                id="ncontent"
                value={nContent}
                onChange={(e) => setNContent(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                placeholder="Pega aquí el texto íntegro del aviso de privacidad validado por tu abogado..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoticeOpen(false)}>Cancelar</Button>
            <Button onClick={handlePublishNotice} disabled={savingNotice}>
              {savingNotice ? 'Publicando...' : 'Publicar versión'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: registrar consentimiento */}
      <Dialog open={consentOpen} onOpenChange={setConsentOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Registrar consentimiento — {target?.first_name} {target?.last_name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {notice && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm">
                <p className="font-medium text-slate-900 dark:text-white mb-1">
                  {notice.title} — versión {notice.version}
                </p>
                <div className="max-h-40 overflow-y-auto text-slate-600 dark:text-slate-400 whitespace-pre-wrap text-xs">
                  {notice.content}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="signer">Nombre de quien consiente *</Label>
                <Input id="signer" value={signerName} onChange={(e) => setSignerName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rel">En calidad de</Label>
                <select
                  id="rel"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800"
                >
                  <option value="titular">Titular (el paciente)</option>
                  <option value="tutor">Tutor</option>
                  <option value="representante_legal">Representante legal</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ctype">Alcance</Label>
                <select
                  id="ctype"
                  value={consentType}
                  onChange={(e) => setConsentType(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800"
                >
                  <option value="datos_y_tratamiento">Datos personales y tratamiento médico</option>
                  <option value="datos_personales">Solo datos personales</option>
                  <option value="tratamiento_medico">Solo tratamiento médico</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="method">Método de registro</Label>
                <select
                  id="method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800"
                >
                  <option value="presencial_firmado">Presencial con firma</option>
                  <option value="digital_en_app">Digital en la app</option>
                  <option value="verbal_con_testigo">Verbal con testigo</option>
                </select>
              </div>
            </div>

            {method === 'presencial_firmado' && (
              <div className="space-y-2">
                <Label>Firma *</Label>
                {signature ? (
                  <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-2 flex items-center justify-between gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={signature} alt="Firma capturada" className="h-16 bg-white rounded" />
                    <Button variant="outline" size="sm" onClick={() => setPadOpen(true)}>Volver a firmar</Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setPadOpen(true)} className="gap-2 w-full">
                    <PenLine className="w-4 h-4" />
                    Capturar firma
                  </Button>
                )}
                <p className="text-xs text-slate-500">
                  Esta firma es evidencia gráfica, no una firma electrónica avanzada. Se sella junto con la
                  fecha y la versión del aviso mediante hash SHA-256.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="cnotes">Observaciones</Label>
              <Input
                id="cnotes"
                value={consentNotes}
                onChange={(e) => setConsentNotes(e.target.value)}
                placeholder={method === 'verbal_con_testigo' ? 'Nombre del testigo, circunstancias...' : 'Opcional'}
              />
            </div>

            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={readConfirmed}
                  onChange={(e) => setReadConfirmed(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Se puso a disposición el aviso de privacidad y la persona manifiesta haberlo leído y comprendido.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={expressConsent}
                  onChange={(e) => setExpressConsent(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Otorga su consentimiento expreso para el tratamiento de sus datos personales sensibles de salud
                  (LFPDPPP art. 9).
                </span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConsentOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveConsent} disabled={savingConsent}>
              {savingConsent ? 'Guardando...' : 'Registrar consentimiento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: revocar */}
      <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revocar consentimiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              El titular puede revocar su consentimiento en cualquier momento (LFPDPPP art. 8).
              El registro original no se borra: queda marcado como revocado con su fecha y motivo.
            </p>
            <div className="space-y-2">
              <Label htmlFor="rreason">Motivo de la revocación *</Label>
              <Input
                id="rreason"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Solicitud del titular..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeOpen(false)}>Cancelar</Button>
            <Button onClick={handleRevoke} disabled={savingRevoke}>
              {savingRevoke ? 'Revocando...' : 'Confirmar revocación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SignaturePad
        open={padOpen}
        onOpenChange={setPadOpen}
        onSave={(dataUrl) => {
          setSignature(dataUrl);
          setPadOpen(false);
        }}
      />
    </div>
  );
}
