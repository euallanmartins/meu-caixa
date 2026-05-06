import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView, { type WebViewNavigation } from 'react-native-webview';

const FALLBACK_WEB_URL = 'https://SEU-DOMINIO-AQUI';
const APP_USER_AGENT = 'MeuCaixaMobile/1.0';
const WEBVIEW_HEADERS = {
  'ngrok-skip-browser-warning': 'true',
};

function normalizeWebUrl(value: string) {
  const trimmed = value.trim().replace(/\/$/, '');
  return trimmed.length > 0 ? trimmed : FALLBACK_WEB_URL;
}

function MobileShell() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const webUrl = useMemo(
    () => normalizeWebUrl(process.env.EXPO_PUBLIC_WEB_URL ?? FALLBACK_WEB_URL),
    [],
  );

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
    if (event.url.startsWith('about:')) {
      return true;
    }

    try {
      const allowedOrigin = new URL(webUrl).origin;
      const nextUrl = new URL(event.url);

      if (nextUrl.origin === allowedOrigin) {
        return true;
      }

      if (['blob:', 'data:'].includes(nextUrl.protocol)) {
        return true;
      }
    } catch {
      return false;
    }

    return true;
  }

  function handleWebViewError(event: { nativeEvent: { url?: string } }) {
    const failingUrl = event.nativeEvent.url ?? '';

    if (failingUrl.includes('ngrok') && failingUrl.includes('_next')) {
      webViewRef.current?.reload();
      return;
    }

    setLoading(false);
    setHasError(true);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#050505', paddingTop: insets.top }}>
      <StatusBar style="light" backgroundColor="#050505" />

      {hasError ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
            paddingHorizontal: 28,
            paddingBottom: insets.bottom + 24,
          }}
        >
          <Text
            selectable
            style={{
              color: '#ffffff',
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
              color: 'rgba(255,255,255,0.62)',
              fontSize: 16,
              lineHeight: 24,
              textAlign: 'center',
            }}
          >
            Confira sua conexao ou verifique se a URL publica do Meu Caixa esta configurada no EAS.
          </Text>
          <Pressable
            onPress={() => {
              setHasError(false);
              setLoading(true);
              webViewRef.current?.reload();
            }}
            style={{
              minHeight: 54,
              minWidth: 180,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 18,
              backgroundColor: '#00ff88',
            }}
          >
            <Text style={{ color: '#050505', fontSize: 15, fontWeight: '900' }}>
              Tentar novamente
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <WebView
            ref={webViewRef}
            source={{ uri: webUrl, headers: WEBVIEW_HEADERS }}
            onNavigationStateChange={handleNavigationChange}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={handleWebViewError}
            onHttpError={handleWebViewError}
            startInLoadingState
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            pullToRefreshEnabled
            userAgent={APP_USER_AGENT}
            applicationNameForUserAgent={APP_USER_AGENT}
            originWhitelist={['http://*', 'https://*', 'about:*', 'blob:*', 'data:*']}
            allowsBackForwardNavigationGestures
            setSupportMultipleWindows={false}
            style={{ flex: 1, backgroundColor: '#050505' }}
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
                backgroundColor: '#00ff88',
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
                height: 34,
                width: 34,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 17,
                backgroundColor: 'rgba(5,5,5,0.72)',
              }}
            >
              <ActivityIndicator color="#00ff88" />
            </View>
          )}
        </>
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MobileShell />
    </SafeAreaProvider>
  );
}
