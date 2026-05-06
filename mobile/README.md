# Meu Caixa Mobile

App Expo que empacota a versao web do Meu Caixa em um APK Android.

## Configuracao obrigatoria

O APK precisa apontar para uma URL publica. `localhost:3000` nao funciona no celular.

Edite `mobile/eas.json` e troque:

```json
"EXPO_PUBLIC_WEB_URL": "https://SEU-DOMINIO-AQUI"
```

por uma URL real, por exemplo:

```json
"EXPO_PUBLIC_WEB_URL": "https://meu-caixa.vercel.app"
```

## Build APK

```bash
cd mobile
npm install
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build -p android --profile apk
```

Ao final, o EAS mostra um link para baixar o APK.
