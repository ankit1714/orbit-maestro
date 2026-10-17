'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, AlertOctagon, RefreshCw, CalendarDays, ArrowRight } from 'lucide-react';
import { api, getOAuthRedirectUri } from '@/lib/api';

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<'PROCESSING' | 'SUCCESS' | 'ERROR'>('PROCESSING');
  const [message, setMessage] = useState('Exchanging authorization code with Google...');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('ERROR');
      setMessage(`Google authorization error: ${error}`);
      return;
    }

    if (!code) {
      setStatus('ERROR');
      setMessage('No authorization code received from Google.');
      return;
    }

    const processCode = async () => {
      try {
        const redirectUri = getOAuthRedirectUri();
        const res = await api.exchangeOAuthCallback({
          code,
          redirect_uri: redirectUri
        });

        if (res.success) {
          setStatus('SUCCESS');
          setUserEmail(res.user_email || 'your Google account');
          setMessage(`Connected to Google Calendar successfully as ${res.user_email || 'Google User'}!`);

          if (res.access_token && typeof window !== 'undefined') {
            localStorage.setItem('gcal_access_token', res.access_token);
          }
          if (res.user_email && typeof window !== 'undefined') {
            localStorage.setItem('gcal_user_email', res.user_email);
          }

          setTimeout(() => {
            window.location.href = '/';
          }, 1500);
        } else {
          setStatus('ERROR');
          setMessage(res.message || 'Failed to exchange OAuth authorization code.');
        }
      } catch (err: any) {
        console.error('OAuth Callback processing error:', err);
        setStatus('ERROR');
        setMessage(err?.message || 'Failed to connect Google Calendar. Please try again.');
      }
    };

    processCode();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4">
      <div className="bg-white border border-[#dadce0] rounded-2xl max-w-md w-full p-8 shadow-xl text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-[#e8f0fe] border border-[#d2e3fc] flex items-center justify-center mx-auto text-[#1a73e8]">
          <CalendarDays className="w-7 h-7" />
        </div>

        <div>
          <h1 className="text-lg font-bold text-[#202124]">
            Google Calendar Synchronization
          </h1>
          <p className="text-xs text-[#5f6368] mt-1">
            AI Scrum Master · Meeting Intelligence & Gemini Notes
          </p>
        </div>

        {status === 'PROCESSING' && (
          <div className="p-6 rounded-xl bg-[#f8f9fa] border border-[#dadce0] space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-[#1a73e8] mx-auto" />
            <p className="text-xs text-[#202124] font-medium">{message}</p>
          </div>
        )}

        {status === 'SUCCESS' && (
          <div className="p-6 rounded-xl bg-[#e6f4ea] border border-[#ceead6] space-y-3 animate-in fade-in">
            <CheckCircle2 className="w-7 h-7 text-[#137333] mx-auto" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#137333]">{message}</p>
              <p className="text-[11px] text-[#5f6368]">Redirecting you back to the Cockpit...</p>
            </div>
          </div>
        )}

        {status === 'ERROR' && (
          <div className="p-6 rounded-xl bg-[#fce8e6] border border-[#fad2cf] space-y-4">
            <AlertOctagon className="w-7 h-7 text-[#c5221f] mx-auto" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#c5221f]">Connection Failed</p>
              <p className="text-[11px] text-[#5f6368] leading-relaxed">{message}</p>
            </div>
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              className="px-4 py-2 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-bold flex items-center justify-center gap-2 mx-auto transition shadow-sm"
            >
              <span>Return to Cockpit</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4">
        <div className="bg-white border border-[#dadce0] rounded-2xl p-8 shadow-xl text-center space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin text-[#1a73e8] mx-auto" />
          <p className="text-xs text-[#5f6368]">Loading Google Authorization...</p>
        </div>
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  );
}
