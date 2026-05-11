'use client';

import Script from 'next/script';
import { useConsent } from './use-consent';

/**
 * Loads all configured ad/analytics pixels via next/script with the
 * `afterInteractive` strategy so they never block first paint.
 *
 * Each pixel is independently env-var-gated — if an ID is missing the
 * corresponding script tag is not rendered. This lets you wire networks
 * one at a time without code changes.
 *
 * Required env vars (all optional, all NEXT_PUBLIC_*):
 *   NEXT_PUBLIC_GTM_ID                 e.g. GTM-XXXXXXX  — Google Tag Manager
 *   NEXT_PUBLIC_META_PIXEL_ID          e.g. 123456789012345  — Meta (Facebook + Instagram)
 *   NEXT_PUBLIC_LINKEDIN_PARTNER_ID    e.g. 1234567  — LinkedIn Insight Tag
 *   NEXT_PUBLIC_REDDIT_PIXEL_ID        e.g. t2_abc123  — Reddit Ads
 *   NEXT_PUBLIC_TIKTOK_PIXEL_ID        e.g. C123ABCDEF...  — TikTok Pixel
 *
 * Pixels only mount when `consent === 'accepted'`. Rejected/pending → no
 * scripts loaded and no network requests fired.
 */
export function AnalyticsPixels() {
  const { consent } = useConsent();
  if (consent !== 'accepted') return null;

  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const linkedInPartnerId = process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID;
  const redditPixelId = process.env.NEXT_PUBLIC_REDDIT_PIXEL_ID;
  const tiktokPixelId = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;

  return (
    <>
      {/* Google Tag Manager — preferred wrapper for GA4 + Google Ads + future tags */}
      {gtmId && (
        <Script id="gtm-init" strategy="afterInteractive">{`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${gtmId}');
        `}</Script>
      )}

      {/* Meta Pixel */}
      {metaPixelId && (
        <Script id="meta-pixel-init" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${metaPixelId}');
          fbq('track', 'PageView');
        `}</Script>
      )}

      {/* LinkedIn Insight Tag */}
      {linkedInPartnerId && (
        <Script id="linkedin-insight-init" strategy="afterInteractive">{`
          _linkedin_partner_id = "${linkedInPartnerId}";
          window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
          window._linkedin_data_partner_ids.push(_linkedin_partner_id);
          (function(l) {
            if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
            window.lintrk.q=[]}
            var s = document.getElementsByTagName("script")[0];
            var b = document.createElement("script");
            b.type = "text/javascript";b.async = true;
            b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
            s.parentNode.insertBefore(b, s);
          })(window.lintrk);
        `}</Script>
      )}

      {/* Reddit Ads Pixel */}
      {redditPixelId && (
        <Script id="reddit-pixel-init" strategy="afterInteractive">{`
          !function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js",t.async=!0;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);
          rdt('init','${redditPixelId}');
          rdt('track', 'PageVisit');
        `}</Script>
      )}

      {/* TikTok Pixel */}
      {tiktokPixelId && (
        <Script id="tiktok-pixel-init" strategy="afterInteractive">{`
          !function (w, d, t) {
            w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
            ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
            ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
            for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
            ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
            ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
            ttq.load('${tiktokPixelId}');
            ttq.page();
          }(window, document, 'ttq');
        `}</Script>
      )}
    </>
  );
}
