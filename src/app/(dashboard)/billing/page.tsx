'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import {
  CreditCard,
  Check,
  Crown,
  Building2,
  User,
  Download,
  ExternalLink,
  DollarSign,
  X
} from 'lucide-react';

// 🔥 TIPOS (IMPORTANTE)
type Subscription = {
  plan: string;
  status: string;
  current_period_end?: string;
};

type Invoice = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  invoice_date?: string;
  invoice_pdf_url?: string;
};

const plans = [
  {
    id: 'basic',
    name: 'Básico',
    price: 29,
    priceAnnual: 278,
    icon: User,
    features: ['1 usuario','Hasta 100 pacientes','Consultas ilimitadas','Calendario básico','Reportes simples','Soporte por email'],
    notIncluded: ['IA médica','Reportes avanzados','Exportación PDF','Multi-usuario']
  },
  {
    id: 'professional',
    name: 'Profesional',
    price: 79,
    priceAnnual: 758,
    icon: Crown,
    popular: true,
    features: ['1 usuario','Pacientes ilimitados','Consultas ilimitadas','Calendario completo','Asistente IA médica','Reportes avanzados','Exportación PDF','Soporte prioritario'],
    notIncluded: ['Multi-usuario','Multi-sucursal']
  },
  {
    id: 'clinics',
    name: 'Clínicas',
    price: 199,
    priceAnnual: 1910,
    icon: Building2,
    features: ['Hasta 10 usuarios','Pacientes ilimitados','Consultas ilimitadas','Calendario completo','Asistente IA médica','Reportes avanzados','Exportación PDF','Multi-sucursal','API access','Soporte 24/7','Training incluido'],
    notIncluded: []
  }
];

export default function BillingPage() {
  const { user } = useAuth();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
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

      setSubscription(subData as Subscription);

      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      setInvoices((invoicesData || []) as Invoice[]);
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
      <h1 className="text-2xl font-bold">Facturación</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isCurrentPlan = subscription?.plan === plan.id;

          return (
            <Card key={plan.id} className="p-6">
              <div className="text-center mb-6">
                <Icon className="w-6 h-6 mx-auto mb-2" />
                <h3 className="text-xl font-bold">{plan.name}</h3>
              </div>

              <div className="space-y-3 mb-6">
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Check className="w-4 h-4 text-green-600" />
                    <span>{feature}</span>
                  </div>
                ))}

                {plan.notIncluded.map((feature, idx) => (
                  <div key={idx} className="flex gap-2 opacity-50">
                    <X className="w-4 h-4" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <Button disabled={isCurrentPlan}>
                {isCurrentPlan ? 'Plan actual' : 'Seleccionar'}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}