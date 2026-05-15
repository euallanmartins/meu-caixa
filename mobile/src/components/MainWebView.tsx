import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView, {
  type WebViewMessageEvent,
  type WebViewNavigation,
} from 'react-native-webview';
import { ALLOWED_HOST, APP_USER_AGENT, WEB_URL } from '../config';
import {
  addNotificationTapListener,
  requestExpoPushRegistration,
  type ExpoPushRegistration,
} from '../services/pushNotifications';
import { theme } from '../theme';

type PushContext = {
  barbearia_id?: string | null;
  barbeiro_id?: string | null;
  cliente_id?: string | null;
};

type NativeBridgeMessage = {
  type?: string;
  target_url?: string;
  url?: string;
  context?: PushContext;
};

const allowedOrigin = new URL(WEB_URL).origin;

const bridgeScript = `
  window.MeuCaixaMobile = {
    enabled: true,
    requestPushToken: function(context) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'REQUEST_EXPO_PUSH_TOKEN',
        context: context || {}
      }));
    },
    openTarget: function(targetUrl) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'OPEN_TARGET_URL',
        target_url: targetUrl
      }));
    }
  };
  true;
`;

function buildWebUrl(targetUrl?: string | null) {
  const target = targetUrl?.trim();
  if (!target) return WEB_URL;

  if (target.startsWith('/')) {
    return `${WEB_URL}${target}`;
  }

  try {
    const parsed = new URL(target);

    if (parsed.protocol === 'meucaixa:') {
      const path = parsed.hostname
        ? `/${parsed.hostname}${parsed.pathname}`
        : parsed.pathname || '/';
      return `${WEB_URL}${path}${parsed.search}${parsed.hash}`;
    }

    if (parsed.protocol === 'https:' && parsed.host === ALLOWED_HOST) {
      return parsed.toString();
    }
  } catch {
    return WEB_URL;
  }

  return WEB_URL;
}

function isExternalAllowed(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.host.toLowerCase();

    return (
      ['tel:', 'mailto:', 'whatsapp:'].includes(parsed.protocol) ||
      host === 'wa.me' ||
      host === 'api.whatsapp.com' ||
      host === 'web.whatsapp.com' ||
      host === 'instagram.com' ||
      host === 'www.instagram.com'
    );
  } catch {
    return false;
  }
}

function canLoadInsideWebView(url: string) {
  if (url.startsWith('about:') || url.startsWith('blob:') || url.startsWith('data:')) {
    return true;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.host === ALLOWED_HOST;
  } catch {
    return false;
  }
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        paddingHorizontal: 28,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 24,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(214,180,122,0.13)',
          borderWidth: 1,
          borderColor: 'rgba(214,180,122,0.28)',
        }}
      >
        <Text style={{ color: theme.accent, fontSize: 28, fontWeight: '900' }}>!</Text>
      </View>
      <Text
        selectable
        style={{
          color: theme.text,
          fontSize: 26,
          fontWeight: '900',
          textAlign: 'center',
        }}
      >
        Nao foi possivel carregar
      </Text>
      <Text
        selectable
        style={{
          color: theme.muted,
          fontSize: 16,
          lineHeight: 24,
          textAlign: 'center',
        }}
      >
        Confira sua conexao e tente novamente. O Meu Caixa continua seguro no app.
      </Text>
      <Pressable
        onPress={onRetry}
        style={{
          minHeight: 54,
          minWidth: 190,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 16,
          backgroundColor: theme.accent,
        }}
      >
        <Text style={{ color: theme.background, fontSize: 15, fontWeight: '900' }}>
          Tentar novamente
        </Text>
      </Pressable>
    </View>
  );
}

export default function MainWebView() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [uri, setUri] = useState(WEB_URL);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [pushRegistration, setPushRegistration] = useState<ExpoPushRegistration | null>(null);

  const source = useMemo(() => ({ uri }), [uri]);

  const navigateToTarget = useCallback((targetUrl?: string | null) => {
    const nextUrl = buildWebUrl(targetUrl);
    setHasError(false);
    setLoading(true);
    setUri(nextUrl);
    webViewRef.current?.injectJavaScript(
      `window.location.href = ${JSON.stringify(nextUrl)}; true;`,
    );
  }, []);

  const registerPushTokenInWeb = useCallback(
    (context?: PushContext | null) => {
      if (!pushRegistration) return;

      const payload = {
        expo_push_token: pushRegistration.expoPushToken,
        device_id: pushRegistration.deviceId,
        platform: pushRegistration.platform,
        barbearia_id: context?.barbearia_id || null,
        barbeiro_id: context?.barbeiro_id || null,
        cliente_id: context?.cliente_id || null,
      };

      const script = `
        (function() {
          fetch('/api/push/register-token', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: ${JSON.stringify(JSON.stringify(payload))}
          }).catch(function(error) {
            console.warn('[MeuCaixaMobile] Push token nao registrado ainda.', error && error.message);
          });
        })();
        true;
      `;

      webViewRef.current?.injectJavaScript(script);
    },
    [pushRegistration],
  );

  useEffect(() => {
    requestExpoPushRegistration()
      .then((result) => {
        if (result.ok) {
          setPushRegistration(result.registration);
        }
      })
      .catch((error: unknown) => {
        console.warn('[MeuCaixaMobile] Push indisponivel', error);
      });
  }, []);

  useEffect(() => {
    const subscription = addNotificationTapListener(navigateToTarget);
    return () => subscription.remove();
  }, [navigateToTarget]);

  useEffect(() => {
    Linking.getInitialURL()
      .then((initialUrl) => {
        if (initialUrl) navigateToTarget(initialUrl);
      })
      .catch(() => undefined);

    const subscription = Linking.addEventListener('url', ({ url }) => {
      navigateToTarget(url);
    });

    return () => subscription.remove();
  }, [navigateToTarget]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) return false;
      webViewRef.current?.goBack();
      return true;
    });

    return () => subscription.remove();
  }, [canGoBack]);

  function handleNavigationChange(event: WebViewNavigation) {
    setCanGoBack(event.canGoBack);
  }

  function handleShouldStartLoad(event: WebViewNavigation) {
    if (canLoadInsideWebView(event.url)) return true;

    if (isExternalAllowed(event.url)) {
      Linking.openURL(event.url).catch(() => undefined);
    }

    return false;
  }

  function handleMessage(event: WebViewMessageEvent) {
    let message: NativeBridgeMessage | null = null;

    try {
      message = JSON.parse(event.nativeEvent.data) as NativeBridgeMessage;
    } catch {
      return;
    }

    if (message.type === 'REQUEST_EXPO_PUSH_TOKEN') {
      registerPushTokenInWeb(message.context || null);
      return;
    }

    if (message.type === 'OPEN_TARGET_URL') {
      navigateToTarget(message.target_url || message.url || null);
    }
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.background,
        paddingTop: insets.top,
        paddingBottom: Platform.OS === 'ios' ? insets.bottom : 0,
      }}
    >
      <StatusBar style="light" backgroundColor={theme.background} />

      {hasError ? (
        <ErrorState
          onRetry={() => {
            setHasError(false);
            setLoading(true);
            webViewRef.current?.reload();
          }}
        />
      ) : (
        <>
          <WebView
            ref={webViewRef}
            source={source}
            onNavigationStateChange={handleNavigationChange}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            onMessage={handleMessage}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => {
              setLoading(false);
              registerPushTokenInWeb(null);
            }}
            onError={(event) => {
              console.warn('[MeuCaixaMobile] WebView error', event.nativeEvent.description);
              setLoading(false);
              setHasError(true);
            }}
            onHttpError={(event) => {
              const statusCode = event.nativeEvent.statusCode;
              const failingUrl = event.nativeEvent.url || '';
              console.warn('[MeuCaixaMobile] HTTP error', statusCode, failingUrl);
              setLoading(false);

              if (statusCode >= 500 && failingUrl.startsWith(allowedOrigin)) {
                setHasError(true);
              }
            }}
            injectedJavaScriptBeforeContentLoaded={bridgeScript}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            pullToRefreshEnabled
            startInLoadingState
            userAgent={APP_USER_AGENT}
            applicationNameForUserAgent={APP_USER_AGENT}
            originWhitelist={[
              `${allowedOrigin}/*`,
              'about:*',
              'blob:*',
              'data:*',
              'tel:*',
              'mailto:*',
              'whatsapp:*',
            ]}
            allowsBackForwardNavigationGestures
            allowsInlineMediaPlayback
            setSupportMultipleWindows={false}
            style={{ flex: 1, backgroundColor: theme.background }}
          />

          {loading && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: insets.top,
                right: 0,
                left: 0,
                height: 3,
                backgroundColor: theme.accent,
              }}
            />
          )}

          {loading && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: insets.top + 16,
                right: 16,
                height: 38,
                width: 38,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 19,
                backgroundColor: 'rgba(6,6,6,0.76)',
                borderWidth: 1,
                borderColor: theme.borderSoft,
              }}
            >
              <ActivityIndicator color={theme.accent} />
            </View>
          )}
        </>
      )}
    </View>
  );
}
