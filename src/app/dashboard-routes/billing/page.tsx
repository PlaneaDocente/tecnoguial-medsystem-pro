'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from "lucide-react";

import {
  CreditCard,
  Check,
  Crown,
  Building2,
  User,
  Download,
  ExternalLink,
  DollarSign
} from 'lucide-react';

const plans = [
  {
    id: 'basic',
    name: 'Básico',
    price: 29,
    priceAnnual: 278,
    icon: User,
    features: [
      '1 usuario',
      'Hasta 100 pacientes',
      'Consultas ilimitadas',
      'Calendario básico',
      'Reportes simples',
      'Soporte por email'
    ],
    notIncluded: [
      'IA médica',
      'Reportes avanzados',
      'Exportación PDF',
      'Multi-usuario'
    ]
  },
  {
    id: 'professional',
    name: 'Profesional',
    price: 79,
    priceAnnual: 758,
    icon: Crown,
    popular: true,
    features: [
      '1 usuario',
      'Pacientes ilimitados',
      'Consultas ilimitadas',
      'Calendario completo',
      'Asistente IA médica',
      'Reportes avanzados',
      'Exportación PDF',
      'Soporte prioritario'
    ],
    notIncluded: [
      'Multi-usuario',
      'Multi-sucursal'
    ]
  },
  {
    id: 'clinics',
    name: 'Clínicas',
    price: 199,
    priceAnnual: 1910,
    icon: Building2,
    features: [
      'Hasta 10 usuarios',
      'Pacientes ilimitados',
      'Consultas ilimitadas',
      'Calendario completo',
      'Asistente IA médica',
      'Reportes avanzados',
      'Exportación PDF',
      'Multi-sucursal',
      'API access',
      'Soporte 24/7',
      'Training incluido'
    ],
    notIncluded: []
  }
];

export default function BillingPage() {
  const { user, profile } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    if (user) fetchBillingData();
  }, [user]);

  const fetchBillingData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      setSubscription(subData);

      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      setInvoices(invoicesData || []);
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentPlan = () => {
    if (!subscription) return plans[0];
    return plans.find(p => p.id === subscription.plan) || plans[0];
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      past_due: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      trialing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    };
    return styles[status] || styles.trialing;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Facturación</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Gestiona tu suscripción y pagos
        </p>
      </div>

      {/* Current Subscription */}
      {subscription && (
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Plan Actual</p>
              <div className="flex items-center gap-3 mt-1">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {getCurrentPlan().name}
                </h3>
                <Badge className={getStatusBadge(subscription.status)}>
                  {subscription.status === 'active' ? 'Activo' :
                   subscription.status === 'cancelled' ? 'Cancelado' :
                   subscription.status === 'past_due' ? 'Pago pendiente' : 'Prueba'}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                ${billingPeriod === 'monthly' ? getCurrentPlan().price : getCurrentPlan().priceAnnual}
                <span className="text-sm font-normal text-slate-500">
                  /{billingPeriod === 'monthly' ? 'mes' : 'año'}
                </span>
              </p>
              {subscription.current_period_end && (
                <p className="text-sm text-slate-500 mt-1">
                  Próximo cobro: {new Date(subscription.current_period_end).toLocaleDateString('es-ES')}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Plan Selection */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Planes de Suscripción
        </h2>

        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingPeriod === 'monthly'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingPeriod === 'annual'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Anual <span className="text-green-600 ml-1">-20%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isCurrentPlan = subscription?.plan === plan.id;

            return (
              <Card
                key={plan.id}
                className={`relative p-6 ${
                  plan.popular
                    ? 'ring-2 ring-blue-500 dark:ring-blue-400'
                    : ''
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white">
                    Más Popular
                  </Badge>
                )}

                <div className="text-center mb-6">
                  <div className={`w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-3 ${
                    plan.popular
                      ? 'bg-blue-100 dark:bg-blue-900/30'
                      : 'bg-slate-100 dark:bg-slate-800'
                  }`}>
                    <Icon className={`w-6 h-6 ${
                      plan.popular ? 'text-blue-600' : 'text-slate-600 dark:text-slate-400'
                    }`} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-slate-900 dark:text-white">
                      ${billingPeriod === 'monthly' ? plan.price : plan.priceAnnual}
                    </span>
                    <span className="text-slate-500">
                      /{billingPeriod === 'monthly' ? 'mes' : 'año'}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-600 dark:text-slate-300">{feature}</span>
                    </div>
                  ))}
                  {plan.notIncluded.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2 opacity-50">
                      <X className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-400">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  variant={plan.popular ? 'default' : 'outline'}
                  className="w-full"
                  disabled={isCurrentPlan}
                >
                  {isCurrentPlan ? 'Plan Actual' : plan.id === 'basic' || subscription ? 'Cambiar Plan' : 'Suscribirse'}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Invoice History */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Historial de Facturas
          </h3>
        </div>

        {invoices.length === 0 ? (
          <p className="text-center text-slate-500 py-8">No hay facturas registradas</p>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {getCurrentPlan().name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {invoice.invoice_date
                        ? new Date(invoice.invoice_date).toLocaleDateString('es-ES')
                        : new Date(invoice.created_at).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      ${(invoice.amount / 100).toFixed(2)}
                    </p>
                    <Badge className={getStatusBadge(invoice.status)}>
                      {invoice.status === 'paid' ? 'Pagada' : invoice.status}
                    </Badge>
                  </div>
                  {invoice.invoice_pdf_url && (
                    <Button variant="ghost" size="icon">
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Payment Method */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Método de Pago</p>
              <p className="text-sm text-slate-500">•••• •••• •••• 4242</p>
            </div>
          </div>
          <Button variant="outline" className="gap-2">
            <ExternalLink className="w-4 h-4" />
            Gestionar
          </Button>
        </div>
      </Card>
    </div>
  );
}
