import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User, Clock, CheckCircle, Star, MessageSquare, MapPin, Phone, Mail, Building2 } from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth';

interface ResponseMetric {
  avg_response_minutes: number | null;
  sample_count: number;
  last_response_at: string | null;
  status: 'reliable' | 'building' | 'insufficient_data';
}

interface Organization {
  id: string;
  legal_name: string;
  phone?: string;
  support_email?: string;
  address_line?: string;
  city?: string;
  province?: string;
  region?: string;
  type?: string;
}

export default function OperatorProfile() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [responseMetric, setResponseMetric] = useState<ResponseMetric | null>(null);

  // Fetch organization data
  const { data: org, isLoading: loadingOrg } = useQuery({
    queryKey: ['organization', orgId],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/operators/org/${orgId}`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Errore nel caricamento organizzazione');
        return await response.json();
      } catch (error) {
        console.error('Errore fetch organizzazione:', error);
        return null;
      }
    },
    enabled: !!orgId,
  });

  // Fetch response metrics
  useEffect(() => {
    if (orgId) {
      fetch(`/api/operators/metrics/ORGANIZATION/${orgId}`, {
        headers: getAuthHeaders(),
      })
        .then(res => res.json())
        .then(data => setResponseMetric(data))
        .catch(err => console.error('Errore caricamento metriche:', err));
    }
  }, [orgId]);

  if (loadingOrg) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center">Caricamento...</div>
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center text-slate-600">Organizzazione non trovata</div>
        </div>
      </div>
    );
  }

  const formatResponseTime = (minutes: number | null) => {
    if (!minutes) return 'N/A';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Indietro
          </Button>
        </div>

        {/* Main Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-slate-900 mb-2">
                  {org.legal_name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-sm">
                    {org.type === 'operator' ? 'Operatore' : org.type === 'vendor' ? 'Vendor' : 'Organizzazione'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Contact Info */}
              {(org.phone || org.support_email || org.address_line) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {org.phone && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <Phone className="w-4 h-4 text-slate-500" />
                      <span className="text-sm">{org.phone}</span>
                    </div>
                  )}
                  {org.support_email && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <Mail className="w-4 h-4 text-slate-500" />
                      <span className="text-sm">{org.support_email}</span>
                    </div>
                  )}
                  {org.address_line && (
                    <div className="flex items-start gap-2 text-slate-700 md:col-span-2">
                      <MapPin className="w-4 h-4 text-slate-500 mt-0.5" />
                      <div className="text-sm">
                        <div>{org.address_line}</div>
                        {org.city && org.province && (
                          <div className="text-slate-600">
                            {org.city}, {org.province}
                            {org.region && ` - ${org.region}`}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Response Metrics */}
        {responseMetric && responseMetric.status !== 'insufficient_data' && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-600" />
                Tempo di Risposta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-2xl font-bold text-slate-900">
                    {formatResponseTime(responseMetric.avg_response_minutes)}
                  </div>
                  <div className="text-sm text-slate-600">
                    Tempo medio di risposta
                  </div>
                </div>
                <div className="border-l border-slate-200 pl-4">
                  <div className="text-lg font-semibold text-slate-900">
                    {responseMetric.sample_count}
                  </div>
                  <div className="text-sm text-slate-600">
                    {responseMetric.sample_count === 1 ? 'risposta' : 'risposte'}
                  </div>
                </div>
                {responseMetric.status === 'building' && (
                  <Badge variant="outline" className="ml-auto">
                    Dato in costruzione
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Placeholder per altre metriche future */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Informazioni</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 text-sm">
              Altre metriche e informazioni verranno aggiunte in seguito.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

