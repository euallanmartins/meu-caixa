import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'meu-caixa-device-id';
const NOTIFICATION_CHANNEL_ID = 'agendamentos';
const isExpoGo = Constants.appOwnership === 'expo';
let notificationsModulePromise: Promise<typeof import('expo-notifications')> | null = null;

export type ExpoPushRegistration = {
  expoPushToken: string;
  deviceId: string;
  platform: string;
};

export type PushRegistrationResult =
  | { ok: true; registration: ExpoPushRegistration }
  | { ok: false; reason: string };

async function getNotificationsModule() {
  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications').then((Notifications) => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });

      return Notifications;
    });
  }

  return notificationsModulePromise;
}

function getExpoProjectId() {
  return (
    Constants.easConfig?.projectId ||
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ||
    undefined
  );
}

async function getOrCreateDeviceId() {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY).catch(() => null);
  if (existing) return existing;

  const generated = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, generated).catch(() => undefined);
  return generated;
}

export async function configureNotificationChannel() {
  if (Platform.OS !== 'android' || isExpoGo) return;

  const Notifications = await getNotificationsModule();

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: 'Agendamentos',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#d6b47a',
    sound: 'default',
  });
}

export async function requestExpoPushRegistration(): Promise<PushRegistrationResult> {
  if (isExpoGo) {
    return {
      ok: false,
      reason: 'Push remoto nao funciona no Expo Go. Use um dev-client ou build APK/IPA.',
    };
  }

  await configureNotificationChannel();

  if (!Device.isDevice) {
    return { ok: false, reason: 'Push notifications exigem um dispositivo fisico.' };
  }

  const Notifications = await getNotificationsModule();
  const currentPermission = await Notifications.getPermissionsAsync();
  let finalStatus = currentPermission.status;

  if (finalStatus !== 'granted') {
    const requestedPermission = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermission.status;
  }

  if (finalStatus !== 'granted') {
    return { ok: false, reason: 'Permissao de notificacao nao concedida.' };
  }

  const projectId = getExpoProjectId();
  const tokenResult = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );

  return {
    ok: true,
    registration: {
      expoPushToken: tokenResult.data,
      deviceId: await getOrCreateDeviceId(),
      platform: Platform.OS,
    },
  };
}

export function addNotificationTapListener(onTargetUrl: (targetUrl: string) => void) {
  if (isExpoGo) {
    return { remove: () => undefined };
  }

  let active = true;
  let subscription: { remove: () => void } | null = null;

  getNotificationsModule()
    .then((Notifications) => {
      if (!active) return;

      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const targetUrl = response.notification.request.content.data?.target_url;
        if (typeof targetUrl === 'string' && targetUrl.trim()) {
          onTargetUrl(targetUrl);
        }
      });
    })
    .catch((error: unknown) => {
      console.warn('[MeuCaixaMobile] Listener de notificacao indisponivel', error);
    });

  return {
    remove: () => {
      active = false;
      subscription?.remove();
    },
  };
}
